from django.shortcuts import render
from django.shortcuts import redirect
from django.contrib import messages
from django.core.paginator import Paginator
import datetime
import itertools
from ..utils import round_time
from django.db.models import Q
from ..models import member
from ..models import Business_Time_graph
from ..models import kosu_division
from ..models import administrator_data
from ..forms import input_kosuForm
from ..forms import kosu_dayForm
from ..forms import team_kosuForm
from ..forms import schedule_timeForm
from ..forms import scheduleForm
from ..forms import all_kosu_findForm
from ..forms import all_kosuForm





#--------------------------------------------------------------------------------------------------------





# 工数履歴画面定義
def kosu_list(request, num):

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')
  

  # 今日の日時取得
  kosu_today = datetime.date.today()

  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # 全データ確認表示変数
  if request.session['login_No'] in (page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3):
    display_open = True
  else:
    display_open = False



  # 日付指定検索時の処理
  if "kosu_find" in request.POST:

    # 指定日セッションに登録
    request.session['find_day'] = request.POST['kosu_day']
    # 指定月のセッション削除
    if 'kosu_month' in request.session:
      del request.session['kosu_month']

    # 就業日とログイン者の従業員番号でフィルターをかけて一致した工数データを取得
    obj_filter = Business_Time_graph.objects.filter(work_day2__contains = request.POST['kosu_day'], \
                                                    employee_no3 = request.session['login_No']).\
                                                    order_by('work_day2').reverse()
    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj_filter, page_num.menu_row)



  # 月指定検索時の処理
  if "kosu_find_month" in request.POST:

    # POST送信された就業日を変数に入れる
    post_day = request.POST['kosu_day']
    # POST送信された就業日の年、月部分抜き出し
    kosu_month = post_day[: 7]
    # 指定月セッションに登録
    request.session['kosu_month'] = kosu_month
    # 指定日セッションに登録
    request.session['find_day'] = request.POST['kosu_day']

    # 指定月の工数取得
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2__startswith = request.session['kosu_month']).\
                                                    order_by('work_day2').reverse()
    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj_filter, page_num.menu_row)



  # GET時の処理
  if (request.method == 'GET'):

    # 指定月のセッションある場合の処理
    if 'kosu_month' in request.session:
      # ログイン者の従業員番号でフィルターをかけて一致した工数データを取得
      obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                      work_day2__startswith = request.session.get('kosu_month', '')).\
                                                      order_by('work_day2').reverse()
      
    # 指定月のセッションない場合の処理
    else:
      # ログイン者の従業員番号でフィルターをかけて一致した工数データを取得
      obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                      work_day2__startswith = request.session.get('find_day', '')).\
                                                      order_by('work_day2').reverse()

    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj_filter, page_num.menu_row)



  # セッションに検索履歴がある場合の処理
  if request.session.get('find_day', '') != '':
    # フォームの初期値に検索履歴を入れる
    default_day = request.session['find_day']

  # セッションに検索履歴がない場合の処理
  else:
    # フォームの初期値に今日の日付を入れる
    default_day = str(kosu_today)



  # HTMLに渡す辞書
  context = {
    'title' : '工数履歴',
    'member_data' : member_data,
    'data' : data.get_page(num),
    'default_day' : default_day,
    'display_open' : display_open,
    'num' : num,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/kosu_list.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数入力画面定義
def input(request):

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    member_obj = member.objects.get(employee_no = request.session['login_No'])
  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # 今日の日時を変数に格納
  kosu_today = datetime.date.today()

  # セッションに就業日の履歴がない場合の処理
  if request.session.get('day', None) == None:
    # フォームの初期値に今日の日付を入れる
    new_work_day = kosu_today

  # セッションに就業日の履歴がある場合の処理
  else:
    # フォームの初期値に就業日の履歴を入れる
    new_work_day = request.session['day']



  # GET時の処理
  if (request.method == 'GET'):
    # グラフデータ確認用データ取得
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None),\
                                                    work_day2 = new_work_day)

    # グラフラベルデータリセット
    graph_item = []

    # 0:00から23:55までの5分毎のリスト作成(グラフラベル用)
    for i in range(24):
        for n in range(0, 60, 5):
            t = n
            if n == 0:
              t = '00'
            if n == 5:
              t = '05'
            graph_item.append('{}:{}'.format(i, t))


    # 選択されている就業日のグラフデータがない場合の処理
    if obj_filter.count() == 0:
      # 0を288個入れたリスト作成
      graph_list = list(itertools.repeat(0, 288))

    # 選択されている就業日のグラフデータがある場合の処理
    else:
      # グラフデータを取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None),\
                                                  work_day2 = new_work_day)

      # 取得したグラフデータを文字型からリストに解凍
      graph_list = list(obj_get.time_work)

      # グラフデータリスト内の各文字を定義
      str_list = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                          'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

      # グラフデータリスト内の各文字を数字に変更
      for i in range(288):
        for n, m in enumerate(str_list):
          if graph_list[i]  == m:
            graph_list[i] = n
            break


      # 作業内容が空でない場合の処理
      if graph_list != list(itertools.repeat(0, 288)):
        # 入力直が3直でない場合の処理
        if obj_get.tyoku2 != '3':
          # 工数が入力され始めのインデント取得ループ
          for i in range(288):
            # 工数入力データが空でない時の処理
            if graph_list[i] != 0:
              # 最初のループである場合の処理
              if i == 0:
                # 工数が入力され始めのインデントで0を取得
                graph_start_index = i
              # 最初のループ以外の処理
              else:
                # 工数が入力され始めのインデントで最後の空データのインデント取得
                graph_start_index = i - 1
              # ループから抜ける
              break


          # 工数が入力され終わりのインデント取得ループ
          for i in range(1, 289):
            # 工数入力データが空でない場合の処理(後ろから順に)
            if graph_list[-i] != 0:
              # 最初のループの場合の処理
              if i == 1:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 289 - i
              # 最初のループ以外の場合の処理
              else:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 290 - i
              # ループから抜ける
              break


          # 入力直が1直の場合の処理
          if obj_get.tyoku2 == '1':
            # 工数が入力され終わりのインデントが184以下である場合の処理(工数入力が15:20以前の場合)
            if graph_end_index <= 184:
              # 工数が入力され終わりのインデントを184にする(15:20の定時まで表示)
              graph_end_index = 184

          # 入力直が2直の場合の処理でログイン者のショップがボデーか組立の場合の処理
          if obj_get.tyoku2 == '2' and (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
                                          member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
                                            member_obj.shop == '組長以上(W,A)'):
            # 工数が入力され終わりのインデントが240以下である場合の処理(工数入力が20:00以前の場合)
            if graph_end_index <= 240:
              # 工数が入力され終わりのインデントを240にする(20:00の定時まで表示)
              graph_end_index = 240

          # 入力直が2直の場合の処理でログイン者のショップがプレス、成形、塗装の場合の処理
          if obj_get.tyoku2 == '2' and (member_obj.shop == 'P' or member_obj.shop == 'R' or \
                                          member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
                                          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
            # 工数が入力され終わりのインデントが270以下である場合の処理(工数入力が22:30以前の場合)
            if graph_end_index <= 270:
              # 工数が入力され終わりのインデントを270にする(22:30の定時まで表示)
              graph_end_index = 270

          # 入力直が常昼の場合の処理
          if obj_get.tyoku2 == '4':
            # 工数が入力され終わりのインデントが204以下である場合の処理(工数入力が17:00以前の場合)
            if graph_end_index <= 204:
              # 工数が入力され終わりのインデントを204にする(17:00の定時まで表示)
              graph_end_index = 204

          # グラフ表示のリストを工数データが空の部分を削除する
          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]

        # 入力直が3直の場合の処理
        else:
          # グラフ表示のリストを2回繰り返す
          graph_list = graph_list*2
          graph_item = graph_item*2

          # 17時～のグラフ表示に変更
          del graph_list[:204]
          del graph_list[288:]
          del graph_item[:204]
          del graph_item[288:]

          # 工数が入力され始めのインデント取得ループ
          for i in range(288):
            # 工数入力データが空でない時の処理
            if graph_list[i] != 0:
              # 最初のループの場合の処理
              if i == 0:
                # 工数が入力され始めのインデントで0を取得
                graph_start_index = i

              # 最初のループ以外の場合の処理
              else:
                # 工数が入力され始めのインデントで最後の空データのインデント取得
                graph_start_index = i - 1
                # ループから抜ける
                break


          # 工数が入力され終わりのインデント取得ループ
          for i in range(1, 289):
            # 工数入力データが空でない場合の処理(後ろから順に)
            if graph_list[-i] != 0:
              # 最初のループの場合の処理
              if i == 1:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 289 - i

              # 最初のループ以外の処理
              else:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 290 - i
                break


          # ログイン者のショップがボデーか組立の場合の処理
          if member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2':
            # 工数が入力され終わりのインデントが140以下である場合の処理(工数入力が4:40以前の場合)
            if graph_end_index <= 140:
              # 工数が入力され終わりのインデントを140にする(4:40の定時まで表示)
              graph_end_index = 140

          # ログイン者のショップがボデーか組立以外の場合の処理
          else:
            # 工数が入力され終わりのインデントが169以下である場合の処理(工数入力が7:05以前の場合)
            if graph_end_index <= 169:
              # 工数が入力され終わりのインデントを169にする(7:05の定時まで表示)
              graph_end_index = 169


          # グラフ表示のリストを工数データが空の部分を削除する
          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]



  # グラフ更新時の処理
  if "update" in request.POST:

    # 2つのフォームで入力のあった直を変数に入れる
    if request.POST['tyoku'] != '':
      tyoku = request.POST['tyoku']
    elif request.POST['tyoku2'] != '':
      tyoku = request.POST['tyoku2']
    else:
      tyoku = ''


    # POSTされた直をセッションに保存
    request.session['tyoku'] = tyoku


    # 1直がPOSTされた場合の処理
    if tyoku == '1':
      # 作業終了時のセッションに06を定数として入れ直す
      request.session['end_hour'] = '06'
      # 作業終了分のセッションに30を定数として入れ直す
      request.session['end_min'] = '30'

    # 2直がPOSTされてログイン者のショップがボデーか組立の場合の処理
    elif tyoku == '2' and (member_obj.shop == 'W1' or \
       member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)'):
      # 作業終了時のセッションに11を定数として入れ直す
      request.session['end_hour'] = '11'
      # 作業終了分のセッションに10を定数として入れ直す
      request.session['end_min'] = '10'

    # 2直がPOSTされてログイン者のショップがプレス、成形、塗装の場合の処理
    elif tyoku == '2' and (member_obj.shop == 'P' or \
       member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
       member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
      # 作業終了時のセッションに13を定数として入れ直す
      request.session['end_hour'] = '13'
      # 作業終了分のセッションに40を定数として入れ直す
      request.session['end_min'] = '40'

    # 3直がPOSTされてログイン者のショップがボデーか組立の場合の処理
    elif tyoku == '3' and (member_obj.shop == 'W1' or \
       member_obj.shop == 'W2' or member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)'):
      # 作業終了時のセッションに19を定数として入れ直す
      request.session['end_hour'] = '19'
      # 作業終了分のセッションに50を定数として入れ直す
      request.session['end_min'] = '50'

    # 3直がPOSTされてログイン者のショップがプレス、成形、塗装、その他の場合の処理
    elif tyoku == '3' and (member_obj.shop == 'P' or \
       member_obj.shop == 'R' or member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
       member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
      # 作業終了時のセッションに22を定数として入れ直す
      request.session['end_hour'] = '22'
      # 作業終了分のセッションに10を定数として入れ直す
      request.session['end_min'] = '10'

    # 常昼がPOSTされた場合の処理
    elif tyoku == '4':
      # 作業終了時のセッションに08を定数として入れ直す
      request.session['end_hour'] = '08'
      # 作業終了分のセッションに00を定数として入れ直す
      request.session['end_min'] = '00'


    # 更新された就業日をセッションに登録
    request.session['day'] = request.POST['work_day']

    # 更新された就業日を変数に入れる
    new_work_day = request.session.get('day', None)

    # グラフデータ確認用データ取得
    data_count = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None),\
                                                    work_day2 = new_work_day)

    # グラフラベルデータリセット
    graph_item = []

    # グラフラベルデータ作成ループ(時)
    for i in range(24):
      # グラフラベルデータ作成ループ(分)
      for n in range(0, 60, 5):
        # ループデータ取得
        t = n
        # ループデータ0の場合の処理
        if n == 0:
          # 2桁表示のstr型で定義
          t = '00'

        # ループデータ5の場合の処理
        if n == 5:
          # 2桁表示のstr型で定義
          t = '05'

        # グラフラベルデータリストに時間を順番に追加
        graph_item.append('{}:{}'.format(i, t))


    # 選択されている就業日のグラフデータがない場合の処理
    if data_count.count() == 0:
      # 0を288個入れたリスト作成
      graph_list = list(itertools.repeat(0, 288))

    # 選択されている就業日のグラフデータがある場合の処理
    else:
      # グラフデータを取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None),\
                                                  work_day2 = new_work_day)
      # 取得したグラフデータをリストに解凍
      graph_list = list(obj_get.time_work)

      # グラフデータリスト内の各文字を数値に変更
      str_list = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                          'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

      # グラフデータリスト内の各文字を数字に変更
      for i in range(288):
        for n, m in enumerate(str_list):
          if graph_list[i]  == m:
            graph_list[i] = n
            break


      # 作業内容が空でない場合の処理
      if obj_get.time_work != '#'*288:
        # 入力直が3直でない場合の処理
        if obj_get.tyoku2 != '3':
          # 工数が入力され始めのインデント取得ループ
          for i in range(288):
            # 工数入力データが空でない時の処理
            if graph_list[i] != 0:

              # 最初のループである場合の処理
              if i == 0:
                # 工数が入力され始めのインデントで0を取得
                graph_start_index = i

              # 最初のループ以外の処理
              else:
                # 工数が入力され始めのインデントで最後の空データのインデント取得
                graph_start_index = i - 1
              # ループから抜ける
              break


          # 工数が入力され終わりのインデント取得ループ
          for i in range(1, 289):
            # 工数入力データが空でない場合の処理(後ろから順に)
            if graph_list[-i] != 0:

              # 最初のループである場合の処理
              if i == 1:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 289 - i

              # 最初のループ以外の処理
              else:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 290 - i
              # ループから抜ける
              break

  
          # 入力直が1直の場合の処理
          if obj_get.tyoku2 == '1':
            # 工数が入力され終わりのインデントが184以下である場合の処理(工数入力が15:20以前の場合)
            if graph_end_index <= 184:
              # 工数が入力され終わりのインデントを184にする(15:20の定時まで表示)
              graph_end_index = 184

          # 入力直が2直でログイン者のショップがボデーか組立の場合の処理
          if obj_get.tyoku2 == '2' and (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
                                          member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
                                            member_obj.shop == '組長以上(W,A)'):
            # 工数が入力され終わりのインデントが240以下である場合の処理(工数入力が20:00以前の場合)
            if graph_end_index <= 240:
              # 工数が入力され終わりのインデントを240にする(20:00の定時まで表示)
              graph_end_index = 240

          # 入力直が2直でログイン者のショップがプレス、成形、塗装の場合の処理
          if obj_get.tyoku2 == '2' and (member_obj.shop == 'P' or member_obj.shop == 'R' or \
                                          member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
                                          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
            # 工数が入力され終わりのインデントが270以下である場合の処理(工数入力が22:30以前の場合)
            if graph_end_index <= 270:
              # 工数が入力され終わりのインデントを270にする(22:30の定時まで表示)
              graph_end_index = 270
  
          # 入力直が常昼の場合の処理
          if obj_get.tyoku2 == '4':
            # 工数が入力され終わりのインデントが204以下である場合の処理(工数入力が17:00以前の場合)
            if graph_end_index <= 204:
              # 工数が入力され終わりのインデントを204にする(17:00の定時まで表示)
              graph_end_index = 204

          # グラフ表示のリストを工数データが空の部分を削除する
          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]

        # 入力直が3直の場合の処理
        else:
          # グラフ表示のリストを2回繰り返す
          graph_list = graph_list*2
          graph_item = graph_item*2

          # 17時～のグラフ表示に変更
          del graph_list[:204]
          del graph_list[288:]
          del graph_item[:204]
          del graph_item[288:]

          # 工数が入力され始めのインデント取得ループ
          for i in range(288):
            # 工数入力データが空でない時の処理
            if graph_list[i] != 0:
              # 最初のループである場合の処理
              if i == 0:
                # 工数が入力され始めのインデントで0を取得
                graph_start_index = i

              # 最初のループ以外の処理
              else:
                # 工数が入力され始めのインデントで最後の空データのインデント取得
                graph_start_index = i - 1
                # ループを抜ける
                break


          # 工数が入力され終わりのインデント取得ループ
          for i in range(1, 289):
            # 工数入力データが空でない場合の処理(後ろから順に)
            if graph_list[-i] != 0:
              # 最初のループである場合の処理
              if i == 1:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 289 - i

              # 最初のループでない場合の処理
              else:
                # 工数が入力され終わりのインデント取得
                graph_end_index = 290 - i
                # ループから抜ける
                break


          # ログイン者のショップがボデーか組立の場合の処理
          if member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2':
            # 工数が入力され終わりのインデントが140以下である場合の処理(工数入力が4:40以前の場合)
            if graph_end_index <= 140:
              # 工数が入力され終わりのインデントを140にする(4:40の定時まで表示)
              graph_end_index = 140
  
          # ログイン者のショップがボデーか組立以外の場合の処理
          else:
            # 工数が入力され終わりのインデントが169以下である場合の処理(工数入力が7:05以前の場合)
            if graph_end_index <= 169:
              # 工数が入力され終わりのインデントを169にする(7:05の定時まで表示)
              graph_end_index = 169

          # グラフ表示のリストを工数データが空の部分を削除する
          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]



  # 工数登録時の処理
  if "Registration" in request.POST:
    # それぞれPOSTされた値を変数に入れる(従業員番号のみセッション値)
    work_day = request.POST['work_day']
    start_time = request.POST['start_time']
    end_time = request.POST['end_time']
    def_work = request.POST['kosu_def_list']
    detail_work = request.POST['work_detail']

    # 指定日に工数データが既にあるか確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2 = work_day)

    # 指定日に工数データがある場合の処理
    if obj_filter.count() != 0:
      # 工数データ取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                work_day2 = work_day)

      # 直入力に変更がある場合変更後のデータを使用、無い場合はデータ内のデータを使用
      if obj_get.tyoku2 != request.POST['tyoku'] and request.POST['tyoku'] not in (None, ''):
        tyoku = request.POST['tyoku']
      elif obj_get.tyoku2 != request.POST['tyoku2'] and request.POST['tyoku2'] not in (None, ''):
        tyoku = request.POST['tyoku2']
      else:
        tyoku = obj_get.tyoku2

      # 勤務入力に変更がある場合変更後のデータを使用、無い場合はデータ内のデータを使用
      if obj_get.work_time != request.POST['work'] and request.POST['work'] not in (None, ''):
        work = request.POST['work']
      elif obj_get.work_time != request.POST['work2'] and request.POST['work2'] not in (None, ''):
        work = request.POST['work2']
      else:
        work = obj_get.work_time

    # 指定日に工数データがない場合の処理
    else:
      # 2つのフォームで入力のあった直を変数に入れる
      if request.POST['tyoku'] not in (None, ''):
        tyoku = request.POST['tyoku']
      elif request.POST['tyoku2'] not in (None, '') != '':
        tyoku = request.POST['tyoku2']
      else:
        tyoku = ''

      # 2つのフォームで入力のあった勤務を変数に入れる
      if request.POST['work'] != '':
        work = request.POST['work']
      elif request.POST['work2'] != '':
        work = request.POST['work2']
      else:
        work = ''

    # 直初期値設定(エラー保持)
    request.session['error_tyoku'] = tyoku
    # 勤務初期値設定(エラー保持)
    request.session['error_work'] = work
    # 工数区分定義初期値設定(エラー保持)
    request.session['error_def'] = def_work
    # 作業詳細初期値設定(エラー保持)
    request.session['error_detail'] = detail_work
    # 残業初期値設定(エラー保持)
    request.session['error_over_work'] = request.POST['over_work']
    # 作業開始時間保持(エラー保持)
    request.session['start_time'] = start_time
    # 作業終了時間保持(エラー保持)
    request.session['end_time'] = end_time
    

    # 翌日チェック状態リセット
    check = 0

    # 翌日チェックが入っている場合の処理
    if ('tomorrow_check' in request.POST):
      # 翌日チェック状態に1を入れる
      check = 1

    # 翌日チェックが入っていない場合の処理
    else:
      # 翌日チェック状態に0を入れる
      check = 0

    # 休憩変更チェック状態リセット
    break_change = 0

    # 休憩変更チェックが入っている場合の処理
    if ('break_change' in request.POST):
      # 休憩変更チェック状態に1を入れる
      break_change = 1

    # 休憩変更チェックが入っていない場合の処理
    else:
      # 休憩変更チェック状態に0を入れる
      break_change = 0


    # 直、工数区分、勤務、残業のいずれかが空欄の場合の処理
    if (def_work in (None, '')) or (work in (None, '')) or (tyoku in (None, '')) or \
      (start_time in (None, '')) or (end_time in (None, '')) or (request.POST['over_work'] in (None, '')):
      # エラーメッセージ出力
      messages.error(request, '直、工数区分、勤務、残業、作業時間のいずれかが未入力です。工数登録できませんでした。ERROR060')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 作業詳細に'$'が含まれている場合の処理
    if '$' in detail_work:
      # エラーメッセージ出力
      messages.error(request, '作業詳細に『$』は使用できません。工数登録できませんでした。ERROR026')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 作業詳細に文字数が100文字以上の場合の処理
    if len(detail_work) >= 100:
      # エラーメッセージ出力
      messages.error(request, '作業詳細は100文字以内で入力して下さい。工数登録できませんでした。ERROR059')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 残業時間が15の倍数でない場合の処理
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      # エラーメッセージ出力
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR058')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 作業開始時間と作業終了時間が同じ場合の処理
    if start_time == end_time:
      # エラーメッセージ出力
      messages.error(request, '作業時間が誤っています。確認して下さい。ERROR003')
      # このページをリダイレクト
      return redirect(to = '/input')

    
    # 作業開始時間の区切りのインデックス取得
    start_time_index = start_time.index(':')
    # 作業開始時取得
    start_time_hour = start_time[ : start_time_index]
    # 作業開始分取得
    start_time_min = start_time[start_time_index + 1 : ]
    # 作業終了時間の区切りのインデックス取得
    end_time_index = end_time.index(':')
    # 作業終了時取得
    end_time_hour = end_time[ : end_time_index]
    # 作業終了分取得
    end_time_min = end_time[end_time_index + 1 : ]

    # 作業開始時間のインデント取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    # 作業終了時間のインデント取得
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 作業開始時間が作業終了時間より遅い場合の処理
    if start_time_ind > end_time_ind and check == 0:
      # エラーメッセージ出力
      messages.error(request, '作業開始時間が終了時間を越えています。翌日チェックを忘れていませんか？ERROR004')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 1日以上の工数が入力された場合の処理
    if start_time_ind <= end_time_ind and check == 1:
      # エラーメッセージ出力
      messages.error(request, '1日以上の工数は入力できません。誤って翌日チェックを入れていませんか？ERROR097')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 入力時間が21時間を超える場合の処理
    if ((end_time_ind + 36) >= start_time_ind and check == 1) or ((end_time_ind - 252) >= start_time_ind and check == 0):
      # エラーメッセージ出力
      messages.error(request, '作業時間が21時間を超えています。入力できません。ERROR098')
      # このページをリダイレクト
      return redirect(to = '/input')


    # 指定日に工数データがある場合の処理
    if obj_filter.count() != 0:
      # 工数データ取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                work_day2 = work_day)
      # 作業内容データを文字列からリストに解凍
      kosu_def = list(obj_get.time_work)
      # 作業詳細データを文字列からリストに解凍
      detail_list = obj_get.detail_work.split('$')


      # 以前同日に打ち込んだ工数区分定義と違う場合の処理
      if obj_get.def_ver2 not in (request.session['input_def'], None, ''):
        # エラーメッセージ出力
        messages.error(request, '前に入力された工数と工数区分定義のVerが違います。入力できません。ERROR007')
        # このページをリダイレクト
        return redirect(to = '/input')


      # 工数データに休憩時間データ無いか直が変更されている場合の処理
      if obj_get.breaktime == None or obj_get.breaktime_over1 == None or \
        obj_get.breaktime_over2 == None or obj_get.breaktime_over3 == None or \
          obj_get.tyoku2 != tyoku:
        # 休憩時間取得
        break_time_obj = member.objects.get(employee_no = request.session['login_No'])
 
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

      # 工数データに休憩時間データある場合の処理
      else:
        # 休憩時間取得
        breaktime = obj_get.breaktime
        breaktime_over1 = obj_get.breaktime_over1
        breaktime_over2 = obj_get.breaktime_over2
        breaktime_over3 = obj_get.breaktime_over3

      # 休憩1開始時間のインデント取得
      break_start1 = int(breaktime[1 : 3])*12 + int(breaktime[3 : 5])/5
      # 休憩1終了時間のインデント取得
      break_end1 = int(breaktime[5 : 7])*12 + int(breaktime[7 :])/5

      # 休憩1の日またぎ変数リセット
      break_next_day1 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start1 > break_end1:
        # 休憩1の日またぎ変数に1を入れる
        break_next_day1 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩1の日またぎ変数に0を入れる
        break_next_day1 = 0


      # 休憩2開始時間のインデント取得
      break_start2 = int(breaktime_over1[1 : 3])*12 + int(breaktime_over1[3 : 5])/5
      # 休憩2終了時間のインデント取得
      break_end2 = int(breaktime_over1[5 : 7])*12 + int(breaktime_over1[7 :])/5

      # 休憩2の日またぎ変数リセット
      break_next_day2 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start2 > break_end2:
        # 休憩2の日またぎ変数に1を入れる
        break_next_day2 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩2の日またぎ変数に0を入れる
        break_next_day2 = 0


      # 休憩3開始時間のインデント取得
      break_start3 = int(breaktime_over2[1 : 3])*12 + int(breaktime_over2[3 : 5])/5
      # 休憩3終了時間のインデント取得
      break_end3 = int(breaktime_over2[5 : 7])*12 + int(breaktime_over2[7 :])/5

      # 休憩3の日またぎ変数リセット
      break_next_day3 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start3 > break_end3:
        # 休憩3の日またぎ変数に1を入れる
        break_next_day3 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩3の日またぎ変数に0を入れる
        break_next_day3 = 0


      # 休憩4開始時間のインデント取得
      break_start4 = int(breaktime_over3[1 : 3])*12 + int(breaktime_over3[3 : 5])/5
      # 休憩4終了時間のインデント取得
      break_end4 = int(breaktime_over3[5 : 7])*12 + int(breaktime_over3[7 :])/5

      # 休憩4の日またぎ変数リセット
      break_next_day4 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start4 > break_end4:
        # 休憩4の日またぎ変数に1を入れる
        break_next_day4 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩4の日またぎ変数に0を入れる
        break_next_day4 = 0


      # 入力時間が日をまたいでいない場合の処理
      if check == 0:

        # 工数に被りがないかチェックするループ
        for kosu in range(start_time_ind, end_time_ind):
          # 工数データの要素が空でない場合の処理
          if kosu_def[kosu] != '$':
            if kosu_def[kosu] != '#':
              # エラーメッセージ出力
              messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR008')
              # このページをリダイレクト
              return redirect(to = '/input')


        # 作業内容と作業詳細を書き込むループ
        for kosu in range(start_time_ind, end_time_ind):
          # 作業内容リストに入力された工数定義区分の対応する記号を入れる
          kosu_def[kosu] = def_work
          # 作業詳細リストに入力した作業詳細を入れる
          detail_list[kosu] = detail_work


        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 休憩1が日を超えている場合の処理
          if break_next_day1 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt1 in range(int(break_start1), 288):
              # 作業内容リストの要素を空にする
              kosu_def[bt1] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt1] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
            for bt1 in range(0, int(break_end1)):
              # 作業内容リストの要素を空にする
              kosu_def[bt1] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt1 in range(int(break_start1), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt1 in range(0, int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩1が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt1 in range(int(break_start1), int(break_end1)):
              # 作業内容リストの要素を空にする
              kosu_def[bt1] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt1 in range(int(break_start1), int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩2が日を超えている場合の処理
          if break_next_day2 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt2 in range(int(break_start2), 288):
              # 作業内容リストの要素を空にする
              kosu_def[bt2] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt2] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
            for bt2 in range(0, int(break_end2)):
              # 作業内容リストの要素を空にする
              kosu_def[bt2] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt2 in range(int(break_start2), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt2 in range(0, int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩2が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt2 in range(int(break_start2), int(break_end2)):
              # 作業内容リストの要素を空にする
              kosu_def[bt2] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt2 in range(int(break_start2), int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩3が日を超えている場合の処理
          if break_next_day3 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt3 in range(int(break_start3), 288):
              # 作業内容リストの要素を空にする
              kosu_def[bt3] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt3] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
            for bt2 in range(0, int(break_end3)):
              # 作業内容リストの要素を空にする
              kosu_def[bt3] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt3 in range(int(break_start3), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt3 in range(0, int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩3が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt3 in range(int(break_start3), int(break_end3)):
              # 作業内容リストの要素を空にする
              kosu_def[bt3] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt3 in range(int(break_start3), int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩4が日を超えている場合の処理
          if break_next_day4 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt4 in range(int(break_start4), 288):
              # 作業内容リストの要素を空にする
              kosu_def[bt4] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt4] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
            for bt4 in range(0, int(break_end4)):
              # 作業内容リストの要素を空にする
              kosu_def[bt4] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt4 in range(int(break_start4), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt4 in range(0, int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


          # 休憩4が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt4 in range(int(break_start4), int(break_end4)):
              # 作業内容リストの要素を空にする
              kosu_def[bt4] = '#'
              # 作業詳細リストの要素を空にする
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt4 in range(int(break_start4), int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


      # 入力時間が日をまたいでいる場合の処理
      if check == 1:

        # 工数に被りがないかチェックするループ
        for kosu in range(start_time_ind, 288):
          # 作業内容の要素が空でない場合の処理
          if kosu_def[kosu] != '#':
            if kosu_def[kosu] != '$':
              # エラーメッセージ出力
              messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR009')
              # このページをリダイレクト
              return redirect(to = '/input')
          
        # 工数に被りがないかチェックするループ
        for kosu in range(0, end_time_ind):
          # 作業内容の要素が空でない場合の処理
          if kosu_def[kosu] != '#':
            if kosu_def[kosu] != '$':
              # エラーメッセージ出力
              messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR010')
              # このページをリダイレクト
              return redirect(to = '/input')
          

        # 作業内容と作業詳細を書き込むループ(作業開始時間から24時まで)
        for kosu in range(start_time_ind, 288):
          # 作業内容リストに入力した工数区分定義の対応する記号を入れる
          kosu_def[kosu] = def_work
          # 作業詳細リストに入力した作業詳細を入れる
          detail_list[kosu] = detail_work


        # 作業内容と作業詳細を書き込むループ(0時から作業終了時間まで)
        for kosu in range(0, end_time_ind):
          # 作業内容リストに入力した工数区分定義の対応する記号を入れる
          kosu_def[kosu] = def_work
          # 作業詳細リストに入力した作業詳細を入れる
          detail_list[kosu] = detail_work


        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 休憩1が日を超えている場合の処理
          if break_next_day1 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt1 in range(int(break_start1), 288):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt1] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt1] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時から作業終了時間まで)
            for bt1 in range(0, int(break_end1)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt1] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt1 in range(int(break_start1), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt1 in range(0, int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩1が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt1 in range(int(break_start1), int(break_end1)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt1] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt1 in range(int(break_start1), int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩2が日を超えている場合の処理
          if break_next_day2 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt2 in range(int(break_start2), 288):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt2] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt2] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時から作業終了時間まで)
            for bt2 in range(0, int(break_end2)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt2] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt2 in range(int(break_start2), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt2 in range(0, int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩2が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt2 in range(int(break_start2), int(break_end2)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt2] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt2 in range(int(break_start2), int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩3が日を超えている場合の処理
          if break_next_day3 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt3 in range(int(break_start3), 288):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt3] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt3] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時から作業終了時間まで)
            for bt2 in range(0, int(break_end3)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt3] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt3 in range(int(break_start3), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt3 in range(0, int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩3が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt3 in range(int(break_start3), int(break_end3)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt3] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt3 in range(int(break_start3), int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩4が日を超えている場合の処理
          if break_next_day4 == 1:
            # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
            for bt4 in range(int(break_start4), 288):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt4] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt4] = ''


            # 休憩時間内の工数データと作業詳細を消すループ(0時から作業終了時間まで)
            for bt4 in range(0, int(break_end4)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt4] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt4 in range(int(break_start4), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt4 in range(0, int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


          # 休憩4が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消すループ
            for bt4 in range(int(break_start4), int(break_end4)):
              # 作業内容リストに入力した工数区分定義の対応する記号を入れる
              kosu_def[bt4] = '#'
              # 作業詳細リストに入力した作業詳細を入れる
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt4 in range(int(break_start4), int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


      # 作業詳細変数リセット
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


      # 工数合計取得
      kosu_total = 1440 - (kosu_def.count('#')*5) - (kosu_def.count('$')*5)


      # 工数入力OK_NGリセット
      judgement = False

      # 出勤、休出時、工数合計と残業に整合性がある場合の処理
      if (work == '出勤' or work == 'シフト出') and \
        kosu_total - int(request.POST['over_work']) == 470:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 休出時、工数合計と残業に整合性がある場合の処理
      if work == '休出' and kosu_total == int(request.POST['over_work']):
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
      if work == '早退・遅刻' and kosu_total != 0:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 常昼の場合の処理
      if tyoku == '4':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 290:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 180:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 220:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 250:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 275:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 195:
          # 工数入力OK_NGをOKに切り替え
          judgement = True


      # 作業内容データの内容を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session.get('login_No', None), \
        work_day2 = work_day, defaults = {'def_ver2' : request.session.get('input_def', None), \
                                          'work_time' : work, \
                                          'tyoku2' : tyoku, \
                                          'time_work' : ''.join(kosu_def), \
                                          'over_time' : request.POST['over_work'], \
                                          'detail_work' : detail_list_str,\
                                          'breaktime' : breaktime, \
                                          'breaktime_over1' : breaktime_over1, \
                                          'breaktime_over2' : breaktime_over2, \
                                          'breaktime_over3' : breaktime_over3, \
                                          'judgement' : judgement, \
                                          'break_change' : 'break_change' in request.POST})
      

    # 指定日に工数データがない場合の処理
    if obj_filter.count() == 0:
      # '#'が288個並んだ作業内容リスト作成
      kosu_def = list(itertools.repeat('#', 288))
      # ''が288個並んだ作業詳細リスト作成
      detail_list = list(itertools.repeat('', 288))

      # 休憩時間取得
      break_time_obj = member.objects.get(employee_no = request.session['login_No'])

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

      # 休憩1開始時間のインデント取得
      break_start1 = int(breaktime[1 : 3])*12 + int(breaktime[3 : 5])/5
      # 休憩1終了時間のインデント取得
      break_end1 = int(breaktime[5 : 7])*12 + int(breaktime[7 :])/5

      # 休憩1が日をまたいでいないか確認
      break_next_day1 = 0

      if break_start1 > break_end1:
        break_next_day1 = 1

      else:
        break_next_day1 = 0

      # 休憩2開始時間のインデント取得
      break_start2 = int(breaktime_over1[1 : 3])*12 + int(breaktime_over1[3 : 5])/5
      # 休憩2終了時間のインデント取得
      break_end2 = int(breaktime_over1[5 : 7])*12 + int(breaktime_over1[7 :])/5

      # 休憩2が日をまたいでいないか確認
      break_next_day2 = 0

      if break_start2 > break_end2:
        break_next_day2 = 1

      else:
        break_next_day2 = 0

      # 休憩3開始時間のインデント取得
      break_start3 = int(breaktime_over2[1 : 3])*12 + int(breaktime_over2[3 : 5])/5
      # 休憩3終了時間のインデント取得
      break_end3 = int(breaktime_over2[5 : 7])*12 + int(breaktime_over2[7 :])/5

      # 休憩3が日をまたいでいないか確認
      break_next_day3 = 0

      if break_start3 > break_end3:
        break_next_day3 = 1

      else:
        break_next_day3 = 0

      # 休憩4開始時間のインデント取得
      break_start4 = int(breaktime_over3[1 : 3])*12 + int(breaktime_over3[3 : 5])/5
      # 休憩4終了時間のインデント取得
      break_end4 = int(breaktime_over3[5 : 7])*12 + int(breaktime_over3[7 :])/5

      # 休憩4が日をまたいでいないか確認
      break_next_day4 = 0

      if break_start4 > break_end4:
        break_next_day4 = 1

      else:
        break_next_day4 = 0


      # 入力時間が日をまたいでいない場合の処理
      if check == 0:
        # リストの作業時間に合った場所に工数区分と作業詳細を入れる
        for kosu in range(start_time_ind, end_time_ind):
          kosu_def[kosu] = def_work
          detail_list[kosu] = detail_work

        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 休憩1が日を超えている場合の処理
          if break_next_day1 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(int(break_start1), 288):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(0, int(break_end1)):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt1 in range(int(break_start1), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt1 in range(0, int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩1が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(int(break_start1), int(break_end1)):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt1 in range(int(break_start1), int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩2が日を超えている場合の処理
          if break_next_day2 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(int(break_start2), 288):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(0, int(break_end2)):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt2 in range(int(break_start2), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt2 in range(0, int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩2が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(int(break_start2), int(break_end2)):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt2 in range(int(break_start2), int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩3が日を超えている場合の処理
          if break_next_day3 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt3 in range(int(break_start3), 288):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(0, int(break_end3)):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt3 in range(int(break_start3), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt3 in range(0, int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩3が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt3 in range(int(break_start3), int(break_end3)):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt3 in range(int(break_start3), int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩4が日を超えている場合の処理
          if break_next_day4 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(int(break_start4), 288):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(0, int(break_end4)):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt4 in range(int(break_start4), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt4 in range(0, int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


          # 休憩4が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(int(break_start4), int(break_end4)):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt4 in range(int(break_start4), int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


      # 入力時間が日をまたいでいる場合の処理
      else:
        # リストの作業時間に合った場所に工数区分と作業詳細を入れる
        for kosu in range(start_time_ind, 288):
          kosu_def[kosu] = def_work
          detail_list[kosu] = detail_work


        for kosu in range(0, end_time_ind):
          kosu_def[kosu] = def_work
          detail_list[kosu] = detail_work


        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 休憩1が日を超えている場合の処理
          if break_next_day1 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(int(break_start1), 288):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(0, int(break_end1)):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt1 in range(int(break_start1), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt1 in range(0, int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩1が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt1 in range(int(break_start1), int(break_end1)):
              kosu_def[bt1] = '#'
              detail_list[bt1] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end1)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt1 in range(int(break_start1), int(break_end1)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt1] = '$'


          # 休憩2が日を超えている場合の処理
          if break_next_day2 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(int(break_start2), 288):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(0, int(break_end2)):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt2 in range(int(break_start2), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt2 in range(0, int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩2が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(int(break_start2), int(break_end2)):
              kosu_def[bt2] = '#'
              detail_list[bt2] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end2)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt2 in range(int(break_start2), int(break_end2)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt2] = '$'


          # 休憩3が日を超えている場合の処理
          if break_next_day3 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt3 in range(int(break_start3), 288):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt2 in range(0, int(break_end3)):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt3 in range(int(break_start3), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt3 in range(0, int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩3が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt3 in range(int(break_start3), int(break_end3)):
              kosu_def[bt3] = '#'
              detail_list[bt3] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end3)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt3 in range(int(break_start3), int(break_end3)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt3] = '$'


          # 休憩4が日を超えている場合の処理
          if break_next_day4 == 1:
            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(int(break_start4), 288):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(0, int(break_end4)):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
              for bt4 in range(int(break_start4), 288):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


              # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
              for bt4 in range(0, int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


          # 休憩4が日を超えていない場合の処理
          else:
            # 休憩時間内の工数データと作業詳細を消す
            for bt4 in range(int(break_start4), int(break_end4)):
              kosu_def[bt4] = '#'
              detail_list[bt4] = ''


            # 休憩時間直後の時間に工数入力がある場合の処理
            if kosu_def[int(break_end4)] != '#':
              # 休憩時間内の工数データを休憩に書き換えるループ
              for bt4 in range(int(break_start4), int(break_end4)):
                # 作業内容リストの要素を休憩に書き換え
                kosu_def[bt4] = '$'


      # 作業詳細リストを文字列に変更
      detail_list_str = ''

      for i, e in enumerate(detail_list):
        if i == len(detail_list) - 1:
          detail_list_str = detail_list_str + detail_list[i]

        else:
          detail_list_str = detail_list_str + detail_list[i] + '$'


      # 工数合計取得
      kosu_total = 1440 - (kosu_def.count('#')*5) - (kosu_def.count('$')*5)


      # 工数入力OK_NGリセット
      judgement = False

      # 出勤、休出時、工数合計と残業に整合性がある場合の処理
      if (work == '出勤' or work == 'シフト出') and \
        kosu_total - int(request.POST['over_work']) == 470:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 休出時、工数合計と残業に整合性がある場合の処理
      if work == '休出' and kosu_total == int(request.POST['over_work']):
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
      if work == '早退・遅刻' and kosu_total != 0:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 290:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 180:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 220:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 250:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 275:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 195:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # 常昼の場合の処理
      if tyoku == '4':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True


      # 従業員番号に該当するmemberインスタンスを取得
      member_instance = member.objects.get(employee_no = request.session['login_No'])

      # 指定のレコードにPOST送信された値を上書きする 
      new = Business_Time_graph(employee_no3 = request.session['login_No'], \
                                name = member_instance, \
                                def_ver2 = request.session['input_def'], \
                                work_day2 = work_day, \
                                work_time = work,\
                                tyoku2 = tyoku, \
                                time_work = ''.join(kosu_def), \
                                detail_work = detail_list_str, \
                                over_time = request.POST['over_work'], \
                                breaktime = breaktime, \
                                breaktime_over1 = breaktime_over1, \
                                breaktime_over2 = breaktime_over2, \
                                breaktime_over3 = breaktime_over3, \
                                judgement = judgement, \
                                break_change = 'break_change' in request.POST)

      # 工数内容リストをセーブする
      new.save()


    # 入力値をセッションに保存する
    request.session['day'] = work_day
    request.session['start_time'] = end_time
    request.session['end_time'] = end_time

    # エラー時の直保持がセッションにある場合の処理
    if 'error_tyoku' in request.session:
      # セッション削除
      del request.session['error_tyoku']

    # エラー時の勤務保持がセッションにある場合の処理
    if 'error_work' in request.session:
      # セッション削除
      del request.session['error_work']

    # エラー時の工数定義区分保持がセッションにある場合の処理
    if 'error_def' in request.session:
      # セッション削除
      del request.session['error_def']

    # エラー時の作業詳細保持がセッションにある場合の処理
    if 'error_detail' in request.session:
      # セッション削除
      del request.session['error_detail']

    # エラー時の残業保持がセッションにある場合の処理
    if 'error_over_work' in request.session:
      # セッション削除
      del request.session['error_over_work']

    # 翌日チェックリセット
    request.session['tomorrow_check'] = False


    # このページをリダイレクトする
    return redirect(to = '/input')



  # 残業登録時の処理
  if "over_time_correction" in request.POST:

    # 2つのフォームで入力のあった直を変数に入れる
    if request.POST['tyoku'] != '':
      tyoku = request.POST['tyoku']
    elif request.POST['tyoku2'] != '':
      tyoku = request.POST['tyoku2']
    else:
      tyoku = ''

    # 2つのフォームで入力のあった勤務を変数に入れる
    if request.POST['work'] != '':
      work = request.POST['work']
    elif request.POST['work2'] != '':
      work = request.POST['work2']
    else:
      work = ''

    # 未入力がないことを確認
    if request.POST['over_work'] == '':
      # エラーメッセージ出力
      messages.error(request, '残業が未入力です。登録できませんでした。ERROR017')
      # このページをリダイレクト
      return redirect(to = '/input')
    
    # 残業時間が15の倍数でない場合の処理
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      # エラーメッセージ出力
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR018')
      # このページをリダイレクト
      return redirect(to = '/input')

    # 休出時に残業時間が5の倍数でない場合の処理
    if int(request.POST['over_work'])%5 != 0 and work == '休出':
      # エラーメッセージ出力
      messages.error(request, '残業時間が5分の倍数になっていません。工数登録できませんでした。ERROR084')
      # このページをリダイレクト
      return redirect(to = '/input')


    # 工数データがあるか確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = request.POST['work_day'])
    
    # 工数データがある場合の処理
    if obj_filter.count() != 0:
      # 工数データ取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                work_day2 = request.POST['work_day'])
      # 工数の合計値取得
      kosu_total = 1440 - (obj_get.time_work.count('#')*5) - (obj_get.time_work.count('$')*5)

      # 工数入力OK_NGリセット
      judgement = False

      # 出勤、休出時、工数合計と残業に整合性がある場合の処理
      if (work == '出勤' or work == 'シフト出') and \
        kosu_total - int(request.POST['over_work']) == 470:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 休出時、工数合計と残業に整合性がある場合の処理
      if work == '休出' and kosu_total == int(request.POST['over_work']):
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
      if work == '早退・遅刻' and kosu_total != 0:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 常昼の場合の処理
      if tyoku == '4':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 290:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 180:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
      if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
        member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
          member_obj.shop == '組長以上(W,A)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '1':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 220:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 250:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '2':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 230:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 240:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

      # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
      if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
        member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
          tyoku == '3':
        # 半前年休時、工数合計と残業に整合性がある場合の処理
        if work == '半前年休' and kosu_total - int(request.POST['over_work']) == 275:
          # 工数入力OK_NGをOKに切り替え
          judgement = True

        # 半後年休時、工数合計と残業に整合性がある場合の処理
        if work == '半後年休' and kosu_total - int(request.POST['over_work']) == 195:
          # 工数入力OK_NGをOKに切り替え
          judgement = True


      # 残業を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session.get('login_No', None), \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'over_time' : request.POST['over_work'], \
                                                               'judgement' : judgement})
      
    # 工数データがない場合の処理
    else:
      # 従業員番号に該当するmemberインスタンスを取得
      member_instance = member.objects.get(employee_no = request.session['login_No'])

      # 工数データ作成し残業書き込み
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session.get('login_No', ''), \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'name' : member_instance, \
                                                               'time_work' : '#'*288, \
                                                               'detail_work' : '$'*287, \
                                                               'over_time' : request.POST['over_work']})

    # このページをリダイレクトする
    return redirect(to = '/input')



  # 現在時刻取得処理
  if "now_time" in request.POST:

    # 2つのフォームで入力のあった直を変数に入れる
    if request.POST['tyoku'] != '':
      tyoku = request.POST['tyoku']
    elif request.POST['tyoku2'] != '':
      tyoku = request.POST['tyoku2']
    else:
      tyoku = ''
  
    # 2つのフォームで入力のあった勤務を変数に入れる
    if request.POST['work'] != '':
      work = request.POST['work']
    elif request.POST['work2'] != '':
      work = request.POST['work2']
    else:
      work = ''

    # 現在時刻取得
    now_time = datetime.datetime.now().time()

    # 現在時刻を5分単位で丸め
    rounded_time = round_time(now_time)
    
    # 現在時刻を初期値に設定
    default_end_time = rounded_time.strftime('%H:%M')

    # 更新された就業日取得
    new_work_day = request.session.get('day', kosu_today)

    # 作業開始時間保持
    request.session['start_time'] = request.POST['start_time']

    # 翌日チェックBOX、工数区分保持
    if request.POST['start_time'] != '':
      if datetime.datetime.strptime(request.POST['start_time'], "%H:%M") > datetime.datetime.strptime(default_end_time, "%H:%M"):
        request.session['tomorrow_check'] = True

      else:
        request.session['tomorrow_check'] = False

    else:
      request.session['tomorrow_check'] = False

    # 時刻取得時の初期値の定義
    def_default = {'work' : work,
                   'work2' : work,
                   'tyoku' : tyoku,
                   'tyoku2' : tyoku,
                   'kosu_def_list' : request.POST['kosu_def_list'],
                   'work_detail' : request.POST['work_detail'],
                   'break_change' : 'break_change' in request.POST,
                   'over_work' : request.POST['over_work']}


    # グラフデータ確認用データ取得
    data_count = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None),\
                                                    work_day2 = new_work_day)

    # グラフラベルデータ
    graph_item = []
    for i in range(24):
        for n in range(0, 60, 5):
            t = n
            if n == 0:
              t = '00'
            if n == 5:
              t = '05'
            graph_item.append('{}:{}'.format(i, t))

 
    # 選択されている就業日のグラフデータがない場合の処理
    if data_count.count() == 0:
      # 0を288個入れたリスト作成
      graph_list = list(itertools.repeat(0, 288))

    # 選択されている就業日のグラフデータがある場合の処理
    else:
      # グラフデータを取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None),\
                                                  work_day2 = new_work_day)

      # 取得したグラフデータを文字型からリストに解凍
      graph_list = list(obj_get.time_work)

      # グラフデータリスト内の各文字を数値に変更
      str_list = ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                          'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

      # グラフ用データの文字リストをインデックスに変換
      for i in range(288):
        for n, m in enumerate(str_list):
          if graph_list[i]  == m:
            graph_list[i] = n
            break


      # 作業内容が空でない場合の処理
      if graph_list != list(itertools.repeat(0, 288)):
        # 工数が入力されていない部分を切り捨てデータを見やすく
        if obj_get.tyoku2 != '3':
          for i in range(288):
            if graph_list[i] != 0:
              if i == 0:
                graph_start_index = i

              else:
                graph_start_index = i - 1

              break
    

          for i in range(1, 289):
            if graph_list[-i] != 0:
              if i == 1:
                graph_end_index = 289 - i

              else:
                graph_end_index = 290 - i

              break


          if obj_get.tyoku2 == '1':
            if graph_end_index <= 184:
              graph_end_index = 184

          if obj_get.tyoku2 == '2' and (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
                                          member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
                                            member_obj.shop == '組長以上(W,A)'):
            if graph_end_index <= 240:
              graph_end_index = 240

          if obj_get.tyoku2 == '2' and (member_obj.shop == 'P' or member_obj.shop == 'R' or \
                                          member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
                                          member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)'):
            if graph_end_index <= 270:
              graph_end_index = 270

          if obj_get.tyoku2 == '4':
            if graph_end_index <= 204:
              graph_end_index = 204

          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]

        else:
          graph_list = graph_list*2
          graph_item = graph_item*2

          del graph_list[:204]
          del graph_list[288:]
          del graph_item[:204]
          del graph_item[288:]

          for i in range(288):
            if graph_list[i] != 0:
              if i == 0:
                graph_start_index = i

              else:
                graph_start_index = i - 1
                break


          for i in range(1, 289):
            if graph_list[-i] != 0:
              if i == 1:
                graph_end_index = 289 - i

              else:
                graph_end_index = 290 - i
                break


          if member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2':
            if graph_end_index <= 140:
              graph_end_index = 140

          else:
            if graph_end_index <= 169:
              graph_end_index = 169

          del graph_list[graph_end_index:]
          del graph_list[:graph_start_index]
          del graph_item[graph_end_index:]
          del graph_item[:graph_start_index]



  # 休憩変更時の処理
  if "change_display" in request.POST:
    # 休憩変更したい日を記憶
    request.session['break_today'] = request.POST['work_day']

    # 休憩変更したい日に休憩データがあるか確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None),\
                                                    work_day2 = request.POST['work_day'])

    # 工数データがない場合の処理
    if obj_filter.count() == 0:
      # エラーメッセージ出力
      messages.error(request, 'この日は、まだ工数データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR006')
      # このページをリダイレクト
      return redirect(to = '/input')

    #工数データがある場合の処理
    if obj_filter.count() != 0:
      # 工数データ取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'],\
                                                work_day2 = request.session.get('day', kosu_today))

      # 休憩データが空の場合の処理
      if obj_get.breaktime == None or obj_get.breaktime_over1 == None or \
        obj_get.breaktime_over2 == None or obj_get.breaktime_over3 == None:
        # エラーメッセージ出力
        messages.error(request, 'この日は、まだ休憩データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR016')
        # このページをリダイレクト
        return redirect(to = '/input')

      # 休憩データがある場合の処理 
      else:
        # 休憩変更画面へジャンプ
        return redirect(to = '/today_break_time')
      


  # 定義確認処理
  if "def_find" in request.POST:

    # 2つのフォームで入力のあった直を変数に入れる
    if request.POST['tyoku'] != '':
      tyoku = request.POST['tyoku']
    elif request.POST['tyoku2'] != '':
      tyoku = request.POST['tyoku2']
    else:
      tyoku = ''

    # 2つのフォームで入力のあった勤務を変数に入れる
    if request.POST['work'] != '':
      work = request.POST['work']
    elif request.POST['work2'] != '':
      work = request.POST['work2']
    else:
      work = ''

    # 直初期値設定保持
    request.session['error_tyoku'] = tyoku
    # 勤務初期値設定保持
    request.session['error_work'] = work
    # 工数区分定義初期値設定保持
    request.session['error_def'] = request.POST['kosu_def_list']
    # 作業詳細初期値設定保持
    request.session['error_detail'] = request.POST['work_detail']
    # 残業初期値設定保持
    request.session['error_over_work'] = request.POST['over_work']
    # 作業開始時間保持
    request.session['start_time'] = request.POST['start_time']
    # 作業終了時間保持
    request.session['end_time'] = request.POST['end_time']
    # 翌日チェック保持
    request.session['tomorrow_check'] = 'tomorrow_check' in request.POST

    # 工数定義区分画面へジャンプ
    return redirect(to = '/kosu_def')



  # 作業終了時の変数がある場合の処理
  if 'default_end_time' in locals():
    # 処理なし
    default_end_time = default_end_time

  # 作業終了時の変数がない場合の処理
  else:
    # セッションに登録されている作業終了時を変数に入れる
    default_end_time = str(request.session.get('end_time', ''))


  # 残業データあるか確認
  over_work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None),\
                                                        work_day2 = request.session.get('day', kosu_today))

  # 残業データある場合の処理
  if over_work_filter.count() != 0:
    # 残業データ取得
    over_work_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None),\
                                                    work_day2 = request.session.get('day', kosu_today))
    over_work_default = over_work_get.over_time

    # 直情報取得
    tyoku_default = over_work_get.tyoku2
    # 勤務情報取得
    work_default = over_work_get.work_time
    # 工数入力状況取得
    ok_ng = over_work_get.judgement
    # 休憩変更情報取得
    break_change_default = over_work_get.break_change

  # 残業データない場合の処理
  else:
    # 残業に0を入れる
    over_work_default = 0
    # 工数入力状況に空を入れる
    ok_ng = False
    # 休憩時間変更に空を入れる
    break_change_default = False
    # 勤務情報に空を入れる 
    work_default = ''
    # 直情報に空を入れる
    tyoku_default = ''

  # エラー時の直保持がセッションにある場合の処理
  if 'error_tyoku' in request.session:
    # 直初期値にエラー時の直保持を入れる
    tyoku_default = request.session['error_tyoku']
    # セッション削除
    del request.session['error_tyoku']

  # エラー時の勤務保持がセッションにある場合の処理
  if 'error_work' in request.session:
    # 勤務初期値にエラー時の直保持を入れる
    work_default = request.session['error_work']
    # セッション削除
    del request.session['error_work']

  # エラー時の残業保持がセッションにある場合の処理
  if 'error_over_work' in request.session:
    # 残業初期値にエラー時の直保持を入れる
    over_work_default = request.session['error_over_work']
    # セッション削除
    del request.session['error_over_work']


  # 初期値を設定するリスト作成
  kosu_list = {'work' : work_default,
               'work2' : work_default,
               'tyoku' : tyoku_default,
               'tyoku2' : tyoku_default, 
               'tomorrow_check' : request.session.get('tomorrow_check', False),
               'kosu_def_list': request.session.get('error_def', ''),
               'work_detail' : request.session.get('error_detail', ''),
               'over_work' : over_work_default,
               'break_change' : break_change_default,}
  
  default_start_time = request.session.get('start_time', '')
  
  # エラー時の工数定義区分保持がセッションにある場合の処理
  if 'error_def' in request.session:
    # セッション削除
    del request.session['error_def']

  # エラー時の作業詳細保持保持がセッションにある場合の処理
  if 'error_detail' in request.session:
    # セッション削除
    del request.session['error_detail']
  

  # 時刻取得時の初期値の定義追加あれば追加
  if 'def_default' in locals():
    kosu_list.update(def_default)


  # 現在使用している工数区分のオブジェクトを取得
  kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))

  # 工数区分登録カウンターリセット
  n = 0

  # 工数区分登録数カウント
  for kosu_num in range(1, 50):
    if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) not in [None, '']:
      n = kosu_num


  # 工数区分処理用記号リスト用意
  str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
              'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                    'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

  # リストの長さを工数区分の登録数に応じて調整
  del str_list[n:]

  # 工数区分の選択リスト作成
  choices_list = [('','')]
  graph_kosu_list = []
  for i, m in enumerate(str_list):
    choices_list.append((m,eval('kosu_obj.kosu_title_{}'.format(i + 1))))
    graph_kosu_list.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))


  # ログイン者情報取得
  data = member.objects.get(employee_no = request.session['login_No'])

  # フォームの初期状態定義
  form = input_kosuForm(kosu_list)

  # フォームの選択肢定義
  form.fields['kosu_def_list'].choices = choices_list

  # 工数データ無い場合リンクに空を入れる
  if 'obj_get' in locals():
    obj_link = obj_get

  else:
    obj_link = ''


  # HTML表示用リストリセット
  time_display_list = []

  # 工数データある場合の処理
  if obj_link != '':
    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')
  
    # 作業内容と作業詳細のリストを2個連結
    work_list = work_list*2
    detail_list = detail_list*2

    # 1直の時の処理
    if obj_get.tyoku2 == '1':
      # 作業内容と作業詳細のリストを4時半からの表示に変える
      del work_list[:54]
      del detail_list[:54]
      del work_list[288:]
      del detail_list[288:]

    # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
    elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
      # 作業内容と作業詳細のリストを12時からの表示に変える
      del work_list[:144]
      del detail_list[:144]
      del work_list[288:]
      del detail_list[288:]

    # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
    elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
          and obj_get.tyoku2 == '2':
      # 作業内容と作業詳細のリストを9時からの表示に変える
      del work_list[:108]
      del detail_list[:108]
      del work_list[288:]
      del detail_list[288:]

    # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
    elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
      # 作業内容と作業詳細のリストを20時半からの表示に変える
      del work_list[:246]
      del detail_list[:246]
      del work_list[288:]
      del detail_list[288:]

    # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
    elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
          and obj_get.tyoku2 == '3':
      # 作業内容と作業詳細のリストを18時からの表示に変える
      del work_list[:216]
      del detail_list[:216]
      del work_list[288:]
      del detail_list[288:]

    # 常昼の時の処理
    elif obj_get.tyoku2 == '4':
      # 作業内容と作業詳細のリストを6時からの表示に変える
      del work_list[:72]
      del detail_list[:72]
      del work_list[288:]
      del detail_list[288:]


    # 作業時間リストリセット
    kosu_list = []
    time_list_start = []
    time_list_end = []
    def_list = []
    def_time = []
    detail_time = []
    find_list =[]

    # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
    for i in range(288):
      # 最初の要素に作業が入っている場合の処理
      if i == 0 and work_list[i] != '#':
        # 検索用リストにインデックス記憶
        find_list.append(i)

        if obj_get.tyoku2 == '1':
          kosu_list.append(i + 54)

        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '2':
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '3':
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 216)

        elif obj_get.tyoku2 == '4':
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 72)

      # 時間区分毎に前の作業との差異がある場合の処理
      if i != 0 and (work_list[i] != work_list[i - 1] or detail_list[i] != detail_list[i - 1]):
        # 検索用リストにインデックス記憶
        find_list.append(i)

        if obj_get.tyoku2 == '1':
          if i >= 234:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 234)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 54)

        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
          if i >= 144:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 144)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 144)

        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '2':
          if i >= 180:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 180)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 108)
  
        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
          if i >= 42:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 42)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 246)
        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '3':
          if i >= 72:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 72)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 216)

        elif obj_get.tyoku2 == '4':
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

        if obj_get.tyoku2 == '1':
          if i >= 234:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 233)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 55)

        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
          if i >= 144:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 143)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 145)

        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '2':
          if i >= 180:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 179)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 109)

        elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
            data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
          if i >= 42:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 41)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 247)

        elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
              and obj_get.tyoku2 == '3':
          if i >= 72:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i - 71)

          else:
            # 作業時間インデックスに作業時間のインデックス記録
            kosu_list.append(i + 217)

        elif obj_get.tyoku2 == '4':
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
    kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))

    # 工数区分登録カウンターリセット
    def_n = 0

    # 工数区分登録数カウント
    for kosu_num in range(1, 50):
      if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != '':
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
      def_list.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))


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
        detail_time.append(detail_list[t])


    # HTML表示用リスト作成
    for k in range(len(time_list_start)):
      for_list = []
      for_list.append(str(time_list_start[k]) + '～' + str(time_list_end[k]))
      for_list.append(def_time[k])
      for_list.append(detail_time[k])
      time_display_list.append(for_list)

  # 工数データない場合の処理
  else:
    def_n = 0



  # HTMLに渡す辞書
  context = {
    'title' : '工数登録',
    'form' : form,
    'new_day' : str(new_work_day),
    'default_start_time' : default_start_time,
    'default_end_time' : default_end_time,
    'graph_list' : graph_list,
    'graph_item' : graph_item,
    'graph_kosu_list' : graph_kosu_list,
    'def_n' : def_n,
    'OK_NG' : ok_ng,
    'obj_link' : obj_link,
    'time_display_list' : time_display_list,
    'member_obj' : member_obj
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/input.html', context)





#--------------------------------------------------------------------------------------------------------





# 休憩時間定義画面定義
def break_time(request): 

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # POST時の処理
  if (request.method == 'POST'):
    # POSTされた値を変数に入れる
    break_time1_start = request.POST['start_time1']
    break_time1_end = request.POST['end_time1']
    break_time2_start = request.POST['start_time2']
    break_time2_end = request.POST['end_time2']
    break_time3_start = request.POST['start_time3']
    break_time3_end = request.POST['end_time3']
    break_time4_start = request.POST['start_time4']
    break_time4_end = request.POST['end_time4']
    break_time5_start = request.POST['start_time5']
    break_time5_end = request.POST['end_time5']
    break_time6_start = request.POST['start_time6']
    break_time6_end = request.POST['end_time6']
    break_time7_start = request.POST['start_time7']
    break_time7_end = request.POST['end_time7']
    break_time8_start = request.POST['start_time8']
    break_time8_end = request.POST['end_time8']
    break_time9_start = request.POST['start_time9']
    break_time9_end = request.POST['end_time9']
    break_time10_start = request.POST['start_time10']
    break_time10_end = request.POST['end_time10']
    break_time11_start = request.POST['start_time11']
    break_time11_end = request.POST['end_time11']
    break_time12_start = request.POST['start_time12']
    break_time12_end = request.POST['end_time12']
    break_time13_start = request.POST['start_time13']
    break_time13_end = request.POST['end_time13']
    break_time14_start = request.POST['start_time14']
    break_time14_end = request.POST['end_time14']
    break_time15_start = request.POST['start_time15']
    break_time15_end = request.POST['end_time15']
    break_time16_start = request.POST['start_time16']
    break_time16_end = request.POST['end_time16']

    # 休憩1開始時間の区切りのインデックス取得
    break_time1_start_index = break_time1_start.index(':')
    # 休憩1開始時取得
    break_time1_start_hour = break_time1_start[ : break_time1_start_index]
    # 休憩1開始分取得
    break_time1_start_min = break_time1_start[break_time1_start_index + 1 : ]
    # 休憩1終了時間の区切りのインデックス取得
    break_time1_end_index = break_time1_end.index(':')
    # 休憩1終了時取得
    break_time1_end_hour = break_time1_end[ : break_time1_end_index]
    # 休憩1終了分取得
    break_time1_end_min = break_time1_end[break_time1_end_index + 1 : ]
    # 休憩2開始時間の区切りのインデックス取得
    break_time2_start_index = break_time2_start.index(':')
    # 休憩2開始時取得
    break_time2_start_hour = break_time2_start[ : break_time2_start_index]
    # 休憩2開始分取得
    break_time2_start_min = break_time2_start[break_time2_start_index + 1 : ]
    # 休憩2終了時間の区切りのインデックス取得
    break_time2_end_index = break_time2_end.index(':')
    # 休憩2終了時取得
    break_time2_end_hour = break_time2_end[ : break_time2_end_index]
    # 休憩2終了分取得
    break_time2_end_min = break_time2_end[break_time2_end_index + 1 : ]
    # 休憩3開始時間の区切りのインデックス取得
    break_time3_start_index = break_time3_start.index(':')
    # 休憩3開始時取得
    break_time3_start_hour = break_time3_start[ : break_time3_start_index]
    # 休憩3開始分取得
    break_time3_start_min = break_time3_start[break_time3_start_index + 1 : ]
    # 休憩3終了時間の区切りのインデックス取得
    break_time3_end_index = break_time3_end.index(':')
    # 休憩3終了時取得
    break_time3_end_hour = break_time3_end[ : break_time3_end_index]
    # 休憩3終了分取得
    break_time3_end_min = break_time3_end[break_time3_end_index + 1 : ]
    # 休憩4開始時間の区切りのインデックス取得
    break_time4_start_index = break_time4_start.index(':')
    # 休憩4開始時取得
    break_time4_start_hour = break_time4_start[ : break_time4_start_index]
    # 休憩4開始分取得
    break_time4_start_min = break_time4_start[break_time4_start_index + 1 : ]
    # 休憩4終了時間の区切りのインデックス取得
    break_time4_end_index = break_time4_end.index(':')
    # 休憩4終了時取得
    break_time4_end_hour = break_time4_end[ : break_time4_end_index]
    # 休憩4終了分取得
    break_time4_end_min = break_time4_end[break_time4_end_index + 1 : ]
    # 休憩5開始時間の区切りのインデックス取得
    break_time5_start_index = break_time5_start.index(':')
    # 休憩5開始時取得
    break_time5_start_hour = break_time5_start[ : break_time5_start_index]
    # 休憩5開始分取得
    break_time5_start_min = break_time5_start[break_time5_start_index + 1 : ]
    # 休憩5終了時間の区切りのインデックス取得
    break_time5_end_index = break_time5_end.index(':')
    # 休憩5終了時取得
    break_time5_end_hour = break_time5_end[ : break_time5_end_index]
    # 休憩5終了分取得
    break_time5_end_min = break_time5_end[break_time5_end_index + 1 : ]
    # 休憩6開始時間の区切りのインデックス取得
    break_time6_start_index = break_time6_start.index(':')
    # 休憩6開始時取得
    break_time6_start_hour = break_time6_start[ : break_time6_start_index]
    # 休憩6開始分取得
    break_time6_start_min = break_time6_start[break_time6_start_index + 1 : ]
    # 休憩6終了時間の区切りのインデックス取得
    break_time6_end_index = break_time6_end.index(':')
    # 休憩6終了時取得
    break_time6_end_hour = break_time6_end[ : break_time6_end_index]
    # 休憩6終了分取得
    break_time6_end_min = break_time6_end[break_time6_end_index + 1 : ]
    # 休憩7開始時間の区切りのインデックス取得
    break_time7_start_index = break_time7_start.index(':')
    # 休憩7開始時取得
    break_time7_start_hour = break_time7_start[ : break_time7_start_index]
    # 休憩7開始分取得
    break_time7_start_min = break_time7_start[break_time7_start_index + 1 : ]
    # 休憩7終了時間の区切りのインデックス取得
    break_time7_end_index = break_time7_end.index(':')
    # 休憩7終了時取得
    break_time7_end_hour = break_time7_end[ : break_time7_end_index]
    # 休憩7終了分取得
    break_time7_end_min = break_time7_end[break_time7_end_index + 1 : ]
    # 休憩8開始時間の区切りのインデックス取得
    break_time8_start_index = break_time8_start.index(':')
    # 休憩8開始時取得
    break_time8_start_hour = break_time8_start[ : break_time8_start_index]
    # 休憩8開始分取得
    break_time8_start_min = break_time8_start[break_time8_start_index + 1 : ]
    # 休憩8終了時間の区切りのインデックス取得
    break_time8_end_index = break_time8_end.index(':')
    # 休憩8終了時取得
    break_time8_end_hour = break_time8_end[ : break_time8_end_index]
    # 休憩8終了分取得
    break_time8_end_min = break_time8_end[break_time8_end_index + 1 : ]
    # 休憩9開始時間の区切りのインデックス取得
    break_time9_start_index = break_time9_start.index(':')
    # 休憩9開始時取得
    break_time9_start_hour = break_time9_start[ : break_time9_start_index]
    # 休憩9開始分取得
    break_time9_start_min = break_time9_start[break_time9_start_index + 1 : ]
    # 休憩9終了時間の区切りのインデックス取得
    break_time9_end_index = break_time9_end.index(':')
    # 休憩9終了時取得
    break_time9_end_hour = break_time9_end[ : break_time9_end_index]
    # 休憩9終了分取得
    break_time9_end_min = break_time9_end[break_time9_end_index + 1 : ]
    # 休憩10開始時間の区切りのインデックス取得
    break_time10_start_index = break_time10_start.index(':')
    # 休憩10開始時取得
    break_time10_start_hour = break_time10_start[ : break_time10_start_index]
    # 休憩10開始分取得
    break_time10_start_min = break_time10_start[break_time10_start_index + 1 : ]
    # 休憩10終了時間の区切りのインデックス取得
    break_time10_end_index = break_time10_end.index(':')
    # 休憩10終了時取得
    break_time10_end_hour = break_time10_end[ : break_time10_end_index]
    # 休憩10終了分取得
    break_time10_end_min = break_time10_end[break_time10_end_index + 1 : ]
    # 休憩11開始時間の区切りのインデックス取得
    break_time11_start_index = break_time11_start.index(':')
    # 休憩11開始時取得
    break_time11_start_hour = break_time11_start[ : break_time11_start_index]
    # 休憩11開始分取得
    break_time11_start_min = break_time11_start[break_time11_start_index + 1 : ]
    # 休憩11終了時間の区切りのインデックス取得
    break_time11_end_index = break_time11_end.index(':')
    # 休憩11終了時取得
    break_time11_end_hour = break_time11_end[ : break_time11_end_index]
    # 休憩11終了分取得
    break_time11_end_min = break_time11_end[break_time11_end_index + 1 : ]
    # 休憩12開始時間の区切りのインデックス取得
    break_time12_start_index = break_time12_start.index(':')
    # 休憩12開始時取得
    break_time12_start_hour = break_time12_start[ : break_time12_start_index]
    # 休憩12開始分取得
    break_time12_start_min = break_time12_start[break_time12_start_index + 1 : ]
    # 休憩12終了時間の区切りのインデックス取得
    break_time12_end_index = break_time12_end.index(':')
    # 休憩12終了時取得
    break_time12_end_hour = break_time12_end[ : break_time12_end_index]
    # 休憩12終了分取得
    break_time12_end_min = break_time12_end[break_time12_end_index + 1 : ]
    # 休憩13開始時間の区切りのインデックス取得
    break_time13_start_index = break_time13_start.index(':')
    # 休憩13開始時取得
    break_time13_start_hour = break_time13_start[ : break_time13_start_index]
    # 休憩13開始分取得
    break_time13_start_min = break_time13_start[break_time13_start_index + 1 : ]
    # 休憩13終了時間の区切りのインデックス取得
    break_time13_end_index = break_time13_end.index(':')
    # 休憩13終了時取得
    break_time13_end_hour = break_time13_end[ : break_time13_end_index]
    # 休憩13終了分取得
    break_time13_end_min = break_time13_end[break_time13_end_index + 1 : ]
    # 休憩14開始時間の区切りのインデックス取得
    break_time14_start_index = break_time14_start.index(':')
    # 休憩14開始時取得
    break_time14_start_hour = break_time14_start[ : break_time14_start_index]
    # 休憩14開始分取得
    break_time14_start_min = break_time14_start[break_time14_start_index + 1 : ]
    # 休憩14終了時間の区切りのインデックス取得
    break_time14_end_index = break_time14_end.index(':')
    # 休憩14終了時取得
    break_time14_end_hour = break_time14_end[ : break_time14_end_index]
    # 休憩14終了分取得
    break_time14_end_min = break_time14_end[break_time14_end_index + 1 : ]
    # 休憩15開始時間の区切りのインデックス取得
    break_time15_start_index = break_time15_start.index(':')
    # 休憩15開始時取得
    break_time15_start_hour = break_time15_start[ : break_time15_start_index]
    # 休憩15開始分取得
    break_time15_start_min = break_time15_start[break_time15_start_index + 1 : ]
    # 休憩15終了時間の区切りのインデックス取得
    break_time15_end_index = break_time15_end.index(':')
    # 休憩15終了時取得
    break_time15_end_hour = break_time15_end[ : break_time15_end_index]
    # 休憩15終了分取得
    break_time15_end_min = break_time15_end[break_time15_end_index + 1 : ]
    # 休憩16開始時間の区切りのインデックス取得
    break_time16_start_index = break_time16_start.index(':')
    # 休憩16開始時取得
    break_time16_start_hour = break_time16_start[ : break_time16_start_index]
    # 休憩16開始分取得
    break_time16_start_min = break_time16_start[break_time16_start_index + 1 : ]
    # 休憩16終了時間の区切りのインデックス取得
    break_time16_end_index = break_time16_end.index(':')
    # 休憩16終了時取得
    break_time16_end_hour = break_time16_end[ : break_time16_end_index]
    # 休憩16終了分取得
    break_time16_end_min = break_time16_end[break_time16_end_index + 1 : ]


    # POSTされた値をまとめる
    break_time1 = break_time1_start_hour.zfill(2) + break_time1_start_min + \
                  break_time1_end_hour.zfill(2) + break_time1_end_min
    break_time2 = break_time2_start_hour.zfill(2) + break_time2_start_min + \
                  break_time2_end_hour.zfill(2) + break_time2_end_min
    break_time3 = break_time3_start_hour.zfill(2) + break_time3_start_min + \
                  break_time3_end_hour.zfill(2) + break_time3_end_min
    break_time4 = break_time4_start_hour.zfill(2) + break_time4_start_min + \
                  break_time4_end_hour.zfill(2) + break_time4_end_min
    break_time5 = break_time5_start_hour.zfill(2) + break_time5_start_min + \
                  break_time5_end_hour.zfill(2) + break_time5_end_min
    break_time6 = break_time6_start_hour.zfill(2) + break_time6_start_min + \
                  break_time6_end_hour.zfill(2) + break_time6_end_min
    break_time7 = break_time7_start_hour.zfill(2) + break_time7_start_min + \
                  break_time7_end_hour.zfill(2) + break_time7_end_min
    break_time8 = break_time8_start_hour.zfill(2) + break_time8_start_min + \
                  break_time8_end_hour.zfill(2) + break_time8_end_min
    break_time9 = break_time9_start_hour.zfill(2) + break_time9_start_min + \
                  break_time9_end_hour.zfill(2) + break_time9_end_min
    break_time10 = break_time10_start_hour.zfill(2) + break_time10_start_min + \
                   break_time10_end_hour.zfill(2) + break_time10_end_min
    break_time11 = break_time11_start_hour.zfill(2) + break_time11_start_min + \
                   break_time11_end_hour.zfill(2) + break_time11_end_min
    break_time12 = break_time12_start_hour.zfill(2) + break_time12_start_min + \
                   break_time12_end_hour.zfill(2) + break_time12_end_min
    break_time13 = break_time13_start_hour.zfill(2) + break_time13_start_min + \
                   break_time13_end_hour.zfill(2) + break_time13_end_min
    break_time14 = break_time14_start_hour.zfill(2) + break_time14_start_min + \
                   break_time14_end_hour.zfill(2) + break_time14_end_min
    break_time15 = break_time15_start_hour.zfill(2) + break_time15_start_min + \
                   break_time15_end_hour.zfill(2) + break_time15_end_min
    break_time16 = break_time16_start_hour.zfill(2) + break_time16_start_min + \
                   break_time16_end_hour.zfill(2) + break_time16_end_min



    # 1直昼休憩時間に長すぎる時間を登録しようとした時の処理
    if (int(break_time1_end_hour)*60 + int(break_time1_end_min)) - \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min)) > 60 or \
      (((int(break_time1_end_hour)*60 + int(break_time1_end_min)) < \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min))) and \
      (int(break_time1_end_hour)*60 + int(break_time1_end_min) + 1440) - \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '1直の昼休憩時間が60分を超えています。正しい休憩時間を登録して下さい。ERROR061')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 2直昼休憩時間に長すぎる時間を登録しようとした時の処理
    if (int(break_time5_end_hour)*60 + int(break_time5_end_min)) - \
      (int(break_time5_start_hour)*60 + int(break_time5_start_min)) > 60 or \
      (((int(break_time5_end_hour)*60 + int(break_time5_end_min)) < \
      (int(break_time5_start_hour)*60 + int(break_time5_start_min))) and \
      (int(break_time5_end_hour)*60 + int(break_time5_end_min) + 1440) - \
      (int(break_time5_start_hour)*60 + int(break_time5_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '2直の昼休憩時間が60分を超えています。正しい休憩時間を登録して下さい。ERROR062')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 3直昼休憩時間に長すぎる時間を登録しようとした時の処理
    if (int(break_time9_end_hour)*60 + int(break_time9_end_min)) - \
      (int(break_time9_start_hour)*60 + int(break_time9_start_min)) > 60 or \
      (((int(break_time9_end_hour)*60 + int(break_time9_end_min)) < \
      (int(break_time9_start_hour)*60 + int(break_time9_start_min))) and \
      (int(break_time9_end_hour)*60 + int(break_time9_end_min) + 1440) - \
      (int(break_time9_start_hour)*60 + int(break_time9_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '3直の昼休憩時間が60分を超えています。正しい休憩時間を登録して下さい。ERROR063')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 常昼昼休憩時間に長すぎる時間を登録しようとした時の処理
    if (int(break_time13_end_hour)*60 + int(break_time13_end_min)) - \
      (int(break_time13_start_hour)*60 + int(break_time13_start_min)) > 60 or \
      (((int(break_time13_end_hour)*60 + int(break_time13_end_min)) < \
      (int(break_time13_start_hour)*60 + int(break_time13_start_min))) and \
      (int(break_time13_end_hour)*60 + int(break_time13_end_min) + 1440) - \
      (int(break_time13_start_hour)*60 + int(break_time13_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '常昼の昼休憩時間が60分を超えています。正しい休憩時間を登録して下さい。ERROR064')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 1直残業休憩時間1に長すぎる時間を登録しようとした時の処理
    if (int(break_time2_end_hour)*60 + int(break_time2_end_min)) - \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min)) > 15 or \
      (((int(break_time2_end_hour)*60 + int(break_time2_end_min)) < \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min))) and \
      (int(break_time2_end_hour)*60 + int(break_time2_end_min) + 1440) - \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '1直残業時間中の休憩時間1が15分を超えています。正しい休憩時間を登録して下さい。ERROR065')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 1直残業休憩時間2に長すぎる時間を登録しようとした時の処理
    if (int(break_time3_end_hour)*60 + int(break_time3_end_min)) - \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min)) > 60 or \
      (((int(break_time3_end_hour)*60 + int(break_time3_end_min)) < \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min))) and \
      (int(break_time3_end_hour)*60 + int(break_time3_end_min) + 1440) - \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '1直残業時間中の休憩時間2が60分を超えています。正しい休憩時間を登録して下さい。ERROR066')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 1直残業休憩時間3に長すぎる時間を登録しようとした時の処理
    if (int(break_time4_end_hour)*60 + int(break_time4_end_min)) - \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min)) > 15 or \
      (((int(break_time4_end_hour)*60 + int(break_time4_end_min)) < \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min))) and \
      (int(break_time4_end_hour)*60 + int(break_time4_end_min) + 1440) - \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '1直残業時間中の休憩時間3が15分を超えています。正しい休憩時間を登録して下さい。ERROR067')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 2直残業休憩時間1に長すぎる時間を登録しようとした時の処理
    if (int(break_time6_end_hour)*60 + int(break_time6_end_min)) - \
      (int(break_time6_start_hour)*60 + int(break_time6_start_min)) > 15 or \
      (((int(break_time6_end_hour)*60 + int(break_time6_end_min)) < \
      (int(break_time6_start_hour)*60 + int(break_time6_start_min))) and \
      (int(break_time6_end_hour)*60 + int(break_time6_end_min) + 1440) - \
      (int(break_time6_start_hour)*60 + int(break_time6_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '2直残業時間中の休憩時間1が15分を超えています。正しい休憩時間を登録して下さい。ERROR068')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 2直残業休憩時間2に長すぎる時間を登録しようとした時の処理
    if (int(break_time7_end_hour)*60 + int(break_time7_end_min)) - \
      (int(break_time7_start_hour)*60 + int(break_time7_start_min)) > 60 or \
      (((int(break_time7_end_hour)*60 + int(break_time7_end_min)) < \
      (int(break_time7_start_hour)*60 + int(break_time7_start_min))) and \
      (int(break_time7_end_hour)*60 + int(break_time7_end_min) + 1440) - \
      (int(break_time7_start_hour)*60 + int(break_time7_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '2直残業時間中の休憩時間2が60分を超えています。正しい休憩時間を登録して下さい。ERROR069')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 2直残業休憩時間3に長すぎる時間を登録しようとした時の処理
    if (int(break_time8_end_hour)*60 + int(break_time8_end_min)) - \
      (int(break_time8_start_hour)*60 + int(break_time8_start_min)) > 15 or \
      (((int(break_time8_end_hour)*60 + int(break_time8_end_min)) < \
      (int(break_time8_start_hour)*60 + int(break_time8_start_min))) and \
      (int(break_time8_end_hour)*60 + int(break_time8_end_min) + 1440) - \
      (int(break_time8_start_hour)*60 + int(break_time8_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '2直残業時間中の休憩時間3が15分を超えています。正しい休憩時間を登録して下さい。ERROR070')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 3直残業休憩時間1に長すぎる時間を登録しようとした時の処理
    if (int(break_time10_end_hour)*60 + int(break_time10_end_min)) - \
      (int(break_time10_start_hour)*60 + int(break_time10_start_min)) > 15 or \
      (((int(break_time10_end_hour)*60 + int(break_time10_end_min)) < \
      (int(break_time10_start_hour)*60 + int(break_time10_start_min))) and \
      (int(break_time10_end_hour)*60 + int(break_time10_end_min) + 1440) - \
      (int(break_time10_start_hour)*60 + int(break_time10_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '3直残業時間中の休憩時間1が15分を超えています。正しい休憩時間を登録して下さい。ERROR071')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 3直残業休憩時間2に長すぎる時間を登録しようとした時の処理
    if (int(break_time11_end_hour)*60 + int(break_time11_end_min)) - \
      (int(break_time11_start_hour)*60 + int(break_time11_start_min)) > 60 or \
      (((int(break_time11_end_hour)*60 + int(break_time11_end_min)) < \
      (int(break_time11_start_hour)*60 + int(break_time11_start_min))) and \
      (int(break_time11_end_hour)*60 + int(break_time11_end_min) + 1440) - \
      (int(break_time11_start_hour)*60 + int(break_time11_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '3直残業時間中の休憩時間2が60分を超えています。正しい休憩時間を登録して下さい。ERROR072')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 3直残業休憩時間3に長すぎる時間を登録しようとした時の処理
    if (int(break_time12_end_hour)*60 + int(break_time12_end_min)) - \
      (int(break_time12_start_hour)*60 + int(break_time12_start_min)) > 15 or \
      (((int(break_time12_end_hour)*60 + int(break_time12_end_min)) < \
      (int(break_time12_start_hour)*60 + int(break_time12_start_min))) and \
      (int(break_time12_end_hour)*60 + int(break_time12_end_min) + 1440) - \
      (int(break_time12_start_hour)*60 + int(break_time12_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '3直残業時間中の休憩時間3が15分を超えています。正しい休憩時間を登録して下さい。ERROR073')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 常昼残業休憩時間1に長すぎる時間を登録しようとした時の処理
    if (int(break_time14_end_hour)*60 + int(break_time14_end_min)) - \
      (int(break_time14_start_hour)*60 + int(break_time14_start_min)) > 15 or \
      (((int(break_time14_end_hour)*60 + int(break_time14_end_min)) < \
      (int(break_time14_start_hour)*60 + int(break_time14_start_min))) and \
      (int(break_time14_end_hour)*60 + int(break_time14_end_min) + 1440) - \
      (int(break_time14_start_hour)*60 + int(break_time14_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '常昼残業時間中の休憩時間1が15分を超えています。正しい休憩時間を登録して下さい。ERROR074')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 常昼残業休憩時間2に長すぎる時間を登録しようとした時の処理
    if (int(break_time15_end_hour)*60 + int(break_time15_end_min)) - \
      (int(break_time15_start_hour)*60 + int(break_time15_start_min)) > 60 or \
      (((int(break_time15_end_hour)*60 + int(break_time15_end_min)) < \
      (int(break_time15_start_hour)*60 + int(break_time15_start_min))) and \
      (int(break_time15_end_hour)*60 + int(break_time15_end_min) + 1440) - \
      (int(break_time15_start_hour)*60 + int(break_time15_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '常昼残業時間中の休憩時間2が60分を超えています。正しい休憩時間を登録して下さい。ERROR075')
      # このページをリダイレクト
      return redirect(to = '/break_time')

    # 常昼残業休憩時間3に長すぎる時間を登録しようとした時の処理
    if (int(break_time16_end_hour)*60 + int(break_time16_end_min)) - \
      (int(break_time16_start_hour)*60 + int(break_time16_start_min)) > 15 or \
      (((int(break_time16_end_hour)*60 + int(break_time16_end_min)) < \
      (int(break_time16_start_hour)*60 + int(break_time16_start_min))) and \
      (int(break_time16_end_hour)*60 + int(break_time16_end_min) + 1440) - \
      (int(break_time16_start_hour)*60 + int(break_time16_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '常昼残業時間中の休憩時間3が15分を超えています。正しい休憩時間を登録して下さい。ERROR076')
      # このページをリダイレクト
      return redirect(to = '/break_time')


    # POST送信された休憩時間を上書きする 
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'break_time1' : '#' + break_time1, \
                                    'break_time1_over1' : '#' + break_time2, \
                                    'break_time1_over2' : '#' + break_time3, \
                                    'break_time1_over3' : '#' + break_time4, \
                                    'break_time2' : '#' + break_time5, \
                                    'break_time2_over1' : '#' + break_time6, \
                                    'break_time2_over2' : '#' + break_time7, \
                                    'break_time2_over3' : '#' + break_time8, \
                                    'break_time3' : '#' + break_time9, \
                                    'break_time3_over1' : '#' + break_time10, \
                                    'break_time3_over2' : '#' + break_time11, \
                                    'break_time3_over3' : '#' + break_time12, \
                                    'break_time4' : '#' + break_time13, \
                                    'break_time4_over1' : '#' + break_time14, \
                                    'break_time4_over2' : '#' + break_time15, \
                                    'break_time4_over3' : '#' + break_time16})
    
    # 工数MENU画面に戻る
    return redirect(to = '/kosu_main')



  # 休憩データ取得
  break_data = member.objects.get(employee_no = request.session['login_No'])
  break1 = break_data.break_time1
  break1_1 = break_data.break_time1_over1
  break1_2 = break_data.break_time1_over2
  break1_3 = break_data.break_time1_over3
  break2 = break_data.break_time2
  break2_1 = break_data.break_time2_over1
  break2_2 = break_data.break_time2_over2
  break2_3 = break_data.break_time2_over3
  break3 = break_data.break_time3
  break3_1 = break_data.break_time3_over1
  break3_2 = break_data.break_time3_over2
  break3_3 = break_data.break_time3_over3
  break4 = break_data.break_time4
  break4_1 = break_data.break_time4_over1
  break4_2 = break_data.break_time4_over2
  break4_3 = break_data.break_time4_over3

  # フォーム初期値定義
  default_start_time1 = break1[1 : 3] + ':' + break1[3 : 5]
  default_end_time1 = break1[5 : 7] + ':' + break1[7 : ]
  default_start_time2 = break1_1[1 : 3] + ':' + break1_1[3 : 5]
  default_end_time2 = break1_1[5 : 7] + ':' + break1_1[7 : ]
  default_start_time3 = break1_2[1 : 3] + ':' + break1_2[3 : 5]
  default_end_time3 = break1_2[5 : 7] + ':' + break1_2[7 : ]
  default_start_time4 = break1_3[1 : 3] + ':' + break1_3[3 : 5]
  default_end_time4 = break1_3[5 : 7] + ':' + break1_3[7 : ]
  default_start_time5 = break2[1 : 3] + ':' + break2[3 : 5]
  default_end_time5 = break2[5 : 7] + ':' + break2[7 : ]
  default_start_time6 = break2_1[1 : 3] + ':' + break2_1[3 : 5]
  default_end_time6 = break2_1[5 : 7] + ':' + break2_1[7 : ]
  default_start_time7 = break2_2[1 : 3] + ':' + break2_2[3 : 5]
  default_end_time7 = break2_2[5 : 7] + ':' + break2_2[7 : ]
  default_start_time8 = break2_3[1 : 3] + ':' + break2_3[3 : 5]
  default_end_time8 = break2_3[5 : 7] + ':' + break2_3[7 : ]
  default_start_time9 = break3[1 : 3] + ':' + break3[3 : 5]
  default_end_time9 = break3[5 : 7] + ':' + break3[7 : ]
  default_start_time10 = break3_1[1 : 3] + ':' + break3_1[3 : 5]
  default_end_time10 = break3_1[5 : 7] + ':' + break3_1[7 : ]
  default_start_time11 = break3_2[1 : 3] + ':' + break3_2[3 : 5]
  default_end_time11 = break3_2[5 : 7] + ':' + break3_2[7 : ]
  default_start_time12 = break3_3[1 : 3] + ':' + break3_3[3 : 5]
  default_end_time12 = break3_3[5 : 7] + ':' + break3_3[7 : ]
  default_start_time13 = break4[1 : 3] + ':' + break4[3 : 5]
  default_end_time13 = break4[5 : 7] + ':' + break4[7 : ]
  default_start_time14 = break4_1[1 : 3] + ':' + break4_1[3 : 5]
  default_end_time14 = break4_1[5 : 7] + ':' + break4_1[7 : ]
  default_start_time15 = break4_2[1 : 3] + ':' + break4_2[3 : 5]
  default_end_time15 = break4_2[5 : 7] + ':' + break4_2[7 : ]
  default_start_time16 = break4_3[1 : 3] + ':' + break4_3[3 : 5]
  default_end_time16 = break4_3[5 : 7] + ':' + break4_3[7 : ]



  # HTMLに渡す辞書
  context = {
    'title' : '休憩時間定義',
    'default_start_time1' : default_start_time1,
    'default_end_time1' : default_end_time1,
    'default_start_time2' : default_start_time2,
    'default_end_time2' : default_end_time2,
    'default_start_time3' : default_start_time3,
    'default_end_time3' : default_end_time3,
    'default_start_time4' : default_start_time4,
    'default_end_time4' : default_end_time4,
    'default_start_time5' : default_start_time5,
    'default_end_time5' : default_end_time5,
    'default_start_time6' : default_start_time6,
    'default_end_time6' : default_end_time6,
    'default_start_time7' : default_start_time7,
    'default_end_time7' : default_end_time7,
    'default_start_time8' : default_start_time8,
    'default_end_time8' : default_end_time8,
    'default_start_time9' : default_start_time9,
    'default_end_time9' : default_end_time9,
    'default_start_time10' : default_start_time10,
    'default_end_time10' : default_end_time10,
    'default_start_time11' : default_start_time11,
    'default_end_time11' : default_end_time11,
    'default_start_time12' : default_start_time12,
    'default_end_time12' : default_end_time12,
    'default_start_time13' : default_start_time13,
    'default_end_time13' : default_end_time13,
    'default_start_time14' : default_start_time14,
    'default_end_time14' : default_end_time14,
    'default_start_time15' : default_start_time15,
    'default_end_time15' : default_end_time15,
    'default_start_time16' : default_start_time16,
    'default_end_time16' : default_end_time16,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/break_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 当日休憩変更定義画面定義
def today_break_time(request): 

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # セッションに工数入力日がない場合の処理
  if request.session.get('break_today', None) == None:
    # 工数入力画面に飛ぶ
    return redirect(to = '/input')
  


  # POST時の処理
  if (request.method == 'POST'):
    # POSTされた値を変数に入れる
    break_time1_start = request.POST['start_time1']
    break_time1_end = request.POST['end_time1']
    break_time2_start = request.POST['start_time2']
    break_time2_end = request.POST['end_time2']
    break_time3_start = request.POST['start_time3']
    break_time3_end = request.POST['end_time3']
    break_time4_start = request.POST['start_time4']
    break_time4_end = request.POST['end_time4']

    # 休憩1開始時間の区切りのインデックス取得
    break_time1_start_index = break_time1_start.index(':')
    # 休憩1開始時取得
    break_time1_start_hour = break_time1_start[ : break_time1_start_index]
    # 休憩1開始分取得
    break_time1_start_min = break_time1_start[break_time1_start_index + 1 : ]
    # 休憩1終了時間の区切りのインデックス取得
    break_time1_end_index = break_time1_end.index(':')
    # 休憩1終了時取得
    break_time1_end_hour = break_time1_end[ : break_time1_end_index]
    # 休憩1終了分取得
    break_time1_end_min = break_time1_end[break_time1_end_index + 1 : ]
    # 休憩2開始時間の区切りのインデックス取得
    break_time2_start_index = break_time2_start.index(':')
    # 休憩2開始時取得
    break_time2_start_hour = break_time2_start[ : break_time2_start_index]
    # 休憩2開始分取得
    break_time2_start_min = break_time2_start[break_time2_start_index + 1 : ]
    # 休憩2終了時間の区切りのインデックス取得
    break_time2_end_index = break_time2_end.index(':')
    # 休憩2終了時取得
    break_time2_end_hour = break_time2_end[ : break_time2_end_index]
    # 休憩2終了分取得
    break_time2_end_min = break_time2_end[break_time2_end_index + 1 : ]
    # 休憩3開始時間の区切りのインデックス取得
    break_time3_start_index = break_time3_start.index(':')
    # 休憩3開始時取得
    break_time3_start_hour = break_time3_start[ : break_time3_start_index]
    # 休憩3開始分取得
    break_time3_start_min = break_time3_start[break_time3_start_index + 1 : ]
    # 休憩3終了時間の区切りのインデックス取得
    break_time3_end_index = break_time3_end.index(':')
    # 休憩3終了時取得
    break_time3_end_hour = break_time3_end[ : break_time3_end_index]
    # 休憩3終了分取得
    break_time3_end_min = break_time3_end[break_time3_end_index + 1 : ]
    # 休憩4開始時間の区切りのインデックス取得
    break_time4_start_index = break_time4_start.index(':')
    # 休憩4開始時取得
    break_time4_start_hour = break_time4_start[ : break_time4_start_index]
    # 休憩4開始分取得
    break_time4_start_min = break_time4_start[break_time4_start_index + 1 : ]
    # 休憩4終了時間の区切りのインデックス取得
    break_time4_end_index = break_time4_end.index(':')
    # 休憩4終了時取得
    break_time4_end_hour = break_time4_end[ : break_time4_end_index]
    # 休憩4終了分取得
    break_time4_end_min = break_time4_end[break_time4_end_index + 1 : ]

    # POSTされた値をまとめる
    break_time1 = break_time1_start_hour.zfill(2) + break_time1_start_min + \
                  break_time1_end_hour.zfill(2) + break_time1_end_min
    break_time2 = break_time2_start_hour.zfill(2) + break_time2_start_min + \
                  break_time2_end_hour.zfill(2) + break_time2_end_min
    break_time3 = break_time3_start_hour.zfill(2) + break_time3_start_min + \
                  break_time3_end_hour.zfill(2) + break_time3_end_min
    break_time4 = break_time4_start_hour.zfill(2) + break_time4_start_min + \
                  break_time4_end_hour.zfill(2) + break_time4_end_min


    # 昼休憩時間に長すぎる時間を登録しようとした時の処理
    if (int(break_time1_end_hour)*60 + int(break_time1_end_min)) - \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min)) > 60 or \
      (((int(break_time1_end_hour)*60 + int(break_time1_end_min)) < \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min))) and \
      (int(break_time1_end_hour)*60 + int(break_time1_end_min) + 1440) - \
      (int(break_time1_start_hour)*60 + int(break_time1_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '昼休憩時間が60分を超えています。正しい休憩時間を登録して下さい。ERROR012')
      # このページをリダイレクト
      return redirect(to = '/today_break_time')

    # 残業休憩時間1に長すぎる時間を登録しようとした時の処理
    if (int(break_time2_end_hour)*60 + int(break_time2_end_min)) - \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min)) > 15 or \
      (((int(break_time2_end_hour)*60 + int(break_time2_end_min)) < \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min))) and \
      (int(break_time2_end_hour)*60 + int(break_time2_end_min) + 1440) - \
      (int(break_time2_start_hour)*60 + int(break_time2_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '残業時間中の休憩時間1が15分を超えています。正しい休憩時間を登録して下さい。ERROR013')
      # このページをリダイレクト
      return redirect(to = '/today_break_time')

    # 残業休憩時間2に長すぎる時間を登録しようとした時の処理
    if (int(break_time3_end_hour)*60 + int(break_time3_end_min)) - \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min)) > 60 or \
      (((int(break_time3_end_hour)*60 + int(break_time3_end_min)) < \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min))) and \
      (int(break_time3_end_hour)*60 + int(break_time3_end_min) + 1440) - \
      (int(break_time3_start_hour)*60 + int(break_time3_start_min)) > 60):
      # エラーメッセージ出力
      messages.error(request, '残業時間中の休憩時間2が60分を超えています。正しい休憩時間を登録して下さい。ERROR014')
      # このページをリダイレクト
      return redirect(to = '/today_break_time')

    # 残業休憩時間3に長すぎる時間を登録しようとした時の処理
    if (int(break_time4_end_hour)*60 + int(break_time4_end_min)) - \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min)) > 15 or \
      (((int(break_time4_end_hour)*60 + int(break_time4_end_min)) < \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min))) and \
      (int(break_time4_end_hour)*60 + int(break_time4_end_min) + 1440) - \
      (int(break_time4_start_hour)*60 + int(break_time4_start_min)) > 15):
      # エラーメッセージ出力
      messages.error(request, '残業時間中の休憩時間3が15分を超えています。正しい休憩時間を登録して下さい。ERROR015')
      # このページをリダイレクト
      return redirect(to = '/today_break_time')


    # 工数データあるか確認
    kosu_data_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2 = request.session['break_today'])

    # 工数データある場合の処理
    if kosu_data_filter.count() != 0:
      # 工数データ取得
      kosu_data_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                      work_day2 = request.session['break_today'])

      # 作業内容と作業詳細をリストに解凍
      kosu_def = list(kosu_data_get.time_work)
      detail_list = kosu_data_get.detail_work.split('$')

      # 休憩1開始時間のインデント取得
      break_start1 = int(int(break_time1_start_hour)*12 + int(break_time1_start_min)/5)
  
      # 休憩1終了時間のインデント取得
      break_end1 = int(int(break_time1_end_hour)*12 + int(break_time1_end_min)/5)

      # 休憩1の日またぎ変数リセット
      break_next_day1 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start1 > break_end1:
        # 休憩1の日またぎ変数に1を入れる
        break_next_day1 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩1の日またぎ変数に0を入れる
        break_next_day1 = 0

      # 休憩2開始時間のインデント取得
      break_start2 = int(int(break_time2_start_hour)*12 + int(break_time2_start_min)/5)

      # 休憩2終了時間のインデント取得
      break_end2 = int(int(break_time2_end_hour)*12 + int(break_time2_end_min)/5)

      # 休憩2の日またぎ変数リセット
      break_next_day2 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start2 > break_end2:
        # 休憩2の日またぎ変数に1を入れる
        break_next_day2 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩2の日またぎ変数に0を入れる
        break_next_day2 = 0

      # 休憩3開始時間のインデント取得
      break_start3 = int(int(break_time3_start_hour)*12 + int(break_time3_start_min)/5)

      # 休憩3終了時間のインデント取得
      break_end3 = int(int(break_time3_end_hour)*12 + int(break_time3_end_min)/5)

      # 休憩3の日またぎ変数リセット
      break_next_day3 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start3 > break_end3:
        # 休憩3の日またぎ変数に1を入れる
        break_next_day3 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩3の日またぎ変数に0を入れる
        break_next_day3 = 0

      # 休憩4開始時間のインデント取得
      break_start4 = int(int(break_time4_start_hour)*12 + int(break_time4_start_min)/5)

      # 休憩4終了時間のインデント取得
      break_end4 = int(int(break_time4_end_hour)*12 + int(break_time4_end_min)/5)

      # 休憩4の日またぎ変数リセット
      break_next_day4 = 0

      # 休憩開始時間より終了時間の方が早い場合の処理
      if break_start4 > break_end4:
        # 休憩4の日またぎ変数に1を入れる
        break_next_day4 = 1

      # 休憩開始時間より終了時間の方が遅い場合の処理
      else:
        # 休憩4の日またぎ変数に0を入れる
        break_next_day4 = 0


      # 休憩1が日を超えている場合の処理
      if break_next_day1 == 1:
        # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
        for bt1 in range(break_start1, 288):
          # 作業内容リストの要素を空にする
          kosu_def[bt1] = '#'

          # 作業詳細リストの要素を空にする
          detail_list[bt1] = ''


        # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
        for bt1 in range(break_end1):
          # 作業内容リストの要素を空にする
          kosu_def[bt1] = '#'

          # 作業詳細リストの要素を空にする
          detail_list[bt1] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end1] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
          for bt1 in range(break_start1, 288):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt1] = '$'


          # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
          for bt1 in range(break_end1):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt1] = '$'


      # 休憩1が日を超えていない場合の処理
      else:
        # 休憩時間内の工数データと作業詳細を消すループ
        for bt1 in range(break_start1, break_end1):
          # 作業内容リストの要素を空にする
          kosu_def[bt1] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt1] = ''
 

        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end1] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ
          for bt1 in range(break_start1, break_end1):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt1] = '$'


      # 休憩2が日を超えている場合の処理
      if break_next_day2 == 1:
        # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
        for bt2 in range(break_start2, 288):
          # 作業内容リストの要素を空にする
          kosu_def[bt2] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt2] = ''


        # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
        for bt2 in range(break_end2):
          # 作業内容リストの要素を空にする
          kosu_def[bt2] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt2] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end2] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
          for bt2 in range(break_start2, 288):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt2] = '$'


          # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
          for bt2 in range(break_end2):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt2] = '$'


      # 休憩2が日を超えていない場合の処理
      else:
        # 休憩時間内の工数データと作業詳細を消すループ
        for bt2 in range(break_start2, break_end2):
          # 作業内容リストの要素を空にする
          kosu_def[bt2] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt2] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end2] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ
          for bt2 in range(break_start2, break_end2):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt2] = '$'


      # 休憩3が日を超えている場合の処理
      if break_next_day3 == 1:
        # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
        for bt3 in range(break_start3, 288):
          # 作業内容リストの要素を空にする
          kosu_def[bt3] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt3] = ''


        # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
        for bt2 in range(break_end3):
          # 作業内容リストの要素を空にする
          kosu_def[bt3] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt3] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end3] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
          for bt3 in range(break_start3, 288):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt3] = '$'


          # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
          for bt3 in range(break_end3):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt3] = '$'


      # 休憩3が日を超えていない場合の処理
      else:
        # 休憩時間内の工数データと作業詳細を消す
        for bt3 in range(break_start3, break_end3):
          # 作業内容リストの要素を空にする
          kosu_def[bt3] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt3] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end3] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ
          for bt3 in range(break_start3, break_end3):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt3] = '$'


      # 休憩4が日を超えている場合の処理
      if break_next_day4 == 1:
        # 休憩時間内の工数データと作業詳細を消すループ(休憩時間開始～24時まで)
        for bt4 in range(break_start4, 288):
          # 作業内容リストの要素を空にする
          kosu_def[bt4] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt4] = ''


        # 休憩時間内の工数データと作業詳細を消すループ(0時～休憩時間終了まで)
        for bt4 in range(break_end4):
          # 作業内容リストの要素を空にする
          kosu_def[bt4] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt4] = ''


        # 休憩時間直後の時間に工数入力がある場合の処理
        if kosu_def[break_end4] != '#':
          # 休憩時間内の工数データを休憩に書き換えるループ(休憩時間開始～24時まで)
          for bt4 in range(break_start4, 288):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt4] = '$'


          # 休憩時間内の工数データを休憩に書き換えるループ(0時～休憩時間終了まで)
          for bt4 in range(break_end4):
            # 作業内容リストの要素を休憩に書き換え
            kosu_def[bt4] = '$'


      # 休憩4が日を超えていない場合の処理
      else:
        # 休憩時間内の工数データと作業詳細を消すループ
        for bt4 in range(break_start4, break_end4):
          # 作業内容リストの要素を空にする
          kosu_def[bt4] = '#'
          # 作業詳細リストの要素を空にする
          detail_list[bt4] = ''


      # 休憩時間直後の時間に工数入力がある場合の処理
      if kosu_def[break_end4] != '#':
        # 休憩時間内の工数データを休憩に書き換えるループ
        for bt4 in range(break_start4, break_end4):
          # 作業内容リストの要素を休憩に書き換え
          kosu_def[bt4] = '$'


      # 作業詳細変数リセット
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


      # 作業内容データの内容を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session.get('login_No', None), \
                                                  work_day2 = request.session.get('break_today', None), \
                                                  defaults = {'time_work' : ''.join(kosu_def), \
                                                              'detail_work' : detail_list_str, \
                                                              'breaktime' : '#' + break_time1, \
                                                              'breaktime_over1' : '#' + break_time2, \
                                                              'breaktime_over2' : '#' + break_time3, \
                                                              'breaktime_over3' : '#' + break_time4})


    # 工数データない場合の処理
    else:
      # 従業員番号に該当するmemberインスタンスを取得
      member_instance = member.objects.get(employee_no = request.session['login_No'])

      # 作業内容データの内容を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session.get('login_No', None), \
                                                  work_day2 = request.session.get('break_today', None), \
                                                  defaults = {'name' : member_instance, \
                                                              'time_work' : '#'*288, \
                                                              'detail_work' : '$'*287, \
                                                              'breaktime' : '#' + break_time1, \
                                                              'breaktime_over1' : '#' + break_time2, \
                                                              'breaktime_over2' : '#' + break_time3, \
                                                              'breaktime_over3' : '#' + break_time4})
    
    # 工数入力ページへ飛ぶ
    return redirect(to = '/input')



  # 工数データあるか確認
  break_data_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                  work_day2 = request.session.get('break_today', None))

  # 工数データがある場合の処理
  if break_data_filter.count() != 0:
    # 工数データ取得
    break_data_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                     work_day2 = request.session.get('break_today', None))
    
    # 休憩データ取得
    break1 = break_data_get.breaktime
    break1_1 = break_data_get.breaktime_over1
    break1_2 = break_data_get.breaktime_over2
    break1_3 = break_data_get.breaktime_over3

    # フォーム初期値定義
    default_start_time1 = break1[1 : 3] + ':' + break1[3 : 5]
    default_end_time1 = break1[5 : 7] + ':' + break1[7 : ]
    default_start_time2 = break1_1[1 : 3] + ':' + break1_1[3 : 5]
    default_end_time2 = break1_1[5 : 7] + ':' + break1_1[7 : ]
    default_start_time3 = break1_2[1 : 3] + ':' + break1_2[3 : 5]
    default_end_time3 = break1_2[5 : 7] + ':' + break1_2[7 : ]
    default_start_time4 = break1_3[1 : 3] + ':' + break1_3[3 : 5]
    default_end_time4 = break1_3[5 : 7] + ':' + break1_3[7 : ]

  # 工数データがない場合の処理
  else:
    # 空のフォーム初期値定義
    default_start_time1 = ''
    default_end_time1 = ''
    default_start_time2 = ''
    default_end_time2 = ''
    default_start_time3 = ''
    default_end_time3 = ''
    default_start_time4 = ''
    default_end_time4 = ''



  # HTMLに渡す辞書
  context = {
    'title' : '休憩変更',
    'data' : break_data_get,
    'default_start_time1' : default_start_time1,
    'default_end_time1' : default_end_time1,
    'default_start_time2' : default_start_time2,
    'default_end_time2' : default_end_time2,
    'default_start_time3' : default_start_time3,
    'default_end_time3' : default_end_time3,
    'default_start_time4' : default_start_time4,
    'default_end_time4' : default_end_time4,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/today_break_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数詳細確認画面定義
def detail(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 作業内容と作業詳細を取得しリストに解凍
  work_list = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')

  # 作業内容と作業詳細のリストを2個連結
  work_list = work_list*2
  detail_list = detail_list*2

  # 1直の時の処理
  if obj_get.tyoku2 == '1':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    del work_list[:54]
    del detail_list[:54]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
        data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
        data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える
    del work_list[:216]
    del detail_list[:216]
    del work_list[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える
    del work_list[:72]
    del detail_list[:72]
    del work_list[288:]
    del detail_list[288:]


  # 作業時間リストリセット
  kosu_list = []
  time_list_start = []
  time_list_end = []
  def_list = []
  def_time = []
  detail_time = []
  find_list =[]

  # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
  for i in range(288):

    # 最初の要素に作業が入っている場合の処理
    if i == 0 and work_list[i] != '#':
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 54)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 144)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 108)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '(P,R,T,その他)') and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 246)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 72)

    # 時間区分毎に前の作業との差異がある場合の処理
    if i != 0 and (work_list[i] != work_list[i - 1] or detail_list[i] != detail_list[i - 1]):
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 234)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 54)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 72)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
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

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 233)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 55)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 143)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 145)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 179)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 109)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 41)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 247)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 71)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 217)

      elif obj_get.tyoku2 == '4':
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
  kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))

  # 工数区分登録カウンターリセット
  n = 0
  # 工数区分登録数カウント
  for kosu_num in range(1, 50):
    if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != None:
      n = kosu_num

  # 工数区分処理用記号リスト用意
  str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
              'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                    'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
  # リストの長さを工数区分の登録数に応じて調整
  del str_list[n:]

  # 工数区分の選択リスト作成
  for i, m in enumerate(str_list):
    # 工数区分定義要素を追加
    def_list.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

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
      detail_time.append(detail_list[t])
  
  # 工数データに工数定義区分Verがある場合の処理
  if obj_get.def_ver2 not in [None, '']:
    # 現在使用している工数区分のオブジェクトを取得
    kosu_obj = kosu_division.objects.get(kosu_name = obj_get.def_ver2)

    # 工数区分登録カウンターリセット
    n = 0

    # 工数区分登録数カウント
    for kosu_num in range(1, 50):
      if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) not in [None, '']:
        n = kosu_num

    # 工数区分処理用記号リスト用意
    str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                  'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                      'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]

    # リストの長さを工数区分の登録数に応じて調整
    del str_list[n:]


  # HTML表示用リスト作成
  time_display_list = []
  for k in range(len(time_list_start)):
    # 一時置きリスト定義
    for_list = []

    # 工数区分定義の選択リスト作成
    choices_list = ''
    # 工数区分定義リストに項目追加
    if def_time[k] == '':
      choices_list += '<option value="{}" selected>{}</option>'.format('#', '-')
    else:
      choices_list += '<option value="{}">{}</option>'.format('#', '-')

    for i, m in enumerate(str_list):
      if def_time[k] == eval('kosu_obj.kosu_title_{}'.format(i + 1)):
        choices_list += '<option value="{}" selected>{}</option>'.format(m, eval('kosu_obj.kosu_title_{}'.format(i + 1)))
      else:
        choices_list += '<option value="{}">{}</option>'.format(m, eval('kosu_obj.kosu_title_{}'.format(i + 1)))

    if def_time[k] == '休憩':
      choices_list += '<option value="{}" selected>{}</option>'.format('$', '休憩')
    else:
      choices_list += '<option value="{}">{}</option>'.format('$', '休憩')


    for_list.append('<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="start_time{}" data-precision="5" value={}>'.format(k + 1, str(time_list_start[k])) + '～' + '<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="end_time{}" data-precision="5" value={}>'.format(k + 1, str(time_list_end[k])))
    for_list.append('<select name="def_time{}" class="form-control custom-border mx-auto controlled-input" style="width : 210px;">'.format(k + 1) + choices_list + '</select>')
    for_list.append('<input class="form-control custom-border mx-auto controlled-input" style="width : 210px;" type="text" name="detail_time{}" value="{}">'.format(k + 1, detail_time[k]))
    time_display_list.append(for_list)

  # 次の問い合わせデータ取得
  next_record = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                   work_day2__gt = obj_get.work_day2).order_by('work_day2').first()
  # 次の問い合わせデータあるか確認
  has_next_record = next_record is not None

  # 前の問い合わせデータ取得
  before_record = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                     work_day2__lt = obj_get.work_day2).order_by('-work_day2').first()
  # 前の問い合わせデータあるか確認
  has_before_record = before_record is not None



  # 就業日変更時の処理
  if "edit_day" in request.POST:
    # 指定日に工数データがある場合の処理
    if request.POST['kosu_day'] == '':
      # エラーメッセージ出力
      messages.error(request, '変更する日付を指定して下さい。ERROR096')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
    
    # 指定日に工数データがあるか確認
    obj_check = Business_Time_graph.objects.filter(work_day2 = request.POST['kosu_day'])

    # 指定日に工数データがある場合の処理
    if obj_check.count() != 0:
      # エラーメッセージ出力
      messages.error(request, '指定された日は既に工数データが存在します。指定日のデータを削除してから再度実行下さい。ERROR095')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(id = num, \
                                                 defaults = {'work_day2' : request.POST['kosu_day']})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 時間指定工数削除時の処理
  if "kosu_delete" in request.POST:
    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')
    start_time = request.POST['start_time']
    end_time = request.POST['end_time']

    # 時間指定を空でPOSTした場合の処理
    if start_time == '' or end_time == '':
      # エラーメッセージ出力
      messages.error(request, '時間が指定されていません。ERROR005')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
    

    # 作業開始時間の区切りのインデックス取得
    start_time_index = start_time.index(':')
    # 作業開始時取得
    start_time_hour = start_time[ : start_time_index]
    # 作業開始分取得
    start_time_min = start_time[start_time_index + 1 : ]
    # 作業終了時間の区切りのインデックス取得
    end_time_index = end_time.index(':')
    # 作業終了時取得
    end_time_hour = end_time[ : end_time_index]
    # 作業終了分取得
    end_time_min = end_time[end_time_index + 1 : ]

    # 作業開始時間のインデント取得
    start_indent = int(int(start_time_hour)*12 + int(start_time_min)/5)
    # 作業終了時間のインデント取得
    end_indent = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 翌日チェック状態リセット
    check = 0
    # 翌日チェックが入っている場合の処理
    if ('tomorrow_check' in request.POST):
      # 翌日チェック状態に1を入れる
      check = 1

    # 翌日チェックが入っていない場合の処理
    else:
      # 翌日チェック状態に0を入れる
      check = 0

    # 削除開始時間が削除終了時間より遅い時間の場合の処理
    if (start_indent > end_indent) and check == 0:
      # エラーメッセージ出力
      messages.error(request, '削除の開始時間が終了時間よりも遅い時間を指定されましたので処理できません。ERROR011')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 日を超えていない場合の処理
    if check == 0:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(start_indent, end_indent):
        work_list[i] = '#'
        detail_list[i] = ''

    # 日を超えている場合の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(start_indent , 288):
        work_list[i] = '#'
        detail_list[i] = ''
      for i in range(end_indent):
        work_list[i] = '#'
        detail_list[i] = ''

    # 作業詳細リストを文字列に変更
    detail_list_str = ''
    for i, e in enumerate(detail_list):
      if i == len(detail_list) - 1:
        detail_list_str = detail_list_str + detail_list[i]
      else:
        detail_list_str = detail_list_str + detail_list[i] + '$'


    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 工数入力OK_NGリセット
    judgement = False

    # 出勤、休出時、工数合計と残業に整合性がある場合の処理
    if (obj_get.work_time == '出勤' or obj_get.work_time == 'シフト出') and \
      kosu_total - int(obj_get.over_time) == 470:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 休出時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '休出' and kosu_total == int(obj_get.over_time):
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '早退・遅刻' and kosu_total != 0:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # ログイン者の人員データ取得
    member_obj = member.objects.get(employee_no = request.session['login_No'])


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 290:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 180:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 220:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 250:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 275:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 195:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 常昼の場合の処理
    if obj_get.tyoku2 == '4':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})


    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 項目指定工数削除時の処理
  if "item_delete" in request.POST:
    # 項目削除釦の項目名取得
    pressed_button = int(request.POST.get('item_delete'))

    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')

    # 日を跨いでいない時の処理
    if kosu_list[pressed_button - 1] < kosu_list[pressed_button]:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[pressed_button - 1], kosu_list[pressed_button]):
        work_list[i] = '#'
        detail_list[i] = ''
    
    # 日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[pressed_button - 1] , 288):
        work_list[i] = '#'
        detail_list[i] = ''

      for i in range(kosu_list[pressed_button]):
        work_list[i] = '#'
        detail_list[i] = ''


    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 工数入力OK_NGリセット
    judgement = False

    # 出勤、休出時、工数合計と残業に整合性がある場合の処理
    if (obj_get.work_time == '出勤' or obj_get.work_time == 'シフト出') and \
      kosu_total - int(obj_get.over_time) == 470:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 休出時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '休出' and kosu_total == int(obj_get.over_time):
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '早退・遅刻' and kosu_total != 0:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # ログイン者の人員データ取得
    member_obj = member.objects.get(employee_no = request.session['login_No'])


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 290:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 180:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 220:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 250:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 275:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 195:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 常昼の場合の処理
    if obj_get.tyoku2 == '4':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 作業詳細リストを文字列に変更
    detail_list_str = ''
    for i, e in enumerate(detail_list):
      if i == len(detail_list) - 1:
        detail_list_str = detail_list_str + detail_list[i]
      else:
        detail_list_str = detail_list_str + detail_list[i] + '$'


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 項目作業時間変更時の処理
  if "item_edit" in request.POST:
    # 項目名取得
    pressed_button = request.POST.get('item_edit')
    # 項目ID取得
    edit_id = int(pressed_button[2 : ])

    start_time = request.POST.get('start_time{}'.format(edit_id))
    end_time = request.POST.get('end_time{}'.format(edit_id))


    # 作業開始時間の指定がない場合の処理
    if start_time in ('', None):
      # エラーメッセージ出力
      messages.error(request, '時間が入力されていません。ERROR089')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
    
    # 作業終了時間の指定がない場合の処理
    if end_time in ('', None):
      # エラーメッセージ出力
      messages.error(request, '時間が入力されていません。ERROR090')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 作業詳細に'$'が含まれている場合の処理
    if '$' in request.POST.get('detail_time{}'.format(edit_id)):
      # エラーメッセージ出力
      messages.error(request, '作業詳細に『$』は使用できません。工数編集できませんでした。ERROR093')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 作業詳細に文字数が100文字以上の場合の処理
    if len(request.POST.get('detail_time{}'.format(edit_id))) >= 100:
      # エラーメッセージ出力
      messages.error(request, '作業詳細は100文字以内で入力して下さい。工数編集できませんでした。ERROR094')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
  
  
    # 作業開始時間の区切りのインデックス取得
    start_time_index = start_time.index(':')
    # 作業開始時取得
    start_time_hour = start_time[ : start_time_index]
    # 作業開始分取得
    start_time_min = start_time[start_time_index + 1 : ]
    # 作業終了時間の区切りのインデックス取得
    end_time_index = end_time.index(':')
    # 作業終了時取得
    end_time_hour = end_time[ : end_time_index]
    # 作業終了分取得
    end_time_min = end_time[end_time_index + 1 : ]

    # 作業開始時間のインデント取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    # 作業終了時間のインデント取得
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 作業開始時間と終了時間が同じ場合の処理
    if start_time_ind == end_time_ind:
      # エラーメッセージ出力
      messages.error(request, '入力された作業時間が正しくありません。ERROR088')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))


    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')


    # 変更前の作業時間が日を跨いでいない時の処理
    if kosu_list[edit_id - 1] < kosu_list[edit_id]:
      # 指定された時間の作業内容と作業詳細を消すループ
      for i in range(kosu_list[edit_id - 1], kosu_list[edit_id]):        
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''
        

    # 変更前の作業時間が日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[edit_id - 1] , 288):
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''


      for i in range(kosu_list[edit_id]):
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''


    # 変更後の作業時間が日を跨いでいない時の処理
    if start_time_ind < end_time_ind:
      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(start_time_ind, end_time_ind):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR085')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))
          
    # 変更後の作業時間が日を跨いでいる時の処理
    else:
      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(start_time_ind, 288):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR086')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))

      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(end_time_ind):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR087')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))


    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 工数入力OK_NGリセット
    judgement = False

    # 出勤、休出時、工数合計と残業に整合性がある場合の処理
    if (obj_get.work_time == '出勤' or obj_get.work_time == 'シフト出') and \
      kosu_total - int(obj_get.over_time) == 470:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 休出時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '休出' and kosu_total == int(obj_get.over_time):
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
    if obj_get.work_time == '早退・遅刻' and kosu_total != 0:
      # 工数入力OK_NGをOKに切り替え
      judgement = True


    # ログイン者の人員データ取得
    member_obj = member.objects.get(employee_no = request.session['login_No'])


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 290:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 180:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
    if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
      member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
        member_obj.shop == '組長以上(W,A)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '1':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 220:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 250:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '2':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
    if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
      member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
        member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
        obj_get.tyoku2 == '3':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 275:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 195:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 常昼の場合の処理
    if obj_get.tyoku2 == '4':
      # 半前年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半前年休' and kosu_total - int(obj_get.over_time) == 230:
        # 工数入力OK_NGをOKに切り替え
        judgement = True

      # 半後年休時、工数合計と残業に整合性がある場合の処理
      if obj_get.work_time == '半後年休' and kosu_total - int(obj_get.over_time) == 240:
        # 工数入力OK_NGをOKに切り替え
        judgement = True


    # 作業詳細リストを文字列に変更
    detail_list_str = ''
    for i, e in enumerate(detail_list):
      if i == len(detail_list) - 1:
        detail_list_str = detail_list_str + detail_list[i]
      else:
        detail_list_str = detail_list_str + detail_list[i] + '$'


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 次のデータへ
  if "after" in request.POST:
    # 前のデータ取得
    obj_after = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                   work_day2__gt = obj_get.work_day2).order_by('work_day2').first()
    # 前の工数詳細へ飛ぶ
    return redirect(to = '/detail/{}'.format(obj_after.id))



  # 前のデータへ
  if "before" in request.POST:
    # 前のデータ取得
    obj_before = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2__lt = obj_get.work_day2).order_by('-work_day2').first()
    # 前の工数詳細へ飛ぶ
    return redirect(to = '/detail/{}'.format(obj_before.id))



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'day' : obj_get.work_day2,
    'now_day' : str(obj_get.work_day2),
    'time_display_list' : time_display_list,
    'has_next_record' : has_next_record,
    'has_before_record' : has_before_record,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/detail.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数削除画面定義
def delete(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 作業内容と作業詳細を取得しリストに解凍
  work_list = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')

  # 作業内容と作業詳細のリストを2個連結
  work_list = work_list*2
  detail_list = detail_list*2

  # 1直の時の処理
  if obj_get.tyoku2 == '1':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    del work_list[:54]
    del detail_list[:54]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
        data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
        data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
        and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える
    del work_list[:216]
    del detail_list[:216]
    del work_list[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える
    del work_list[:72]
    del detail_list[:72]
    del work_list[288:]
    del detail_list[288:]


  # 作業時間リストリセット
  kosu_list = []
  time_list_start = []
  time_list_end = []
  def_list = []
  def_time = []
  detail_time = []
  find_list =[]

  # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
  for i in range(288):

    # 最初の要素に作業が入っている場合の処理
    if i == 0 and work_list[i] != '#':
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 234)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 54)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 72)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
        if i >= 216:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 216)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 72)

    # 時間区分毎に前の作業との差異がある場合の処理
    if i != 0 and (work_list[i] != work_list[i - 1] or detail_list[i] != detail_list[i - 1]):
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 234)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 54)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 72)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
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

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 233)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 55)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 143)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 145)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 179)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 109)

      elif (data.shop == 'P' or data.shop == 'R' or data.shop == 'T1' or data.shop == 'T2' or \
          data.shop == 'その他' or data.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 41)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 247)

      elif (data.shop == 'W1' or data.shop == 'W2' or data.shop == 'A1' or data.shop == 'A2' or data.shop == '組長以上(W,A)') \
            and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 71)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 217)

      elif obj_get.tyoku2 == '4':
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

        # 作業開始時間をSTRで定義
        time_obj_start = str(int(t)//12).zfill(2) + ':' + str(int(t)%12*5).zfill(2)


  # 現在使用している工数区分のオブジェクトを取得
  kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))

  # 工数区分登録カウンターリセット
  n = 0
  # 工数区分登録数カウント
  for kosu_num in range(1, 50):
    if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != None:
      n = kosu_num

  # 工数区分処理用記号リスト用意
  str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
              'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                    'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
  # リストの長さを工数区分の登録数に応じて調整
  del str_list[n:]

  # 工数区分の選択リスト作成
  for i, m in enumerate(str_list):
    # 工数区分定義要素を追加
    def_list.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

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
      detail_time.append(detail_list[t])

  # HTML表示用リスト作成
  time_display_list = []
  for k in range(len(time_list_start)):
    for_list = []
    for_list.append(str(time_list_start[k]) + '～' + str(time_list_end[k]))
    for_list.append(def_time[k])
    for_list.append(detail_time[k])
    time_display_list.append(for_list)


  # POST時の処理
  if (request.method == 'POST'):

    # 取得していた指定従業員番号のレコードを削除する
    obj_get.delete()

    # 工数履歴画面をリダイレクトする
    return redirect(to = '/list/1')


  # HTMLに渡す辞書
  context = {
    'title' : '工数データ削除',
    'id' : num,
    'time_display_list' : time_display_list,
    'day' : obj_get.work_day2,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/delete.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数集計画面定義
def total(request): 

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')



  # GET時の処理
  if (request.method == 'GET'):
    # 今日の日時を変数に格納
    today = datetime.date.today()

    # フォームの初期値に定義する辞書作成
    default_day = str(today)

    # フォームに初期値設定し定義
    form = kosu_dayForm()

    # ログイン者の工数集計データ取得
    kosu_total = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = today)
    
    # ログイン者の本日の工数集計データがない場合の処理
    if kosu_total.count() == 0:

      # 工数区分定義データ取得
      kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])
    
      # 工数区分定義の数をカウント
      def_num = 0
      for n in range(1, 51):
        if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
          def_num = n

      # 工数区分定義の選択リスト作成
      graph_item = []
      for i in range(def_num):
        graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))
      
      # 0が工数区分定義と同じ数入ったリスト作成
      graph_list = list(itertools.repeat(0, def_num))

    # ログイン者の本日の工数集計データがある場合の処理
    else:
      # ログイン者の工数集計データ取得
      graph_data = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                   work_day2 = today)

      # 工数データに工数区分定義の値がある場合の処理
      if graph_data.def_ver2 not in ('', None):
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = graph_data.def_ver2)

      # 工数データに工数区分定義の値がある場合の処理
      else:
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])


      # 工数区分定義の数をカウント
      def_num = 0
      for n in range(1, 51):
        if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
          def_num = n
        else:
          break

      # 工数区分定義の選択リスト作成
      graph_item = []
      for i in range(def_num):
        graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

      # 工数データリスト内の各文字を定義
      str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                    'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                        'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
      # 工数データリスト内の各文字を工数区分定義の数に調整
      del str_list[def_num:]

      # 各工数区分定義の累積工数リスト作成
      str_n = 0
      graph_list = []

      for i in str_list:
        str_n = graph_data.time_work.count(i)*5

        graph_list.append(str_n)
        str_n = 0

    # グラフ項目色定義
    color_list = ['plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 
                  'deepskyblue', 'aqua', 'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 
                  'lawngreen', 'greenyellow', 'gold', 'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 
                  'lightsalmon', 'tomato', 'orangered', 'red', 'deeppink', 'hotpink', 'violet', 'magenta', 
                  'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue', 'cadetblue', 'mediumseagreen', 
                  'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue', 'darkblue', 
                  'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon', 
                  'darkmagenta', 'indigo', 'black'] 



  # POST時の処理
  if (request.method == 'POST'):
    # 年間工数選択時処理
    if request.POST['kosu_summarize'] == '3':
      # POST送信された就業日を変数に入れる
      post_day = request.POST['kosu_day']
      # POST送信された就業日の年部分抜き出し
      kosu_year = post_day[: 4]

      # 指定年の工数取得
      kosu_total = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2__startswith = kosu_year)


      # 指定年に工数入力がない場合の処理
      if kosu_total.count() == 0:
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])
      
        # 工数区分定義の数をカウント
        def_num = 0
        for n in range(1, 51):
          if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
            def_num = n
          else:
            break

        # 工数区分定義の選択リスト作成
        graph_item = []
        for i in range(def_num):
          graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

        # 0が工数区分定義と同じ数入ったリスト作成
        graph_list = list(itertools.repeat(0, def_num))


      # 指定年に工数入力がある場合の処理
      else:
        # 年の最初の日の工数区分定義でグラフ項目リスト作成
        for ind, v in enumerate(kosu_total):
          # 工数区分定義が空でない場合の処理
          if v.def_ver2 not in ('', None):
            # 工数区分定義データ取得
            kosu_obj = kosu_division.objects.get(kosu_name = v.def_ver2)
            # 工数区分定義の数をカウント
            def_num = 0
            for n in range(1, 51):
              if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
                def_num = n
              else:
                break
            break

          # 工数区分定義が空の場合の処理
          else:
            if ind == len(kosu_total) - 1:
              # 工数区分定義データ取得
              kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])

              # 工数区分定義の数をカウント
              def_num = 0
              for n in range(1, 51):
                if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
                  def_num = n
                else:
                  break


        # 工数区分定義の選択リスト作成
        graph_item = []
        for i in range(def_num):
          graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

        # 工数データリスト内の各文字を定義
        str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                          'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
        # 工数データリスト内の各文字を工数区分定義の数に調整
        del str_list[def_num:]


        # 指定年の工数を加算しデータリスト作成
        graph_list = list(itertools.repeat(0, def_num))
        for i in kosu_total:
          # 日毎の累積工数リスト作成
          str_n = 0
          graph_year = []
          for m in str_list:
            str_n = i.time_work.count(m)*5

            graph_year.append(str_n)
            str_n = 0

          # 各工数区分定義の累積工数リストを日ごとに加算
          for w, v in enumerate(zip(graph_year, graph_list)):
            kosu_sum = sum(v)
            graph_list[w] = kosu_sum


    # 月間工数選択時処理
    if request.POST['kosu_summarize'] == '2':
      # POST送信された就業日を変数に入れる
      post_day = request.POST['kosu_day']
      # POST送信された就業日の年、月部分抜き出し
      kosu_month = post_day[: 7]

      # 指定月の工数取得
      kosu_total = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                      work_day2__startswith = kosu_month)

      #指定月に工数入力がない場合の処理
      if kosu_total.count() == 0:
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])
      
        # 工数区分定義の数をカウント
        def_num = 0
        for n in range(1, 51):
          if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
            def_num = n
          else:
            break

        # 工数区分定義の選択リスト作成
        graph_item = []
        for i in range(def_num):
          graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

        # 0が工数区分定義と同じ数入ったリスト作成
        graph_list = list(itertools.repeat(0, def_num))

      # 指定月に工数入力がある場合の処理
      else:
        # 月の最初の日の工数区分定義でグラフ項目リスト作成
        for ind, v in enumerate(kosu_total):
          # 工数区分定義が空でない場合の処理
          if v.def_ver2 not in ('', None):
            # 工数区分定義データ取得
            kosu_obj = kosu_division.objects.get(kosu_name = v.def_ver2)
            # 工数区分定義の数をカウント
            def_num = 0
            for n in range(1, 51):
              if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
                def_num = n
              else:
                break
            break

          # 工数区分定義が空の場合の処理
          else:
            if ind == len(kosu_total) - 1:
              # 工数区分定義データ取得
              kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])

              # 工数区分定義の数をカウント
              def_num = 0
              for n in range(1, 51):
                if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
                  def_num = n
                else:
                  break

        # 工数区分定義の選択リスト作成
        graph_item = []
        for i in range(def_num):
          graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

        # 工数データリスト内の各文字を定義
        str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                    'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                      'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                          'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
        # 工数データリスト内の各文字を工数区分定義の数に調整
        del str_list[def_num:]


        # 指定月の工数を加算しデータリスト作成
        graph_list = list(itertools.repeat(0, def_num))
        for i in kosu_total:
          # 日毎の累積工数リスト作成
          str_n = 0
          graph_month = []
          for m in str_list:
            str_n = i.time_work.count(m)*5

            graph_month.append(str_n)
            str_n = 0

          # 各工数区分定義の累積工数リストを日ごとに加算
          for w, v in enumerate(zip(graph_month, graph_list)):
            kosu_sum = sum(v)
            graph_list[w] = kosu_sum


    # ログイン者の工数集計データ取得
    kosu_total = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2 = request.POST['kosu_day'])

    # ログイン者の指定日の工数集計データがない場合の処理
    if kosu_total.count() == 0 and request.POST['kosu_summarize'] == '1':
      # 工数区分定義データ取得
      kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])
    
      # 工数区分定義の数をカウント
      def_num = 0
      for n in range(1, 51):
        if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
          def_num = n

      # 工数区分定義の選択リスト作成
      graph_item = []
      for i in range(def_num):
        graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))
      
      # 0が工数区分定義と同じ数入ったリスト作成
      graph_list = list(itertools.repeat(0, def_num))


    # ログイン者の指定日の工数集計データがある場合の処理
    if kosu_total.count() != 0 and request.POST['kosu_summarize'] == '1':
      # ログイン者の工数集計データ取得
      graph_data = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                   work_day2 = request.POST['kosu_day'])

      # 工数データに工数区分定義の値がある場合の処理
      if graph_data.def_ver2 not in ('', None):
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = graph_data.def_ver2)

      # 工数データに工数区分定義の値がある場合の処理
      else:
        # 工数区分定義データ取得
        kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])

      # 工数区分定義の数をカウント
      def_num = 0
      for n in range(1, 51):
        if eval('kosu_obj.kosu_title_{}'.format(n)) not in ('', None):
          def_num = n
        else:
          break

      # 工数区分定義の選択リスト作成
      graph_item = []
      for i in range(def_num):
        graph_item.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))

      # 工数データリスト内の各文字を定義
      str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
                  'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                    'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                        'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
      # 工数データリスト内の各文字を工数区分定義の数に調整
      del str_list[def_num:]

      # 各工数区分定義の累積工数リスト作成
      str_n = 0
      graph_list = []

      for i in str_list:
        str_n = graph_data.time_work.count(i)*5
        graph_list.append(str_n)
        str_n = 0

    # グラフ項目色定義
    color_list = ['plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 
                  'deepskyblue', 'aqua', 'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 
                  'lawngreen', 'greenyellow', 'gold', 'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 
                  'lightsalmon', 'tomato', 'orangered', 'red', 'deeppink', 'hotpink', 'violet', 'magenta', 
                  'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue', 'cadetblue', 'mediumseagreen', 
                  'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue', 'darkblue', 
                  'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon', 
                  'darkmagenta', 'indigo', 'black'] 


    # 並び順が多い順の場合処理
    if request.POST['kosu_order'] == '2':
      # グラフ項目色の要素数を合わせる
      del color_list[def_num:]
      # 項目色と工数を辞書型に統合
      color_library = dict(zip(color_list, graph_list))
      # 工数区分定義と各工数を辞書型に統合
      graph_library = dict(zip(graph_item, graph_list))
      # 工数の多い順に辞書を並び替え
      color_library_tuple = sorted(color_library.items(), key = lambda x : x[1] ,reverse = True)
      graph_library_tuple = sorted(graph_library.items(), key = lambda x : x[1] ,reverse = True)
      #タプル型を辞書型に変換
      color_library = {k : v for k, v in color_library_tuple}
      graph_library = {k : v for k, v in graph_library_tuple}
      # 並び替えた辞書を工数区分定義と工数をリストに分ける
      color_list = color_library.keys()
      graph_item = graph_library.keys()
      graph_list = graph_library.values()


    # フォームにPOSTした値を設定し定義
    form = kosu_dayForm(request.POST)
    default_day = request.POST['kosu_day']



  # HTMLに渡す辞書
  context = {
    'title' : '工数集計',
    'data' : data,
    'form' : form,
    'default_day' : default_day,
    'graph_list' : graph_list,
    'graph_item' : graph_item,
    'color_list' : color_list,
    'graph_library' : dict(zip(graph_item, graph_list))
  }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/total.html', context)





#--------------------------------------------------------------------------------------------------------





# カレンダー画面定義
def schedule(request): 

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # 本日の日付取得
  today = datetime.date.today()



  # GET時の処理
  if (request.method == 'GET'):
    # 本日の年取得
    year = today.year
    # 本日の月取得
    month = today.month

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # GET時のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # GET時のカレンダー設定フォーム定義
    form2 = schedule_timeForm(default_list)

    # GETされた月の初日取得
    select_month = datetime.date(year, month, 1)
    # GETされた月の初日の曜日取得
    week_day = select_month.weekday()

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

    # 勤務フォーム初期値定義
    form_default_list = {}
    for i in range(37):
      if day_list[i] != '':
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                        work_day2 = datetime.date(year, month, day_list[i]))
        if day_filter.count() > 0:
          day_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = datetime.date(year, month, day_list[i]))
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)



  # カレンダー更新時の処理
  if "time_update" in request.POST:

    # 年取得
    year = int(request.POST['year'])
    # 月取得
    month = int(request.POST['month'])

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # POST後のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # POST後のカレンダー設定フォーム定義
    form2 = schedule_timeForm(default_list)

    # POSTされた月の初日取得
    select_month = datetime.date(year, month, 1)
    # POSTされた月の初日の曜日取得
    week_day = select_month.weekday()

    # POSTされた月の最終日取得
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year

    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # カレンダー表示日付リセット
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

    # 勤務フォーム初期値定義
    form_default_list = {}
    for i in range(37):
      if day_list[i] != '':
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                        work_day2 = datetime.date(year, month, day_list[i]))
        if day_filter.count() != 0:
          day_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = datetime.date(year, month, day_list[i]))
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)

    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)



  # 直一括入力の処理
  if "default_tyoku" in request.POST:

    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')
    
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

    # カレンダー表示日付リセット
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

    # 直を一括書き込み
    for ind, dd in enumerate([range(1, 6), range(8, 13), range(15, 20), range(22, 27), range(29, 34), range(36, 37)]):
      for i in dd:
        if day_list[i] != '':
          # 工数データがあるか確認
          work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                            work_day2 = datetime.date(year, month, day_list[i]))

          # 工数データがある場合の処理
          if work_filter.count() != 0:
            # 工数データ取得
            work_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))
            # ログイン者の情報取得
            member_obj = member.objects.get(employee_no = request.session['login_No'])

            # 工数データに勤務情報がない場合
            if work_get.tyoku2 in (None, ''):
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'tyoku2' : eval('request.POST["tyoku_all_{}"]'.format(ind + 1))})
              
          # 工数データがない場合の処理
          else:
            # 従業員番号に該当するmemberインスタンスを取得
            member_instance = member.objects.get(employee_no = request.session['login_No'])
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'tyoku2' : eval('request.POST["tyoku_all_{}"]'.format(ind + 1)), \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : False})

    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):
      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':
        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.count() != 0:
          # 対応する日付の工数データを取得
          day_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                    work_day2 = datetime.date(year, month, day_list[i]))
          
          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)
    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)




























  # デフォルト勤務入力の処理
  if "default_work" in request.POST:

    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')
    
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

    # カレンダー表示日付リセット
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

    # デフォルトの就業書き込み
    for i in range(37):
      if day_list[i] != '':
        # 工数データがあるか確認
        work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                         work_day2 = datetime.date(year, month, day_list[i]))

        # 工数データがある場合の処理
        if work_filter.count() != 0:
          # 工数データ取得
          work_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                     work_day2 = datetime.date(year, month, day_list[i]))
          # ログイン者の情報取得
          member_obj = member.objects.get(employee_no = request.session['login_No'])

          # 工数データに勤務情報がない場合
          if work_get.work_time in (None, ''):
            # 平日である場合の処理
            if (0 > i and i < 6) or (7 > i and i < 13) or (14 > i and i < 20) or (21 > i and i < 27) or (28 > i and i < 34) or (i == 36):
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'work_time' : '出勤'})
              
            else:
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'work_time' : '休日'})

        # 工数データがない場合の処理
        else:
          # 従業員番号に該当するmemberインスタンスを取得
          member_instance = member.objects.get(employee_no = request.session['login_No'])
          # 平日である場合の処理
          if i in (1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 36, 37):
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'work_time' : '出勤', \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : False})
            
          # 休日の場合の処理
          else:
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'work_time' : '休日', \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : True})

    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):

      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':
        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.count() != 0:
          # 対応する日付の工数データを取得
          day_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                    work_day2 = datetime.date(year, month, day_list[i]))
          
          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)
    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)



  # 勤務登録時の処理
  if "work_update" in request.POST:

    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)

    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')
    
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

    # カレンダー表示日付リセット
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

    # 就業を上書き
    for i in range(37):
      if day_list[i] != '':
        # 工数データがあるか確認
        work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                         work_day2 = datetime.date(year, month, day_list[i]))

        # 工数データがある場合の処理
        if work_filter.count() != 0:
          # 工数データ取得
          work_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                     work_day2 = datetime.date(year, month, day_list[i]))
          # ログイン者の情報取得
          member_obj = member.objects.get(employee_no = request.session['login_No'])

          # 工数合計取得
          kosu_total = 1440 - (work_get.time_work.count('#')*5) - (work_get.time_work.count('$')*5)

          # 工数入力OK_NGリセット
          judgement = False

          if (eval('request.POST["day{}"]'.format(i + 1)) == '休日' or \
            eval('request.POST["day{}"]'.format(i + 1)) == '年休' or \
            eval('request.POST["day{}"]'.format(i + 1)) == '代休' or \
            eval('request.POST["day{}"]'.format(i + 1)) == 'シフト休' or \
            eval('request.POST["day{}"]'.format(i + 1)) == '公休') and kosu_total == 0:
            # 工数入力OK_NGをOKに切り替え
            judgement = True

          # 出勤、休出時、工数合計と残業に整合性がある場合の処理
          if (eval('request.POST["day{}"]'.format(i + 1)) == '出勤' or \
              eval('request.POST["day{}"]'.format(i + 1)) == 'シフト出') and \
              kosu_total - int(work_get.over_time) == 470:
            # 工数入力OK_NGをOKに切り替え
            judgement = True


          # 休出時、工数合計と残業に整合性がある場合の処理
          if eval('request.POST["day{}"]'.format(i + 1)) == '休出' and kosu_total == int(work_get.over_time):
            # 工数入力OK_NGをOKに切り替え
            judgement = True


          # 早退・遅刻時、工数合計と残業に整合性がある場合の処理
          if eval('request.POST["day{}"]'.format(i + 1)) == '早退・遅刻' and kosu_total != 0:
            # 工数入力OK_NGをOKに切り替え
            judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで1直の場合の処理
          if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
              member_obj.shop == '組長以上(W,A)') and \
             eval('request.POST["tyoku{}"]'.format(i + 1)) == '1':
            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 230:
              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 240:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで2直の場合の処理
          if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
              member_obj.shop == '組長以上(W,A)') and \
              eval('request.POST["tyoku{}"]'.format(i + 1)) == '2':

            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 290:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 180:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Cで3直の場合の処理
          if (member_obj.shop == 'W1' or member_obj.shop == 'W2' or \
            member_obj.shop == 'A1' or member_obj.shop == 'A2' or \
              member_obj.shop == '組長以上(W,A)') and \
              eval('request.POST["tyoku{}"]'.format(i + 1)) == '3':

            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 230:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 240:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで1直の場合の処理
          if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
            member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
              member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
              eval('request.POST["tyoku{}"]'.format(i + 1)) == '1':

            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 220:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 250:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで2直の場合の処理
          if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
            member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
              member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
              eval('request.POST["tyoku{}"]'.format(i + 1)) == '2':

            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 230:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 240:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # ログイン者の登録ショップが三組三交替Ⅱ甲乙丙番Bで3直の場合の処理
          if (member_obj.shop == 'P' or member_obj.shop == 'R' or \
            member_obj.shop == 'T1' or member_obj.shop == 'T2' or \
              member_obj.shop == 'その他' or member_obj.shop == '組長以上(P,R,T,その他)') and \
              eval('request.POST["tyoku{}"]'.format(i + 1)) == '3':

            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 275:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 195:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # 常昼の場合の処理
          if eval('request.POST["tyoku{}"]'.format(i + 1)) == '4':
            # 半前年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半前年休' and \
              kosu_total - int(work_get.over_time) == 230:

              # 工数入力OK_NGをOKに切り替え
              judgement = True

            # 半後年休時、工数合計と残業に整合性がある場合の処理
            if eval('request.POST["day{}"]'.format(i + 1)) == '半後年休' and \
              kosu_total - int(work_get.over_time) == 240:

              # 工数入力OK_NGをOKに切り替え
              judgement = True


          # 就業を上書き
          Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
            work_day2 = datetime.date(year, month, day_list[i]), \
              defaults = {'work_time' : eval('request.POST["day{}"]'.format(i + 1)), \
                          'tyoku2' : eval('request.POST["tyoku{}"]'.format(i + 1)), \
                          'judgement' : judgement})

          # 更新後の就業を取得
          record_del = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                       work_day2 = datetime.date(year, month, day_list[i]))

          # 更新後、就業が消されていて工数データが空であればレコードを消す
          if record_del.work_time == '' and record_del.over_time == 0 and \
            record_del.time_work == '#'*288:

            # レコード削除
            record_del.delete()

        # 工数データがなくPOSTした値が空欄でない場合の処理
        if eval('request.POST["day{}"]'.format(i + 1)) != '' and work_filter.count() == 0:
          # POST値が休日の場合の処理
          if eval('request.POST["day{}"]'.format(i + 1)) != '年休' or \
            eval('request.POST["day{}"]'.format(i + 1)) != '休日' or \
              eval('request.POST["day{}"]'.format(i + 1)) != '公休' or \
                eval('request.POST["day{}"]'.format(i + 1)) != 'シフト休' or \
                  eval('request.POST["day{}"]'.format(i + 1)) != '代休':
            # 整合性OK
            judgement = True

          # POST値が休日以外の場合の処理
          else:
            # 整合性NG
            judgement = False

          # 従業員番号に該当するmemberインスタンスを取得
          member_instance = member.objects.get(employee_no = request.session['login_No'])

          # 就業データ作成(空の工数データも入れる)
          Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
            work_day2 = datetime.date(year, month, day_list[i]), \
              defaults = {'name' : member_instance, \
                          'work_time' : eval('request.POST["day{}"]'.format(i + 1)), \
                          'tyoku2' : eval('request.POST["tyoku{}"]'.format(i + 1)), \
                          'time_work' : '#'*288, \
                          'detail_work' : '$'*287, \
                          'over_time' : 0, \
                          'judgement' : judgement})


    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):

      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':

        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.count() != 0:

          # 対応する日付の工数データを取得
          day_get = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = datetime.date(year, month, day_list[i]))
          
          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)



  # 入力工数表示リセット
  time_list1 = []
  time_list1 = []
  time_list2 = []
  time_list3 = []
  time_list4 = []
  time_list5 = []
  time_list6 = []
  time_list7 = []
  time_list8 = []
  time_list9 = []
  time_list10 = []
  time_list11 = []
  time_list12 = []
  time_list13 = []
  time_list14 = []
  time_list15 = []
  time_list16 = []
  time_list17 = []
  time_list18 = []
  time_list19 = []
  time_list20 = []
  time_list21 = []
  time_list22 = []
  time_list23 = []
  time_list24 = []
  time_list25 = []
  time_list26 = []
  time_list27 = []
  time_list28 = []
  time_list29 = []
  time_list30 = []
  time_list31 = []
  time_list32 = []
  time_list33 = []
  time_list34 = []
  time_list35 = []
  time_list36 = []
  time_list37 = []
  title_list = ['time_list1', 'time_list2', 'time_list3', 'time_list4', \
                'time_list5', 'time_list6', 'time_list7', 'time_list8', \
                'time_list9', 'time_list10', 'time_list11', 'time_list12', \
                'time_list13', 'time_list14', 'time_list15', 'time_list16', \
                'time_list17', 'time_list18', 'time_list19', 'time_list20', \
                'time_list21', 'time_list22', 'time_list23', 'time_list24', \
                'time_list25', 'time_list26', 'time_list27', 'time_list28', \
                'time_list29', 'time_list30', 'time_list31', 'time_list32', \
                'time_list33', 'time_list34', 'time_list35', 'time_list36', \
                'time_list37'
                ]
    
  # 工数入力データ取得
  for i, k in  enumerate(title_list):

    # 日付リストの該当要素が空でない場合の処理
    if day_list[i] != '':
      # ログイン者の工数データを該当日でフィルター 
      graph_data_filter = Business_Time_graph.objects.filter(employee_no3 = \
                          request.session.get('login_No', None), \
                          work_day2 = datetime.date(year, month, day_list[i]))

      # 工数データがない場合の処理
      if graph_data_filter.count() == 0:

        # カレンダー工数表示リストに空の値を入れる
        for p in range(4):
          eval(k).append('　')

      # 工数データがある場合の処理
      if graph_data_filter.count() != 0:

        # ログイン者の該当日の工数データ取得
        graph_data_get = Business_Time_graph.objects.get(employee_no3 = \
                        request.session.get('login_No', None), \
                          work_day2 =datetime.date(year, month, day_list[i]))
        # 作業内容リストに解凍
        data_list = list(graph_data_get.time_work)
       
        # 表示時間インデックスリセット
        start_index1 = 0
        end_index1 = 0
        start_index2 = 0
        end_index2 = 0
        start_index3 = 0
        end_index3 = 0
        start_index4 = 0
        end_index4 = 0
        loop_stop = 0

        # 工数データを文字に変換するため工数の開始、終了時間のインデックス取得
        for t in range(288):
          if data_list[t] != '#':
            start_index1 = t
            break
          if t == 287:
            loop_stop = 1

        if loop_stop == 0:
          for t in range(start_index1 + 1, 288):
            if data_list[t] == '#':
              end_index1 = t
              break
            if t == 287 and data_list[t] != '#':
              end_index1 = 288
              loop_stop = 1

          if loop_stop == 0:
            for t in range(end_index1 + 1, 288):
              if data_list[t] != '#':
                start_index2 = t
                break
              if t == 287:
                loop_stop = 1

            if loop_stop == 0:
              for t in range(start_index2 + 1, 288):
                if data_list[t] == '#':
                  end_index2 = t
                  break
                if t == 287 and data_list[t] != '#':
                  end_index2 = 288
                  loop_stop = 1

              if loop_stop == 0:
                for t in range(end_index2 + 1, 288):
                  if data_list[t] != '#':
                    start_index3 = t
                    break
                  if t == 287:
                    loop_stop = 1
    
                if loop_stop == 0:
                  for t in range(start_index3 + 1, 288):
                    if data_list[t] == '#':
                      end_index3 = t
                      break
                    if t == 287 and data_list[t] != '#':
                      end_index3 = 288
                      loop_stop = 1

                  if loop_stop == 0:
                    for t in range(end_index3 + 1, 288):
                      if data_list[t] != '#':
                        start_index4 = t
                        break
                      if t == 287:
                        loop_stop = 1
        
                    if loop_stop == 0:
                      for t in range(start_index4 + 1, 288):
                        if data_list[t] == '#':
                          end_index4 = t
                          break
                        if t == 287 and data_list[t] != '#':
                          end_index4 = 288

        # 取得したインデックスを時間表示に変換
        if start_index1 != 0 or end_index1 != 0:
          start_hour1 = start_index1//12
          start_min1 = (start_index1%12)*5
          end_hour1 =end_index1//12
          end_min1 = (end_index1%12)*5
          eval(k).append('{}:{}～{}:{}'.format(start_hour1, str(start_min1).zfill(2), \
                                              end_hour1, str(end_min1).zfill(2)))
        else:
          eval(k).append('　')
          
        if start_index2 != 0 or end_index2 != 0:
          start_hour2 = start_index2//12
          start_min2 = (start_index2%12)*5
          end_hour2 =end_index2//12
          end_min2 = (end_index2%12)*5
          eval(k).append('{}:{}～{}:{}'.format(start_hour2, str(start_min2).zfill(2), \
                                              end_hour2, str(end_min2).zfill(2)))
        else:
          eval(k).append('　')

        if start_index3 != 0 or end_index3 != 0:
          start_hour3 = start_index3//12
          start_min3 = (start_index3%12)*5
          end_hour3 =end_index3//12
          end_min3 = (end_index3%12)*5
          eval(k).append('{}:{}～{}:{}'.format(start_hour3, str(start_min3).zfill(2), \
                                              end_hour3, str(end_min3).zfill(2)))
        else:
          eval(k).append('　')
          
        if start_index4 != 0 or end_index4 != 0:
          start_hour4 = start_index4//12
          start_min4 = (start_index4%12)*5
          end_hour4 =end_index4//12
          end_min4 = (end_index4%12)*5
          eval(k).append('{}:{}～{}:{}'.format(start_hour4, str(start_min4).zfill(2), \
                                              end_hour4, str(end_min4).zfill(2)))
        else:
          eval(k).append('　')


  # 入力できる日付範囲を表示月に制限
  min_day = str(datetime.date(year, month, 1))
  max_day = str(month_day_end)

  # 日付の初期値指定
  if datetime.date(year, month, 1) <= today and today <= month_day_end:
    default_day = str(today)

  if datetime.date(year, month, 1) >= today:
    default_day = min_day

  if today >= month_day_end:
    default_day = max_day


  # 工数入力OKリスト作成
  OK_NG_list = []
  for ok_ng in range(37):
    if day_list[ok_ng] != '':
      OK_NG_filter = Business_Time_graph.objects.filter(employee_no3 = request.session.get('login_No', None), \
                                                       work_day2 = datetime.date(year, month, day_list[ok_ng]))
      if OK_NG_filter.count() != 0:
        
        OK_NG_obj = Business_Time_graph.objects.get(employee_no3 = request.session.get('login_No', None), \
                                                    work_day2 = datetime.date(year, month, day_list[ok_ng]))
        if OK_NG_obj.judgement == True:
          OK_NG_list.append(OK_NG_obj.judgement)
        else:
          OK_NG_list.append(False)
      else:
        OK_NG_list.append(False)
    else:
      OK_NG_list.append(False)


  
  # HTMLに渡す辞書
  context = {
    'title' : '勤務入力',
    'form' : form,
    'form2' : form2,
    'day_list' : day_list,
    'min_day' : min_day,
    'max_day' : max_day,
    'default_day' : default_day,
    'OK_NG_list' : OK_NG_list,
    'time_list1': time_list1,
    'time_list2': time_list2,
    'time_list3': time_list3,
    'time_list4': time_list4,
    'time_list5': time_list5,
    'time_list6': time_list6,
    'time_list7': time_list7,
    'time_list8': time_list8,
    'time_list9': time_list9,
    'time_list10': time_list10,
    'time_list11': time_list11,
    'time_list12': time_list12,
    'time_list13': time_list13,
    'time_list14': time_list14,
    'time_list15': time_list15,
    'time_list16': time_list16,
    'time_list17': time_list17,
    'time_list18': time_list18,
    'time_list19': time_list19,
    'time_list20': time_list20,
    'time_list21': time_list21,
    'time_list22': time_list22,
    'time_list23': time_list23,
    'time_list24': time_list24,
    'time_list25': time_list25,
    'time_list26': time_list26,
    'time_list27': time_list27,
    'time_list28': time_list28,
    'time_list29': time_list29,
    'time_list30': time_list30,
    'time_list31': time_list31,
    'time_list32': time_list32,
    'time_list33': time_list33,
    'time_list34': time_list34,
    'time_list35': time_list35,
    'time_list36': time_list36,
    'time_list37': time_list37, 
  }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/schedule.html', context)





#--------------------------------------------------------------------------------------------------------





# 残業管理画面定義
def over_time(request):

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')



  # POST時の処理
  if (request.method == 'POST'):
    # 検索項目に空欄がある場合の処理
    if request.POST['year'] == '' or request.POST['month'] == '':
      # エラーメッセージ出力
      messages.error(request, '表示年月に未入力箇所があります。ERROR083')
      # このページをリダイレクト
      return redirect(to = '/over_time')
    

    # フォームの初期値定義
    schedule_default = {'year' : request.POST['year'], 
                        'month' : request.POST['month']}
    # フォーム定義
    form = schedule_timeForm(schedule_default)
    
    # POSTした値をセッションに登録
    request.session['over_time_year'] = request.POST['year']
    request.session['over_time_month'] = request.POST['month']

    year = int(request.POST['year'])
    month = int(request.POST['month'])



  # POST時以外の処理
  else:
    # セッション値に年月のデータがない場合の処理
    if request.session.get('over_time_year', '') == '' or request.session.get('over_time_month', '') == '':
      # 本日の年月取得
      year = datetime.date.today().year
      month = datetime.date.today().month

    # セッション値に年月のデータがある場合の処理
    else:
      # セッション値から年月取得
      year = int(request.session['over_time_year'])
      month = int(request.session['over_time_month'])

    # フォームの初期値定義
    schedule_default = {'year' : str(year), 
                        'month' : str(month)}
    # フォーム定義
    form = schedule_timeForm(schedule_default)



  # 次の月の最初の日を定義
  if month == 12:
    next_month = datetime.date(year + 1, 1, 1)

  else:
    next_month = datetime.date(year, month + 1, 1)

  # 次の月の最初の日から1を引くことで、指定した月の最後の日を取得
  last_day_of_month = next_month - datetime.timedelta(days = 1)

  # 曜日リスト定義
  week_list = []
  # 曜日リスト作成するループ
  for d in range(1, last_day_of_month.day + 1):
    # 曜日を取得する日を作成
    week_day = datetime.date(year, month, d)

    # 指定日の曜日をリストに挿入
    if week_day.weekday() == 0:
      week_list.append('月')
    if week_day.weekday() == 1:
      week_list.append('火')
    if week_day.weekday() == 2:
      week_list.append('水')
    if week_day.weekday() == 3:
      week_list.append('木')
    if week_day.weekday() == 4:
      week_list.append('金')
    if week_day.weekday() == 5:
      week_list.append('土')
    if week_day.weekday() == 6:
      week_list.append('日')

  # 残業リスト定義
  over_time_list = []

  # 残業合計リセット
  over_time_total = 0

  # 残業リストに名前追加
  over_time_list.append(data.name)

  # 日毎の残業と整合性をリストに追加するループ
  for d in range(1, int(last_day_of_month.day) + 1):
    # 該当日に工数データあるか確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2 = datetime.date(year, month, d))

    # 該当日に工数データがある場合の処理
    if obj_filter.count() != 0:
      # 工数データ取得
      obj_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                work_day2 = datetime.date(year, month, d))
      
      # 残業データを分から時に変換
      over_time = int(obj_get.over_time)/60
      obj_get = Business_Time_graph(over_time = over_time)

      # 残業リストにレコードを追加
      over_time_list.append(obj_get)

      # 残業を合計する
      over_time_total += float(obj_get.over_time)

    # 該当日に工数データがない場合の処理
    else:
      # 残業リストに残業0と整合性否を追加
      over_time_list.append(Business_Time_graph(over_time = 0, judgement = False))

  # リストに残業合計追加
  over_time_list.append(over_time_total)
  over_time_list.insert(1, over_time_total)



  # HTMLに渡す辞書
  context = {
    'title' : '残業管理',
    'form' : form,
    'day_list' : zip(range(1, last_day_of_month.day + 1), week_list), 
    'week_list' : week_list,
    'over_time_list' : over_time_list
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/over_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 全工数操作画面定義
def all_kosu(request, num):

  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in [page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3]:
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # 工数データのある従業員番号リスト作成
  employee_no_list = Business_Time_graph.objects.values_list('employee_no3', flat=True)\
                     .order_by('employee_no3').distinct()
  
  # 名前リスト定義
  name_list = [['', '']]

  # 従業員番号を名前に変更するループ
  for No in list(employee_no_list):
    # 指定従業員番号で人員情報取得
    name = member.objects.get(employee_no = No)
    # 名前リスト作成
    name_list.append([No, name])



  # POST時の処理
  if 'kosu_find' in request.POST:

    # 従業員番号リスト定義
    employee_no_name_list = []

    # ショップ指定ある場合の処理
    if request.POST['shop'] != '':
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.filter(shop = request.POST['shop']).values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # ショップ指定ある場合の処理
    else:
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.all().values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # 整合性OKをPOSTした場合の処理
    if request.POST['OK_NG'] == 'OK':
      judgement = [True]
    
    # 整合性NGをPOSTした場合の処理
    elif request.POST['OK_NG'] == 'NG':
      judgement = [False]

    # 整合性で空欄をPOSTした場合の処理
    else:
      judgement = [True, False]



    try:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              work_day2__gte = request.POST['start_day'], \
                                              work_day2__lte = request.POST['end_day'], \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()

    # エラー時の処理
    except:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()




    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj, 500)


    # フォーム定義
    form = all_kosu_findForm(request.POST)
    # フォーム選択肢定義
    form.fields['name'].choices = name_list

    # 日付初期値保持
    default_start_day = str(request.POST['start_day'])
    default_end_day = str(request.POST['end_day'])



  # 検索結果削除
  if 'kosu_delete' in request.POST:

    # 従業員番号リスト定義
    employee_no_name_list = []

    # ショップ指定ある場合の処理
    if request.POST['shop'] != '':
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.filter(shop = request.POST['shop']).values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # ショップ指定ある場合の処理
    else:
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.all().values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # 整合性OKをPOSTした場合の処理
    if request.POST['OK_NG'] == 'OK':
      judgement = [True]
    
    # 整合性NGをPOSTした場合の処理
    elif request.POST['OK_NG'] == 'NG':
      judgement = [False]

    # 整合性で空欄をPOSTした場合の処理
    else:
      judgement = [True, False]



    try:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              work_day2__gte = request.POST['start_day'], \
                                              work_day2__lte = request.POST['end_day'], \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()

    # エラー時の処理
    except:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()
    # 検索レコード削除
    obj.delete()
    # このページ読み直し
    return redirect(to = '/all_kosu/1')


  # GET時の処理
  if (request.method == 'GET'):
    # 全工数データを取得
    obj = Business_Time_graph.objects.all().order_by('work_day2', 'employee_no3').reverse()
    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj, 500)

    # 今日の日時取得
    today = datetime.date.today()
    # 日付フォーム初期値定義
    default_start_day = str(today)
    default_end_day = str(today)

    # フォーム定義
    form = all_kosu_findForm(request.POST)
    # フォーム選択肢定義
    form.fields['name'].choices = name_list



  # HTMLに渡す辞書
  context = {
    'title' : '全工数履歴',
    'data' : data.get_page(num),
    'default_start_day' : default_start_day,
    'default_end_day' : default_end_day,
    'form' : form,
    'num' : num,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数編集画面定義
def all_kosu_detail(request, num):

  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in (page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3):
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')
  

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)


  # 工数定義区分Verリスト作成
  Ver_list = kosu_division.objects.values_list('kosu_name', flat=True)\
                    .order_by('id').distinct()

  # 工数定義区分Verリスト定義
  Ver_choose = []

  # 工数定義区分Verを名前に変更するループ
  for No in list(Ver_list):
    # 名前リスト作成
    Ver_choose.append([No, No])



  # POST時の処理
  if (request.method == 'POST'):
    # フォーム定義
    form = all_kosuForm(request.POST)

    # フォーム選択肢定義
    form.fields['def_ver'].choices = Ver_choose

    # 作業内容整形
    time_work = request.POST['time_work0'] + \
                request.POST['time_work1'] + \
                request.POST['time_work2'] + \
                request.POST['time_work3'] + \
                request.POST['time_work4'] + \
                request.POST['time_work5'] + \
                request.POST['time_work6'] + \
                request.POST['time_work7'] + \
                request.POST['time_work8'] + \
                request.POST['time_work9'] + \
                request.POST['time_work10'] + \
                request.POST['time_work11'] + \
                request.POST['time_work12'] + \
                request.POST['time_work13'] + \
                request.POST['time_work14'] + \
                request.POST['time_work15'] + \
                request.POST['time_work16'] + \
                request.POST['time_work17'] + \
                request.POST['time_work18'] + \
                request.POST['time_work19'] + \
                request.POST['time_work20'] + \
                request.POST['time_work21'] + \
                request.POST['time_work22'] + \
                request.POST['time_work23']

    # 作業詳細整形
    detail_work = request.POST['detail_work0'] + \
                  request.POST['detail_work1'] + \
                  request.POST['detail_work2'] + \
                  request.POST['detail_work3'] + \
                  request.POST['detail_work4'] + \
                  request.POST['detail_work5'] + \
                  request.POST['detail_work6'] + \
                  request.POST['detail_work7'] + \
                  request.POST['detail_work8'] + \
                  request.POST['detail_work9'] + \
                  request.POST['detail_work10'] + \
                  request.POST['detail_work11'] + \
                  request.POST['detail_work12'] + \
                  request.POST['detail_work13'] + \
                  request.POST['detail_work14'] + \
                  request.POST['detail_work15'] + \
                  request.POST['detail_work16'] + \
                  request.POST['detail_work17'] + \
                  request.POST['detail_work18'] + \
                  request.POST['detail_work19'] + \
                  request.POST['detail_work20'] + \
                  request.POST['detail_work21'] + \
                  request.POST['detail_work22'] + \
                  request.POST['detail_work23']

    # POSTした従業員番号があるか確認
    member_filter = member.objects.filter(employee_no = request.POST['employee_no'])
    # 従業員番号がない場合の処理
    if member_filter.count() == 0:
      # エラーメッセージ出力
      messages.error(request, 'その従業員番号は人員データにありません。ERROR092')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 従業員番号か日付に変更があった場合の処理
    if request.POST['employee_no'] != request.session['memory_No'] or \
      str(request.POST['work_day']) != request.session['memory_day']:
      # 変更後の日付に工数データがあるか確認
      obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.POST['employee_no'], \
                                                      work_day2 = request.POST['work_day'])
      
      # 工数データがある場合の処理
      if obj_filter.count() != 0:
        # エラーメッセージ出力
        messages.error(request, 'その日付には既に工数データがあります。ERROR091')
        # このページをリダイレクト
        return redirect(to = '/all_kosu_detail/{}'.format(num))
      
      else:
        # 元の工数データ削除
        obj_get.delete()
    # 従業員番号に該当するmemberインスタンスを取得
    member_instance = member.objects.get(employee_no = request.POST['employee_no'])

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.POST['employee_no'], \
                                                 work_day2 = request.POST['work_day'], \
                                                 defaults = {'name' : member_instance, \
                                                             'def_ver2' : request.POST['def_ver'], \
                                                             'work_time' : request.POST['work_time'], \
                                                             'tyoku2' : request.POST['tyoku'], \
                                                             'time_work' : time_work, \
                                                             'detail_work' : detail_work, \
                                                             'over_time' : request.POST['over_time'], \
                                                             'breaktime' : request.POST['breaktime'], \
                                                             'breaktime_over1' : request.POST['breaktime_over1'], \
                                                             'breaktime_over2' : request.POST['breaktime_over2'], \
                                                             'breaktime_over3' : request.POST['breaktime_over3'], \
                                                             'judgement' : 'judgement' in request.POST, \
                                                             'break_change' : 'break_change' in request.POST})

    default_day = str(request.POST['work_day'])



  # POST時以外の処理
  else:
    # 変更前従業員番号記憶
    request.session['memory_No'] = obj_get.employee_no3
    # 変更前日付記憶
    request.session['memory_day'] = str(obj_get.work_day2)

    # 作業詳細を取得しリストに解凍
    detail_list = obj_get.detail_work.split('$')

    # 時間帯作業分け
    work_list0 = obj_get.time_work[ : 12]
    work_list1 = obj_get.time_work[12 : 24]
    work_list2 = obj_get.time_work[24 : 36]
    work_list3 = obj_get.time_work[36 : 48]
    work_list4 = obj_get.time_work[48 : 60]
    work_list5 = obj_get.time_work[60 : 72]
    work_list6 = obj_get.time_work[72 : 84]
    work_list7 = obj_get.time_work[84 : 96]
    work_list8 = obj_get.time_work[96 : 108]
    work_list9 = obj_get.time_work[108 : 120]
    work_list10 = obj_get.time_work[120 : 132]
    work_list11 = obj_get.time_work[132 : 144]
    work_list12 = obj_get.time_work[144 : 156]
    work_list13 = obj_get.time_work[156 : 168]
    work_list14 = obj_get.time_work[168 : 180]
    work_list15 = obj_get.time_work[180 : 192]
    work_list16 = obj_get.time_work[192 : 204]
    work_list17 = obj_get.time_work[204 : 216]
    work_list18 = obj_get.time_work[216 : 228]
    work_list19 = obj_get.time_work[228 : 240]
    work_list20 = obj_get.time_work[240 : 252]
    work_list21 = obj_get.time_work[252 : 264]
    work_list22 = obj_get.time_work[264 : 276]
    work_list23 = obj_get.time_work[276 : ]
    detail_list0 = detail_list[ : 12]
    detail_list1 = detail_list[12 : 24]
    detail_list2 = detail_list[24 : 36]
    detail_list3 = detail_list[36 : 48]
    detail_list4 = detail_list[48 : 60]
    detail_list5 = detail_list[60 : 72]
    detail_list6 = detail_list[72 : 84]
    detail_list7 = detail_list[84 : 96]
    detail_list8 = detail_list[96 : 108]
    detail_list9 = detail_list[108 : 120]
    detail_list10 = detail_list[120 : 132]
    detail_list11 = detail_list[132 : 144]
    detail_list12 = detail_list[144 : 156]
    detail_list13 = detail_list[156 : 168]
    detail_list14 = detail_list[168 : 180]
    detail_list15 = detail_list[180 : 192]
    detail_list16 = detail_list[192 : 204]
    detail_list17 = detail_list[204 : 216]
    detail_list18 = detail_list[216 : 228]
    detail_list19 = detail_list[228 : 240]
    detail_list20 = detail_list[240 : 252]
    detail_list21 = detail_list[252 : 264]
    detail_list22 = detail_list[264 : 276]
    detail_list23 = detail_list[276 : ]

    # 作業詳細リストを文字列に変更
    detail_list_str0 = ''
    detail_list_str1 = ''
    detail_list_str2 = ''
    detail_list_str3 = ''
    detail_list_str4 = ''
    detail_list_str5 = ''
    detail_list_str6 = ''
    detail_list_str7 = ''
    detail_list_str8 = ''
    detail_list_str9 = ''
    detail_list_str10 = ''
    detail_list_str11 = ''
    detail_list_str12 = ''
    detail_list_str13 = ''
    detail_list_str14 = ''
    detail_list_str15 = ''
    detail_list_str16 = ''
    detail_list_str17 = ''
    detail_list_str18 = ''
    detail_list_str19 = ''
    detail_list_str20 = ''
    detail_list_str21 = ''
    detail_list_str22 = ''
    detail_list_str23 = ''

    # 作業詳細リストSTRに変換
    for i, e in enumerate(detail_list0):
      if i == len(detail_list0) - 1:
        detail_list_str0 = detail_list_str0 + detail_list0[i]
      else:
        detail_list_str0 = detail_list_str0 + detail_list0[i] + '$'

    for i, e in enumerate(detail_list1):
      if i == len(detail_list1) - 1:
        detail_list_str1 = detail_list_str1 + detail_list1[i]
      else:
        detail_list_str1 = detail_list_str1 + detail_list1[i] + '$'

    for i, e in enumerate(detail_list2):
      if i == len(detail_list2) - 1:
        detail_list_str2 = detail_list_str2 + detail_list2[i]
      else:
        detail_list_str2 = detail_list_str2 + detail_list2[i] + '$'

    for i, e in enumerate(detail_list3):
      if i == len(detail_list3) - 1:
        detail_list_str3 = detail_list_str3 + detail_list3[i]
      else:
        detail_list_str3 = detail_list_str3 + detail_list3[i] + '$'

    for i, e in enumerate(detail_list4):
      if i == len(detail_list4) - 1:
        detail_list_str4 = detail_list_str4 + detail_list4[i]
      else:
        detail_list_str4 = detail_list_str4 + detail_list4[i] + '$'

    for i, e in enumerate(detail_list5):
      if i == len(detail_list5) - 1:
        detail_list_str5 = detail_list_str5 + detail_list5[i]
      else:
        detail_list_str5 = detail_list_str5 + detail_list5[i] + '$'

    for i, e in enumerate(detail_list6):
      if i == len(detail_list6) - 1:
        detail_list_str6 = detail_list_str6 + detail_list6[i]
      else:
        detail_list_str6 = detail_list_str6 + detail_list6[i] + '$'

    for i, e in enumerate(detail_list7):
      if i == len(detail_list7) - 1:
        detail_list_str7 = detail_list_str7 + detail_list7[i]
      else:
        detail_list_str7 = detail_list_str7 + detail_list7[i] + '$'

    for i, e in enumerate(detail_list8):
      if i == len(detail_list8) - 1:
        detail_list_str8 = detail_list_str8 + detail_list8[i]
      else:
        detail_list_str8 = detail_list_str8 + detail_list8[i] + '$'

    for i, e in enumerate(detail_list9):
      if i == len(detail_list9) - 1:
        detail_list_str9 = detail_list_str9 + detail_list9[i]
      else:
        detail_list_str9 = detail_list_str9 + detail_list9[i] + '$'

    for i, e in enumerate(detail_list10):
      if i == len(detail_list10) - 1:
        detail_list_str10 = detail_list_str10 + detail_list10[i]
      else:
        detail_list_str10 = detail_list_str10 + detail_list10[i] + '$'

    for i, e in enumerate(detail_list11):
      if i == len(detail_list11) - 1:
        detail_list_str11 = detail_list_str11 + detail_list11[i]
      else:
        detail_list_str11 = detail_list_str11 + detail_list11[i] + '$'

    for i, e in enumerate(detail_list12):
      if i == len(detail_list12) - 1:
        detail_list_str12 = detail_list_str12 + detail_list12[i]
      else:
        detail_list_str12 = detail_list_str12 + detail_list12[i] + '$'

    for i, e in enumerate(detail_list13):
      if i == len(detail_list13) - 1:
        detail_list_str13 = detail_list_str13 + detail_list13[i]
      else:
        detail_list_str13 = detail_list_str13 + detail_list13[i] + '$'

    for i, e in enumerate(detail_list14):
      if i == len(detail_list14) - 1:
        detail_list_str14 = detail_list_str14 + detail_list14[i]
      else:
        detail_list_str14 = detail_list_str14 + detail_list14[i] + '$'

    for i, e in enumerate(detail_list15):
      if i == len(detail_list15) - 1:
        detail_list_str15 = detail_list_str15 + detail_list15[i]
      else:
        detail_list_str15 = detail_list_str15 + detail_list15[i] + '$'

    for i, e in enumerate(detail_list16):
      if i == len(detail_list16) - 1:
        detail_list_str16 = detail_list_str16 + detail_list16[i]
      else:
        detail_list_str16 = detail_list_str16 + detail_list16[i] + '$'

    for i, e in enumerate(detail_list17):
      if i == len(detail_list17) - 1:
        detail_list_str17 = detail_list_str17 + detail_list17[i]
      else:
        detail_list_str17 = detail_list_str17 + detail_list17[i] + '$'

    for i, e in enumerate(detail_list18):
      if i == len(detail_list18) - 1:
        detail_list_str18 = detail_list_str18 + detail_list18[i]
      else:
        detail_list_str18 = detail_list_str18 + detail_list18[i] + '$'

    for i, e in enumerate(detail_list19):
      if i == len(detail_list19) - 1:
        detail_list_str19 = detail_list_str19 + detail_list19[i]
      else:
        detail_list_str19 = detail_list_str19 + detail_list19[i] + '$'

    for i, e in enumerate(detail_list20):
      if i == len(detail_list20) - 1:
        detail_list_str20 = detail_list_str20 + detail_list20[i]
      else:
        detail_list_str20 = detail_list_str20 + detail_list20[i] + '$'

    for i, e in enumerate(detail_list21):
      if i == len(detail_list21) - 1:
        detail_list_str21 = detail_list_str21 + detail_list21[i]
      else:
        detail_list_str21 = detail_list_str21 + detail_list21[i] + '$'

    for i, e in enumerate(detail_list22):
      if i == len(detail_list22) - 1:
        detail_list_str22 = detail_list_str22 + detail_list22[i]
      else:
        detail_list_str22 = detail_list_str22 + detail_list22[i] + '$'

    for i, e in enumerate(detail_list23):
      if i == len(detail_list23) - 1:
        detail_list_str23 = detail_list_str23 + detail_list23[i]
      else:
        detail_list_str23 = detail_list_str23 + detail_list23[i] + '$'


    form_default = {
      'employee_no' : obj_get.employee_no3,
      'def_ver' : obj_get.def_ver2,
      'tyoku' : obj_get.tyoku2,
      'work_time' : obj_get.work_time,
      'time_work0' : work_list0,
      'time_work1' : work_list1,
      'time_work2' : work_list2,
      'time_work3' : work_list3,
      'time_work4' : work_list4,
      'time_work5' : work_list5,
      'time_work6' : work_list6,
      'time_work7' : work_list7,
      'time_work8' : work_list8,
      'time_work9' : work_list9,
      'time_work10' : work_list10,
      'time_work11' : work_list11,
      'time_work12' : work_list12,
      'time_work13' : work_list13,
      'time_work14' : work_list14,
      'time_work15' : work_list15,
      'time_work16' : work_list16,
      'time_work17' : work_list17,
      'time_work18' : work_list18,
      'time_work19' : work_list19,
      'time_work20' : work_list20,
      'time_work21' : work_list21,
      'time_work22' : work_list22,
      'time_work23' : work_list23,
      'detail_work0' : detail_list_str0,
      'detail_work1' : detail_list_str1,
      'detail_work2' : detail_list_str2,
      'detail_work3' : detail_list_str3,
      'detail_work4' : detail_list_str4,
      'detail_work5' : detail_list_str5,
      'detail_work6' : detail_list_str6,
      'detail_work7' : detail_list_str7,
      'detail_work8' : detail_list_str8,
      'detail_work9' : detail_list_str9,
      'detail_work10' : detail_list_str10,
      'detail_work11' : detail_list_str11,
      'detail_work12' : detail_list_str12,
      'detail_work13' : detail_list_str13,
      'detail_work14' : detail_list_str14,
      'detail_work15' : detail_list_str15,
      'detail_work16' : detail_list_str16,
      'detail_work17' : detail_list_str17,
      'detail_work18' : detail_list_str18,
      'detail_work19' : detail_list_str19,
      'detail_work20' : detail_list_str20,
      'detail_work21' : detail_list_str21,
      'detail_work22' : detail_list_str22,
      'detail_work23' : detail_list_str23,
      'over_time' : obj_get.over_time,
      'breaktime' : obj_get.breaktime,
      'breaktime_over1' : obj_get.breaktime_over1,
      'breaktime_over2' : obj_get.breaktime_over2,
      'breaktime_over3' : obj_get.breaktime_over3,
      'judgement' : obj_get.judgement,
      'break_change' : obj_get.break_change,
      }

    default_day = obj_get.work_day2


    # フォーム定義
    form = all_kosuForm(form_default)

    # フォーム選択肢定義
    form.fields['def_ver'].choices = Ver_choose



  # HTMLに渡す辞書
  context = {
    'title' : '工数データ編集',
    'form' : form,
    'default_day' : str(default_day),
    'num' : num,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu_detail.html', context)





#--------------------------------------------------------------------------------------------------------




# 工数削除画面定義
def all_kosu_delete(request, num):

  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if request.session.get('login_No', None) == None:
    # 未ログインならログインページに飛ぶ
    return redirect(to = '/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in (page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3):
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')
  

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # POST時の処理
  if (request.method == 'POST'):
    # 取得していた指定従業員番号のレコードを削除する
    obj_get.delete()

    # 工数履歴画面をリダイレクトする
    return redirect(to = '/all_kosu/1')



  # HTMLに渡す辞書
  context = {
    'title' : '工数データ削除',
    'num' : num,
    'obj' : obj_get,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu_delete.html', context)





#--------------------------------------------------------------------------------------------------------
