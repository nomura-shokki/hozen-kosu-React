from ..models import Business_Time_graph
from ..models import member
from ..models import kosu_division
from django.contrib import messages
from django.shortcuts import redirect
import datetime
import itertools
from .main_utils import history_record




#--------------------------------------------------------------------------------------------------------





# 現在時刻取得関数
def round_time(dt=None, round_to=5):
  # 時刻の指定がない場合現在時刻取得
  if dt is None:
    dt = datetime.datetime.now().time()

  # 5分で丸める
  minute = (dt.minute // round_to) * round_to

  # 5分で丸めた分を返す
  return dt.replace(minute=minute, second=0, microsecond=0)





#--------------------------------------------------------------------------------------------------------





# 工数データの始まり検索関数
def get_graph_start_index(graph_list):
  # 工数データの始まり検索ループ
  for i in range(288):
    # グラフデータが0でない場合の処理
    if graph_list[i] != 0:
      # iが0であればそのまま返す
      # iが0以外なら前のインデックスを返す
      return i if i == 0 else i - 1

  # 工数データが空であれば0を返す
  return 0





#--------------------------------------------------------------------------------------------------------





# 工数データの終わり検索関数
def get_graph_end_index(graph_list):
  # 工数データの終わり検索ループ
  for i in range(1, 289):
    # グラフデータが0でない場合の処理
    if graph_list[-i] != 0:
      # iが1であればそのまま返す
      # iが1以外ならグラフデータの終わりの次のインデックスを返す
      return 289 - i if i == 1 else 290 - i
  # 工数データが空であれば288を返す
  return 288





#--------------------------------------------------------------------------------------------------------





# 工数データの表示調整関数
def adjust_end_index_for_work_shift(graph_end_index, work_shift, shop): 
  # 入力直が1直で工数が入力され終わりのインデックスが184以下である場合の処理(工数入力が15:20以前の場合)
  if (work_shift == '1' or work_shift =='5') and graph_end_index <= 184:
    # 工数の入力され終わりのインデックスで184を返す(15:20を返す)
    return 184
  
  # 入力直が2直の場合の処理
  elif work_shift == '2':
    # ログイン者のショップがボデーか組立で入力され終わりのインデックスが240以下である場合の処理(工数入力が20:00以前の場合)
    if shop in ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)'] and graph_end_index <= 240:
      # 工数の入力され終わりのインデックスで240を返す(20:00を返す)
      return 240
    
    # ログイン者のショップがプレスか成形か塗装で入力され終わりのインデックスが270以下である場合の処理(工数入力が22:30以前の場合)
    elif shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] and graph_end_index <= 270:
      # 工数の入力され終わりのインデックスで270を返す(22:30を返す)
      return 270
    
  # 入力直が常昼で入力され終わりのインデックスが204以下である場合の処理(工数入力が17:00以前の場合)
  elif work_shift == '4' and graph_end_index <= 204:
    # 工数の入力され終わりのインデックスで204を返す(17:00を返す)
    return 204
  
  # グラフデータの終わりを返す
  return graph_end_index





#--------------------------------------------------------------------------------------------------------





# 工数データの表示調整関数(3直の場合)
def adjust_end_index_for_night_shift(graph_end_index, work_shift, shop):
  # ログイン者のショップがボデーか組立で3直の場合の処理
  if shop in ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)'] and work_shift == '3':
    # 工数が入力され終わりのインデックスと152で大きい方を返す(4:40以降の場合そこまで表示)
    return max(graph_end_index, 152)
  
  # ログイン者のショップがプレスか成形か塗装で3直の場合の処理
  elif shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] and work_shift == '3':
    # 工数が入力され終わりのインデックスと181で大きい方を返す(7:05以降の場合そこまで表示)
    return max(graph_end_index, 181)
  
  # 2直(連2)の場合の処理
  elif work_shift == '6':
    # 工数が入力され終わりのインデックスと106で大きい方を返す(1:50以降の場合そこまで表示)
    return max(graph_end_index, 118)




#--------------------------------------------------------------------------------------------------------





# グラフラベル＆グラフデータ作成関数
def handle_get_request(new_work_day, member_obj):
  # 該当日に工数データがあるか確認
  obj_filter = Business_Time_graph.objects.filter(employee_no3=member_obj.employee_no, work_day2=new_work_day)

  # グラフラベルリスト作成(0:00~23:55の5分刻みのリスト)
  graph_item = ['{}:{}'.format(i, '00' if n == 0 else '05' if n == 5 else n) for i in range(24) for n in range(0, 60, 5)]

  # グラフデータリスト内の各文字を定義
  str_list = list('#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')

  # 該当日に工数データがある場合の処理
  if obj_filter.exists():
    # 工数データ取得
    obj_get = obj_filter.first()
    # グラフデータ作成
    graph_list = [str_list.index(char) if char in str_list else 0 for char in list(obj_get.time_work)]

    # グラフリストが空でない場合の処理
    if graph_list != [0] * 288:
      #　入力直が3直or2直(連2)でない場合の処理
      if obj_get.tyoku2 not in ['3', '6']:
        # グラフデータの始まりのインデックス取得
        graph_start_index = get_graph_start_index(graph_list)
        # グラフデータの終わりのインデックス取得
        graph_end_index = get_graph_end_index(graph_list)
        # グラフデータの表示を定時前の場合定時まで表示させる
        graph_end_index = adjust_end_index_for_work_shift(graph_end_index, obj_get.tyoku2, member_obj.shop)

        # グラフ表示のリストを工数データが空の部分を削除する
        del graph_list[graph_end_index:]
        del graph_list[:graph_start_index]
        del graph_item[graph_end_index:]
        del graph_item[:graph_start_index]

      #　入力直が3直or2直(連2)である場合の処理
      else:
        # 16:00～のグラフ表示に変更
        graph_list = (graph_list * 2)[192:480]
        graph_item = (graph_item * 2)[192:480]
        # グラフデータの始まりのインデックス取得
        graph_start_index = get_graph_start_index(graph_list)
        # グラフデータの終わりのインデックス取得
        graph_end_index = get_graph_end_index(graph_list)
        # グラフデータの表示を定時前の場合定時まで表示させる
        graph_end_index = adjust_end_index_for_night_shift(graph_end_index, obj_get.tyoku2, member_obj.shop)

        # グラフ表示のリストを工数データが空の部分を削除する
        del graph_list[graph_end_index:]
        del graph_list[:graph_start_index]
        del graph_item[graph_end_index:]
        del graph_item[:graph_start_index]

  # 該当日に工数データがない場合の処理
  else:
    # グラフデータに空を入れる
    graph_list = [0] * 288

  # グラフラベルデータとグラフデータを入れる
  return graph_item, graph_list





#--------------------------------------------------------------------------------------------------------





# 日付変更時の作業時間フォーム変更関数
def handle_work_shift(request, member_obj, new_work_day):
  # 該当日に工数データがあるか確認
  obj_filter = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2=new_work_day)

  # 該当日に工数データがある場合の処理
  if obj_filter.exists():
    # 工数データ取得
    obj_get = obj_filter.first()


    # 1直 or 1直(連2)がPOSTされた場合の処理
    if obj_get.tyoku2 == '1' or obj_get.tyoku2 == '5':
      # 作業開始時間更新
      request.session['start_time'] = '06:30'
      # 作業終了時間更新
      request.session['end_time'] = '06:30'

    # 2直がPOSTされてログイン者のショップがボデーか組立の場合の処理
    elif obj_get.tyoku2 == '2' and (member_obj.shop == 'W1' or \
      member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)'):
      # 作業開始時間更新
      request.session['start_time'] = '11:10'
      # 作業終了時間更新
      request.session['end_time'] = '11:10'

    # 2直がPOSTされてログイン者のショップがプレス、成形、塗装の場合の処理
    elif obj_get.tyoku2 == '2' and (member_obj.shop == 'P' or \
      member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
      # 作業開始時間更新
      request.session['start_time'] = '13:40'
      # 作業終了時間更新
      request.session['end_time'] = '13:40'

    # 3直がPOSTされてログイン者のショップがボデーか組立の場合の処理
    elif obj_get.tyoku2 == '3' and (member_obj.shop == 'W1' or \
      member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)'):
      # 作業開始時間更新
      request.session['start_time'] = '19:50'
      # 作業終了時間更新
      request.session['end_time'] = '19:50'

    # 3直がPOSTされてログイン者のショップがプレス、成形、塗装、その他の場合の処理
    elif obj_get.tyoku2 == '3' and (member_obj.shop == 'P' or \
      member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
      # 作業開始時間更新
      request.session['start_time'] = '22:10'
      # 作業終了時間更新
      request.session['end_time'] = '22:10'

    # 常昼がPOSTされた場合の処理
    elif obj_get.tyoku2 == '4':
      # 作業開始時間更新
      request.session['start_time'] = '08:00'
      # 作業終了時間更新
      request.session['end_time'] = '08:00'

    # 2直(連2)がPOSTされた場合の処理
    elif obj_get.tyoku2 == '6':
      # 作業開始時間更新
      request.session['start_time'] = '17:10'
      # 作業終了時間更新
      request.session['end_time'] = '17:10'



#--------------------------------------------------------------------------------------------------------





# 時＆分 分離関数
def time_index(post_time):
  # 時間の区切りのインデックス取得
  post_index = post_time.index(':')
  # 時取得
  time_hour = post_time[ : post_index]
  # 分取得
  time_min = post_time[post_index + 1 : ]

  # 時と分返す
  return time_hour, time_min





#--------------------------------------------------------------------------------------------------------





# 休憩時間のインデックス日またぎチェック関数
def break_time_process(breaktime_str):
  # 休憩開始時間のインデックス取得
  break_start = int(breaktime_str[1 : 3])*12 + int(breaktime_str[3 : 5])/5
  # 休憩終了時間のインデックス取得
  break_end = int(breaktime_str[5 : 7])*12 + int(breaktime_str[7 :])/5

  # 休憩の日またぎ変数リセット
  break_next_day = 0
  # 休憩開始時間より終了時間の方が早い場合の処理
  if break_start > break_end:
    # 日またぎ変数に1を入れる
    break_next_day = 1

  # 休憩開始時間より終了時間の方が遅い場合の処理
  else:
    # 日またぎ変数に0を入れる
    break_next_day = 0

  return break_start, break_end, break_next_day





#--------------------------------------------------------------------------------------------------------





# 工数書き込み関数
def kosu_write(start_ind, end_ind, kosu_def, detail_list, request):
  # 作業内容と作業詳細を書き込むループ
  for kosu in range(start_ind, end_ind):
    # 作業内容リストに入力された工数定義区分の対応する記号を入れる
    kosu_def[kosu] = request.POST['kosu_def_list']
    # 作業詳細リストに入力した作業詳細を入れる
    detail_list[kosu] = request.POST['work_detail']

  return kosu_def, detail_list





#--------------------------------------------------------------------------------------------------------





# 休憩範囲工数削除関数
def break_time_delete(break_start_ind, break_end_ind, kosu_def, detail_list, member_obj, request):
  # 休憩時間ループ
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # ユーザーが休憩エラー有効チェックONの場合の処理
    if member_obj.break_check == True:
      # 作業内容リストが空でない場合の処理
      if kosu_def[bt] != '#':
        # 作業内容リストが休憩でない場合の処理
        if kosu_def[bt] != '$':
          # エラーメッセージ出力
          messages.error(request, '休憩時間に工数は入力できません。休憩変更チェックBOXをONにするか休憩変更登録をして下さい。ERROR031')
          return kosu_def, detail_list

    # ユーザーが休憩エラー有効チェックOFFの場合の処理   
    else:
      # 作業内容リストの要素を空にする
      kosu_def[bt] = '#'
      # 作業詳細リストの要素を空にする
      detail_list[bt] = ''

  return kosu_def, detail_list





#--------------------------------------------------------------------------------------------------------





# 休憩書き込み関数
def break_time_write(break_start_ind, break_end_ind, kosu_def, detail_list):
  # 休憩時間内の工数データを休憩に書き換えるループ
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # 作業内容リストの要素を休憩に書き換え
    kosu_def[bt] = '$'
    detail_list[bt] = ''

  return kosu_def, detail_list





#--------------------------------------------------------------------------------------------------------





# 作業詳細リスト文字列変換関数
def detail_list_summarize(detail_list):
  # 作業詳細str型定義
  detail_list_str = ''

  # 作業詳細リストをstr型に変更するループ
  for i, e in enumerate(detail_list):
    # 最終ループの処理
    if i == len(detail_list) - 1:
      # 作業詳細変数に作業詳細リストの要素をstr型で追加する
      detail_list_str = detail_list_str + detail_list[i]

    # 最終ループ以外の処理
    else:
      # 作業詳細変数に作業詳細リストの要素をstr型で追加し、区切り文字の'$'も追加
      detail_list_str = detail_list_str + detail_list[i] + '$'

  return detail_list_str





#--------------------------------------------------------------------------------------------------------





# 工数データ整合性判断関数
def judgement_check(kosu_def, work, tyoku, member_obj, over_work):
  # 工数合計取得
  kosu_total = 1440 - (kosu_def.count('#')*5) - (kosu_def.count('$')*5)

  # 工数入力OK_NGリセット
  judgement = False

  # 出勤、休出時、工数合計と残業に整合性がある場合の処理
  if (work == '出勤' or work == 'シフト出') and \
    kosu_total - int(over_work) == 470:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 休出時、工数合計と残業に整合性がある場合の処理
  if work == '休出' and kosu_total == int(over_work):
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
  if work == '早退・遅刻' and kosu_total != 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  # 常昼の場合の処理
  if tyoku == '4':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # 連2の場合の処理
  if tyoku == '5' or tyoku == '6':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 220:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 250:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '1':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '2':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 290:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 180:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
  if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
    member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
      member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and \
      tyoku == '3':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '1':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 220:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 250:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '2':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 230:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 240:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
  if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
    member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
      member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
      tyoku == '3':
    # 半前年休時、工数合計と残業に整合性がある場合の処理
    if work == '半前年休' and kosu_total - int(over_work) == 275:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

    # 半後年休時、工数合計と残業に整合性がある場合の処理
    if work == '半後年休' and kosu_total - int(over_work) == 195:
      # 工数入力OK_NGをOKに切り替え
      judgement = True

  # 出勤、休出時、工数合計と残業に整合性がある場合の処理
  if (work == '休日' or work == 'シフト休' or work == '年休' or work == '代休' or work == '公休' or work == '欠勤') and \
    kosu_total == 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  return judgement





#--------------------------------------------------------------------------------------------------------





# 工数区分定義辞書作成関数
def kosu_division_dictionary(def_name):
  # 現在使用している工数区分のオブジェクトを取得
  kosu_obj = kosu_division.objects.get(kosu_name = def_name)

  # 工数区分登録カウンターリセット
  n = 0
  # 工数区分登録数カウント
  for kosu_num in range(1, 50):
    if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) not in [None, '']:
      n = kosu_num

  # 工数区分処理用記号リスト用意
  str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:n]


  # 工数区分の選択リスト作成
  choices_list = []
  for i, m in enumerate(str_list):
    choices_list.append([m,eval('kosu_obj.kosu_title_{}'.format(i + 1))])

  return choices_list, n





#--------------------------------------------------------------------------------------------------------





# 工数データを直に合わせて並び替えする関数
def kosu_sort(obj_get, member_obj):
  # 作業内容と作業詳細を取得しリストに解凍
  kosu_def = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')

  # 作業内容と作業詳細のリストを2個連結
  kosu_def = kosu_def*2
  detail_list = detail_list*2

  # 1直の時の処理
  if obj_get.tyoku2 == '1' or obj_get.tyoku2 == '5':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    del kosu_def[:54]
    del detail_list[:54]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del kosu_def[:144]
    del detail_list[:144]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del kosu_def[:108]
    del detail_list[:108]
    del kosu_def[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del kosu_def[:246]
    del detail_list[:246]
    del kosu_def[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える
    del kosu_def[:216]
    del detail_list[:216]
    del kosu_def[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える
    del kosu_def[:72]
    del detail_list[:72]
    del kosu_def[288:]
    del detail_list[288:]

  # 2直(連2)の時の処理
  elif obj_get.tyoku2 == '6':
    # 作業内容と作業詳細のリストを15時からの表示に変える
    del kosu_def[:180]
    del detail_list[:180]
    del kosu_def[288:]
    del detail_list[288:]

  # 直入力ない時の処理
  else:
    del kosu_def[288:]
    del detail_list[288:]

  return kosu_def, detail_list





#--------------------------------------------------------------------------------------------------------




# 基準合計工数作成関数
def default_work_time(obj_get, member_obj):
  # 基準合計工数定義
  default_total = 0
  if obj_get.work_time == '出勤':
    default_total = 470
  elif obj_get.work_time == 'シフト出':
    default_total = 470
  elif obj_get.work_time == '休出':
    default_total = 0
  elif obj_get.work_time == '遅刻・早退':
    default_total = '-'
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半前年休':
    default_total = 220
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半後年休':
    default_total = 250
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半前年休':
    default_total = 230
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半後年休':
    default_total = 240
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半前年休':
    default_total = 275
  elif (member_obj.shop == 'P' or member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半後年休':
    default_total = 195
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半後年休':
    default_total = 240
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半前年休':
    default_total = 290
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半後年休':
    default_total = 180
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (member_obj.shop == 'W1' or member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == 'J' or member_obj.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半後年休':
    default_total = 240
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半前年休':
    default_total = 230
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半後年休':
    default_total = 240
  elif (obj_get.tyoku2 == '5' or obj_get.tyoku2 == '6') and obj_get.work_time == '半前年休':
    default_total = 220
  elif (obj_get.tyoku2 == '5' or obj_get.tyoku2 == '6') and obj_get.work_time == '半後年休':
    default_total = 250

  return default_total





#--------------------------------------------------------------------------------------------------------





# カレンダー日付作成関数
def calendar_day(year, month):
  # 月の初日取得
  select_month = datetime.date(year, month, 1)
  # 月の初日の曜日取得
  week_day = select_month.weekday()

  # 月の最終日取得
  if month == 12:
    month_end = 1
    year_end = year + 1
  else:
    month_end = month + 1
    year_end = year

  select_month = datetime.date(year_end, month_end, 1)
  month_day_end = select_month - datetime.timedelta(days = 1)
  day_end = month_day_end.day

  # カレンダー表示日付変数リセット
  day_list = list(itertools.repeat('', 37))

  # 1週目の日付設定
  if week_day == 6:
    day_list[0] = 1
    day_list[1] = 2
    day_list[2] = 3
    day_list[3] = 4
    day_list[4] = 5
    day_list[5] = 6
    day_list[6] = 7

  if week_day == 0:
    day_list[1] = 1
    day_list[2] = 2
    day_list[3] = 3
    day_list[4] = 4
    day_list[5] = 5
    day_list[6] = 6

  if week_day == 1:
    day_list[2] = 1
    day_list[3] = 2
    day_list[4] = 3
    day_list[5] = 4
    day_list[6] = 5

  if week_day == 2:
    day_list[3] = 1
    day_list[4] = 2
    day_list[5] = 3
    day_list[6] = 4

  if week_day == 3:
    day_list[4] = 1
    day_list[5] = 2
    day_list[6] = 3

  if week_day == 4:
    day_list[5] = 1
    day_list[6] = 2

  if week_day == 5:
    day_list[6] = 1

  # 基準日指定
  start_day = day_list[6]

  # 2～5週目の日付設定
  for i in range(7, 37):
    day_list[i] = start_day + 1
    start_day += 1
    if start_day == day_end:
      break

  # 日付リストを返す
  return day_list





#--------------------------------------------------------------------------------------------------------





# 整合性リスト作成関数
def OK_NF_check(year, month, day_list, member_obj):
  # 整合性リスト定義
  OK_NG_list = []
  # 指定月の工数データ取得しリスト作成するループ
  for ok_ng in range(37):
    # 日付リストが空でない場合の処理
    if day_list[ok_ng] != '':
      # 指定日に工数データあるか確認
      OK_NG_filter = Business_Time_graph.objects.filter(employee_no3 = member_obj.employee_no, \
                                                       work_day2 = datetime.date(year, month, day_list[ok_ng]))
      
      # 工数データある場合の処理
      if OK_NG_filter.exists():
        # 工数データ取得
        OK_NG_obj = OK_NG_filter.first()
        # 整合性有だった場合の処理
        if OK_NG_obj.judgement == True:
          #リストに整合性有追加
          OK_NG_list.append(OK_NG_obj.judgement)

        # 整合性無しだった場合
        else:
          # リストに整合性無しを追加
          OK_NG_list.append(False)
      
      # 工数データ無い場合の処理
      else:
        # リストに整合性無しを追加
        OK_NG_list.append(False)

    # 日付リストが空欄の場合
    else:
      # リストに整合性無しを追加
      OK_NG_list.append(False)

  # リストを返す
  return OK_NG_list





#--------------------------------------------------------------------------------------------------------





# インデックスを時間表示に変換
def index_change(start_index, end_index, time_list):
  # 作業時間のインデックスがある場合の処理
  if start_index != 0 or end_index != 0:
    # 作業開始時取得
    start_hour = start_index//12
    # 作業開始分取得
    start_min = (start_index%12)*5
    # 作業終了時取得
    end_hour =end_index//12
    # 作業終了分取得
    end_min = (end_index%12)*5
    # 作業時間のSTR表記作成しリストに追加
    time_list.append('{}:{}～{}:{}'.format(str(start_hour), str(start_min).zfill(2), \
                                           str(end_hour), str(end_min).zfill(2)))
  
  # 作業時間のインデックスがない場合の処理
  else:
    # 空をリストに追加
    time_list.append('　　　　　')

  return time_list





#--------------------------------------------------------------------------------------------------------





# 休憩時間オーバー検出関数
def break_time_over(start_hour, start_min, end_hour, end_min, limit_tome,comment, request):
  # 昼休憩時間に長すぎる時間を登録しようとした時の処理
  if (int(end_hour)*60 + int(end_min)) - \
    (int(start_hour)*60 + int(start_min)) > limit_tome or \
    (((int(end_hour)*60 + int(end_min)) < \
    (int(start_hour)*60 + int(start_min))) and \
    (int(end_hour)*60 + int(end_min) + 1440) - \
    (int(start_hour)*60 + int(start_min)) > limit_tome):
    # エラーメッセージ出力
    messages.error(request, '{}が{}分を超えています。正しい休憩時間を登録して下さい。ERROR032'.format(comment, limit_tome))
    # このページをリダイレクト
    return redirect(to = '/break_time')





#--------------------------------------------------------------------------------------------------------





# 工数表示リスト作成関数
def create_kosu(work_list, detail_list, obj_get, member_obj, request):
  # HTML表示用リスト前準備リスト作成
  def_time, detail_time, time_list_start, time_list_end, kosu_list = create_kosu_basic(work_list, detail_list, obj_get, member_obj, request)

  # HTML表示用リスト作成
  time_display_list = [
    [f"{start}～{end}", def_time[k], detail_time[k]]
    for k, (start, end) in enumerate(zip(time_list_start, time_list_end))
    ]

  return time_display_list





#--------------------------------------------------------------------------------------------------------





# 工数表示リスト準備関数
def create_kosu_basic(work_list, detail_list, obj_get, member_obj, request):
  # 作業時間リストリセット
  kosu_list, time_list_start, time_list_end = [], [], []
  def_time, detail_time, find_list = [], [], []

  # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
  adjustment_dict = {
    ('1', '5'): 234,
    ('2',): 144 if member_obj.shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] else 180,
    ('3',): 42 if member_obj.shop in ['P', 'R', 'T1', 'T2', 'その他', '組長以上(P,R,T,その他)'] else 72,
    ('4',): 216,
    ('6',): 108,
    }

  for i in range(288):
    # 工数変化検知
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
      for keys, adjustment in adjustment_dict.items():
        if obj_get.tyoku2 in keys:
          if i == 287:
            kosu_list.append(i - adjustment + 1 if i >= adjustment else i + (289 - adjustment))
          else:
            kosu_list.append(i - adjustment if i >= adjustment else i + (288 - adjustment))
          break

  # 作業時間インデックスに要素がある場合の処理
  if kosu_list:
    for ind, t in enumerate(kosu_list[:-1]):
      time_list_start.append(f"{str(int(t)//12).zfill(2)}:{str(int(t)%12*5).zfill(2)}")
      time_list_end.append(f"{str(int(kosu_list[ind + 1])//12).zfill(2)}:{str(int(kosu_list[ind + 1])%12*5).zfill(2)}")

  # 業務工数区分辞書作成
  def_library, def_n = kosu_division_dictionary(request.session['input_def'])
  def_library.append(['#', '-'])
  def_library.append(['$', '休憩'])

  # 作業内容と作業詳細リスト作成
  def_time = [k[1] for t in find_list[:-1] for k in def_library if k[0] == work_list[t]]
  detail_time = [detail_list[t] for t in find_list[:-1] for k in def_library if k[0] == work_list[t]]

  return def_time, detail_time, time_list_start, time_list_end, kosu_list





#--------------------------------------------------------------------------------------------------------





# ログイン確認関数
def get_member(request):
  # ログインしていない場合ログイン画面へ
  if not request.session.get('login_No'):
    return redirect('/login')
  
  # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
  try:
    return member.objects.get(employee_no=request.session['login_No'])
  except member.DoesNotExist:
    request.session.clear()
    return redirect('/login')





#--------------------------------------------------------------------------------------------------------





# 工数区分定義のみのリスト取得関数
def get_def_library_data(session_def_name):
  # 工数区分定義辞書もどき作成
  def_library, def_num = kosu_division_dictionary(session_def_name)
  # 工数区分定義のみのリストを返す
  return [sublist[1] for sublist in def_library], def_num





#--------------------------------------------------------------------------------------------------------







# 累積工数計算関数
def accumulate_kosu_data(kosu_total, str_list, def_num):
  # 定義区分数の要素を用意
  graph_list = list(itertools.repeat(0, def_num))
  # 累積工数記録
  for i in kosu_total:
    # 作業内容の工数区分定義ごとの工数算出
    graph_year = [i.time_work.count(m) * 5 for m in str_list]
    # 累積工数を日ごとに加算
    graph_list = [sum(v) for v in zip(graph_year, graph_list)]

  return graph_list





#--------------------------------------------------------------------------------------------------------





# 直,勤務のダブルフォーム使用先指定関数
def double_form(employee_no, work_day, request):
  # 指定日に工数データが既にあるか確認
  obj_filter = Business_Time_graph.objects.filter(employee_no3=employee_no, work_day2=work_day)

  # 指定日に工数データがある場合の処理
  if obj_filter.exists():
    # 工数データ取得
    obj_get = obj_filter.first()
    # 直,勤務入力に変更がある場合変更後のデータを使用、無い場合はデータ内のデータを使用
    if obj_get.tyoku2 != request.POST.get('tyoku') and request.POST.get('tyoku', '') != '':
      tyoku = request.POST.get('tyoku')
    elif obj_get.tyoku2 != request.POST.get('tyoku2') and request.POST.get('tyoku2', '') != '':
      tyoku = request.POST.get('tyoku2')
    elif request.POST.get('tyoku', '') == '' and request.POST.get('tyoku2', '') == '':
      tyoku = ''
    else:
      tyoku = obj_get.tyoku2

    if obj_get.work_time != request.POST.get('work') and request.POST.get('work', '') != '':
      work = request.POST.get('work')
    elif obj_get.work_time != request.POST.get('work2') and request.POST.get('work2', '') != '':
      work = request.POST.get('work2')
    elif request.POST.get('work', '') == '' and request.POST.get('work2', '') == '':
      work = ''
    else:
      work = obj_get.work_time

  # 指定日に工数データがない場合の処理
  else:
    tyoku = request.POST.get('tyoku', '') or request.POST.get('tyoku2', '')
    work = request.POST.get('work', '') or request.POST.get('work2', '')

  return obj_filter, tyoku, work





#--------------------------------------------------------------------------------------------------------





# 休憩書き込み関数
def handle_break_time(break_start, break_end, break_next_day, kosu_def, detail_list, member_obj, request):
  # 日を超えている場合の処理
  if break_next_day == 1:
    # 休憩時間内の工数データを削除
    kosu_def, detail_list = break_time_delete(break_start, 288, kosu_def, detail_list, member_obj, request)
    kosu_def, detail_list = break_time_delete(0, break_end, kosu_def, detail_list, member_obj, request)
    # エラー発生の場合の処理
    if messages.get_messages(request)._queued_messages:
      return None

    # 休憩時間直後の時間に工数入力がある場合の処理
    if kosu_def[int(break_end)] != '#':
      # 休憩時間内の工数データを休憩に書き換え
      kosu_def, detail_list = break_time_write(break_start, 288, kosu_def, detail_list)
      kosu_def, detail_list = break_time_write(0, break_end, kosu_def, detail_list)

  # 日を超えていない場合の処理
  else:
    # 休憩時間内の工数データを削除
    kosu_def, detail_list = break_time_delete(break_start, break_end, kosu_def, detail_list, member_obj, request)
    # エラー発生の場合の処理
    if messages.get_messages(request)._queued_messages:
      return None

    # 休憩時間直後の時間に工数入力がある場合の処理
    if kosu_def[int(break_end)] != '#':
      # 休憩時間内の工数データを休憩に書き換え
      kosu_def, detail_list = break_time_write(break_start, break_end, kosu_def, detail_list)

  return kosu_def, detail_list





#--------------------------------------------------------------------------------------------------------





# フォーム保持削除関数
def session_del(key, request):
  # エラー時保持がセッションにある場合のセッション削除
  if key in request.session:
    del request.session[key]





#--------------------------------------------------------------------------------------------------------





# 休憩時間取得関数
def break_get(tyoku, request):
  # 休憩時間取得
  break_time_obj = member.objects.get(employee_no = request.session['login_No'])

  # 1直の場合の休憩時間取得
  if tyoku == '1' or tyoku == '5':
    breaktime = break_time_obj.break_time1
    breaktime_over1 = break_time_obj.break_time1_over1
    breaktime_over2 = break_time_obj.break_time1_over2
    breaktime_over3 = break_time_obj.break_time1_over3

  # 2直の場合の休憩時間取得
  if tyoku == '2' or tyoku == '6':
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

  return breaktime, breaktime_over1, breaktime_over2, breaktime_over3





#--------------------------------------------------------------------------------------------------------





# 勤務入力フォーム初期値設定関数
def schedule_default(year, month, day_list, request):
  # 勤務フォーム初期値定義
  form_default_list = {}
  for i in range(37):
    if day_list[i] != '':
      day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                      work_day2 = datetime.date(year, month, day_list[i]))
      if day_filter.exists():
        day_get = day_filter.first()
        form_default_list[('day{}'.format(i + 1))] = day_get.work_time
        form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

  return form_default_list





#--------------------------------------------------------------------------------------------------------





# 工数削除関数
def kosu_delete(start_indent, end_indent, work_list, detail_list):
  # 工数削除
  for i in range(start_indent, end_indent):
    work_list[i] = '#'
    detail_list[i] = ''

  return work_list, detail_list





#--------------------------------------------------------------------------------------------------------





# 工数編集エラー検出関数
def kosu_edit_check(start_time, end_time, edit_id, num, edit_comment, page_title, request):
  # 作業時間の指定がない場合、リダイレクト
  if start_time in ('', None) or end_time in ('', None):
    messages.error(request, '時間が入力されていません。ERROR033')
    history_record(page_title, 'Business_Time_graph', 'ERROR033', edit_comment, request)
    return redirect(to = '/detail/{}'.format(num))

  # 作業詳細に'$'が含まれている場合、リダイレクト
  if '$' in request.POST.get('detail_time{}'.format(edit_id)):
    messages.error(request, '作業詳細に『$』は使用できません。工数編集できませんでした。ERROR034')
    history_record(page_title, 'Business_Time_graph', 'ERROR034', edit_comment, request)
    return redirect(to = '/detail/{}'.format(num))

  # 作業詳細に文字数が100文字以上の場合、リダイレクト
  if len(request.POST.get('detail_time{}'.format(edit_id))) >= 100:
    messages.error(request, '作業詳細は100文字以内で入力して下さい。工数編集できませんでした。ERROR035')
    history_record(page_title, 'Business_Time_graph', 'ERROR035', edit_comment, request)
    return redirect(to = '/detail/{}'.format(num))

    # 作業開始時間と終了時間が同じ場合、リダイレクト
  if start_time == end_time:
    messages.error(request, '入力された作業時間が正しくありません。ERROR036')
    history_record(page_title, 'Business_Time_graph', 'ERROR036', edit_comment, request)
    return redirect(to = '/detail/{}'.format(num))





#--------------------------------------------------------------------------------------------------------





# 工数編集関数
def kosu_edit_write(start_time_ind, end_time_ind, work_list, detail_list, edit_id, request):
  # 変更後の作業時間に工数データが入力されていないかチェック
  for k in range(start_time_ind, end_time_ind):
    # 変更後の作業時間に工数データが入力されている場合、リダイレクト
    if work_list[k] != '#':
      if work_list[k] != '$':
        messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR037')
        return None, None

    # 変更後の作業時間に工数データが入力されていない場合の処理
    else:
      # 作業内容、作業詳細書き込み
      work_list[k] = request.POST.get('def_time{}'.format(edit_id))
      detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))

  return work_list, detail_list



#--------------------------------------------------------------------------------------------------------





# 工数入力インデックス取得関数
def get_indices(data_list):
  # インデックスリスト,作業スタートインデックス定義
  indices = []
  start = None

  for t in range(288):
    # 作業の開始を発見したらインデックスを記録
    if data_list[t] != '#' and start is None:
      start = t
    # 作業の終わりを発見したらインデックスリストに作業時間を記録しスタートインデックスリセット
    elif data_list[t] == '#' and start is not None:
      indices.append((start, t))
      start = None
  
  # 作業が24時まで継続していた場合にインデックスリストに記録
  if start is not None:
    indices.append((start, 288))

  return indices





#--------------------------------------------------------------------------------------------------------





# 工数入力時間表示関数
def work_default(day_list, year, month, member_obj, request):
  # 入力工数表示リセット
  time_list = [[] for _ in range(37)]

  # 工数入力データ取得
  for i, tm in enumerate(time_list):
    # 日付リストの該当要素が空でない場合の処理
    if day_list[i] != '':
      # ログイン者の工数データを該当日でフィルター
      graph_data_filter = Business_Time_graph.objects.filter(
        employee_no3=request.session['login_No'],
        work_day2=datetime.date(year, month, day_list[i])
        )

      # 工数データがない場合の処理
      if not graph_data_filter.exists():
        # カレンダー工数表示リストに空の値を入れる
        tm.extend(['　'] * 4)
      else:
        # ログイン者の該当日の工数データ取得
        graph_data_get = graph_data_filter.first()
        # 作業内容リストに解凍
        data_list = list(graph_data_get.time_work)

        # インデックス取得と時間表示に変換
        indices = get_indices(data_list)
        for start, end in indices:
          tm = index_change(start, end, tm)
        # 時間表示を4行に調整
        for _ in range(4 - len(tm)):
          tm.append('　')
  
  # 工数入力OKリスト作成
  OK_NG_list = OK_NF_check(year, month, day_list, member_obj)

  return OK_NG_list, time_list





#--------------------------------------------------------------------------------------------------------










