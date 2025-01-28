from django.shortcuts import redirect, render
from django.contrib import messages
from django.core.paginator import Paginator
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.views.generic import ListView
from django.views.generic.edit import UpdateView
from django.views.generic.edit import DeleteView
from django.views.generic.edit import FormView
from django.db.models import Q
from django.urls import reverse_lazy
from django.http import HttpResponseRedirect, HttpResponseBadRequest, HttpResponse
import datetime
import itertools
import re
import os
import time
import json
import pandas as pd
import Levenshtein
from ..utils.kosu_utils import round_time
from ..utils.kosu_utils import handle_get_request
from ..utils.kosu_utils import handle_work_shift
from ..utils.kosu_utils import time_index
from ..utils.kosu_utils import break_time_process
from ..utils.kosu_utils import kosu_duplication_check
from ..utils.kosu_utils import kosu_write
from ..utils.kosu_utils import break_time_delete
from ..utils.kosu_utils import break_time_write
from ..utils.kosu_utils import detail_list_summarize
from ..utils.kosu_utils import judgement_check
from ..utils.kosu_utils import kosu_division_dictionary
from ..utils.kosu_utils import kosu_sort
from ..utils.kosu_utils import default_work_time
from ..utils.kosu_utils import calendar_day
from ..utils.kosu_utils import OK_NF_check
from ..utils.kosu_utils import index_change
from ..utils.kosu_utils import break_time_over
from ..utils.kosu_utils import create_kosu
from ..utils.kosu_utils import create_kosu_basic
from ..utils.kosu_utils import get_member
from ..utils.kosu_utils import get_def_library_data
from ..utils.kosu_utils import accumulate_kosu_data
from ..utils.kosu_utils import double_form
from ..utils.kosu_utils import handle_break_time
from ..utils.kosu_utils import session_del
from ..utils.kosu_utils import break_get
from ..models import member
from ..models import Business_Time_graph
from ..models import kosu_division
from ..models import administrator_data
from ..forms import input_kosuForm
from ..forms import kosu_dayForm
from ..forms import schedule_timeForm
from ..forms import scheduleForm
from ..forms import all_kosu_findForm
from ..forms import all_kosuForm






#--------------------------------------------------------------------------------------------------------





#CSRF無効
@csrf_exempt
# 作業詳細入力時の工数定義区分変更
def dynamic_choices(request):
  # POST時の処理
  if request.method == "POST":
    try:
      # リクエストのボディを読み込んで、JSONデータを解析
      data = json.loads(request.body)
      # JSONデータからdetailの値を取得、無ければ空文字を取得
      detail = data.get("detail", "")

      # プロジェクトのパスを取得
      base_dir = settings.BASE_DIR
      # データファイルへのパスを作成
      data_file_path = os.path.join(base_dir, 'data.xlsx')
      # データファイルを読み込む
      df = pd.read_excel(data_file_path)

      # 作業詳細をSTR型に変換
      df['作業詳細'] = df['作業詳細'].astype(str)
      # すべての選択肢（B列の各値）との距離を計算し、新しいカラム 'distance' に保存
      df['distance'] = df['作業詳細'].apply(lambda x: Levenshtein.distance(detail, x))
      
      # 距離が最も近い行を取得
      min_distance_row = df.loc[df['distance'].idxmin()]
      # 最も距離が近い行のA列の値を取得
      closest_option = min_distance_row['工数定義区分']

      # 現在使用している工数定義区分のオブジェクトを取得
      kosu_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])

      # 工数定義区分インデックス取得
      for kosu_num in range(1, 50):
        # A列の値と工数定義区分が一致した場合の処理
        if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) == closest_option:
          # インデックス取得
          n = kosu_num
          # ループから抜ける
          break

      # 工数区分処理用記号リスト用意
      str_list = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')

      # 選択肢をリスト形式で準備
      choices = [[str_list[n-1], closest_option]]

      # choicesを含むJSONをレスポンスとして返す
      return JsonResponse({"choices": choices})
    # エラーが発生した場合の処理
    except Exception as e:
      # 空の選択肢リストを返す
      return JsonResponse({"choices": []})





#--------------------------------------------------------------------------------------------------------





#CSRF無効
@csrf_exempt
# 工数区分定義選択時の選択肢生成
def all_choices(request):
  try:
    # 工数区分定義リスト作成
    choices_list, def_n = kosu_division_dictionary(request.session['input_def'])
    choices_list.insert(0, ['', ''])
    choices_list.append(['$', '休憩'])

    # choicesを含むJSONをレスポンスとして返す
    return JsonResponse({"choices": choices_list})
  # エラーが発生した場合の処理
  except Exception as e:
    # 空の選択肢とエラーを出力
    return JsonResponse({"choices": [], "error": str(e)})





#--------------------------------------------------------------------------------------------------------





# 工数履歴画面定義
class KosuListView(ListView):
  # テンプレート定義
  template_name = 'kosu/kosu_list.html'
  # オブジェクト名定義
  context_object_name = 'data'


  # 画面処理前の初期設定
  def dispatch(self, request, *args, **kwargs):
    # ログインしていない場合ログイン画面へ
    if not request.session.get('login_No'):
      return redirect('/login')

    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      self.member_data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      request.session.clear()
      return redirect('/login')

    # 今日の日付を取得
    self.kosu_today = datetime.date.today()
    # 設定情報取得
    self.page_num = administrator_data.objects.order_by("id").last()
    # 全データ確認表示フラグを設定
    self.display_open = request.session['login_No'] in (
        self.page_num.administrator_employee_no1,
        self.page_num.administrator_employee_no2,
        self.page_num.administrator_employee_no3
        )
    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)


  # フィルタリングキーワード生成
  def get_filter_kwargs(self, request):
    # 日付指定検索時の処理
    if "kosu_find" in request.POST:
      # 指定日セッションに登録
      request.session['find_day'] = request.POST['kosu_day']
      # 指定月のセッション削除
      request.session.pop('kosu_month', None)
      # フィルタリング内容を返す
      return {'work_day2__contains': request.POST['kosu_day'], 'employee_no3': request.session['login_No']}

    # 月指定検索時の処理
    elif "kosu_find_month" in request.POST:
      # POST送信された就業日の年、月部分抜き出し
      kosu_month = request.POST['kosu_day'][:7]
      # 指定月セッションに登録
      request.session['kosu_month'] = kosu_month
      # 指定日セッションに登録
      request.session['find_day'] = request.POST['kosu_day']
      # フィルタリング内容を返す
      return {'employee_no3': request.session['login_No'], 'work_day2__startswith': kosu_month}

    # GET時の処理
    # 従業員番号でフィルタリング
    filter_kwargs = {'employee_no3': request.session['login_No']}
    # 指定月セッションに値がある場合、月で絞り込み
    if 'kosu_month' in request.session:
      filter_kwargs['work_day2__startswith'] = request.session['kosu_month']
    else:
      filter_kwargs['work_day2__startswith'] = request.session.get('find_day', '')
    # フィルタリング内容を返す
    return filter_kwargs


  # フィルタリングされたデータ取得
  def get_queryset(self):
    return Business_Time_graph.objects.filter(**self.get_filter_kwargs(self.request)).order_by('work_day2').reverse()


  # HTMLに送る辞書定義
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
        'title': '工数履歴',
        'member_data': self.member_data,
        'default_day': self.request.session.get('find_day', str(self.kosu_today)),
        'display_open': self.display_open,
        'num': self.kwargs.get('num')
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
    # フィルタリングしたデータをページネーションで絞り込み
    paginator = Paginator(self.get_queryset(), self.page_num.menu_row)
    self.object_list = paginator.get_page(kwargs.get('num'))
    # HTMLに送るデータに追加
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    # HTMLにデータ送信
    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 工数入力画面定義
def input(request):
  # ログイン情報を取得し、リダイレクトが必要な場合はリダイレクト
  member_obj = get_member(request)
  if isinstance(member_obj, HttpResponseRedirect):
    return member_obj

  # 今日の日時を変数に格納
  kosu_today = datetime.date.today()
  # フォーム初期値定義
  new_work_day = kosu_today if request.session.get('day') is None else request.session['day']

  # グラフ関連リスト定義
  graph_item = []
  graph_list = []



  # GET時の処理
  if request.method == 'GET':
    # グラフラベル＆グラフデータ作成
    graph_item, graph_list = handle_get_request(new_work_day, member_obj)

    # 工数入力完了記憶がある場合の処理
    show_message = request.session.get('POST_memory', False)
    if show_message:
      time.sleep(1)
      del request.session['POST_memory']



  # グラフ更新時の処理
  elif "update" in request.POST:
    # 就業日POST正常の場合の処理
    if request.POST['work_day']:
      # 更新された就業日をセッションに登録
      request.session['day'] = request.POST['work_day']
      # 更新された就業日を変数に入れる
      new_work_day = request.session['day']
      # 日付変更時作業時間フォーム修正
      handle_work_shift(request, member_obj, new_work_day)
      # グラフラベル＆グラフデータ作成
      graph_item, graph_list = handle_get_request(new_work_day, member_obj)

    else:
      # エラー時リダイレクト
      messages.error(request, '就業日の削除はしないで下さい。ERROR009')
      return redirect(to = '/input')

    # 工数登録完了メッセージ非表示
    show_message = False



  # 工数登録時の処理
  elif "Registration" in request.POST:
    # それぞれPOSTされた値を変数に入れる
    work_day = request.POST['work_day']
    start_time = request.POST['start_time']
    end_time = request.POST['end_time']
    def_work = request.POST['kosu_def_list']
    detail_work = request.POST['work_detail']

    # 直,勤務取得
    obj_filter, tyoku, work = double_form(request.session['login_No'], request.POST['work_day'], request)

    # フォーム内容保持
    request.session['error_tyoku'] = tyoku
    request.session['error_work'] = work
    request.session['error_def'] = def_work
    request.session['error_detail'] = detail_work
    request.session['error_over_work'] = request.POST['over_work']
    request.session['start_time'] = start_time
    request.session['end_time'] = end_time
    

    # 翌日チェック状態
    check = 1 if 'tomorrow_check' in request.POST else 0
    # 休憩変更チェック状態
    break_change = 1 if 'break_change' in request.POST else 0


    # 未入力チェック用の変数リスト
    values = [def_work, work, tyoku, start_time, end_time, request.POST.get('over_work')]

    # いずれかが None または 空文字列ならばエラーメッセージ出力してリダイレクト
    if any(v in (None, '') for v in values):
        messages.error(request, '直、工数区分、勤務、残業、作業時間のいずれかが未入力です。工数登録できませんでした。ERROR060')
        return redirect(to='/input')

    # 作業詳細に'$'が含まれている場合リダイレクト
    if '$' in detail_work:
      messages.error(request, '作業詳細に『$』は使用できません。工数登録できませんでした。ERROR026')
      return redirect(to = '/input')

    # 作業詳細に文字数が100文字以上の場合リダイレクト
    if len(detail_work) >= 100:
      messages.error(request, '作業詳細は100文字以内で入力して下さい。工数登録できませんでした。ERROR059')
      return redirect(to = '/input')

    # 残業時間が15の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR058')
      return redirect(to = '/input')

    # 作業開始時間と作業終了時間が同じ場合リダイレクト
    if start_time == end_time:
      messages.error(request, '作業時間が誤っています。確認して下さい。ERROR003')
      return redirect(to = '/input')

    # 作業開始、終了の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始、終了時間のインデックス取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 作業開始時間が作業終了時間より遅い場合のリダイレクト
    if start_time_ind > end_time_ind and check == 0:
      messages.error(request, '作業開始時間が終了時間を越えています。翌日チェックを忘れていませんか？ERROR004')
      return redirect(to = '/input')

    # 1日以上の工数が入力された場合リダイレクト
    if start_time_ind <= end_time_ind and check == 1:
      messages.error(request, '1日以上の工数は入力できません。誤って翌日チェックを入れていませんか？ERROR097')
      return redirect(to = '/input')

    # 入力時間が21時間を超える場合リダイレクト
    if ((end_time_ind + 36) >= start_time_ind and check == 1) or ((end_time_ind - 252) >= start_time_ind and check == 0):
      messages.error(request, '作業時間が21時間を超えています。入力できません。ERROR098')
      return redirect(to = '/input')


    # 指定日に工数データがある場合の処理
    if obj_filter.exists():
      # 工数データ取得しリスト化
      obj_get = obj_filter.first()
      kosu_def = list(obj_get.time_work)
      detail_list = obj_get.detail_work.split('$')

      # 以前同日に打ち込んだ工数区分定義と違う場合リダイレクト
      if obj_get.def_ver2 not in (request.session['input_def'], None, ''):
        messages.error(request, '前に入力された工数と工数区分定義のVerが違います。ERROR007')
        return redirect(to = '/input')


      # 工数データに休憩時間データ無いか直が変更されている場合の処理
      if obj_get.breaktime == None or obj_get.breaktime_over1 == None or \
        obj_get.breaktime_over2 == None or obj_get.breaktime_over3 == None or \
          obj_get.tyoku2 != tyoku:
        # 休憩時間取得
        breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, request)

      # 工数データに休憩時間データある場合の処理
      else:
        # 休憩時間取得
        breaktime = obj_get.breaktime
        breaktime_over1 = obj_get.breaktime_over1
        breaktime_over2 = obj_get.breaktime_over2
        breaktime_over3 = obj_get.breaktime_over3

      # 休憩時間のインデックス＆日またぎ変数定義
      break_start1, break_end1, break_next_day1 = break_time_process(breaktime)
      break_start2, break_end2, break_next_day2 = break_time_process(breaktime_over1)
      break_start3, break_end3, break_next_day3 = break_time_process(breaktime_over2)
      break_start4, break_end4, break_next_day4 = break_time_process(breaktime_over3)

      # 入力時間が日をまたいでいない場合の処理
      if check == 0:
        # 工数に被りがないかチェック
        response = kosu_duplication_check(start_time_ind, end_time_ind, kosu_def, request)
        if response:
          return response

        # 作業内容、作業詳細書き込み
        kosu_def, detail_list = kosu_write(start_time_ind, end_time_ind, kosu_def, detail_list, request)

        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 各休憩時間の処理
          for break_num in range(1, 5):
            # 各変数の値を動的に取得
            break_start = locals()[f'break_start{break_num}']
            break_end = locals()[f'break_end{break_num}']
            break_next_day = locals()[f'break_next_day{break_num}']

            # 休憩時間分を工数データから削除
            result = handle_break_time(break_start, break_end, break_next_day, kosu_def, detail_list, member_obj, request)

            # エラーが出た場合リダイレクト
            if result is None:
              return redirect(to='/input')
            kosu_def, detail_list = result

      # 入力時間が日をまたいでいる場合の処理
      elif check == 1:
        # 工数に被りがないかチェック
        response = kosu_duplication_check(start_time_ind, 288, kosu_def, request)
        if response:
          return response

        response = kosu_duplication_check(0, end_time_ind, kosu_def, request)          
        if response:
          return response

        # 作業内容、作業詳細書き込み
        kosu_def, detail_list = kosu_write(start_time_ind, 288, kosu_def, detail_list, request)
        kosu_def, detail_list = kosu_write(0, end_time_ind, kosu_def, detail_list, request)

        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 各休憩時間の処理
          for break_num in range(1, 5):
            # 各変数の値を動的に取得
            break_start = locals()[f'break_start{break_num}']
            break_end = locals()[f'break_end{break_num}']
            break_next_day = locals()[f'break_next_day{break_num}']

            # 休憩時間を削除
            result = handle_break_time(break_start, break_end, break_next_day, kosu_def, detail_list, member_obj, request)

            # エラーが出た場合リダイレクト
            if result is None:
              return redirect(to='/input')
            kosu_def, detail_list = result


      # 作業内容データの内容を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
        work_day2 = work_day, defaults = {'def_ver2' : request.session['input_def'], \
                                          'work_time' : work, \
                                          'tyoku2' : tyoku, \
                                          'time_work' : ''.join(kosu_def), \
                                          'over_time' : request.POST['over_work'], \
                                          'detail_work' : detail_list_summarize(detail_list),\
                                          'judgement' : judgement_check(kosu_def, work, tyoku, member_obj, request.POST['over_work']), \
                                          'break_change' : 'break_change' in request.POST})
      
    # 指定日に工数データがない場合の処理
    else:
      # 空の作業内容、詳細リスト作成
      kosu_def = list(itertools.repeat('#', 288))
      detail_list = list(itertools.repeat('', 288))

      # 休憩時間取得
      breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, request)

      # 休憩時間のインデックス＆日またぎ変数定義
      break_start1, break_end1, break_next_day1 = break_time_process(breaktime)
      break_start2, break_end2, break_next_day2 = break_time_process(breaktime_over1)
      break_start3, break_end3, break_next_day3 = break_time_process(breaktime_over2)
      break_start4, break_end4, break_next_day4 = break_time_process(breaktime_over3)

      # 入力時間が日をまたいでいない場合の処理
      if check == 0:
        # 作業内容、作業詳細書き込み
        kosu_def, detail_list = kosu_write(start_time_ind, end_time_ind, kosu_def, detail_list, request)

        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 各休憩時間の処理
          for break_num in range(1, 5):
            # 各変数の値を動的に取得
            break_start = locals()[f'break_start{break_num}']
            break_end = locals()[f'break_end{break_num}']
            break_next_day = locals()[f'break_next_day{break_num}']

            # 休憩時間を削除
            result = handle_break_time(break_start, break_end, break_next_day, kosu_def, detail_list, member_obj, request)

            # エラーが出た場合リダイレクト
            if result is None:
              return redirect(to='/input')
            kosu_def, detail_list = result

      # 入力時間が日をまたいでいる場合の処理
      else:
        # 作業内容、作業詳細書き込み
        kosu_def, detail_list = kosu_write(start_time_ind, 288, kosu_def, detail_list, request)
        kosu_def, detail_list = kosu_write(0, end_time_ind, kosu_def, detail_list, request)

        # 休憩変更チェックが入っていない時の処理
        if break_change == 0:
          # 各休憩時間の処理
          for break_num in range(1, 5):
            # 各変数の値を動的に取得
            break_start = locals()[f'break_start{break_num}']
            break_end = locals()[f'break_end{break_num}']
            break_next_day = locals()[f'break_next_day{break_num}']

            # 休憩時間を削除
            result = handle_break_time(break_start, break_end, break_next_day, kosu_def, detail_list, member_obj, request)

            # エラーが出た場合リダイレクト
            if result is None:
              return redirect(to='/input')
            kosu_def, detail_list = result


      # 指定のレコードにPOST送信された値を上書きする 
      new = Business_Time_graph(employee_no3 = request.session['login_No'], \
                                name = member.objects.get(employee_no = request.session['login_No']), \
                                def_ver2 = request.session['input_def'], \
                                work_day2 = work_day, \
                                work_time = work,\
                                tyoku2 = tyoku, \
                                time_work = ''.join(kosu_def), \
                                detail_work = detail_list_summarize(detail_list), \
                                over_time = request.POST['over_work'], \
                                breaktime = breaktime, \
                                breaktime_over1 = breaktime_over1, \
                                breaktime_over2 = breaktime_over2, \
                                breaktime_over3 = breaktime_over3, \
                                judgement = judgement_check(kosu_def, work, tyoku, member_obj, request.POST['over_work']), \
                                break_change = 'break_change' in request.POST)

      # 工数内容リストをセーブする
      new.save()


    # 入力値をセッションに保存する
    request.session['day'] = work_day
    request.session['start_time'] = end_time
    request.session['end_time'] = end_time

    # フォーム保持削除
    for key in ['error_tyoku', 'error_work', 'error_def', 'error_detail', 'error_over_work']:
      session_del(key, request)

    # 翌日チェックリセット
    request.session['tomorrow_check'] = False

    # 工数登録完了メッセージ出力
    show_message = True
    # POST記憶
    request.session['POST_memory'] = True

    # このページをリダイレクトする
    return redirect(to = '/input')



  # 残業登録時の処理
  elif "over_time_correction" in request.POST:
    # 直,勤務取得
    obj_filter, tyoku, work = double_form(request.session['login_No'], request.POST['work_day'], request)

    # 残業未入力の場合リダイレクト
    if request.POST['over_work'] == '':
      messages.error(request, '残業が未入力です。登録できませんでした。ERROR017')
      return redirect(to = '/input')
    
    # 残業時間が15の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR018')
      return redirect(to = '/input')

    # 休出時に残業時間が5の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%5 != 0 and work == '休出':
      messages.error(request, '残業時間が5分の倍数になっていません。工数登録できませんでした。ERROR084')
      return redirect(to = '/input')

    
    # 工数データがある場合の処理
    if obj_filter.exists():
      # 工数データ取得
      obj_get = obj_filter.first()
      # 残業を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'over_time' : request.POST['over_work'], \
                                                               'judgement' : judgement_check(list(obj_get.time_work), work, tyoku, member_obj, request.POST['over_work'])})
      
    # 工数データがない場合の処理
    else:
      # 工数データ作成し残業書き込み
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'name' : member.objects.get(employee_no = request.session['login_No']), \
                                                               'time_work' : '#'*288, \
                                                               'detail_work' : '$'*287, \
                                                               'over_time' : request.POST['over_work']})

    # 工数登録完了メッセージ非表示
    show_message = False

    # このページをリダイレクトする
    return redirect(to = '/input')



  # 工数区分定義予測設定変更時の処理
  elif "def_check" in request.POST:
    # 直,勤務取得
    obj_filter, tyoku, work = double_form(request.session['login_No'], request.POST['work_day'], request)

    # 入力値保持
    request.session['error_tyoku'] = tyoku
    request.session['error_work'] = work
    request.session['error_def'] = request.POST['kosu_def_list']
    request.session['error_detail'] = request.POST['work_detail']
    request.session['error_over_work'] = request.POST['over_work']
    request.session['start_time'] = request.POST['start_time']
    request.session['end_time'] = request.POST['end_time']
    request.session['tomorrow_check'] = 'tomorrow_check' in request.POST


    # 工数区分定義予測設定を上書きして更新
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'def_prediction': 'def_prediction' in request.POST})

    # 工数登録完了メッセージ非表示
    show_message = False

    # リダイレクト
    return redirect(to = '/input')



  # 現在時刻取得処理
  elif "now_time" in request.POST:
    # 直,勤務取得
    obj_filter, tyoku, work = double_form(request.session['login_No'], request.POST['work_day'], request)

    # 現在時刻取得
    now_time = datetime.datetime.now().time()

    # 現在時刻を5分単位で丸め
    rounded_time = round_time(now_time)
    
    # 現在時刻を初期値に設定
    default_end_time = rounded_time.strftime('%H:%M')

    # 更新された就業日取得
    new_work_day = request.session.get('day', kosu_today)

    # 作業開始時間保持
    request.session['start_time'] = request.POST['start_time']

    # 翌日チェックBOX、工数区分保持
    if request.POST['start_time'] != '':
      if datetime.datetime.strptime(request.POST['start_time'], "%H:%M") > datetime.datetime.strptime(default_end_time, "%H:%M"):
        request.session['tomorrow_check'] = True

      else:
        request.session['tomorrow_check'] = False

    else:
      request.session['tomorrow_check'] = False

    # 時刻取得時の初期値の定義
    def_default = {'work' : work,
                   'work2' : work,
                   'tyoku' : tyoku,
                   'tyoku2' : tyoku,
                   'kosu_def_list' : request.POST['kosu_def_list'],
                   'work_detail' : request.POST['work_detail'],
                   'break_change' : 'break_change' in request.POST,
                   'over_work' : request.POST['over_work']}


    # グラフラベル＆グラフデータ作成
    graph_item, graph_list = handle_get_request(new_work_day, member_obj)

    # 工数登録完了メッセージ非表示
    show_message = False



  # 休憩変更時の処理
  elif "change_display" in request.POST:
    # 休憩変更したい日を記憶
    request.session['break_today'] = request.POST['work_day']

    # 休憩変更したい日に休憩データがあるか確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'],\
                                                    work_day2 = request.POST['work_day'])

    #工数データがある場合の処理
    if obj_filter.exists():
      # 工数データ取得
      obj_get = obj_filter.first()

      # 休憩データが空の場合リダイレクト
      if obj_get.breaktime == None or obj_get.breaktime_over1 == None or \
        obj_get.breaktime_over2 == None or obj_get.breaktime_over3 == None:
        messages.error(request, 'この日は、まだ休憩データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR016')
        return redirect(to = '/input')

      # 休憩データがある場合の処理 
      else:
        # 休憩変更画面へジャンプ
        return redirect(to = '/today_break_time')

    # 工数データがない場合リダイレクト
    else:
      messages.error(request, 'この日は、まだ工数データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR006')
      return redirect(to = '/input')



  # 定義確認処理
  elif "def_find" in request.POST:
    # 直,勤務取得
    obj_filter, tyoku, work = double_form(request.session['login_No'], request.POST['work_day'], request)

    # フォーム内容保持
    request.session['error_tyoku'] = tyoku
    request.session['error_work'] = work
    request.session['error_def'] = request.POST['kosu_def_list']
    request.session['error_detail'] = request.POST['work_detail']
    request.session['error_over_work'] = request.POST['over_work']
    request.session['start_time'] = request.POST['start_time']
    request.session['end_time'] = request.POST['end_time']
    request.session['tomorrow_check'] = 'tomorrow_check' in request.POST

    # 工数定義区分画面へジャンプ
    return redirect(to = '/kosu_def')



  # 作業終了時の変数がない場合の処理
  if 'default_end_time' not in locals():
    # セッションに登録されている作業終了時を変数に入れる
    default_end_time = str(request.session.get('end_time', ''))


  # 残業データあるか確認
  obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                  work_day2 = request.session.get('day', kosu_today))

  # 残業データある場合の処理
  if obj_filter.exists():
    # 残業データ取得
    obj_get = obj_filter.first()
    over_work_default = obj_get.over_time
    # 直情報取得
    tyoku_default = obj_get.tyoku2
    # 勤務情報取得
    work_default = obj_get.work_time
    # 工数入力状況取得
    ok_ng = obj_get.judgement
    # 休憩変更情報取得
    break_change_default = obj_get.break_change

  # 残業データない場合の処理
  else:
    obj_get = ''
    # 残業に0を入れる
    over_work_default = 0
    # 工数入力状況に空を入れる
    ok_ng = False
    # 休憩時間変更に空を入れる
    break_change_default = False
    # 勤務情報に空を入れる 
    work_default = ''
    # 直情報に空を入れる
    tyoku_default = ''

  # フォーム保持削除
  for key in ['error_tyoku', 'error_work', 'error_def', 'error_detail', 'error_over_work']:
    session_del(key, request)


  # 初期値を設定するリスト作成
  default_list = {'work' : work_default,
                 'work2' : work_default,
                 'tyoku' : tyoku_default,
                 'tyoku2' : tyoku_default, 
                 'tomorrow_check' : request.session.get('tomorrow_check', False),
                 'kosu_def_list': request.session.get('error_def', ''),
                 'work_detail' : request.session.get('error_detail', ''),
                 'over_work' : over_work_default,
                 'break_change' : break_change_default,
                 'def_prediction' : member_obj.def_prediction} 

  # 時刻取得時の初期値の定義追加あれば追加
  if 'def_default' in locals():
    default_list.update(def_default)

  # 工数区分定義リスト作成
  choices_list, def_n = kosu_division_dictionary(request.session['input_def'])
  def_library = choices_list
  def_library.append(['#', '-'])
  def_library.append(['$', '休憩'])
  choices_list.insert(0, ['', ''])
  choices_list.append(['$', '休憩'])

  # フォームの初期状態定義
  form = input_kosuForm(default_list)

  # フォームの選択肢定義
  form.fields['kosu_def_list'].choices = choices_list


  # 工数データ無い場合リンクに空を入れる
  obj_link = any(num != 0 for num in graph_list)


  # HTML表示用リストリセット
  time_display_list = []
  # 工数データある場合の処理
  if obj_link == True:
    # 作業内容と作業詳細を直に合わせて調整
    work_list, detail_list = kosu_sort(obj_get, member_obj)
    # HTML表示用リスト作成
    time_display_list = create_kosu(work_list, detail_list, obj_get, member_obj, request)
    # 工数合計取得
    time_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)
    # 基準合計工数取得
    default_total = default_work_time(obj_get, member_obj)

  # 工数データない場合の処理
  else:
    def_n = 0
    # 工数合計定義
    time_total = 0
    # 基準合計工数定義
    default_total = 0
    # 工数区分定義
    def_library = []



  # HTMLに渡す辞書
  context = {
    'title' : '工数登録',
    'form' : form,
    'new_day' : str(new_work_day),
    'default_start_time' : request.session.get('start_time', ''),
    'default_end_time' : default_end_time,
    'graph_list' : graph_list,
    'graph_item' : graph_item,
    'def_library' : def_library,
    'def_n' : def_n,
    'OK_NG' : ok_ng,
    'time_total' : time_total,
    'default_total' : default_total,
    'obj_get' : obj_get,
    'obj_link' : obj_link,
    'time_display_list' : time_display_list,
    'member_obj' : member_obj,
    'show_message': show_message
    }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/input.html', context)





#--------------------------------------------------------------------------------------------------------





# 休憩時間定義画面定義
class BreakTimeUpdateView(UpdateView):
  # モデル、フォーム、テンプレート、データなどを指定
  model = member
  fields = []
  template_name = 'kosu/break_time.html'
  success_url = reverse_lazy('kosu_main')


  # リクエスト処理する際のメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # ログインしていない場合ログイン画面へ
    if not request.session.get('login_No'):
      return redirect('/login')
    # 従業員番号取得
    self.employee_no = request.session.get('login_No')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # オブジェクトを取得するメソッドをオーバーライド
  def get_object(self, queryset=None):
    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      return member.objects.get(employee_no=self.employee_no)
    except member.DoesNotExist:
      self.request.session.clear()
      return redirect('/login')


  # コンテキストデータを設定するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    # 親クラスのget_context_dataメソッドを呼び出し
    context = super().get_context_data(**kwargs)
    # 休憩データを取得
    break_data = self.object

    # タイトルを設定
    context['title'] = '休憩時間定義'        
    # 初期値となる休憩時間を設定
    context.update(self.get_default_times(break_data))
    # チェックボックスの初期状態を設定
    context['initial_checkbox'] = break_data.break_check
    
    return context


  # 初期値の休憩時間を取得するメソッド
  def get_default_times(self, break_data):
    # 時間整形関数
    def time_format(input_time):
      return input_time[1:3] + ':' + input_time[3:5], input_time[5:7] + ':' + input_time[7:]

    # 各休憩時間の初期値を定義
    return {
      'default_start_time1': time_format(break_data.break_time1)[0],
      'default_end_time1': time_format(break_data.break_time1)[1],
      'default_start_time2': time_format(break_data.break_time1_over1)[0],
      'default_end_time2': time_format(break_data.break_time1_over1)[1],
      'default_start_time3': time_format(break_data.break_time1_over2)[0],
      'default_end_time3': time_format(break_data.break_time1_over2)[1],
      'default_start_time4': time_format(break_data.break_time1_over3)[0],
      'default_end_time4': time_format(break_data.break_time1_over3)[1],
      'default_start_time5': time_format(break_data.break_time2)[0],
      'default_end_time5': time_format(break_data.break_time2)[1],
      'default_start_time6': time_format(break_data.break_time2_over1)[0],
      'default_end_time6': time_format(break_data.break_time2_over1)[1],
      'default_start_time7': time_format(break_data.break_time2_over2)[0],
      'default_end_time7': time_format(break_data.break_time2_over2)[1],
      'default_start_time8': time_format(break_data.break_time2_over3)[0],
      'default_end_time8': time_format(break_data.break_time2_over3)[1],
      'default_start_time9': time_format(break_data.break_time3)[0],
      'default_end_time9': time_format(break_data.break_time3)[1],
      'default_start_time10': time_format(break_data.break_time3_over1)[0],
      'default_end_time10': time_format(break_data.break_time3_over1)[1],
      'default_start_time11': time_format(break_data.break_time3_over2)[0],
      'default_end_time11': time_format(break_data.break_time3_over2)[1],
      'default_start_time12': time_format(break_data.break_time3_over3)[0],
      'default_end_time12': time_format(break_data.break_time3_over3)[1],
      'default_start_time13': time_format(break_data.break_time4)[0],
      'default_end_time13': time_format(break_data.break_time4)[1],
      'default_start_time14': time_format(break_data.break_time4_over1)[0],
      'default_end_time14': time_format(break_data.break_time4_over1)[1],
      'default_start_time15': time_format(break_data.break_time4_over2)[0],
      'default_end_time15': time_format(break_data.break_time4_over2)[1],
      'default_start_time16': time_format(break_data.break_time4_over3)[0],
      'default_end_time16': time_format(break_data.break_time4_over3)[1],
      }


  # フォームが有効な場合に呼び出されるメソッドをオーバーライド
  def form_valid(self, form):
    # POST値取得
    post_data = self.request.POST
    break_times = [
      (post_data.get(f'start_time{i}'), post_data.get(f'end_time{i}'))
      for i in range(1, 17)
      ]

    # 休憩時間POST値リスト定義
    formatted_break_times = []
    # 各休憩時間をフォーマットしてリストに追加
    for start, end in break_times:
      start_hour, start_min = time_index(start)
      end_hour, end_min = time_index(end)
      formatted_break_times.append(
        f"{start_hour.zfill(2)}{start_min}{end_hour.zfill(2)}{end_min}"
        )

    # エラーラベル定義
    over_time_labels = {
      1: '1直の昼休憩時間', 5: '2直の昼休憩時間',
      9: '3直の昼休憩時間', 13: '常昼の昼休憩時間'
      }

    # 昼休憩時間が長すぎる場合のチェック
    for i, label in over_time_labels.items():
      response = break_time_over(
        *time_index(break_times[i-1][0]), *time_index(break_times[i-1][1]), 60, label, self.request
        )
      if response:
        return response

    # 詳細なエラー時間ラベル
    over_time_rest_labels = {
      2: ('1直残業時間中の休憩時間1', 15), 3: ('1直残業時間中の休憩時間2', 60), 4: ('1直残業時間中の休憩時間3', 15),
      6: ('2直残業時間中の休憩時間1', 15), 7: ('2直残業時間中の休憩時間2', 60), 8: ('2直残業時間中の休憩時間3', 15),
      10: ('3直残業時間中の休憩時間1', 15), 11: ('3直残業時間中の休憩時間2', 60), 12: ('3直残業時間中の休憩時間3', 15),
      14: ('常昼残業時間中の休憩時間1', 15), 15: ('常昼残業時間中の休憩時間2', 60), 16: ('常昼残業時間中の休憩時間3', 15)
      }

    # 残業休憩時間が長すぎる場合のチェック
    for i, (label, max_time) in over_time_rest_labels.items():
      response = break_time_over(
        *time_index(break_times[i-1][0]), *time_index(break_times[i-1][1]), max_time, label, self.request
        )
      if response:
        return response

    # 各休憩時間をフォーマットしてモデルのフィールドに設定
    self.object.break_time1 = "#" + formatted_break_times[0]
    self.object.break_time1_over1 = "#" + formatted_break_times[1]
    self.object.break_time1_over2 = "#" + formatted_break_times[2]
    self.object.break_time1_over3 = "#" + formatted_break_times[3]
    self.object.break_time2 = "#" + formatted_break_times[4]
    self.object.break_time2_over1 = "#" + formatted_break_times[5]
    self.object.break_time2_over2 = "#" + formatted_break_times[6]
    self.object.break_time2_over3 = "#" + formatted_break_times[7]
    self.object.break_time3 = "#" + formatted_break_times[8]
    self.object.break_time3_over1 = "#" + formatted_break_times[9]
    self.object.break_time3_over2 = "#" + formatted_break_times[10]
    self.object.break_time3_over3 = "#" + formatted_break_times[11]
    self.object.break_time4 = "#" + formatted_break_times[12]
    self.object.break_time4_over1 = "#" + formatted_break_times[13]
    self.object.break_time4_over2 = "#" + formatted_break_times[14]
    self.object.break_time4_over3 = "#" + formatted_break_times[15]
    self.object.break_check = 'break_check' in post_data

    # データを保存
    self.object.save()
    return redirect(self.get_success_url())





#--------------------------------------------------------------------------------------------------------





# 当日休憩変更画面定義
class TodayBreakTimeUpdateView(UpdateView):
  # モデル、フォーム、テンプレート、データなどを指定
  model = Business_Time_graph
  fields = []
  template_name = 'kosu/today_break_time.html'
  success_url = reverse_lazy('input')

  # 工数データ取得
  def get_object(self, queryset=None):
    return Business_Time_graph.objects.get(employee_no3=self.request.session['login_No'], \
                                            work_day2=self.request.session['break_today'])

  # 画面処理前の初期設定
  def dispatch(self, request, *args, **kwargs):
    # ログインしていない場合ログイン画面へ
    if not request.session.get('login_No'):
      return redirect('/login')

    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      self.member_data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      request.session.clear()
      return redirect('/login')

    # 親クラスへ情報送信
    return super().dispatch(request, *args, **kwargs)

  # コンテキストデータを設定するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    # 親クラスのget_context_dataメソッドを呼び出し
    context = super().get_context_data(**kwargs)
    # 休憩データを取得
    break_data = self.object

    # タイトルを設定
    context['title'] = '休憩変更'
    # タイトル(日付)を設定
    context['data'] = break_data
    # 初期値となる休憩時間を設定
    context.update(self.get_default_times(break_data))
    
    return context

  # 初期値の休憩時間を取得するメソッド
  def get_default_times(self, break_data):
    # 時間整形関数
    def time_format(input_time):
      return input_time[1:3] + ':' + input_time[3:5], input_time[5:7] + ':' + input_time[7:]

    # 各休憩時間の初期値を定義
    return {
      'default_start_time1': time_format(break_data.breaktime)[0],
      'default_end_time1': time_format(break_data.breaktime)[1],
      'default_start_time2': time_format(break_data.breaktime_over1)[0],
      'default_end_time2': time_format(break_data.breaktime_over1)[1],
      'default_start_time3': time_format(break_data.breaktime_over2)[0],
      'default_end_time3': time_format(break_data.breaktime_over2)[1],
      'default_start_time4': time_format(break_data.breaktime_over3)[0],
      'default_end_time4': time_format(break_data.breaktime_over3)[1],
      }

  # フォームが有効な場合に呼び出されるメソッドをオーバーライド
  def form_valid(self, form):
    # POST値取得
    post_data = self.request.POST
    break_times = [
        (post_data.get(f'start_time{i}'), post_data.get(f'end_time{i}'))
        for i in range(1, 5)
    ]

    # 休憩時間POST値リスト定義
    formatted_break_times = []
    # 各休憩時間をフォーマットしてリストに追加
    for start, end in break_times:
      start_hour, start_min = time_index(start)
      end_hour, end_min = time_index(end)
      formatted_break_times.append(
          f"{start_hour.zfill(2)}{start_min}{end_hour.zfill(2)}{end_min}"
      )

    # エラーラベル定義
    over_time_labels = {
      1: '昼休憩時間'
      }

    # 昼休憩時間が長すぎる場合のチェック
    for i, label in over_time_labels.items():
      response = break_time_over(
          *time_index(break_times[i-1][0]), *time_index(break_times[i-1][1]), 60, label, self.request
      )
      if response:
        return response

    # 詳細なエラー時間ラベル
    over_time_rest_labels = {
      2: ('残業時間中の休憩時間1', 15), 3: ('残業時間中の休憩時間2', 60), 4: ('残業時間中の休憩時間3', 15),
      }

    # 残業休憩時間が長すぎる場合のチェック
    for i, (label, max_time) in over_time_rest_labels.items():
      response = break_time_over(
          *time_index(break_times[i-1][0]), *time_index(break_times[i-1][1]), max_time, label, self.request
          )
      if response:
        return response

    # 各休憩時間をフォーマットしてモデルのフィールドに設定
    self.object.breaktime = "#" + formatted_break_times[0]
    self.object.breaktime_over1 = "#" + formatted_break_times[1]
    self.object.breaktime_over2 = "#" + formatted_break_times[2]
    self.object.breaktime_over3 = "#" + formatted_break_times[3]

    # データを保存
    self.object.save()
    return redirect(self.get_success_url())





#--------------------------------------------------------------------------------------------------------





# 工数詳細確認画面定義
def detail(request, num):
  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  try:
    # ログイン者の情報取得
    member_obj = member.objects.get(employee_no=request.session['login_No'])
  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect('/login')

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # 作業内容と作業詳細を直に合わせて調整
  work_list, detail_list = kosu_sort(obj_get, member_obj)

  # HTML表示用リスト前準備リスト作成
  def_time, detail_time, time_list_start, time_list_end, kosu_list = create_kosu_basic(work_list, detail_list, obj_get, member_obj, request)
  
  # 工数データに工数定義区分Verがある場合の処理
  if obj_get.def_ver2 not in [None, '']:
    # 工数区分定義リスト作成
    def_choices_list, def_n = kosu_division_dictionary(obj_get.def_ver2)
  # 工数データに工数定義区分Verがない場合の処理
  else:
    # 工数区分定義リスト作成
    def_choices_list, def_n = kosu_division_dictionary(request.session['input_def'])


  # HTML表示用リスト作成
  time_display_list = []
  for k in range(len(time_list_start)):
    # 一時置きリスト定義
    for_list = []

    # 工数区分定義の選択リスト作成
    choices_list = ''
    # 工数区分定義リストに項目追加
    if def_time[k] == '':
      choices_list += '<option value="{}" selected>{}</option>'.format('#', '-')
    else:
      choices_list += '<option value="{}">{}</option>'.format('#', '-')

    for i in range(def_n):
      if def_time[k] == def_choices_list[i][1]:
        choices_list += '<option value="{}" selected>{}</option>'.format(def_choices_list[i][0], def_choices_list[i][1])
      else:
        choices_list += '<option value="{}">{}</option>'.format(def_choices_list[i][0], def_choices_list[i][1])

    if def_time[k] == '休憩':
      choices_list += '<option value="{}" selected>{}</option>'.format('$', '休憩')
    else:
      choices_list += '<option value="{}">{}</option>'.format('$', '休憩')


    for_list.append('<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="start_time{}" data-precision="5" value={}>'.format(k + 1, str(time_list_start[k])) + '～' + '<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="end_time{}" data-precision="5" value={}>'.format(k + 1, str(time_list_end[k])))
    for_list.append('<select name="def_time{}" class="form-control custom-border mx-auto controlled-input" style="width : 210px;">'.format(k + 1) + choices_list + '</select>')
    for_list.append('<input class="form-control custom-border mx-auto controlled-input" style="width : 210px;" type="text" name="detail_time{}" value="{}">'.format(k + 1, detail_time[k]))
    time_display_list.append(for_list)

  # 次の問い合わせデータ取得
  next_record = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                   work_day2__gt = obj_get.work_day2).order_by('work_day2').first()
  # 次の問い合わせデータあるか確認
  has_next_record = next_record is not None

  # 前の問い合わせデータ取得
  before_record = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                     work_day2__lt = obj_get.work_day2).order_by('-work_day2').first()
  # 前の問い合わせデータあるか確認
  has_before_record = before_record is not None

  # 残業時間初期値定義
  if obj_get.over_time not in ["", None]:
    over_time_default = obj_get.over_time
  else:
    over_time_default = 0


  # 工数合計取得
  time_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

  # 基準合計工数取得
  default_total = default_work_time(obj_get, member_obj)



  # 就業日変更時の処理
  if "edit_day" in request.POST:
    # 指定日に工数データがある場合の処理
    if request.POST['kosu_day'] == '':
      # エラーメッセージ出力
      messages.error(request, '変更する日付を指定して下さい。ERROR096')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 指定日に工数データがある場合の処理
    if request.POST['over_time'] == '':
      # エラーメッセージ出力
      messages.error(request, '残業は空欄で登録できません。ERROR099')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))


    # 日付に変更がある場合の処理
    if request.POST['kosu_day'] != str(obj_get.work_day2):
      # 指定日に工数データがあるか確認
      obj_check = Business_Time_graph.objects.filter(work_day2 = request.POST['kosu_day'])

      # 指定日に工数データがある場合の処理
      if obj_check.exists():
        # エラーメッセージ出力
        messages.error(request, '指定された日は既に工数データが存在します。指定日のデータを削除してから再度実行下さい。ERROR095')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))


    # 作業内容を取得しリストに解凍
    work_list = list(obj_get.time_work)

    # 工数整合性取得
    judgement = judgement_check(work_list, request.POST['work'], request.POST['tyoku'], member_obj, request.POST['over_time'])

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(id = num, \
                                                defaults = {'work_day2' : request.POST['kosu_day'], \
                                                            'tyoku2' : request.POST['tyoku'], \
                                                            'work_time' : request.POST['work'], \
                                                            'over_time' : request.POST['over_time'], \
                                                            'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 時間指定工数削除時の処理
  if "kosu_delete" in request.POST:
    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')
    start_time = request.POST['start_time']
    end_time = request.POST['end_time']

    # 時間指定を空でPOSTした場合の処理
    if start_time == '' or end_time == '':
      # エラーメッセージ出力
      messages.error(request, '時間が指定されていません。ERROR005')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
    
    # 作業開始の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    # 作業終了の時と分取得
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始時間のインデックス取得
    start_indent = int(int(start_time_hour)*12 + int(start_time_min)/5)
    # 作業終了時間のインデックス取得
    end_indent = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 翌日チェック状態
    check = 1 if 'tomorrow_check' in request.POST else 0

    # 削除開始時間が削除終了時間より遅い時間の場合の処理
    if (start_indent > end_indent) and check == 0:
      # エラーメッセージ出力
      messages.error(request, '削除の開始時間が終了時間よりも遅い時間を指定されましたので処理できません。ERROR011')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 日を超えていない場合の処理
    if check == 0:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(start_indent, end_indent):
        work_list[i] = '#'
        detail_list[i] = ''

    # 日を超えている場合の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(start_indent , 288):
        work_list[i] = '#'
        detail_list[i] = ''
      for i in range(end_indent):
        work_list[i] = '#'
        detail_list[i] = ''

    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 工数整合性取得
    judgement = judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)
    # 作業詳細リストを文字列に変更
    detail_list_str = detail_list_summarize(detail_list)


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})


    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 項目指定工数削除時の処理
  if "item_delete" in request.POST:
    # 項目削除釦の項目名取得
    pressed_button = int(request.POST.get('item_delete'))

    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')

    # 日を跨いでいない時の処理
    if kosu_list[pressed_button - 1] < kosu_list[pressed_button]:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[pressed_button - 1], kosu_list[pressed_button]):
        work_list[i] = '#'
        detail_list[i] = ''
    
    # 日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[pressed_button - 1] , 288):
        work_list[i] = '#'
        detail_list[i] = ''

      for i in range(kosu_list[pressed_button]):
        work_list[i] = '#'
        detail_list[i] = ''


    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 工数整合性取得
    judgement = judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)
    # 作業詳細を文字列に変換
    detail_list_str = detail_list_summarize(detail_list)


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 項目作業時間変更時の処理
  if "item_edit" in request.POST:
    # 項目名取得
    pressed_button = request.POST.get('item_edit')
    # 項目ID取得
    edit_id = int(pressed_button[2 : ])

    start_time = request.POST.get('start_time{}'.format(edit_id))
    end_time = request.POST.get('end_time{}'.format(edit_id))


    # 作業開始時間の指定がない場合の処理
    if start_time in ('', None):
      # エラーメッセージ出力
      messages.error(request, '時間が入力されていません。ERROR089')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
    
    # 作業終了時間の指定がない場合の処理
    if end_time in ('', None):
      # エラーメッセージ出力
      messages.error(request, '時間が入力されていません。ERROR090')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 作業詳細に'$'が含まれている場合の処理
    if '$' in request.POST.get('detail_time{}'.format(edit_id)):
      # エラーメッセージ出力
      messages.error(request, '作業詳細に『$』は使用できません。工数編集できませんでした。ERROR093')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))

    # 作業詳細に文字数が100文字以上の場合の処理
    if len(request.POST.get('detail_time{}'.format(edit_id))) >= 100:
      # エラーメッセージ出力
      messages.error(request, '作業詳細は100文字以内で入力して下さい。工数編集できませんでした。ERROR094')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))
  
  
    # 作業開始の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    # 作業終了の時と分取得
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始時間のインデックス取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    # 作業終了時間のインデックス取得
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 作業開始時間と終了時間が同じ場合の処理
    if start_time_ind == end_time_ind:
      # エラーメッセージ出力
      messages.error(request, '入力された作業時間が正しくありません。ERROR088')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))


    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')


    # 変更前の作業時間が日を跨いでいない時の処理
    if kosu_list[edit_id - 1] < kosu_list[edit_id]:
      # 指定された時間の作業内容と作業詳細を消すループ
      for i in range(kosu_list[edit_id - 1], kosu_list[edit_id]):        
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''
        

    # 変更前の作業時間が日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      for i in range(kosu_list[edit_id - 1] , 288):
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''


      for i in range(kosu_list[edit_id]):
        # 作業内容、作業詳細削除
        work_list[i] = '#'
        detail_list[i] = ''


    # 変更後の作業時間が日を跨いでいない時の処理
    if start_time_ind < end_time_ind:
      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(start_time_ind, end_time_ind):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR085')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))
          
    # 変更後の作業時間が日を跨いでいる時の処理
    else:
      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(start_time_ind, 288):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR086')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))

      # 変更後の作業時間に工数データが入力されていないかチェック
      for k in range(end_time_ind):
        # 変更後の作業時間に工数データが入力されている場合の処理
        if work_list[k] != '#':
          if work_list[k] != '$':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR087')
            # このページをリダイレクト
            return redirect(to = '/detail/{}'.format(num))

        # 変更後の作業時間に工数データが入力されていない場合の処理
        else:
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(edit_id))
          detail_list[k] = request.POST.get('detail_time{}'.format(edit_id))

    # 工数整合性取得
    judgement = judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)
    # 作業詳細リストを文字列に変更
    detail_list_str = detail_list_summarize(detail_list)


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 項目作業時間一括変更時の処理
  if "all_edit" in request.POST:
    # 選択したチェックBOXの値取得
    selected_num = [int(k[3:]) for k in request.POST.getlist('opperable')]

    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')


    # 工数入力インデックスリスト定義
    index_list = []
    break_index_list = []
    # 工数入力インデックスリスト作成
    for t in selected_num:
      # 作業可部分の作業時間取得
      start_time = request.POST.get('start_time{}'.format(t))
      end_time = request.POST.get('end_time{}'.format(t))
      # 作業時間の時と分取得
      start_time_hour, start_time_min = time_index(start_time)
      end_time_hour, end_time_min = time_index(end_time)
      # 作業時間のインデックス取得
      start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
      end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)
      
      # 作業可部分の作業時間インデックス格納
      for tt in range(start_time_ind, end_time_ind):
        index_list.append(tt)

    # 作業可以外の部分の作業時間インデックス取得
    for def_t in range(len(time_list_start)):
      if def_t + 1 not in selected_num:
        # 工数区分定義と作業詳細が空欄でない場合の処理
        if not def_time[def_t] == '' and detail_time[def_t] == '':
          # 休憩時間は作業時間被りから除外
          if def_time[def_t] != '休憩':
            # 作業時間の時と分取得 
            start_time_hour, start_time_min = time_index(time_list_start[def_t])
            end_time_hour, end_time_min = time_index(time_list_end[def_t])
            # 作業時間のインデックス取得
            start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
            end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

            # 作業可以外の作業時間インデックス格納
            for def_tt in range(start_time_ind, end_time_ind):
              index_list.append(def_tt)

          # 休憩時間の処理
          else:
            # 作業時間の時と分取得 
            start_time_hour, start_time_min = time_index(time_list_start[def_t])
            end_time_hour, end_time_min = time_index(time_list_end[def_t])
            # 作業時間のインデックス取得
            start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
            end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

            # 休憩時間のインデックス取得
            for def_tt in range(start_time_ind, end_time_ind):
              break_index_list.append(def_tt)

    # 工数入力時間に被りがある場合の処理
    if len(index_list) != len(set(index_list)):
      # エラーメッセージ出力
      messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR085')
      # このページをリダイレクト
      return redirect(to = '/detail/{}'.format(num))


    # 作業可部分の変更を書き込むループ
    for d in selected_num:
      # 作業時間取得
      start_time = request.POST.get('start_time{}'.format(d))
      end_time = request.POST.get('end_time{}'.format(d))

      # 作業開始時間の指定がない場合の処理
      if start_time in ('', None):
        # エラーメッセージ出力
        messages.error(request, '時間が入力されていません。ERROR089')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))
      
      # 作業終了時間の指定がない場合の処理
      if end_time in ('', None):
        # エラーメッセージ出力
        messages.error(request, '時間が入力されていません。ERROR090')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))

      # 作業詳細に'$'が含まれている場合の処理
      if '$' in request.POST.get('detail_time{}'.format(d)):
        # エラーメッセージ出力
        messages.error(request, '作業詳細に『$』は使用できません。工数編集できませんでした。ERROR093')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))

      # 作業詳細に文字数が100文字以上の場合の処理
      if len(request.POST.get('detail_time{}'.format(d))) >= 100:
        # エラーメッセージ出力
        messages.error(request, '作業詳細は100文字以内で入力して下さい。工数編集できませんでした。ERROR094')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))
    
    
      # 作業開始の時と分取得
      start_time_hour, start_time_min = time_index(start_time)
      # 作業終了の時と分取得
      end_time_hour, end_time_min = time_index(end_time)

      # 作業開始時間のインデックス取得
      start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
      # 作業終了時間のインデックス取得
      end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


      # 作業開始時間と終了時間が同じ場合の処理
      if start_time_ind == end_time_ind:
        # エラーメッセージ出力
        messages.error(request, '入力された作業時間が正しくありません。ERROR088')
        # このページをリダイレクト
        return redirect(to = '/detail/{}'.format(num))


      # 変更後の作業時間が日を跨いでいない時の処理
      if start_time_ind < end_time_ind:
        # 変更後の作業時間に工数データが入力されていないかチェック
        for k in range(start_time_ind, end_time_ind):
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(d))
          detail_list[k] = request.POST.get('detail_time{}'.format(d))
            
      # 変更後の作業時間が日を跨いでいる時の処理
      else:
        # 変更後の作業時間に工数データが入力されていないかチェック
        for k in range(start_time_ind, 288):
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(d))
          detail_list[k] = request.POST.get('detail_time{}'.format(d))

        # 変更後の作業時間に工数データが入力されていないかチェック
        for k in range(end_time_ind):
          # 作業内容、作業詳細書き込み
          work_list[k] = request.POST.get('def_time{}'.format(d))
          detail_list[k] = request.POST.get('detail_time{}'.format(d))


    # 工数が入力されていないインデックス取得
    index_list_another = [item for item in range(288) if item not in index_list + break_index_list]
    # 工数が入力されていない部分を消す
    for del_k in index_list_another:
      work_list[del_k] = '#'
      detail_list[del_k] = ''

    # 工数整合性取得
    judgement = judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)
    # 作業詳細リストを文字列に変更
    detail_list_str = detail_list_summarize(detail_list)


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_str, \
                                                 'judgement' : judgement})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 次のデータへ
  if "after" in request.POST:
    # 前のデータ取得
    obj_after = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                   work_day2__gt = obj_get.work_day2).order_by('work_day2').first()
    # 前の工数詳細へ飛ぶ
    return redirect(to = '/detail/{}'.format(obj_after.id))



  # 前のデータへ
  if "before" in request.POST:
    # 前のデータ取得
    obj_before = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                    work_day2__lt = obj_get.work_day2).order_by('-work_day2').first()
    # 前の工数詳細へ飛ぶ
    return redirect(to = '/detail/{}'.format(obj_before.id))



  # HTMLに渡す辞書
  context = {
    'title' : '工数詳細',
    'id' : num,
    'obj_get' : obj_get,
    'over_time_default' : over_time_default,
    'now_day' : str(obj_get.work_day2),
    'time_total' : time_total,
    'default_total' : default_total,
    'time_display_list' : time_display_list,
    'has_next_record' : has_next_record,
    'has_before_record' : has_before_record,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/detail.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数削除画面定義
class KosuDeleteView(DeleteView):
  # モデル、テンプレート、リダイレクト先などを指定
  model = Business_Time_graph
  template_name = 'kosu/delete.html'
  success_url = reverse_lazy('kosu_list', args = [1]) 


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # セッションにログインした従業員番号がない場合の処理
    if not request.session.get('login_No'):
      return redirect('/login')
    try:
      # ログイン者の情報取得
      self.member_obj = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      # ログイン者情報取得できない場合ログイン画面へ
      request.session.clear()
      return redirect('/login')
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    obj_get = self.get_object()
    work_list, detail_list = kosu_sort(obj_get, self.member_obj)
    time_display_list = create_kosu(work_list, detail_list, obj_get, self.member_obj, self.request)
    context['title'] = '工数データ削除'
    context['id'] = self.object.id
    context['time_display_list'] = time_display_list
    context['obj_get'] = obj_get
    return context





#--------------------------------------------------------------------------------------------------------





# 工数集計画面定義
class KosuTotalView(FormView):
    template_name = 'kosu/total.html'
    form_class = kosu_dayForm  # 仮のフォームとして利用していますが、kosu_dayについてはHTMLで取得します。
    success_url = 'total'  # 成功したらどこにリダイレクトするか、適切なURLに変更してください

    # dispatchメソッドをオーバーライドして、リクエストごとにメンバー情報を取得
    def dispatch(self, request, *args, **kwargs):
        member_obj = get_member(request)  # メンバー情報を取得
        if isinstance(member_obj, HttpResponseRedirect):  # リダイレクトが必要な場合
            return member_obj  # リダイレクト応答を返す
        self.member_obj = member_obj  # メンバー情報を保存
        return super().dispatch(request, *args, **kwargs)  # 親クラスのdispatchメソッドを呼び出す

    # 初期データを設定
    def get_initial(self):
        initial = super().get_initial()  # 親クラスのget_initialメソッドを呼び出す
        today = datetime.date.today()  # 今日の日付を取得
        initial['kosu_day'] = str(today)  # kosu_dayの初期値を今日の日付に設定
        return initial  # 初期値を返す

    # GETリクエストの処理
    def get(self, request, *args, **kwargs):
        today = datetime.date.today()
        color_list = [
            'plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 'deepskyblue', 'aqua',
            'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 'lawngreen', 'greenyellow', 'gold',
            'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 'lightsalmon', 'tomato', 'orangered', 'red',
            'deeppink', 'hotpink', 'violet', 'magenta', 'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue',
            'cadetblue', 'mediumseagreen', 'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue',
            'darkblue', 'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon',
            'darkmagenta', 'indigo', 'black'
        ]
        # 今日の日付についての工数データを取得
        kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=today)
        if not kosu_total.exists():  # 今日の工数データが存在しない場合
            graph_item, def_num = get_def_library_data(request.session['input_def'])  # 工数区分定義リストを取得
            graph_list = list(itertools.repeat(0, def_num))  # デフォルトの工数リスト
        else:  # 今日の工数データが存在する場合
            graph_data = kosu_total.first()  # 最初のレコードを取得
            def_name = graph_data.def_ver2 if graph_data.def_ver2 not in ('', None) else request.session['input_def']  # 工数区分定義のバージョンを取得
            graph_item, def_num = get_def_library_data(def_name)  # 工数区分定義リストを取得
            str_list = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')[:def_num]  # 工数区分定義用記号を設定
            graph_list = [graph_data.time_work.count(i) * 5 for i in str_list]  # 工数区分定義別の累積工数を取得

        # コンテキストを設定し、HTMLに渡す
        context = self.get_context_data(graph_item=graph_item, graph_list=graph_list, color_list=color_list, default_day=str(today))
        return self.render_to_response(context)

    # POSTリクエストの処理
    def post(self, request, *args, **kwargs):
        form = self.get_form()
        if form.is_valid():  # フォームが有効な場合
            return self.form_valid(form)  # フォームの有効処理を実行
        else:  # フォームが無効な場合
            return self.form_invalid(form)  # フォームの無効処理を実行

    # フォームが有効な場合の処理
    def form_valid(self, form):
        request = self.request
        
        post_day = request.POST.get('kosu_day')  # フォームから日付を取得
        summarize_type = form.cleaned_data.get('kosu_summarize')  # フォームから集計タイプを取得
        kosu_order = form.cleaned_data.get('kosu_order')  # フォームから並び順を取得
        color_list = [
            'plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 'deepskyblue', 'aqua',
            'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 'lawngreen', 'greenyellow', 'gold',
            'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 'lightsalmon', 'tomato', 'orangered', 'red',
            'deeppink', 'hotpink', 'violet', 'magenta', 'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue',
            'cadetblue', 'mediumseagreen', 'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue',
            'darkblue', 'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon',
            'darkmagenta', 'indigo', 'black'
        ]

        # 集計タイプに基づいて工数データを取得
        if summarize_type == '3':  # 年間工数の場合
            kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day[:4])
        elif summarize_type == '2':  # 月間工数の場合
            kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day[:7])
        else:  # 日付指定の工数の場合
            kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day)

        if not kosu_total.exists():  # 工数データが存在しない場合
            graph_item, def_num = get_def_library_data(request.session['input_def'])  # 工数区分定義リストを取得
            graph_list = list(itertools.repeat(0, def_num))  # デフォルトの工数リスト
        else:  # 工数データが存在する場合
            first_record = kosu_total.first()  # 最初のレコードを取得
            def_name = first_record.def_ver2 if first_record.def_ver2 not in ('', None) else request.session['input_def']  # 工数区分定義のバージョンを取得
            graph_item, def_num = get_def_library_data(def_name)  # 工数区分定義リストを取得
            str_list = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')[:def_num]  # 工数区分定義用記号を設定
            graph_list = accumulate_kosu_data(kosu_total, str_list, def_num)  # 工数区分定義別の累積工数を取得

        if kosu_order == '2':  # 並び替えを行う場合
            color_list, graph_item, graph_list = zip(*sorted(zip(color_list, graph_item, graph_list), key=lambda x: x[2], reverse=True))  # 工数順にソートする

        # コンテキストを設定し、HTMLに渡す
        context = self.get_context_data(form=form, color_list=color_list, graph_item=graph_item, graph_list=graph_list, default_day=post_day, member_obj=self.member_obj)
        return self.render_to_response(context)

    # フォームが無効な場合の処理
    def form_invalid(self, form):
        return self.render_to_response(self.get_context_data(form=form))

    # コンテキストデータを設定
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)  # 親クラスのget_context_dataメソッドを呼び出す
        context.update({
            'title': '工数集計',
            'data': self.member_obj,  # メンバー情報をコンテキストに追加
            'default_day': kwargs.get('default_day', self.initial.get('kosu_day', '')),  # デフォルトの日付をコンテキストに追加
            'graph_list': kwargs.get('graph_list', []),  # グラフリストをコンテキストに追加
            'graph_item': kwargs.get('graph_item', []),  # グラフ項目をコンテキストに追加
            'color_list': kwargs.get('color_list', []),  # カラーリストをコンテキストに追加
            'graph_library': dict(zip(kwargs.get('graph_item', []), kwargs.get('graph_list', []))),  # グラフライブラリをコンテキストに追加
        })
        return context  # コンテキストを返す




#--------------------------------------------------------------------------------------------------------





# カレンダー画面定義
def schedule(request): 
  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  try:
    # ログイン者の情報取得
    member_obj = member.objects.get(employee_no=request.session['login_No'])
  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect('/login')


  # 本日の日付取得
  today = datetime.date.today()



  # GET時の処理
  if (request.method == 'GET'):
    # 本日の年取得
    year = today.year
    # 本日の月取得
    month = today.month

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # GET時のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # GET時のカレンダー設定フォーム定義
    form2 = schedule_timeForm(default_list)

    # 日付リスト作成
    day_list = calendar_day(year, month)

    # 勤務フォーム初期値定義
    form_default_list = {}
    for i in range(37):
      if day_list[i] != '':
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))
        if day_filter.exists():
          day_get = day_filter.first()
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)



  # カレンダー更新時の処理
  if "time_update" in request.POST:
    # 年取得
    year = int(request.POST['year'])
    # 月取得
    month = int(request.POST['month'])

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # POST後のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # POST後のカレンダー設定フォーム定義
    form2 = schedule_timeForm(default_list)

    # 日付リスト作成
    day_list = calendar_day(year, month)

    # 勤務フォーム初期値定義
    form_default_list = {}
    for i in range(37):
      if day_list[i] != '':
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))
        if day_filter.exists():
          day_get = day_filter.first()
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)

    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)



  # 直一括入力の処理
  if "default_tyoku" in request.POST:
    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')

    # 日付リスト作成
    day_list = calendar_day(year, month)

    # 直を一括書き込み
    for ind, dd in enumerate([range(1, 6), range(8, 13), range(15, 20), range(22, 27), range(29, 34), range(36, 37)]):
      for i in dd:
        if day_list[i] != '':
          # 工数データがあるか確認
          work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                           work_day2 = datetime.date(year, month, day_list[i]))

          # 工数データがある場合の処理
          if work_filter.exists():
            # 工数データ取得
            work_get = work_filter.first()
            # ログイン者の情報取得
            member_obj = member.objects.get(employee_no = request.session['login_No'])

            # 工数データに勤務情報がない場合
            if work_get.tyoku2 in (None, ''):
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'tyoku2' : eval('request.POST["tyoku_all_{}"]'.format(ind + 1))})
              
          # 工数データがない場合の処理
          else:
            # 従業員番号に該当するmemberインスタンスを取得
            member_instance = member.objects.get(employee_no = request.session['login_No'])
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'tyoku2' : eval('request.POST["tyoku_all_{}"]'.format(ind + 1)), \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : False})

    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):
      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':
        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.exists():
          # 対応する日付の工数データを取得
          day_get = day_filter.first()
          
          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)
    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)



  # デフォルト勤務入力の処理
  if "default_work" in request.POST:
    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')

    # 日付リスト作成
    day_list = calendar_day(year, month)

    # デフォルトの就業書き込み
    for i in range(37):
      if day_list[i] != '':
        # 工数データがあるか確認
        work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                         work_day2 = datetime.date(year, month, day_list[i]))

        # 工数データがある場合の処理
        if work_filter.exists():
          # 工数データ取得
          work_get = work_filter.first()
          # ログイン者の情報取得
          member_obj = member.objects.get(employee_no = request.session['login_No'])

          # 工数データに勤務情報がない場合
          if work_get.work_time in (None, ''):
            # 平日である場合の処理
            if i in (1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 36, 37):
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'work_time' : '出勤'})

            else:
              # 就業を上書き
              Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                work_day2 = datetime.date(year, month, day_list[i]), \
                  defaults = {'work_time' : '休日'})

        # 工数データがない場合の処理
        else:
          # 従業員番号に該当するmemberインスタンスを取得
          member_instance = member.objects.get(employee_no = request.session['login_No'])
          # 平日である場合の処理
          if i in (1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 29, 30, 31, 32, 33, 36, 37):
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'work_time' : '出勤', \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : False})

          # 休日の場合の処理
          else:
            # 就業データ作成(空の工数データも入れる)
            Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
              work_day2 = datetime.date(year, month, day_list[i]), \
                defaults = {'name' : member_instance, \
                            'work_time' : '休日', \
                            'time_work' : '#'*288, \
                            'detail_work' : '$'*287, \
                            'over_time' : 0, \
                            'judgement' : True})

    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):

      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':
        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.exists():
          # 対応する日付の工数データを取得
          day_get = day_filter.first()

          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)
    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)



  # 勤務登録時の処理
  if "work_update" in request.POST:
    # カレンダー設定フォーム定義
    form2 = schedule_timeForm(request.POST)

    # カレンダーの年、月取得
    year = request.session.get('update_year', '')
    month = request.session.get('update_month', '')
    
    # 日付リスト作成
    day_list = calendar_day(year, month)

    # 就業を上書き
    for i in range(37):
      if day_list[i] != '':
        # 工数データがあるか確認
        work_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                         work_day2 = datetime.date(year, month, day_list[i]))

        # 工数データがある場合の処理
        if work_filter.exists():
          # 工数データ取得
          work_get = work_filter.first()
          # ログイン者の情報取得
          member_obj = member.objects.get(employee_no = request.session['login_No'])

          # 工数合計取得
          kosu_total = 1440 - (work_get.time_work.count('#')*5) - (work_get.time_work.count('$')*5)

          # 整合性取得
          judgement = judgement_check(list(work_get.time_work), eval('request.POST["day{}"]'.format(i + 1)), eval('request.POST["tyoku{}"]'.format(i + 1)), member_obj, work_get.over_time)

          # 就業を上書き
          Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
            work_day2 = datetime.date(year, month, day_list[i]), \
              defaults = {'work_time' : eval('request.POST["day{}"]'.format(i + 1)), \
                          'tyoku2' : eval('request.POST["tyoku{}"]'.format(i + 1)), \
                          'judgement' : judgement})

          # 更新後の就業を取得
          record_del = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                                                       work_day2 = datetime.date(year, month, day_list[i]))

          # 更新後、就業が消されていて工数データが空であればレコードを消す
          if record_del.work_time == '' and record_del.over_time == 0 and \
            record_del.time_work == '#'*288:

            # レコード削除
            record_del.delete()

        # 工数データがなくPOSTした値が空欄でない場合の処理
        if eval('request.POST["day{}"]'.format(i + 1)) != '' and work_filter.count() == 0:
          # 整合性取得
          judgement = judgement_check(list(itertools.repeat('#', 288)), eval('request.POST["day{}"]'.format(i + 1)), eval('request.POST["tyoku{}"]'.format(i + 1)), member_obj, 0)

          # 従業員番号に該当するmemberインスタンスを取得
          member_instance = member.objects.get(employee_no = request.session['login_No'])

          # 就業データ作成(空の工数データも入れる)
          Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
            work_day2 = datetime.date(year, month, day_list[i]), \
              defaults = {'name' : member_instance, \
                          'work_time' : eval('request.POST["day{}"]'.format(i + 1)), \
                          'tyoku2' : eval('request.POST["tyoku{}"]'.format(i + 1)), \
                          'time_work' : '#'*288, \
                          'detail_work' : '$'*287, \
                          'over_time' : 0, \
                          'judgement' : judgement})


    # 勤務フォーム初期値リセット
    form_default_list = {}

    # 勤務フォーム初期値定義
    for i in range(37):

      # 日付リストに日付が入っている場合の処理
      if day_list[i] != '':

        # 対応する日付に工数データがあるか確認
        day_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                        work_day2 = datetime.date(year, month, day_list[i]))

        # 対応する日付に工数データがある場合の処理
        if day_filter.exists():
          # 対応する日付の工数データを取得
          day_get = day_filter.first()
          
          # 就業データを初期値リストに入れる
          form_default_list[('day{}'.format(i + 1))] = day_get.work_time
          form_default_list[('tyoku{}'.format(i + 1))] = day_get.tyoku2

    # 勤務フォーム定義
    form = scheduleForm(form_default_list)



  # 入力工数表示リセット
  time_list1 = []
  time_list2 = []
  time_list3 = []
  time_list4 = []
  time_list5 = []
  time_list6 = []
  time_list7 = []
  time_list8 = []
  time_list9 = []
  time_list10 = []
  time_list11 = []
  time_list12 = []
  time_list13 = []
  time_list14 = []
  time_list15 = []
  time_list16 = []
  time_list17 = []
  time_list18 = []
  time_list19 = []
  time_list20 = []
  time_list21 = []
  time_list22 = []
  time_list23 = []
  time_list24 = []
  time_list25 = []
  time_list26 = []
  time_list27 = []
  time_list28 = []
  time_list29 = []
  time_list30 = []
  time_list31 = []
  time_list32 = []
  time_list33 = []
  time_list34 = []
  time_list35 = []
  time_list36 = []
  time_list37 = []
  title_list = ['time_list1', 'time_list2', 'time_list3', 'time_list4', \
                'time_list5', 'time_list6', 'time_list7', 'time_list8', \
                'time_list9', 'time_list10', 'time_list11', 'time_list12', \
                'time_list13', 'time_list14', 'time_list15', 'time_list16', \
                'time_list17', 'time_list18', 'time_list19', 'time_list20', \
                'time_list21', 'time_list22', 'time_list23', 'time_list24', \
                'time_list25', 'time_list26', 'time_list27', 'time_list28', \
                'time_list29', 'time_list30', 'time_list31', 'time_list32', \
                'time_list33', 'time_list34', 'time_list35', 'time_list36', \
                'time_list37'
                ]
    
  # 工数入力データ取得
  for i, k in  enumerate(title_list):

    # 日付リストの該当要素が空でない場合の処理
    if day_list[i] != '':
      # ログイン者の工数データを該当日でフィルター 
      graph_data_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                          work_day2 = datetime.date(year, month, day_list[i]))

      # 工数データがない場合の処理
      if not graph_data_filter.exists():
        # カレンダー工数表示リストに空の値を入れる
        for p in range(4):
          eval(k).append('　')

      # 工数データがある場合の処理
      else:
        # ログイン者の該当日の工数データ取得
        graph_data_get = Business_Time_graph.objects.get(employee_no3 = request.session['login_No'], \
                          work_day2 =datetime.date(year, month, day_list[i]))
        # 作業内容リストに解凍
        data_list = list(graph_data_get.time_work)
       
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
        # ローカルの変数取得
        ns = locals()
        # 取得したインデックスを時間表示に変換
        ns[k] = index_change(start_index1, end_index1, ns[k])
        ns[k] = index_change(start_index2, end_index2, ns[k])
        ns[k] = index_change(start_index3, end_index3, ns[k])
        ns[k] = index_change(start_index4, end_index4, ns[k])

  # 工数入力OKリスト作成
  OK_NG_list = OK_NF_check(year, month, day_list, member_obj)


  
  # HTMLに渡す辞書
  context = {
    'title' : '勤務入力',
    'form' : form,
    'form2' : form2,
    'day_list' : day_list,
    'OK_NG_list' : OK_NG_list,
    'time_list1': time_list1,
    'time_list2': time_list2,
    'time_list3': time_list3,
    'time_list4': time_list4,
    'time_list5': time_list5,
    'time_list6': time_list6,
    'time_list7': time_list7,
    'time_list8': time_list8,
    'time_list9': time_list9,
    'time_list10': time_list10,
    'time_list11': time_list11,
    'time_list12': time_list12,
    'time_list13': time_list13,
    'time_list14': time_list14,
    'time_list15': time_list15,
    'time_list16': time_list16,
    'time_list17': time_list17,
    'time_list18': time_list18,
    'time_list19': time_list19,
    'time_list20': time_list20,
    'time_list21': time_list21,
    'time_list22': time_list22,
    'time_list23': time_list23,
    'time_list24': time_list24,
    'time_list25': time_list25,
    'time_list26': time_list26,
    'time_list27': time_list27,
    'time_list28': time_list28,
    'time_list29': time_list29,
    'time_list30': time_list30,
    'time_list31': time_list31,
    'time_list32': time_list32,
    'time_list33': time_list33,
    'time_list34': time_list34,
    'time_list35': time_list35,
    'time_list36': time_list36,
    'time_list37': time_list37, 
  }



  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/schedule.html', context)





#--------------------------------------------------------------------------------------------------------





# 残業管理画面定義
def over_time(request):
   # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  try:
    # ログイン者の情報取得
    member_obj = member.objects.get(employee_no=request.session['login_No'])
  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect('/login')


  # 本日の日付取得
  today = datetime.date.today()



  # GET時の処理
  if (request.method == 'GET'):
    # 本日の年取得
    year = today.year
    # 本日の月取得
    month = today.month

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # GET時のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # GET時のカレンダー設定フォーム定義
    form = schedule_timeForm(default_list)

    # 日付リスト作成
    day_list = calendar_day(year, month)



  # POST時の処理
  if (request.method == 'POST'):
    # POSTされたの年取得
    year = int(request.POST['year'])
    # POSTされたの月取得
    month = int(request.POST['month'])

    # 表示月をセッションに登録
    request.session['update_year'] = year
    request.session['update_month'] = month

    # POST時のカレンダー設定フォームの初期値設定
    default_list = {'year' : year, 'month' : month}
    # POST時のカレンダー設定フォーム定義
    form = schedule_timeForm(default_list)

    # 日付リスト作成
    day_list = calendar_day(year, month)



  # 残業リストリセット
  over_time_list = []
  over_time_total = 0

  # 工数入力データ取得
  for i in  day_list:

    # 日付リストの該当要素が空でない場合の処理
    if i != '':
      # ログイン者の工数データを該当日でフィルター 
      over_time_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                             work_day2 = datetime.date(year, month, i))

      # 工数データがない場合の処理
      if not over_time_filter.exists():
        # 残業リストに0を追加
        over_time_list.append('0')

      # 工数データある場合の処理
      else:
        # 工数データ取得
        over_time_get = over_time_filter.first()

        # 残業データを分から時に変換
        over_time_get.over_time = int(over_time_get.over_time)/60
        over_time_total += over_time_get.over_time

        # 残業リストに残業追加
        over_time_list.append(over_time_get.over_time)    

    # 日付リストの該当要素が空の場合の処理
    else:
      # 残業リストに空を入れる
      over_time_list.append('')


  # 工数入力OKリスト作成
  OK_NG_list = OK_NF_check(year, month, day_list, member_obj)



  # HTMLに渡す辞書
  context = {
    'title' : '残業管理',
    'form' : form,
    'day_list' : day_list, 
    'over_time_list' : over_time_list,
    'OK_NG_list' : OK_NG_list,
    'over_time_total' : over_time_total,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/over_time.html', context)





#--------------------------------------------------------------------------------------------------------





# 全工数操作画面定義
def all_kosu(request, num):
  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in [page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3]:
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')


  # 工数データのある従業員番号リスト作成
  employee_no_list = Business_Time_graph.objects.values_list('employee_no3', flat=True)\
                     .order_by('employee_no3').distinct()
  
  # 名前リスト定義
  name_list = [['', '']]

  # 従業員番号を名前に変更するループ
  for No in list(employee_no_list):
    try:
      # 指定従業員番号で人員情報取得
      name = member.objects.get(employee_no = No)
      # 名前リスト作成
      name_list.append([No, name])
    # 人員情報取得できない場合の処理
    except member.DoesNotExist:
      #何もしない
      pass



  # 検索時の処理
  if 'kosu_find' in request.POST:
    # 従業員番号リスト定義
    employee_no_name_list = []

    # ショップ指定ある場合の処理
    if request.POST['shop'] != '':
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.filter(shop = request.POST['shop']).values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # ショップ指定ある場合の処理
    else:
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.all().values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # 整合性OKをPOSTした場合の処理
    if request.POST['OK_NG'] == 'OK':
      judgement = [True]
    
    # 整合性NGをPOSTした場合の処理
    elif request.POST['OK_NG'] == 'NG':
      judgement = [False]

    # 整合性で空欄をPOSTした場合の処理
    else:
      judgement = [True, False]


    # ID指定している場合の処理
    if request.POST['identification'] != '':

      try:
        # 工数データ取得
        obj = Business_Time_graph.objects.filter(id = request.POST['identification'], \
                                                employee_no3__contains = request.POST['name'], \
                                                employee_no3__in = employee_no_name_list, \
                                                work_day2__gte = request.POST['start_day'], \
                                                work_day2__lte = request.POST['end_day'], \
                                                tyoku2__contains = request.POST['tyoku'], \
                                                work_time__contains = request.POST['work'], \
                                                judgement__in = judgement, \
                                                ).order_by('work_day2', 'employee_no3').reverse()

      # エラー時の処理
      except:
        # 工数データ取得
        obj = Business_Time_graph.objects.filter(id = request.POST['identification'], \
                                                employee_no3__contains = request.POST['name'], \
                                                employee_no3__in = employee_no_name_list, \
                                                tyoku2__contains = request.POST['tyoku'], \
                                                work_time__contains = request.POST['work'], \
                                                judgement__in = judgement, \
                                                ).order_by('work_day2', 'employee_no3').reverse()

    # ID指定していない場合の処理 
    else:
      try:
        # 工数データ取得
        obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                                employee_no3__in = employee_no_name_list, \
                                                work_day2__gte = request.POST['start_day'], \
                                                work_day2__lte = request.POST['end_day'], \
                                                tyoku2__contains = request.POST['tyoku'], \
                                                work_time__contains = request.POST['work'], \
                                                judgement__in = judgement, \
                                                ).order_by('work_day2', 'employee_no3').reverse()
        
      # エラー時の処理
      except:
        # 工数データ取得
        obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                                employee_no3__in = employee_no_name_list, \
                                                tyoku2__contains = request.POST['tyoku'], \
                                                work_time__contains = request.POST['work'], \
                                                judgement__in = judgement, \
                                                ).order_by('work_day2', 'employee_no3').reverse()



    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj, 500)


    # フォーム定義
    form = all_kosu_findForm(request.POST)
    # フォーム選択肢定義
    form.fields['name'].choices = name_list

    # 日付初期値保持
    default_start_day = str(request.POST['start_day'])
    default_end_day = str(request.POST['end_day'])



  # 検索結果削除
  if 'kosu_delete' in request.POST:
    # 従業員番号リスト定義
    employee_no_name_list = []

    # ショップ指定ある場合の処理
    if request.POST['shop'] != '':
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.filter(shop = request.POST['shop']).values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # ショップ指定ある場合の処理
    else:
      # ショップ指定し工数データのある従業員番号リスト作成
      member_shop_list = member.objects.all().values_list('employee_no', flat=True)

      # 従業員番号リスト作成ループ
      for No in list(member_shop_list):
        # 従業員番号追加
        employee_no_name_list.append(No)

    # 整合性OKをPOSTした場合の処理
    if request.POST['OK_NG'] == 'OK':
      judgement = [True]
    
    # 整合性NGをPOSTした場合の処理
    elif request.POST['OK_NG'] == 'NG':
      judgement = [False]

    # 整合性で空欄をPOSTした場合の処理
    else:
      judgement = [True, False]



    try:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              work_day2__gte = request.POST['start_day'], \
                                              work_day2__lte = request.POST['end_day'], \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()

    # エラー時の処理
    except:
      # 工数データ取得
      obj = Business_Time_graph.objects.filter(employee_no3__contains = request.POST['name'], \
                                              employee_no3__in = employee_no_name_list, \
                                              tyoku2__contains = request.POST['tyoku'], \
                                              work_time__contains = request.POST['work'], \
                                              judgement__in = judgement, \
                                              ).order_by('work_day2', 'employee_no3').reverse()

    # 検索レコード削除
    obj.delete()
    # このページ読み直し
    return redirect(to = '/all_kosu/1')


  # GET時の処理
  if (request.method == 'GET'):
    # 全工数データを取得
    obj = Business_Time_graph.objects.all().order_by('work_day2', 'employee_no3').reverse()
    # 取得した工数データを1ページあたりの件数分取得
    data = Paginator(obj, 500)

    # 今日の日時取得
    today = datetime.date.today()
    # 日付フォーム初期値定義
    default_start_day = str(today)
    default_end_day = str(today)

    # フォーム定義
    form = all_kosu_findForm(request.POST)
    # フォーム選択肢定義
    form.fields['name'].choices = name_list



  # HTMLに渡す辞書
  context = {
    'title' : '全工数履歴',
    'data' : data.get_page(num),
    'default_start_day' : default_start_day,
    'default_end_day' : default_end_day,
    'form' : form,
    'num' : num,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数編集画面定義
def all_kosu_detail(request, num):
  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in (page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3):
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')
  

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)


  # 工数定義区分Verリスト作成
  Ver_list = kosu_division.objects.values_list('kosu_name', flat=True)\
                    .order_by('id').distinct()

  # 工数定義区分Verリスト定義
  Ver_choose = []

  # 工数定義区分Verを名前に変更するループ
  for No in list(Ver_list):
    # 名前リスト作成
    Ver_choose.append([No, No])



  # POST時の処理
  if (request.method == 'POST'):
    # フォーム定義
    form = all_kosuForm(request.POST)

    # フォーム選択肢定義
    form.fields['def_ver'].choices = Ver_choose

    # 作業内容整形
    time_work = request.POST['time_work0'] + \
                request.POST['time_work1'] + \
                request.POST['time_work2'] + \
                request.POST['time_work3'] + \
                request.POST['time_work4'] + \
                request.POST['time_work5'] + \
                request.POST['time_work6'] + \
                request.POST['time_work7'] + \
                request.POST['time_work8'] + \
                request.POST['time_work9'] + \
                request.POST['time_work10'] + \
                request.POST['time_work11'] + \
                request.POST['time_work12'] + \
                request.POST['time_work13'] + \
                request.POST['time_work14'] + \
                request.POST['time_work15'] + \
                request.POST['time_work16'] + \
                request.POST['time_work17'] + \
                request.POST['time_work18'] + \
                request.POST['time_work19'] + \
                request.POST['time_work20'] + \
                request.POST['time_work21'] + \
                request.POST['time_work22'] + \
                request.POST['time_work23']

    # 作業詳細整形
    detail_work = request.POST['detail_work0'] + '$' +\
                  request.POST['detail_work1'] + '$' +\
                  request.POST['detail_work2'] + '$' +\
                  request.POST['detail_work3'] + '$' +\
                  request.POST['detail_work4'] + '$' +\
                  request.POST['detail_work5'] + '$' +\
                  request.POST['detail_work6'] + '$' +\
                  request.POST['detail_work7'] + '$' +\
                  request.POST['detail_work8'] + '$' +\
                  request.POST['detail_work9'] + '$' +\
                  request.POST['detail_work10'] + '$' +\
                  request.POST['detail_work11'] + '$' +\
                  request.POST['detail_work12'] + '$' +\
                  request.POST['detail_work13'] + '$' +\
                  request.POST['detail_work14'] + '$' +\
                  request.POST['detail_work15'] + '$' +\
                  request.POST['detail_work16'] + '$' +\
                  request.POST['detail_work17'] + '$' +\
                  request.POST['detail_work18'] + '$' +\
                  request.POST['detail_work19'] + '$' +\
                  request.POST['detail_work20'] + '$' +\
                  request.POST['detail_work21'] + '$' +\
                  request.POST['detail_work22'] + '$' +\
                  request.POST['detail_work23']


    # POSTした従業員番号があるか確認
    member_filter = member.objects.filter(employee_no = request.POST['employee_no'])

    # 従業員番号がない場合の処理
    if not member_filter.exists():
      # エラーメッセージ出力
      messages.error(request, 'その従業員番号は人員データにありません。ERROR092')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 従業員番号か就業日が空欄の場合の処理
    if (request.POST['employee_no'] in (None, '')) or (request.POST['work_day'] in (None, '')):
      # エラーメッセージ出力
      messages.error(request, '従業員番号か就業日が未入力です。ERROR100')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 12桁の#とアルファベットの小文字、大文字の文字列の正規表現パターン
    pattern = r'^[a-zA-Z#]{12}$'

    # 0時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work0']):
      # エラーメッセージ出力
      messages.error(request, '0時台の作業内容の入力値が不適切です。ERROR101')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 1時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work1']):
      # エラーメッセージ出力
      messages.error(request, '1時台の作業内容の入力値が不適切です。ERROR102')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 2時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work2']):
      # エラーメッセージ出力
      messages.error(request, '2時台の作業内容の入力値が不適切です。ERROR103')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 3時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work3']):
      # エラーメッセージ出力
      messages.error(request, '3時台の作業内容の入力値が不適切です。ERROR104')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 4時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work4']):
      # エラーメッセージ出力
      messages.error(request, '4時台の作業内容の入力値が不適切です。ERROR105')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 5時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work5']):
      # エラーメッセージ出力
      messages.error(request, '5時台の作業内容の入力値が不適切です。ERROR106')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 6時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work6']):
      # エラーメッセージ出力
      messages.error(request, '6時台の作業内容の入力値が不適切です。ERROR107')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 7時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work7']):
      # エラーメッセージ出力
      messages.error(request, '7時台の作業内容の入力値が不適切です。ERROR108')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 8時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work8']):
      # エラーメッセージ出力
      messages.error(request, '8時台の作業内容の入力値が不適切です。ERROR109')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 9時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work9']):
      # エラーメッセージ出力
      messages.error(request, '9時台の作業内容の入力値が不適切です。ERROR110')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 10時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work10']):
      # エラーメッセージ出力
      messages.error(request, '10時台の作業内容の入力値が不適切です。ERROR111')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 11時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work11']):
      # エラーメッセージ出力
      messages.error(request, '11時台の作業内容の入力値が不適切です。ERROR112')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 12時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work12']):
      # エラーメッセージ出力
      messages.error(request, '12時台の作業内容の入力値が不適切です。ERROR113')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 13時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work13']):
      # エラーメッセージ出力
      messages.error(request, '13時台の作業内容の入力値が不適切です。ERROR114')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 14時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work14']):
      # エラーメッセージ出力
      messages.error(request, '14時台の作業内容の入力値が不適切です。ERROR115')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 15時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work15']):
      # エラーメッセージ出力
      messages.error(request, '15時台の作業内容の入力値が不適切です。ERROR116')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 16時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work16']):
      # エラーメッセージ出力
      messages.error(request, '16時台の作業内容の入力値が不適切です。ERROR117')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 17時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work17']):
      # エラーメッセージ出力
      messages.error(request, '17時台の作業内容の入力値が不適切です。ERROR118')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 18時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work18']):
      # エラーメッセージ出力
      messages.error(request, '18時台の作業内容の入力値が不適切です。ERROR119')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 19時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work19']):
      # エラーメッセージ出力
      messages.error(request, '19時台の作業内容の入力値が不適切です。ERROR120')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 20時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work20']):
      # エラーメッセージ出力
      messages.error(request, '20時台の作業内容の入力値が不適切です。ERROR121')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 21時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work21']):
      # エラーメッセージ出力
      messages.error(request, '21時台の作業内容の入力値が不適切です。ERROR122')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 22時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work22']):
      # エラーメッセージ出力
      messages.error(request, '22時台の作業内容の入力値が不適切です。ERROR123')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 23時台の作業内容の入力値が不適切な場合の処理
    if not re.fullmatch(pattern, request.POST['time_work23']):
      # エラーメッセージ出力
      messages.error(request, '23時台の作業内容の入力値が不適切です。ERROR124')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 0時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work0'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '0時台の作業内容の入力値が不適切です。ERROR125')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 1時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work1'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '1時台の作業内容の入力値が不適切です。ERROR126')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 2時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work2'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '2時台の作業内容の入力値が不適切です。ERROR127')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 3時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work3'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '3時台の作業内容の入力値が不適切です。ERROR128')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 4時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work4'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '4時台の作業内容の入力値が不適切です。ERROR129')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 5時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work5'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '5時台の作業内容の入力値が不適切です。ERROR130')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 6時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work6'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '6時台の作業内容の入力値が不適切です。ERROR131')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 7時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work7'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '7時台の作業内容の入力値が不適切です。ERROR132')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 8時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work8'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '8時台の作業内容の入力値が不適切です。ERROR133')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 9時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work9'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '9時台の作業内容の入力値が不適切です。ERROR134')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 10時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work10'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '10時台の作業内容の入力値が不適切です。ERROR135')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 11時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work11'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '11時台の作業内容の入力値が不適切です。ERROR136')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 12時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work12'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '12時台の作業内容の入力値が不適切です。ERROR137')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 13時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work13'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '13時台の作業内容の入力値が不適切です。ERROR138')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 14時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work14'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '14時台の作業内容の入力値が不適切です。ERROR139')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 15時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work15'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '15時台の作業内容の入力値が不適切です。ERROR140')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 16時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work16'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '16時台の作業内容の入力値が不適切です。ERROR141')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 17時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work17'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '17時台の作業内容の入力値が不適切です。ERROR142')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 18時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work18'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '18時台の作業内容の入力値が不適切です。ERROR143')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 19時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work19'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '19時台の作業内容の入力値が不適切です。ERROR144')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 20時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work20'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '20時台の作業内容の入力値が不適切です。ERROR145')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 21時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work21'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '21時台の作業内容の入力値が不適切です。ERROR146')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 22時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work22'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '22時台の作業内容の入力値が不適切です。ERROR147')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 23時台の作業詳細の入力値が不適切な場合の処理
    if request.POST['detail_work23'].count('$') != 11:
      # エラーメッセージ出力
      messages.error(request, '23時台の作業内容の入力値が不適切です。ERROR148')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業が5の倍数でない場合の処理
    if int(request.POST['over_time']) % 5 != 0:
      # エラーメッセージ出力
      messages.error(request, '残業の入力値が5の倍数ではありません。ERROR149')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # #と8桁の数字の文字列の正規表現パターン
    pattern2 = r'^#([0-9]{8})$'
    match = re.fullmatch(pattern2, request.POST['breaktime'])
    match2 = re.fullmatch(pattern2, request.POST['breaktime_over1'])
    match3 = re.fullmatch(pattern2, request.POST['breaktime_over2'])
    match4 = re.fullmatch(pattern2, request.POST['breaktime_over3'])

    # 昼休憩の入力値の形式が不適切な場合の処理
    if not match:
      # エラーメッセージ出力
      messages.error(request, '昼休憩の記入が#+数字8桁の形式になっていません。ERROR150')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間1の入力値の形式が不適切な場合の処理
    if not match2:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間1の記入が#+数字8桁の形式になっていません。ERROR151')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間2の入力値の形式が不適切な場合の処理
    if not match3:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間2の記入が#+数字8桁の形式になっていません。ERROR152')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間3の入力値の形式が不適切な場合の処理
    if not match4:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間3の記入が#+数字8桁の形式になっていません。ERROR153')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 休憩時間の数字部分を抽出
    number_part = str(match.group(1))
    number_part_1 = int(number_part[ : 2])
    number_part_2 = int(number_part[2 : 4])
    number_part_3 = int(number_part[4 : 6])
    number_part_4 = int(number_part[6 : ]) 
    number_part2 = str(match2.group(1))
    number_part2_1 = int(number_part2[ : 2])
    number_part2_2 = int(number_part2[2 : 4])
    number_part2_3 = int(number_part2[4 : 6])
    number_part2_4 = int(number_part2[6 : ]) 
    number_part3 = str(match3.group(1))
    number_part3_1 = int(number_part3[ : 2])
    number_part3_2 = int(number_part3[2 : 4])
    number_part3_3 = int(number_part3[4 : 6])
    number_part3_4 = int(number_part3[6 : ]) 
    number_part4 = str(match4.group(1))
    number_part4_1 = int(number_part4[ : 2])
    number_part4_2 = int(number_part4[2 : 4])
    number_part4_3 = int(number_part4[4 : 6])
    number_part4_4 = int(number_part4[6 : ]) 

    # 昼休憩時間の設定が60進数の入力でないか5分刻みの数字でない場合の処理
    if number_part_1 < 0 or number_part_1 > 23 or number_part_2 < 0 or number_part_2 > 55 or number_part_2 % 5 != 0 or\
      number_part_3 < 0 or number_part_3 > 23 or number_part_4 < 0 or number_part_4 > 55 or number_part_4 % 5 != 0:
      # エラーメッセージ出力
      messages.error(request, '昼休憩時間の設定が60進数の入力でないか5分刻みの数字ではありません。ERROR154')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間1の設定が60進数の入力でないか5分刻みの数字でない場合の処理
    if number_part2_1 < 0 or number_part2_1 > 23 or number_part2_2 < 0 or number_part2_2 > 55 or number_part2_2 % 5 != 0 or\
      number_part2_3 < 0 or number_part2_3 > 23 or number_part2_4 < 0 or number_part2_4 > 55 or number_part2_4 % 5 != 0:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間1の設定が60進数の入力でないか5分刻みの数字ではありません。ERROR155')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間2の設定が60進数の入力でないか5分刻みの数字でない場合の処理
    if number_part3_1 < 0 or number_part3_1 > 23 or number_part3_2 < 0 or number_part3_2 > 55 or number_part3_2 % 5 != 0 or\
      number_part3_3 < 0 or number_part3_3 > 23 or number_part3_4 < 0 or number_part3_4 > 55 or number_part3_4 % 5 != 0:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間2の設定が60進数の入力でないか5分刻みの数字ではありません。ERROR156')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 残業休憩時間3の設定が60進数の入力でないか5分刻みの数字でない場合の処理
    if number_part4_1 < 0 or number_part4_1 > 23 or number_part4_2 < 0 or number_part4_2 > 55 or number_part4_2 % 5 != 0 or\
      number_part4_3 < 0 or number_part4_3 > 23 or number_part4_4 < 0 or number_part4_4 > 55 or number_part4_4 % 5 != 0:
      # エラーメッセージ出力
      messages.error(request, '残業休憩時間3の設定が60進数の入力でないか5分刻みの数字ではありません。ERROR157')
      # このページをリダイレクト
      return redirect(to = '/all_kosu_detail/{}'.format(num))

    # 従業員番号か日付に変更があった場合の処理
    if request.POST['employee_no'] != request.session['memory_No'] or \
      str(request.POST['work_day']) != request.session['memory_day']:
      # 変更後の日付に工数データがあるか確認
      obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.POST['employee_no'], \
                                                      work_day2 = request.POST['work_day'])
      
      if obj_filter.exists():
        # エラーメッセージ出力
        messages.error(request, 'その日付には既に工数データがあります。ERROR091')
        # このページをリダイレクト
        return redirect(to = '/all_kosu_detail/{}'.format(num))
      
      # 工数データがない場合の処理
      else:
        # 元の工数データ削除
        obj_get.delete()

    # 従業員番号に該当するmemberインスタンスを取得
    member_instance = member.objects.get(employee_no = request.POST['employee_no'])

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.POST['employee_no'], \
                                                 work_day2 = request.POST['work_day'], \
                                                 defaults = {'name' : member_instance, \
                                                             'def_ver2' : request.POST['def_ver'], \
                                                             'work_time' : request.POST['work_time'], \
                                                             'tyoku2' : request.POST['tyoku'], \
                                                             'time_work' : time_work, \
                                                             'detail_work' : detail_work, \
                                                             'over_time' : request.POST['over_time'], \
                                                             'breaktime' : request.POST['breaktime'], \
                                                             'breaktime_over1' : request.POST['breaktime_over1'], \
                                                             'breaktime_over2' : request.POST['breaktime_over2'], \
                                                             'breaktime_over3' : request.POST['breaktime_over3'], \
                                                             'judgement' : 'judgement' in request.POST, \
                                                             'break_change' : 'break_change' in request.POST})

    default_day = str(request.POST['work_day'])



  # POST時以外の処理
  else:
    # 日付初期値
    default_day = obj_get.work_day2

    # 変更前従業員番号記憶
    request.session['memory_No'] = str(obj_get.employee_no3)
    # 変更前日付記憶
    request.session['memory_day'] = str(obj_get.work_day2)

    # 作業詳細を取得しリストに解凍
    detail_list = obj_get.detail_work.split('$')

    # 時間帯作業分け
    work_list0 = obj_get.time_work[ : 12]
    work_list1 = obj_get.time_work[12 : 24]
    work_list2 = obj_get.time_work[24 : 36]
    work_list3 = obj_get.time_work[36 : 48]
    work_list4 = obj_get.time_work[48 : 60]
    work_list5 = obj_get.time_work[60 : 72]
    work_list6 = obj_get.time_work[72 : 84]
    work_list7 = obj_get.time_work[84 : 96]
    work_list8 = obj_get.time_work[96 : 108]
    work_list9 = obj_get.time_work[108 : 120]
    work_list10 = obj_get.time_work[120 : 132]
    work_list11 = obj_get.time_work[132 : 144]
    work_list12 = obj_get.time_work[144 : 156]
    work_list13 = obj_get.time_work[156 : 168]
    work_list14 = obj_get.time_work[168 : 180]
    work_list15 = obj_get.time_work[180 : 192]
    work_list16 = obj_get.time_work[192 : 204]
    work_list17 = obj_get.time_work[204 : 216]
    work_list18 = obj_get.time_work[216 : 228]
    work_list19 = obj_get.time_work[228 : 240]
    work_list20 = obj_get.time_work[240 : 252]
    work_list21 = obj_get.time_work[252 : 264]
    work_list22 = obj_get.time_work[264 : 276]
    work_list23 = obj_get.time_work[276 : ]
    detail_list0 = detail_list[ : 12]
    detail_list1 = detail_list[12 : 24]
    detail_list2 = detail_list[24 : 36]
    detail_list3 = detail_list[36 : 48]
    detail_list4 = detail_list[48 : 60]
    detail_list5 = detail_list[60 : 72]
    detail_list6 = detail_list[72 : 84]
    detail_list7 = detail_list[84 : 96]
    detail_list8 = detail_list[96 : 108]
    detail_list9 = detail_list[108 : 120]
    detail_list10 = detail_list[120 : 132]
    detail_list11 = detail_list[132 : 144]
    detail_list12 = detail_list[144 : 156]
    detail_list13 = detail_list[156 : 168]
    detail_list14 = detail_list[168 : 180]
    detail_list15 = detail_list[180 : 192]
    detail_list16 = detail_list[192 : 204]
    detail_list17 = detail_list[204 : 216]
    detail_list18 = detail_list[216 : 228]
    detail_list19 = detail_list[228 : 240]
    detail_list20 = detail_list[240 : 252]
    detail_list21 = detail_list[252 : 264]
    detail_list22 = detail_list[264 : 276]
    detail_list23 = detail_list[276 : ]

    # 作業詳細リストを文字列に変更
    detail_list_str0 = detail_list_summarize(detail_list0)
    detail_list_str1 = detail_list_summarize(detail_list1)
    detail_list_str2 = detail_list_summarize(detail_list2)
    detail_list_str3 = detail_list_summarize(detail_list3)
    detail_list_str4 = detail_list_summarize(detail_list4)
    detail_list_str5 = detail_list_summarize(detail_list5)
    detail_list_str6 = detail_list_summarize(detail_list6)
    detail_list_str7 = detail_list_summarize(detail_list7)
    detail_list_str8 = detail_list_summarize(detail_list8)
    detail_list_str9 = detail_list_summarize(detail_list9)
    detail_list_str10 = detail_list_summarize(detail_list10)
    detail_list_str11 = detail_list_summarize(detail_list11)
    detail_list_str12 = detail_list_summarize(detail_list12)
    detail_list_str13 = detail_list_summarize(detail_list13)
    detail_list_str14 = detail_list_summarize(detail_list14)
    detail_list_str15 = detail_list_summarize(detail_list15)
    detail_list_str16 = detail_list_summarize(detail_list16)
    detail_list_str17 = detail_list_summarize(detail_list17)
    detail_list_str18 = detail_list_summarize(detail_list18)
    detail_list_str19 = detail_list_summarize(detail_list19)
    detail_list_str20 = detail_list_summarize(detail_list20)
    detail_list_str21 = detail_list_summarize(detail_list21)
    detail_list_str22 = detail_list_summarize(detail_list22)
    detail_list_str23 = detail_list_summarize(detail_list23)



    form_default = {
      'employee_no' : obj_get.employee_no3,
      'def_ver' : obj_get.def_ver2,
      'tyoku' : obj_get.tyoku2,
      'work_time' : obj_get.work_time,
      'time_work0' : work_list0,
      'time_work1' : work_list1,
      'time_work2' : work_list2,
      'time_work3' : work_list3,
      'time_work4' : work_list4,
      'time_work5' : work_list5,
      'time_work6' : work_list6,
      'time_work7' : work_list7,
      'time_work8' : work_list8,
      'time_work9' : work_list9,
      'time_work10' : work_list10,
      'time_work11' : work_list11,
      'time_work12' : work_list12,
      'time_work13' : work_list13,
      'time_work14' : work_list14,
      'time_work15' : work_list15,
      'time_work16' : work_list16,
      'time_work17' : work_list17,
      'time_work18' : work_list18,
      'time_work19' : work_list19,
      'time_work20' : work_list20,
      'time_work21' : work_list21,
      'time_work22' : work_list22,
      'time_work23' : work_list23,
      'detail_work0' : detail_list_str0,
      'detail_work1' : detail_list_str1,
      'detail_work2' : detail_list_str2,
      'detail_work3' : detail_list_str3,
      'detail_work4' : detail_list_str4,
      'detail_work5' : detail_list_str5,
      'detail_work6' : detail_list_str6,
      'detail_work7' : detail_list_str7,
      'detail_work8' : detail_list_str8,
      'detail_work9' : detail_list_str9,
      'detail_work10' : detail_list_str10,
      'detail_work11' : detail_list_str11,
      'detail_work12' : detail_list_str12,
      'detail_work13' : detail_list_str13,
      'detail_work14' : detail_list_str14,
      'detail_work15' : detail_list_str15,
      'detail_work16' : detail_list_str16,
      'detail_work17' : detail_list_str17,
      'detail_work18' : detail_list_str18,
      'detail_work19' : detail_list_str19,
      'detail_work20' : detail_list_str20,
      'detail_work21' : detail_list_str21,
      'detail_work22' : detail_list_str22,
      'detail_work23' : detail_list_str23,
      'over_time' : obj_get.over_time,
      'breaktime' : obj_get.breaktime,
      'breaktime_over1' : obj_get.breaktime_over1,
      'breaktime_over2' : obj_get.breaktime_over2,
      'breaktime_over3' : obj_get.breaktime_over3,
      'judgement' : obj_get.judgement,
      'break_change' : obj_get.break_change,
      }

    # フォーム定義
    form = all_kosuForm(form_default)

    # フォーム選択肢定義
    form.fields['def_ver'].choices = Ver_choose



  # HTMLに渡す辞書
  context = {
    'title' : '工数データ編集',
    'form' : form,
    'default_day' : str(default_day),
    'num' : num,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu_detail.html', context)





#--------------------------------------------------------------------------------------------------------




# 工数削除画面定義
def all_kosu_delete(request, num):
  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  # セッションにログインした従業員番号がない場合の処理
  if not request.session.get('login_No'):
    # 未ログインならログインページへ飛ぶ
    return redirect('/login')

  # ログイン者が問い合わせ担当者でない場合の処理
  if request.session['login_No'] not in (page_num.administrator_employee_no1, page_num.administrator_employee_no2, page_num.administrator_employee_no3):
    # 権限がなければメインページに飛ぶ
    return redirect(to = '/')


  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login')
  

  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = Business_Time_graph.objects.get(id = num)

  # POST時の処理
  if (request.method == 'POST'):
    # 取得していた指定従業員番号のレコードを削除する
    obj_get.delete()

    # 工数履歴画面をリダイレクトする
    return redirect(to = '/all_kosu/1')



  # HTMLに渡す辞書
  context = {
    'title' : '工数データ削除',
    'num' : num,
    'obj' : obj_get,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/all_kosu_delete.html', context)





#--------------------------------------------------------------------------------------------------------

