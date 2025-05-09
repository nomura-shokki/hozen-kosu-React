from django.shortcuts import redirect, render
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.http import HttpResponseRedirect, JsonResponse
from django.views import View
from django.views.generic import ListView
from django.views.generic.edit import FormView
from django.views.generic.base import TemplateView
from ..utils.kosu_utils import handle_get_request
from ..utils.kosu_utils import index_change
from ..utils.kosu_utils import create_kosu
from ..utils.kosu_utils import get_member
from ..utils.kosu_utils import get_def_library_data
from ..utils.kosu_utils import kosu_sort
from ..utils.kosu_utils import default_work_time
from ..utils.kosu_utils import get_indices
from ..utils.team_utils import excel_function
from ..utils.team_utils import team_member_name_get
from ..utils.team_utils import day_get
from dateutil.relativedelta import relativedelta
from io import BytesIO
import datetime
import openpyxl
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
class TeamView(FormView):
    # テンプレート,フォーム,リダイレクト先定義
  template_name = 'kosu/team.html'
  form_class = teamForm
  success_url = '/team_main'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    data = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(data, HttpResponseRedirect):
      return data
    self.data = data

    # 権限なければメイン画面へ
    if not data.authority:
      return redirect(to='/')

    return super().dispatch(request, *args, **kwargs)


  # 初期データを設定
  def get_initial(self):
    initial_data = {
      'shop': self.request.session.get('shop_choose', ''),
      'shop2': self.request.session.get('shop_choose2', '')
      }

    # 班員データある場合初期値定義
    obj = getattr(self, 'obj', None)
    if obj:
      # 既存の班員登録がある場合、そのデータを初期値に設定する
      initial_data.update({
        'follow': obj.follow,
        'member1': obj.member1,
        'member2': obj.member2,
        'member3': obj.member3,
        'member4': obj.member4,
        'member5': obj.member5,
        'member6': obj.member6,
        'member7': obj.member7,
        'member8': obj.member8,
        'member9': obj.member9,
        'member10': obj.member10,
        'member11': obj.member11,
        'member12': obj.member12,
        'member13': obj.member13,
        'member14': obj.member14,
        'member15': obj.member15
        })
    return initial_data


  # フォーム定義
  def get_form(self, form_class=None):
    form = super().get_form(form_class)
    member_obj = self.get_member_queryset()

    # 班員選択肢を設定
    choices_list = [('', '')]
    choices_list.extend([(i.employee_no, str(i.name)) for i in member_obj])
    for field in ['member1', 'member2', 'member3', 'member4', 'member5',
                  'member6', 'member7', 'member8', 'member9', 'member10',
                  'member11', 'member12', 'member13', 'member14', 'member15']:
      form.fields[field].choices = choices_list

    return form


  # 班員選択肢絞り込み管薄(自身組長の場合)
  def get_member_queryset(self):
    # ログイン者が組長以上の場合、セッションの絞り込み条件に応じて選択肢を絞り込む
    if self.data.shop in ['組長以上(P,R,T,その他)', '組長以上(W,A)']:
      shop1 = self.request.session.get('shop_choose', None)
      shop2 = self.request.session.get('shop_choose2', None)

      if shop1 and not shop2:
        return member.objects.filter(shop=shop1).order_by('employee_no')
      elif shop2 and not shop1:
        return member.objects.filter(shop=shop2).order_by('employee_no')
      elif shop1 and shop2:
        return member.objects.filter(Q(shop=shop1) | Q(shop=shop2)).order_by('employee_no')

      return member.objects.all().order_by('employee_no')

    # 組長以上でない場合、自分と同じショップの人員に絞り込み
    else:
      return member.objects.filter(shop=self.data.shop).order_by('employee_no')


  # フォームが有効な場合の処理
  def form_valid(self, form):
    # ショップ絞り込み時の処理
    if "shop_choice" in self.request.POST:
      # ショップ絞り込み条件をセッションに保存後、リダイレクト
      self.request.session['shop_choose'] = self.request.POST.get('shop')
      self.request.session['shop_choose2'] = self.request.POST.get('shop2')
      return redirect('/team')

    # 班員登録を更新
    team_member.objects.update_or_create(
      employee_no5=self.request.session['login_No'],
      defaults={
        'follow': 'follow' in self.request.POST,
        **{f'member{i}': form.cleaned_data[f'member{i}'] for i in range(1, 16)}
        })

    return super().form_valid(form)


  # GET時の処理
  def get(self, request, *args, **kwargs):
    # ログイン者の班員登録がある場合、そのオブジェクトを取得
    self.obj = team_member.objects.filter(employee_no5=request.session['login_No']).first()
    return super().get(request, *args, **kwargs)


  # POST時の処理
  def post(self, request, *args, **kwargs):
    # ログイン者の班員登録がある場合、そのオブジェクトを取得
    self.obj = team_member.objects.filter(employee_no5=request.session['login_No']).first()

    # ショップ絞り込み時は再度このページにリダイレクト
    if "shop_choice" in self.request.POST:
      self.request.session['shop_choose'] = self.request.POST.get('shop')
      self.request.session['shop_choose2'] = self.request.POST.get('shop2')
      return redirect('/team')

    return super().post(request, *args, **kwargs)


  # HTMLに渡す辞書を設定
  def render_to_response(self, context, **response_kwargs):
    context.update({
      'title': '班員設定',
      'data': self.data
      })
    return super().render_to_response(context, **response_kwargs)





#--------------------------------------------------------------------------------------------------------





# 班員工数グラフ確認画面定義
class TeamGraphView(TemplateView):
  # テンプレート定義
  template_name = 'kosu/team_graph.html'


  # GET時の処理
  def get(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj

    # 権限なければメイン画面へ
    if not member_obj.authority:
      return redirect(to='/')

    # 班員登録なければ班員MENUへ
    data = team_member.objects.filter(employee_no5=request.session['login_No'])
    if not data.exists():
      return redirect(to='/team_main')

    # 今日の日付取得
    dt = datetime.date.today()
    return self._render_context(request, dt)


  # POST時の処理
  def post(self, request, *args, **kwargs):
    # 日付指定ない場合、リダイレクト
    if 'team_day' not in request.POST or request.POST['team_day'] in ["", None]:
      messages.error(request, '日付を指定してから検索して下さい。ERROR43')
      return redirect('/team_graph')

    # POSTされた日付取得
    dt = request.POST['team_day']
    return self._render_context(request, dt)


  # コンテキスト構築処理
  def _render_context(self, request, dt):
    # フォームの初期状態定義
    default_day = str(dt)
    form = team_kosuForm()
    
    # 班員取得
    obj = team_member.objects.get(employee_no5=request.session['login_No'])

    # 班員の従業員番号を定義
    for i in range(1, 16):
      if eval(f'obj.member{i}') in ["", None]:
        exec(f'obj_member{i}=0')
      else:
        exec(f'obj_member{i}=obj.member{i}')

    # 班員の名前リスト、従業員番号リスト作成
    n = 0
    name_list = []
    employee_no_list = []

    for i in range(1, 16):
      member_filter = member.objects.filter(employee_no=eval(f'obj_member{i}'))
      if member_filter.count() != 0:
        member_data = member.objects.get(employee_no=eval(f'obj_member{i}'))
        name_list.append(member_data.name)
        employee_no_list.append(member_data)
    n = len(name_list)

    # 工数表示グラフの要素リスト、ラベル作成
    graph_list = [[] for _ in range(15)]
    graph_item = [[] for _ in range(15)]
    for i in range(n):
      graph_item[i], graph_list[i] = handle_get_request(dt, employee_no_list[i])

    # 工数区分定義取得
    graph_kosu_list, def_n = get_def_library_data(request.session['input_def'])

    # HTMLへ送るコンテキスト定義
    context = {
      'title': '班員工数グラフ',
      'form': form,
      'default_day': default_day,
      'name_list': name_list,
      'n': n,
      'graph_kosu_list': graph_kosu_list,
      'def_n': def_n,
      }
    # コンテキストにグラフ情報追加
    for i in range(15):
      context[f'graph_list{i+1}'] = graph_list[i]
      context[f'graph_item{i+1}'] = graph_item[i]

    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 班員工数確認画面定義
class TeamKosuListView(ListView):
  # テンプレート,オブジェクト名定義
  template_name = 'kosu/team_kosu.html'
  context_object_name = 'obj'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # 権限なければメイン画面へ
    if not member_obj.authority:
      return redirect(to='/')

    # 班員登録無ければ班員MENUへ
    if not team_member.objects.filter(employee_no5=request.session['login_No']).exists():
      return redirect(to='/team_main')

    # このページにいたことを保存
    self.request.session['before_page'] = 'team_list'
    return super().dispatch(request, *args, **kwargs)


  # 班員リストと選択肢リスト作成関数
  def get_filtered_choices(self):
    # 班員情報取得
    form_choices = team_member.objects.get(employee_no5=self.request.session['login_No'])
    # 班員リスト、選択肢リスト作成
    filtered_list = []
    choices_list = [['', '']]
    for i in range(1, 16):
      member_code = getattr(form_choices, f'member{i}', '')
      # 班員登録ある場合の処理
      if member_code:
        # 人員情報確認
        obj_filter = member.objects.filter(employee_no=member_code)
        # 人員登録がある場合の処理
        if obj_filter.exists():
          # 人員情報取得
          obj_get = obj_filter.first()
          # リストに要素追加
          filtered_list.append(obj_get.employee_no)
          choices_list.append([obj_get.employee_no, obj_get.name])

    return filtered_list, choices_list


  # フィルタリング内容決定関数
  def build_filters(self, filtered_list):
    # POST値取得
    find = self.request.POST.get('employee_no6') if self.request.method == 'POST' else self.request.session.get('find_employee_no2', '')
    find2 = self.request.POST.get('team_day') if self.request.method == 'POST' else self.request.session.get('find_team_day', '')

    # セッション更新 (POST時のみ)
    if self.request.method == 'POST':
      self.request.session['find_employee_no2'] = find
      self.request.session['find_team_day'] = find2
    # フィルタリング内容設定
    filters = {'employee_no3__in': filtered_list}
    if find:
      filters['employee_no3__icontains'] = find
    if find2:
      filters['work_day2__contains'] = find2

    return filters


  # フィルタリングされたデータ取得
  def get_queryset(self):
    # 今日の日時
    dt = datetime.date.today()

    # フィルタリング用データ作成
    filtered_list, choices_list = self.get_filtered_choices()
    # フィルターとクエリセット取得
    filters = self.build_filters(filtered_list)
    obj = Business_Time_graph.objects.filter(**filters).order_by('work_day2').reverse()

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      page_num = administrator_data(menu_row=20).menu_row
    else:
      page_num = last_record.menu_row

    # ページネーション
    paginator = Paginator(obj, page_num)

    # フォーム準備
    form = team_kosuForm({'employee_no6': self.request.session.get('find_employee_no2', '')})
    form.fields['employee_no6'].choices = choices_list

    # HTMLに送るデータを設定
    self.extra_context = {
      'title': '班員工数確認',
      'data': self.member_obj,
      'form': form,
      'default_day': self.request.session.get('find_team_day', str(dt)),
      'num': self.kwargs.get('num'),
      'obj': paginator.get_page(self.kwargs.get('num')),
      }

    return obj



  # POST時の処理(GETと同じ処理をする)
  def post(self, request, *args, **kwargs):
    return super().get(request, *args, **kwargs)





#--------------------------------------------------------------------------------------------------------





# 班員工数入力詳細画面定義
class TeamDetailView(TemplateView):
  # テンプレート定義
  template_name = 'kosu/team_detail.html'


  # HTMLへ送るデータオーバーライド
  def get_context_data(self, request, **kwargs):
    # num パラメータを取得
    num = kwargs.get('num')

    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # 権限なければメイン画面へ
    if not member_obj.authority:
      return redirect(to='/')

    # 班員登録無ければ班員MENUへ
    if not team_member.objects.filter(employee_no5=request.session['login_No']).exists():
      return redirect(to='/team_main')


    # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
    obj_get = Business_Time_graph.objects.get(id=num)

    # 人員名取得
    name_obj_get = member.objects.get(employee_no=obj_get.employee_no3)
    # 作業内容と作業詳細を直に合わせて調整
    work_list, detail_list = kosu_sort(obj_get, name_obj_get)

    # HTML表示用リスト作成
    time_display_list = create_kosu(work_list, detail_list, obj_get, name_obj_get, self.request)

    # 工数合計取得
    time_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 基準合計工数取得
    default_total = default_work_time(obj_get, name_obj_get)

    # HTMLに渡す辞書
    context = {
      'title': '工数詳細',
      'id': num,
      'obj_get': obj_get,
      'time_display_list': time_display_list,
      'time_total': time_total,
      'default_total': default_total,
      'before_page': self.request.session['before_page'],
    }

    return context


  # getメソッドをオーバライドして権限やロジックチェックを行う
  def get(self, request, *args, **kwargs):
    context = self.get_context_data(request=self.request, **kwargs)
    # Redirectオブジェクトが返ってきた場合はそのまま返す
    if isinstance(context, HttpResponseRedirect):
      return context
    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 班員工数入力状況一覧画面定義
class TeamCalendarView(View):
  # テンプレート定義
  template_name = 'kosu/team_calendar.html'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得,人員情報なしor未ログインの場合ログイン画面へ
    member_obj = get_member(request)
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # 権限なければメイン画面へ
    if not member_obj.authority:
      return redirect(to='/')

    # 班員登録無ければ班員MENUへ
    if not team_member.objects.filter(employee_no5=request.session['login_No']).exists():
      return redirect(to='/team_main')
    return super().dispatch(request, *args, **kwargs)


  # getメソッドをオーバライド
  def get(self, request, *args, **kwargs):
    # 指定日取得
    today = day_get(request)
    # get時のコンテキスト生成
    context = self.build_context(request, today)
    return render(request, self.template_name, context)


  # postメソッドをオーバライド
  def post(self, request, *args, **kwargs):
    # 日付指定時の処理
    if "display_day" in request.POST:
      # POSTされた値を日付に設定,日付を記録
      today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')
      request.session['display_day'] = request.POST['work_day']

    # 前週指定時の処理
    elif "back_week" in request.POST:
      today = self.handle_back_week(request)

    # 次週指定時の処理
    elif "next_week" in request.POST:
      today = self.handle_next_week(request)

    # 入力状況をExcelに出力する際の処理
    elif "export" in request.POST:
      return self.handle_export(request)

    # POSTされていないときの処理
    else:
      today = day_get(request)

    # post時のコンテキスト生成
    context = self.build_context(request, today)
    return render(request, self.template_name, context)


  # 前週表示関数
  def handle_back_week(self, request):
    # 指定日の曜日取得
    today = day_get(request)
    week_day_back = today.weekday()
    # 減算する日数を計算
    days_to_subtract = 1 if week_day_back == 6 else week_day_back + 2
    today -= datetime.timedelta(days=days_to_subtract)

    # 前の週が月をまたぐ場合、前月の最終日取得
    if today.month != datetime.datetime.strptime(request.session['display_day'], '%Y-%m-%d').month:
      today = datetime.datetime(today.year, today.month, 1) + relativedelta(months=1) - relativedelta(days=1)

    # 取得した値を記録
    request.session['display_day'] = str(today)[0:10]
    return today


  # 次週表示関数
  def handle_next_week(self, request):
    # 指定日の曜日取得
    today = day_get(request)
    week_day_back = today.weekday()
    # 加算する日数を計算
    days_to_subtract = 7 if week_day_back == 6 else 6 - week_day_back
    today += datetime.timedelta(days=days_to_subtract)

    # 次の週が月をまたぐ場合、次の月の初日取得
    if today.month != datetime.datetime.strptime(request.session['display_day'], '%Y-%m-%d').month:
      today = datetime.datetime(today.year, today.month, 1)

    # 取得した値を記録
    request.session['display_day'] = str(today)[0:10]
    return today


  # 工数入力状況出力関数
  def handle_export(self, request):
    # 指定日の年,月取得し記録
    today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')
    year, month = today.year, today.month
    request.session['display_day'] = request.POST['work_day']

    # 新しいExcelブック作成
    wb = openpyxl.Workbook()

    # 班員データ取得
    team_obj = team_member.objects.get(employee_no5=request.session['login_No'])

    # 班員リスト作成
    for i in range(1, 16):
      if eval(f'team_obj.member{i}') in ["", None]:
        exec(f'team_obj_member{i}=0')
      else:
        exec(f'team_obj_member{i}=team_obj.member{i}')

    employee_no_list = [team_obj_member for team_obj_member in [
      team_obj.member1, team_obj.member2, team_obj.member3, team_obj.member4, team_obj.member5,
      team_obj.member6, team_obj.member7, team_obj.member8, team_obj.member9, team_obj.member10,
      team_obj.member11, team_obj.member12, team_obj.member13, team_obj.member14, team_obj.member15
    ] if team_obj_member]

    # 班員毎にExcelに書き込み
    for ind, employee_no_num in enumerate(employee_no_list):
      exec(f'time_display_list{ind + 1}=excel_function(employee_no_num, wb, request)')
    # 不要なシート削除
    del wb['Sheet']

    # メモリ上にExcelファイルを作成し、BytesIOオブジェクトに保存
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # URLエンコーディングされたファイル名を生成
    filename = f'班員の{year}年{month}月度業務工数入力状況.xlsx'
    quoted_filename = urllib.parse.quote(filename)

    # HttpResponseを作成してファイルをダウンロードさせる
    response = HttpResponse(
      excel_file.read(),
      content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    # Content-Dispositionヘッダーを設定
    response['Content-Disposition'] = f'attachment; filename*=UTF-8\'\'{quoted_filename}'
    return response


  # コンテキスト生成
  def build_context(self, request, today):
    # 表示日の月を取得
    month = today.month
    week_day = today.weekday()
    default_day = str(today)

    # 日付リスト
    days_to_sum = week_day + 1 if week_day != 6 else 0
    day_list = [(today + datetime.timedelta(days=d - days_to_sum)) for d in range(7)]

    # 日付リスト整形(指定月とリスト内の要素の月が違う要素は空に)
    for ind, dd in enumerate(day_list):
      if month != dd.month:
        day_list[ind] = ''

    # ログイン者の班員リスト作成
    obj_get = team_member.objects.get(employee_no5=request.session['login_No'])
    member_list = [getattr(obj_get, f'member{i}') for i in range(1, 16)]
    # 登録されている最後のメンバー番号を取得
    member_num = max((i for i in range(1, 16) if getattr(obj_get, f'member{i}') != ''), default=None)

    # 各班員の空リスト定義
    work_lists = [[] for _ in range(15)]
    over_time_lists = [[] for _ in range(15)]
    kosu_lists = [[] for _ in range(15)]
    ok_ng_lists = [[] for _ in range(15)]

    # メンバー名取得
    member_names = [
      team_member_name_get(getattr(obj_get, f'member{i}')) for i in range(1, 16)
    ]

    # 各表示用リスト作成
    for ind, m in enumerate(member_list):
      if m not in ['', None]:
        for dd in day_list:
          if dd != '':
            member_obj_filter = Business_Time_graph.objects.filter(employee_no3=m, work_day2=dd)

            # 指定日に班員の工数データがある場合の処理
            if member_obj_filter.exists():
              member_obj_get = member_obj_filter.first()
              # 勤務,残業,整合性追加
              work_lists[ind].append(member_obj_get.work_time)
              over_time_lists[ind].append(member_obj_get.over_time)
              ok_ng_lists[ind].append(member_obj_get.judgement)

              # 入力工数が空の場合、時間表示に空を定義
              if member_obj_get.time_work == '#'*288:
                kosu_lists[ind].append(["　　　　　" for _ in range(4)])
              # 入力工数がある場合、入力時間をリストに入れる
              else:
                kosu_list = []
                data_list = list(member_obj_get.time_work)
                indices = get_indices(data_list)
                for start, end in indices:
                  kosu_list = index_change(start, end, kosu_list)
                kosu_list += ['　'] * (4 - len(kosu_list))
                kosu_lists[ind].append(kosu_list)
            # 指定日に班員の工数データがない場合、全て空を入れる
            else:
              work_lists[ind].append("")
              over_time_lists[ind].append("")
              ok_ng_lists[ind].append(False)
              kosu_lists[ind].append(["　　　　　" for _ in range(4)])
          # 日付リストに日付ない場合、全てに空を入れる
          else:
            work_lists[ind].append("")
            over_time_lists[ind].append("")
            ok_ng_lists[ind].append(False)
            kosu_lists[ind].append(["　　　　　" for _ in range(4)])
      # 班員の登録に空きがある場合、全てに空を入れる
      else:
        for _ in range(7):
          work_lists[ind].append("")
          over_time_lists[ind].append("")
          ok_ng_lists[ind].append(False)
          kosu_lists[ind].append(["　　　　　" for _ in range(4)])

    # 整合性リスト反転(HTMLでwith～.pop使用のため)
    for ok_ng_list in ok_ng_lists:
      ok_ng_list.reverse()

    # コンテキスト定義
    context = {
      'title': '班員工数入力状況一覧',
      'default_day': default_day,
      'member_num': member_num,
      'day_list': day_list,
    }

    # 各班員の表示内容をコンテキストに追加
    for i in range(1, 16):
        context.update({
          f'member_name{i}': member_names[i - 1],
          f'work_list{i}': work_lists[i - 1],
          f'over_time_list{i}': over_time_lists[i - 1],
          f'kosu_list{i}': kosu_lists[i - 1],
          f'ok_ng_list{i}': ok_ng_lists[i - 1],
        })

    return context





#--------------------------------------------------------------------------------------------------------





# 班員残業一覧画面定義
def team_over_time(request):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to='/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to='/login') 

  # ログイン者に権限がなければメインページに戻る
  if data.authority == False:
    return redirect(to='/')

  # ログイン者の班員登録情報あるか確認
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to='/team_main')


  # ログイン者の班員登録情報取得
  team_get = team_member.objects.get(employee_no5 = request.session['login_No'])

  member1_obj_get = team_member_name_get(team_get.member1)
  member2_obj_get = team_member_name_get(team_get.member2)
  member3_obj_get = team_member_name_get(team_get.member3)
  member4_obj_get = team_member_name_get(team_get.member4)
  member5_obj_get = team_member_name_get(team_get.member5)
  member6_obj_get = team_member_name_get(team_get.member6)
  member7_obj_get = team_member_name_get(team_get.member7)
  member8_obj_get = team_member_name_get(team_get.member8)
  member9_obj_get = team_member_name_get(team_get.member9)
  member10_obj_get = team_member_name_get(team_get.member10)
  member11_obj_get = team_member_name_get(team_get.member11)
  member12_obj_get = team_member_name_get(team_get.member12)
  member13_obj_get = team_member_name_get(team_get.member13)
  member14_obj_get = team_member_name_get(team_get.member14)
  member15_obj_get = team_member_name_get(team_get.member15)

  # 班員リストリセット
  member_list = []
  # 選択肢の表示数検出&班員リスト作成
  for i in range(1, 16):
    # 人員情報ある場合の処理
    if eval(f'member{i}_obj_get') != '':
      # 班員リストに班員追加
      member_list.append(eval(f'member{i}_obj_get'))
    


  # POST時の処理
  if (request.method == 'POST'):
    # 検索項目に空欄がある場合の処理
    if request.POST['year'] in ["", None] or request.POST['month'] in ["", None]:
      # エラーメッセージ出力
      messages.error(request, '表示年月に未入力箇所があります。ERROR044')
      # このページをリダイレクト
      return redirect(to='/class_list')
    

    # フォームの初期値定義
    schedule_default = {'year': request.POST['year'], 
                        'month': request.POST['month']}
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
    schedule_default = {'year': str(year), 
                        'month': str(month)}
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
    eval(f'over_time_list{ind + 1}.append(m.name)')

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
        eval(f'over_time_list{ind + 1}.append(obj_get)')

        # 残業を合計する
        over_time_total += float(obj_get.over_time)

      # 該当日に工数データがない場合の処理
      else:
        # 残業リストに残業0と整合性否を追加
        eval(f'over_time_list{ind + 1}.append(Business_Time_graph(over_time = 0, judgement = False))')

    # リストに残業合計追加
    eval(f'over_time_list{ind + 1}.append(over_time_total)')
    eval(f'over_time_list{ind + 1}.insert(1,{over_time_total})')



  # HTMLに渡す辞書
  context = {
    'title': '班員残業管理',
    'form': form,
    'day_list': zip(range(1, last_day_of_month.day + 1), week_list), 
    'week_list': week_list,
    'over_time_list1': over_time_list1,
    'over_time_list2': over_time_list2,
    'over_time_list3': over_time_list3,
    'over_time_list4': over_time_list4,
    'over_time_list5': over_time_list5,
    'over_time_list6': over_time_list6,
    'over_time_list7': over_time_list7,
    'over_time_list8': over_time_list8,
    'over_time_list9': over_time_list9,
    'over_time_list10': over_time_list10,
    'over_time_list11': over_time_list11,
    'over_time_list12': over_time_list12,
    'over_time_list13': over_time_list13,
    'over_time_list14': over_time_list14,
    'over_time_list15': over_time_list15,
    'team_n': len(member_list),
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_over_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数入力可否(ショップ単位)画面定義
class ClassList(FormView):
  # 使用テンプレート,フォームの定義
  template_name = 'kosu/class_list.html'
  form_class = member_findForm
  extra_form_class = schedule_timeForm


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # 権限なければメイン画面へ
    if not member_obj.authority:
      return redirect(to='/')

    # 班員登録無ければ班員MENUへ
    if not team_member.objects.filter(employee_no5=request.session['login_No']).exists():
      return redirect(to='/team_main')

    # このページにいたことを保存
    self.request.session['before_page'] = 'class_list'
    return super().dispatch(request, *args, **kwargs)


  # フォーム初期値オーバーライド
  def get_form_kwargs(self):
    kwargs = super().get_form_kwargs()
    # ショップ選択初期値定義
    shop_default = {'shop2': self.request.session.get('find_shop', self.member_obj.shop)}

    # 年月デフォルト値を定義
    if self.request.session.get('find_year', '') == '' or self.request.session.get('find_month', '') == '':
      year = datetime.date.today().year
      month = datetime.date.today().month
    else:
      year = self.request.session['find_year']
      month = self.request.session['find_month']

    schedule_default = {'year': year, 'month': month}
    kwargs['initial'] = shop_default
    self.extra_initial = schedule_default
    return kwargs


  # コンテキストデータを設定するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    # コンテキストデータの処理
    context = super().get_context_data(**kwargs)

    # 選択された店舗の従業員データ
    if self.request.session.get('find_shop', '') != '':
      member_obj_filter = member.objects.filter(shop=self.request.session['find_shop']).order_by('employee_no')
    else:
      user_data = member.objects.get(employee_no=self.request.session['login_No'])
      member_obj_filter = member.objects.filter(shop=user_data.shop).order_by('employee_no')

    No_list = []
    name_list = []
    ok_list = []
    week_list = []

    year = int(self.request.session.get('find_year', datetime.date.today().year))
    month = int(self.request.session.get('find_month', datetime.date.today().month))

    # 月の最終日取得
    if month == 12:
      next_month = datetime.date(year + 1, 1, 1)
    else:
      next_month = datetime.date(year, month + 1, 1)

    last_day_of_month = next_month - datetime.timedelta(days=1)

    # 従業員情報設定
    for member_obj in member_obj_filter:
      No_list.append(member_obj.employee_no)
      name_list.append(member_obj.name)

    for ind, name in enumerate(name_list):
      provisional_list = []
      provisional_list.append(name)
      member_obj_get = member.objects.get(employee_no=No_list[ind])

      # 工数入力可否情報設定
      for day in range(1, last_day_of_month.day + 1):
        day_date = datetime.date(year, month, day)
        business_time_obj = Business_Time_graph.objects.filter(
            employee_no3=member_obj_get.employee_no, work_day2=day_date
        )
        if business_time_obj.count() != 0:
          provisional_list.append(business_time_obj[0])
        else:
          provisional_list.append(None)

      ok_list.append(provisional_list)

    # 曜日リスト作成
    for d in range(1, last_day_of_month.day + 1):
      week_day = datetime.date(year, month, d).weekday()
      week_mapping = ['月', '火', '水', '木', '金', '土', '日']
      week_list.append(week_mapping[week_day])

    # コンテキスト定義
    context.update({
      'title': '工数入力可否',
      'shop_form': member_findForm(self.get_form_kwargs()['initial']),
      'schedule_form': schedule_timeForm(self.extra_initial),
      'day_list': zip(range(1, last_day_of_month.day + 1), week_list),
      'ok_list': ok_list,
      'week_list': week_list,
      })

    return context


  # フォームが有効な場合の処理
  def form_valid(self, form):
    # POSTリクエストの処理
    if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
      year = self.request.POST.get('year', '')
      month = self.request.POST.get('month', '')
      shop2 = self.request.POST.get('shop2', '')

      # 年or月が未入力だとリダイレクト
      if not year or not month:
        messages.error(self.request, '表示年月に未入力箇所があります。ERROR045')
        return redirect(to='/class_list')

      # 検索記憶更新
      self.request.session['find_shop'] = shop2
      self.request.session['find_year'] = year
      self.request.session['find_month'] = month

      # 再レンダリングされたテーブルのみのHTMLを返却
      html = render_to_string('kosu/class_list_table.html', self.get_context_data(), self.request)
      return JsonResponse({'html': html})
    return super().form_valid(form)


  # フォームが無効な状態の処理
  def form_invalid(self, form):
    messages.error(self.request, '入力フォームにエラーがあります。')
    return redirect('/class_list')





#--------------------------------------------------------------------------------------------------------


