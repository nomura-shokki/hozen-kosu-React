# ============================================================
# ファイル名 : kosu_utils.py
# 種別       : ユーティリティ（工数関連の共通処理）
# 概要       : 工数データ（1日1人分の作業時間記録）の作業内容・休憩時間を
#              扱うための計算・変換・判定の関数をまとめたファイル。
#
# 前提となるデータ形式（このファイルの多くの関数がこれを前提にしている）:
#   - 1日（0:00〜24:00）を5分刻みの 288 コマに分け、コマ番号（インデックス）で時刻を表す。
#       インデックス = 時 × 12 + 分 ÷ 5   例: 08:30 → 8×12 + 30÷5 = 102
#   - 作業内容（time_work）: 288 文字の文字列。1文字が5分1コマ分の工数区分記号
#       '#' = 未入力 / '$' = 休憩 / 'A'〜'Z','a'〜'x' = 工数区分1〜50
#   - 作業詳細（detail_work）: 288 コマ分の作業詳細を '$' でつないだ文字列
#       （何も入力していない日は '$' が287個並ぶだけの文字列になる）
#   - 休憩時間（breaktime など）: "#HHMMHHMM" 形式（例: "#11401240" は 11:40〜12:40）
#
# 主な関数:
#   - time_index / break_time_process / parse_break_time / break_get : 時刻・休憩時間の変換と取得
#   - kosu_write / break_time_delete / break_time_write / detail_list_summarize : 作業内容・休憩の書き込み
#   - judgement_check  : 工数入力OK/NG判定
#   - kosu_sort        : 作業内容を直の開始時刻から並べ替える
#   - get_week_of_month: 日付が月の第何週かを求める
#   - create_kosu / create_kosu_basic : 作業時間帯ごとの表示用リストを作る
#   - kosu_division_dictionary / get_def_library_data : 工数区分定義の記号と名称の一覧を作る
#
# 使用箇所   : views/kosu_views.py（工数入力・休憩変更など）, utils/team_utils.py（Excel出力）,
#              tasks.py（バックアップ）, tests/test_backend.py
# 関連ファイル: models.py（member / kosu_division / Business_Time_graph）
# ============================================================

# ============================================================
# インポート
# ============================================================
# 人員（休憩時間の取得用）・工数区分定義（区分名の取得用）のモデル
from ..models import member, kosu_division
import datetime
# calendar: 月のカレンダー（週ごとの日付の並び）を作る Python 標準ライブラリ
import calendar



# ============================================================
# 時刻・休憩時間の変換
# ============================================================

# "HH:MM" 形式の時刻文字列を、時と分に分ける。
#
# 引数:
#   post_time: "HH:MM" 形式の時刻文字列（例: "08:30"）
# 戻り値:
#   (時, 分): どちらも文字列のまま返す（例: ("08", "30")）。数値化は呼び出し側で int() する
# 例外:
#   ValueError: ':' が含まれていない場合（str.index が送出）
def time_index(post_time):
  # 時間の区切りのインデックス取得（':' が何文字目にあるか）
  post_index = post_time.index(':')
  # 時取得（':' より前の部分）
  time_hour = post_time[ : post_index]
  # 分取得（':' より後ろの部分）
  time_min = post_time[post_index + 1 : ]

  # 時と分返す
  return time_hour, time_min



# 休憩時間の文字列から、休憩の開始・終了インデックスと日またぎの有無を求める。
#
# 例: "#10401130"（10:40〜11:30）→ (128.0, 138.0, 0)
#     "#23350035"（23:35〜0:35）→ (283.0, 7.0, 1)  ※終了が開始より前なので日またぎ
#
# 引数:
#   breaktime_str: "#HHMMHHMM" 形式の休憩時間（先頭 '#' の後ろに開始時刻4桁・終了時刻4桁）
# 戻り値:
#   (break_start, break_end, break_next_day)
#     break_start   : 休憩開始のインデックス（分 ÷ 5 の割り算のため float になる）
#     break_end     : 休憩終了のインデックス（float）
#     break_next_day: 1 = 日をまたぐ（開始 > 終了）、0 = またがない
def break_time_process(breaktime_str):
  # 休憩開始時間のインデックス取得
  #   [1:3] = 開始の時、[3:5] = 開始の分 → 時×12 + 分÷5
  break_start = int(breaktime_str[1 : 3])*12 + int(breaktime_str[3 : 5])/5
  # 休憩終了時間のインデックス取得
  #   [5:7] = 終了の時、[7:] = 終了の分
  break_end = int(breaktime_str[5 : 7])*12 + int(breaktime_str[7 :])/5

  # 休憩の日またぎ変数リセット
  break_next_day = 0
  # 休憩開始時間より終了時間の方が早い場合の処理（例: 23:35〜0:35 のように0時をまたぐ）
  if break_start > break_end:
    # 日またぎ変数に1を入れる
    break_next_day = 1

  # 休憩開始時間より終了時間の方が遅い場合の処理（開始と終了が同じ場合もこちら）
  else:
    # 日またぎ変数に0を入れる
    break_next_day = 0

  return break_start, break_end, break_next_day



# ============================================================
# 作業内容・休憩の書き込み
# ============================================================

# 指定したインデックス範囲に、入力された工数区分記号と作業詳細を書き込む。
#
# 範囲は start_ind 以上 end_ind 未満（end_ind のコマは含まない）。
# 渡されたリストを直接書き換え、同じリストを返す。
#
# 引数:
#   start_ind  : 書き込み開始のインデックス
#   end_ind    : 書き込み終了のインデックス（このコマは含まない）
#   kosu_def   : 作業内容のリスト（288要素。1要素が1コマの工数区分記号）
#   detail_list: 作業詳細のリスト（288要素）
#   post_data  : 画面から送信されたデータ。'time_work'（工数区分記号）と 'detail_work'（作業詳細）を使う
# 戻り値:
#   (kosu_def, detail_list): 書き込み後の作業内容リストと作業詳細リスト
def kosu_write(start_ind, end_ind, kosu_def, detail_list, post_data):
  # 作業内容と作業詳細を書き込むループ
  for kosu in range(start_ind, end_ind):
    # 作業内容リストに入力された工数定義区分の対応する記号を入れる
    kosu_def[kosu] = post_data.get('time_work')
    # 作業詳細リストに入力した作業詳細を入れる
    detail_list[kosu] = post_data.get('detail_work')

  return kosu_def, detail_list



# 休憩時間の範囲に入っている工数を確認し、人員の設定に応じてエラーにするか削除する。
#
# 人員の「休憩エラー有効チェック」(break_check) によって動きが変わる:
#   ON (True)        : 休憩範囲に作業が入っていたらエラーメッセージを返す（何も消さない）
#   OFF (False/None) : 休憩範囲の作業内容・作業詳細を空（'#' / ''）にする
#
# 引数:
#   break_start_ind: 休憩開始のインデックス（float でもよい。int() で切り捨てて使う）
#   break_end_ind  : 休憩終了のインデックス（このコマは含まない）
#   work_list      : 作業内容のリスト（288要素）
#   detail_list    : 作業詳細のリスト（288要素）
#   member_obj     : 人員データ（break_check を参照する）
# 戻り値:
#   エラーなし: (None, work_list, detail_list)
#   エラーあり: (エラーメッセージ, None, None)  ※リストは返さないので呼び出し側で注意
def break_time_delete(break_start_ind, break_end_ind, work_list, detail_list, member_obj):
  # 休憩時間ループ（休憩範囲のコマを1つずつ確認する）
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # ユーザーが休憩エラー有効チェックONの場合の処理
    if member_obj.break_check == True:
      # 作業内容リストが空でない場合の処理（'#' = 未入力）
      if work_list[bt] != '#':
        # 作業内容リストが休憩でない場合の処理（'$' = 休憩）
        #   → 休憩時間に作業が入っているのでエラーを返して処理を打ち切る
        if work_list[bt] != '$':
          return '休憩時間に工数を入力できません。休憩変更するor休憩エラー無効で入力できます。', None, None

    # ユーザーが休憩エラー有効チェックOFFの場合の処理   
    else:
      # 作業内容リストの要素を空にする
      work_list[bt] = '#'
      # 作業詳細リストの要素を空にする
      detail_list[bt] = ''

  return None, work_list, detail_list



# 休憩時間の範囲を「休憩」（記号 '$'）で埋める。
#
# 引数:
#   break_start_ind: 休憩開始のインデックス（float でもよい。int() で切り捨てて使う）
#   break_end_ind  : 休憩終了のインデックス（このコマは含まない）
#   kosu_def       : 作業内容のリスト（288要素）
#   detail_list    : 作業詳細のリスト（288要素）
# 戻り値:
#   (kosu_def, detail_list): 書き換え後の作業内容リストと作業詳細リスト
def break_time_write(break_start_ind, break_end_ind, kosu_def, detail_list):
  # 休憩時間内の工数データを休憩に書き換えるループ
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # 作業内容リストの要素を休憩に書き換え
    kosu_def[bt] = '$'
    # 休憩中は作業詳細なしにする
    detail_list[bt] = ''

  return kosu_def, detail_list



# 作業詳細のリストを、データベース保存用の1つの文字列にまとめる。
#
# 各要素を '$' で区切ってつなぐ（最後の要素の後ろには付けない）。
# 例: ['点検', '', '清掃'] → '点検$$清掃'
# 288要素のリストなら区切りの '$' は287個になる。
# 読み出すときは detail_work.split('$') で元のリストに戻せる。
#
# 引数:
#   detail_list: 作業詳細のリスト（288要素）
# 戻り値:
#   str: '$' 区切りでつないだ作業詳細の文字列
def detail_list_summarize(detail_list):
  # 作業詳細str型定義
  detail_list_str = ''

  # 作業詳細リストをstr型に変更するループ
  for i, e in enumerate(detail_list):
    # 最終ループの処理
    if i == len(detail_list) - 1:
      # 作業詳細変数に作業詳細リストの要素をstr型で追加する（最後なので区切り文字は付けない）
      detail_list_str = detail_list_str + detail_list[i]

    # 最終ループ以外の処理
    else:
      # 作業詳細変数に作業詳細リストの要素をstr型で追加し、区切り文字の'$'も追加
      detail_list_str = detail_list_str + detail_list[i] + '$'

  return detail_list_str



# ============================================================
# 工数入力OK/NG判定
# ============================================================

# 入力された作業時間の合計が、就業形態・直・ショップに対して正しいかを判定する。
#
# 作業時間の合計（未入力 '#' と休憩 '$' 以外のコマ数 × 5分）から残業時間を引いた値が、
# 就業形態ごとに決められた定時の作業時間（分）と一致すれば OK（True）にする。
# 主な基準（作業時間合計 − 残業時間）:
#   出勤 / シフト出          : 470分（7時間50分）
#   出勤(時短なし)           : 480分
#   半前年休/半後年休(時短なし): 240分
#   休出                     : 作業時間合計 = 残業時間（かつ 0 ではない）
#   早退・遅刻               : 作業時間が 0 でなければ OK
#   半前年休 / 半後年休      : 直とショップの組み合わせごとに基準が異なる（下の各分岐を参照）
#   休日 / シフト休 / 年休 / 代休 / 公休 / 欠勤 : 作業時間・残業ともに 0
# 条件は上から順にすべて評価され、どれか1つでも当てはまれば True になる。
#
# 引数:
#   kosu_def : 作業内容（288要素のリスト、または288文字の文字列。count() が使えればよい）
#   work     : 就業形態（'出勤' / '休出' / '半前年休' など）
#   tyoku    : 直（'1'=1直, '2'=2直, '3'=3直, '4'=常昼, '5'=連1直, '6'=連2直）
#   member_obj: 人員データ（ショップによって半休時の基準が変わるため参照する）
#   over_work: 残業時間（分）。文字列でも int() で数値化して使う
# 戻り値:
#   bool: True = 工数入力OK、False = 工数入力NG
def judgement_check(kosu_def, work, tyoku, member_obj, over_work):
  # 工数合計取得
  #   1日 1440分（288コマ × 5分）から、未入力コマ・休憩コマの分を引いた残りが作業時間（分）
  kosu_total = 1440 - (kosu_def.count('#')*5) - (kosu_def.count('$')*5)

  # 工数入力OK_NGリセット（どの条件にも当てはまらなければ NG のまま）
  judgement = False

  # 出勤・シフト出の場合: 作業時間から残業を引いた値が定時の 470分（7時間50分）ならOK
  if (work == '出勤' or work == 'シフト出') and \
    kosu_total - int(over_work) == 470:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 出勤(時短なし)の場合: 定時が 480分（8時間）ならOK
  if work == '出勤(時短なし)' and kosu_total - int(over_work) == 480:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 半日年休(時短なし)の場合: 前半休・後半休とも 240分（4時間）ならOK
  if (work == '半前年休(時短なし)' or work == '半後年休(時短なし)') and kosu_total - int(over_work) == 240:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 休出時、工数合計と残業に整合性がある場合の処理
  #   休日出勤は作業時間すべてが残業扱いなので、作業時間合計 = 残業時間（0分は不可）ならOK
  if work == '休出' and kosu_total == int(over_work) and int(over_work) != 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
  #   作業時間が決まらないため、何かしら作業が入力されていればOKとする
  if work == '早退・遅刻' and kosu_total != 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 常昼の場合の処理（ショップに関係なく同じ基準）
  if tyoku == '4':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 230分）
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 240分）
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # 連2の場合の処理（連1直 '5' / 連2直 '6'。ショップに関係なく同じ基準）
  if tyoku == '5' or tyoku == '6':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 220分）
    if work == '半前年休' and kosu_total - int(over_work) == 220:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 250分）
    if work == '半後年休' and kosu_total - int(over_work) == 250:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ここから下の6ブロックは、ショップのグループ × 1〜3直 ごとの半休の基準
  #   三組三交替Ⅱ甲乙丙番C: W1 / W2 / A1 / A2 / J / 組長以上(W,A)（組立系ショップ）
  #   三組三交替Ⅱ甲乙丙番B: P / R / T1 / T2 / その他 / 組長以上(P,R,T,その他)
  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '1':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 230分）
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 240分）
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '2':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 290分）
    if work == '半前年休' and kosu_total - int(over_work) == 290:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 180分）
    if work == '半後年休' and kosu_total - int(over_work) == 180:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '3':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 230分）
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 240分）
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '1':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 220分）
    if work == '半前年休' and kosu_total - int(over_work) == 220:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 250分）
    if work == '半後年休' and kosu_total - int(over_work) == 250:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '2':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 230分）
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 240分）
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '3':
    # 半前年休時、工数合計と残業に整合性がある場合の処理（基準 275分）
    if work == '半前年休' and kosu_total - int(over_work) == 275:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理（基準 195分）
    if work == '半後年休' and kosu_total - int(over_work) == 195:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # 休日・休暇系（休日 / シフト休 / 年休 / 代休 / 公休 / 欠勤）の場合:
  #   作業時間・残業時間ともに 0 ならOK
  if (work == '休日' or work == 'シフト休' or work == '年休' or work == '代休' or work == '公休' or work == '欠勤') and \
    kosu_total == 0 and int(over_work) == 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  return judgement



# ============================================================
# 直に合わせた並べ替え
# ============================================================

# 作業内容と作業詳細を、0:00始まりの並びから「直の開始時刻」始まりの並びに並べ替える。
#
# 夜勤のように日付をまたぐ直でも、勤務の流れどおり（開始→終了）に表示・集計できるようにする。
# 方法: リストを2周分つなげ（576要素）、先頭から「直の開始インデックス」個を削除し、
#       残りの先頭 288 個（＝ちょうど24時間分）だけを残す。
#   例: 1直（開始 4:30 = インデックス54）→ 元の [54]〜[287], [0]〜[53] の順に並ぶ
# 直ごとの開始時刻（ショップのグループで異なる直がある）:
#   1直・連1直 : 4:30（54）
#   2直        : P/R/T1/T2/その他/組長以上(P,R,T,その他) は 12:00（144）、W1/W2/A1/A2/J/組長以上(W,A) は 9:00（108）
#   3直        : P/R/T1/T2/その他/組長以上(P,R,T,その他) は 20:30（246）、W1/W2/A1/A2/J/組長以上(W,A) は 18:00（216）
#   常昼       : 6:00（72）
#   連2直      : 15:00（180）
#   直が未入力 : 0:00 のまま
#
# 引数:
#   obj_get   : 工数データ（Business_Time_graph）。time_work / detail_work / tyoku2 を使う
#   member_obj: 人員データ（2直・3直の開始時刻をショップで判定するため）
# 戻り値:
#   (kosu_def, detail_list): 並べ替え後の作業内容リスト・作業詳細リスト（どちらも288要素）
def kosu_sort(obj_get, member_obj):
  # 作業内容と作業詳細を取得しリストに解凍
  #   作業内容は1文字ずつのリストに、作業詳細は区切り文字 '$' で分割してリストにする
  kosu_def = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')

  # 作業内容と作業詳細のリストを2個連結
  #   [0:00〜23:55, 0:00〜23:55] の2日分にして、日付をまたぐ切り出しをできるようにする
  kosu_def = kosu_def*2
  detail_list = detail_list*2

  # 1直の時の処理（1直 '1' と 連1直 '5'）
  if obj_get.tyoku2 == '1' or obj_get.tyoku2 == '5':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    #   先頭54コマ（0:00〜4:25）を削除し、288コマ目以降（翌日分の余り）を削除する
    del kosu_def[:54]
    del detail_list[:54]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える（先頭144コマを削除）
    del kosu_def[:144]
    del detail_list[:144]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2,J,組長以上(W,A))
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える（先頭108コマを削除）
    del kosu_def[:108]
    del detail_list[:108]
    del kosu_def[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える（先頭246コマを削除）
    del kosu_def[:246]
    del detail_list[:246]
    del kosu_def[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2,J,組長以上(W,A))
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える（先頭216コマを削除）
    del kosu_def[:216]
    del detail_list[:216]
    del kosu_def[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える（先頭72コマを削除）
    del kosu_def[:72]
    del detail_list[:72]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直(連2)の時の処理（連2直 '6'）
  elif obj_get.tyoku2 == '6':
    # 作業内容と作業詳細のリストを15時からの表示に変える（先頭180コマを削除）
    del kosu_def[:180]
    del detail_list[:180]
    del kosu_def[288:]
    del detail_list[288:]

  # 直入力ない時の処理（並べ替えず、2周目の分を削除して 0:00 始まりのまま返す）
  else:
    del kosu_def[288:]
    del detail_list[288:]

  return kosu_def, detail_list



# ============================================================
# 休憩時間の取得・変換
# ============================================================

# 人員データに登録されている、指定した直の休憩時間（昼休憩＋残業休憩1〜3）を取得する。
#
# 人員データには直ごと（1〜6）に break_time{直} / break_time{直}_over1〜3 が登録されている。
#
# 引数:
#   tyoku   : 直（'1'=1直, '2'=2直, '3'=3直, '4'=常昼, '5'=連1直, '6'=連2直）
#   login_no: 休憩時間を取得する人員の従業員番号
# 戻り値:
#   (breaktime, breaktime_over1, breaktime_over2, breaktime_over3):
#     昼休憩・残業休憩1・残業休憩2・残業休憩3（いずれも "#HHMMHHMM" 形式）
# 例外:
#   member.DoesNotExist: 従業員番号の人員が存在しない場合
#   UnboundLocalError  : tyoku が '1'〜'6' 以外（未入力など）の場合（戻り値の変数が作られないため）
def break_get(tyoku, login_no):
  # 休憩時間取得（従業員番号から人員データを1件取得）
  break_time_obj = member.objects.get(employee_no=login_no)

  # 1直の場合の休憩時間取得
  if tyoku == '1':
    breaktime = break_time_obj.break_time1
    breaktime_over1 = break_time_obj.break_time1_over1
    breaktime_over2 = break_time_obj.break_time1_over2
    breaktime_over3 = break_time_obj.break_time1_over3

  # 2直の場合の休憩時間取得
  if tyoku == '2':
    breaktime = break_time_obj.break_time2
    breaktime_over1 = break_time_obj.break_time2_over1
    breaktime_over2 = break_time_obj.break_time2_over2
    breaktime_over3 = break_time_obj.break_time2_over3

  # 3直の場合の休憩時間取得
  if tyoku == '3':
    breaktime = break_time_obj.break_time3
    breaktime_over1 = break_time_obj.break_time3_over1
    breaktime_over2 = break_time_obj.break_time3_over2
    breaktime_over3 = break_time_obj.break_time3_over3

  # 常昼の場合の休憩時間取得
  if tyoku == '4':
    breaktime = break_time_obj.break_time4
    breaktime_over1 = break_time_obj.break_time4_over1
    breaktime_over2 = break_time_obj.break_time4_over2
    breaktime_over3 = break_time_obj.break_time4_over3

  # 連1直の場合の休憩時間取得
  if tyoku == '5':
    breaktime = break_time_obj.break_time5
    breaktime_over1 = break_time_obj.break_time5_over1
    breaktime_over2 = break_time_obj.break_time5_over2
    breaktime_over3 = break_time_obj.break_time5_over3

  # 連2直の場合の休憩時間取得
  if tyoku == '6':
    breaktime = break_time_obj.break_time6
    breaktime_over1 = break_time_obj.break_time6_over1
    breaktime_over2 = break_time_obj.break_time6_over2
    breaktime_over3 = break_time_obj.break_time6_over3

  return breaktime, breaktime_over1, breaktime_over2, breaktime_over3



# 画面から送られた休憩の開始・終了日時を、インデックスと "#HHMMHHMM" 形式に変換する。
#
# 画面（TodayBreakTime.tsx / BreakTime.tsx）は日時を JavaScript の toISOString() で送るため、
# UTC（協定世界時）の "YYYY-MM-DDTHH:MM:SS.sssZ" 形式になっている。
# これを日本時間（JST）に直してから時・分を取り出す。
#   例: "2026-11-09T02:40:00.000Z"（UTC 2:40）→ JST 11:40 → インデックス 140
#
# 引数:
#   break_time_start: 休憩開始日時（ISO形式の文字列）
#   break_time_end  : 休憩終了日時（ISO形式の文字列）
#   jst             : 日本時間のタイムゾーン（datetime.timezone(timedelta(hours=9))）
# 戻り値:
#   (start_time_ind, end_time_ind, time_str)
#     start_time_ind: 休憩開始のインデックス（int）
#     end_time_ind  : 休憩終了のインデックス（int）
#     time_str      : "#HHMMHHMM" 形式の休憩時間（例: "#11401240"）
# 例外:
#   ValueError("未入力箇所があります")  : 開始・終了のどちらかが None または空文字の場合
#   ValueError("入力値の形式が不正です"): 日時の形式が想定と違い変換できない場合
def parse_break_time(break_time_start, break_time_end, jst):
  # 引数チェック: Noneや空文字列の場合
  if not break_time_start or not break_time_end:
    raise ValueError("未入力箇所があります")

  try:
    # ISO形式の文字列を日時データに変換（末尾の Z は UTC を表す）
    start_time = datetime.datetime.strptime(break_time_start, "%Y-%m-%dT%H:%M:%S.%fZ")
    end_time = datetime.datetime.strptime(break_time_end, "%Y-%m-%dT%H:%M:%S.%fZ")
    # UTC として扱い → 日本時間に変換 → "HH:MM" の文字列にする
    start_time = (
        start_time.replace(tzinfo=datetime.timezone.utc)
        .astimezone(jst)
        .strftime("%H:%M")
    )
    end_time = (
        end_time.replace(tzinfo=datetime.timezone.utc)
        .astimezone(jst)
        .strftime("%H:%M")
    )
    # "#HHMMHHMM" 形式の休憩時間文字列を作る（"HH:MM" から ':' を除いて開始・終了をつなぐ）
    time_str = '#' + start_time[0:2] + start_time[3:5] + end_time[0:2] + end_time[3:5]
    # 時と分に分けて、インデックス（時×12 + 分÷5）に変換する
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour) * 12 + int(start_time_min) / 5)
    end_time_ind = int(int(end_time_hour) * 12 + int(end_time_min) / 5)
  # 形式違いで変換に失敗した場合は、画面表示用のメッセージに差し替えて送出し直す
  except ValueError:
    raise ValueError("入力値の形式が不正です")

  return start_time_ind, end_time_ind, time_str



# ============================================================
# 日付計算
# ============================================================

# 指定した日付が、その月の第何週かを求める（日曜始まりで数える）。
#
# 勤務入力画面の「デフォルト直」設定で、第1週〜第6週ごとに直を割り当てるために使う
# （kosu_views.py の TyokuDefault）。
#   例: 2026年11月1日（日曜）→ 1、11月8日（日曜）→ 2
#
# 引数:
#   target_date: 調べる日付（datetime.date）
# 戻り値:
#   int: 週番号（1始まり。月によって最大 6）
def get_week_of_month(target_date):
  # 年・月・日を取り出す
  year = target_date.year
  month = target_date.month
  day = target_date.day

  # 日曜始まりのカレンダーを取得（firstweekday=6 は日曜を週の先頭にする指定。0 なら月曜）
  cal = calendar.Calendar(firstweekday=6)

  # 月の週ごとの日付リストを取得
  #   例: [[0, 0, 0, 0, 0, 0, 1], [2, 3, ...], ...] のような「週ごとの日付のリスト」
  #   （その月に含まれない日は 0 になる）
  month_days = cal.monthdayscalendar(year, month)

  # 週番号を探す（指定日が含まれる週の位置 + 1 を返す）
  for week_index, week in enumerate(month_days):
    if day in week:
      return week_index + 1


# ============================================================
# 表示用リストの作成
# ============================================================

# 作業内容が切り替わるごとの「作業時間帯・作業内容・作業詳細」の一覧を作る。
#
# 現在は工数入力状況のExcel出力（team_utils.py の excel_function）で使われている。
#
# 引数:
#   work_list  : kosu_sort で直の開始時刻から並べ替えた作業内容リスト（288要素）
#   detail_list: 同じく並べ替えた作業詳細リスト（288要素）
#   obj_get    : 工数データ（直 tyoku2 を参照する）
#   member_obj : 人員データ（ショップを参照する）
#   request    : HTTPリクエスト（セッションの工数区分定義Verを参照する）
# 戻り値:
#   list: [["HH:MM～HH:MM", 作業内容名, 作業詳細], ...] のリスト
#         例: [["08:00～10:00", "点検", "設備A"], ["10:00～10:10", "休憩", ""]]
def create_kosu(work_list, detail_list, obj_get, member_obj, request):
  # HTML表示用リスト前準備リスト作成
  #   def_time: 各時間帯の作業内容名 / detail_time: 各時間帯の作業詳細
  #   time_list_start / time_list_end: 各時間帯の開始・終了時刻（"HH:MM"）
  def_time, detail_time, time_list_start, time_list_end, kosu_list = create_kosu_basic(work_list, detail_list, obj_get, member_obj, request)

  # HTML表示用リスト作成
  #   開始・終了時刻を組にして1件ずつ取り出し、同じ順番（k番目）の作業内容名・作業詳細と組み合わせる
  time_display_list = [
    [f"{start}～{end}", def_time[k], detail_time[k]]
    for k, (start, end) in enumerate(zip(time_list_start, time_list_end))
    ]

  return time_display_list



# create_kosu で使う材料（作業内容が切り替わる時刻と、その時間帯の作業内容・作業詳細）を作る。
#
# 処理の流れ:
#   1. 288コマを先頭から見て、作業内容か作業詳細が前のコマと変わった位置（切り替わり点）を記録する
#   2. 並べ替え後の位置を、直の開始時刻ぶんずらして本来の時刻のインデックスに戻す
#   3. 隣り合う切り替わり点を「開始時刻〜終了時刻」の組にする
#   4. 各時間帯の工数区分記号を、工数区分定義の名称（'#' は '-'、'$' は '休憩'）に変換する
#
# 引数:
#   work_list  : kosu_sort で並べ替えた作業内容リスト（288要素）
#   detail_list: kosu_sort で並べ替えた作業詳細リスト（288要素）
#   obj_get    : 工数データ（直 tyoku2 を参照する）
#   member_obj : 人員データ（2直・3直のずらし幅をショップで判定するため）
#   request    : HTTPリクエスト。request.session['input_def']（使用中の工数区分定義Ver。
#                ログイン時に最新Verが設定され、定義Ver切替で変更できる）を使う
# 戻り値:
#   (def_time, detail_time, time_list_start, time_list_end, kosu_list)
#     def_time       : 各時間帯の作業内容名のリスト
#     detail_time    : 各時間帯の作業詳細のリスト
#     time_list_start: 各時間帯の開始時刻（"HH:MM"）のリスト
#     time_list_end  : 各時間帯の終了時刻（"HH:MM"）のリスト
#     kosu_list      : 切り替わり点の、本来の時刻でのインデックスのリスト
def create_kosu_basic(work_list, detail_list, obj_get, member_obj, request):
  # 作業時間リストリセット
  kosu_list, time_list_start, time_list_end = [], [], []
  # find_list: 切り替わり点の「並べ替え後の」インデックス（記号・作業詳細の参照に使う）
  def_time, detail_time, find_list = [], [], []

  # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
  #   キー: 直コードのタプル / 値: 並べ替え後の位置を本来の時刻に戻すための調整値
  #   調整値 = 288 − kosu_sort で先頭から削除したコマ数（例: 1直は 288 − 54 = 234）
  #   2直・3直はショップのグループで開始時刻が違うため、調整値も切り替える
  #   直が未入力（どのキーにも該当しない）の場合は時刻リストが作られない
  adjustment_dict = {
    ('1', '5'): 234,
    ('2',): 144 if member_obj.shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] else 180,
    ('3',): 42 if member_obj.shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] else 72,
    ('4',): 216,
    ('6',): 108,
    }

  # 288コマを先頭から順に確認する
  for i in range(288):
    # 工数変化検知
    #   次のいずれかなら「切り替わり点」として記録する
    #   - 先頭コマで、作業が入力されている（最初の作業の開始時刻）
    #   - 前のコマと作業内容または作業詳細が違う（作業の切り替わり）
    #   - 最後のコマで、作業が入力されている（最後の作業の終了時刻）
    add_index = False
    if i == 0 and work_list[i] != '#':
      add_index = True
    elif i != 0 and (work_list[i] != work_list[i - 1] or detail_list[i] != detail_list[i - 1]):
      add_index = True
    elif i == 287 and work_list[i] != '#':
      add_index = True

    # 作業内容が前の時間と変化している場合の処理
    if add_index:
      # 検索用リストにインデックス記録
      find_list.append(i)
      # 表示用作業内容リストの時間を正規の時間のインデックスで記録
      #   本来のインデックス = 並べ替え後の位置 − 調整値（負になる場合は 288 − 調整値 を足す）
      #   最後のコマ（287）は「そのコマの終わり」を終了時刻にするため +1 する
      for keys, adjustment in adjustment_dict.items():
        if obj_get.tyoku2 in keys:
          if i == 287:
            kosu_list.append(i - adjustment + 1 if i >= adjustment else i + (289 - adjustment))
          else:
            kosu_list.append(i - adjustment if i >= adjustment else i + (288 - adjustment))
          break

  # 作業時間インデックスに要素がある場合の処理
  #   隣り合う切り替わり点を組にして「開始時刻〜終了時刻」の文字列を作る
  #   インデックス → 時刻: 時 = インデックス ÷ 12（切り捨て）、分 = (インデックス ÷ 12 の余り) × 5
  #   例: 102 → 102÷12 = 8 余り 6 → "08:30"（zfill(2) で2桁にゼロ埋め）
  if kosu_list:
    for ind, t in enumerate(kosu_list[:-1]):
      time_list_start.append(f"{str(int(t)//12).zfill(2)}:{str(int(t)%12*5).zfill(2)}")
      time_list_end.append(f"{str(int(kosu_list[ind + 1])//12).zfill(2)}:{str(int(kosu_list[ind + 1])%12*5).zfill(2)}")

  # 業務工数区分辞書作成
  #   セッションの工数区分定義Verから [記号, 区分名] の一覧を作り、
  #   未入力（'#' → '-'）と休憩（'$' → '休憩'）の対応も追加する
  def_library, def_n = kosu_division_dictionary(request.session['input_def'])
  def_library.append(['#', '-'])
  def_library.append(['$', '休憩'])

  # 作業内容と作業詳細リスト作成
  #   最後の切り替わり点は「終了時刻」でしかないので除き（find_list[:-1]）、
  #   各時間帯の先頭コマの記号を区分名に変換、作業詳細はそのコマの値を取り出す
  def_time = [k[1] for t in find_list[:-1] for k in def_library if k[0] == work_list[t]]
  detail_time = [detail_list[t] for t in find_list[:-1] for k in def_library if k[0] == work_list[t]]

  return def_time, detail_time, time_list_start, time_list_end, kosu_list



# ============================================================
# 工数区分定義の取得
# ============================================================

# 指定した工数区分定義Verの「記号と区分名」の一覧を作る。
#
# 工数区分1〜50 には記号 A〜Z, a〜x が順に対応する（区分1 = 'A'、区分27 = 'a'）。
# 区分名が入力されている最後の番号までを一覧の対象にする。
#
# 引数:
#   def_name: 工数区分定義Ver名（kosu_division.kosu_name）
# 戻り値:
#   (choices_list, n)
#     choices_list: [[記号, 区分名], ...] のリスト（例: [['A', '点検'], ['B', '修理'], ...]）
#     n           : 区分名が入力されている最後の工数区分の番号（途中に空きがあっても最大の番号）
# 例外:
#   kosu_division.DoesNotExist: 指定した工数区分定義Verが存在しない場合
def kosu_division_dictionary(def_name):
    # 現在使用している工数区分のオブジェクトを取得
    kosu_obj = kosu_division.objects.get(kosu_name=def_name)

    # 工数区分登録カウンターリセット
    n = 0
    # 工数区分登録数カウント
    #   区分名1〜50 を順に見て、空でない区分の番号で n を上書きする
    #   → 最終的に「区分名が入力されている最後の番号」が n に残る（個数を数えているわけではない）
    for kosu_num in range(1, 51):
      val = getattr(kosu_obj, f'kosu_title_{kosu_num}')
      if val not in [None, '']:
        n = kosu_num

    # 工数区分処理用記号リスト用意（A〜Z, a〜x の先頭 n 個）
    str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:n]

    # 工数区分の選択リスト作成
    #   記号 m と、対応する区分名（kosu_title_番号）を組にして追加する
    choices_list = []
    for i, m in enumerate(str_list):
      title_val = getattr(kosu_obj, f'kosu_title_{i + 1}')
      choices_list.append([m, title_val])

    return choices_list, n



# 指定した工数区分定義Verの区分名だけのリストと、区分数を返す。
#
# 工数入力状況のExcel出力（team_utils.py）で、区分ごとの集計行の見出しに使う。
#
# 引数:
#   session_def_name: 工数区分定義Ver名
# 戻り値:
#   (区分名のリスト, def_num): 例: (['点検', '修理', ...], 2)
#     def_num は kosu_division_dictionary の n と同じ（区分名が入力されている最後の番号）
def get_def_library_data(session_def_name):
  # 工数区分定義辞書もどき作成（[記号, 区分名] のリスト）
  def_library, def_num = kosu_division_dictionary(session_def_name)
  # 工数区分定義のみのリストを返す（各要素の2番目＝区分名だけを取り出す）
  return [sublist[1] for sublist in def_library], def_num


