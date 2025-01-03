from django.shortcuts import redirect, render
from django.core.paginator import Paginator
from django.contrib import messages
from django.views.generic import ListView
from django.views import View
from ..models import member, Business_Time_graph, administrator_data, inquiry_data
from ..forms import memberForm, member_findForm





#--------------------------------------------------------------------------------------------------------





# 人員情報一覧表示画面定義
class MemberPageView(ListView):
  # テンプレート定義
  template_name = 'kosu/member.html'
  # オブジェクト名定義
  context_object_name = 'data'


  # 画面処理前の初期設定
  def dispatch(self, request, *args, **kwargs):
    # ログインしていない場合ログイン画面へ
    if not request.session.get('login_No'):
      return redirect('/login')

    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      self.data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      request.session.clear()
      return redirect('/login')
    
    # 権限がないユーザーの場合ログイン画面へ
    if not self.data.authority:
      return redirect('/')

    # 設定情報取得
    self.page_num = administrator_data.objects.order_by("id").last()
    self.menu_row = self.page_num.menu_row  # menu_row 属性にアクセス
    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # フォーム初期値を定義
  def get_form(self, request):
    return member_findForm({
        'shop2': request.session.get('find_shop', ''), 
        'employee_no6': request.session.get('find_employee_no', '')
    })


  # フィルタリングされたデータ取得
  def get_queryset(self, shop, employee_no):
    return member.objects.filter(shop__contains=shop, employee_no__contains=employee_no).order_by('employee_no')


  # HTMLに送る辞書定義
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
        'title': '人員一覧',
        'form': self.form,
        'num': self.kwargs.get('num'),
    })
    return context


  # GET時の処理
  def get(self, request, *args, **kwargs):
    # フォーム定義
    self.form = self.get_form(request)
    # ショップ検索履歴取得
    shop = request.session.get('find_shop', '')
    # 従業員番号検索履歴取得
    employee_no = request.session.get('find_employee_no', '')
    # ショップと従業員番号でフィルタリングしページネーション適応
    paginator = Paginator(self.get_queryset(shop, employee_no), self.menu_row)
    # 指定ページのデータ送信
    self.object_list = paginator.get_page(kwargs.get('num'))
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    return self.render_to_response(context)


  # POST時の処理
  def post(self, request, *args, **kwargs):
    # フォーム定義
    self.form = member_findForm(request.POST)
    request.session.update({'find_shop': request.POST['shop2'], 'find_employee_no': request.POST['employee_no6']})
    # ショップと従業員番号をPOSTした値に更新
    paginator = Paginator(self.get_queryset(request.POST['shop2'], request.POST['employee_no6']), self.menu_row)
    # ショップと従業員番号でフィルタリングしページネーション適応
    self.object_list = paginator.get_page(kwargs.get('num'))
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 人員登録画面定義
class MemberNewView(View):
  # テンプレート定義
  template_name = 'kosu/member_new.html'


  # 画面処理前の初期設定
  def dispatch(self, request, *args, **kwargs):
    # ログインしていない場合ログイン画面へ
    if not request.session.get('login_No'):
      return redirect('/login')

    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      self.data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      request.session.clear()
      return redirect(to='/login')
    
    # 権限がないユーザーの場合ログイン画面へ
    if not self.data.authority:
      return redirect(to='/')
    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # GET時の処理
  def get(self, request):
    # HTMLに送る値定義
    context = {
        'title': '人員登録',
        'data': self.data,
        'form': memberForm(),
    }
    return render(request, self.template_name, context)


  # POST時の処理
  def post(self, request):
    # POSTした従業員番号が既に登録されている場合エラー出力
    if member.objects.filter(employee_no=request.POST['employee_no']).exists():
      messages.error(request, '入力した従業員番号はすでに登録があるので登録できません。ERROR020')
      return redirect(to='/new')

    # POSTしたショップがボデーか組立の場合の処理
    if request.POST['shop'] in ['W1', 'W2', 'A1', 'A2', '組長以上(W,A)']:
      # 休憩時間用文字列定義
      break_times = ['#11401240', '#17201735', '#23350035', '#04350450',
                      '#14101510', '#22002215', '#04150515', '#09150930',
                      '#23500050', '#06400655', '#12551355', '#17551810',
                      '#12001300', '#19001915', '#01150215', '#06150630']
    # POSTしたショップがボデーと組立以外の場合の処理
    else:
      # 休憩時間用文字列定義
      break_times = ['#10401130', '#15101520', '#20202110', '#01400150',
                      '#17501840', '#22302240', '#03400430', '#09000910',
                      '#01400230', '#07050715', '#12151305', '#17351745',
                      '#12001300', '#19001915', '#01150215', '#06150630']

    # 人員データのレコード作成
    new_member = member(
        employee_no=request.POST['employee_no'], name=request.POST['name'], shop=request.POST['shop'],
        authority='authority' in request.POST, administrator='administrator' in request.POST,
        break_time1=break_times[0], break_time1_over1=break_times[1], break_time1_over2=break_times[2],
        break_time1_over3=break_times[3], break_time2=break_times[4], break_time2_over1=break_times[5],
        break_time2_over2=break_times[6], break_time2_over3=break_times[7], break_time3=break_times[8],
        break_time3_over1=break_times[9], break_time3_over2=break_times[10], break_time3_over3=break_times[11],
        break_time4=break_times[12], break_time4_over1=break_times[13], break_time4_over2=break_times[14],
        break_time4_over3=break_times[15]
    )
    # レコードセーブ
    new_member.save()
    # 人員一覧をリダイレクト
    return redirect(to='/member/1')





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
