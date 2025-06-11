from django.shortcuts import redirect
from django.core.paginator import Paginator
from django.contrib import messages
from django.views.generic import ListView
from django.views.generic.edit import UpdateView, CreateView, DeleteView
from django.urls import reverse_lazy
from django.http import HttpResponseRedirect
from ..models import member, Business_Time_graph, administrator_data, inquiry_data
from ..forms import memberForm, member_findForm
from ..utils.kosu_utils import get_member
from ..utils.main_utils import history_record





#--------------------------------------------------------------------------------------------------------





# 人員情報一覧表示画面定義
class MemberPageView(ListView):
  # テンプレート,オブジェクト名定義
  template_name = 'kosu/member.html'
  context_object_name = 'data'


  # 画面処理前の初期設定
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.data = member_obj
    
    # 権限がないユーザーの場合ログイン画面へ
    if not self.data.authority:
      return redirect('/')

    # 設定情報取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      self.page_num = administrator_data(menu_row=20).menu_row
    else:
      self.page_num = last_record.menu_row

    self.menu_row = self.page_num
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


  # コンテキストデータを取得するメソッドをオーバーライド
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
class MemberNewView(CreateView):
  # テンプレート、フォーム定義
  template_name = 'kosu/member_edit.html'
  form_class = memberForm


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.data = member_obj

    # 権限がないユーザーの場合ログイン画面へ
    if not self.data.authority:
      return redirect(to='/')

    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # フォームの初期値を設定するメソッド
  def get_initial(self):
    initial_values = {
      'break_time1': '#00000000',
      'break_time1_over1': '#00000000',
      'break_time1_over2': '#00000000',
      'break_time1_over3': '#00000000',
      'break_time2': '#00000000',
      'break_time2_over1': '#00000000',
      'break_time2_over2': '#00000000',
      'break_time2_over3': '#00000000',
      'break_time3': '#00000000',
      'break_time3_over1': '#00000000',
      'break_time3_over2': '#00000000',
      'break_time3_over3': '#00000000',
      'break_time4': '#00000000',
      'break_time4_over1': '#00000000',
      'break_time4_over2': '#00000000',
      'break_time4_over3': '#00000000',
      'break_time5': '#00000000',
      'break_time5_over1': '#00000000',
      'break_time5_over2': '#00000000',
      'break_time5_over3': '#00000000',
      'break_time6': '#00000000',
      'break_time6_over1': '#00000000',
      'break_time6_over2': '#00000000',
      'break_time6_over3': '#00000000',
    }
    return initial_values


  # フォームバリデーションが成功した際の処理
  def form_valid(self, form):
    request = self.request
    # 入力内容記録
    edit_comment = f"従業員番号:{request.POST['employee_no']}" + '\n' + \
                  f"氏名:{request.POST['name']}" + '\n' + \
                  f"ショップ:{request.POST['shop']}" + '\n' + \
                  f"権限:{'authority' in request.POST}" + '\n' + \
                  f"管理者権限:{'administrator' in request.POST}"

    # POSTした従業員番号が既に登録されている場合エラー出力
    if member.objects.filter(employee_no=request.POST['employee_no']).exists():
      history_record('人員登録', 'member', 'ERROR041', edit_comment, request)
      messages.error(request, '入力した従業員番号はすでに登録があるので登録できません。ERROR041')
      return redirect(to='/new')

    # POSTしたショップがボデーか組立の場合の処理
    if request.POST['shop'] in ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)']:
      # 休憩時間用文字列定義
      break_times = ['#11401240', '#17201735', '#23350035', '#04350450',
                    '#14101510', '#22002215', '#04150515', '#09150930',
                    '#23500050', '#06400655', '#12551355', '#17551810',
                    '#12001300', '#19001915', '#01150215', '#06150630',
                    '#10401130', '#15101520', '#20202110', '#01400150',
                    '#21202210', '#01500200', '#07000750', '#12201230']
    else:
      # 休憩時間用文字列定義
      break_times = ['#10401130', '#15101520', '#20202110', '#01400150',
                    '#17501840', '#22302240', '#03400430', '#09000910',
                    '#01400230', '#07050715', '#12151305', '#17351745',
                    '#12001300', '#19001915', '#01150215', '#06150630',
                    '#10401130', '#15101520', '#20202110', '#01400150',
                    '#21202210', '#01500200', '#07000750', '#12201230']
    # 休憩時間設定
    new_member = form.save(commit=False)
    new_member.break_time1 = break_times[0]
    new_member.break_time1_over1 = break_times[1]
    new_member.break_time1_over2 = break_times[2]
    new_member.break_time1_over3 = break_times[3]
    new_member.break_time2 = break_times[4]
    new_member.break_time2_over1 = break_times[5]
    new_member.break_time2_over2 = break_times[6]
    new_member.break_time2_over3 = break_times[7]
    new_member.break_time3 = break_times[8]
    new_member.break_time3_over1 = break_times[9]
    new_member.break_time3_over2 = break_times[10]
    new_member.break_time3_over3 = break_times[11]
    new_member.break_time4 = break_times[12]
    new_member.break_time4_over1 = break_times[13]
    new_member.break_time4_over2 = break_times[14]
    new_member.break_time4_over3 = break_times[15]
    new_member.break_time5 = break_times[16]
    new_member.break_time5_over1 = break_times[17]
    new_member.break_time5_over2 = break_times[18]
    new_member.break_time5_over3 = break_times[19]
    new_member.break_time6 = break_times[20]
    new_member.break_time6_over1 = break_times[21]
    new_member.break_time6_over2 = break_times[22]
    new_member.break_time6_over3 = break_times[23]
    new_member.save()

    # 操作履歴記録
    history_record('人員登録', 'member', 'OK', edit_comment, request)
    # 人員一覧ページへ
    return redirect(to='/member/1')


  # フォームバリデーションが失敗した際の処理
  def form_invalid(self, form):
    request = self.request
    messages.error(request, f'バリテーションエラーが発生しました。IT担当者に連絡してください。{form.errors} ERROR053')
    return redirect(to='/new')


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
      'title': '人員登録',
      'data': self.data,
      'form_link': reverse_lazy('member_new')
    })
    return context





#--------------------------------------------------------------------------------------------------------





# 人員編集画面定義
class MemberEditView(UpdateView):
  # モデル、フォーム、テンプレート、データなどを指定
  model = member
  form_class = memberForm
  template_name = 'kosu/member_edit.html'
  context_object_name = 'data'
  pk_url_kwarg = 'num'


  # 人員データ取得
  def get_object(self, queryset=None):
    return member.objects.get(employee_no=self.kwargs['num'])


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.login_user = member_obj

    # 権限がないユーザーの場合ログイン画面へ
    if not self.login_user.authority:
      return redirect(to='/')

    # 人員データ取得
    self.object = self.get_object()
    # 編集前従業員番号記憶
    request.session['edit_No'] = self.object.employee_no

    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '人員編集'
    context['data'] = self.login_user
    context['form_link'] = reverse_lazy('member_edit', args=[self.object.employee_no])
    return context


  # フォームが有効な場合に呼ばれるメソッドをオーバーライド 
  def form_valid(self, form):
    # 入力内容記録
    edit_comment = f"従業員番号:{self.request.POST['employee_no']}" + '\n' + \
                  f"氏名:{self.request.POST['name']}" + '\n' + \
                  f"ショップ:{self.request.POST['shop']}" + '\n' + \
                  f"権限:{'authority' in self.request.POST}" + '\n' + \
                  f"管理者権限:{'administrator' in self.request.POST}"

    # 編集前の従業員番号を取得
    original_employee_no = self.request.session['edit_No']
    # フォームから新しい従業員番号を取得
    new_employee_no = form.cleaned_data['employee_no']
    # フォームからショップの値を取得
    shop = form.cleaned_data['shop']

    # 編集後の従業員番号が既存データと被った場合、エラー出力しリダイレクト
    if int(original_employee_no) != int(new_employee_no) and member.objects.filter(employee_no=new_employee_no).exists():
      history_record('人員編集', 'member', 'ERROR042', edit_comment, self.request)
      messages.error(self.request, '入力した従業員番号はすでに登録があるので登録できません。ERROR042')
      return redirect(to=f'/member_edit/{self.kwargs["num"]}')

    # ログイン中の人員データを変更しようとした場合、エラー出力しリダイレクト
    if int(self.request.session['login_No']) == int(self.kwargs["num"]):
      history_record('人員編集', 'member', 'ERROR086', edit_comment, self.request)
      messages.error(self.request, 'ログイン中の人員データは変更できません。ERROR086')
      return redirect(to=f'/member_edit/{self.kwargs["num"]}')
    
    # デフォルトの休憩時間リスト指定
    if shop in ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)']:
      break_times = ['#11401240', '#17201735', '#23350035', '#04350450',
                    '#14101510', '#22002215', '#04150515', '#09150930',
                    '#23500050', '#06400655', '#12551355', '#17551810',
                    '#12001300', '#19001915', '#01150215', '#06150630',
                    '#10401130', '#15101520', '#20202110', '#01400150',
                    '#21202210', '#01500200', '#07000750', '#12201230']
    
    else:
      break_times = ['#10401130', '#15101520', '#20202110', '#01400150',
                    '#17501840', '#22302240', '#03400430', '#09000910',
                    '#01400230', '#07050715', '#12151305', '#17351745',
                    '#12001300', '#19001915', '#01150215', '#06150630',
                    '#10401130', '#15101520', '#20202110', '#01400150',
                    '#21202210', '#01500200', '#07000750', '#12201230']

    # フォームのインスタンスに休憩時間を設定
    form.instance.break_time1 = break_times[0]
    form.instance.break_time1_over1 = break_times[1]
    form.instance.break_time1_over2 = break_times[2]
    form.instance.break_time1_over3 = break_times[3]
    form.instance.break_time2 = break_times[4]
    form.instance.break_time2_over1 = break_times[5]
    form.instance.break_time2_over2 = break_times[6]
    form.instance.break_time2_over3 = break_times[7]
    form.instance.break_time3 = break_times[8]
    form.instance.break_time3_over1 = break_times[9]
    form.instance.break_time3_over2 = break_times[10]
    form.instance.break_time3_over3 = break_times[11]
    form.instance.break_time4 = break_times[12]
    form.instance.break_time4_over1 = break_times[13]
    form.instance.break_time4_over2 = break_times[14]
    form.instance.break_time4_over3 = break_times[15]
    form.instance.break_time5 = break_times[16]
    form.instance.break_time5_over1 = break_times[17]
    form.instance.break_time5_over2 = break_times[18]
    form.instance.break_time5_over3 = break_times[19]
    form.instance.break_time6 = break_times[20]
    form.instance.break_time6_over1 = break_times[21]
    form.instance.break_time6_over2 = break_times[22]
    form.instance.break_time6_over3 = break_times[23]

    # 親クラスの `form_valid` メソッドを実行し、そのレスポンスを保存
    response = super().form_valid(form)

    # 従業員番号が変更された場合、古いデータを消す
    if int(original_employee_no) != int(new_employee_no):
      member.objects.filter(employee_no=original_employee_no).delete()
      # 従業員番号変更に伴うデータ更新
      kosu_obj = Business_Time_graph.objects.filter(employee_no3=original_employee_no)
      inquiry_obj = inquiry_data.objects.filter(employee_no2=original_employee_no)
      kosu_obj.update(employee_no3=new_employee_no, name=form.instance)
      inquiry_obj.update(employee_no2=new_employee_no, name=form.instance)

    # 操作履歴記録
    history_record('人員編集', 'member', 'OK', edit_comment, self.request)
    return response
  

  # 更新が成功した後のリダイレクトURLを指定
  def get_success_url(self):
    return '/member/1'





#--------------------------------------------------------------------------------------------------------





# 人員削除画面定義
class MemberDeleteView(DeleteView):
  # モデル,テンプレート,リダイレクト先などを指定
  model = member
  template_name = 'kosu/member_delete.html'
  success_url = reverse_lazy('member', args=[1])


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.data = member_obj

    # ログイン者に権限がなければメインページにリダイレクト
    if not self.data.authority:
      return redirect(to='/')
    
    # 削除する人員の名前取得
    self.request.session['delete_name'] = self.get_object().name
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)

  
  # 人員データ取得
  def get_object(self, queryset=None):
    return member.objects.get(employee_no=self.kwargs['num'])


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
        'title': '人員削除',
        'employee_no': self.kwargs['num'],
        'obj': self.get_object(),
    })
    return context


  # フォームが有効な場合に呼ばれるメソッドをオーバーライド 
  def form_valid(self, form):
    response = super().form_valid(form)
    # 入力内容記録
    edit_comment = f"従業員番号:{self.kwargs['num']}" + '\n' + \
                  f"氏名:{self.request.session['delete_name']}"
    # 操作履歴記録
    history_record('人員削除', 'member', 'OK', edit_comment, self.request)
    return response





#--------------------------------------------------------------------------------------------------------





from rest_framework import viewsets
from ..models import member
from .serializers import MemberSerializer
from django.shortcuts import render

def react_view(request):
  return render(request, 'index.html')  # Reactのindex.htmlを表示


class MemberViewSet(viewsets.ModelViewSet):
  queryset = member.objects.all()
  serializer_class = MemberSerializer



