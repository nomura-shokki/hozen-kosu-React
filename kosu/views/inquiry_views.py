from django.shortcuts import render, redirect
from django.http import HttpResponseRedirect
from django.core.paginator import Paginator
from django.contrib import messages
from django.views.generic.edit import CreateView
from django.views.generic.list import ListView
from django.views.generic.base import TemplateView
from ..models import member
from ..models import administrator_data
from ..models import inquiry_data
from ..forms import inquiryForm
from ..forms import inquiry_findForm
from ..utils.kosu_utils import get_member





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
    # 問い合わせ内容が10文字未満の場合、リダイレクト
    if len(self.request.POST.get('inquiry', '')) < 10:
      messages.error(self.request, '問い合わせ内容は10文字以上でお願いします。ERROR046')
      return redirect('/inquiry_new')

    # 従業員番号に該当するmemberインスタンスを取得
    member_instance = member.objects.get(employee_no=self.request.session['login_No'])

    # 問い合わせ内容を保存
    new_inquiry = form.save(commit=False)
    new_inquiry.employee_no2 = self.request.session['login_No']
    new_inquiry.name = member_instance
    new_inquiry.save()

    # 最新の問い合わせデータ取得
    inquiry_data_id = inquiry_data.objects.order_by("id").last()
    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
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
      last_record = administrator_data.objects.order_by("id").last()
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
                                                    defaults = {'pop_up_id1' : '', 'pop_up1' : '',
                                                                'pop_up_id2' : '', 'pop_up2' : '',
                                                                'pop_up_id3' : '', 'pop_up3' : '',
                                                                'pop_up_id4' : '', 'pop_up4' : '',
                                                                'pop_up_id5' : '', 'pop_up5' : '',})

        member.objects.update_or_create(employee_no = request.session['login_No'], \
                                        defaults = {'pop_up_id1' : '', 'pop_up1' : '',
                                                    'pop_up_id2' : '', 'pop_up2' : '',
                                                    'pop_up_id3' : '', 'pop_up3' : '',
                                                    'pop_up_id4' : '', 'pop_up4' : '',
                                                    'pop_up_id5' : '', 'pop_up5' : '',})
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
    self.member_obj = member_obj
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
    last_record = administrator_data.objects.order_by("id").last()
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
          default_data = administrator_data.objects.order_by("id").last()
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
          default_data = administrator_data.objects.order_by("id").last()

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
def inquiry_edit(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')


  # 指定IDの工数履歴のレコードのオブジェクト取得
  obj_get = inquiry_data.objects.get(id = num)

  try:
    # ログイン者の情報取得
    login_obj_get = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 


  # フォーム初期値定義
  form_default = {'content_choice' : obj_get.content_choice, 
                  'inquiry' : obj_get.inquiry, 
                  'answer' : obj_get.answer}
  # フォーム定義
  form = inquiryForm(form_default)



  # 問い合わせ編集処理
  if "Registration" in request.POST:
    # 指定IDの工数履歴のレコードのオブジェクト取得
    obj_get = inquiry_data.objects.get(id = num)

    # 問い合わせ者情報取得
    member_obj_get = member.objects.get(employee_no = obj_get.employee_no2)

    # 設定情報取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      administrator_obj_get = administrator_data(menu_row=20)
    else:
      administrator_obj_get = last_record

    # 問い合わせが編集前後で変更がある場合の処理
    if obj_get.inquiry != request.POST['inquiry']:
      # ポップアップ1が空の場合の処理
      if administrator_obj_get.pop_up1 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                                    defaults = {'pop_up1' : 'ID{}の問い合わせが編集されました。'.format(num),
                                                                'pop_up_id1' : num})
        
      # ポップアップ2が空の場合の処理
      elif administrator_obj_get.pop_up2 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up2' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id2' : num})

      # ポップアップ3が空の場合の処理
      elif administrator_obj_get.pop_up3 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up3' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id3' : num})

      # ポップアップ4が空の場合の処理
      elif administrator_obj_get.pop_up4 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up4' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id4' : num})

      # ポップアップ5が空の場合の処理
      elif administrator_obj_get.pop_up5 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up5' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id5' : num})


    # ログイン者に回答権限がある場合の処理
    if login_obj_get.administrator == True:
      # 回答が編集前後で変更がある場合の処理
      if obj_get.answer != request.POST['answer']:
        # ポップアップ1が空の場合の処理
        if member_obj_get.pop_up1 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up1' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id1' : num})

        # ポップアップ2が空の場合の処理
        elif member_obj_get.pop_up2 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up2' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id2' : num})

        # ポップアップ3が空の場合の処理
        elif member_obj_get.pop_up3 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up3' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id3' : num})
          
        # ポップアップ4が空の場合の処理
        elif member_obj_get.pop_up4 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up4' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id4' : num})

        # ポップアップ5が空の場合の処理
        elif member_obj_get.pop_up5 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up5' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id5' : num})

        # 問い合わせ回答書き込み
        inquiry_data.objects.update_or_create(id = num, \
                                              defaults = {'content_choice' : request.POST['content_choice'], \
                                                          'inquiry' : request.POST['inquiry'], \
                                                          'answer' : request.POST['answer']})
      # 回答が編集前後で変更がない場合の処理
      else:
        # 問い合わせ書き込み
        inquiry_data.objects.update_or_create(id = num, \
                                              defaults = {'content_choice' : request.POST['content_choice'], \
                                                          'inquiry' : request.POST['inquiry']})
  
    # ログイン者に回答権限がない場合の処理
    else:
      # 問い合わせ書き込み
      inquiry_data.objects.update_or_create(id = num, \
                                            defaults = {'content_choice' : request.POST['content_choice'], \
                                                        'inquiry' : request.POST['inquiry']})


    # 問い合わせ一覧ページをリダイレクトする
    return redirect(to = '/inquiry_list/1')



  # 問い合わせ削除処理
  if "delete" in request.POST:

    # 問い合わせ者の情報取得
    data = member.objects.get(employee_no = obj_get.employee_no2)

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id1 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id1' : '',
                                                  'pop_up1' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id2 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id2' : '',
                                                  'pop_up2' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id3 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id3' : '',
                                                  'pop_up3' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id4 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id4' : '',
                                                  'pop_up4' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id5 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id5' : '',
                                                  'pop_up5' : ''})
      

    # 問い合わせ者の情報再取得
    data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ1が空の場合の処理
    if data.pop_up1 in ['', None]:
      #ポップアップ2の内容をポップアップ1へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id1' : data.pop_up_id2,
                                    'pop_up1' : data.pop_up2,
                                    'pop_up_id2' : '',
                                    'pop_up2' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ2が空の場合の処理
    if data.pop_up2 in ['', None]:
      #ポップアップ3の内容をポップアップ2へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id2' : data.pop_up_id3,
                                    'pop_up2' : data.pop_up3,
                                    'pop_up_id3' : '',
                                    'pop_up3' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ3が空の場合の処理
    if data.pop_up3 in ['', None]:
      #ポップアップ4の内容をポップアップ3へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id3' : data.pop_up_id4,
                                    'pop_up3' : data.pop_up4,
                                    'pop_up_id4' : '',
                                    'pop_up4' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ4が空の場合の処理
    if data.pop_up4 in ['', None]:
      #ポップアップ5の内容をポップアップ4へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id4' : data.pop_up_id5,
                                    'pop_up4' : data.pop_up5,
                                    'pop_up_id5' : '',
                                    'pop_up5' : ''})
    

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id1 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id1 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id1' : '',
                                                    'pop_up1' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id2 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id2 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id2' : '',
                                                    'pop_up2' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id3 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id3 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id3' : '',
                                                    'pop_up3' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id4 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id4 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id4' : '',
                                                    'pop_up4' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id5 != '':
      # 削除する問い合わせIDとポップアッ'プのIDが等しいときの処理
      if default_data.pop_up_id5 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id5' : '',
                                                    'pop_up5' : ''})
      

    # 設定データ再取得
    default_data = administrator_data.objects.order_by("id").last()

    # ポップアップ1が空の場合の処理
    if default_data.pop_up1 in ["", None]:
      #ポップアップ2の内容をポップアップ1へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id1' : default_data.pop_up_id2,
                                    'pop_up1' : default_data.pop_up2,
                                    'pop_up_id2' : '',
                                    'pop_up2' : ''})

      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ2が空の場合の処理
    if default_data.pop_up2 in ["", None]:
      #ポップアップ3の内容をポップアップ2へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id2' : default_data.pop_up_id3,
                                    'pop_up2' : default_data.pop_up3,
                                    'pop_up_id3' : '',
                                    'pop_up3' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ3が空の場合の処理
    if default_data.pop_up3 in ["", None]:
      #ポップアップ4の内容をポップアップ3へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id3' : default_data.pop_up_id4,
                                    'pop_up3' : default_data.pop_up4,
                                    'pop_up_id4' : '',
                                    'pop_up4' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ4が空の場合の処理
    if default_data.pop_up4 in ["", None]:
      #ポップアップ5の内容をポップアップ4へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id4' : default_data.pop_up_id5,
                                    'pop_up4' : default_data.pop_up5,
                                    'pop_up_id5' : '',
                                    'pop_up5' : ''})


    # 取得したレコード削除
    obj_get.delete()

    # 問い合わせ一覧ページをリダイレクトする
    return redirect(to = '/inquiry_list/1')



  # HTMLに渡す辞書
  context = {
    'title' : '問い合わせ編集',
    'id' : num,
    'obj' : obj_get,
    'form' : form,
    'login_obj_get' : login_obj_get,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/inquiry_edit.html', context)





#--------------------------------------------------------------------------------------------------------





