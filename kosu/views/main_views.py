from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.generic import TemplateView
from django.views.generic.edit import FormView
from pathlib import Path
from io import BytesIO
import openpyxl
import pandas as pd
import datetime
import math
import os
import environ
import urllib.parse
from ..utils.kosu_utils import kosu_division_dictionary
from ..utils.kosu_utils import get_member
from ..utils.main_utils import has_non_halfwidth_characters
from ..models import member
from ..models import Business_Time_graph
from ..models import kosu_division
from ..models import team_member
from ..models import inquiry_data
from ..models import administrator_data
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



  # 工数データ読み込み
  if 'kosu_load' in request.POST:
    # 工数データファイルが未選択時の処理
    if 'kosu_file' not in request.FILES:
      # エラーメッセージ出力
      messages.error(request, '工数データファイルが選択されていません。ERROR065')
      # このページをリダイレクト
      return redirect(to = '/administrator')

    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['kosu_file']


    # 一時的なファイルをサーバー上に作成
    with open('kosu_file_path.xlsx', 'wb+') as destination:
      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)

    # 指定Excelを開く
    wb = openpyxl.load_workbook('kosu_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]

    # 読み込むファイルが正しいファイルでない場合の処理
    if ws.cell(1, 1).value != '従業員番号' or ws.cell(1, 2).value != '氏名' or \
      ws.cell(1, 3).value != '工数区分定義Ver' or ws.cell(1, 4).value != '就業日' or \
      ws.cell(1, 5).value != '直' or ws.cell(1, 6).value != '作業内容' or \
      ws.cell(1, 7).value != '作業詳細' or ws.cell(1, 8).value != '残業時間' or \
      ws.cell(1, 9).value != '昼休憩時間' or ws.cell(1, 10).value != '残業休憩時間1' or \
      ws.cell(1, 11).value != '残業休憩時間2' or ws.cell(1, 12).value != '残業休憩時間3' or \
      ws.cell(1, 13).value != '就業形態' or ws.cell(1, 14).value != '工数入力OK_NG' or \
      ws.cell(1, 15).value != '休憩変更チェック' :

      # エラーメッセージ出力
      messages.error(request, 'ロードしようとしたファイルは工数データバックアップではありません。ERROR066')
      # このページをリダイレクト
      return redirect(to = '/administrator')

    # レコード数取得
    data_num = ws.max_row

    # Excelからデータを読み込こむループ
    for i in range(1, data_num):
      # 読み込み予定データと同一の日のデータが存在するか確認
      kosu_data_filter = Business_Time_graph.objects.filter(employee_no3 = ws.cell(row = i + 1, column = 1).value, \
                                                           work_day2 = ws.cell(row = i + 1, column = 4).value)
      # 読み込み予定データと同一の日のデータが存在する場合の処理
      if kosu_data_filter.count() != 0:
        # 読み込み予定データと同一の日のデータを取得
        kosu_data_get = Business_Time_graph.objects.get(employee_no3 = ws.cell(row = i + 1, column = 1).value, \
                                                       work_day2 = ws.cell(row = i + 1, column = 4).value)
        # 読み込み予定データと同一の日のデータを削除
        kosu_data_get.delete()

      # 人員データインスタンス取得
      member_instance = member.objects.get(employee_no = ws.cell(row = i + 1, column = 1).value)

      # Excelからデータを読み込こみ
      new_data = Business_Time_graph(employee_no3 = ws.cell(row = i + 1, column = 1).value, \
                                      name = member_instance, \
                                      def_ver2 = ws.cell(row = i + 1, column = 3).value, \
                                      work_day2 = ws.cell(row = i + 1, column = 4).value, \
                                      tyoku2 = ws.cell(row = i + 1, column = 5).value, \
                                      time_work = ws.cell(row = i + 1, column = 6).value, \
                                      detail_work = ws.cell(row = i + 1, column = 7).value, \
                                      over_time = ws.cell(row = i + 1, column = 8).value, \
                                      breaktime = ws.cell(row = i + 1, column = 9).value, \
                                      breaktime_over1 = ws.cell(row = i + 1, column = 10).value, \
                                      breaktime_over2 = ws.cell(row = i + 1, column = 11).value, \
                                      breaktime_over3 = ws.cell(row = i + 1, column = 12).value, \
                                      work_time = ws.cell(row = i + 1, column = 13).value, \
                                      judgement = ws.cell(row = i + 1, column = 14).value, \
                                      break_change = ws.cell(row = i + 1, column = 15).value) 

      # レコードセーブ
      new_data.save()

    # 一時ファイル削除
    os.remove('kosu_file_path.xlsx')



  # 工数データ削除
  if 'kosu_delete' in request.POST:
    # 日付指定空の場合の処理
    if request.POST['data_day'] in ["", None] or request.POST['data_day2'] in ["", None]:
      # エラーメッセージ出力
      messages.error(request, '削除する日付を指定してください。ERROR069')
      # このページをリダイレクト
      return redirect(to = '/administrator')

    # 削除開始日が終了日を超えている場合の処理
    if request.POST['data_day'] > request.POST['data_day2'] :
      # エラーメッセージ出力
      messages.error(request, '削除開始日が終了日を超えています。ERROR070')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # 工数データ取得
    kosu_obj = Business_Time_graph.objects.filter(work_day2__gte = request.POST['data_day'], work_day2__lte = request.POST['data_day2'])
    # 取得した工数データを削除
    kosu_obj.delete()



  # 人員情報バックアップ処理
  if 'member_backup' in request.POST:
    # 今日の日付取得
    today = datetime.date.today().strftime('%Y%m%d')
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    # 書き込みシート選択
    ws = wb.active
    # 人員データ取得
    member_data = member.objects.all()

    # Excelに書き込み(項目名)
    headers = [
        '従業員番号', 
        '氏名', 
        'ショップ', 
        '権限', 
        '管理者', 
        '1直昼休憩時間',
        '1直残業休憩時間1', 
        '1直残業休憩時間2', 
        '1直残業休憩時間3', 
        '2直昼休憩時間', 
        '2直残業休憩時間1',
        '2直残業休憩時間2', 
        '2直残業休憩時間3', 
        '3直昼休憩時間', 
        '3直残業休憩時間1', 
        '3直残業休憩時間2', 
        '3直残業休憩時間3', 
        '常昼昼休憩時間', 
        '常昼残業休憩時間1', 
        '常昼残業休憩時間2', 
        '常昼残業休憩時間3',
        'ポップアップ1',
        'ポップアップID1',
        'ポップアップ2',
        'ポップアップID2',
        'ポップアップ3',
        'ポップアップID3',
        'ポップアップ4',
        'ポップアップID4',
        'ポップアップ5',
        'ポップアップID6',
        '休憩エラー有効チェック',
        '工数定義区分予測無効',
        ]
    ws.append(headers)

    # Excelに書き込み(データ)
    for item in member_data:
      row = [
        item.employee_no, 
        item.name, 
        item.shop, 
        item.authority,
        item.administrator, 
        item.break_time1, 
        item.break_time1_over1, 
        item.break_time1_over2, 
        item.break_time1_over3, 
        item.break_time2, 
        item.break_time2_over1, 
        item.break_time2_over2, 
        item.break_time2_over3, 
        item.break_time3, 
        item.break_time3_over1, 
        item.break_time3_over2, 
        item.break_time3_over3, 
        item.break_time4, 
        item.break_time4_over1, 
        item.break_time4_over2, 
        item.break_time4_over3,
        item.pop_up1,
        item.pop_up_id1,
        item.pop_up2,
        item.pop_up_id2,
        item.pop_up3,
        item.pop_up_id3,
        item.pop_up4,
        item.pop_up_id4,
        item.pop_up5,
        item.pop_up_id5,
        item.break_check,
        item.def_prediction,
        ]
      ws.append(row)


    # メモリ上にExcelファイルを作成
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'人員データバックアップ_{today}.xlsx'

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



  # 人員情報読み込み
  if 'member_load' in request.POST:
    # 人員データファイルが未選択時の処理
    if 'member_file' not in request.FILES:
      # エラーメッセージ出力
      messages.error(request, '人員ファイルが選択されていません。ERROR071')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['member_file']


    # 一時的なファイルをサーバー上に作成
    with open('member_file_path.xlsx', 'wb+') as destination:
      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)

    # 指定Excelを開く
    wb = openpyxl.load_workbook('member_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]


    # 読み込むファイルが正しいファイルでない場合の処理
    if ws.cell(1, 1).value != '従業員番号' or ws.cell(1, 2).value != '氏名' or \
      ws.cell(1, 3).value != 'ショップ' or ws.cell(1, 4).value != '権限' or \
      ws.cell(1, 5).value != '管理者' or ws.cell(1, 6).value != '1直昼休憩時間' or \
      ws.cell(1, 7).value != '1直残業休憩時間1' or ws.cell(1, 8).value != '1直残業休憩時間2' or \
      ws.cell(1, 9).value != '1直残業休憩時間3' or ws.cell(1, 10).value != '2直昼休憩時間' or \
      ws.cell(1, 11).value != '2直残業休憩時間1' or ws.cell(1, 12).value != '2直残業休憩時間2' or \
      ws.cell(1, 13).value != '2直残業休憩時間3' or ws.cell(1, 14).value != '3直昼休憩時間' or \
      ws.cell(1, 15).value != '3直残業休憩時間1' or ws.cell(1, 16).value != '3直残業休憩時間2' or \
      ws.cell(1, 17).value != '3直残業休憩時間3' or ws.cell(1, 18).value != '常昼昼休憩時間' or \
      ws.cell(1, 19).value != '常昼残業休憩時間1' or ws.cell(1, 20).value != '常昼残業休憩時間2' or \
      ws.cell(1, 21).value != '常昼残業休憩時間3' or ws.cell(1, 22).value != 'ポップアップ1' or \
      ws.cell(1, 23).value != 'ポップアップID1' or ws.cell(1, 24).value != 'ポップアップ2' or \
      ws.cell(1, 25).value != 'ポップアップID2' or ws.cell(1, 26).value != 'ポップアップ3' or \
      ws.cell(1, 27).value != 'ポップアップID3' or ws.cell(1, 28).value != 'ポップアップ4' or \
      ws.cell(1, 29).value != 'ポップアップID4' or ws.cell(1, 30).value != 'ポップアップ5' or \
      ws.cell(1, 31).value != 'ポップアップID5' or ws.cell(1, 32).value != '休憩エラー有効チェック' or \
      ws.cell(1, 33).value != '工数定義区分予測無効':

      # エラーメッセージ出力
      messages.error(request, 'ロードしようとしたファイルは人員情報バックアップではありません。ERROR072')
      # このページをリダイレクト
      return redirect(to = '/administrator')

    # レコード数取得
    data_num = ws.max_row


    # Excelからデータを読み込むループ
    for i in range(1, data_num):
      # 読み込み予定データと同一の従業員番号のデータが存在するか確認
      member_data_filter = member.objects.filter(employee_no = ws.cell(row = i + 1, column = 1).value)

      # 上書きチェックONの場合の処理
      if ('overwrite_check' in request.POST):
        # 読み込み予定データと同一の従業員番号のデータが存在する場合の処理
        if member_data_filter.count() != 0:
          # 読み込み予定データと同一の従業員番号のデータを取得
          member_data_get = member.objects.get(employee_no = ws.cell(row = i + 1, column = 1).value)
          # 読み込み予定データと同一の従業員番号のデータを削除
          member_data_get.delete()

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

      # 上書きチェックOFFの場合の処理
      else:
        # 読み込み予定データと同一の従業員番号のデータが存在しない場合の処理
        if member_data_filter.count() == 0:
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



  # 班員情報バックアップ処理
  if 'team_backup' in request.POST:
    # 今日の日付取得
    today = datetime.date.today().strftime('%Y%m%d')
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    # 書き込みシート選択
    ws = wb.active
    # 班員データ取得
    team_data = team_member.objects.all()

    # Excelに書き込み(項目名)
    headers = [
        '従業員番号', 
        '班員1', 
        '班員2', 
        '班員3', 
        '班員4', 
        '班員5',
        '班員6', 
        '班員7', 
        '班員8', 
        '班員9', 
        '班員10',
        '班員11', 
        '班員12', 
        '班員13', 
        '班員14', 
        '班員15',
        'フォローON/OFF',
        ]
    ws.append(headers)

    # Excelに書き込み(データ)
    for item in team_data:
      row = [
        item.employee_no5, 
        item.member1, 
        item.member2, 
        item.member3, 
        item.member4, 
        item.member5, 
        item.member6, 
        item.member7, 
        item.member8, 
        item.member9, 
        item.member10,
        item.member11, 
        item.member12, 
        item.member13, 
        item.member14, 
        item.member15,
        item.follow, 
        ]
      ws.append(row)

    # メモリ上にExcelファイルを作成
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    # ファイル名を設定
    filename = f'班員データバックアップ_{today}.xlsx'
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



  # 班員情報読み込み
  if 'team_load' in request.POST:
    # 工数データファイルが未選択時の処理
    if 'team_file' not in request.FILES:
      # エラーメッセージ出力
      messages.error(request, '班員ファイルが選択されていません。ERROR073')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['team_file']

    # 一時的なファイルをサーバー上に作成
    with open('team_file_path.xlsx', 'wb+') as destination:

      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)

    # 指定Excelを開く
    wb = openpyxl.load_workbook('team_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]

    # 読み込むファイルが正しいファイルでない場合の処理
    if ws.cell(1, 1).value != '従業員番号' or ws.cell(1, 2).value != '班員1' or \
      ws.cell(1, 3).value != '班員2' or ws.cell(1, 4).value != '班員3' or \
      ws.cell(1, 5).value != '班員4' or ws.cell(1, 6).value != '班員5' or \
      ws.cell(1, 7).value != '班員6' or ws.cell(1, 8).value != '班員7' or \
      ws.cell(1, 9).value != '班員8' or ws.cell(1, 10).value != '班員9' or \
      ws.cell(1, 11).value != '班員10' or ws.cell(1, 12).value != '班員11' or \
      ws.cell(1, 13).value != '班員12' or ws.cell(1, 14).value != '班員13' or \
      ws.cell(1, 15).value != '班員14' or ws.cell(1, 16).value != '班員15' or \
      ws.cell(1, 17).value != 'フォローON/OFF':
      # エラーメッセージ出力
      messages.error(request, 'ロードしようとしたファイルは班員情報バックアップではありません。ERROR074')
      # このページをリダイレクト
      return redirect(to = '/administrator')

    # レコード数取得
    data_num = ws.max_row

    # Excelからデータを読み込むループ
    for i in range(1, data_num):
      # 読み込み予定データと同一の従業員番号のデータが存在するか確認
      team_data_filter = team_member.objects.filter(employee_no5 = ws.cell(row = i + 1, column = 1).value)

      # 読み込み予定データと同一の従業員番号のデータが存在する場合の処理
      if team_data_filter.count() != 0:
        # 読み込み予定データと同一の従業員番号のデータを取得
        team_data_get = team_member.objects.get(employee_no5 = ws.cell(row = i + 1, column = 1).value)
        # 読み込み予定データと同一の従業員番号のデータを削除
        team_data_get.delete()

      # Excelからデータ読み込み
      new_data = team_member(employee_no5 = ws.cell(row = i + 1, column = 1).value, \
                              member1 = ws.cell(row = i + 1, column = 2).value, \
                              member2 = ws.cell(row = i + 1, column = 3).value, \
                              member3 = ws.cell(row = i + 1, column = 4).value, \
                              member4 = ws.cell(row = i + 1, column = 5).value, \
                              member5 = ws.cell(row = i + 1, column = 6).value, \
                              member6 = ws.cell(row = i + 1, column = 7).value, \
                              member7 = ws.cell(row = i + 1, column = 8).value, \
                              member8 = ws.cell(row = i + 1, column = 9).value, \
                              member9 = ws.cell(row = i + 1, column = 10).value, \
                              member10 = ws.cell(row = i + 1, column = 11).value, \
                              member11 = ws.cell(row = i + 1, column = 12).value, \
                              member12 = ws.cell(row = i + 1, column = 13).value, \
                              member13 = ws.cell(row = i + 1, column = 14).value, \
                              member14 = ws.cell(row = i + 1, column = 15).value, \
                              member15 = ws.cell(row = i + 1, column = 16).value, \
                              follow = ws.cell(row = i + 1, column = 17).value, \
                              ) 

      new_data.save()

    # 一時ファイル削除
    os.remove('team_file_path.xlsx')



  # 工数区分定義バックアップ処理
  if 'def_backup' in request.POST:
    # 今日の日付取得
    today = datetime.date.today().strftime('%Y%m%d')
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    # 書き込みシート選択
    ws = wb.active

    # メンバーデータ取得
    def_data = kosu_division.objects.all()


    # Excelに書き込み(項目名)
    headers = ['工数区分定義Ver名'] + [item for i in range(1, 51) for item in [f'工数区分名{i}', f'定義{i}', f'作業内容{i}']]
    ws.append(headers)

    # Excelに書き込み(データ)
    for item in def_data:
      row = [item.kosu_name] + \
            [getattr(item, f'kosu_title_{i}') if j == 0 else getattr(item, f'kosu_division_{j}_{i}') 
            for i in range(1, 51) for j in range(0, 3)]
      ws.append(row)

    # メモリ上にExcelファイルを作成
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'工数定義区分データバックアップ_{today}.xlsx'

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



  # 工数区分定義読み込み
  if 'def_load' in request.POST:
    # 工数データファイルが未選択時、リダイレクト
    if 'def_file' not in request.FILES:
      messages.error(request, '工数区分定義ファイルが選択されていません。ERROR075')
      return redirect(to = '/administrator')


    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['def_file']
    # 一時的なファイルをサーバー上に作成
    with open('def_file_path.xlsx', 'wb+') as destination:

      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)

    # 指定Excelを開く
    wb = openpyxl.load_workbook('def_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]

    # 読み込むファイルが正しいファイルでない場合、リダイレクト
    expected_headers = [
      '工数区分定義Ver名', '工数区分名1', '定義1', '作業内容1','工数区分名2', '定義2', '作業内容2', 
      '工数区分名3', '定義3', '作業内容3', '工数区分名4', '定義4', '作業内容4', '工数区分名5', '定義5', '作業内容5',
      '工数区分名6', '定義6', '作業内容6', '工数区分名7', '定義7', '作業内容7', '工数区分名8', '定義8', '作業内容8',
      '工数区分名9', '定義9', '作業内容9', '工数区分名10', '定義10', '作業内容10', '工数区分名11', '定義11', '作業内容11',
      '工数区分名12', '定義12', '作業内容12', '工数区分名13', '定義13', '作業内容13', '工数区分名14', '定義14', '作業内容14',
      '工数区分名15', '定義15', '作業内容15', '工数区分名16', '定義16', '作業内容16', '工数区分名17', '定義17', '作業内容17',
      '工数区分名18', '定義18', '作業内容18', '工数区分名19', '定義19', '作業内容19', '工数区分名20', '定義20', '作業内容20',
      '工数区分名21', '定義21', '作業内容21', '工数区分名22', '定義22', '作業内容22', '工数区分名23', '定義23', '作業内容23',
      '工数区分名24', '定義24', '作業内容24', '工数区分名25', '定義25', '作業内容25', '工数区分名26', '定義26', '作業内容26',
      '工数区分名27', '定義27', '作業内容27', '工数区分名28', '定義28', '作業内容28', '工数区分名29', '定義29', '作業内容29',
      '工数区分名30', '定義30', '作業内容30', '工数区分名31', '定義31', '作業内容31', '工数区分名32', '定義32', '作業内容32',
      '工数区分名33', '定義33', '作業内容33', '工数区分名34', '定義34', '作業内容34', '工数区分名35', '定義35', '作業内容35',
      '工数区分名36', '定義36', '作業内容36', '工数区分名37', '定義37', '作業内容37', '工数区分名38', '定義38', '作業内容38',
      '工数区分名39', '定義39', '作業内容39', '工数区分名40', '定義40', '作業内容40', '工数区分名41', '定義41', '作業内容41',
      '工数区分名42', '定義42', '作業内容42', '工数区分名43', '定義43', '作業内容43', '工数区分名44', '定義44', '作業内容44',
      '工数区分名45', '定義45', '作業内容45', '工数区分名46', '定義46', '作業内容46', '工数区分名47', '定義47', '作業内容47',
      '工数区分名48', '定義48', '作業内容48', '工数区分名49', '定義49', '作業内容49', '工数区分名50', '定義50', '作業内容50',
      ]

    actual_headers = [ws.cell(1, col).value for col in range(1, len(expected_headers) + 1)]

    if actual_headers != expected_headers:
      messages.error(request, 'ロードしようとしたファイルは工数区分定義情報バックアップではありません。ERROR076')
      return redirect(to='/administrator')


    # レコード数取得
    data_num = ws.max_row
    # Excelからデータを読み込むループ
    for i in range(1, data_num):
      # 読み込み予定データと同一の定義の名前のデータが存在するか確認
      def_data_filter = kosu_division.objects.filter(kosu_name = ws.cell(row = i + 1, column = 1).value)
      # 読み込み予定データと同一の定義の名前のデータが存在する場合の処理
      if def_data_filter.count() != 0:
        # 読み込み予定データと同一の定義の名前のデータを取得
        def_data_get = kosu_division.objects.get(kosu_name = ws.cell(row = i + 1, column = 1).value)
        # 読み込み予定データと同一の定義の名前のデータを削除
        def_data_get.delete()

      # Excelからデータを読み込む
      def_data = {
        'kosu_name': ws.cell(row=i+1, column=1).value
        }
      for n in range(1, 51):
        def_data[f'kosu_title_{n}'] = ws.cell(row=i+1, column=n*3-1).value
        def_data[f'kosu_division_1_{n}'] = ws.cell(row=i+1, column=n*3).value
        def_data[f'kosu_division_2_{n}'] = ws.cell(row=i+1, column=n*3+1).value

      new_data = kosu_division(**def_data)
      new_data.save()

    # 一時ファイル削除
    os.remove('def_file_path.xlsx')



  # お問い合わせバックアップ処理
  if 'inquiry_backup' in request.POST:
    # 今日の日付取得
    today = datetime.date.today().strftime('%Y%m%d')
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    # 書き込みシート選択
    ws = wb.active
    # お問い合わせデータ取得
    data = inquiry_data.objects.all()

    # Excelに書き込み(項目名)
    headers = [
        '従業員番号', 
        '氏名', 
        '内容選択', 
        '問い合わせ', 
        '回答'
        ]
    ws.append(headers)


    # Excelに書き込み(データ)
    for item in data:
      row = [
        item.employee_no2, 
        str(item.name), 
        item.content_choice, 
        item.inquiry, item.answer
        ]
      ws.append(row)

    # メモリ上にExcelファイルを作成
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'お問い合わせデータバックアップ_{today}.xlsx'

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



  # お問い合わせ読み込み
  if 'inquiry_load' in request.POST:
    # 工数データファイルが未選択時の処理
    if 'inquiry_file' not in request.FILES:
      # エラーメッセージ出力
      messages.error(request, 'お問い合わせファイルが選択されていません。ERROR077')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['inquiry_file']
    # 一時的なファイルをサーバー上に作成
    with open('inquiry_file_path.xlsx', 'wb+') as destination:
      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)
  
    # 指定Excelを開く
    wb = openpyxl.load_workbook('inquiry_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]


    # 読み込むファイルが正しいファイルでない場合の処理
    if ws.cell(1, 1).value != '従業員番号' or ws.cell(1, 2).value != '氏名' or \
      ws.cell(1, 3).value != '内容選択' or ws.cell(1, 4).value != '問い合わせ' or \
      ws.cell(1, 5).value != '回答':
      # エラーメッセージ出力
      messages.error(request, 'ロードしようとしたファイルはお問い合わせ情報バックアップではありません。ERROR078')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # レコード数取得
    data_num = ws.max_row
    # 全てのお問い合わせデータを取得
    inquiry_data_get = inquiry_data.objects.all()
    # 読お問い合わせデータを削除
    inquiry_data_get.delete()


    # Excelからデータを読み込むループ
    for i in range(1, data_num):
      # 人員データインスタンス取得
      member_instance = member.objects.get(name = ws.cell(row = i + 1, column = 2).value)
      # Excelからデータを読み込む
      new_data = inquiry_data(employee_no2 = ws.cell(row = i + 1, column = 1).value, \
                              name = member_instance, \
                              content_choice = ws.cell(row = i + 1, column = 3).value, \
                              inquiry = ws.cell(row = i + 1, column = 4).value, \
                              answer = ws.cell(row = i + 1, column = 5).value)

      new_data.save()

    # 一時ファイル削除
    os.remove('inquiry_file_path.xlsx')



  # 設定情報バックアップ処理
  if 'setting_backup' in request.POST:
    # 今日の日付取得
    today = today = datetime.date.today().strftime('%Y%m%d')
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    # 書き込みシート選択
    ws = wb.active

    # 設定データ取得
    setting_data = administrator_data.objects.all()

    # Excelに書き込み(項目名)
    headers = [
        '一覧表示項目数', 
        '問い合わせ担当者従業員番号1',
        '問い合わせ担当者従業員番号2',
        '問い合わせ担当者従業員番号3',
        'ポップアップ1',
        'ポップアップID1',
        'ポップアップ2',
        'ポップアップID2',
        'ポップアップ3',
        'ポップアップID3',
        'ポップアップ4',
        'ポップアップID4',
        'ポップアップ5',
        'ポップアップID6',
        ]
    ws.append(headers)


    # Excelに書き込み(データ)
    for item in setting_data:
      row = [
        item.menu_row,
        item.administrator_employee_no1,
        item.administrator_employee_no2,
        item.administrator_employee_no3,
        item.pop_up1,
        item.pop_up_id1,
        item.pop_up2,
        item.pop_up_id2,
        item.pop_up3,
        item.pop_up_id3,
        item.pop_up4,
        item.pop_up_id4,
        item.pop_up5,
        item.pop_up_id5,
        ]
      ws.append(row)


    # メモリ上にExcelファイルを作成
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'管理者設定_{today}.xlsx'

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



  # 設定情報読み込み
  if 'setting_load' in request.POST:
    # 工数データファイルが未選択時の処理
    if 'setting_file' not in request.FILES:
      # エラーメッセージ出力
      messages.error(request, '管理者設定ファイルが選択されていません。ERROR079')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # POSTされたファイルパスを変数に入れる
    file_path = request.FILES['setting_file']


    # 一時的なファイルをサーバー上に作成
    with open('setting_file_path.xlsx', 'wb+') as destination:

      # アップロードしたファイルを一時ファイルに書き込み
      for chunk in file_path.chunks():
        destination.write(chunk)

    # 指定Excelを開く
    wb = openpyxl.load_workbook('setting_file_path.xlsx')
    # 書き込みシート選択
    ws = wb.worksheets[0]


    # 読み込むファイルが正しいファイルでない場合の処理
    if ws.cell(1, 1).value != '一覧表示項目数' or ws.cell(1, 2).value != '問い合わせ担当者従業員番号1' or \
      ws.cell(1, 3).value != '問い合わせ担当者従業員番号2' or ws.cell(1, 4).value != '問い合わせ担当者従業員番号3' or \
      ws.cell(1, 5).value != 'ポップアップ1' or ws.cell(1, 6).value != 'ポップアップID1' or \
      ws.cell(1, 7).value != 'ポップアップ2' or ws.cell(1, 8).value != 'ポップアップID2' or \
      ws.cell(1, 9).value != 'ポップアップ3' or ws.cell(1, 10).value != 'ポップアップID3' or \
      ws.cell(1, 11).value != 'ポップアップ4' or ws.cell(1, 12).value != 'ポップアップID4' or \
      ws.cell(1, 13).value != 'ポップアップ5' or ws.cell(1, 14).value != 'ポップアップID5':
      # エラーメッセージ出力
      messages.error(request, 'ロードしようとしたファイルは設定情報バックアップではありません。ERROR080')
      # このページをリダイレクト
      return redirect(to = '/administrator')


    # レコード数取得
    data_num = ws.max_row


    # 管理者設定データにレコードがある場合の処理
    if administrator_data.objects.exists():
      # 管理者設定データ取得
      setting_obj_get = administrator_data.objects.all()
      # 取得した管理者設定データを消す
      setting_obj_get.delete()


    # Excelからデータを読み込むループ
    for i in range(1, data_num):
      # Excelからデータを読み込み
      new_data = administrator_data(menu_row = ws.cell(row = i + 1, column = 1).value, \
                                    administrator_employee_no1 = ws.cell(row = i + 1, column = 2).value, \
                                    administrator_employee_no2 = ws.cell(row = i + 1, column = 3).value, \
                                    administrator_employee_no3 = ws.cell(row = i + 1, column = 4).value, \
                                    pop_up1 = ws.cell(row = i + 1, column = 5).value, \
                                    pop_up_id1 = ws.cell(row = i + 1, column = 6).value, \
                                    pop_up2 = ws.cell(row = i + 1, column = 7).value, \
                                    pop_up_id2 = ws.cell(row = i + 1, column = 8).value, \
                                    pop_up3 = ws.cell(row = i + 1, column = 9).value, \
                                    pop_up_id3 = ws.cell(row = i + 1, column = 10).value, \
                                    pop_up4 = ws.cell(row = i + 1, column = 11).value, \
                                    pop_up_id4 = ws.cell(row = i + 1, column = 12).value, \
                                    pop_up5 = ws.cell(row = i + 1, column = 13).value, \
                                    pop_up_id5 = ws.cell(row = i + 1, column = 14).value)
      new_data.save()

    # 一時ファイル削除
    os.remove('member_file_path.xlsx')


    # このページを読み直す
    return redirect(to = '/administrator')



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

