# ============================================================
# ファイル名 : team_utils.py
# 種別       : ユーティリティ（班員画面用の部品）
# 概要       : 工数入力状況のExcel出力で、人員1人分のシートを作成して
#              1か月分の工数データを書き込む関数を定義する。
#
# 主な関数:
#   - excel_function : 人員1人分・1か月分の工数入力状況をExcelシートに書き込む
#                      （team_views.py の TeamExport  POST /api/team_export/ から、
#                        選択ショップの人員1人ずつに対して呼ばれる）
#
# 関連ファイル: views/team_views.py（TeamExport）, utils/kosu_utils.py,
#              models.py（member / Business_Time_graph / kosu_division）
# ============================================================

# ============================================================
# インポート
# ============================================================
# 該当データが無ければ 404 エラーにする Django のショートカット関数
from django.shortcuts import get_object_or_404
# 人員・工数データ・工数区分定義のモデル（Business_Time_graph はこのファイル内では未使用）
from ..models import member, Business_Time_graph, kosu_division
# 工数データを直の開始時刻から並べ替える関数
from .kosu_utils import kosu_sort
# 「作業時間帯・作業内容・作業詳細」の表示用リストを作る関数
from .kosu_utils import create_kosu
# 工数区分定義の記号と名称の対応表を作る関数（このファイル内では未使用）
from .kosu_utils import kosu_division_dictionary
# 工数区分名だけのリストと登録数を返す関数
from .kosu_utils import get_def_library_data
import datetime



# ============================================================
# Excel出力
# ============================================================

# 人員1人分の、指定月の工数入力状況を Excel のシートとして追加する。
#
# シートは人員の氏名で作成し、1日につき横3列（day*3-2 / day*3-1 / day*3 列目）を使って
# 月初から月末まで横に並べる。例: 1日 → A〜C列、2日 → D〜F列。
# 各日の縦方向のレイアウト（N = その日の工数区分定義の区分数）:
#   1行目        : 「〇〇の YYYY年M月の勤務状況」（シート全体の見出し。A1セルのみ）
#   2行目        : 「〇日」 / 工数入力OK/NG判定（OK・NG）
#   3行目        : 就業形態 / 直
#   4行目        : 「残業」 / 残業時間（分）
#   6〜(5+N)行目 : 工数区分名 / その区分の合計作業時間（分）
#   (7+N)行目    : 「固定」 / 固定区分の合計（分）
#   (8+N)行目    : 「可動」 / 変動区分の合計（分）
#   (10+N)行目〜 : 作業時間帯（例: "08:00～10:00"） / 作業内容 / 作業詳細
#
# 引数:
#   employee_no_data: 出力する人員の従業員番号
#   wb              : 書き込み先の Excel ブック（openpyxl.Workbook）
#   year            : 出力する年（int）
#   month           : 出力する月（int, 1〜12）
#   request         : HTTPリクエスト。create_kosu 内でセッションの工数区分定義Ver（input_def）を参照する
#   member_kosu_data: この人員の指定月の工数データを {就業日(date): 工数データ} の形にした辞書
#                     （呼び出し元で一括取得済み。1日ずつデータベースに問い合わせないための工夫）
# 戻り値:
#   openpyxl.Workbook: シートを追加した Excel ブック（引数 wb と同じもの）
# 例外:
#   Http404: 指定した従業員番号の人員が存在しない場合（get_object_or_404 が送出）
def excel_function(employee_no_data, wb, year, month, request, member_kosu_data):
  # 人員データ取得（シート名・見出しに氏名を使い、直ごとの並べ替えにショップを使う）
  member_obj = get_object_or_404(member, employee_no=employee_no_data)

  # 最終日取得
  #   翌月1日を作り、そこから1日引くことで指定月の末日を求める
  #   （12月の場合は翌年1月1日にする。:= は式の中で変数に代入する「セイウチ演算子」）
  #   例: 2026年2月 → 2026-03-01 の1日前 → 28日
  select_month = datetime.date(year_end := (year + 1 if month == 12 else year), 
                              month_end := (1 if month == 12 else month + 1), 1)
  day_end = (select_month - datetime.timedelta(days=1)).day

  # Excelに班員のシート作成
  #   シート名は人員の氏名。A1セルに見出しを書き込む
  member_sheet = wb.create_sheet(title=member_obj.name)
  member_sheet.cell(row=1, column=1, value=f"{member_obj.name}の{year}年{month}月の勤務状況")

  # 工数データ書き込み
  #   1日から月末日まで1日ずつ処理する
  for day in range(1, day_end + 1):
    # その日の工数データを辞書から取り出す（無い日は None）
    current_date = datetime.date(year, month, day)
    kosu_obj = member_kosu_data.get(current_date)

    # 初期化
    #   工数データが無い日も同じレイアウトで書き込めるよう、空の値で初期化しておく
    #   time_display_list: 作業時間帯ごとの [時間帯, 作業内容, 作業詳細] のリスト
    #   work_list        : 直の開始時刻から並べた作業内容（記号のリスト）
    #   def_list         : 工数区分名のリスト
    #   graph_list       : 工数区分ごとの合計作業時間（分）のリスト
    time_display_list, work_list, def_list, graph_list = [], [], [], []
    # integrity: 工数入力OK/NG判定 / work: 就業形態 / tyoku: 直の表示名 / over_time: 残業時間（分）
    integrity, work, tyoku, over_time = 'NG', '', '', 0
    # 変動（可動）区分の合計作業時間（分）
    fluctuation_total = 0
    # 固定区分の合計作業時間（分）
    fixed_total = 0

    # 工数データある場合の処理
    if kosu_obj:
      # データ取得と書き換え
      #   工数入力OK/NG判定を "OK" / "NG" の文字にする（未判定 None も NG 扱い）
      integrity = 'OK' if kosu_obj.judgement else 'NG'
      # 就業形態（未入力なら空文字）
      work = kosu_obj.work_time or ''
      # 直のコード（'1'〜'6'）を表示名に変換する。該当しない・未入力なら空文字
      #   5: 連1直 → "1直(連2)"、6: 連2直 → "2直(連2)" と表示する
      tyoku = { '1': '1直', '2': '2直', '3': '3直', '4': '常昼', '5': '1直(連2)', '6': '2直(連2)' }.get(kosu_obj.tyoku2, '')
      # 残業時間（未入力なら0）
      over_time = kosu_obj.over_time or 0

      # 工数区分定義バージョンある場合の処理
      #   工数区分定義Verが無い（作業内容が未入力の）日は、作業内容関連の書き込みを行わない
      if kosu_obj.def_ver2:
        # 作業内容と作業詳細を直によって表示変更
        #   0:00始まりの並びを、直の開始時刻（例: 1直なら4:30）から始まる並びにする
        work_list, detail_list = kosu_sort(kosu_obj, member_obj)
        # 作業時間、作業内容リスト作成
        #   作業内容が切り替わる時刻ごとに [時間帯, 作業内容名, 作業詳細] をまとめたリスト
        time_display_list = create_kosu(work_list, detail_list, kosu_obj, member_obj, request)
        # 工数区分定義リスト取得
        #   def_list: その日の工数区分定義Verの区分名リスト / def_num: 登録されている区分数
        def_list, def_num = get_def_library_data(kosu_obj.def_ver2)
        # 作業内容用記号定義
        #   工数区分1〜50 には A〜Z, a〜x の記号が順に割り当てられている。登録数ぶんだけ取り出す
        str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:def_num]
        # 定義区分別の累積工数取得
        #   作業内容（time_work）は5分ごとに1文字なので、記号の出現回数 × 5 = その区分の作業時間（分）
        #   例: 'A' が 12 回 → 60分
        graph_list = [kosu_obj.time_work.count(i) * 5 for i in str_list]
        # 区分定義 変動/固定 取得
        #   工数区分1〜50 の「変動/固定」（kosu_division_3_N。True=変動、False/None=固定）をリストにする
        kosu_div_obj = kosu_division.objects.get(kosu_name=kosu_obj.def_ver2)
        fluctuation_boolean = []
        for n in range(1, 51):
          val = getattr(kosu_div_obj, f'kosu_division_3_{n}')
          fluctuation_boolean.append(val)

        # 区分ごとの作業時間を、変動（可動）と固定に振り分けて合計する
        for ind, d in enumerate(graph_list):
          if fluctuation_boolean[ind]:
            fluctuation_total += d
          else:
            fixed_total += d

    # エクセルファイルに書き込み
    #   その日の列: (day*3)-2 = 項目名などの列、(day*3)-1 = 値の列
    #   2行目: 日付 / 工数入力OK/NG判定
    member_sheet.cell(row=2, column=(day * 3) - 2, value=f'{day}日')
    member_sheet.cell(row=2, column=(day * 3) - 1, value=integrity)
    # 3行目: 就業形態 / 直
    member_sheet.cell(row=3, column=(day * 3) - 2, value=work)
    member_sheet.cell(row=3, column=(day * 3) - 1, value=tyoku)
    # 4行目: 「残業」 / 残業時間（分）
    member_sheet.cell(row=4, column=(day * 3) - 2, value='残業')
    member_sheet.cell(row=4, column=(day * 3) - 1, value=over_time)

    # 工数区分定義別の累積工数書き込み
    #   6行目から区分の数だけ下へ「区分名 / 合計作業時間（分）」を書く（5行目は空行）
    for i, row_num in enumerate(def_list):
      member_sheet.cell(row=(6 + i), column=(day * 3) - 2, value=row_num)
      member_sheet.cell(row=(6 + i), column=(day * 3) - 1, value=graph_list[i])

    # 区分一覧の1行下を空けて、固定区分・変動（可動）区分の合計を書く
    member_sheet.cell(row=(7 + len(def_list)), column=(day * 3) - 2, value='固定')
    member_sheet.cell(row=(8 + len(def_list)), column=(day * 3) - 2, value='可動')
    member_sheet.cell(row=(7 + len(def_list)), column=(day * 3) - 1, value=fixed_total)
    member_sheet.cell(row=(8 + len(def_list)), column=(day * 3) - 1, value=fluctuation_total)

    # 作業時間ごとの作業内容書き込み
    #   さらに1行空けた (10+区分数) 行目から、作業時間帯ごとに
    #   「時間帯 / 作業内容 / 作業詳細」をその日の3列に書く
    for i2, item in enumerate(time_display_list):
      member_sheet.cell(row=(10 + len(def_list) + i2), column=(day * 3) - 2, value=item[0])
      member_sheet.cell(row=(10 + len(def_list) + i2), column=(day * 3) - 1, value=item[1])
      member_sheet.cell(row=(10 + len(def_list) + i2), column=day * 3, value=item[2])

  # シートを追加したブックを呼び出し元へ返す
  return wb