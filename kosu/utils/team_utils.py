from ..models import member
from ..models import Business_Time_graph
from ..models import kosu_division
import datetime





#--------------------------------------------------------------------------------------------------------





# Excel書き込み関数定義
def excel_function(employee_no_data, wb, request):
  # 人員データ取得
  member_obj = member.objects.get(employee_no = employee_no_data)

  # POSTされた値を日付に設定
  day_data = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')

  # 指定年、月取得
  year = day_data.year
  month = day_data.month

  # GETされた月の最終日取得
  if month == 12:
    month_end = 1
    year_end = year + 1
  else:
    month_end = month + 1
    year_end = year

  select_month = datetime.date(year_end, month_end, 1)
  month_day_end = select_month - datetime.timedelta(days = 1)
  day_end = month_day_end.day

  # 人員データ取得
  member_obj_get = member.objects.get(employee_no = employee_no_data)

  # Excelに班員のシート作成
  member_sheet = wb.create_sheet(title=member_obj.name)

  # シートのタイトル記入
  member_sheet.cell(row=1, column=1, value="{}の{}年{}月の勤務状況".format(member_obj.name, year, month))

  # 工数データ書き込み
  for day in range(1, day_end + 1):
    # 工数データあるか確認
    kosu_obj_filter = Business_Time_graph.objects.filter(employee_no3 = employee_no_data,\
                                                           work_day2 = datetime.date(year, month, day))
      
    # HTML表示用リストリセット
    time_display_list = []
    # 作業内容のリストリセット
    work_list = []
    # 工数区分定義リストリセット
    def_list = []
    # 工数累積リセット          
    graph_list = []
    # 整合性リセット
    integrity = 'NG'
    # 勤務リセット
    work = ''
    # 直リセット
    tyoku =''
    # 残業リセット
    over_time = 0

    # 工数データある場合の処理
    if kosu_obj_filter.count() != 0:
      # 工数データ取得
      kosu_obj_get = Business_Time_graph.objects.get(employee_no3 = employee_no_data,\
                                                     work_day2 = datetime.date(year, month, day))
        
      # 整合性書き換え
      if kosu_obj_get.judgement == True:
        integrity = 'OK'

      # 勤務書き換え
      if kosu_obj_get.work_time not in ('', None):
        work = kosu_obj_get.work_time

      # 直書き換え
      if kosu_obj_get.tyoku2 not in ('', None):
        if kosu_obj_get.tyoku2 == '1':
          tyoku = '1直'
        if kosu_obj_get.tyoku2 == '2':
          tyoku = '2直'
        if kosu_obj_get.tyoku2 == '3':
          tyoku = '3直'
        if kosu_obj_get.tyoku2 == '4':
          tyoku = '常昼'

      # 直書き換え
      if kosu_obj_get.over_time not in ('', None):
        over_time = kosu_obj_get.over_time

      # 工数データに工数区分定義のデータが入っている場合の処理
      if kosu_obj_get.def_ver2 not in ('', None):
        # 作業内容データを文字列からリストに解凍
        work_list = list(kosu_obj_get.time_work)

        # 作業内容のリストを2個連結
        work_list = work_list*2

        # 1直の時の処理
        if kosu_obj_get.tyoku2 == '1':
          # 作業内容のリストを4時半からの表示に変える
          del work_list[:54]
          del work_list[288:]

        # 2直の時の処理(班員のショップがP,R,T1,T2,その他)
        elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
              member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '2':
          # 作業内容のリストを12時からの表示に変える
          del work_list[:144]
          del work_list[288:]

        # 2直の時の処理(班員のショップがW1,W2,A1,A2)
        elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
              and kosu_obj_get.tyoku2 == '2':
          # 作業内容のリストを9時からの表示に変える
          del work_list[:108]
          del work_list[288:]

        # 3直の時の処理(班員のショップがP,R,T1,T2,その他)
        elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
              member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '3':
          # 作業内容のリストを20時半からの表示に変える
          del work_list[:246]
          del work_list[288:]

        # 3直の時の処理(班員のショップがW1,W2,A1,A2)
        elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
              and kosu_obj_get.tyoku2 == '3':
          # 作業内容のリストを18時からの表示に変える
          del work_list[:216]
          del work_list[288:]

        # 常昼の時の処理
        elif kosu_obj_get.tyoku2 == '4':
          # 作業内容のリストを6時からの表示に変える
          del work_list[:72]
          del work_list[288:]

        # 直入力ない時の処理
        else:
          del work_list[288:]


        # 作業時間リストリセット
        kosu_list = []
        time_list_start = []
        time_list_end = []
        def_time = []
        find_list =[]

        # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
        for i in range(288):
          # 最初の要素に作業が入っている場合の処理
          if i == 0 and work_list[i] != '#':
            # 検索用リストにインデックス記憶
            find_list.append(i)

            if kosu_obj_get.tyoku2 == '1':
              kosu_list.append(i + 54)

            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '2':
              # 作業時間インデックスに作業時間のインデックス記録
              kosu_list.append(i + 144)

            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '2':
              # 作業時間インデックスに作業時間のインデックス記録
              kosu_list.append(i + 108)

            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '3':
              # 作業時間インデックスに作業時間のインデックス記録
              kosu_list.append(i + 246)

            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '3':
              # 作業時間インデックスに作業時間のインデックス記録
              kosu_list.append(i + 216)

            elif kosu_obj_get.tyoku2 == '4':
              # 作業時間インデックスに作業時間のインデックス記録
              kosu_list.append(i + 72)

          # 時間区分毎に前の作業との差異がある場合の処理
          if i != 0 and work_list[i] != work_list[i - 1]:
            # 検索用リストにインデックス記憶
            find_list.append(i)

            if kosu_obj_get.tyoku2 == '1':
              if i >= 234:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 234)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 54)

            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '2':
              if i >= 144:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 144)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 144)

            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '2':
              if i >= 180:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 180)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 108)
        
            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '3':
              if i >= 42:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 42)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 246)
            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '3':
              if i >= 72:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 72)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 216)

            elif kosu_obj_get.tyoku2 == '4':
              if i >= 216:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 216)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 72)

          # 最後の要素に作業が入っている場合の処理
          if i == 287 and work_list[i] != '#':
            # 検索用リストにインデックス記憶
            find_list.append(i)

            if kosu_obj_get.tyoku2 == '1':
              if i >= 234:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 233)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 55)

            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '2':
              if i >= 144:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 143)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 145)

            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '2':
              if i >= 180:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 179)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 109)

            elif (member_obj_get.shop == 'P' or member_obj_get.shop == 'R' or member_obj_get.shop == 'T1' or member_obj_get.shop == 'T2' or \
                member_obj_get.shop == 'その他' or member_obj_get.shop == '組長以上(P,R,T,その他)') and kosu_obj_get.tyoku2 == '3':
              if i >= 42:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 41)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 247)

            elif (member_obj_get.shop == 'W1' or member_obj_get.shop == 'W2' or member_obj_get.shop == 'A1' or member_obj_get.shop == 'A2' or member_obj_get.shop == '組長以上(W,A)') \
                  and kosu_obj_get.tyoku2 == '3':
              if i >= 72:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 71)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 217)

            elif kosu_obj_get.tyoku2 == '4':
              if i >= 216:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i - 215)

              else:
                # 作業時間インデックスに作業時間のインデックス記録
                kosu_list.append(i + 73)


        # 作業時間インデックスに要素がある場合の処理
        if len(kosu_list) != 0:
          # 作業時間インデックスを時間表示に修正
          for ind, t in enumerate(kosu_list):
            # 最後以外のループ処理
            if len(kosu_list) - 1 != ind:
              # 作業開始時間をSTRで定義
              time_obj_start = str(int(t)//12).zfill(2) + ':' + str(int(t)%12*5).zfill(2)
              # 作業終了時間をSTRで定義
              time_obj_end = str(int(kosu_list[ind + 1])//12).zfill(2) + ':' \
                + str(int(kosu_list[ind + 1])%12*5).zfill(2)

              # 作業開始時間と作業終了時間をリストに追加
              time_list_start.append(time_obj_start)
              time_list_end.append(time_obj_end)


        # 現在使用している工数区分のオブジェクトを取得
        def_obj = kosu_division.objects.get(kosu_name = kosu_obj_get.def_ver2)

        # 工数区分登録カウンターリセット
        def_n = 0

        # 工数区分登録数カウント
        for kosu_num in range(1, 50):
          if eval('def_obj.kosu_title_{}'.format(kosu_num)) not in ('', None):
            def_n = kosu_num

        
        # 工数区分処理用記号リスト用意
        str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                        'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

        # リストの長さを工数区分の登録数に応じて調整
        del str_list[def_n : ]
          
        # 工数区分の選択リスト作成
        for i, m in enumerate(str_list):
          # 工数区分定義要素を追加
          def_list.append(eval('def_obj.kosu_title_{}'.format(i + 1)))


        # 作業なし追加
        def_list.append('-')
        # 休憩追加
        def_list.append('休憩')


        # 作業無し記号追加
        str_list.append('#')
        # 休憩記号追加
        str_list.append('$')

        # 工数区分辞書作成
        def_library = dict(zip(str_list, def_list))

        # 作業内容と作業詳細リスト作成
        for ind, t in enumerate(find_list):
          # 最後以外のループ処理
          if len(find_list) - 1 != ind:
            def_time.append(def_library[work_list[t]])


        # HTML表示用リスト作成
        for k in range(len(time_list_start)):
          for_list = []
          for_list.append(str(time_list_start[k]) + '～' + str(time_list_end[k]))
          for_list.append(def_time[k])
          time_display_list.append(for_list)


        # 各工数区分定義の累積工数リスト作成
        str_n = 0
        for i in str_list[:-2]:
          str_n = kosu_obj_get.time_work.count(i)*5
          graph_list.append(str_n)
          str_n = 0

    # 日付入力
    member_sheet.cell(row=2, column=day*2 - 1, value='{}日'.format(day))

    # 整合性出力
    member_sheet.cell(row=2, column=day*2, value=integrity)

    # 勤務出力
    member_sheet.cell(row=3, column=day*2 - 1, value=work)

    # 直出力
    member_sheet.cell(row=3, column=day*2, value=tyoku)

    # 残業出力
    member_sheet.cell(row=4, column=day*2 - 1, value='残業')
    member_sheet.cell(row=4, column=day*2, value=over_time)

    # 工数累積内容出力
    for i, row_num in enumerate(def_list[:-2]):
      # 工数区分定義名称出力
      member_sheet.cell(row=6 + i, column=day*2 - 1, value=row_num)
      # 工数累積出力
      member_sheet.cell(row=6 + i, column=day*2, value=graph_list[i])

    # 時間出力
    for i2, item in enumerate(time_display_list):
      # 作業時間出力
      member_sheet.cell(row=8 + i + i2, column=day*2 - 1, value=item[0])
      # 作業内容出力
      member_sheet.cell(row=8 + i + i2, column=day*2, value=item[1])


  return time_display_list





#--------------------------------------------------------------------------------------------------------





# 班員情報取得関数
def team_member_name_get(member_no):

  # 班員の従業員番号が空でない場合の処理
  if member_no != '':
    # 従業員番号の人員がいるか確認
    member_obj_filter = member.objects.filter(employee_no__contains = member_no)

    # 従業員番号の人員がいる場合の処理
    if member_obj_filter.count() == 1:
      # 班員の人員情報取得
      member_obj_get = obj_filter.first()

    # 班員の従業員番号の人員がいない場合の処理
    else:
      # 班員情報に空を入れる
      member_obj_get = ''

  # 従業員番号が空の場合の処理
  else:
    # 班員情報に空を入れる
    member_obj_get = ''

  return member_obj_get
