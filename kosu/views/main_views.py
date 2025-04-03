from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.generic import TemplateView
from django.views.generic.edit import FormView
from pathlib import Path
from io import BytesIO
import openpyxl
import datetime
import math
import os
import environ
import urllib.parse
from ..utils.kosu_utils import get_member
from ..utils.main_utils import has_non_halfwidth_characters
from ..models import member, Business_Time_graph, kosu_division, team_member, inquiry_data, administrator_data
from ..forms import loginForm, administrator_data_Form, uploadForm





#--------------------------------------------------------------------------------------------------------





# ログイン画面定義
class LoginView(FormView):
  # 使用するテンプレート,フォーム,リダイレクト先定義
  template_name = 'kosu/login.html'
  form_class = loginForm
  success_url = '/'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # ログイン済みならメイン画面にリダイレクト
    if request.session.get('login_No') and request.session.get('input_def'):
      return redirect(self.success_url)
    return super().dispatch(request, *args, **kwargs)

  # フォームが有効な場合の処理
  def form_valid(self, form):
    # フォームから送信された値を取得
    find = form.cleaned_data['employee_no4']
    # 従業員番号が空の場合、リダイレクト
    if find in ["", None]:
      messages.error(self.request, '従業員番号を入力して下さい。ERROR047')
      return redirect('/login')

    # 人員登録データから値を検索
    data = member.objects.filter(employee_no=find)
    # 従業員番号の登録がない場合、リダイレクト
    if not data.exists():
      messages.error(self.request, '入力された従業員番号は登録がありません。ERROR048')
      return redirect('/login')

    # 従業員番号の登録がある場合の処理
    else:
      # 従業員番号をセッションに保存
      self.request.session['login_No'] = find
      # 使用する工数区分を読み込む（最新のもの）
      def_Ver = kosu_division.objects.order_by("id").last()

      # 工数区分定義が存在しない場合、リダイレクト
      if not def_Ver:
        messages.error(self.request, '利用可能な工数区分がありません。ERROR052')
        return redirect('/login')
      else:
        self.request.session['input_def'] = def_Ver.kosu_name

      # メインページにリダイレクト
      return redirect(self.success_url)


  # フォームが無効だった場合の処理（同じ画面に留まらせ）
  def form_invalid(self, form):
    return self.render_to_response(self.get_context_data(form=form))


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = 'ログイン'
    return context





#--------------------------------------------------------------------------------------------------------





# メイン画面定義
class MainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/main.html'


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
  

  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    request = self.request

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # 問い合わせ担当者従業員番号がログイン者の従業員番号と一致している場合、ポップアップ表示設定
    pop_up_display = default_data.administrator_employee_no1 == str(request.session['login_No']) or \
                     default_data.administrator_employee_no2 == str(request.session['login_No']) or \
                     default_data.administrator_employee_no3 == str(request.session['login_No'])

    context.update({
      'title': 'MENU',
      'data': self.member_obj,
      'pop_up_display': pop_up_display,
      'pop_up': default_data,
      })
    
    return context


  # POSTリクエストの処理
  def post(self, request):
    # セッションを削除
    request.session.flush()
    # ログインページに飛ぶ
    return redirect('/login')





#--------------------------------------------------------------------------------------------------------





# 工数メイン画面定義
class KosuMainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/kosu_main.html'
    

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


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    # HTMLに渡す辞書
    context.update({
        'title': '工数MENU',
        'data': self.member_obj,
    })

    return context





#--------------------------------------------------------------------------------------------------------





# 工数区分定義メイン画面定義
class DefMainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/def_main.html'
    

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


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    # HTMLに渡す辞書
    context.update({
        'title': '工数区分定義MENU',
        'data': self.member_obj,
    })

    return context





#--------------------------------------------------------------------------------------------------------





# 人員メイン画面定義
class MemberMainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/member_main.html'
    

  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # ログイン者に権限がなければメインページに戻る
    if member_obj.authority == False:
      return redirect('/')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)
    


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    # HTMLに渡す辞書
    context.update({
        'title': '人員MENU',
        'data': self.member_obj,
    })

    return context





#--------------------------------------------------------------------------------------------------------





# 班員メイン画面定義
class TeamMainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/team_main.html'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # ログイン者に権限がなければメインページに戻る
    if member_obj.authority == False:
      return redirect('/')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    request = self.request

    # 今日の日時を変数に格納
    today = datetime.date.today()

    # フォロー表示変数定義
    follow_display = False

    # 日付リスト初期状態定義
    day_list = [today - datetime.timedelta(days=d) for d in range(1, 8)]

    # ログイン者の班員登録あるか確認
    team_filter = team_member.objects.filter(employee_no5=request.session['login_No'])

    # ログイン者の班員登録がある場合の処理
    if team_filter.exists():
      # ログイン者の班員情報取得
      team_get = team_member.objects.get(employee_no5=request.session['login_No'])

      # フォロー表示
      follow_display = team_get.follow

      # 班員フォロー用リスト作成
      team_list = []
      for t in range(1, 16):
        member_no = eval(f'team_get.member{t}')
        if member_no:
          member_name_filter = member.objects.filter(employee_no=member_no)
          if member_name_filter.exists():
            member_name_get = member_name_filter.first()
            for ind, dd in enumerate(day_list):
              kosu_filter = Business_Time_graph.objects.filter(
                employee_no3=member_no,
                work_day2=dd
                )
              if kosu_filter.exists():
                kosu_get = kosu_filter.first()
                if kosu_get.tyoku2 != '3' and ind == 0 and not kosu_get.judgement:
                  team_list.append(f'{member_name_get.name}氏の工数未入力があります。')
                  break
                if not kosu_get.judgement and ind != 0:
                  team_list.append(f'{member_name_get.name}氏の工数未入力があります。')
                  break
              else:
                team_list.append(f'{member_name_get.name}氏の工数未入力があります。')
                break
    else:
      # ログイン者の班員登録がない場合の処理
      team_list = []

    # コンテキストにデータを格納
    context.update({
      'title': '班員MENU',
      'data': self.member_obj,
      'team': team_list,
      'follow_display': follow_display,
      })

    return context





#--------------------------------------------------------------------------------------------------------





# 問い合わせメイン画面定義
class InquirMainView(TemplateView):
  # 使用するテンプレート定義
  template_name = 'kosu/inquiry_main.html'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # ログイン者に権限がなければメインページに戻る
    if member_obj.authority == False:
      return redirect('/')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)
    


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    # HTMLに渡す辞書
    context.update({
        'title': '問い合わせMENU',
        'data': self.member_obj,
    })

    return context





#--------------------------------------------------------------------------------------------------------





# 管理者画面定義
def administrator_menu(request):
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


  # ログイン者が管理者でなければメインページに戻る
  if data.administrator == False:
    return redirect(to = '/')


  # 設定データ取得
  last_record = administrator_data.objects.order_by("id").last()
  if last_record is None:
    # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
    default_data = administrator_data(menu_row=20)
  else:
    default_data = last_record

  # 設定データの最新のレコードのID取得
  record_id = default_data.id


  # フォーム初期値
  form_default = {
    'menu_row' : default_data.menu_row,
    'administrator_employee_no1' : default_data.administrator_employee_no1,
    'administrator_employee_no2' : default_data.administrator_employee_no2,
    'administrator_employee_no3' : default_data.administrator_employee_no3,
    }
  
  # パス指定フォームに初期値を入れて定義
  form = administrator_data_Form(form_default)

  # ロードファイル指定フォーム定義
  load_form = uploadForm()



  # 設定更新時の処理
  if 'registration' in request.POST:
    # 一覧表示項目数に文字が入っている場合、リダイレクト
    if not request.POST['menu_row'].isdigit():
      messages.error(request, '一覧表示項目数は数字で入力して下さい。ERROR049')
      return redirect(to = '/administrator')

    # 問い合わせ担当者従業員番号が空でない場合、リダイレクト
    for i in range(1, 4):
      employee_no = request.POST[f'administrator_employee_no{i}']
      if employee_no and not employee_no.isdigit():
        messages.error(request, '問い合わせ担当者従業員番号は数字で入力して下さい。ERROR050')
        return redirect(to='/administrator')

    # 一覧表示項目数が自然数でない場合、リダイレクト
    if math.floor(float(request.POST['menu_row'])) != float(request.POST['menu_row']) or \
      float(request.POST['menu_row']) <= 0:
      messages.error(request, '一覧表示項目数は自然数で入力して下さい。ERROR029')
      return redirect(to = '/administrator')

    # 問い合わせ担当者従業員番号が自然数でない場合、リダイレクト
    for i in range(1, 4):
      employee_no = request.POST[f'administrator_employee_no{i}']
      if employee_no:
        try:
          value = float(employee_no)
          if value <= 0 or value != math.floor(value):
            raise ValueError
        except ValueError:
          messages.error(request, '問い合わせ担当者従業員番号は自然数で入力して下さい。ERROR051')
          return redirect(to='/administrator')

    # 一覧表示項目数が半角でない場合、リダイレクト
    if has_non_halfwidth_characters(request.POST['menu_row']):
      messages.error(request, '一覧表示項目数は半角で入力して下さい。ERROR056')
      return redirect(to = '/administrator')

    # 問い合わせ担当者従業員番号が半角でない場合、リダイレクト
    for i in range(1, 4):
      employee_no = request.POST[f'administrator_employee_no{i}']
      if has_non_halfwidth_characters(employee_no):
        messages.error(request, '問い合わせ担当者従業員番号は半角で入力して下さい。ERROR057')
        return redirect(to='/administrator')

    # 問い合わせ担当者従業員番号が空でない場合、リダイレクト
    for i in range(1, 4):
      employee_no = request.POST[f'administrator_employee_no{i}']
      if employee_no:
        if not member.objects.filter(employee_no=employee_no).exists():
          messages.error(request, '入力された問い合わせ担当者従業員番号は登録されていません。ERROR058')
          return redirect(to='/administrator')

    # レコードにPOST送信された値を上書きする
    administrator_data.objects.update_or_create(id = record_id, \
        defaults = {'menu_row' : request.POST['menu_row'], 
                    'administrator_employee_no1' : request.POST['administrator_employee_no1'],
                    'administrator_employee_no2' : request.POST['administrator_employee_no2'],
                    'administrator_employee_no3' : request.POST['administrator_employee_no3']})
    
    # フォームにPOST値を入れて定義
    form = administrator_data_Form(request.POST)



  # HTMLに渡す辞書
  context = {
    'title' : '管理者MENU',
    'form' : form,
    'load_form' : load_form,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/administrator_menu.html', context)





#--------------------------------------------------------------------------------------------------------





# ヘルプ画面定義
def help(request):
  # ルートディレクトリを取得
  BASE_DIR = Path(__file__).resolve().parent.parent
  # 環境変数ファイルを読み込む
  env = environ.Env()
  env.read_env(os.path.join(BASE_DIR, '.env'))

  # フォームを定義
  form = uploadForm(request.POST)



  # GET時の処理
  if (request.method == 'GET'):
    # ファイルロード欄非表示
    display = False



  # 復帰パスワード入力時処理
  if 'help_button' in request.POST:
    # パスワード判定
    if request.POST['help_path'] ==  env('HELP_PATH'):
      display = True
    else:
      display = False
      messages.error(request, 'パスワードが違います。ERROR081')



  # データ読み込み
  if 'data_load' in request.POST:
    # データ読み込み欄表示
    display = True

    # 人員ファイルが未選択時リダイレクト
    if 'member_file' not in request.FILES:
      messages.error(request, '人員ファイルが選択されていません。ERROR082')
      return redirect(to = '/help')

    # 工数区分定義ファイルが未選択時リダイレクト
    if 'def_file' not in request.FILES:
      messages.error(request, '工数区分定義ファイルが選択されていません。ERROR083')
      return redirect(to = '/help')

    # 人員ファイル定義
    uploaded_file = request.FILES['member_file']
    # 一時的なファイルをサーバー上に作成
    with open('member_file_path.xlsx', 'wb+') as destination:

      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in uploaded_file.chunks():
        destination.write(chunk)

    # 一時ファイルを開く
    wb = openpyxl.load_workbook('member_file_path.xlsx')
    # 一番最初のシートを指定
    ws = wb.worksheets[0]
    # レコード数取得
    data_num = ws.max_row

    # 人員データにレコードがある場合の処理
    if member.objects.exists():
      # Excelからデータを読み込むループ
      for i in range(1, data_num):
        # 人員データに指定従業員番号があるか確認
        member_obj_filter = member.objects.filter(employee_no = ws.cell(row = i + 1, column = 1).value)

        # 人員データに指定従業員番号がある場合の処理
        if member_obj_filter.count() != 0:
          # 指定従業員番号の人員データ取得
          member_obj_get = member.objects.get(employee_no = ws.cell(row = i + 1, column = 1).value)
          # 取得した人員データを消す
          member_obj_get.delete()

        # Excelからデータを読み込み
        new_data = member(employee_no = ws.cell(row = i + 1, column = 1).value, \
                          name = ws.cell(row = i + 1, column = 2).value, \
                          shop = ws.cell(row = i + 1, column = 3).value, \
                          authority = ws.cell(row = i + 1, column = 4).value, \
                          administrator = ws.cell(row = i + 1, column = 5).value, \
                          break_time1 = ws.cell(row = i + 1, column = 6).value, \
                          break_time1_over1 = ws.cell(row = i + 1, column = 7).value, \
                          break_time1_over2 = ws.cell(row = i + 1, column = 8).value, \
                          break_time1_over3 = ws.cell(row = i + 1, column = 9).value, \
                          break_time2 = ws.cell(row = i + 1, column = 10).value, \
                          break_time2_over1 = ws.cell(row = i + 1, column = 11).value, \
                          break_time2_over2 = ws.cell(row = i + 1, column = 12).value, \
                          break_time2_over3 = ws.cell(row = i + 1, column = 13).value, \
                          break_time3 = ws.cell(row = i + 1, column = 14).value, \
                          break_time3_over1 = ws.cell(row = i + 1, column = 15).value, \
                          break_time3_over2 = ws.cell(row = i + 1, column = 16).value, \
                          break_time3_over3 = ws.cell(row = i + 1, column = 17).value, \
                          break_time4 = ws.cell(row = i + 1, column = 18).value, \
                          break_time4_over1 = ws.cell(row = i + 1, column = 19).value, \
                          break_time4_over2 = ws.cell(row = i + 1, column = 20).value, \
                          break_time4_over3 = ws.cell(row = i + 1, column = 21).value, \
                          pop_up1 = ws.cell(row = i + 1, column = 22).value, \
                          pop_up_id1 = ws.cell(row = i + 1, column = 23).value, \
                          pop_up2 = ws.cell(row = i + 1, column = 24).value, \
                          pop_up_id2 = ws.cell(row = i + 1, column = 25).value, \
                          pop_up3 = ws.cell(row = i + 1, column = 26).value, \
                          pop_up_id3 = ws.cell(row = i + 1, column = 27).value, \
                          pop_up4 = ws.cell(row = i + 1, column = 28).value, \
                          pop_up_id4 = ws.cell(row = i + 1, column = 29).value, \
                          pop_up5 = ws.cell(row = i + 1, column = 30).value, \
                          pop_up_id5 = ws.cell(row = i + 1, column = 31).value, \
                          break_check = ws.cell(row = i + 1, column = 32).value, \
                          def_prediction = ws.cell(row = i + 1, column = 33).value)                           

        new_data.save()


    # 人員データにレコードがない場合の処理
    else:
      # Excelからデータを読み込むループ
      for i in range(1, data_num):
        # Excelからデータを読み込み
        new_data = member(employee_no = ws.cell(row = i + 1, column = 1).value, \
                          name = ws.cell(row = i + 1, column = 2).value, \
                          shop = ws.cell(row = i + 1, column = 3).value, \
                          authority = ws.cell(row = i + 1, column = 4).value, \
                          administrator = ws.cell(row = i + 1, column = 5).value, \
                          break_time1 = ws.cell(row = i + 1, column = 6).value, \
                          break_time1_over1 = ws.cell(row = i + 1, column = 7).value, \
                          break_time1_over2 = ws.cell(row = i + 1, column = 8).value, \
                          break_time1_over3 = ws.cell(row = i + 1, column = 9).value, \
                          break_time2 = ws.cell(row = i + 1, column = 10).value, \
                          break_time2_over1 = ws.cell(row = i + 1, column = 11).value, \
                          break_time2_over2 = ws.cell(row = i + 1, column = 12).value, \
                          break_time2_over3 = ws.cell(row = i + 1, column = 13).value, \
                          break_time3 = ws.cell(row = i + 1, column = 14).value, \
                          break_time3_over1 = ws.cell(row = i + 1, column = 15).value, \
                          break_time3_over2 = ws.cell(row = i + 1, column = 16).value, \
                          break_time3_over3 = ws.cell(row = i + 1, column = 17).value, \
                          break_time4 = ws.cell(row = i + 1, column = 18).value, \
                          break_time4_over1 = ws.cell(row = i + 1, column = 19).value, \
                          break_time4_over2 = ws.cell(row = i + 1, column = 20).value, \
                          break_time4_over3 = ws.cell(row = i + 1, column = 21).value, \
                          pop_up1 = ws.cell(row = i + 1, column = 22).value, \
                          pop_up_id1 = ws.cell(row = i + 1, column = 23).value, \
                          pop_up2 = ws.cell(row = i + 1, column = 24).value, \
                          pop_up_id2 = ws.cell(row = i + 1, column = 25).value, \
                          pop_up3 = ws.cell(row = i + 1, column = 26).value, \
                          pop_up_id3 = ws.cell(row = i + 1, column = 27).value, \
                          pop_up4 = ws.cell(row = i + 1, column = 28).value, \
                          pop_up_id4 = ws.cell(row = i + 1, column = 29).value, \
                          pop_up5 = ws.cell(row = i + 1, column = 30).value, \
                          pop_up_id5 = ws.cell(row = i + 1, column = 31).value, \
                          break_check = ws.cell(row = i + 1, column = 32).value, \
                          def_prediction = ws.cell(row = i + 1, column = 33).value)                  

        new_data.save()

    # 一時ファイル削除
    os.remove('member_file_path.xlsx')


    # 工数定義区分ファイル定義
    uploaded_file = request.FILES['def_file']
    # 一時的なファイルをサーバー上に作成
    with open('def_file_path.xlsx', 'wb+') as destination:

      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in uploaded_file.chunks():
        destination.write(chunk)

    # 一時ファイルを開く
    wb1 = openpyxl.load_workbook('def_file_path.xlsx')
    # 一番最初のシートを指定
    ws1 = wb1.worksheets[0]
    # レコード数取得
    data_num = ws1.max_row

    # 工数定義区分データにレコードがある場合の処理
    if kosu_division.objects.exists():
      # Excelからデータを読み込み
      for i in range(1, data_num):
        # 工数定義区分データに指定従業員番号があるか確認
        def_obj_filter = kosu_division.objects.filter(kosu_name = ws1.cell(row = i + 1, column = 1).value)

        # 工数定義区分データに指定従業員番号がある場合の処理
        if def_obj_filter.exists():
          # 指定従工数定義区分データ取得
          def_obj_get = kosu_division.objects.get(kosu_name = ws1.cell(row = i + 1, column = 1).value)
          # 取得した工数定義区分データを消す
          def_obj_get.delete()

        # Excelからデータを読み込む
        def_data = {
          'kosu_name': ws1.cell(row=i+1, column=1).value
          }
        for n in range(1, 51):
          def_data[f'kosu_title_{n}'] = ws1.cell(row=i+1, column=n*3-1).value
          def_data[f'kosu_division_1_{n}'] = ws1.cell(row=i+1, column=n*3).value
          def_data[f'kosu_division_2_{n}'] = ws1.cell(row=i+1, column=n*3+1).value

        new_data1 = kosu_division(**def_data)
        new_data1.save()

    # 工数定義区分データにレコードがない場合の処理
    else:
      # Excelからデータを読み込み
      for i in range(1, data_num):
        # Excelからデータを読み込む
        def_data = {
          'kosu_name': ws1.cell(row=i+1, column=1).value
          }
        for n in range(1, 51):
          def_data[f'kosu_title_{n}'] = ws1.cell(row=i+1, column=n*3-1).value
          def_data[f'kosu_division_1_{n}'] = ws1.cell(row=i+1, column=n*3).value
          def_data[f'kosu_division_2_{n}'] = ws1.cell(row=i+1, column=n*3+1).value

        new_data1 = kosu_division(**def_data)
        new_data1.save()

    # 一時ファイル削除
    os.remove('def_file_path.xlsx')


    # ログインページへ
    return redirect(to = '/login')



  # HTMLに渡す辞書
  context = {
    'title' : 'ヘルプ',
    'form' : form,
    'display' : display,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/help.html', context)





#--------------------------------------------------------------------------------------------------------

