from django.shortcuts import render, redirect
from django.http import HttpResponseRedirect
from django.core.paginator import Paginator
from django.contrib import messages
from django.views import View
from django.views.generic.edit import CreateView
from django.views.generic.list import ListView
from django.views.generic.base import TemplateView
from ..models import member
from ..models import administrator_data
from ..models import inquiry_data
from ..forms import inquiryForm
from ..forms import inquiry_findForm
from ..utils.kosu_utils import get_member
from ..utils.main_utils import history_record





#--------------------------------------------------------------------------------------------------------





# 問い合わせ入力画面定義
class InquiryNewView(CreateView):
  template_name = 'kosu/inquiry_new.html'
  form_class = inquiryForm
  model = inquiry_data

  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.data = member_obj
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フォームが有効な場合に呼び出されるメソッドをオーバーライド
  def form_valid(self, form):
    # 入力内容記録
    edit_comment = f"内容選択:{self.request.POST['content_choice']}" + '\n' + \
                   f"問い合わせ:{self.request.POST['inquiry']}"

    # 問い合わせ内容が10文字未満の場合、リダイレクト
    if len(self.request.POST.get('inquiry', '')) < 10:
      history_record('問い合わせ登録', 'inquiry_data', 'ERROR046', edit_comment, self.request)
      messages.error(self.request, '問い合わせ内容は10文字以上でお願いします。ERROR046')
      return redirect('/inquiry_new')

    # 従業員番号に該当するmemberインスタンスを取得
    member_instance = member.objects.get(employee_no=self.request.session['login_No'])

    # 問い合わせ内容を保存
    new_inquiry = form.save(commit=False)
    new_inquiry.employee_no2 = self.request.session['login_No']
    new_inquiry.name = member_instance
    new_inquiry.save()

    # 操作履歴記録
    history_record('問い合わせ登録', 'inquiry_data', 'OK', edit_comment, self.request)

    # 最新の問い合わせデータ取得
    inquiry_data_id = inquiry_data.objects.order_by('id').last()
    # 設定データ取得
    last_record = administrator_data.objects.order_by('id').last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # ポップアップ書き込み処理
    for i in range(1, 6):  # pop_up1からpop_up5まで確認
      pop_up_field = f'pop_up{i}'
      pop_up_id_field = f'pop_up_id{i}'
      if getattr(default_data, pop_up_field) in ["", None]:
        administrator_data.objects.update_or_create(
          id=default_data.id,
          defaults={
            pop_up_id_field: inquiry_data_id.id,
            pop_up_field: f'{self.data.name}さんからの新しい問い合わせがあります。'
          }
        )
        break

    # 問い合わせMENUへ
    return redirect('/inquiry_main')


  # フォームバリデーションが失敗した際の処理
  def form_invalid(self, form):
    request = self.request
    messages.error(request, f'バリテーションエラーが発生しました。IT担当者に連絡してください。{form.errors} ERROR060')
    return redirect(to='/inquiry_new')


  # コンテキストデータを設定するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '問い合わせ入力'
    context['data'] = self.data
    return context





#--------------------------------------------------------------------------------------------------------





# 問い合わせ履歴画面定義
class InquiryListView(ListView):
  model = inquiry_data
  template_name = 'kosu/inquiry_list.html'
  context_object_name = 'data'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_data = member_obj

    # 設定情報取得
    last_record = administrator_data.objects.order_by('id').last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      self.page_num = administrator_data(menu_row=20)
    else:
      self.page_num = last_record

    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # フィルタリングキーワード生成
  def get_filter_kwargs(self, request):
    # 検索時の処理
    if "find" in request.POST:
      # フィルタリング内容を返す
      return {'content_choice__contains': request.POST['category'], 'employee_no2__contains': request.POST['name_list']}
    # GET時の処理(フィルタリングなし)
    filter_kwargs = {}
    # フィルタリング内容を返す
    return filter_kwargs


  # フィルタリングされたデータ取得
  def get_queryset(self):
    return inquiry_data.objects.filter(**self.get_filter_kwargs(self.request)).order_by('id').reverse()


  # コンテキストをオーバーライド
  def get_context_data(self, **kwargs):
    # 名前リスト作成
    employee_no_list = inquiry_data.objects.values_list('employee_no2', flat=True)\
        .order_by('employee_no2').distinct()
    name_list = [['', '']]
    for No in employee_no_list:
      try:
        name = member.objects.get(employee_no=No)
        name_list.append([No, str(name)])
      except member.DoesNotExist:
        pass

    # フォーム定義
    form = inquiry_findForm(self.request.POST)
    form.fields['name_list'].choices = name_list

    # HTMLへ送るコンテキストを定義
    context = super().get_context_data(**kwargs)
    context.update({
      'title': '問い合わせ履歴',
      'form': form,
      'num': self.kwargs.get('num', 1)
        })

    return context


  # GET時の処理
  def get(self, request, *args, **kwargs):
    # フィルタリングしたデータをページネーションで絞り込み
    paginator = Paginator(self.get_queryset(), self.page_num.menu_row)
    self.object_list = paginator.get_page(kwargs.get('num'))
    # HTMLに送るデータに追加
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    # HTMLにデータ送信
    return self.render_to_response(context)


  # POST時の処理
  def post(self, request, *args, **kwargs):
    # ポップアップリセット時の処理
    if 'pop_up_reset' in request.POST:
      # ポップアップリセット
      administrator_data.objects.update_or_create(id = self.page_num.id, \
                                                  defaults = {'pop_up_id1': '', 'pop_up1': '',
                                                              'pop_up_id2': '', 'pop_up2': '',
                                                              'pop_up_id3': '', 'pop_up3': '',
                                                              'pop_up_id4': '', 'pop_up4': '',
                                                              'pop_up_id5': '', 'pop_up5': '',})

      member.objects.update_or_create(employee_no = request.session['login_No'], \
                                      defaults = {'pop_up_id1': '', 'pop_up1': '',
                                                  'pop_up_id2': '', 'pop_up2': '',
                                                  'pop_up_id3': '', 'pop_up3': '',
                                                  'pop_up_id4': '', 'pop_up4': '',
                                                  'pop_up_id5': '', 'pop_up5': '',})
    # フィルタリングしたデータをページネーションで絞り込み
    paginator = Paginator(self.get_queryset(), self.page_num.menu_row)
    self.object_list = paginator.get_page(kwargs.get('num'))
    # HTMLに送るデータに追加
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    # HTMLにデータ送信
    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 問い合わせ詳細画面定義
class InquiryDisplayView(TemplateView):
  # テンプレート定義
  template_name = 'kosu/inquiry_display.html'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.data = member_obj
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータ作成
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    request = self.request
    num = int(self.kwargs.get('num'))

    # 問い合わせデータ取得
    obj_get = inquiry_data.objects.get(id=num)
    # 本人確認フラグ（True/False）
    himself = str(obj_get.name) == str(self.data.name)

    # 設定データ取得
    last_record = administrator_data.objects.order_by('id').last()
    # 設定データが存在しない場合、1ページ20件に指定
    if last_record is None:
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # 個人ポップアップ削除処理
    for i in range(1, 6):
      pop_up_id_field = f'pop_up_id{i}'
      pop_up_field = f'pop_up{i}'
      if str(getattr(self.data, pop_up_id_field)) == str(num):
        member.objects.update_or_create(
          employee_no=request.session['login_No'],
          defaults={pop_up_id_field: '', pop_up_field: ''}
        )
        # メンバー情報再取得
        self.data = member.objects.get(employee_no=request.session['login_No'])
        break

    # 個人ポップアップ移行処理(ポップアップデータを前詰め)
    for i in range(1, 5):
      pop_up_id_field = f'pop_up_id{i}'
      pop_up_field = f'pop_up{i}'
      next_pop_up_id_field = f'pop_up_id{i+1}'
      next_pop_up_field = f'pop_up{i+1}'

      if getattr(self.data, pop_up_field) in ['', None]:
        member.objects.update_or_create(
          employee_no=request.session['login_No'],
          defaults={
            pop_up_id_field: getattr(self.data, next_pop_up_id_field),
            pop_up_field: getattr(self.data, next_pop_up_field),
            next_pop_up_id_field: '',
            next_pop_up_field: ''
          }
        )
        # メンバー情報再取得
        self.data = member.objects.get(employee_no=request.session['login_No'])

    # 管理者通知ポップアップ削除処理
    if default_data.administrator_employee_no1 == str(request.session['login_No']) or \
        default_data.administrator_employee_no2 == str(request.session['login_No']) or \
        default_data.administrator_employee_no3 == str(request.session['login_No']):
      for i in range(1, 6):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        if str(getattr(default_data, pop_up_id_field)) == str(num):
          administrator_data.objects.update_or_create(
            id=default_data.id, defaults={pop_up_id_field: '', pop_up_field: ''}
          )
          # 設定データ再取得
          default_data = administrator_data.objects.order_by('id').last()
          break

      # 管理者通知ポップアップ移行処理(ポップアップデータを前詰め)
      for i in range(1, 5):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        next_pop_up_id_field = f'pop_up_id{i+1}'
        next_pop_up_field = f'pop_up{i+1}'

        if getattr(default_data, pop_up_id_field) in ['', None]:
          administrator_data.objects.update_or_create(
            id=default_data.id,
            defaults={
              pop_up_id_field: getattr(default_data, next_pop_up_id_field),
              pop_up_field: getattr(default_data, next_pop_up_field),
              next_pop_up_id_field: '',
              next_pop_up_field: ''
            }
          )
          # 設定データ再取得
          default_data = administrator_data.objects.order_by('id').last()

    # 次・前のデータの取得
    next_record = inquiry_data.objects.filter(id__gt=num).order_by('id').first()
    has_next_record = next_record is not None
    before_record = inquiry_data.objects.filter(id__lt=num).order_by('-id').first()
    has_before_record = before_record is not None

    # コンテキストに値を渡す
    context.update({
      'title': '問い合わせ詳細',
      'id': num,
      'obj': obj_get,
      'data': self.data,
      'himself': himself,
      'has_next_record': has_next_record,
      'has_before_record': has_before_record,
    })

    return context


  # POST時の処理
  def post(self, request, *args, **kwargs):
    num = int(self.kwargs.get('num'))

    # 問い合わせ編集処理
    if "Registration" in request.POST:
      return redirect(to=f'/inquiry_edit/{num}')

    # 前の問い合わせへ
    if "before" in request.POST:
      obj_before = inquiry_data.objects.filter(id__lt=num).order_by('-id').first()
      return redirect(to=f'/inquiry_display/{obj_before.id}')

    # 次の問い合わせへ
    if "after" in request.POST:
      obj_after = inquiry_data.objects.filter(id__gt=num).order_by('id').first()
      return redirect(to=f'/inquiry_display/{obj_after.id}')

    # それ以外は通常のGETリクエストとして処理
    return super().get(request, *args, **kwargs)





#--------------------------------------------------------------------------------------------------------





# 問い合わせ編集画面定義
class InquiryEditView(View):
  # テンプレート定義
  template_name = 'kosu/inquiry_edit.html'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.login_obj_get = member_obj

    # 設定データ取得
    last_record = administrator_data.objects.order_by('id').last()
    if last_record is None:
      self.administrator_obj_get = administrator_data(menu_row=20)
    else:
      self.administrator_obj_get = last_record

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # GET時の処理
  def get(self, request, num):
    # 指定IDの工数履歴レコード取得
    obj_get = inquiry_data.objects.get(id=num)

    # 初期値定義してフォーム作成
    form_default = {
      'content_choice': obj_get.content_choice,
      'inquiry': obj_get.inquiry,
      'answer': obj_get.answer,
    }
    form = inquiryForm(form_default)

    # 辞書を作成してHTMLに渡す
    context = {
      'title': '問い合わせ編集',
      'id': num,
      'obj': obj_get,
      'form': form,
      'login_obj_get': self.login_obj_get,
    }

    return render(request, self.template_name, context)


  # POST時の処理
  def post(self, request, num):
    # 指定IDの工数履歴レコード取得
    obj_get = inquiry_data.objects.get(id=num)

    # 問い合わせ編集処理
    if "Registration" in request.POST:
      # 入力内容記録
      edit_comment = f"内容選択:{self.request.POST['content_choice']}" + '\n' + \
                    f"問い合わせ:{self.request.POST.get('inquiry', '')}" + '\n' + \
                    f"回答:{self.request.POST.get('answer', '')}"

      # 問い合わせ者情報を取得
      try:
        member_obj_get = member.objects.get(employee_no=obj_get.employee_no2)
      except member.DoesNotExist:
        member_obj_get = ''

      # 問い合わせの内容に変更のあった場合
      if obj_get.inquiry != request.POST['inquiry']:
        # 管理者へのポップアップ通知
        for i in range(1, 6):
          pop_up_attr = f'pop_up{i}'
          pop_up_id_attr = f'pop_up_id{i}'
          if getattr(self.administrator_obj_get, pop_up_attr) in ['', None]:
            administrator_data.objects.update_or_create(
              id=self.administrator_obj_get.id,
              defaults={
                pop_up_attr: f'ID{num}の問い合わせが編集されました。',
                pop_up_id_attr: num,
              }
            )
            break

      # ログイン者が管理者の場合
      if self.login_obj_get.administrator:
        # 回答に変更があった場合
        if obj_get.answer != request.POST['answer']:
          # 問い合わせ者の人員情報がある場合
          if member_obj_get:
            # 問い合わせ者に回答通知
            for i in range(1, 6):
              pop_up_attr = f'pop_up{i}'
              pop_up_id_attr = f'pop_up_id{i}'
              if getattr(member_obj_get, pop_up_attr) in ['', None]:
                member.objects.update_or_create(
                  employee_no=obj_get.employee_no2,
                  defaults={
                    pop_up_attr: f'ID{num}の問い合わせに回答が来ています。',
                    pop_up_id_attr: num,
                  },
                )
                break

          # 問い合わせ&回答保存
          inquiry_data.objects.update_or_create(
            id=num,
            defaults={
              'content_choice': request.POST["content_choice"],
              'inquiry': request.POST["inquiry"],
              'answer': request.POST["answer"],
            },
          )

        # 回答に変更がない場合
        else:
          # 回答以外保存
          inquiry_data.objects.update_or_create(
            id=num,
            defaults={
              'content_choice': request.POST["content_choice"],
              'inquiry': request.POST["inquiry"],
            },
          )

      # ログイン者が管理者でない場合
      else:
        # 回答以外保存
        inquiry_data.objects.update_or_create(
          id=num,
          defaults={
            'content_choice': request.POST["content_choice"],
            'inquiry': request.POST["inquiry"],
          },
        )

      # 編集履歴記録
      history_record('問い合わせ編集', 'inquiry_data', 'OK', edit_comment, self.request)

      # 問い合わせ一覧へ戻る
      return redirect(to='/inquiry_list/1')


    # 問い合わせ削除処理
    if "delete" in request.POST:
      # 入力内容記録
      self.request.session['delete_content_choice'] = self.request.POST['content_choice']
      self.request.session['delete_inquiry'] = self.request.POST['inquiry']
      self.request.session['delete_answer'] = self.request.POST.get('answer', '')
      edit_comment = f"内容選択:{self.request.session['delete_content_choice']}" + '\n' + \
                    f"問い合わせ:{self.request.session['delete_inquiry']}" + '\n' + \
                    f"回答:{self.request.session['delete_answer']}"

      # 問い合わせ者の人員情報取得
      data = member.objects.get(employee_no=obj_get.employee_no2)

      # 削除する問い合わせに関する通知を削除
      for i in range(1, 6):
        pop_up_id_attr = f'pop_up_id{i}'
        pop_up_attr = f'pop_up{i}'
        if getattr(data, pop_up_id_attr) == str(num):
          member.objects.update_or_create(
            employee_no=obj_get.employee_no2,
            defaults={pop_up_id_attr: '', pop_up_attr: ''}
          )
      # 問い合わせ者の人員情報再取得
      data = member.objects.get(employee_no=obj_get.employee_no2)

      # 問い合わせ者の通知情報整理
      for i in range(1, 5):
        pop_up_attr = f'pop_up{i}'
        pop_up_id_attr = f'pop_up_id{i}'
        next_pop_up_attr = f'pop_up{i + 1}'
        next_pop_up_id_attr = f'pop_up_id{i + 1}'

        if getattr(data, pop_up_attr) in ['', None]:
          member.objects.update_or_create(
            employee_no=obj_get.employee_no2,
            defaults={
              pop_up_attr: getattr(data, next_pop_up_attr),
              pop_up_id_attr: getattr(data, next_pop_up_id_attr),
              next_pop_up_attr: '',
              next_pop_up_id_attr: ''
            }
          )
          # 問い合わせ者の人員情報再取得
          data = member.objects.get(employee_no=obj_get.employee_no2)

      # 削除する問い合わせに関する通知を削除
      for i in range(1, 6):
        pop_up_id_attr = f"pop_up_id{i}"
        pop_up_attr = f"pop_up{i}"
        if getattr(self.administrator_obj_get, pop_up_id_attr) == str(num):
          administrator_data.objects.update_or_create(
            id=self.administrator_obj_get.id,
            defaults={pop_up_id_attr: '', pop_up_attr: ''}
          )
      # 設定再取得
      self.administrator_obj_get = administrator_data.objects.order_by('id').last()

      # 管理者用通知整理
      for i in range(1, 5):
        pop_up_attr = f"pop_up{i}"
        pop_up_id_attr = f"pop_up_id{i}"
        next_pop_up_attr = f"pop_up{i + 1}"
        next_pop_up_id_attr = f"pop_up_id{i + 1}"
        if getattr(self.administrator_obj_get, pop_up_attr) in ["", None]:
          administrator_data.objects.update_or_create(
            id=self.administrator_obj_get.id,
            defaults={
              pop_up_attr: getattr(self.administrator_obj_get, next_pop_up_attr),
              pop_up_id_attr: getattr(self.administrator_obj_get, next_pop_up_id_attr),
              next_pop_up_attr: '',
              next_pop_up_id_attr: ''
            }
          )

      # 問い合わせ削除
      obj_get.delete()

      # 編集履歴記録
      history_record('問い合わせ削除', 'inquiry_data', 'OK', edit_comment, self.request)

      # 問い合わせ一覧へ戻る
      return redirect(to='/inquiry_list/1')





#--------------------------------------------------------------------------------------------------------

