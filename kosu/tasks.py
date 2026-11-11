# ============================================================
# ファイル名 : tasks.py
# 種別       : 非同期タスク（バックグラウンドで実行する処理）
# 概要       : 管理者用の「データ管理」画面（/manager-loading）から実行される、各データの
#              バックアップ（Excelファイル作成）・ロード（Excelファイルから復元）・期間指定削除の処理群。
#              views/asynchronous_views.py の backup() がURLに応じて関数を選び、
#              handle_task 経由で別スレッド（threading）で実行する（Django-Q からは呼ばれていない）。
#
# 主な関数（データ種別ごと）:
#   - 工数データ          : generate_kosu_backup / delete_kosu_data / load_kosu_file
#   - 人員データ          : generate_member_backup / load_member_file
#   - 班員データ          : generate_team_backup / load_team_file
#   - 工数区分定義データ  : generate_def_backup / load_def_file
#   - 作業詳細選択肢データ: generate_choice_backup / load_choice_file
#   - 問い合わせデータ    : generate_inquiry_backup / load_inquiry_file
#   - 管理者設定データ    : generate_setting_backup / load_setting_file
#   - タスク履歴データ    : generate_AsyncTask_backup / delete_AsyncTask_data
#   - 操作履歴データ      : generate_History_backup / delete_History_data
#
# 戻り値の約束（asynchronous_views.handle_task が受け取り、AsyncTask に保存する）:
#   - generate_〇〇 : 作成したExcelファイルのパス（文字列）。画面は、このパスのファイル名（check_task_status がファイル名だけを返す）でファイルをダウンロードする
#   - load_〇〇     : 成功時 ({'status': 'success'}, None)
#                     失敗時 ({'status': 'error', 'message': エラー内容}, None)
#   - delete_〇〇   : None
#
# 保存先     : バックアップファイルは settings.MEDIA_ROOT（プロジェクト直下の media フォルダ）に保存する。
# 補足       : - ロード関数は atomic_load（トランザクション: 全件まとめて確定/取り消しする仕組み）の中で動くため、
#                途中でエラーになった時は、それまでに登録・削除した行もすべて取り消す。
#                整合性エラーの行だけを飛ばす所は、セーブポイントでその行の分だけを取り消して次の行へ進む。
#              - ロード・削除で変更したデータも signals.py により操作履歴（History）に記録される。
#                本番では別スレッドで動くためログイン者を取得できず、履歴の login_No は空（None）になる。
# 関連ファイル: views/asynchronous_views.py（呼び出し元）, models.py, utils/kosu_utils.py, signals.py,
#              frontend/src/AdministratorPage/AdministratorLoading.tsx（データ管理画面）
# ============================================================

# ============================================================
# インポート
# ============================================================
import os  # 保存先フォルダの作成・一時ファイルの削除
from django.conf import settings  # MEDIA_ROOT（保存先フォルダ）・TIME_ZONE（タイムゾーン）の参照
import openpyxl  # Excelファイル（.xlsx）の作成・読み込み
import pytz  # タイムゾーン変換（DBに保存された日時 → 日本時間）
import datetime  # 日付の取得・文字列からの変換
# 各データのモデル（models.py）
from .models import Business_Time_graph, kosu_division, def_choice, member, team_member, \
                    inquiry_data, administrator_data, AsyncTask, History
from django.db import IntegrityError, transaction  # DBの整合性エラー / 複数の書き込みを「全部する・全部しない」にまとめる
from django.core.exceptions import ObjectDoesNotExist  # 該当するレコードが無いときの例外
import functools  # デコレーターを作る時に、元の関数の名前などを引き継ぐ



# ロード関数を「全部入れるか、何も変えないか」にするデコレーター。
#
# ロード関数の中身をデータベースのトランザクション（まとめて確定・まとめて取り消し）の中で動かし、
# 途中で失敗して {'status': 'error'} を返した時は、それまでの削除・登録を全部取り消す。
# （前は 1 行ずつ確定していたので、途中で失敗すると「古いデータは消えたのに新しいデータは半分」になった）
#
# 引数:
#   func: ロード関数（load_kosu_file など）
# 戻り値:
#   トランザクションの中で func を呼ぶ関数
def atomic_load(func):
  @functools.wraps(func)
  def wrapper(*args, **kwargs):
    with transaction.atomic():
      result = func(*args, **kwargs)
      if isinstance(result, tuple) and result and isinstance(result[0], dict) and result[0].get('status') == 'error':
        transaction.set_rollback(True)
      return result
  return wrapper




#--------------------------------------------------------------------------------------------------------





# ============================================================
# 工数データ（Business_Time_graph）
# ============================================================
# 工数データを期間指定でExcelファイルにバックアップする。
#
# 就業日が開始日〜終了日の工数データを1件1行で書き出し、media フォルダに保存する。
# 列の並びは load_kosu_file の見出しと同じため、作成したファイルはそのままロード（復元）に使える。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/kosu_backup/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/工数データバックアップ_2026-11-01_2026-11-07.xlsx）
def generate_kosu_backup(start_day, end_day):
  # 新しいExcelブック（ファイル）を作成し、最初のシート（active）を取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目に見出し行を書き込む（工数データの各項目に対応）
  headers = [
    '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直',
    '作業内容', '作業詳細', '残業時間', '昼休憩時間',
    '残業休憩時間1', '残業休憩時間2', '残業休憩時間3',
    '就業形態', '工数入力OK_NG', '休憩変更チェック',
    ]
  ws.append(headers)

  # 就業日（work_day2）が開始日以上・終了日以下の工数データを取得
  kosu_data = Business_Time_graph.objects.filter(
    work_day2__gte=start_day, work_day2__lte=end_day
    )

  # 工数データを1件ずつ、1行として書き込む
  for item in kosu_data:
    # 見出しと同じ順に値を並べる
    #   氏名（name）は人員データへの外部キーのため、str() で氏名の文字列にする（人員が削除済みなら 'None'）
    row = [
      item.employee_no3, str(item.name), item.def_ver2, item.work_day2,
      item.tyoku2, item.time_work, item.detail_work, item.over_time,
      item.breaktime, item.breaktime_over1, item.breaktime_over2,
      item.breaktime_over3, item.work_time, item.judgement,
      item.break_change,
      ]
    ws.append(row)

  # 保存先のフォルダ（settings.MEDIA_ROOT = プロジェクト直下の media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に期間を含めて保存する（同じ名前のファイルがあれば上書きされる）
  filename = f'工数データバックアップ_{start_day}_{end_day}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す（handle_task が AsyncTask.result に保存し、画面がダウンロードに使う）
  return filepath





#--------------------------------------------------------------------------------------------------------





# 期間内の工数データを一括削除する。
#
# 就業日が開始日〜終了日の工数データをすべて削除する（元に戻すにはバックアップファイルのロードが必要）。
# 削除された1件ごとに signals.py の post_delete が動き、操作履歴（History）に記録される。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/kosu_delet/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   None（handle_task により AsyncTask は成功扱いになる）
def delete_kosu_data(start_day, end_day):
  # 就業日が開始日以上・終了日以下の工数データを取得
  kosu_obj = Business_Time_graph.objects.filter(work_day2__gte=start_day, work_day2__lte=end_day)
  # 取得した工数データをまとめて削除
  kosu_obj.delete()

  # 削除処理は返す値が無いため None を返す
  return None




#--------------------------------------------------------------------------------------------------------





# 工数データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しが generate_kosu_backup と同じ並びかをチェックしてから、2行目以降を1行ずつ登録する。
# 同じ従業員番号・就業日の工数データがすでにある場合は、削除してからファイルの内容で登録し直す（上書き）。
# 人員データに存在しない従業員番号の行、登録時に整合性エラーになった行はスキップする。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/kosu_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_kosu_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path
    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_kosu_backup の headers と同じ並び）
    expected_headers = [
      '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直',
      '作業内容', '作業詳細', '残業時間', '昼休憩時間',
      '残業休憩時間1', '残業休憩時間2', '残業休憩時間3',
      '就業形態', '工数入力OK_NG', '休憩変更チェック',
    ]

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    #   ws.cell(行, 列): 指定したセルを取得する（行・列とも1始まり）
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合（別データのファイル等）は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 4. データを読み込んでDBに保存する（1行目は見出しなので、2行目から最終行 max_row まで）
    for i in range(2, ws.max_row + 1):
      # 従業員番号（1列目）と就業日（4列目）を取得
      employee_no = ws.cell(row=i, column=1).value
      work_day2 = ws.cell(row=i, column=4).value

      # 従業員番号に対応する人員データを取得する（工数データの氏名＝外部キーに設定するため）
      try:
        member_instance = member.objects.get(employee_no=employee_no)
      # 人員データに存在しない従業員番号の場合は、警告を標準出力に出してこの行をスキップする
      except ObjectDoesNotExist:
        print(f"警告: 従業員番号 {employee_no} (行 {i}) のメンバーが見つかりませんでした。スキップします。")
        continue # 次のループへ進む

      # 同じ従業員番号・就業日の工数データがすでにあれば削除する（ファイルの内容で置き換えるため）
      existing_data = Business_Time_graph.objects.filter(
        employee_no3=employee_no, work_day2=work_day2
        )
      if existing_data.exists():
        existing_data.delete()

      # ファイルの1行分の値で工数データを新規作成し、DBに保存する
      #   列番号: 3=工数区分定義Ver, 5=直, 6=作業内容, 7=作業詳細, 8=残業時間, 9=昼休憩時間,
      #           10〜12=残業休憩時間1〜3, 13=就業形態, 14=工数入力OK/NG判定, 15=休憩変更チェック
      #   （2列目の氏名は使わず、従業員番号から取得した人員データを設定する）
      try:
        sid = transaction.savepoint()  # この行だけを取り消せるよう、印を付けておく
        Business_Time_graph.objects.create(
          employee_no3=employee_no,
          name=member_instance, 
          def_ver2=ws.cell(row=i, column=3).value,
          work_day2=work_day2,
          tyoku2=ws.cell(row=i, column=5).value,
          time_work=ws.cell(row=i, column=6).value,
          detail_work=ws.cell(row=i, column=7).value,
          over_time=ws.cell(row=i, column=8).value,
          breaktime=ws.cell(row=i, column=9).value,
          breaktime_over1=ws.cell(row=i, column=10).value,
          breaktime_over2=ws.cell(row=i, column=11).value,
          breaktime_over3=ws.cell(row=i, column=12).value,
          work_time=ws.cell(row=i, column=13).value,
          judgement=ws.cell(row=i, column=14).value,
          break_change=ws.cell(row=i, column=15).value,
        )
      # 整合性エラー（NOT NULL 制約違反など）になった行は、エラー内容を標準出力に出してスキップする
      except IntegrityError as create_err:
        transaction.savepoint_rollback(sid)  # この行の分だけ取り消して、次の行へ進む
        print(f"エラー: 行 {i} のデータ作成中に整合性エラーが発生しました: {create_err}。スキップします。")
        continue # 次のループへ進む

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  # 予期しないエラーが発生した場合
  except Exception as e:
    # 一時ファイルのパスが代入済みで、ファイルが残っていれば削除する
    #   locals(): この関数内のローカル変数の一覧。temp_file_path が代入済みかを確認している
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    # エラー内容を返す（handle_task が AsyncTask にエラーとして記録する）
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 人員データ（member）
# ============================================================
# 人員データを全件Excelファイルにバックアップする。
#
# 全人員の従業員番号・氏名・ショップ・権限・管理者・休憩時間（直ごと）・ポップアップ情報などを
# 1人1行で書き出す。列の並びは load_member_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/member_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/人員データバックアップ_20261109.xlsx）
def generate_member_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目に見出し行を書き込む
  #   休憩時間は 直（1直/2直/3直/常昼/連1直/連2直）ごとに 昼休憩＋残業休憩1〜3 の4列ずつ
  #   ※39列目の見出しは 'ポップアップID6' だが、中身は pop_up_id5（ポップアップID5）。
  #     load_member_file 側の見出しも同じ文字列のため、バックアップ→ロードの対応はとれている
  headers = [
    '従業員番号', '氏名', 'ショップ', '権限', '管理者', 
    '1直昼休憩時間', '1直残業休憩時間1', '1直残業休憩時間2', '1直残業休憩時間3', 
    '2直昼休憩時間', '2直残業休憩時間1', '2直残業休憩時間2', '2直残業休憩時間3', 
    '3直昼休憩時間', '3直残業休憩時間1', '3直残業休憩時間2', '3直残業休憩時間3', 
    '常昼昼休憩時間', '常昼残業休憩時間1', '常昼残業休憩時間2', '常昼残業休憩時間3',
    '連1直昼休憩時間', '連1直残業休憩時間1', '連1直残業休憩時間2', '連1直残業休憩時間3', 
    '連2直昼休憩時間', '連2直残業休憩時間1', '連2直残業休憩時間2', '連2直残業休憩時間3', 
    'ポップアップ1', 'ポップアップID1', 'ポップアップ2', 'ポップアップID2',
    'ポップアップ3', 'ポップアップID3', 'ポップアップ4', 'ポップアップID4',
    'ポップアップ5', 'ポップアップID6', '休憩エラー有効チェック',
    ]
  ws.append(headers)

  # 人員データを全件取得
  member_data = member.objects.all()

  # 人員データを1人ずつ、見出しと同じ順に並べて1行として書き込む
  #   break_time1〜6 は 1直/2直/3直/常昼/連1直/連2直 の休憩時間（"#HHMMHHMM" 形式）
  for item in member_data:
    row = [
      item.employee_no, item.name, item.shop, item.authority, item.administrator, 
      item.break_time1, item.break_time1_over1, item.break_time1_over2, item.break_time1_over3, 
      item.break_time2, item.break_time2_over1, item.break_time2_over2, item.break_time2_over3, 
      item.break_time3, item.break_time3_over1, item.break_time3_over2, item.break_time3_over3, 
      item.break_time4, item.break_time4_over1, item.break_time4_over2, item.break_time4_over3,
      item.break_time5, item.break_time5_over1, item.break_time5_over2, item.break_time5_over3, 
      item.break_time6, item.break_time6_over1, item.break_time6_over2, item.break_time6_over3,
      item.pop_up1, item.pop_up_id1, item.pop_up2, item.pop_up_id2, item.pop_up3, item.pop_up_id3, 
      item.pop_up4, item.pop_up_id4, item.pop_up5, item.pop_up_id5, item.break_check, 
      ]
    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'人員データバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 人員データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しが generate_member_backup と同じ並びかをチェックしてから、2行目以降を1行ずつ登録する。
# すでに同じ従業員番号の人員が登録されている行は上書きせずにスキップする（新しい人員だけ追加される）。
# 登録時に整合性エラーになった行もスキップする。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/member_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_member_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_member_backup の headers と同じ並び）
    expected_headers = [
      '従業員番号', '氏名', 'ショップ', '権限', '管理者', 
      '1直昼休憩時間', '1直残業休憩時間1', '1直残業休憩時間2', '1直残業休憩時間3', 
      '2直昼休憩時間', '2直残業休憩時間1', '2直残業休憩時間2', '2直残業休憩時間3', 
      '3直昼休憩時間', '3直残業休憩時間1', '3直残業休憩時間2', '3直残業休憩時間3', 
      '常昼昼休憩時間', '常昼残業休憩時間1', '常昼残業休憩時間2', '常昼残業休憩時間3',
      '連1直昼休憩時間', '連1直残業休憩時間1', '連1直残業休憩時間2', '連1直残業休憩時間3', 
      '連2直昼休憩時間', '連2直残業休憩時間1', '連2直残業休憩時間2', '連2直残業休憩時間3', 
      'ポップアップ1', 'ポップアップID1', 'ポップアップ2', 'ポップアップID2',
      'ポップアップ3', 'ポップアップID3', 'ポップアップ4', 'ポップアップID4',
      'ポップアップ5', 'ポップアップID6', '休憩エラー有効チェック', 
      ]

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      # 従業員番号（1列目）を取得
      employee_no_value = ws.cell(row=i, column=1).value

      # すでに同じ従業員番号の人員が登録されている場合は、上書きせずにスキップする
      if member.objects.filter(employee_no=employee_no_value).exists():
        print(f"従業員番号 {employee_no_value} は既に存在するためスキップしました。")
        continue

      # 登録されていない場合のみ、ファイルの1行分の値で人員データを新規作成する
      #   列番号: 2=氏名, 3=ショップ, 4=権限, 5=管理者,
      #           6〜29=休憩時間（直ごとに 昼休憩・残業休憩1〜3 の4列ずつ。6〜9列目が1直、…、26〜29列目が連2直）,
      #           30〜39=ポップアップ1〜5 とそのID（交互）, 40=休憩エラー有効チェック
      try:
        sid = transaction.savepoint()  # この行だけを取り消せるよう、印を付けておく
        member.objects.create(
          employee_no=employee_no_value,
          name=ws.cell(row=i, column=2).value,
          shop=ws.cell(row=i, column=3).value,
          authority = ws.cell(row=i, column=4).value,
          administrator = ws.cell(row=i, column=5).value,
          break_time1 = ws.cell(row=i, column=6).value,
          break_time1_over1 = ws.cell(row=i, column=7).value,
          break_time1_over2 = ws.cell(row=i, column=8).value,
          break_time1_over3 = ws.cell(row=i, column=9).value,
          break_time2 = ws.cell(row=i, column=10).value,
          break_time2_over1 = ws.cell(row=i, column=11).value,
          break_time2_over2 = ws.cell(row=i, column=12).value,
          break_time2_over3 = ws.cell(row=i, column=13).value,
          break_time3 = ws.cell(row=i, column=14).value,
          break_time3_over1 = ws.cell(row=i, column=15).value,
          break_time3_over2 = ws.cell(row=i, column=16).value,
          break_time3_over3 = ws.cell(row=i, column=17).value,
          break_time4 = ws.cell(row=i, column=18).value,
          break_time4_over1 = ws.cell(row=i, column=19).value,
          break_time4_over2 = ws.cell(row=i, column=20).value,
          break_time4_over3 = ws.cell(row=i, column=21).value,
          break_time5 = ws.cell(row=i, column=22).value,
          break_time5_over1 = ws.cell(row=i, column=23).value,
          break_time5_over2 = ws.cell(row=i, column=24).value,
          break_time5_over3 = ws.cell(row=i, column=25).value,
          break_time6 = ws.cell(row=i, column=26).value,
          break_time6_over1 = ws.cell(row=i, column=27).value,
          break_time6_over2 = ws.cell(row=i, column=28).value,
          break_time6_over3 = ws.cell(row=i, column=29).value,
          pop_up1 = ws.cell(row=i, column=30).value,
          pop_up_id1 = ws.cell(row=i, column=31).value,
          pop_up2 = ws.cell(row=i, column=32).value,
          pop_up_id2 = ws.cell(row=i, column=33).value,
          pop_up3 = ws.cell(row=i, column=34).value,
          pop_up_id3 = ws.cell(row=i, column=35).value,
          pop_up4 = ws.cell(row=i, column=36).value,
          pop_up_id4 = ws.cell(row=i, column=37).value,
          pop_up5 = ws.cell(row=i, column=38).value,
          pop_up_id5 = ws.cell(row=i, column=39).value,
          break_check = ws.cell(row=i, column=40).value,
        )
      # 整合性エラー（NOT NULL 制約違反など）になった行は、エラー内容を標準出力に出してスキップする
      except IntegrityError as create_e:
        transaction.savepoint_rollback(sid)  # この行の分だけ取り消して、次の行へ進む
        print(f"従業員番号 {employee_no_value} の書き込み中にIntegrityErrorが発生しました: {create_e}")
        continue

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    #   locals(): この関数内のローカル変数の一覧。temp_file_path が代入済みかを確認している
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 班員データ（team_member）
# ============================================================
# 班員データを全件Excelファイルにバックアップする。
#
# 班を管理する人の従業員番号・班員1〜15の従業員番号・フォローON/OFF を1班1行で書き出す。
# 列の並びは load_team_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/team_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/班員データバックアップ_20261109.xlsx）
def generate_team_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行（1列目は班を管理する人の従業員番号、2〜16列目は班員の従業員番号）
  headers = [
    '従業員番号', '班員1', '班員2', '班員3', '班員4', 
    '班員5', '班員6', '班員7', '班員8', '班員9', '班員10',
    '班員11', '班員12', '班員13', '班員14', '班員15',
    'フォローON/OFF',
    ]

  ws.append(headers)

  # 班員データを全件取得
  team_data = team_member.objects.all()

  # 班員データを1件ずつ、見出しと同じ順に並べて1行として書き込む
  for item in team_data:
    row = [
      item.employee_no5, item.member1, item.member2, item.member3, 
      item.member4, item.member5, item.member6, item.member7, 
      item.member8, item.member9, item.member10,item.member11, 
      item.member12, item.member13, item.member14, item.member15,
      item.follow, 
      ]

    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'班員データバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 班員データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しが generate_team_backup と同じ並びかをチェックしてから、2行目以降を1行ずつ登録する。
# すでに同じ従業員番号（班を管理する人）の班員データがある行は上書きせずにスキップする。
# 登録時に整合性エラーになった行もスキップする。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/team_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_team_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_team_backup の headers と同じ並び）
    expected_headers = [
      '従業員番号', '班員1', '班員2', '班員3', '班員4', 
      '班員5', '班員6', '班員7', '班員8', '班員9', '班員10',
      '班員11', '班員12', '班員13', '班員14', '班員15',
      'フォローON/OFF',
      ]

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      # 班を管理する人の従業員番号（1列目）を取得
      employee_no_value = ws.cell(row=i, column=1).value

      # すでに同じ従業員番号の班員データがある場合は、上書きせずにスキップする
      if team_member.objects.filter(employee_no5=employee_no_value).exists():
        print(f"従業員番号 {employee_no_value} は既に存在するためスキップしました。")
        continue

      # 存在しない場合のみ、ファイルの1行分の値で班員データを新規作成する
      #   列番号: 1=班を管理する人の従業員番号, 2〜16=班員1〜15の従業員番号, 17=フォローON/OFF
      try:
        sid = transaction.savepoint()  # この行だけを取り消せるよう、印を付けておく
        team_member.objects.create(
          employee_no5=ws.cell(row=i, column=1).value,
          member1=ws.cell(row=i, column=2).value,
          member2=ws.cell(row=i, column=3).value,
          member3=ws.cell(row=i, column=4).value,
          member4=ws.cell(row=i, column=5).value,
          member5=ws.cell(row=i, column=6).value,
          member6=ws.cell(row=i, column=7).value,
          member7=ws.cell(row=i, column=8).value,
          member8=ws.cell(row=i, column=9).value,
          member9=ws.cell(row=i, column=10).value,
          member10=ws.cell(row=i, column=11).value,
          member11=ws.cell(row=i, column=12).value,
          member12=ws.cell(row=i, column=13).value,
          member13=ws.cell(row=i, column=14).value,
          member14=ws.cell(row=i, column=15).value,
          member15=ws.cell(row=i, column=16).value,
          follow=ws.cell(row=i, column=17).value,
        )
      # 整合性エラーになった行は、エラー内容を標準出力に出してスキップする
      except IntegrityError as create_e:
        transaction.savepoint_rollback(sid)  # この行の分だけ取り消して、次の行へ進む
        print(f"従業員番号 {employee_no_value} の書き込み中にIntegrityErrorが発生しました: {create_e}")
        continue

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 工数区分定義データ（kosu_division）
# ============================================================
# 工数区分定義データを全件Excelファイルにバックアップする。
#
# 1つの工数区分定義Verを1行とし、工数区分1〜50それぞれの
# 「工数区分名・定義・作業内容・変動/固定」の4列を順に並べる（計 1 + 50×4 = 201列）。
# 列の並びは load_def_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/def_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/工数区分定義データバックアップ_20261109.xlsx）
def generate_def_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行を作る
  #   例: ['工数区分定義Ver名', '工数区分名1', '定義1', '作業内容1', '変動/固定1', '工数区分名2', ...]
  #   リスト内包表記で i=1〜50 ごとに4つの見出しを作り、1つのリストに平らに並べている
  headers = ['工数区分定義Ver名'] + [item for i in range(1, 51) for item in [f'工数区分名{i}', f'定義{i}', f'作業内容{i}', f'変動/固定{i}']]

  ws.append(headers)

  # 工数区分定義データを登録順（id の昇順）に全件取得
  def_data = kosu_division.objects.all().order_by('id')

  # 工数区分定義を1件ずつ1行として書き込む
  #   1列目は Ver名、続けて i=1〜50 ごとに j=0〜3 の4列を並べる
  #     j=0 → kosu_title_i（工数区分名）
  #     j=1〜3 → kosu_division_j_i（1: 定義 / 2: 作業内容 / 3: 変動/固定）
  #   getattr(item, 'フィールド名'): 文字列で指定した名前のフィールドの値を取り出す
  for item in def_data:
    row = [item.kosu_name] + \
          [getattr(item, f'kosu_title_{i}') if j == 0 else getattr(item, f'kosu_division_{j}_{i}') 
          for i in range(1, 51) for j in range(0, 4)]
    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'工数区分定義データバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 工数区分定義データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しが generate_def_backup と同じ並びかをチェックしてから、2行目以降を1行ずつ登録する。
# 同じ工数区分定義Ver名のデータがすでにある場合は、削除してからファイルの内容で登録し直す（上書き）。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/def_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_def_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_def_backup の headers と同じ作り方・同じ並び）
    expected_headers = ['工数区分定義Ver名'] + [item for i in range(1, 51) for item in [f'工数区分名{i}', f'定義{i}', f'作業内容{i}', f'変動/固定{i}']]

    # ファイルの1行目から、見出しと同じ列数（201列）ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      # 読み込む行と同じ工数区分定義Ver名（1列目）のデータがDBに存在するか確認
      def_data_filter = kosu_division.objects.filter(kosu_name=ws.cell(row=i, column=1).value)
      # 同じVer名のデータがあった場合は削除する（ファイルの内容で置き換えるため）
      if def_data_filter.exists():
        def_data_filter.delete()

      # 登録するデータを「フィールド名: 値」の辞書で組み立てる（まずVer名）
      def_data = {
        'kosu_name': ws.cell(row=i, column=1).value
        }
      # 工数区分1〜50 の4項目を、対応する列から読み込む
      #   工数区分 n の列番号: 工数区分名 = n*4-2, 定義 = n*4-1, 作業内容 = n*4, 変動/固定 = n*4+1
      #   例: n=1 → 2〜5列目、n=2 → 6〜9列目（1列目はVer名のため1つずれる）
      for n in range(1, 51):
        def_data[f'kosu_title_{n}'] = ws.cell(row=i, column=n*4-2).value
        def_data[f'kosu_division_1_{n}'] = ws.cell(row=i, column=n*4-1).value
        def_data[f'kosu_division_2_{n}'] = ws.cell(row=i, column=n*4).value
        def_data[f'kosu_division_3_{n}'] = ws.cell(row=i, column=n*4+1).value

      # 辞書を展開（**）してモデルのインスタンスを作り、DBに保存する
      new_data = kosu_division(**def_data)
      new_data.save()

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 作業詳細選択肢データ（def_choice）
# ============================================================
# 作業詳細選択肢データを全件Excelファイルにバックアップする。
#
# 工数区分の定義記号（A〜x, $）と、その記号で選べる作業詳細の文言を1件1行で書き出す。
# 列の並びは load_choice_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/choice_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/作業詳細選択肢データバックアップ_20261109.xlsx）
def generate_choice_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行（定義記号 / 作業詳細）
  headers = ['定義記号', '作業詳細']

  ws.append(headers)

  # 作業詳細選択肢データを全件取得
  choice_data = def_choice.objects.all()

  # 1件ずつ [定義記号, 作業詳細] の1行として書き込む
  for item in choice_data:
    row = [item.def_symbol, item.def_select]
    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'作業詳細選択肢データバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 作業詳細選択肢データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しをチェックしたうえで、既存の作業詳細選択肢データを「全件削除」してから、
# ファイルの2行目以降をすべて登録し直す（ファイルの内容で丸ごと入れ替える）。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/choice_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_choice_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_choice_backup の headers と同じ）
    expected_headers = ['定義記号', '作業詳細']

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 既存の作業詳細選択肢データを全件削除する（この後ファイルの内容で登録し直すため）
    choice_data = def_choice.objects.all()
    choice_data.delete()

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      # 1列目（定義記号）と2列目（作業詳細）の値でインスタンスを作成する
      new_data = def_choice(def_symbol=ws.cell(row=i, column=1).value, def_select=ws.cell(row=i, column=2).value)

      # DBに保存する
      new_data.save()

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 問い合わせデータ（inquiry_data）
# ============================================================
# 問い合わせデータを全件Excelファイルにバックアップする。
#
# 従業員番号・氏名・内容選択（要望/不具合/問い合わせ）・問い合わせ本文・回答を1件1行で書き出す。
# 列の並びは load_inquiry_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/inquiry_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/問い合わせデータバックアップ_20261109.xlsx）
def generate_inquiry_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行
  headers = [
    '従業員番号', '氏名', '内容選択', '問い合わせ', '回答'
    ]

  ws.append(headers)

  # 問い合わせデータを全件取得
  inquiry = inquiry_data.objects.all()

  # 問い合わせを1件ずつ、見出しと同じ順に並べて1行として書き込む
  for item in inquiry:
    row = [
      item.employee_no2, 
      # 氏名（name）は人員データへの外部キーのため、str() で氏名の文字列にする（人員が削除済みなら 'None'）
      str(item.name), 
      item.content_choice, 
      item.inquiry, 
      item.answer,
    ]

    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'問い合わせデータバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 問い合わせデータのバックアップファイル（Excel）を読み込み、DBに登録する。
#
# 1行目の見出しをチェックしたうえで、2行目以降を1行ずつ新規登録する。
# 既存データとの重複チェックや削除は行わないため、同じファイルを2回ロードすると同じ問い合わせが2件ずつになる。
# 氏名はファイルの2列目ではなく、従業員番号から人員データを検索して設定する。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/inquiry_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_inquiry_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_inquiry_backup の headers と同じ並び）
    expected_headers = [
      '従業員番号', '氏名', '内容選択', '問い合わせ', '回答'
    ]

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      # 1行ずつ新規登録する（整合性エラーの行だけはスキップする）
      try:
        sid = transaction.savepoint()  # この行だけを取り消せるよう、印を付けておく
        # 従業員番号（1列目）を取得
        employee_no = ws.cell(row=i, column=1).value

        # 問い合わせデータを新規作成してDBに保存する
        #   name: 従業員番号で人員データを検索して設定
        #         （人員が見つからない場合は DoesNotExist 例外になり、下の IntegrityError では捕まらず
        #           外側の except に進んでロード全体がエラー終了する）
        #   列番号: 3=内容選択, 4=問い合わせ, 5=回答
        inquiry_data.objects.create(
          employee_no2=employee_no,
          name=member.objects.get(employee_no=employee_no),
          content_choice=ws.cell(row=i, column=3).value,
          inquiry=ws.cell(row=i, column=4).value,
          answer=ws.cell(row=i, column=5).value,
        )
      # 整合性エラー（NOT NULL 制約違反など）になった行は、エラー内容を標準出力に出してスキップする
      except IntegrityError as create_e:
        transaction.savepoint_rollback(sid)  # この行の分だけ取り消して、次の行へ進む
        print(f"書き込み中にIntegrityErrorが発生しました: {create_e}")
        continue

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 管理者設定データ（administrator_data）
# ============================================================
# 管理者設定データを全件Excelファイルにバックアップする。
#
# 一覧表示項目数・問い合わせ担当者の従業員番号1〜3・ポップアップ1〜5とそのIDを1件1行で書き出す。
# 列の並びは load_setting_file の見出しと同じ。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/setting_backup/）
#
# 引数:
#   なし
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/管理者設定データバックアップ_20261109.xlsx）
def generate_setting_backup():
  # 今日の日付を "YYYYMMDD" 形式で取得（ファイル名に使う）
  today = datetime.date.today().strftime('%Y%m%d')
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行
  #   ※14列目の見出しは 'ポップアップID6' だが、中身は pop_up_id5（ポップアップID5）。
  #     load_setting_file 側の見出しも同じ文字列のため、バックアップ→ロードの対応はとれている
  headers = [
    '一覧表示項目数', 
    '問い合わせ担当者従業員番号1',
    '問い合わせ担当者従業員番号2',
    '問い合わせ担当者従業員番号3',
    'ポップアップ1',
    'ポップアップID1',
    'ポップアップ2',
    'ポップアップID2',
    'ポップアップ3',
    'ポップアップID3',
    'ポップアップ4',
    'ポップアップID4',
    'ポップアップ5',
    'ポップアップID6',
  ]

  ws.append(headers)

  # 管理者設定データを全件取得（変数名は inquiry だが、中身は管理者設定データ）
  inquiry = administrator_data.objects.all()

  # 管理者設定を1件ずつ、見出しと同じ順に並べて1行として書き込む
  for item in inquiry:
    row = [
      item.menu_row,
      item.administrator_employee_no1,
      item.administrator_employee_no2,
      item.administrator_employee_no3,
      item.pop_up1,
      item.pop_up_id1,
      item.pop_up2,
      item.pop_up_id2,
      item.pop_up3,
      item.pop_up_id3,
      item.pop_up4,
      item.pop_up_id4,
      item.pop_up5,
      item.pop_up_id5,
    ]

    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に今日の日付を含めて保存する（同じ日に再実行すると上書きされる）
  filename = f'管理者設定データバックアップ_{today}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------




# 管理者設定データのバックアップファイル（Excel）を読み込み、DBに復元する。
#
# 1行目の見出しをチェックしたうえで、既存の管理者設定データを「全件削除」してから、
# ファイルの2行目以降をすべて登録し直す（ファイルの内容で丸ごと入れ替える）。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/setting_load/）
#
# 引数:
#   file_path: アップロードされたExcelを保存した一時ファイルのパス（処理後にこの関数内で削除する）
# 戻り値:
#   tuple: 成功時 ({'status': 'success'}, None)
#          見出し不一致時 ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
#          その他のエラー時 ({'status': 'error', 'message': エラー内容}, None)
# 例外:
#   処理中の例外はすべて捕まえ、一時ファイルを削除したうえでエラーのタプルとして返す
@atomic_load  # 途中で失敗したら全部取り消す
def load_setting_file(file_path):
  try:
    # 1. 渡されたファイルパスを一時ファイルパスとして保持（エラー時の削除にも使う）
    temp_file_path = file_path

    # 2. Excelファイルを開き、1枚目のシートを取得
    wb = openpyxl.load_workbook(temp_file_path)
    ws = wb.worksheets[0]

    # 3. 正しいファイルの見出し行（generate_setting_backup の headers と同じ並び）
    expected_headers = [
      '一覧表示項目数', 
      '問い合わせ担当者従業員番号1',
      '問い合わせ担当者従業員番号2',
      '問い合わせ担当者従業員番号3',
      'ポップアップ1',
      'ポップアップID1',
      'ポップアップ2',
      'ポップアップID2',
      'ポップアップ3',
      'ポップアップID3',
      'ポップアップ4',
      'ポップアップID4',
      'ポップアップ5',
      'ポップアップID6',
      ]

    # ファイルの1行目から、見出しと同じ列数ぶんのセルの値を取得
    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]
    
    # 見出しが一致しない場合は、一時ファイルを削除してエラーを返す
    if actual_headers != expected_headers:
      os.remove(temp_file_path)
      return {'status': 'error', 'message': '無効なファイルフォーマットです。'}, None 

    # 既存の管理者設定データを全件削除する（この後ファイルの内容で登録し直すため）
    administrator_data.objects.all().delete()

    # 4. データを読み込んでDBに保存する（2行目から最終行まで）
    for i in range(2, ws.max_row + 1):
      try:
        sid = transaction.savepoint()  # この行だけを取り消せるよう、印を付けておく
        # ファイルの1行分の値で管理者設定データを新規作成してDBに保存する
        #   列番号: 1=一覧表示項目数, 2〜4=問い合わせ担当者の従業員番号1〜3,
        #           5〜14=ポップアップ1〜5 とそのID（交互）
        administrator_data.objects.create(
          menu_row = ws.cell(row=i, column=1).value, 
          administrator_employee_no1 = ws.cell(row=i, column=2).value, 
          administrator_employee_no2 = ws.cell(row=i, column=3).value, 
          administrator_employee_no3 = ws.cell(row=i, column=4).value, 
          pop_up1 = ws.cell(row=i, column=5).value, 
          pop_up_id1 = ws.cell(row=i, column=6).value, 
          pop_up2 = ws.cell(row=i, column=7).value, 
          pop_up_id2 = ws.cell(row=i, column=8).value, 
          pop_up3 = ws.cell(row=i, column=9).value, 
          pop_up_id3 = ws.cell(row=i, column=10).value, 
          pop_up4 = ws.cell(row=i, column=11).value, 
          pop_up_id4 = ws.cell(row=i, column=12).value, 
          pop_up5 = ws.cell(row=i, column=13).value, 
          pop_up_id5 = ws.cell(row=i, column=14).value
        )
      # 整合性エラー（NOT NULL 制約違反など）になった行は、エラー内容を標準出力に出してスキップする
      except IntegrityError as create_e:
        transaction.savepoint_rollback(sid)  # この行の分だけ取り消して、次の行へ進む
        print(f"書き込み中にIntegrityErrorが発生しました: {create_e}")
        continue

    # 5. 全行の処理が終わったら一時ファイルを削除し、成功を返す
    os.remove(temp_file_path)
    return {'status': 'success'}, None

  except Exception as e:
    # ロード処理で予期しないエラーが発生した場合は、一時ファイルが残っていれば削除してエラーを返す
    if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
      os.remove(temp_file_path)
    return {'status': 'error', 'message': str(e)}, None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# タスク履歴データ（AsyncTask）
# ============================================================
# タスク履歴（非同期タスクの実行記録 AsyncTask）を期間指定でExcelファイルにバックアップする。
#
# 作成日時が開始日〜終了日（日本時間の日付）のタスク履歴を1件1行で書き出す。
# このファイルにはロード（復元）処理は無い。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/AsyncTask_backup/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/タスク履歴データバックアップ_2026-11-01_2026-11-07.xlsx）
def generate_AsyncTask_backup(start_day, end_day):
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行（AsyncTask のフィールド名をそのまま使う）
  #   task_id: タスクID / status: 状態（pending/success/error） / result: 結果
  #   created_at: 作成日時 / updated_at: 更新日時
  headers = [
    'task_id', 
    'status',
    'result',
    'created_at',
    'updated_at',
  ]

  ws.append(headers)

  # 開始日・終了日の文字列（"YYYY-MM-DD"）を日付型（datetime.date）に変換
  start_date = datetime.datetime.strptime(start_day, '%Y-%m-%d').date()
  end_date = datetime.datetime.strptime(end_day, '%Y-%m-%d').date()

  # 作成日時の日付部分が開始日以上・終了日以下のタスク履歴を取得
  #   created_at__date: 日時から日付だけを取り出して比較する（settings.TIME_ZONE の日本時間で判定）
  AsyncTask_data = AsyncTask.objects.filter(
    created_at__date__gte=start_date, created_at__date__lte=end_date,
  )

  # タスク履歴を1件ずつ1行として書き込む
  for item in AsyncTask_data:
    # DBの日時（タイムゾーン付き）を日本時間（settings.TIME_ZONE = 'Asia/Tokyo'）に変換し、
    # タイムゾーン情報を外す（openpyxl はタイムゾーン付きの日時をExcelに書き込めないため）
    try:
      target_tz = pytz.timezone(settings.TIME_ZONE)
      created_at_local = item.created_at.astimezone(target_tz).replace(tzinfo=None)
      updated_at_local = item.updated_at.astimezone(target_tz).replace(tzinfo=None)
    # ImportError が発生した場合の代替処理: 時刻を変換せず、タイムゾーン情報だけを外す
    except ImportError:
      created_at_local = item.created_at.replace(tzinfo=None)
      updated_at_local = item.updated_at.replace(tzinfo=None)

    # 見出しと同じ順に値を並べる
    row = [
      item.task_id,
      item.status,
      item.result,
      created_at_local,
      updated_at_local,
    ]

    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に期間を含めて保存する（同じ名前のファイルがあれば上書きされる）
  filename = f'タスク履歴データバックアップ_{start_day}_{end_day}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 期間内のタスク履歴（AsyncTask）を一括削除する。
#
# 作成日時の日付が開始日〜終了日のタスク履歴をすべて削除する。
# 終了日は validate_dates で昨日までに制限されているため、実行中のこのタスク自身の記録（今日作成）は削除されない。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/AsyncTask_delet/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   None（handle_task により AsyncTask は成功扱いになる）
def delete_AsyncTask_data(start_day, end_day):
  # 作成日時の日付部分が開始日以上・終了日以下のタスク履歴を取得
  AsyncTask_data = AsyncTask.objects.filter(
    created_at__date__gte=start_day, 
    created_at__date__lte=end_day,
  )
  
  # 取得したタスク履歴をまとめて削除し、None を返す
  AsyncTask_data.delete()
  return None





#--------------------------------------------------------------------------------------------------------





# ============================================================
# 操作履歴データ（History）
# ============================================================
# 操作履歴（データ変更の監査ログ History）を期間指定でExcelファイルにバックアップする。
#
# 操作日時が開始日〜終了日（日本時間の日付）の操作履歴を1件1行で書き出す。
# このファイルにはロード（復元）処理は無い。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/History_backup/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   str: 作成したExcelファイルのパス（例: .../media/操作履歴データバックアップ_2026-11-01_2026-11-07.xlsx）
def generate_History_backup(start_day, end_day):
  # 新しいExcelブックを作成し、最初のシートを取得
  wb = openpyxl.Workbook()
  ws = wb.active

  # 1行目の見出し行
  #   操作種類: CREATE/UPDATE/DELETE / 操作テーブル: モデル名 / ID: 対象レコードのID
  #   操作者No: 操作したログイン者の従業員番号 / 変更箇所: 変更内容 / 操作日時: 記録日時
  headers = [
    '操作種類', 
    '操作テーブル',
    'ID',
    '操作者No',
    '変更箇所',
    '操作日時'
  ]

  ws.append(headers)

  # 開始日・終了日の文字列（"YYYY-MM-DD"）を日付型（datetime.date）に変換
  start_date = datetime.datetime.strptime(start_day, '%Y-%m-%d').date()
  end_date = datetime.datetime.strptime(end_day, '%Y-%m-%d').date()

  # 操作日時（timestamp）の日付部分が開始日以上・終了日以下の操作履歴を取得
  History_data = History.objects.filter(
    timestamp__date__gte=start_date, timestamp__date__lte=end_date,
  )

  # 操作履歴を1件ずつ1行として書き込む
  for item in History_data:
    # 操作日時を日本時間に変換し、タイムゾーン情報を外す（openpyxl はタイムゾーン付きの日時を書き込めないため）
    try:
      target_tz = pytz.timezone(settings.TIME_ZONE)
      timestamp_local_naive = item.timestamp.astimezone(target_tz).replace(tzinfo=None)
    # ImportError が発生した場合の代替処理: 時刻を変換せず、タイムゾーン情報だけを外す
    except ImportError:
      timestamp_local_naive = item.timestamp.replace(tzinfo=None)

    # 見出しと同じ順に値を並べる（変更内容 changes は辞書のため str() で文字列にする）
    row = [
      item.operation,
      item.table_name,
      item.record_id,
      item.login_No,
      str(item.changes),
      timestamp_local_naive,
    ]

    ws.append(row)

  # 保存先のフォルダ（media）が無ければ作成する
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名に期間を含めて保存する（同じ名前のファイルがあれば上書きされる）
  filename = f'操作履歴データバックアップ_{start_day}_{end_day}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # 作成したファイルのパスを返す
  return filepath





#--------------------------------------------------------------------------------------------------------





# 期間内の操作履歴（History）を一括削除する。
#
# 操作日時の日付が開始日〜終了日の操作履歴をすべて削除する。
# 呼び出し元: views/asynchronous_views.py の backup()（URL /api/History_delet/）
#
# 引数:
#   start_day: 開始日（"YYYY-MM-DD"）
#   end_day  : 終了日（"YYYY-MM-DD"）
# 戻り値:
#   None（handle_task により AsyncTask は成功扱いになる）
def delete_History_data(start_day, end_day):
  # 操作日時の日付部分が開始日以上・終了日以下の操作履歴を取得
  OperationHistory_data = History.objects.filter(
    timestamp__date__gte=start_day, 
    timestamp__date__lte=end_day,
  )
  
  # 取得した操作履歴をまとめて削除し、None を返す
  OperationHistory_data.delete()
  return None





#--------------------------------------------------------------------------------------------------------






