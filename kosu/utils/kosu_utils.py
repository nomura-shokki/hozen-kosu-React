from ..models import member, kosu_division
import datetime
import calendar


#OK
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



#OK
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



#OK
# 工数書き込み関数
def kosu_write(start_ind, end_ind, kosu_def, detail_list, post_data):
  # 作業内容と作業詳細を書き込むループ
  for kosu in range(start_ind, end_ind):
    # 作業内容リストに入力された工数定義区分の対応する記号を入れる
    kosu_def[kosu] = post_data.get('time_work')
    # 作業詳細リストに入力した作業詳細を入れる
    detail_list[kosu] = post_data.get('detail_work')

  return kosu_def, detail_list



#OK
# 休憩範囲工数削除関数
def break_time_delete(break_start_ind, break_end_ind, work_list, detail_list, member_obj):
  # 休憩時間ループ
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # ユーザーが休憩エラー有効チェックONの場合の処理
    if member_obj.break_check == True:
      # 作業内容リストが空でない場合の処理
      if work_list[bt] != '#':
        # 作業内容リストが休憩でない場合の処理
        if work_list[bt] != '$':
          return '休憩時間に工数を入力できません。休憩変更するor休憩エラー無効で入力できます。', None, None

    # ユーザーが休憩エラー有効チェックOFFの場合の処理   
    else:
      # 作業内容リストの要素を空にする
      work_list[bt] = '#'
      # 作業詳細リストの要素を空にする
      detail_list[bt] = ''

  return None, work_list, detail_list



#OK
# 休憩書き込み関数
def break_time_write(break_start_ind, break_end_ind, kosu_def, detail_list):
  # 休憩時間内の工数データを休憩に書き換えるループ
  for bt in range(int(break_start_ind), int(break_end_ind)):
    # 作業内容リストの要素を休憩に書き換え
    kosu_def[bt] = '$'
    detail_list[bt] = ''

  return kosu_def, detail_list



#OK
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



#OK
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
  if work == '休出' and kosu_total == int(over_work) and int(over_work) != 0:
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
    kosu_total == 0 and int(over_work) == 0:
    # 工数入力OK_NGをOKに切り替え
    judgement = True

  return judgement



#OK
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



#OK
# 休憩時間取得関数
def break_get(tyoku, login_no):
  # 休憩時間取得
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



#OK
def parse_break_time(break_time_start, break_time_end, jst):
  # 引数チェック: Noneや空文字列の場合
  if not break_time_start or not break_time_end:
    raise ValueError("未入力箇所があります")

  try:
    start_time = datetime.datetime.strptime(break_time_start, "%Y-%m-%dT%H:%M:%S.%fZ")
    end_time = datetime.datetime.strptime(break_time_end, "%Y-%m-%dT%H:%M:%S.%fZ")
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
    time_str = '#' + start_time[0:2] + start_time[3:5] + end_time[0:2] + end_time[3:5]
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour) * 12 + int(start_time_min) / 5)
    end_time_ind = int(int(end_time_hour) * 12 + int(end_time_min) / 5)
  except ValueError:
    raise ValueError("入力値の形式が不正です")

  return start_time_ind, end_time_ind, time_str



#OK
# 月週取得
def get_week_of_month(target_date):
  year = target_date.year
  month = target_date.month
  day = target_date.day

  # 日曜始まりのカレンダーを取得
  cal = calendar.Calendar(firstweekday=6)

  # 月の週ごとの日付リストを取得
  month_days = cal.monthdayscalendar(year, month)

  # 週番号を探す
  for week_index, week in enumerate(month_days):
    if day in week:
      return week_index + 1


#OK
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



#OK
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



#OK
# 工数区分定義辞書作成関数
def kosu_division_dictionary(def_name):
    # 現在使用している工数区分のオブジェクトを取得
    kosu_obj = kosu_division.objects.get(kosu_name=def_name)

    # 工数区分登録カウンターリセット
    n = 0
    # 工数区分登録数カウント
    for kosu_num in range(1, 51):
      val = getattr(kosu_obj, f'kosu_title_{kosu_num}')
      if val not in [None, '']:
        n = kosu_num

    # 工数区分処理用記号リスト用意
    str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:n]

    # 工数区分の選択リスト作成
    choices_list = []
    for i, m in enumerate(str_list):
      title_val = getattr(kosu_obj, f'kosu_title_{i + 1}')
      choices_list.append([m, title_val])

    return choices_list, n



#OK
# 工数区分定義のみのリスト取得関数
def get_def_library_data(session_def_name):
  # 工数区分定義辞書もどき作成
  def_library, def_num = kosu_division_dictionary(session_def_name)
  # 工数区分定義のみのリストを返す
  return [sublist[1] for sublist in def_library], def_num


