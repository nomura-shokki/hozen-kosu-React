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
    # 指定したHTMLに辞書を渡して表示を完成させる
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
class MemberEditView(View):
  # GET時の処理
  def get(self, request, num):
    # 未ログインならログインページに飛ぶ
    if request.session.get('login_No', None) is None:
      return redirect(to='/login')

    try:
      # ログイン者の情報取得
      data = member.objects.get(employee_no=request.session['login_No'])

    # セッション値から人員情報取得できない場合の処理
    except member.DoesNotExist:
      # セッション削除
      request.session.clear()
      # ログインページに戻る
      return redirect(to='/login')

    # ログイン者に権限がなければメインページに戻る
    if data.authority == False:
      return redirect(to='/')

    # 編集前の従業員番号をセッションに記憶
    obj = member.objects.get(employee_no=num)
    request.session['edit_No'] = num


    # HTMLに渡す辞書
    context = {
        'title': '人員編集',
        'employee_no': num,
        'data': data,
        'form': memberForm(instance=obj),
    }
    # 指定したHTMLに辞書を渡して表示を完成させる
    return render(request, 'kosu/member_edit.html', context)


  # POST時の処理
  def post(self, request, num):
    # 人員登録データの内、従業員番号がPOST送信された値と等しいレコードのオブジェクトを取得
    data = member.objects.filter(employee_no=request.POST['employee_no'])
    
    # 編集した従業員番号の登録がすでにあるかチェック
    if int(request.session['edit_No']) != int(request.POST['employee_no']) and data.count() >= 1:
      messages.error(request, '入力した従業員番号はすでに登録があるので登録できません。ERROR021')
      return redirect(to=f'/member_edit/{num}')

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

    # 指定従業員番号のレコードにPOST送信された値を上書きする
    member.objects.update_or_create(employee_no=request.POST['employee_no'],
                                    defaults={'employee_no': request.POST['employee_no'],
                                              'name': request.POST['name'],
                                              'shop': request.POST['shop'],
                                              'authority': 'authority' in request.POST,
                                              'administrator': 'administrator' in request.POST,
                                              'break_time1': break_times[0], 'break_time1_over1': break_times[1],
                                              'break_time1_over2': break_times[2], 'break_time1_over3': break_times[3],
                                              'break_time2': break_times[4], 'break_time2_over1': break_times[5],
                                              'break_time2_over2': break_times[6], 'break_time2_over3': break_times[7],
                                              'break_time3': break_times[8], 'break_time3_over1': break_times[9],
                                              'break_time3_over2': break_times[10], 'break_time3_over3': break_times[11],
                                              'break_time4': break_times[12], 'break_time4_over1': break_times[13],
                                              'break_time4_over2': break_times[14], 'break_time4_over3': break_times[15]})

    # 従業員番号を変更した場合の処理
    if int(request.session['edit_No']) != int(request.POST['employee_no']):
      # 元の人員データ削除
      obj_get = member.objects.get(employee_no=request.session['edit_No'])
      obj_get.delete()

      # 人員名、問い合わせデータ更新
      kosu_obj = Business_Time_graph.objects.filter(employee_no3=request.session['edit_No'])
      inquiry_obj = inquiry_data.objects.filter(employee_no2=request.session['edit_No'])
      member_instance = member.objects.get(employee_no=request.POST['employee_no'])
      kosu_obj.update(employee_no3=request.POST['employee_no'], name=member_instance)
      inquiry_obj.update(employee_no2=request.POST['employee_no'], name=member_instance)

    # 人員一覧ページへ
    return redirect(to='/member/1')






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
