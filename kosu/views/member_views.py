from django.shortcuts import render
from django.shortcuts import redirect
from django.core.paginator import Paginator
from django.contrib import messages
from ..models import member, Business_Time_graph, administrator_data, inquiry_data
from ..forms import memberForm
from ..forms import member_findForm





#--------------------------------------------------------------------------------------------------------





# 人員一覧画面定義
def member_page(request, num): 

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


  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()



  # POST時の処理
  if (request.method == 'POST'):

    # POST送信時のフォームの状態(POSTした値は入ったまま)
    form = member_findForm(request.POST)

    # POSTした値を変数に入れる
    find = request.POST['shop2']
    find2 = request.POST['employee_no6']
    request.session['find_shop'] = find
    request.session['find_employee_no'] = find2

    # 就業日とログイン者の従業員番号でフィルターをかけて一致したものを変数に入れる
    data2 = member.objects.filter(shop__contains = find, \
            employee_no__contains = find2).order_by('employee_no')
    page = Paginator(data2, page_num.menu_row)


  else:

    # フォームの初期値設定
    form_default = {'shop2' : request.session.get('find_shop', ''), \
                    'employee_no6' : request.session.get('find_employee_no', '')}
  
    # POST送信していない時のフォームの状態(空のフォーム)
    form = member_findForm(form_default)

    # 人員の一覧のオブジェクトを変数に入れる
    data2 = member.objects.filter(shop__contains = request.session.get('find_shop', ''), \
            employee_no__contains = request.session.get('find_employee_no', '')).order_by('employee_no')
    page = Paginator(data2, page_num.menu_row)



  # HTMLに渡す辞書
  context = {
    'title' : '人員一覧',
    'form' : form,
    'data': page.get_page(num),
    'num' : num
  }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/member.html', context)





#--------------------------------------------------------------------------------------------------------





# 人員登録画面定義
def member_new(request):

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



  # POST時の処理
  if (request.method == 'POST'):

    # POST送信された値を変数に入れる
    employee_no = request.POST['employee_no']
    # POST送信された値でフィルターをかけ一致したオブジェクトを取得
    data2 = member.objects.filter(employee_no = employee_no)


    # POST送信された従業員番号が既に登録されている場合の処理
    if data2.count() >= 1:
      # エラーメッセージ出力
      messages.error(request, '入力した従業員番号はすでに登録があるので登録できません。ERROR020')
      # このページをリダイレクト
      return redirect(to = '/new')


    # 登録ショップが三組三交替Ⅱ甲乙丙番Cの場合の休憩初期値登録
    if request.POST['shop'] == 'W1' or request.POST['shop'] == 'W2' \
      or request.POST['shop'] == 'A1' or request.POST['shop'] == 'A2':
      
      # 1直休憩時間初期値定義
      break1_1 = '#11401240'
      break1_2 = '#17201735'
      break1_3 = '#23350035'
      break1_4 = '#04350450'

      # 2直休憩時間初期値定義
      break2_1 = '#14101510'
      break2_2 = '#22002215'
      break2_3 = '#04150515'
      break2_4 = '#09150930'

      # 3直休憩時間初期値定義
      break3_1 = '#23500050'
      break3_2 = '#06400655'
      break3_3 = '#12551355'
      break3_4 = '#17551810'

      # 常昼休憩時間初期値定義
      break4_1 = '#12001300'
      break4_2 = '#19001915'
      break4_3 = '#01150215'
      break4_4 = '#06150630'

    # 登録ショップが三組三交替Ⅱ甲乙丙番Bか常昼の場合の休憩初期値登録
    else:

      # 1直休憩時間初期値定義
      break1_1 = '#10401130'
      break1_2 = '#15101520'
      break1_3 = '#20202110'
      break1_4 = '#01400150'

      # 2直休憩時間初期値定義
      break2_1 = '#17501840'
      break2_2 = '#22302240'
      break2_3 = '#03400430'
      break2_4 = '#09000910'

      # 3直休憩時間初期値定義
      break3_1 = '#01400230'
      break3_2 = '#07050715'
      break3_3 = '#12151305'
      break3_4 = '#17351745'

      # 常昼休憩時間初期値定義
      break4_1 = '#12001300'
      break4_2 = '#19001915'
      break4_3 = '#01150215'
      break4_4 = '#06150630'


    # POSTされた値をメンバーデータに入れる   
    new = member(employee_no = request.POST['employee_no'], name = request.POST['name'], \
                 shop = request.POST['shop'], authority =  'authority' in request.POST, \
                 administrator = 'administrator' in request.POST, break_time1 = break1_1, \
                 break_time1_over1 = break1_2, break_time1_over2 = break1_3, \
                 break_time1_over3 = break1_4, break_time2 = break2_1, \
                 break_time2_over1 = break2_2, break_time2_over2 = break2_3, \
                 break_time2_over3 = break2_4, break_time3 = break3_1, \
                 break_time3_over1 = break3_2, break_time3_over2 = break3_3, \
                 break_time3_over3 = break3_4, break_time4 = break4_1, \
                 break_time4_over1 = break4_2, break_time4_over2 = break4_3, \
                 break_time4_over3 = break4_4)
    
    # 新しいレコードを作成しセーブする
    new.save()
    # 人員一覧画面をリダイレクトする
    return redirect(to = '/member/1')
  

  # HTMLに渡す辞書
  context = {
    'title': '人員登録',
    'data' : data,
    'form': memberForm(),
  }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/member_new.html', context)



#--------------------------------------------------------------------------------------------------------



# 人員編集画面定義
def member_edit(request, num):

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

  # 指定従業員番号のレコードのオブジェクトを変数に入れる
  obj = member.objects.get(employee_no = num)
  # GET時の処理
  if (request.method == 'GET'):
    # 編集前の従業員番号をセッションに記憶
    request.session['edit_No'] = num


  # POST時の処理
  if (request.method == 'POST'):

    # 人員登録データの内、従業員番号がPOST送信された値と等しいレコードのオブジェクトを取得
    data = member.objects.filter(employee_no = request.POST['employee_no'])


    # 編集した従業員番号の登録がすでにあるかチェック
    if int(request.session['edit_No']) != int(request.POST['employee_no']) \
      and data.count() >= 1:
      # エラーメッセージ出力
      messages.error(request, '入力した従業員番号はすでに登録があるので登録できません。ERROR021')
      # このページをリダイレクト
      return redirect(to = '/member_edit/{}'.format(num))


    # 登録ショップが三組三交替Ⅱ甲乙丙番Cの場合の休憩初期値登録
    if request.POST['shop'] == 'W1' or request.POST['shop'] == 'W2' \
      or request.POST['shop'] == 'A1' or request.POST['shop'] == 'A2':
      # 1直休憩時間初期値定義
      break1_1 = '#11401240'
      break1_2 = '#17201735'
      break1_3 = '#23350035'
      break1_4 = '#04350450'

      # 2直休憩時間初期値定義
      break2_1 = '#14101510'
      break2_2 = '#22002215'
      break2_3 = '#04150515'
      break2_4 = '#09150930'

      # 3直休憩時間初期値定義
      break3_1 = '#23500050'
      break3_2 = '#06400655'
      break3_3 = '#12551355'
      break3_4 = '#17551810'

      # 常昼休憩時間初期値定義
      break4_1 = '#12001300'
      break4_2 = '#19001915'
      break4_3 = '#01150215'
      break4_4 = '#06150630'

    # 登録ショップが三組三交替Ⅱ甲乙丙番Bか常昼の場合の休憩初期値登録
    else:
      # 1直休憩時間初期値定義
      break1_1 = '#10401130'
      break1_2 = '#15101520'
      break1_3 = '#20202110'
      break1_4 = '#01400150'

      # 2直休憩時間初期値定義
      break2_1 = '#17501840'
      break2_2 = '#22302240'
      break2_3 = '#03400430'
      break2_4 = '#09000910'

      # 3直休憩時間初期値定義
      break3_1 = '#01400230'
      break3_2 = '#07050715'
      break3_3 = '#12151305'
      break3_4 = '#17351745'

      # 常昼休憩時間初期値定義
      break4_1 = '#12001300'
      break4_2 = '#19001915'
      break4_3 = '#01150215'
      break4_4 = '#06150630'

    # 指定従業員番号のレコードにPOST送信された値を上書きする
    member.objects.update_or_create(employee_no = request.POST['employee_no'], \
                                    defaults = {'employee_no' : request.POST['employee_no'], \
                                                'name' : request.POST['name'], \
                                                'shop' : request.POST['shop'], \
                                                'authority' : 'authority' in request.POST, \
                                                'administrator' : 'administrator' in request.POST, \
                                                'break_time1' : break1_1, \
                                                'break_time1_over1' : break1_2, \
                                                'break_time1_over2' : break1_3, \
                                                'break_time1_over3' : break1_4, \
                                                'break_time2' : break2_1, \
                                                'break_time2_over1' : break2_2, \
                                                'break_time2_over2' : break2_3, \
                                                'break_time2_over3' : break2_4, \
                                                'break_time3' : break3_1, \
                                                'break_time3_over1' : break3_2, \
                                                'break_time3_over2' : break3_3, \
                                                'break_time3_over3' : break3_4, \
                                                'break_time4' : break4_1, \
                                                'break_time4_over1' : break4_2, \
                                                'break_time4_over2' : break4_3, \
                                                'break_time4_over3' : break4_4})


    # 従業員番号を変更した場合の処理
    if int(request.session['edit_No']) != int(request.POST['employee_no']):
      # 変更前の人員データ取得
      obj_get = member.objects.get(employee_no = request.session['edit_No'])
      # 取得した人員データ削除
      obj_get.delete()

      # 変更前の従業員での工数データ取得
      kosu_obj = Business_Time_graph.objects.filter(employee_no3 = request.session['edit_No'])
      # 変更前の従業員での問い合わせデータ取得
      inquiry_obj = inquiry_data.objects.filter(employee_no2 = request.session['edit_No'])
      # 変更後の従業員番号に該当するmemberインスタンスを取得
      member_instance = member.objects.get(employee_no = request.POST['employee_no'])
      # 工数データの従業員番号、名前更新
      kosu_obj.update(employee_no3 = request.POST['employee_no'], name = member_instance)
      # 問い合わせデータの従業員番号、名前更新
      inquiry_obj.update(employee_no2 = request.POST['employee_no'], name = member_instance)


    # 工数履歴画面をリダイレクトする
    return redirect(to = '/member/1')

  # HTMLに渡す辞書
  context = {
    'title' : '人員編集',
    'employee_no' : num,
    'data' : data,
    'form' : memberForm(instance = obj),
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/member_edit.html', context)



#--------------------------------------------------------------------------------------------------------



# 人員削除画面定義
def member_delete(request, num):
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

  # 指定従業員番号のレコードのオブジェクトを変数に入れる
  obj = member.objects.get(employee_no = num)


  # POST時の処理
  if (request.method == 'POST'):

    # 取得していた指定従業員番号のレコードを削除する
    obj.delete()

    # 工数履歴画面をリダイレクトする
    return redirect(to = '/member/1')

  # HTMLに渡す辞書
  context = {
    'title' : '人員削除',
    'employee_no' : num,
    'obj' : obj,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/member_delete.html', context)



#--------------------------------------------------------------------------------------------------------
