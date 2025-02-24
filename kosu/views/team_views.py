from django.shortcuts import redirect, render
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.http import HttpResponseRedirect
from django.http import JsonResponse
from django.views.generic import ListView
from django.views.generic.edit import FormView
from django.views.generic.base import TemplateView
from ..utils.kosu_utils import handle_get_request
from ..utils.kosu_utils import index_change
from ..utils.kosu_utils import create_kosu
from ..utils.kosu_utils import get_member
from ..utils.kosu_utils import get_def_library_data
from ..utils.team_utils import excel_function
from ..utils.team_utils import team_member_name_get
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
    if 'team_day' not in request.POST or request.POST['team_day'] == '':
      messages.error(request, '日付を指定してから検索して下さい。ERROR27')
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
      if eval('obj.member{}'.format(i)) == '':
        exec('obj_member{}=0'.format(i))
      else:
        exec('obj_member{}=obj.member{}'.format(i, i))

    # 班員の名前リスト、従業員番号リスト作成
    n = 0
    name_list = []
    employee_no_list = []

    for i in range(1, 16):
      member_filter = member.objects.filter(employee_no=eval('obj_member{}'.format(i)))
      if member_filter.count() != 0:
        member_data = member.objects.get(employee_no=eval('obj_member{}'.format(i)))
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
    page_num = administrator_data.objects.order_by("id").last().menu_row
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
def team_detail(request, num):

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

  # ログイン者の班員登録情報取得
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 人員名取得
  name_obj_get = member.objects.get(employee_no = obj_get.employee_no3)

  # 作業内容と作業詳細を取得しリストに解凍
  work_list = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')


  # 作業内容と作業詳細のリストを2個連結
  work_list = work_list*2
  detail_list = detail_list*2

  # 1直の時の処理
  if obj_get.tyoku2 == '1':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    del work_list[:54]
    del detail_list[:54]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える
    del work_list[:216]
    del detail_list[:216]
    del work_list[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える
    del work_list[:72]
    del detail_list[:72]
    del work_list[288:]
    del detail_list[288:]

  # 直指定がない場合の処理
  else:
    del work_list[288:]
    del detail_list[288:]

  # HTML表示用リスト作成
  time_display_list = create_kosu(work_list, detail_list, obj_get, name_obj_get, request)


  # 工数合計取得
  time_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

  # 基準合計工数定義
  default_total = 0
  if obj_get.work_time == '出勤':
    default_total = 470
  elif obj_get.work_time == 'シフト出勤':
    default_total = 470
  elif obj_get.work_time == '休出':
    default_total = 0
  elif obj_get.work_time == '遅刻・早退':
    default_total = '-'
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半前年休':
    default_total = 220
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '1' and \
          obj_get.work_time == '半後年休':
    default_total = 250
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2' and \
          obj_get.work_time == '半後年休':
    default_total = 240
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半前年休':
    default_total = 275
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3' and \
          obj_get.work_time == '半後年休':
    default_total = 195
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '1' and obj_get.work_time == '半後年休':
    default_total = 240
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半前年休':
    default_total = 290
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2' and obj_get.work_time == '半後年休':
    default_total = 180
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半前年休':
    default_total = 230
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or name_obj_get.shop == 'A2' or \
        name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3' and obj_get.work_time == '半後年休':
    default_total = 240
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半前年休':
    default_total = 230
  elif obj_get.tyoku2 == '4' and obj_get.work_time == '半後年休':
    default_total = 240



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'obj_get' : obj_get,
    'time_display_list' : time_display_list,
    'time_total' : time_total,
    'default_total' : default_total,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_detail.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員工数入力状況一覧画面定義
def team_calendar(request):

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

  # ログイン者の班員登録情報取得
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


  # 曜日指定フォーム初期値定義
  week_default = {'Sunday_check' : True, \
                  'Monday_check' : True, \
                  'Tuesday_check' : True, \
                  'Wednesday_check' : True, \
                  'Thursday_check' : True, \
                  'Friday_check' : True, \
                  'Satuday_check' : True}

  # メンバー指定フォーム初期値定義
  member_default = {'member1_check' : True, \
                    'member2_check' : True, \
                    'member3_check' : True, \
                    'member4_check' : True, \
                    'member5_check' : True, \
                    'member6_check' : True, \
                    'member7_check' : True, \
                    'member8_check' : True, \
                    'member9_check' : True, \
                    'member10_check' : True, \
                    'member11_check' : True, \
                    'member12_check' : True, \
                    'member13_check' : True, \
                    'member14_check' : True, \
                    'member15_check' : True}



  # 日付指定時の処理
  if "display_day" in request.POST:
    # POSTされた値を日付に設定
    today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')

    # POSTされた値をセッションに登録
    request.session['display_day'] = request.POST['work_day']


  # POSTしていない時の処理
  else:
    # セッションに表示日の指定がない場合の処理
    if request.session.get('display_day', None) == None:
      # 今日の日付取得
      today = datetime.date.today()

      # 取得した値をセッションに登録
      request.session['display_day'] = str(today)[0 : 10]
      today = datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d')

    # セッションに表示日の指定がある場合の処理
    else:
      # 表示日にセッションの値を入れる
      today = datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d')



  # 前週指定時の処理
  if "back_week" in request.POST:
    # 曜日取得
    week_day_back = today.weekday()

    # 曜日が日曜の場合の処理
    if week_day_back == 6:
      # 1日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=1)

    # 曜日が月曜の場合の処理
    if week_day_back == 0:
      # 2日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=2)

    # 曜日が火曜の場合の処理
    if week_day_back == 1:
      # 3日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=3)

    # 曜日が水曜の場合の処理
    if week_day_back == 2:
      # 4日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=4)

    # 曜日が木曜の場合の処理
    if week_day_back == 3:
      # 5日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=5)

    # 曜日が金曜の場合の処理
    if week_day_back == 4:
      # 6日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=6)

    # 曜日が土曜の場合の処理
    if week_day_back == 5:
      # 7日前の日付を指定日に入れる
      today = today - datetime.timedelta(days=7)

    # 前の週が月をまたぐ場合の処理
    if today.month != datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d').month:
      # 前月の最終日取得
      today = datetime.datetime(today.year, today.month, 1) + relativedelta(months=1) - relativedelta(days=1) 

    # 取得した値をセッションに登録
    request.session['display_day'] = str(today)[0:10]



  # 次週指定時の処理
  if "next_week" in request.POST:
    # 曜日取得
    week_day_back = today.weekday()

    # 曜日が日曜の場合の処理
    if week_day_back == 6:
      # 7日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=7)

    # 曜日が月曜の場合の処理
    if week_day_back == 0:
      # 6日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=6)

    # 曜日が火曜の場合の処理
    if week_day_back == 1:
      # 5日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=5)

    # 曜日が水曜の場合の処理
    if week_day_back == 2:
      # 4日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=4)

    # 曜日が木曜の場合の処理
    if week_day_back == 3:
      # 3日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=3)

    # 曜日が金曜の場合の処理
    if week_day_back == 4:
      # 2日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=2)

    # 曜日が土曜の場合の処理
    if week_day_back == 5:
      # 1日後の日付を指定日に入れる
      today = today + datetime.timedelta(days=1)

    # 次の週が月をまたぐ場合の処理
    if today.month != datetime.datetime.strptime(request.session.get('display_day', None), '%Y-%m-%d').month:
      # 次月の初日取得
      today = datetime.datetime(today.year, today.month, 1)

    # 取得した値をセッションに登録
    request.session['display_day'] = str(today)[0:10]



  # 入力状況をExcelに出力する際の処理
  if "export" in request.POST:
    # POSTされた値を日付に設定
    today = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')
    # 指定年、月取得
    year = today.year
    month = today.month

    # POSTされた値をセッションに登録
    request.session['display_day'] = request.POST['work_day']


    # 新しいExcelブック作成
    wb = openpyxl.Workbook()

    # 班員データ取得
    team_obj = team_member.objects.get(employee_no5 = request.session['login_No'])


    # 班員データに空があった場合0を定義
    for i in range(1, 16):
      if eval('team_obj.member{}'.format(i)) == '':
        exec('team_obj_member{}=0'.format(i))
      else:
        exec('team_obj_member{}=team_obj.member{}'.format(i, i))

    # 班員数、班員の従業員番号リスト取得
    n = 0
    employee_no_list = []

    for i in range(1, 16):
      member_filter =  member.objects.filter(employee_no = eval('team_obj_member{}'.format(i)))
      if member_filter.count() != 0:
        member_data = member.objects.get(employee_no = eval('team_obj_member{}'.format(i)))
        employee_no_list.append(member_data.employee_no)
    n = len(employee_no_list)

    time_display_list1 = 0
    time_display_list2 = 0
    time_display_list3 = 0
    time_display_list4 = 0
    time_display_list5 = 0
    time_display_list6 = 0
    time_display_list7 = 0
    time_display_list8 = 0
    time_display_list9 = 0
    time_display_list10 = 0
    time_display_list11 = 0
    time_display_list12 = 0
    time_display_list13 = 0
    time_display_list14 = 0
    time_display_list15 = 0

    for ind, employee_no_num in enumerate(employee_no_list):
      exec('time_display_list{}=excel_function(employee_no_num, wb, request)'.format(ind + 1))
    
    # 不要なシート削除
    del wb['Sheet']


    # メモリ上にExcelファイルを作成し、BytesIOオブジェクトに保存
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # ファイル名を設定
    filename = f'班員の{year}年{month}月度業務工数入力状況.xlsx'

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


  # 表示日の月を取得
  month = today.month

  # フォームの初期値定義
  default_day = str(today)

  # 曜日取得
  week_day = today.weekday()

  # 日付リストリセット
  day_list = []


  # 曜日が日曜の場合の処理
  if week_day == 6:
    # 日付リスト作成
    for d in range(7):
      # リストに日付追加
      day_list.append(today + datetime.timedelta(days = d))


  # 曜日が月曜の場合の処理
  if week_day == 0:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d == 0:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 1 - d))

      # 設定日以降の日付の処理  
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 1))


  # 曜日が火曜の場合の処理
  if week_day == 1:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 1:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 2 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 2))


  # 曜日が水曜の場合の処理
  if week_day == 2:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 2:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 3 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 3))


  # 曜日が木曜の場合の処理
  if week_day == 3:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 3:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 4 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 4))


  # 曜日が金曜の場合の処理
  if week_day == 4:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 4:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 5 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 5))


  # 曜日が土曜の場合の処理
  if week_day == 5:
    # 日付リスト作成
    for d in range(7):
      # 設定日より前の日付の処理
      if d >= 5:
        # リストに日付追加
        day_list.append(today - datetime.timedelta(days = 6 - d))

      # 設定日以降の日付の処理
      else:
        # リストに日付追加
        day_list.append(today + datetime.timedelta(days = d - 6))


  # 日付リスト整形
  for ind, dd in enumerate(day_list):
    # 指定月と表示月が違う要素の処理
    if month != dd.month:
      # 要素を空にする
      day_list[ind] = ''


  # ログイン者の班員取得
  obj_get = team_member.objects.get(employee_no5 = request.session['login_No'])

  # 班員の人員情報取得
  member1_obj_get = team_member_name_get(obj_get.member1)
  member2_obj_get = team_member_name_get(obj_get.member2)
  member3_obj_get = team_member_name_get(obj_get.member3)
  member4_obj_get = team_member_name_get(obj_get.member4)
  member5_obj_get = team_member_name_get(obj_get.member5)
  member6_obj_get = team_member_name_get(obj_get.member6)
  member7_obj_get = team_member_name_get(obj_get.member7)
  member8_obj_get = team_member_name_get(obj_get.member8)
  member9_obj_get = team_member_name_get(obj_get.member9)
  member10_obj_get = team_member_name_get(obj_get.member10)
  member11_obj_get = team_member_name_get(obj_get.member11)
  member12_obj_get = team_member_name_get(obj_get.member12)
  member13_obj_get = team_member_name_get(obj_get.member13)
  member14_obj_get = team_member_name_get(obj_get.member14)
  member15_obj_get = team_member_name_get(obj_get.member15)


  # 班員(従業員番号)リストリセット
  member_list = []
  # 選択肢の表示数検出&班員(従業員番号)リスト作成
  for i in range(1, 16):
    # 班員(従業員番号)リストに班員追加
    member_list.append(eval('obj_get.member{}'.format(i)))

    # 班員の登録がある場合の処理
    if eval('obj_get.member{}'.format(i)) != '':
      # インデックス記録
      member_num = i


  # 就業リストリセット
  work_list1 = []
  work_list2 = []
  work_list3 = []
  work_list4 = []
  work_list5 = []
  work_list6 = []
  work_list7 = []
  work_list8 = []
  work_list9 = []
  work_list10 = []
  work_list11 = []
  work_list12 = []
  work_list13 = []
  work_list14 = []
  work_list15 = []

  # 残業リストリセット
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

  # 工数入力リストリセット
  kosu_list1 = []
  kosu_list2 = []
  kosu_list3 = []
  kosu_list4 = []
  kosu_list5 = []
  kosu_list6 = []
  kosu_list7 = []
  kosu_list8 = []
  kosu_list9 = []
  kosu_list10 = []
  kosu_list11 = []
  kosu_list12 = []
  kosu_list13 = []
  kosu_list14 = []
  kosu_list15 = []

  # 工数入力OK_NGリストリセット
  ok_ng_list1 = []
  ok_ng_list2 = []
  ok_ng_list3 = []
  ok_ng_list4 = []
  ok_ng_list5 = []
  ok_ng_list6 = []
  ok_ng_list7 = []
  ok_ng_list8 = []
  ok_ng_list9 = []
  ok_ng_list10 = []
  ok_ng_list11 = []
  ok_ng_list12 = []
  ok_ng_list13 = []
  ok_ng_list14 = []
  ok_ng_list15 = []



  # 班員(従業員番号)リストごとに就業、残業、工数入力OK_NGリスト作成
  for ind, m in enumerate(member_list):
    # 班員登録がある場合の処理
    if m != '':
      # 日付リストを使用し日付ごとの就業、残業取得しリスト作成
      for ind2, day in enumerate(day_list):
        kosu_list = []

        # 日付リストが空でない場合の処理
        if day != '':
          # 指定日に工数データあるか確認
          member_obj_filter =Business_Time_graph.objects.filter(employee_no3 = m, work_day2 = day)

          # 指定日に工数データがある場合の処理
          if member_obj_filter.count() != 0:
            # 指定日の工数データ取得
            member_obj_get =Business_Time_graph.objects.get(employee_no3 = m, work_day2 = day)

            # 就業、残業リストに工数データから就業、残業、工数入力OK_NG追加
            exec('work_list{}.append(member_obj_get.work_time)'.format(ind + 1))
            exec('over_time_list{}.append(member_obj_get.over_time)'.format(ind + 1))
            exec('ok_ng_list{}.append(member_obj_get.judgement)'.format(ind + 1))

            # 工数データが空の場合の処理
            if member_obj_get.time_work == '#'*288:

              # 空の工数入力リストを作成
              for k in range(4):

                # 工数入力リストに空を入れる
                kosu_list.append('　　　　　')

            # 工数データが空でない場合の処理
            else:

              # 作業内容リストに解凍
              data_list = list(member_obj_get.time_work)

              # 表示時間インデックスリセット
              start_index1 = 0
              end_index1 = 0
              start_index2 = 0
              end_index2 = 0
              start_index3 = 0
              end_index3 = 0
              start_index4 = 0
              end_index4 = 0
              loop_stop = 0

              # 工数データを文字に変換するため工数の開始、終了時間のインデックス取得
              for t in range(288):
                if data_list[t] != '#':
                  start_index1 = t
                  break
                if t == 287:
                  loop_stop = 1

              if loop_stop == 0:
                for t in range(start_index1 + 1, 288):
                  if data_list[t] == '#':
                    end_index1 = t
                    break
                  if t == 287 and data_list[t] != '#':
                    end_index1 = 288
                    loop_stop = 1

                if loop_stop == 0:
                  for t in range(end_index1 + 1, 288):
                    if data_list[t] != '#':
                      start_index2 = t
                      break
                    if t == 287:
                      loop_stop = 1

                  if loop_stop == 0:
                    for t in range(start_index2 + 1, 288):
                      if data_list[t] == '#':
                        end_index2 = t
                        break
                      if t == 287 and data_list[t] != '#':
                        end_index2 = 288
                        loop_stop = 1

                    if loop_stop == 0:
                      for t in range(end_index2 + 1, 288):
                        if data_list[t] != '#':
                          start_index3 = t
                          break
                        if t == 287:
                          loop_stop = 1
          
                      if loop_stop == 0:
                        for t in range(start_index3 + 1, 288):
                          if data_list[t] == '#':
                            end_index3 = t
                            break
                          if t == 287 and data_list[t] != '#':
                            end_index3 = 288
                            loop_stop = 1

                        if loop_stop == 0:
                          for t in range(end_index3 + 1, 288):
                            if data_list[t] != '#':
                              start_index4 = t
                              break
                            if t == 287:
                              loop_stop = 1
              
                          if loop_stop == 0:
                            for t in range(start_index4 + 1, 288):
                              if data_list[t] == '#':
                                end_index4 = t
                                break
                              if t == 287 and data_list[t] != '#':
                                end_index4 = 288

              # 取得したインデックスを時間表示に変換
              kosu_list = index_change(start_index1, end_index1, kosu_list)
              kosu_list = index_change(start_index2, end_index2, kosu_list)
              kosu_list = index_change(start_index3, end_index3, kosu_list)
              kosu_list = index_change(start_index4, end_index4, kosu_list)

          # 指定日に工数データがない場合の処理
          else:

            # 就業、残業リストに空追加
            exec('work_list{}.append("")'.format(ind + 1))
            exec('over_time_list{}.append("")'.format(ind + 1))
            exec('ok_ng_list{}.append({})'.format(ind + 1, False))

            # 空の工数入力リストを作成
            for k in range(4):
              # 工数入力リストに空を入れる
              kosu_list.append('　　　　　')

        # 日付リストが空の場合の処理
        else:
          # 就業、残業リストに空追加
          exec('work_list{}.append("")'.format(ind + 1))
          exec('over_time_list{}.append("")'.format(ind + 1))
          exec('ok_ng_list{}.append({})'.format(ind + 1, False))

          # 空の工数入力リストを作成
          for k in range(4):
            # 工数入力リストに空を入れる
            kosu_list.append('　　　　　')

        # 工数入力リストに1日分の入力工数追加
        exec('kosu_list{}.append(kosu_list)'.format(ind + 1))

    # 班員登録がない場合の処理
    else:
      # 空の就業、残業リスト作成
      for b in range(7):
        # 就業、残業リストに空追加
        exec('work_list{}.append("　　　　　")'.format(ind + 1))
        exec('over_time_list{}.append("")'.format(ind + 1))
        exec('ok_ng_list{}.append({})'.format(ind + 1, False))


      for n in range(7):
        kosu_list = []
        # 空の工数入力リストを作成
        for k in range(4):
          # 工数入力リストに空を入れる
          kosu_list.append('　　　　　')
        
        # 工数入力リストに1日分の入力工数追加
        exec('kosu_list{}.append(kosu_list)'.format(ind + 1))


  # 工数入力OK_NGリスト反転
  ok_ng_list1.reverse()
  ok_ng_list2.reverse()
  ok_ng_list3.reverse()
  ok_ng_list4.reverse()
  ok_ng_list5.reverse()
  ok_ng_list6.reverse()
  ok_ng_list7.reverse()
  ok_ng_list8.reverse()
  ok_ng_list9.reverse()
  ok_ng_list10.reverse()
  ok_ng_list11.reverse()
  ok_ng_list12.reverse()
  ok_ng_list13.reverse()
  ok_ng_list14.reverse()
  ok_ng_list15.reverse()

 

  # HTMLに渡す辞書
  context = {
    'title' : '班員工数入力状況一覧',
    'default_day' : default_day,
    'member_num' : member_num,
    'day_list' : day_list,
    'member_name1' : member1_obj_get,
    'work_list1' : work_list1,
    'over_time_list1' : over_time_list1,
    'kosu_list1' : kosu_list1,
    'ok_ng_list1' : ok_ng_list1,
    'member_name2' : member2_obj_get,
    'work_list2' : work_list2,
    'over_time_list2' : over_time_list2,
    'kosu_list2' : kosu_list2,
    'ok_ng_list2' : ok_ng_list2,
    'member_name3' : member3_obj_get,
    'work_list3' : work_list3,
    'over_time_list3' : over_time_list3,
    'kosu_list3' : kosu_list3,
    'ok_ng_list3' : ok_ng_list3,
    'member_name4' : member4_obj_get,
    'work_list4' : work_list4,
    'over_time_list4' : over_time_list4,
    'kosu_list4' : kosu_list4,
    'ok_ng_list4' : ok_ng_list4,
    'member_name5' : member5_obj_get,
    'work_list5' : work_list5,
    'over_time_list5' : over_time_list5,
    'kosu_list5' : kosu_list5,
    'ok_ng_list5' : ok_ng_list5,
    'member_name6' : member6_obj_get,
    'work_list6' : work_list6,
    'over_time_list6' : over_time_list6,
    'kosu_list6' : kosu_list6,
    'ok_ng_list6' : ok_ng_list6,
    'member_name7' : member7_obj_get,
    'work_list7' : work_list7,
    'over_time_list7' : over_time_list7,
    'kosu_list7' : kosu_list7,
    'ok_ng_list7' : ok_ng_list7,
    'member_name8' : member8_obj_get,
    'work_list8' : work_list8,
    'over_time_list8' : over_time_list8,
    'kosu_list8' : kosu_list8,
    'ok_ng_list8' : ok_ng_list8,
    'member_name9' : member9_obj_get,
    'work_list9' : work_list9,
    'over_time_list9' : over_time_list9,
    'kosu_list9' : kosu_list9,
    'ok_ng_list9' : ok_ng_list9,
    'member_name10' : member10_obj_get,
    'work_list10' : work_list10,
    'over_time_list10' : over_time_list10,
    'kosu_list10' : kosu_list10,
    'ok_ng_list10' : ok_ng_list10,
    'member_name11' : member11_obj_get,
    'work_list11' : work_list11,
    'over_time_list11' : over_time_list11,
    'kosu_list11' : kosu_list11,
    'ok_ng_list11' : ok_ng_list11,
    'member_name12' : member12_obj_get,
    'work_list12' : work_list12,
    'over_time_list12' : over_time_list12,
    'kosu_list12' : kosu_list12,
    'ok_ng_list12' : ok_ng_list12,
    'member_name13' : member13_obj_get,
    'work_list13' : work_list13,
    'over_time_list13' : over_time_list13,
    'kosu_list13' : kosu_list13,
    'ok_ng_list13' : ok_ng_list13,
    'member_name14' : member14_obj_get,
    'work_list14' : work_list14,
    'over_time_list14' : over_time_list14,
    'kosu_list14' : kosu_list14,
    'ok_ng_list14' : ok_ng_list14,
    'member_name15' : member15_obj_get,
    'work_list15' : work_list15,
    'over_time_list15' : over_time_list15,
    'kosu_list15' : kosu_list15,
    'ok_ng_list15' : ok_ng_list15,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_calendar.html', context)





#--------------------------------------------------------------------------------------------------------





# 班員残業一覧画面定義
def team_over_time(request):

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

  # ログイン者の班員登録情報あるか確認
  team_filter = team_member.objects.filter(employee_no5 = request.session['login_No'])
  # 班員登録がなければメインページに戻る
  if team_filter.count() == 0:
    return redirect(to = '/team_main')


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
    if eval('member{}_obj_get'.format(i)) != '':
      # 班員リストに班員追加
      member_list.append(eval('member{}_obj_get'.format(i)))
    


  # POST時の処理
  if (request.method == 'POST'):
    # 検索項目に空欄がある場合の処理
    if request.POST['year'] == '' or request.POST['month'] == '':
      # エラーメッセージ出力
      messages.error(request, '表示年月に未入力箇所があります。ERROR082')
      # このページをリダイレクト
      return redirect(to = '/class_list')
    

    # フォームの初期値定義
    schedule_default = {'year' : request.POST['year'], 
                        'month' : request.POST['month']}
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
    schedule_default = {'year' : str(year), 
                        'month' : str(month)}
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
    eval('over_time_list{}.append(m.name)'.format(ind + 1))

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
        eval('over_time_list{}.append(obj_get)'.format(ind + 1))

        # 残業を合計する
        over_time_total += float(obj_get.over_time)

      # 該当日に工数データがない場合の処理
      else:
        # 残業リストに残業0と整合性否を追加
        eval('over_time_list{}.append(Business_Time_graph(over_time = 0, judgement = False))'.format(ind + 1))

    # リストに残業合計追加
    eval('over_time_list{}.append(over_time_total)'.format(ind + 1))
    eval('over_time_list{}.insert(1,{})'.format(ind + 1, over_time_total))


 
  # HTMLに渡す辞書
  context = {
    'title' : '班員残業管理',
    'form' : form,
    'day_list' : zip(range(1, last_day_of_month.day + 1), week_list), 
    'week_list' : week_list,
    'over_time_list1' : over_time_list1,
    'over_time_list2' : over_time_list2,
    'over_time_list3' : over_time_list3,
    'over_time_list4' : over_time_list4,
    'over_time_list5' : over_time_list5,
    'over_time_list6' : over_time_list6,
    'over_time_list7' : over_time_list7,
    'over_time_list8' : over_time_list8,
    'over_time_list9' : over_time_list9,
    'over_time_list10' : over_time_list10,
    'over_time_list11' : over_time_list11,
    'over_time_list12' : over_time_list12,
    'over_time_list13' : over_time_list13,
    'over_time_list14' : over_time_list14,
    'over_time_list15' : over_time_list15,
    'team_n' : len(member_list),
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/team_over_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数入力可否(ショップ単位)画面定義
class ClassListView(FormView):
  # 使用テンプレート,フォームの定義
  template_name = 'kosu/class_list.html'
  form_class = member_findForm  # 店舗選択フォーム（フォームの選択を適宜調整）
  extra_form_class = schedule_timeForm  # 年月選択フォーム（2つのフォーム使用時のサポート）


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
      'title': '工数入力可否(ショップ単位)',
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
        messages.error(self.request, '表示年月に未入力箇所があります。ERROR032')
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





# 工数詳細確認画面定義
def class_detail(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 人員名取得
  name_obj_get = member.objects.get(employee_no = obj_get.employee_no3)

  # 作業内容と作業詳細を取得しリストに解凍
  work_list = list(obj_get.time_work)
  detail_list = obj_get.detail_work.split('$')

  # 作業内容と作業詳細のリストを2個連結
  work_list = work_list*2
  detail_list = detail_list*2

  # 1直の時の処理
  if obj_get.tyoku2 == '1':
    # 作業内容と作業詳細のリストを4時半からの表示に変える
    del work_list[:54]
    del detail_list[:54]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを12時からの表示に変える
    del work_list[:144]
    del detail_list[:144]
    del work_list[288:]
    del detail_list[288:]

  # 2直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
    # 作業内容と作業詳細のリストを9時からの表示に変える
    del work_list[:108]
    del detail_list[:108]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがP,R,T1,T2,その他)
  elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
        name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを20時半からの表示に変える
    del work_list[:246]
    del detail_list[:246]
    del work_list[288:]
    del detail_list[288:]

  # 3直の時の処理(ログイン者のショップがW1,W2,A1,A2)
  elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
        name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
    # 作業内容と作業詳細のリストを18時からの表示に変える
    del work_list[:216]
    del detail_list[:216]
    del work_list[288:]
    del detail_list[288:]

  # 常昼の時の処理
  elif obj_get.tyoku2 == '4':
    # 作業内容と作業詳細のリストを6時からの表示に変える
    del work_list[:72]
    del detail_list[:72]
    del work_list[288:]
    del detail_list[288:]

  # 作業時間リストリセット
  kosu_list = []
  time_list_start = []
  time_list_end = []
  def_list = []
  def_time = []
  detail_time = []
  find_list =[]

  # 作業内容と作業詳細毎の開始時間と終了時間インデックス取得
  for i in range(288):

    # 最初の要素に作業が入っている場合の処理
    if i == 0 and work_list[i] != '#':
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 54)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' \
            or name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
        # 作業時間インデックスに作業時間のインデックス記録
        kosu_list.append(i + 72)

    # 時間区分毎に前の作業との差異がある場合の処理
    if i != 0 and (work_list[i] != work_list[i - 1] or detail_list[i] != detail_list[i - 1]):
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 234)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 54)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 144)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 144)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 180)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 108)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 42)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 246)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 72)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 216)

      elif obj_get.tyoku2 == '4':
        if i >= 216:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 216)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 72)

    # 最後の要素に作業が入っている場合の処理
    if i == 287 and work_list[i] != '#':
      # 検索用リストにインデックス記憶
      find_list.append(i)

      if obj_get.tyoku2 == '1':
        if i >= 234:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 233)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 55)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '2':
        if i >= 144:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 143)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 145)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '2':
        if i >= 180:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 179)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 109)

      elif (name_obj_get.shop == 'P' or name_obj_get.shop == 'R' or name_obj_get.shop == 'T1' or name_obj_get.shop == 'T2' or \
          name_obj_get.shop == 'その他' or name_obj_get.shop == '組長以上(P,R,T,その他)') and obj_get.tyoku2 == '3':
        if i >= 42:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 41)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 247)

      elif (name_obj_get.shop == 'W1' or name_obj_get.shop == 'W2' or name_obj_get.shop == 'A1' or \
            name_obj_get.shop == 'A2' or name_obj_get.shop == '組長以上(W,A)') and obj_get.tyoku2 == '3':
        if i >= 72:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 71)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 217)

      elif obj_get.tyoku2 == '4':
        if i >= 216:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i - 215)
        else:
          # 作業時間インデックスに作業時間のインデックス記録
          kosu_list.append(i + 73)


  # 作業時間インデックスに要素がある場合の処理
  if len(kosu_list) != 0:

    # 作業時間インデックスを時間表示に修正
    for ind, t in enumerate(kosu_list):

      # 最後以外のループ処理
      if len(kosu_list) - 1 != ind:

        # 作業開始時間をSTRで定義
        time_obj_start = str(int(t)//12).zfill(2) + ':' + str(int(t)%12*5).zfill(2)
        # 作業終了時間をSTRで定義
        time_obj_end = str(int(kosu_list[ind + 1])//12).zfill(2) + ':' \
          + str(int(kosu_list[ind + 1])%12*5).zfill(2)
        
        # 作業開始時間と作業終了時間をリストに追加
        time_list_start.append(time_obj_start)
        time_list_end.append(time_obj_end)

        # 作業開始時間をSTRで定義
        time_obj_start = str(int(t)//12).zfill(2) + ':' + str(int(t)%12*5).zfill(2)


  # 現在使用している工数区分のオブジェクトを取得
  kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))

  # 工数区分登録カウンターリセット
  n = 0
  # 工数区分登録数カウント
  for kosu_num in range(1, 50):
    if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != None:
      n = kosu_num

  # 工数区分処理用記号リスト用意
  str_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', \
              'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', \
                'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', \
                    'q', 'r', 's', 't', 'u', 'v', 'w', 'x',]
  # リストの長さを工数区分の登録数に応じて調整
  del str_list[n:]

  # 工数区分の選択リスト作成
  for i, m in enumerate(str_list):
    # 工数区分定義要素を追加
    def_list.append(eval('kosu_obj.kosu_title_{}'.format(i + 1)))
  
  # 作業なし追加
  def_list.append('-')
  # 休憩追加
  def_list.append('休憩')

  # 作業無し記号追加
  str_list.append('#')
  # 休憩記号追加
  str_list.append('$')

  # 工数区分辞書作成
  def_library = dict(zip(str_list, def_list))


  # 作業内容と作業詳細リスト作成
  for ind, t in enumerate(find_list):

    # 最後以外のループ処理
    if len(find_list) - 1 != ind:

      def_time.append(def_library[work_list[t]])
      detail_time.append(detail_list[t])

  # HTML表示用リスト作成
  time_display_list = []
  for k in range(len(time_list_start)):
    for_list = []
    for_list.append(str(time_list_start[k]) + '～' + str(time_list_end[k]))
    for_list.append(def_time[k])
    for_list.append(detail_time[k])
    time_display_list.append(for_list)



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'obj_get' : obj_get,
    'time_display_list' : time_display_list,
    'name' : name_obj_get.name,
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/class_detail.html', context)





#--------------------------------------------------------------------------------------------------------
