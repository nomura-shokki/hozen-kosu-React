from django.shortcuts import render, redirect
from django.core.paginator import Paginator
from django.contrib import messages
from django.urls import reverse_lazy
from django.http import HttpResponseRedirect
from django.views.generic import CreateView
from django.views.generic import ListView
from django.views.generic.edit import FormView, DeleteView, UpdateView
from ..utils.kosu_utils import get_member
from ..utils.kosu_utils import get_def_library_data
from ..models import member
from ..models import kosu_division
from ..models import administrator_data
from ..forms import inputdayForm
from ..forms import versionchoiceForm
from ..forms import kosu_divisionForm





#--------------------------------------------------------------------------------------------------------





# 工数区分定義確認画面定義
class KosuDefView(FormView):
  # テンプレート,フォーム定義
  template_name = 'kosu/kosu_def.html'
  form_class = inputdayForm


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フォーム初期値定義
  def get_initial(self):
    initial = super().get_initial()
    initial['kosu_def_list'] = ''
    return initial


  # フォーム初期状態
  def get_form(self, form_class=None):
    request = self.request
    form = super().get_form(form_class)
    def_list, n = get_def_library_data(request.session['input_def'])
    choices_list = [list(pair) for pair in zip(def_list, def_list)]
    form.fields['kosu_def_list'].choices = choices_list
    return form


  # フォームバリデーションが成功した際のメソッドをオーバーライド
  def form_valid(self, form):
    kosu_def_list = form.cleaned_data.get('kosu_def_list', None)
    
    # 検索欄が空欄の場合、リダイレクト
    if kosu_def_list in ["", None]:
      messages.error(self.request, '確認する定義区分が選択されていません。ERROR038')
      return redirect(to='/kosu_def')

    # 現在使用している工数区分を取得
    obj = kosu_division.objects.get(kosu_name=self.request.session['input_def'])

    # POST送信した工数区分の定義と作業内容を読み出し
    def1, def2 = '', ''
    for n in range(50):
      if eval(f'obj.kosu_title_{n + 1}') == kosu_def_list:
        def1 = eval(f'obj.kosu_division_1_{n + 1}')
        def2 = eval(f'obj.kosu_division_2_{n + 1}')
        break

    # HTMLに渡す辞書
    context = {
      'title': '工数区分定義確認',
      'form': form,
      'def1': def1,
      'def2': def2,
      }

    return self.render_to_response(context)


  # フォームが無効な場合の処理
  def form_invalid(self, form):
    # POST送信していないときの表示データは空にする
    def1, def2 = '', ''

    # HTMLに渡す辞書
    context = {
      'title': '工数区分定義確認',
      'form': form,
      'def1': def1,
      'def2': def2,
      }

    return self.render_to_response(context)


  # コンテキストデータをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
      'title': '工数区分定義確認',
      'def1': '',
      'def2': '',
      })
    return context





#--------------------------------------------------------------------------------------------------------





# 工数区分定義Ver選択画面定義
class KosuVer(FormView):
  # テンプレート,フォーム定義
  template_name = 'kosu/kosu_Ver.html'
  form_class = versionchoiceForm


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フォーム初期値定義
  def get_initial(self):
    initial = super().get_initial()
    versionchoice = self.request.session['input_def']
    initial['versionchoice'] = versionchoice
    return initial


  # フォーム初期状態
  def get_form(self, form_class=None):
    form = super().get_form(form_class)
    # 工数区分定義の選択リスト設定
    choice_obj = kosu_division.objects.all()
    choices_list = [(i.kosu_name, i.kosu_name) for i in choice_obj]
    form.fields['versionchoice'].choices = choices_list
    return form



  # フォームバリデーションが成功した際のメソッドをオーバーライド
  def form_valid(self, form):
    # POST送信された工数区分定義のVerをセッションに上書きする
    self.request.session['input_def'] = form.cleaned_data['versionchoice']
    return self.render_to_response(self.get_context_data())


  # コンテキストデータをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    # Ver表示用オブジェクト取得
    mes_obj = kosu_division.objects.get(kosu_name=self.request.session['input_def'])
    context.update({
        'title': '工数区分定義切り替え',
        'message': mes_obj.kosu_name,
    })
    return context





#--------------------------------------------------------------------------------------------------------





# 工数区分定義Ver一覧画面定義
class DefListView(ListView):
  # モデル,HTML,オブジェクト名定義
  model = kosu_division
  template_name = 'kosu/def_list.html'
  context_object_name = 'obj'


  # クエリセットを取得して並び替え
  def get_queryset(self):
    queryset = kosu_division.objects.all().order_by('kosu_name').reverse()
    return queryset


  # コンテキストデータを取得して設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '工数区分定義一覧'
    context['num'] = self.kwargs.get('num')
    return context


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
    
    # 管理者でなければメニュー画面にリダイレクト
    if not  member_obj.administrator:
      return redirect('/')

    # ページネーション設定データの取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      page_num = administrator_data(menu_row=20).menu_row
    else:
      page_num = last_record.menu_row

    # 工数区分表示用のオブジェクト取得
    obj = kosu_division.objects.all().order_by('kosu_name').reverse()
    page = Paginator(obj, page_num)
    context = {
      'title': '工数区分定義一覧',
      'obj': page.get_page(kwargs.get('num')),
      'num': kwargs.get('num'),
      }

    # HTMLテンプレートにコンテキストを渡してレンダリング
    return render(request, 'kosu/def_list.html', context)






#--------------------------------------------------------------------------------------------------------





# 工数区分定義編集画面定義
class DefEditView(UpdateView):
  # モデル,フォーム,HTML,オブジェクト名定義
  model = kosu_division
  form_class = kosu_divisionForm
  template_name = 'kosu/def_edit.html'
  pk_url_kwarg = 'pk'
  context_object_name = 'form'

  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
    
    # 管理者でなければメニュー画面にリダイレクト
    if not  member_obj.administrator:
      return redirect('/')
    return super().dispatch(request, *args, **kwargs)


  # 初期値定義
  def get_initial(self):
    # 編集前の工数区分定義VerのIDをセッションに記憶
    pk = self.kwargs.get(self.pk_url_kwarg)
    def_obj = kosu_division.objects.get(id=pk)
    self.request.session['edit_def'] = def_obj.kosu_name
    return super().get_initial()


  # フォームバリデーションが成功した際のメソッドをオーバーライド
  def form_valid(self, form):
    # POST送信された名前が既に存在していたらリダイレクト
    edit_def = self.request.session.get('edit_def', None)
    kosu_name = form.cleaned_data['kosu_name']
    if edit_def != kosu_name and kosu_division.objects.filter(kosu_name=kosu_name).exists():
      messages.error(self.request, '入力した工数区分定義名はすでに登録があるので登録できません。ERROR039')
      return redirect(to=f'/def_edit/{self.kwargs.get(self.pk_url_kwarg)}')

    # レコード更新
    pk = self.kwargs.get(self.pk_url_kwarg)
    defaults = {'kosu_name': kosu_name}
    for i in range(1, 51):
      defaults[f'kosu_title_{i}'] = self.request.POST.get(f'kosu_title_{i}')
      defaults[f'kosu_division_1_{i}'] = self.request.POST.get(f'kosu_division_1_{i}')
      defaults[f'kosu_division_2_{i}'] = self.request.POST.get(f'kosu_division_2_{i}')
    kosu_division.objects.update_or_create(id=pk, defaults=defaults)

    return redirect(to='/def_list/1')


  # フォームバリデーションが失敗した際の処理
  def form_invalid(self, form):
    pk = self.kwargs.get(self.pk_url_kwarg)
    request = self.request
    messages.error(request, f'バリテーションエラーが発生しました。IT担当者に連絡してください。{form.errors} ERROR085')
    return redirect(to=f'/def_edit/{pk}')


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '工数区分定義編集'
    context['id'] = self.kwargs.get(self.pk_url_kwarg)
    return context





#--------------------------------------------------------------------------------------------------------





# 工数区分定義削除画面定義
class KosuDivisionDeleteView(DeleteView):
  # モデル,テンプレート,リダイレクト先定義
  model = kosu_division
  template_name = 'kosu/def_delete.html'
  success_url = reverse_lazy('def_list', kwargs={'num': 1})


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # ログイン者に権限がなければメインページに戻る
    if member_obj.administrator != True:
      return redirect('/')
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    # HTMLtable用リスト作成
    obj = self.get_object()
    delete_data = [['工数区分定義Ver', obj.kosu_name]]
    for i in range(1, 51):
      field_name1 = f'kosu_title_{i}'
      field_name2 = f'kosu_division_1_{i}'
      field_name3 = f'kosu_division_2_{i}'
      value1 = getattr(obj, field_name1, '')
      value2 = getattr(obj, field_name2, '')
      value3 = getattr(obj, field_name3, '')
      delete_data.append([f'工数区分名{i}', value1])
      delete_data.append([f'定義{i}', value2])
      delete_data.append([f'作業内容{i}', value3])
      delete_data.append(['', ''])

    context = super().get_context_data(**kwargs)        
    context.update({
      'title': '工数区分定義削除',
      'id': self.kwargs['pk'],
      'delete_data': delete_data,
      })
    return context





#--------------------------------------------------------------------------------------------------------





# 工数区分定義登録画面定義
class DefNewView(CreateView):
  # モデル,フォーム,テンプレート,飛び先定義
  model = kosu_division
  form_class = kosu_divisionForm
  template_name = 'kosu/def_new.html'
  success_url = reverse_lazy('def_new')


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 未ログインならログインページに飛ぶ
    if request.session.get('login_No', None) is None:
      return redirect('/login')

    try:
      # ログイン者の情報取得
      self.data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      # ログイン者情報取得できない場合ログイン画面へ
      request.session.clear()
      return redirect('/login')

    # ログイン者が管理者でなければメニュー画面に飛ぶ
    if not self.data.administrator:
      return redirect('/')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フォームバリデーションが成功した際のメソッドをオーバーライド
  def form_valid(self, form):
    # 工数定義区分バージョン取得
    kosu_name = form.cleaned_data.get('kosu_name')

    # POSTされた工数区分定義名を使用していればエラーメッセージを出す
    if kosu_division.objects.filter(kosu_name=kosu_name).exists():
      messages.error(self.request, '登録しようとした工数区分定義名は既に使用しています。登録できません。ERROR040')
      return redirect(self.success_url)

    # 新しいレコードを作成しセーブする
    return super().form_valid(form)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '工数区分定義新規登録'
    return context





#--------------------------------------------------------------------------------------------------------

