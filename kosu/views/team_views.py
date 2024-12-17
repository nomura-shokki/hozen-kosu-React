from django.shortcuts import render
from django.shortcuts import redirect
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from dateutil.relativedelta import relativedelta
from io import BytesIO
from django.http import HttpResponse
from ..kosu_utils import handle_get_request
import datetime
import openpyxl
import itertools
import urllib.parse
from ..models import member
from ..models import Business_Time_graph
from ..models import team_member
from ..models import kosu_division
from ..models import administrator_data
from ..forms import teamForm
from ..forms import team_kosuForm
from ..forms import member_findForm
from ..forms import schedule_timeForm




#--------------------------------------------------------------------------------------------------------





# 班員設定画面定義
def team(request):

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
  
  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to = '/')
  

  # 班員登録時の処理
  if "shop_choice" in request.POST:
    # 絞り込むショップをセッションに保存する
    request.session['shop_choose'] = request.POST['shop']
    request.session['shop_choose2'] = request.POST['shop2']

    # このページをリダイレクトする
    return redirect(to = '/team')



  # ログイン者の班員情報取得
  data2 = team_member.objects.filter(employee_no5 = request.session['login_No'])


  # ログイン者の班員登録がない場合の処理
  if data2.count() == 0:

    # ログイン者が組長以上の場合の処理
    if data.shop == '組長以上(P,R,T,その他)' or data.shop == '組長以上(W,A)':
      # 絞り込み1指定あり、絞り込み2指定なしの場合の選択肢を絞り込み1のみで絞り込み
      if request.session.get('shop_choose', None) != None and request.session.get('shop_choose', None) != '' and \
        (request.session.get('shop_choose2', None) == None or request.session.get('shop_choose2', None) == ''):
        member_obj = member.objects.filter(shop = request.session['shop_choose']).order_by('employee_no')

      # 絞り込み2指定あり、絞り込み1指定なしの場合の選択肢を絞り込み2のみで絞り込み
      if request.session.get('shop_choose2', None) != None and request.session.get('shop_choose2', None) != '' and \
        (request.session.get('shop_choose', None) == None or request.session.get('shop_choose', None) == ''):
        member_obj = member.objects.filter(shop = request.session['shop_choose2']).order_by('employee_no')

      # 絞り込み1,2指定ありの場合の選択肢を絞り込み1,2で絞り込み
      if request.session.get('shop_choose', None) != None and request.session.get('shop_choose', None) != '' and \
        request.session.get('shop_choose2', None) != None and request.session.get('shop_choose2', None) != '':
        member_obj = member.objects.filter(Q(shop = request.session['shop_choose'])|Q(shop = request.session['shop_choose2'])).order_by('employee_no')

      # 絞り込み無しの場合、全人員を選択肢に表示
      if (request.session.get('shop_choose', None) == None or request.session.get('shop_choose', None) == '') and \
        (request.session.get('shop_choose2', None) == None or request.session.get('shop_choose2', None) == ''):
        member_obj = member.objects.all().order_by('employee_no')

    # ログイン者が組長以上でない場合の処理
    else:
      # ログイン者と同じショップの人員のオブジェクトを取得
      member_obj = member.objects.filter(shop = data.shop).order_by('employee_no')

    # 人員登録のある従業員番号の選択リスト作成
    choices_list = [('','')]
    for i in member_obj:
      choices_list.append((i.employee_no, str(i.name)))

    # フォーム初期値
    form_list = {
      'shop' : request.session.get('shop_choose', ''),
      'shop2' : request.session.get('shop_choose2', '')
    }

    # フォームを用意
    form = teamForm(form_list)
    # フォームの選択肢定義
    form.fields['member1'].choices = choices_list
    form.fields['member2'].choices = choices_list
    form.fields['member3'].choices = choices_list
    form.fields['member4'].choices = choices_list
    form.fields['member5'].choices = choices_list
    form.fields['member6'].choices = choices_list
    form.fields['member7'].choices = choices_list
    form.fields['member8'].choices = choices_list
    form.fields['member9'].choices = choices_list
    form.fields['member10'].choices = choices_list
    form.fields['member11'].choices = choices_list
    form.fields['member12'].choices = choices_list
    form.fields['member13'].choices = choices_list
    form.fields['member14'].choices = choices_list
    form.fields['member15'].choices = choices_list


    # 班員登録時の処理
    if "team_new" in request.POST:
      # POST送信された値を変数に入れる
      member1 = request.POST['member1']
      member2 = request.POST['member2']
      member3 = request.POST['member3']
      member4 = request.POST['member4']
      member5 = request.POST['member5']
      member6 = request.POST['member6']
      member7 = request.POST['member7']
      member8 = request.POST['member8']
      member9 = request.POST['member9']
      member10 = request.POST['member10']
      member11 = request.POST['member11']
      member12 = request.POST['member12']
      member13 = request.POST['member13']
      member14 = request.POST['member14']
      member15 = request.POST['member15']

      # POSTされた値をモデルのそれぞれのフィールドに入れる
      new = team_member(employee_no5 = request.session['login_No'], \
                        member1 = member1, member2 = member2, member3 = member3, \
                        member4 = member4, member5 = member5, member6 = member6, \
                        member7 = member7, member8 = member8, member9 = member9, \
                        member10 = member10, member11 = member11, member12 = member12, \
                        member13 = member13, member14 = member14, member15 = member15, \
                        follow = 'follow' in request.POST)
      # 新しいレコードを作成しセーブする
      new.save()

      # 班員メイン画面をリダイレクトする
      return redirect(to = '/team_main')


  # ログイン者の班員登録がある場合の処理
  else:
    # ログイン者の班員登録のオブジェクトを取得
    obj = team_member.objects.get(employee_no5 = request.session['login_No'])

    # ログイン者が組長以上の場合の処理
    if data.shop == '組長以上(P,R,T,その他)' or data.shop == '組長以上(W,A)':
      # 絞り込み1指定あり、絞り込み2指定なしの場合の選択肢を絞り込み1のみで絞り込み
      if request.session.get('shop_choose', None) != None and request.session.get('shop_choose', None) != '' and \
        (request.session.get('shop_choose2', None) == None or request.session.get('shop_choose2', None) == ''):
        member_obj = member.objects.filter(shop = request.session['shop_choose']).order_by('employee_no')

      # 絞り込み2指定あり、絞り込み1指定なしの場合の選択肢を絞り込み2のみで絞り込み
      if request.session.get('shop_choose2', None) != None and request.session.get('shop_choose2', None) != '' and \
        (request.session.get('shop_choose', None) == None or request.session.get('shop_choose', None) == ''):
        member_obj = member.objects.filter(shop = request.session['shop_choose2']).order_by('employee_no')

      # 絞り込み1,2指定ありの場合の選択肢を絞り込み1,2で絞り込み
      if request.session.get('shop_choose', None) != None and request.session.get('shop_choose', None) != '' and \
        request.session.get('shop_choose2', None) != None and request.session.get('shop_choose2', None) != '':
        member_obj = member.objects.filter(Q(shop = request.session['shop_choose'])|Q(shop = request.session['shop_choose2'])).order_by('employee_no')

      # 絞り込み無しの場合、全人員を選択肢に表示
      if (request.session.get('shop_choose', None) == None or request.session.get('shop_choose', None) == '') and \
        (request.session.get('shop_choose2', None) == None or request.session.get('shop_choose2', None) == ''):
        member_obj = member.objects.all().order_by('employee_no')

    # ログイン者が組長以上でない場合の処理
    else:
      # ログイン者と同じショップの人員のオブジェクトを取得
      member_obj = member.objects.filter(shop = data.shop).order_by('employee_no')

    # 人員登録のある従業員番号の選択リスト作成
    choices_list = [('','')]
    for i in member_obj:
      choices_list.append((i.employee_no, str(i.name)))
    # フォーム初期値を用意
    form_list = {'shop' : request.session.get('shop_choose', ''),
                 'shop2' : request.session.get('shop_choose2', ''),
                 'follow' : obj.follow, 
                 'member1' : obj.member1, 
                 'member2' : obj.member2, 
                 'member3' : obj.member3, 
                 'member4' : obj.member4, 
                 'member5' : obj.member5, 
                 'member6' : obj.member6, 
                 'member7' : obj.member7, 
                 'member8' : obj.member8, 
                 'member9' : obj.member9, 
                 'member10' : obj.member10, 
                 'member11' : obj.member11, 
                 'member12' : obj.member12, 
                 'member13' : obj.member13, 
                 'member14' : obj.member14, 
                 'member15' : obj.member15}
    # フォームを用意
    form = teamForm(form_list)
    # フォームの選択肢定義
    form.fields['member1'].choices = choices_list
    form.fields['member2'].choices = choices_list
    form.fields['member3'].choices = choices_list
    form.fields['member4'].choices = choices_list
    form.fields['member5'].choices = choices_list
    form.fields['member6'].choices = choices_list
    form.fields['member7'].choices = choices_list
    form.fields['member8'].choices = choices_list
    form.fields['member9'].choices = choices_list
    form.fields['member10'].choices = choices_list
    form.fields['member11'].choices = choices_list
    form.fields['member12'].choices = choices_list
    form.fields['member13'].choices = choices_list
    form.fields['member14'].choices = choices_list
    form.fields['member15'].choices = choices_list

    # 班員登録時の処理
    if "team_new" in request.POST:

      # 指定IDのレコードにPOST送信された値を上書きする
      team_member.objects.update_or_create(employee_no5 = request.session['login_No'], \
          defaults = {'follow' : 'follow' in request.POST, \
                      'member1' : request.POST['member1'], \
                      'member2' : request.POST['member2'], \
                      'member3' : request.POST['member3'], \
                      'member4' : request.POST['member4'], \
                      'member5' : request.POST['member5'], \
                      'member6' : request.POST['member6'], \
                      'member7' : request.POST['member7'], \
                      'member8' : request.POST['member8'], \
                      'member9' : request.POST['member9'], \
                      'member10' : request.POST['member10'], \
                      'member11' : request.POST['member11'], \
                      'member12' : request.POST['member12'], \
                      'member13' : request.POST['member13'], \
                      'member14' : request.POST['member14'], \
                      'member15' : request.POST['member15'], \
                        })

      # 班員メイン画面をリダイレクトする
      return redirect(to = '/team_main')

  # HTMLに渡す辞書
  context = {
    'title' : '班員設定',
    'data' : data,
    'form' : form,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員工数グラフ確認画面定義
def team_graph(request):
  
  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  try:
    # ログイン者の情報取得
    member_obj = member.objects.get(employee_no=request.session['login_No'])
  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect('/login')

  # ログイン者に権限がなければメインページに戻る
  if member_obj.authority == False:
    return redirect(to = '/')

  # ログイン者の班員登録情報取得
  data = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if data.count() == 0:
    return redirect(to = '/')


  # GET時の処理
  if (request.method == 'GET'):
    # 今日の日時を変数に格納
    dt = datetime.date.today()
    # フォーム初期値設定
    default_day = str(dt)



  # POST時の処理
  if (request.method == 'POST'):
    
    # 就業日検索が空で検索された場合の処理
    if request.POST['team_day'] == '':
      # エラーメッセージ出力
      messages.error(request, '日付を指定してから検索して下さい。ERROR27')
      # このページをリダイレクト
      return redirect(to = '/team_graph')

    # POSTされた日付を変数に入れる
    dt = request.POST['team_day']
    # フォーム初期値設定
    default_day = str(dt)



  # フォーム定義
  form = team_kosuForm()

  # ログイン者の班員データ取得
  obj = team_member.objects.get(employee_no5 = request.session['login_No'])

  # 班員データに空があった場合0を定義
  for i in range(1, 16):
    if eval('obj.member{}'.format(i)) == '':
      exec('obj_member{}=0'.format(i))
    else:
      exec('obj_member{}=obj.member{}'.format(i, i))

  # 班員数、班員の名前リスト取得
  n = 0
  name_list = []
  employee_no_list = []

  for i in range(1, 16):
    member_filter =  member.objects.filter(employee_no = eval('obj_member{}'.format(i)))
    if member_filter.count() != 0:
      member_data = member.objects.get(employee_no = eval('obj_member{}'.format(i)))
      name_list.append(member_data.name)
      employee_no_list.append(member_data)
  n = len(name_list)
  

  graph_list1 = []
  graph_item1 = []
  graph_list2 = []
  graph_item2 = []
  graph_list3 = []
  graph_item3 = []
  graph_list4 = []
  graph_item4 = []
  graph_list5 = []
  graph_item5 = []
  graph_list6 = []
  graph_item6 = []
  graph_list7 = []
  graph_item7 = []
  graph_list8 = []
  graph_item8 = []
  graph_list9 = []
  graph_item9 = []
  graph_list10 = []
  graph_item10 = []
  graph_list11 = []
  graph_item11 = []
  graph_list12 = []
  graph_item12 = []
  graph_list13 = []
  graph_item13 = []
  graph_list14 = []
  graph_item14 = []
  graph_list15 = []
  graph_item15 = []

  if n >= 1:
    graph_item1, graph_list1 = handle_get_request(dt, employee_no_list[0])
  if n >= 2:
    graph_item2, graph_list2 = handle_get_request(dt, employee_no_list[1])
  if n >= 3:
    graph_item3, graph_list3 = handle_get_request(dt, employee_no_list[2])
  if n >= 4:
    graph_item4, graph_list4 = handle_get_request(dt, employee_no_list[3])
  if n >= 5:
    graph_item5, graph_list5 = handle_get_request(dt, employee_no_list[4])
  if n >= 6:
    graph_item6, graph_list6 = handle_get_request(dt, employee_no_list[5])
  if n >= 7:
    graph_item7, graph_list7 = handle_get_request(dt, employee_no_list[6])
  if n >= 8:
    graph_item8, graph_list8 = handle_get_request(dt, employee_no_list[7])
  if n >= 9:
    graph_item9, graph_list9 = handle_get_request(dt, employee_no_list[8])
  if n >= 10:
    graph_item10, graph_list10 = handle_get_request(dt, employee_no_list[9])
  if n >= 11:
    graph_item11, graph_list11 = handle_get_request(dt, employee_no_list[10])
  if n >= 12:
    graph_item12, graph_list12 = handle_get_request(dt, employee_no_list[11])
  if n >= 13:
    graph_item13, graph_list13 = handle_get_request(dt, employee_no_list[12])
  if n >= 14:
    graph_item14, graph_list14 = handle_get_request(dt, employee_no_list[13])
  if n >= 15:
    graph_item15, graph_list15 = handle_get_request(dt, employee_no_list[14])

  # 現在使用している工数区分のオブジェクトを取得
  kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))
  # 工数区分登録カウンターリセット
  def_n = 0
  # 工数区分登録数カウント
  for i in range(1, 51):
    if eval('kosu_obj.kosu_title_{}'.format(i)) != '':
      def_n = i

  # 工数区分の選択リスト作成
  graph_kosu_list = []
  for i in range(1, def_n + 1):
    graph_kosu_list.append(eval('kosu_obj.kosu_title_{}'.format(i)))



  # HTMLに渡す辞書
  context = {
    'title' : '班員工数グラフ',
    'form' : form,
    'default_day' : default_day,
    'name_list' : name_list,
    'n' : n,
    'graph_kosu_list' : graph_kosu_list,
    'def_n' : def_n,
    'graph_list1' : graph_list1,
    'graph_item1' : graph_item1,
    'graph_list2' : graph_list2,
    'graph_item2' : graph_item2,
    'graph_list3' : graph_list3,
    'graph_item3' : graph_item3,
    'graph_list4' : graph_list4,
    'graph_item4' : graph_item4,
    'graph_list5' : graph_list5,
    'graph_item5' : graph_item5,
    'graph_list6' : graph_list6,
    'graph_item6' : graph_item6,
    'graph_list7' : graph_list7,
    'graph_item7' : graph_item7,
    'graph_list8' : graph_list8,
    'graph_item8' : graph_item8,
    'graph_list9' : graph_list9,
    'graph_item9' : graph_item9,
    'graph_list10' : graph_list10,
    'graph_item10' : graph_item10,
    'graph_list11' : graph_list11,
    'graph_item11' : graph_item11,
    'graph_list12' : graph_list12,
    'graph_item12' : graph_item12,
    'graph_list13' : graph_list13,
    'graph_item13' : graph_item13,
    'graph_list14' : graph_list14,
    'graph_item14' : graph_item14,
    'graph_list15' : graph_list15,
    'graph_item15' : graph_item15,
    }
 
  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_graph.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員工数確認画面定義
def team_kosu(request, num):

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
  
  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to = '/')

  # ログイン者の班員登録情報取得
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # 今日の日時を変数に格納
  dt = datetime.date.today()

  # フォームの初期値に定義
  if request.session.get('find_employee_no2', '') != '':
    start_list = {'employee_no6' : request.session['find_employee_no2']}

  else:
    start_list = {'employee_no6' : ''}

  if request.session.get('find_team_day', '') != '':
    default_day = request.session['find_team_day']

  else:
    default_day = str(dt)
  

  # フォームの選択肢に使用するログイン者の班員設定のオブジェクト取得
  form_choices = team_member.objects.get(employee_no5 = request.session['login_No'])

  # 選択肢の表示数検出
  for i in range(1, 16):
    # 班員の登録がある場合の処理
    if eval('form_choices.member{}'.format(i)) != '':
      # インデックス記録
      n = i

  # 班員リストリセット
  choices_list = [['','']]
  filtered_list = []

  # 班員リスト作成
  for i in range(n):
    # 班員の選択肢リセット
    choices_element = []

    # 班員が空欄でない場合
    if eval('form_choices.member{}'.format(i + 1)) != '':
      # 班員の従業員番号が人員データにあるか確認
      obj_filter = member.objects.filter(employee_no = eval('form_choices.member{}'.format(i + 1)))
      
      # 班員の従業員番号が人員データにある場合の処理
      if obj_filter.count() != 0:
        # 班員の従業員番号から人員データ取得
        obj_get = member.objects.get(employee_no = eval('form_choices.member{}'.format(i + 1)))

        # 従業員番号と名前の選択肢作成
        choices_element = choices_element + [obj_get.employee_no, obj_get.name]
        filtered_list.append(obj_get.employee_no)

        # 選択肢を選択肢リストに追加
        choices_list.append(choices_element)


  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()



  # POST時の処理
  if (request.method == 'POST'):

    # POST送信時のフォームの状態(POSTした値は入ったまま)
    form = team_kosuForm(request.POST)
    default_day = request.POST['team_day']

    # POSTした値を変数に入れる
    find = request.POST['employee_no6']
    find2 = request.POST['team_day']
    request.session['find_employee_no2'] = find
    request.session['find_team_day'] = find2

    # 就業日と班員の従業員番号でフィルターをかけて一致したものをHTML表示用変数に入れる
    data2 = Business_Time_graph.objects.filter(employee_no3__icontains = find, \
      employee_no3__in = filtered_list, work_day2__contains = find2).order_by('work_day2').reverse()

    page = Paginator(data2, page_num.menu_row)

  # POSTしていない時の処理
  else:
    # POST送信していない時のフォームの状態(今日の日付が入ったフォーム)
    form = team_kosuForm(start_list)

    # 指定メンバーと指定日のセッションある場合の処理
    if ('find_employee_no2' in request.session) and ('find_team_day' in request.session):
      # 班員の従業員番号でフィルターをかけて一致したものをHTML表示用変数に入れる
      data2 = Business_Time_graph.objects.filter(employee_no3__icontains = request.session['find_employee_no2'], \
                                                 employee_no3__in = filtered_list, \
                                                 work_day2__contains = request.session['find_team_day']).order_by('work_day2').reverse()

    # 指定メンバーのセッションのみある場合の処理
    elif ('find_employee_no2' in request.session) and ('find_team_day' not in request.session):
      # 班員の従業員番号でフィルターをかけて一致したものをHTML表示用変数に入れる
      data2 = Business_Time_graph.objects.filter(employee_no3__icontains = request.session['find_employee_no2'], \
                                                 employee_no3__in = filtered_list).order_by('work_day2').reverse()

    # 指定日のセッションのみある場合の処理
    elif ('find_team_day' in request.session) and ('find_employee_no2' not in request.session):
      # 班員の従業員番号でフィルターをかけて一致したものをHTML表示用変数に入れる
      data2 = Business_Time_graph.objects.filter(work_day2__contains = request.session['find_team_day'], \
                                                 employee_no3__in = filtered_list).order_by('work_day2').reverse()

    # セッションがない場合の処理
    else:
      # 班員の従業員番号でフィルターをかけて一致したものをHTML表示用変数に入れる
      data2 = Business_Time_graph.objects.filter(employee_no3__in = filtered_list).order_by('work_day2').reverse()
    

    page = Paginator(data2, page_num.menu_row)



  # フォームの選択肢定義
  form.fields['employee_no6'].choices = choices_list



  # HTMLに渡す辞書
  context = {
    'title' : '班員工数確認',
    'data' : data,
    'data2' : page.get_page(num),
    'form' : form,
    'default_day' : default_day,
    'num' : num,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_kosu.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員工数入力詳細画面定義
def team_detail(request, num):

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

  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to = '/')

  # ログイン者の班員登録情報取得
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 人員名取得
  name_obj_get = member.objects.get(employee_no = obj_get.employee_no3)

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
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

  # 直指定がない場合の処理
  else:
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' \
            or name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' \
            or name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 143)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 145)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 179)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 109)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 41)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 247)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

  # HTML表示用リスト作成
  time_display_list = []
  for k in range(len(time_list_start)):
    for_list = []
    for_list.append(str(time_list_start[k]) + '～' + str(time_list_end[k]))
    for_list.append(def_time[k])
    for_list.append(detail_time[k])
    time_display_list.append(for_list)


  # 工数合計取得
  time_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

  # 基準合計工数定義
  default_total = 0
  if obj_get.work_time == '出勤':
    default_total = 470
  elif obj_get.work_time == 'シフト出勤':
    default_total = 470
  elif obj_get.work_time == '休出':
    default_total = 0
  elif obj_get.work_time == '遅刻・早退':
    default_total = '-'
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半前年休':
    default_total = 220
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半後年休':
    default_total = 250
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半後年休':
    default_total = 240
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半前年休':
    default_total = 275
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半後年休':
    default_total = 195
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半後年休':
    default_total = 240
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半前年休':
    default_total = 290
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半後年休':
    default_total = 180
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半後年休':
    default_total = 240
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半前年休':
    default_total = 230
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半後年休':
    default_total = 240



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'obj_get' : obj_get,
    'time_display_list' : time_display_list,
    'time_total' : time_total,
    'default_total' : default_total,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_detail.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員工数入力状況一覧画面定義
def team_calendar(request):

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

  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to = '/')

  # ログイン者の班員登録情報取得
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # 曜日指定フォーム初期値定義
  week_default = {'Sunday_check' : True, \
                  'Monday_check' : True, \
                  'Tuesday_check' : True, \
                  'Wednesday_check' : True, \
                  'Thursday_check' : True, \
                  'Friday_check' : True, \
                  'Satuday_check' : True}

  # メンバー指定フォーム初期値定義
  member_default = {'member1_check' : True, \
                    'member2_check' : True, \
                    'member3_check' : True, \
                    'member4_check' : True, \
                    'member5_check' : True, \
                    'member6_check' : True, \
                    'member7_check' : True, \
                    'member8_check' : True, \
                    'member9_check' : True, \
                    'member10_check' : True, \
                    'member11_check' : True, \
                    'member12_check' : True, \
                    'member13_check' : True, \
                    'member14_check' : True, \
                    'member15_check' : True}



  # 日付指定時の処理
  if "display_day" in request.POST:
    # POSTされた値を日付に設定
    today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')

    # POSTされた値をセッションに登録
    request.session['display_day'] = request.POST['work_day']


  # POSTしていない時の処理
  else:
    # セッションに表示日の指定がない場合の処理
    if request.session.get('display_day', None) == None:
      # 今日の日付取得
      today = datetime.date.today()

      # 取得した値をセッションに登録
      request.session['display_day'] = str(today)[0 : 10]
      today = datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d')

    # セッションに表示日の指定がある場合の処理
    else:
      # 表示日にセッションの値を入れる
      today = datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d')



  # 前週指定時の処理
  if "back_week" in request.POST:
    # 曜日取得
    week_day_back = today.weekday()

    # 曜日が日曜の場合の処理
    if week_day_back == 6:
      # 1日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=1)

    # 曜日が月曜の場合の処理
    if week_day_back == 0:
      # 2日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=2)

    # 曜日が火曜の場合の処理
    if week_day_back == 1:
      # 3日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=3)

    # 曜日が水曜の場合の処理
    if week_day_back == 2:
      # 4日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=4)

    # 曜日が木曜の場合の処理
    if week_day_back == 3:
      # 5日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=5)

    # 曜日が金曜の場合の処理
    if week_day_back == 4:
      # 6日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=6)

    # 曜日が土曜の場合の処理
    if week_day_back == 5:
      # 7日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=7)

    # 前の週が月をまたぐ場合の処理
    if today.month != datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d').month:
      # 前月の最終日取得
      today = datetime.datetime(today.year, today.month, 1) + relativedelta(months=1) - relativedelta(days=1) 

    # 取得した値をセッションに登録
    request.session['display_day'] = str(today)[0:10]



  # 次週指定時の処理
  if "next_week" in request.POST:
    # 曜日取得
    week_day_back = today.weekday()

    # 曜日が日曜の場合の処理
    if week_day_back == 6:
      # 7日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=7)

    # 曜日が月曜の場合の処理
    if week_day_back == 0:
      # 6日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=6)

    # 曜日が火曜の場合の処理
    if week_day_back == 1:
      # 5日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=5)

    # 曜日が水曜の場合の処理
    if week_day_back == 2:
      # 4日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=4)

    # 曜日が木曜の場合の処理
    if week_day_back == 3:
      # 3日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=3)

    # 曜日が金曜の場合の処理
    if week_day_back == 4:
      # 2日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=2)

    # 曜日が土曜の場合の処理
    if week_day_back == 5:
      # 1日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=1)

    # 次の週が月をまたぐ場合の処理
    if today.month != datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d').month:
      # 次月の初日取得
      today = datetime.datetime(today.year, today.month, 1)

    # 取得した値をセッションに登録
    request.session['display_day'] = str(today)[0:10]



  # Excel書き込み関数定義
  def excel_function(employee_no_data):
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



  # 入力状況をExcelに出力する際の処理
  if "export" in request.POST:
    # POSTされた値を日付に設定
    today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')
    # 指定年、月取得
    year = today.year
    month = today.month

    # POSTされた値をセッションに登録
    request.session['display_day'] = request.POST['work_day']


    # 新しいExcelブック作成
    wb = openpyxl.Workbook()

    # 班員データ取得
    team_obj = team_member.objects.get(employee_no5 = request.session['login_No'])


    # 班員データに空があった場合0を定義
    for i in range(1, 16):
      if eval('team_obj.member{}'.format(i)) == '':
        exec('team_obj_member{}=0'.format(i))
      else:
        exec('team_obj_member{}=team_obj.member{}'.format(i, i))

    # 班員数、班員の従業員番号リスト取得
    n = 0
    employee_no_list = []

    for i in range(1, 16):
      member_filter =  member.objects.filter(employee_no = eval('team_obj_member{}'.format(i)))
      if member_filter.count() != 0:
        member_data = member.objects.get(employee_no = eval('team_obj_member{}'.format(i)))
        employee_no_list.append(member_data.employee_no)
    n = len(employee_no_list)

    time_display_list1 = 0
    time_display_list2 = 0
    time_display_list3 = 0
    time_display_list4 = 0
    time_display_list5 = 0
    time_display_list6 = 0
    time_display_list7 = 0
    time_display_list8 = 0
    time_display_list9 = 0
    time_display_list10 = 0
    time_display_list11 = 0
    time_display_list12 = 0
    time_display_list13 = 0
    time_display_list14 = 0
    time_display_list15 = 0

    for ind, employee_no_num in enumerate(employee_no_list):
      exec('time_display_list{}=excel_function(employee_no_num)'.format(ind + 1))
    
    # 不要なシート削除
    del wb['Sheet']


    # メモリ上にExcelファイルを作成し、BytesIOオブジェクトに保存
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'班員の{year}年{month}月度業務工数入力状況.xlsx'

    # URLエンコーディングされたファイル名を生成
    quoted_filename = urllib.parse.quote(filename)

    # HttpResponseを作成してファイルをダウンロードさせる
    response = HttpResponse(
        excel_file.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    # Content-Dispositionヘッダーを設定
    response['Content-Disposition'] = f'attachment; filename*=UTF-8\'\'{quoted_filename}'
    
    return response


  # 表示日の月を取得
  month = today.month

  # フォームの初期値定義
  default_day = str(today)

  # 曜日取得
  week_day = today.weekday()

  # 日付リストリセット
  day_list = []


  # 曜日が日曜の場合の処理
  if week_day == 6:
    # 日付リスト作成
    for d in range(7):
      # リストに日付追加
      day_list.append(today + datetime.timedelta(days = d))


  # 曜日が月曜の場合の処理
  if week_day == 0:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d == 0:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 1 - d))

      # 設定日以降の日付の処理  
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 1))


  # 曜日が火曜の場合の処理
  if week_day == 1:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 1:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 2 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 2))


  # 曜日が水曜の場合の処理
  if week_day == 2:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 2:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 3 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 3))


  # 曜日が木曜の場合の処理
  if week_day == 3:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 3:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 4 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 4))


  # 曜日が金曜の場合の処理
  if week_day == 4:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 4:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 5 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 5))


  # 曜日が土曜の場合の処理
  if week_day == 5:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 5:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 6 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 6))


  # 日付リスト整形
  for ind, dd in enumerate(day_list):
    # 指定月と表示月が違う要素の処理
    if month != dd.month:
      # 要素を空にする
      day_list[ind] = ''


  # ログイン者の班員取得
  obj_get = team_member.objects.get(employee_no5 = request.session['login_No'])

  # 班員1人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member1 != '':
    # 班員1人目の従業員番号の人員がいるか確認
    member1_obj_filter = member.objects.filter(employee_no__contains = obj_get.member1)

    # 班員1人目の従業員番号の人員がいる場合の処理
    if member1_obj_filter.count() == 1:
      # 班員1人目の名前取得
      member1_obj_get = member.objects.get(employee_no = obj_get.member1)

    # 班員1人目の従業員番号の人員がいない場合の処理
    else:
      # 班員1人目の名前に空を入れる
      member1_obj_get = ''

  # 班員1人目の従業員番号の人員が空の場合の処理
  else:
    # 班員1人目の名前に空を入れる
    member1_obj_get = ''


  # 班員2人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member2 != '':
    # 班員2人目の従業員番号の人員がいるか確認
    member2_obj_filter = member.objects.filter(employee_no__contains = obj_get.member2)

    # 班員2人目の従業員番号の人員がいる場合の処理
    if member2_obj_filter.count() == 1:
      # 班員2人目の名前取得
      member2_obj_get = member.objects.get(employee_no = obj_get.member2)

    # 班員2人目の従業員番号の人員がいない場合の処理
    else:
      # 班員2人目の名前に空を入れる
      member2_obj_get = ''

  # 班員2人目の従業員番号の人員が空の場合の処理
  else:
    # 班員2人目の名前に空を入れる
    member2_obj_get = ''


  # 班員3人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member3 != '':
    # 班員3人目の従業員番号の人員がいるか確認
    member3_obj_filter = member.objects.filter(employee_no__contains = obj_get.member3)

    # 班員3人目の従業員番号の人員がいる場合の処理
    if member3_obj_filter.count() == 1:
      # 班員3人目の名前取得
      member3_obj_get = member.objects.get(employee_no = obj_get.member3)

    # 班員3人目の従業員番号の人員がいない場合の処理
    else:
      # 班員3人目の名前に空を入れる
      member3_obj_get = ''

  # 班員3人目の従業員番号の人員が空の場合の処理
  else:
    # 班員3人目の名前に空を入れる
    member3_obj_get = ''


  # 班員4人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member4 != '':
    # 班員4人目の従業員番号の人員がいるか確認
    member4_obj_filter = member.objects.filter(employee_no__contains = obj_get.member4)

    # 班員4人目の従業員番号の人員がいる場合の処理
    if member4_obj_filter.count() == 1:
      # 班員4人目の名前取得
      member4_obj_get = member.objects.get(employee_no = obj_get.member4)

    # 班員4人目の従業員番号の人員がいない場合の処理
    else:
      # 班員4人目の名前に空を入れる
      member4_obj_get = ''

  # 班員4人目の従業員番号の人員が空の場合の処理
  else:
    # 班員4人目の名前に空を入れる
    member4_obj_get = ''


  # 班員5人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member5 != '':
    # 班員5人目の従業員番号の人員がいるか確認
    member5_obj_filter = member.objects.filter(employee_no__contains = obj_get.member5)

    # 班員5人目の従業員番号の人員がいる場合の処理
    if member5_obj_filter.count() == 1:
      # 班員5人目の名前取得
      member5_obj_get = member.objects.get(employee_no = obj_get.member5)

    # 班員5人目の従業員番号の人員がいない場合の処理
    else:
      # 班員5人目の名前に空を入れる
      member5_obj_get = ''

  # 班員5人目の従業員番号の人員が空の場合の処理
  else:
    # 班員5人目の名前に空を入れる
    member5_obj_get = ''


  # 班員6人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member6 != '':
    # 班員6人目の従業員番号の人員がいるか確認
    member6_obj_filter = member.objects.filter(employee_no__contains = obj_get.member6)

    # 班員6人目の従業員番号の人員がいる場合の処理
    if member6_obj_filter.count() == 1:
      # 班員6人目の名前取得
      member6_obj_get = member.objects.get(employee_no = obj_get.member6)

    # 班員6人目の従業員番号の人員がいない場合の処理
    else:
      # 班員6人目の名前に空を入れる
      member6_obj_get = ''

  # 班員6人目の従業員番号の人員が空の場合の処理
  else:
    # 班員6人目の名前に空を入れる
    member6_obj_get = ''


  # 班員7人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member7 != '':
    # 班員7人目の従業員番号の人員がいるか確認
    member7_obj_filter = member.objects.filter(employee_no__contains = obj_get.member7)

    # 班員7人目の従業員番号の人員がいる場合の処理
    if member7_obj_filter.count() == 1:
      # 班員7人目の名前取得
      member7_obj_get = member.objects.get(employee_no = obj_get.member7)

    # 班員7人目の従業員番号の人員がいない場合の処理
    else:
      # 班員7人目の名前に空を入れる
      member7_obj_get = ''

  # 班員7人目の従業員番号の人員が空の場合の処理
  else:
    # 班員7人目の名前に空を入れる
    member7_obj_get = ''


  # 班員8人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member8 != '':
    # 班員8人目の従業員番号の人員がいるか確認
    member8_obj_filter = member.objects.filter(employee_no__contains = obj_get.member8)

    # 班員8人目の従業員番号の人員がいる場合の処理
    if member8_obj_filter.count() == 1:
      # 班員8人目の名前取得
      member8_obj_get = member.objects.get(employee_no = obj_get.member8)

    # 班員8人目の従業員番号の人員がいない場合の処理
    else:
      # 班員8人目の名前に空を入れる
      member8_obj_get = ''

  # 班員8人目の従業員番号の人員が空の場合の処理
  else:
    # 班員8人目の名前に空を入れる
    member8_obj_get = ''


  # 班員9人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member9 != '':
    # 班員9人目の従業員番号の人員がいるか確認
    member9_obj_filter = member.objects.filter(employee_no__contains = obj_get.member9)

    # 班員9人目の従業員番号の人員がいる場合の処理
    if member9_obj_filter.count() == 1:
      # 班員9人目の名前取得
      member9_obj_get = member.objects.get(employee_no = obj_get.member9)

    # 班員9人目の従業員番号の人員がいない場合の処理
    else:
      # 班員9人目の名前に空を入れる
      member9_obj_get = ''

  # 班員9人目の従業員番号の人員が空の場合の処理
  else:
    # 班員9人目の名前に空を入れる
    member9_obj_get = ''


  # 班員10人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member10 != '':
    # 班員10人目の従業員番号の人員がいるか確認
    member10_obj_filter = member.objects.filter(employee_no__contains = obj_get.member10)

    # 班員10人目の従業員番号の人員がいる場合の処理
    if member10_obj_filter.count() == 1:
      # 班員10人目の名前取得
      member10_obj_get = member.objects.get(employee_no = obj_get.member10)

    # 班員10人目の従業員番号の人員がいない場合の処理
    else:
      # 班員10人目の名前に空を入れる
      member10_obj_get = ''

  # 班員10人目の従業員番号の人員が空の場合の処理
  else:
    # 班員10人目の名前に空を入れる
    member10_obj_get = ''


  # 班員11人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member11 != '':
    # 班員11人目の従業員番号の人員がいるか確認
    member11_obj_filter = member.objects.filter(employee_no__contains = obj_get.member11)

    # 班員11人目の従業員番号の人員がいる場合の処理
    if member11_obj_filter.count() == 1:
      # 班員11人目の名前取得
      member11_obj_get = member.objects.get(employee_no = obj_get.member11)

    # 班員11人目の従業員番号の人員がいない場合の処理
    else:
      # 班員11人目の名前に空を入れる
      member11_obj_get = ''

  # 班員11人目の従業員番号の人員が空の場合の処理
  else:
    # 班員11人目の名前に空を入れる
    member11_obj_get = ''


  # 班員12人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member12 != '':
    # 班員12人目の従業員番号の人員がいるか確認
    member12_obj_filter = member.objects.filter(employee_no__contains = obj_get.member12)

    # 班員12人目の従業員番号の人員がいる場合の処理
    if member12_obj_filter.count() == 1:
      # 班員12人目の名前取得
      member12_obj_get = member.objects.get(employee_no = obj_get.member12)

    # 班員12人目の従業員番号の人員がいない場合の処理
    else:
      # 班員12人目の名前に空を入れる
      member12_obj_get = ''

  # 班員12人目の従業員番号の人員が空の場合の処理
  else:
    # 班員12人目の名前に空を入れる
    member12_obj_get = ''


  # 班員13人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member13 != '':
    # 班員13人目の従業員番号の人員がいるか確認
    member13_obj_filter = member.objects.filter(employee_no__contains = obj_get.member13)

    # 班員13人目の従業員番号の人員がいる場合の処理
    if member13_obj_filter.count() == 1:
      # 班員13人目の名前取得
      member13_obj_get = member.objects.get(employee_no = obj_get.member13)

    # 班員13人目の従業員番号の人員がいない場合の処理
    else:
      # 班員13人目の名前に空を入れる
      member13_obj_get = ''

  # 班員13人目の従業員番号の人員が空の場合の処理
  else:
    # 班員13人目の名前に空を入れる
    member13_obj_get = ''


  # 班員14人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member14 != '':
    # 班員14人目の従業員番号の人員がいるか確認
    member14_obj_filter = member.objects.filter(employee_no__contains = obj_get.member14)

    # 班員14人目の従業員番号の人員がいる場合の処理
    if member14_obj_filter.count() == 1:
      # 班員14人目の名前取得
      member14_obj_get = member.objects.get(employee_no = obj_get.member14)

    # 班員14人目の従業員番号の人員がいない場合の処理
    else:
      # 班員14人目の名前に空を入れる
      member14_obj_get = ''

  # 班員14人目の従業員番号の人員が空の場合の処理
  else:
    # 班員14人目の名前に空を入れる
    member14_obj_get = ''


  # 班員15人目の従業員番号の人員が空でない場合の処理
  if  obj_get.member15 != '':
    # 班員15人目の従業員番号の人員がいるか確認
    member15_obj_filter = member.objects.filter(employee_no__contains = obj_get.member15)

    # 班員15人目の従業員番号の人員がいる場合の処理
    if member15_obj_filter.count() == 1:
      # 班員15人目の名前取得
      member15_obj_get = member.objects.get(employee_no = obj_get.member15)

    # 班員15人目の従業員番号の人員がいない場合の処理
    else:
      # 班員15人目の名前に空を入れる
      member15_obj_get = ''

  # 班員15人目の従業員番号の人員が空の場合の処理
  else:
    # 班員15人目の名前に空を入れる
    member15_obj_get = ''


  # 取得した班員の名前をHTML送信用の変数に入れる
  member_name1 = member1_obj_get
  member_name2 = member2_obj_get
  member_name3 = member3_obj_get
  member_name4 = member4_obj_get
  member_name5 = member5_obj_get
  member_name6 = member6_obj_get
  member_name7 = member7_obj_get
  member_name8 = member8_obj_get
  member_name9 = member9_obj_get
  member_name10 = member10_obj_get
  member_name11 = member11_obj_get
  member_name12 = member12_obj_get
  member_name13 = member13_obj_get
  member_name14 = member14_obj_get
  member_name15 = member15_obj_get


  # 班員(従業員番号)リストリセット
  member_list = []
  # 選択肢の表示数検出&班員(従業員番号)リスト作成
  for i in range(1, 16):
    # 班員(従業員番号)リストに班員追加
    member_list.append(eval('obj_get.member{}'.format(i)))

    # 班員の登録がある場合の処理
    if eval('obj_get.member{}'.format(i)) != '':
      # インデックス記録
      member_num = i


  # 就業リストリセット
  work_list1 = []
  work_list2 = []
  work_list3 = []
  work_list4 = []
  work_list5 = []
  work_list6 = []
  work_list7 = []
  work_list8 = []
  work_list9 = []
  work_list10 = []
  work_list11 = []
  work_list12 = []
  work_list13 = []
  work_list14 = []
  work_list15 = []

  # 残業リストリセット
  over_time_list1 = []
  over_time_list2 = []
  over_time_list3 = []
  over_time_list4 = []
  over_time_list5 = []
  over_time_list6 = []
  over_time_list7 = []
  over_time_list8 = []
  over_time_list9 = []
  over_time_list10 = []
  over_time_list11 = []
  over_time_list12 = []
  over_time_list13 = []
  over_time_list14 = []
  over_time_list15 = []

  # 工数入力リストリセット
  kosu_list1 = []
  kosu_list2 = []
  kosu_list3 = []
  kosu_list4 = []
  kosu_list5 = []
  kosu_list6 = []
  kosu_list7 = []
  kosu_list8 = []
  kosu_list9 = []
  kosu_list10 = []
  kosu_list11 = []
  kosu_list12 = []
  kosu_list13 = []
  kosu_list14 = []
  kosu_list15 = []

  # 工数入力OK_NGリストリセット
  ok_ng_list1 = []
  ok_ng_list2 = []
  ok_ng_list3 = []
  ok_ng_list4 = []
  ok_ng_list5 = []
  ok_ng_list6 = []
  ok_ng_list7 = []
  ok_ng_list8 = []
  ok_ng_list9 = []
  ok_ng_list10 = []
  ok_ng_list11 = []
  ok_ng_list12 = []
  ok_ng_list13 = []
  ok_ng_list14 = []
  ok_ng_list15 = []



  # 班員(従業員番号)リストごとに就業、残業、工数入力OK_NGリスト作成
  for ind, m in enumerate(member_list):
    # 班員登録がある場合の処理
    if m != '':
      # 日付リストを使用し日付ごとの就業、残業取得しリスト作成
      for ind2, day in enumerate(day_list):
        kosu_list = []

        # 日付リストが空でない場合の処理
        if day != '':
          # 指定日に工数データあるか確認
          member_obj_filter =Business_Time_graph.objects.filter(employee_no3 = m, work_day2 = day)

          # 指定日に工数データがある場合の処理
          if member_obj_filter.count() != 0:
            # 指定日の工数データ取得
            member_obj_get =Business_Time_graph.objects.get(employee_no3 = m, work_day2 = day)

            # 就業、残業リストに工数データから就業、残業、工数入力OK_NG追加
            exec('work_list{}.append(member_obj_get.work_time)'.format(ind + 1))
            exec('over_time_list{}.append(member_obj_get.over_time)'.format(ind + 1))
            exec('ok_ng_list{}.append(member_obj_get.judgement)'.format(ind + 1))

            # 工数データが空の場合の処理
            if member_obj_get.time_work == '#'*288:

              # 空の工数入力リストを作成
              for k in range(4):

                # 工数入力リストに空を入れる
                kosu_list.append('　　　　　')

            # 工数データが空でない場合の処理
            else:

              # 作業内容リストに解凍
              data_list = list(member_obj_get.time_work)

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
                kosu_list.append('{}:{}～{}:{}'.format(start_hour1, str(start_min1).zfill(2), \
                                                    end_hour1, str(end_min1).zfill(2)))
              else:
                kosu_list.append('　　　　　')
                
              if start_index2 != 0 or end_index2 != 0:
                start_hour2 = start_index2//12
                start_min2 = (start_index2%12)*5
                end_hour2 =end_index2//12
                end_min2 = (end_index2%12)*5
                kosu_list.append('{}:{}～{}:{}'.format(start_hour2, str(start_min2).zfill(2), \
                                                    end_hour2, str(end_min2).zfill(2)))
              else:
                kosu_list.append('　　　　　')

              if start_index3 != 0 or end_index3 != 0:
                start_hour3 = start_index3//12
                start_min3 = (start_index3%12)*5
                end_hour3 =end_index3//12
                end_min3 = (end_index3%12)*5
                kosu_list.append('{}:{}～{}:{}'.format(start_hour3, str(start_min3).zfill(2), \
                                                    end_hour3, str(end_min3).zfill(2)))
              else:
                kosu_list.append('　　　　　')
                
              if start_index4 != 0 or end_index4 != 0:
                start_hour4 = start_index4//12
                start_min4 = (start_index4%12)*5
                end_hour4 =end_index4//12
                end_min4 = (end_index4%12)*5
                kosu_list.append('{}:{}～{}:{}'.format(start_hour4, str(start_min4).zfill(2), \
                                                    end_hour4, str(end_min4).zfill(2)))
              else:
                kosu_list.append('　　　　　')

          # 指定日に工数データがない場合の処理
          else:

            # 就業、残業リストに空追加
            exec('work_list{}.append("")'.format(ind + 1))
            exec('over_time_list{}.append("")'.format(ind + 1))
            exec('ok_ng_list{}.append({})'.format(ind + 1, False))

            # 空の工数入力リストを作成
            for k in range(4):

              # 工数入力リストに空を入れる
              kosu_list.append('　　　　　')

        # 日付リストが空の場合の処理
        else:
          # 就業、残業リストに空追加
          exec('work_list{}.append("")'.format(ind + 1))
          exec('over_time_list{}.append("")'.format(ind + 1))
          exec('ok_ng_list{}.append({})'.format(ind + 1, False))

          # 空の工数入力リストを作成
          for k in range(4):
            # 工数入力リストに空を入れる
            kosu_list.append('　　　　　')

        # 工数入力リストに1日分の入力工数追加
        exec('kosu_list{}.append(kosu_list)'.format(ind + 1))

    # 班員登録がない場合の処理
    else:
      # 空の就業、残業リスト作成
      for b in range(7):
        # 就業、残業リストに空追加
        exec('work_list{}.append("　　　　　")'.format(ind + 1))
        exec('over_time_list{}.append("")'.format(ind + 1))
        exec('ok_ng_list{}.append({})'.format(ind + 1, False))


      for n in range(7):
        kosu_list = []
        # 空の工数入力リストを作成
        for k in range(4):
          # 工数入力リストに空を入れる
          kosu_list.append('　　　　　')
        
        # 工数入力リストに1日分の入力工数追加
        exec('kosu_list{}.append(kosu_list)'.format(ind + 1))


  # 工数入力OK_NGリスト反転
  ok_ng_list1.reverse()
  ok_ng_list2.reverse()
  ok_ng_list3.reverse()
  ok_ng_list4.reverse()
  ok_ng_list5.reverse()
  ok_ng_list6.reverse()
  ok_ng_list7.reverse()
  ok_ng_list8.reverse()
  ok_ng_list9.reverse()
  ok_ng_list10.reverse()
  ok_ng_list11.reverse()
  ok_ng_list12.reverse()
  ok_ng_list13.reverse()
  ok_ng_list14.reverse()
  ok_ng_list15.reverse()

 

  # HTMLに渡す辞書
  context = {
    'title' : '班員工数入力状況一覧',
    'default_day' : default_day,
    'member_num' : member_num,
    'day_list' : day_list,
    'member_name1' : member_name1,
    'work_list1' : work_list1,
    'over_time_list1' : over_time_list1,
    'kosu_list1' : kosu_list1,
    'ok_ng_list1' : ok_ng_list1,
    'member_name2' : member_name2,
    'work_list2' : work_list2,
    'over_time_list2' : over_time_list2,
    'kosu_list2' : kosu_list2,
    'ok_ng_list2' : ok_ng_list2,
    'member_name3' : member_name3,
    'work_list3' : work_list3,
    'over_time_list3' : over_time_list3,
    'kosu_list3' : kosu_list3,
    'ok_ng_list3' : ok_ng_list3,
    'member_name4' : member_name4,
    'work_list4' : work_list4,
    'over_time_list4' : over_time_list4,
    'kosu_list4' : kosu_list4,
    'ok_ng_list4' : ok_ng_list4,
    'member_name5' : member_name5,
    'work_list5' : work_list5,
    'over_time_list5' : over_time_list5,
    'kosu_list5' : kosu_list5,
    'ok_ng_list5' : ok_ng_list5,
    'member_name6' : member_name6,
    'work_list6' : work_list6,
    'over_time_list6' : over_time_list6,
    'kosu_list6' : kosu_list6,
    'ok_ng_list6' : ok_ng_list6,
    'member_name7' : member_name7,
    'work_list7' : work_list7,
    'over_time_list7' : over_time_list7,
    'kosu_list7' : kosu_list7,
    'ok_ng_list7' : ok_ng_list7,
    'member_name8' : member_name8,
    'work_list8' : work_list8,
    'over_time_list8' : over_time_list8,
    'kosu_list8' : kosu_list8,
    'ok_ng_list8' : ok_ng_list8,
    'member_name9' : member_name9,
    'work_list9' : work_list9,
    'over_time_list9' : over_time_list9,
    'kosu_list9' : kosu_list9,
    'ok_ng_list9' : ok_ng_list9,
    'member_name10' : member_name10,
    'work_list10' : work_list10,
    'over_time_list10' : over_time_list10,
    'kosu_list10' : kosu_list10,
    'ok_ng_list10' : ok_ng_list10,
    'member_name11' : member_name11,
    'work_list11' : work_list11,
    'over_time_list11' : over_time_list11,
    'kosu_list11' : kosu_list11,
    'ok_ng_list11' : ok_ng_list11,
    'member_name12' : member_name12,
    'work_list12' : work_list12,
    'over_time_list12' : over_time_list12,
    'kosu_list12' : kosu_list12,
    'ok_ng_list12' : ok_ng_list12,
    'member_name13' : member_name13,
    'work_list13' : work_list13,
    'over_time_list13' : over_time_list13,
    'kosu_list13' : kosu_list13,
    'ok_ng_list13' : ok_ng_list13,
    'member_name14' : member_name14,
    'work_list14' : work_list14,
    'over_time_list14' : over_time_list14,
    'kosu_list14' : kosu_list14,
    'ok_ng_list14' : ok_ng_list14,
    'member_name15' : member_name15,
    'work_list15' : work_list15,
    'over_time_list15' : over_time_list15,
    'kosu_list15' : kosu_list15,
    'ok_ng_list15' : ok_ng_list15,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_calendar.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員残業一覧画面定義
def team_over_time(request):

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

  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to = '/')

  # ログイン者の班員登録情報あるか確認
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # ログイン者の班員登録情報取得
  team_get = team_member.objects.get(employee_no5 = request.session['login_No'])

  # 班員1人目の従業員番号の人員が空でない場合の処理
  if  team_get.member1 != '':
    # 班員1人目の従業員番号の人員がいるか確認
    member1_obj_filter = member.objects.filter(employee_no = team_get.member1)

    # 班員1人目の従業員番号の人員がいる場合の処理
    if member1_obj_filter.count() != 0:
      # 班員1人目の情報取得
      member1_obj_get = member.objects.get(employee_no = team_get.member1)

    # 班員1人目の従業員番号の人員がいない場合の処理
    else:
      # 班員1人目に空を入れる
      member1_obj_get = ''

  # 班員1人目の従業員番号の人員が空の場合の処理
  else:
    # 班員1人目に空を入れる
    member1_obj_get = ''


  # 班員2人目の従業員番号の人員が空でない場合の処理
  if  team_get.member2 != '':
    # 班員2人目の従業員番号の人員がいるか確認
    member2_obj_filter = member.objects.filter(employee_no = team_get.member2)

    # 班員2人目の従業員番号の人員がいる場合の処理
    if member2_obj_filter.count() != 0:
      # 班員2人目の情報取得
      member2_obj_get = member.objects.get(employee_no = team_get.member2)

    # 班員2人目の従業員番号の人員がいない場合の処理
    else:
      # 班員2人目に空を入れる
      member2_obj_get = ''

  # 班員2人目の従業員番号の人員が空の場合の処理
  else:
    # 班員2人目に空を入れる
    member2_obj_get = ''


  # 班員3人目の従業員番号の人員が空でない場合の処理
  if  team_get.member3 != '':
    # 班員3人目の従業員番号の人員がいるか確認
    member3_obj_filter = member.objects.filter(employee_no = team_get.member3)

    # 班員3人目の従業員番号の人員がいる場合の処理
    if member3_obj_filter.count() != 0:
      # 班員3人目の情報取得
      member3_obj_get = member.objects.get(employee_no = team_get.member3)

    # 班員3人目の従業員番号の人員がいない場合の処理
    else:
      # 班員3人目に空を入れる
      member3_obj_get = ''

  # 班員3人目の従業員番号の人員が空の場合の処理
  else:
    # 班員3人目に空を入れる
    member3_obj_get = ''


  # 班員4人目の従業員番号の人員が空でない場合の処理
  if  team_get.member4 != '':
    # 班員4人目の従業員番号の人員がいるか確認
    member4_obj_filter = member.objects.filter(employee_no = team_get.member4)
    
    # 班員4人目の従業員番号の人員がいる場合の処理
    if member4_obj_filter.count() != 0:
      # 班員4人目の情報取得
      member4_obj_get = member.objects.get(employee_no = team_get.member4)

    # 班員4人目の従業員番号の人員がいない場合の処理
    else:
      # 班員4人目に空を入れる
      member4_obj_get = ''

  # 班員4人目の従業員番号の人員が空の場合の処理
  else:
    # 班員4人目に空を入れる
    member4_obj_get = ''


  # 班員5人目の従業員番号の人員が空でない場合の処理
  if  team_get.member5 != '':
    # 班員5人目の従業員番号の人員がいるか確認
    member5_obj_filter = member.objects.filter(employee_no = team_get.member5)

    # 班員5人目の従業員番号の人員がいる場合の処理
    if member5_obj_filter.count() != 0:
      # 班員5人目の情報取得
      member5_obj_get = member.objects.get(employee_no = team_get.member5)

    # 班員5人目の従業員番号の人員がいない場合の処理
    else:
      # 班員5人目に空を入れる
      member5_obj_get = ''

  # 班員5人目の従業員番号の人員が空の場合の処理
  else:
    # 班員5人目に空を入れる
    member5_obj_get = ''


  # 班員6人目の従業員番号の人員が空でない場合の処理
  if  team_get.member6 != '':
    # 班員6人目の従業員番号の人員がいるか確認
    member6_obj_filter = member.objects.filter(employee_no = team_get.member6)

    # 班員6人目の従業員番号の人員がいる場合の処理
    if member6_obj_filter.count() != 0:
      # 班員6人目の情報取得
      member6_obj_get = member.objects.get(employee_no = team_get.member6)

    # 班員6人目の従業員番号の人員がいない場合の処理
    else:
      # 班員6人目に空を入れる
      member6_obj_get = ''

  # 班員6人目の従業員番号の人員が空の場合の処理
  else:
    # 班員6人目に空を入れる
    member6_obj_get = ''


  # 班員7人目の従業員番号の人員が空でない場合の処理
  if  team_get.member7 != '':
    # 班員7人目の従業員番号の人員がいるか確認
    member7_obj_filter = member.objects.filter(employee_no = team_get.member7)

    # 班員7人目の従業員番号の人員がいる場合の処理
    if member7_obj_filter.count() != 0:
      # 班員7人目の情報取得
      member7_obj_get = member.objects.get(employee_no = team_get.member7)

    # 班員7人目の従業員番号の人員がいない場合の処理
    else:
      # 班員7人目に空を入れる
      member7_obj_get = ''

  # 班員7人目の従業員番号の人員が空の場合の処理
  else:
    # 班員7人目に空を入れる
    member7_obj_get = ''


  # 班員8人目の従業員番号の人員が空でない場合の処理
  if  team_get.member8 != '':
    # 班員8人目の従業員番号の人員がいるか確認
    member8_obj_filter = member.objects.filter(employee_no = team_get.member8)

    # 班員8人目の従業員番号の人員がいる場合の処理
    if member8_obj_filter.count() != 0:
      # 班員8人目の情報取得
      member8_obj_get = member.objects.get(employee_no = team_get.member8)

    # 班員8人目の従業員番号の人員がいない場合の処理
    else:
      # 班員8人目に空を入れる
      member8_obj_get = ''

  # 班員8人目の従業員番号の人員が空の場合の処理
  else:
    # 班員8人目に空を入れる
    member8_obj_get = ''


  # 班員9人目の従業員番号の人員が空でない場合の処理
  if  team_get.member9 != '':
    # 班員9人目の従業員番号の人員がいるか確認
    member9_obj_filter = member.objects.filter(employee_no = team_get.member9)

    # 班員9人目の従業員番号の人員がいる場合の処理
    if member9_obj_filter.count() != 0:
      # 班員9人目の情報取得
      member9_obj_get = member.objects.get(employee_no = team_get.member9)

    # 班員9人目の従業員番号の人員がいない場合の処理
    else:
      # 班員9人目に空を入れる
      member9_obj_get = ''

  # 班員9人目の従業員番号の人員が空の場合の処理
  else:
    # 班員9人目に空を入れる
    member9_obj_get = ''


  # 班員10人目の従業員番号の人員が空でない場合の処理
  if  team_get.member10 != '':
    # 班員10人目の従業員番号の人員がいるか確認
    member10_obj_filter = member.objects.filter(employee_no = team_get.member10)

    # 班員10人目の従業員番号の人員がいる場合の処理
    if member10_obj_filter.count() != 0:
      # 班員10人目の情報取得
      member10_obj_get = member.objects.get(employee_no = team_get.member10)

    # 班員10人目の従業員番号の人員がいない場合の処理
    else:
      # 班員10人目に空を入れる
      member10_obj_get = ''

  # 班員10人目の従業員番号の人員が空の場合の処理
  else:
    # 班員10人目に空を入れる
    member10_obj_get = ''


  # 班員11人目の従業員番号の人員が空でない場合の処理
  if  team_get.member11 != '':
    # 班員11人目の従業員番号の人員がいるか確認
    member11_obj_filter = member.objects.filter(employee_no = team_get.member11)

    # 班員11人目の従業員番号の人員がいる場合の処理
    if member11_obj_filter.count() != 0:
      # 班員11人目の情報取得
      member11_obj_get = member.objects.get(employee_no = team_get.member11)

    # 班員11人目の従業員番号の人員がいない場合の処理
    else:
      # 班員11人目に空を入れる
      member11_obj_get = ''

  # 班員11人目の従業員番号の人員が空の場合の処理
  else:
    # 班員11人目に空を入れる
    member11_obj_get = ''


  # 班員12人目の従業員番号の人員が空でない場合の処理
  if  team_get.member12 != '':
    # 班員12人目の従業員番号の人員がいるか確認
    member12_obj_filter = member.objects.filter(employee_no = team_get.member12)

    # 班員12人目の従業員番号の人員がいる場合の処理
    if member12_obj_filter.count() != 0:
      # 班員12人目の情報取得
      member12_obj_get = member.objects.get(employee_no = team_get.member12)

    # 班員12人目の従業員番号の人員がいない場合の処理
    else:
      # 班員12人目に空を入れる
      member12_obj_get = ''

  # 班員12人目の従業員番号の人員が空の場合の処理
  else:
    # 班員12人目に空を入れる
    member12_obj_get = ''


  # 班員13人目の従業員番号の人員が空でない場合の処理
  if  team_get.member13 != '':
    # 班員13人目の従業員番号の人員がいるか確認
    member13_obj_filter = member.objects.filter(employee_no = team_get.member13)

    # 班員13人目の従業員番号の人員がいる場合の処理
    if member13_obj_filter.count() != 0:
      # 班員13人目の情報取得
      member13_obj_get = member.objects.get(employee_no = team_get.member13)

    # 班員13人目の従業員番号の人員がいない場合の処理
    else:
      # 班員13人目に空を入れる
      member13_obj_get = ''

  # 班員13人目の従業員番号の人員が空の場合の処理
  else:
    # 班員13人目に空を入れる
    member13_obj_get = ''


  # 班員14人目の従業員番号の人員が空でない場合の処理
  if  team_get.member14 != '':
    # 班員14人目の従業員番号の人員がいるか確認
    member14_obj_filter = member.objects.filter(employee_no = team_get.member14)

    # 班員14人目の従業員番号の人員がいる場合の処理
    if member14_obj_filter.count() != 0:
      # 班員14人目の情報取得
      member14_obj_get = member.objects.get(employee_no = team_get.member14)

    # 班員14人目の従業員番号の人員がいない場合の処理
    else:
      # 班員14人目に空を入れる
      member14_obj_get = ''

  # 班員14人目の従業員番号の人員が空の場合の処理
  else:
    # 班員14人目に空を入れる
    member14_obj_get = ''


  # 班員15人目の従業員番号の人員が空でない場合の処理
  if  team_get.member15 != '':
    # 班員15人目の従業員番号の人員がいるか確認
    member15_obj_filter = member.objects.filter(employee_no = team_get.member15)

    # 班員15人目の従業員番号の人員がいる場合の処理
    if member15_obj_filter.count() != 0:
      # 班員15人目の情報取得
      member15_obj_get = member.objects.get(employee_no = team_get.member15)

    # 班員15人目の従業員番号の人員がいない場合の処理
    else:
      # 班員15人目に空を入れる
      member15_obj_get = ''

  # 班員15人目の従業員番号の人員が空の場合の処理
  else:
    # 班員15人目に空を入れる
    member15_obj_get = ''


  # 班員(従業員番号)リストリセット
  member_list = []
  # 選択肢の表示数検出&班員(従業員番号)リスト作成
  for i in range(1, 16):
    # 人員情報ある場合の処理
    if eval('member{}_obj_get'.format(i)) != '':
      # 班員リストに班員追加
      member_list.append(eval('member{}_obj_get'.format(i)))
    


  # POST時の処理
  if (request.method == 'POST'):
    # 検索項目に空欄がある場合の処理
    if request.POST['year'] == '' or request.POST['month'] == '':
      # エラーメッセージ出力
      messages.error(request, '表示年月に未入力箇所があります。ERROR082')
      # このページをリダイレクト
      return redirect(to = '/class_list')
    

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
  over_time_list1 = []
  over_time_list2 = []
  over_time_list3 = []
  over_time_list4 = []
  over_time_list5 = []
  over_time_list6 = []
  over_time_list7 = []
  over_time_list8 = []
  over_time_list9 = []
  over_time_list10 = []
  over_time_list11 = []
  over_time_list12 = []
  over_time_list13 = []
  over_time_list14 = []
  over_time_list15 = []

  # 残業リスト作成するループ
  for ind, m in enumerate(member_list):
    # 残業リストの先頭に人員の名前入れる
    eval('over_time_list{}.append(m.name)'.format(ind + 1))

    # 残業合計リセット
    over_time_total = 0

    # 日毎の残業と整合性をリストに追加するループ
    for d in range(1, int(last_day_of_month.day) + 1):
      # 該当日に工数データあるか確認
      obj_filter = Business_Time_graph.objects.filter(employee_no3 = m.employee_no, \
                                                      work_day2 = datetime.date(year, month, d))

      # 該当日に工数データがある場合の処理
      if obj_filter.count() != 0:
        # 工数データ取得
        obj_get = Business_Time_graph.objects.get(employee_no3 = m.employee_no, \
                                                  work_day2 = datetime.date(year, month, d))
        
        # 残業データを分→時に変換
        obj_get.over_time = int(obj_get.over_time)/60

        # 残業リストにレコードを追加
        eval('over_time_list{}.append(obj_get)'.format(ind + 1))

        # 残業を合計する
        over_time_total += float(obj_get.over_time)

      # 該当日に工数データがない場合の処理
      else:
        # 残業リストに残業0と整合性否を追加
        eval('over_time_list{}.append(Business_Time_graph(over_time = 0, judgement = False))'.format(ind + 1))

    # リストに残業合計追加
    eval('over_time_list{}.append(over_time_total)'.format(ind + 1))
    eval('over_time_list{}.insert(1,{})'.format(ind + 1, over_time_total))




  
  # HTMLに渡す辞書
  context = {
    'title' : '班員残業管理',
    'form' : form,
    'day_list' : zip(range(1, last_day_of_month.day + 1), week_list), 
    'week_list' : week_list,
    'over_time_list1' : over_time_list1,
    'over_time_list2' : over_time_list2,
    'over_time_list3' : over_time_list3,
    'over_time_list4' : over_time_list4,
    'over_time_list5' : over_time_list5,
    'over_time_list6' : over_time_list6,
    'over_time_list7' : over_time_list7,
    'over_time_list8' : over_time_list8,
    'over_time_list9' : over_time_list9,
    'over_time_list10' : over_time_list10,
    'over_time_list11' : over_time_list11,
    'over_time_list12' : over_time_list12,
    'over_time_list13' : over_time_list13,
    'over_time_list14' : over_time_list14,
    'over_time_list15' : over_time_list15,
    'team_n' : len(member_list),
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_over_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数入力可否(ショップ単位)画面定義
def class_list(request):

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



  # POST時の処理
  if (request.method == 'POST'):
    # 検索項目に空欄がある場合の処理
    if request.POST['year'] == '' or request.POST['month'] == '':
      # エラーメッセージ出力
      messages.error(request, '表示年月に未入力箇所があります。ERROR032')
      # このページをリダイレクト
      return redirect(to = '/class_list')
    

    # フォームの初期値定義
    shop_default = {'shop2' : request.POST['shop2']}
    schedule_default = {'year' : request.POST['year'], 
                        'month' : request.POST['month']}
    
    # フォーム定義
    shop_form = member_findForm(shop_default)
    schedule_form = schedule_timeForm(schedule_default)

    # POSTした値をセッションに登録
    request.session['find_shop'] = request.POST['shop2']
    request.session['find_year'] = request.POST['year']
    request.session['find_month'] = request.POST['month']


    # 選択ショップの人員取得
    member_obj_filter = member.objects.filter(shop = request.POST['shop2']).order_by('employee_no')

    # 空のリスト定義
    No_list = []
    name_list = []
    ok_list = []
    week_list = []

    # 取得した人員情報の従業員番号をリスト化するループ
    for i in member_obj_filter:
      # 従業員番号をリストに追加
      No_list.append(i.employee_no)
      # 名前をリストに追加
      name_list.append(i.name)

    
    # 次の月の最初の日を定義
    if request.POST['month'] == '12':
        next_month = datetime.date(int(request.POST['year']) + 1, 1, 1)

    else:
        next_month = datetime.date(int(request.POST['year']), int(request.POST['month']) + 1, 1)

    # 次の月の最初の日から1を引くことで、指定した月の最後の日を取得
    last_day_of_month = next_month - datetime.timedelta(days = 1)



    # 指定ショップの人員毎に工数入力可否をリストにするループ
    for name in name_list:

      # 仮リストを空で定義
      provisional_list = []
      # 仮リストに人員名を入れる
      provisional_list.append(name)

      # 人員情報取得
      member_obj_get = member.objects.get(name = name)


      # 取得した人員の工数入力可否をリスト化するループ
      for day in range(1, last_day_of_month.day + 1):

        # 指定日に工数データがあるか確認
        obj_filter = Business_Time_graph.objects.filter(employee_no3 = member_obj_get.employee_no, \
                                                        work_day2 = datetime.date(int(request.POST['year']), \
                                                                                  int(request.POST['month']), \
                                                                                  day))
        
        # 工数データがある場合の処理
        if obj_filter.count() != 0:
          # 工数データ取得
          obj_get = Business_Time_graph.objects.get(employee_no3 = member_obj_get.employee_no, \
                                                    work_day2 = datetime.date(int(request.POST['year']), \
                                                                              int(request.POST['month']), \
                                                                              day))

          # 工数入力可否を仮リストに入れる
          provisional_list.append(obj_get)

        # 工数データがない場合の処理
        else:
          # 仮リストに工数入力可否をFalseで入れる
          provisional_list.append(None)

      # 仮リストを工数入力可否リストに入れる
      ok_list.append(provisional_list)


    # 曜日リスト作成するループ
    for d in range(1, last_day_of_month.day + 1):
      # 曜日を取得する日を作成
      week_day = datetime.date(int(request.POST['year']), int(request.POST['month']), d)

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


  # POST時以外の処理
  else:
    # セッション値に年月のデータがない場合の処理
    if request.session.get('find_year', '') == '' or request.session.get('find_month', '') == '':
      # 本日の年月取得
      year = datetime.date.today().year
      month = datetime.date.today().month

    # セッション値に年月のデータがある場合の処理
    else:
      # セッション値から年月取得
      year = request.session['find_year']
      month = request.session['find_month']


    # フォームの初期値定義
    shop_default = {'shop2' : request.session.get('find_shop', '')}
    schedule_default = {'year' : year, 
                        'month' : month}
    
    # フォーム定義
    shop_form = member_findForm(shop_default)
    schedule_form = schedule_timeForm(schedule_default)


    # 前回のショップ検索履歴がある場合の処理
    if request.session.get('find_shop', '') != '':
      # 検索履歴ショップの人員取得
      member_obj_filter = member.objects.filter(shop = request.session['find_shop'])\
                                        .order_by('employee_no')

    # 前回のショップ検索履歴がない場合の処理
    else:
      # ログイン者と同じショップの人員取得
      member_obj_filter = member.objects.filter(shop = data.shop).order_by('employee_no')


    # 空のリスト定義
    No_list = []
    name_list = []
    ok_list = []
    week_list = []

    # 取得した人員情報の従業員番号をリスト化するループ
    for i in member_obj_filter:
      # 従業員番号をリストに追加
      No_list.append(i.employee_no)
      # 名前をリストに追加
      name_list.append(i.name)


    # 次の月の最初の日を定義
    if int(month) == 12:
      next_month = datetime.date(int(year) + 1, 1, 1)

    else:
      next_month = datetime.date(int(year), int(month) + 1, 1)

    # 次の月の最初の日から1を引くことで、指定した月の最後の日を取得
    last_day_of_month = next_month - datetime.timedelta(days = 1)


    # 指定ショップの人員毎に工数入力可否をリストにするループ
    for name in name_list:
      # 仮リストを空で定義
      provisional_list = []
      # 仮リストに人員名を入れる
      provisional_list.append(name)

      # 人員情報取得
      member_obj_get = member.objects.get(name = name)


      # 取得した人員の工数入力可否をリスト化するループ
      for day in range(1, last_day_of_month.day + 1):

        # 指定日に工数データがあるか確認
        obj_filter = Business_Time_graph.objects.filter(employee_no3 = member_obj_get.employee_no, \
                                                        work_day2 = datetime.date(int(year), int(month), day))
        
        # 工数データがある場合の処理
        if obj_filter.count() != 0:
          # 工数データ取得
          obj_get = Business_Time_graph.objects.get(employee_no3 = member_obj_get.employee_no, \
                                                    work_day2 = datetime.date(int(year), int(month), day))
          # 工数入力可否を仮リストに入れる
          provisional_list.append(obj_get)

        # 工数データがない場合の処理
        else:
          # 仮リストに工数入力可否をFalseで入れる
          provisional_list.append(None)

      # 仮リストを工数入力可否リストに入れる
      ok_list.append(provisional_list)


    # 曜日リスト作成するループ
    for d in range(1, last_day_of_month.day + 1):

      # 曜日を取得する日を作成
      week_day = datetime.date(int(year), int(month), d)

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



  # HTMLに渡す辞書
  context = {
    'title' : '工数入力可否(ショップ単位)',
    'shop_form': shop_form,
    'schedule_form': schedule_form,
    'day_list' : zip(range(1, last_day_of_month.day + 1), week_list), 
    'ok_list' : ok_list,
    'week_list' : week_list,
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/class_list.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数詳細確認画面定義
def class_detail(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 人員名取得
  name_obj_get = member.objects.get(employee_no = obj_get.employee_no3)

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
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' \
            or name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 143)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 145)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 179)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 109)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 41)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 247)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
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



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'obj_get' : obj_get,
    'time_display_list' : time_display_list,
    'name' : name_obj_get.name,
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/class_detail.html', context)





#--------------------------------------------------------------------------------------------------------
