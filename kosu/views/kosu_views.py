from django.shortcuts import redirect, render
from django.contrib import messages
from django.core.paginator import Paginator
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.template.loader import render_to_string
from django.conf import settings
from django.views import View
from django.views.generic import ListView
from django.views.generic.edit import UpdateView, DeleteView, FormView
from django.db.models import Q
from django.urls import reverse_lazy
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
from ..utils.kosu_utils import kosu_write
from ..utils.kosu_utils import detail_list_summarize
from ..utils.kosu_utils import judgement_check
from ..utils.kosu_utils import kosu_division_dictionary
from ..utils.kosu_utils import kosu_sort
from ..utils.kosu_utils import default_work_time
from ..utils.kosu_utils import calendar_day
from ..utils.kosu_utils import OK_NF_check
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
from ..utils.kosu_utils import schedule_default
from ..utils.kosu_utils import kosu_delete
from ..utils.kosu_utils import kosu_edit_check
from ..utils.kosu_utils import kosu_edit_write
from ..utils.kosu_utils import work_default
from ..utils.main_utils import history_record
from ..models import member, Business_Time_graph, kosu_division, administrator_data, Operation_history
from ..forms import input_kosuForm, kosu_dayForm, schedule_timeForm, scheduleForm, all_kosu_findForm, all_kosuForm





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
  # テンプレート,オブジェクト名定義
  template_name = 'kosu/kosu_list.html'
  context_object_name = 'data'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_data = member_obj

    # 今日の日付を取得
    self.kosu_today = datetime.date.today()
    # 設定情報取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      self.page_num = administrator_data(menu_row=20)
    else:
      self.page_num = last_record

    # 全データ確認表示フラグを設定
    self.display_open = str(request.session['login_No']) in (
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
      messages.error(request, '就業日の削除はしないで下さい。ERROR001')
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

    # 入力内容記録
    edit_comment = f"""{work}:{dict(input_kosuForm.tyoku_list).get(tyoku, '')}
作業時間:{start_time}～{end_time}
工数データ:{def_work}
作業詳細:{detail_work}
残業時間:{request.POST['over_work']}
休憩変更チェックBOX:{'break_change' in request.POST}
"""

    # 未入力チェック用の変数リスト
    values = [def_work, work, tyoku, start_time, end_time, request.POST.get('over_work')]

    # いずれかが None または 空文字列ならばエラーメッセージ出力してリダイレクト
    if any(v in (None, '') for v in values):
      messages.error(request, '直、工数区分、勤務、残業、作業時間のいずれかが未入力です。工数登録できませんでした。ERROR002')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR002', edit_comment, request)
      return redirect(to='/input')

    # 作業詳細に'$'が含まれている場合リダイレクト
    if '$' in detail_work:
      messages.error(request, '作業詳細に『$』は使用できません。工数登録できませんでした。ERROR003')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR003', edit_comment, request)
      return redirect(to = '/input')

    # 作業詳細に文字数が100文字以上の場合リダイレクト
    if len(detail_work) >= 100:
      messages.error(request, '作業詳細は100文字以内で入力して下さい。工数登録できませんでした。ERROR004')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR004', edit_comment, request)
      return redirect(to = '/input')

    # 残業時間が15の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR005')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR005', edit_comment, request)
      return redirect(to = '/input')

    # 作業開始時間と作業終了時間が同じ場合リダイレクト
    if start_time == end_time:
      messages.error(request, '作業時間が誤っています。確認して下さい。ERROR006')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR006', edit_comment, request)
      return redirect(to = '/input')

    # 作業開始、終了の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始、終了時間のインデックス取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 作業開始時間が作業終了時間より遅い場合のリダイレクト
    if start_time_ind > end_time_ind and check == 0:
      messages.error(request, '作業開始時間が終了時間を越えています。翌日チェックを忘れていませんか？ERROR007')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR007', edit_comment, request)
      return redirect(to = '/input')

    # 1日以上の工数が入力された場合リダイレクト
    if start_time_ind <= end_time_ind and check == 1:
      messages.error(request, '1日以上の工数は入力できません。誤って翌日チェックを入れていませんか？ERROR008')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR008', edit_comment, request)
      return redirect(to = '/input')

    # 入力時間が21時間を超える場合リダイレクト
    if ((end_time_ind + 36) >= start_time_ind and check == 1) or ((end_time_ind - 252) >= start_time_ind and check == 0):
      messages.error(request, '作業時間が21時間を超えています。入力できません。ERROR009')
      history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR009', edit_comment, request)
      return redirect(to = '/input')


    # 指定日に工数データがある場合、工数データ取得
    obj_get = obj_filter.first() if obj_filter.exists() else ''

    # 工数データ取得しリスト化
    kosu_def, detail_list = (
        (list(obj_get.time_work), obj_get.detail_work.split('$'))
        if obj_filter.exists() 
        else (list(itertools.repeat('#', 288)), list(itertools.repeat('', 288)))
        )

    # 指定日に工数データがある場合の処理
    if obj_filter.exists():
      kosu_check = '工数データ編集'
      # 以前同日に打ち込んだ工数区分定義と違う場合リダイレクト
      if obj_get.def_ver2 not in (request.session['input_def'], None, ''):
        messages.error(request, '前に入力された工数と工数区分定義のVerが違います。ERROR010')
        history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR010', edit_comment, request)
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

    # 指定日に工数データがない場合の処理
    else:
      kosu_check = '工数データ新規登録'
      # 休憩時間取得
      breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, request)

    # 休憩時間のインデックス＆日またぎ変数定義
    break_start1, break_end1, break_next_day1 = break_time_process(breaktime)
    break_start2, break_end2, break_next_day2 = break_time_process(breaktime_over1)
    break_start3, break_end3, break_next_day3 = break_time_process(breaktime_over2)
    break_start4, break_end4, break_next_day4 = break_time_process(breaktime_over3)

    # 工数に被りがないかチェック
    ranges = [(start_time_ind, end_time_ind)] if check == 0 else [(start_time_ind, 288), (0, end_time_ind)]

    # 工数に被りがないかチェックするループ
    for ind in ranges:
      for kosu in range(ind[0], ind[1]):
        # 工数データの要素が空でない場合の処理
        if kosu_def[kosu] != '$':
          if kosu_def[kosu] != '#':
            # エラーメッセージ出力
            messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR030')
            history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR031', edit_comment, request)
            # このページをリダイレクト
            return redirect(to = '/input')

    # 作業内容、作業詳細書き込み
    for start, end in ranges:
      kosu_def, detail_list = kosu_write(start, end, kosu_def, detail_list, request)

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
          history_record('工数入力画面：工数入力', 'Business_Time_graph', 'ERROR031', edit_comment, request)
          return redirect(to='/input')
        kosu_def, detail_list = result


    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3=request.session['login_No'], \
      work_day2 = work_day, defaults = {'name': member.objects.get(employee_no = request.session['login_No']), \
                                        'def_ver2': request.session['input_def'], \
                                        'work_time': work, \
                                        'tyoku2': tyoku, \
                                        'time_work': ''.join(kosu_def), \
                                        'over_time': request.POST['over_work'], \
                                        'detail_work': detail_list_summarize(detail_list),\
                                        'breaktime': breaktime, \
                                        'breaktime_over1': breaktime_over1, \
                                        'breaktime_over2': breaktime_over2, \
                                        'breaktime_over3': breaktime_over3, \
                                        'judgement': judgement_check(kosu_def, work, tyoku, member_obj, request.POST['over_work']), \
                                        'break_change': 'break_change' in request.POST})

    # 操作履歴記録
    edit_comment =f"""{kosu_check}
""" + edit_comment + f"""{''.join(kosu_def)}
{detail_list_summarize(detail_list)}"""
    history_record('工数入力画面：工数入力', 'Business_Time_graph', 'OK', edit_comment, request)

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

    # 入力内容記録
    edit_comment = f'残業時間:{request.POST['over_work']}'

    # 残業未入力の場合リダイレクト
    if request.POST['over_work'] in ["", None]:
      messages.error(request, '残業が未入力です。登録できませんでした。ERROR011')
      history_record('工数入力画面：残業入力', 'Business_Time_graph', 'ERROR011', edit_comment, request)
      return redirect(to = '/input')
    
    # 残業時間が15の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%15 != 0 and work != '休出':
      messages.error(request, '残業時間が15分の倍数になっていません。工数登録できませんでした。ERROR012')
      history_record('工数入力画面：残業入力', 'Business_Time_graph', 'ERROR012', edit_comment, request)
      return redirect(to = '/input')

    # 休出時に残業時間が5の倍数でない場合リダイレクト
    if int(request.POST['over_work'])%5 != 0 and work == '休出':
      messages.error(request, '残業時間が5分の倍数になっていません。工数登録できませんでした。ERROR013')
      history_record('工数入力画面：残業入力', 'Business_Time_graph', 'ERROR013', edit_comment, request)
      return redirect(to = '/input')

    
    # 工数データがある場合の処理
    if obj_filter.exists():
      kosu_check = '工数データ編集'
      # 工数データ取得
      obj_get = obj_filter.first()
      # 残業を上書きして更新
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'over_time' : request.POST['over_work'], \
                                                               'judgement' : judgement_check(list(obj_get.time_work), work, tyoku, member_obj, request.POST['over_work'])})

    # 工数データがない場合の処理
    else:
      kosu_check = '工数データ新規登録'
      # 工数データ作成し残業書き込み
      Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
                                                   work_day2 = request.POST['work_day'], \
                                                   defaults = {'name' : member.objects.get(employee_no = request.session['login_No']), \
                                                               'time_work' : '#'*288, \
                                                               'detail_work' : '$'*287, \
                                                               'over_time' : request.POST['over_work']})

    # 操作履歴記録
    edit_comment =f"""{kosu_check}
""" + edit_comment
    history_record('工数入力画面：残業入力', 'Business_Time_graph', 'OK', edit_comment, request)


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

    # 入力内容記録
    edit_comment = f'工数区分定義予測設定:{'def_prediction' in request.POST}'
    new_history = Operation_history(employee_no4=request.session['login_No'],
                                    name=member.objects.get(employee_no = request.session['login_No']),
                                    post_page='工数入力画面：工数区分定義予測変更',
                                    operation_models='member',
                                    operation_detail=edit_comment,
                                    status='OK',)
    new_history.save()

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
        messages.error(request, 'この日は、まだ休憩データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR014')
        return redirect(to = '/input')

      # 休憩データがある場合の処理 
      else:
        # 休憩変更画面へジャンプ
        return redirect(to = '/today_break_time')

    # 工数データがない場合リダイレクト
    else:
      messages.error(request, 'この日は、まだ工数データがありません。工数を1件以上入力してから休憩を変更して下さい。ERROR015')
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


  # 工数データあるか確認
  obj_filter = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                  work_day2 = request.session.get('day', kosu_today))
  # 工数データある場合の処理
  if obj_filter.exists():
    # 工数データ取得
    obj_get = obj_filter.first()
    # フォーム初期値定義
    over_work_default = obj_get.over_time
    tyoku_default = obj_get.tyoku2
    work_default = obj_get.work_time
    ok_ng = obj_get.judgement
    break_change_default = obj_get.break_change

  # 工数データない場合の処理
  else:
    obj_get = ''
    # フォーム初期値定義
    over_work_default = 0
    ok_ng = False
    break_change_default = False 
    work_default = ''
    tyoku_default = ''

  # 初期値を設定するリスト作成
  default_list = {'work' : request.session.get('error_work', work_default),
                  'work2' : request.session.get('error_work', work_default),
                  'tyoku' : request.session.get('error_tyoku', tyoku_default),
                  'tyoku2' : request.session.get('error_tyoku', tyoku_default),
                  'tomorrow_check' : request.session.get('tomorrow_check', False),
                  'kosu_def_list': request.session.get('error_def', ''),
                  'work_detail' : request.session.get('error_detail', ''),
                  'over_work' : request.session.get('error_over_work', over_work_default),
                  'break_change' : break_change_default,
                  'def_prediction' : member_obj.def_prediction} 

  # 時刻取得時の初期値の定義追加あれば追加
  if 'def_default' in locals():
    default_list.update(def_default)

  # 工数区分定義リスト作成
  choices_list, def_n = kosu_division_dictionary(request.session['input_def'])
  choices_list.insert(0, ['', ''])
  choices_list.append(['$', '休憩'])
  def_library, def_n = kosu_division_dictionary(request.session['input_def'])
  def_library.append(['#', '-'])
  
  # フォームの初期状態定義
  form = input_kosuForm(default_list)
  # フォームの選択肢定義
  form.fields['kosu_def_list'].choices = choices_list


  # 工数データ無い場合リンクに空を入れる
  obj_link = any(num != 0 for num in graph_list)

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
    # HTML表示用リスト定義
    time_display_list = []

  # 工数区分定義警告表示判断
  new_def_Ver = kosu_division.objects.order_by("id").last()



  # HTMLに渡す辞書
  context = {
    'title': '工数登録',
    'form': form,
    'new_day': str(new_work_day),
    'default_start_time': request.session.get('start_time', ''),
    'default_end_time': default_end_time,
    'graph_list': graph_list,
    'graph_item': graph_item,
    'def_library': def_library,
    'def_n': def_n,
    'OK_NG': ok_ng,
    'time_total': time_total,
    'default_total': default_total,
    'obj_get': obj_get,
    'obj_link': obj_link,
    'time_display_list': time_display_list,
    'member_obj': member_obj,
    'show_message': show_message,
    'def_alarm': request.session['input_def'] != new_def_Ver.kosu_name,
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


  # オブジェクトを取得するメソッドをオーバーライド
  def get_object(self, queryset=None):
    # 人員情報取得(取得できない場合セッション削除しログイン画面へ)
    try:
      # 従業員番号取得
      self.employee_no = self.request.session.get('login_No')
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


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_data = member_obj
    # 親クラスのdispatchメソッドを呼び出し
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




class DetailView(View):
  # テンプレート定義
  template_name = 'kosu/detail.html'


  # 共通処理部分
  def common_context(self, request, num):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj

    # 工数データ取得
    obj_get = Business_Time_graph.objects.get(id=num)

    # 作業内容と作業詳細を直に合わせて調整
    work_list, detail_list = kosu_sort(obj_get, member_obj)
    # HTML表示用リスト前準備リスト作成
    self.def_time, self.detail_time, self.time_list_start, self.time_list_end, self.kosu_list = create_kosu_basic(work_list, detail_list, obj_get, member_obj, request)

    # 工数データの工数定義区分Verで選択肢作成(ない場合は読み込みVer)
    if obj_get.def_ver2 not in [None, '']:
      def_choices_list, def_n = kosu_division_dictionary(obj_get.def_ver2)
    else:
      def_choices_list, def_n = kosu_division_dictionary(request.session['input_def'])

    # HTML表示用リスト作成
    time_display_list = []
    for k in range(len(self.time_list_start)):
      choices_list = ''
      # 選択肢に空追加
      if self.def_time[k] in ["", None]:
        choices_list += '<option value="{}" selected>{}</option>'.format('#', '-')
      else:
        choices_list += '<option value="{}">{}</option>'.format('#', '-')

      # 工数区分定義選択肢作成
      for i in range(def_n):
        # 工数データの工数区分定義を選択状態にし選択肢作成
        if self.def_time[k] == def_choices_list[i][1]:
          choices_list += '<option value="{}" selected>{}</option>'.format(def_choices_list[i][0], def_choices_list[i][1])
        else:
          choices_list += '<option value="{}">{}</option>'.format(def_choices_list[i][0], def_choices_list[i][1])

      # 選択肢の最後に休憩追加
      if self.def_time[k] == '休憩':
        choices_list += '<option value="{}" selected>{}</option>'.format('$', '休憩')
      else:
        choices_list += '<option value="{}">{}</option>'.format('$', '休憩')

      # HTMLタグをまとめ
      row = [
        '<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="start_time{}" data-precision="5" value="{}">'.format(k + 1, self.time_list_start[k]) + '～' +
        '<input class="your-time-field form-control custom-border controlled-input" style="width : 70px;" type="text" name="end_time{}" data-precision="5" value="{}">'.format(k + 1, self.time_list_end[k]),
        '<select name="def_time{}" class="form-control custom-border mx-auto controlled-input" style="width : 210px;">'.format(k + 1) + choices_list + '</select>',
        '<input class="form-control custom-border mx-auto controlled-input" style="width : 210px;" type="text" name="detail_time{}" value="{}">'.format(k + 1, self.detail_time[k])
        ]
      time_display_list.append(row)

    # 次の日の工数データ取得
    next_record = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__gt=obj_get.work_day2).order_by('work_day2').first()
    has_next_record = next_record is not None

    # 前日の工数データ取得
    before_record = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__lt=obj_get.work_day2).order_by('-work_day2').first()
    has_before_record = before_record is not None

    # 残業時間取得
    over_time_default = obj_get.over_time if obj_get.over_time not in ["", None] else 0
    # 入力済み工数の合計取得
    time_total = 1440 - (work_list.count('#') * 5) - (work_list.count('$') * 5)
    # 基準合計工数取得
    default_total = default_work_time(obj_get, member_obj)

    # HTMLへの出力(共通部分)
    context = {
      'title': '工数詳細',
      'id': num,
      'obj_get': obj_get,
      'over_time_default': over_time_default,
      'now_day': str(obj_get.work_day2),
      'time_total': time_total,
      'default_total': default_total,
      'time_display_list': time_display_list,
      'has_next_record': has_next_record,
      'has_before_record': has_before_record,
      'member_obj': member_obj,
      'obj_get': obj_get
      }
    return context


  # GET時の処理
  def get(self, request, num):
    context = self.common_context(request, num)
    if isinstance(context, redirect.__class__):  # セッションエラー時のリダイレクト処理
      return context
    return render(request, self.template_name, context)

  def post(self, request, num):
      context = self.common_context(request, num)
      if isinstance(context, redirect.__class__):  # セッションエラー時のリダイレクト処理
        return context

      obj_get = context['obj_get']
      member_obj = context['member_obj']

      if "edit_day" in request.POST:
        if request.POST['kosu_day'] in ["", None]:
          messages.error(request, '変更する日付を指定して下さい。ERROR016')
          return redirect(to=f'/detail/{num}')

        if request.POST['over_time'] in ["", None]:
          messages.error(request, '残業は空欄で登録できません。ERROR017')
          return redirect(to=f'/detail/{num}')

        if request.POST['kosu_day'] != str(obj_get.work_day2):
          obj_check = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2=request.POST['kosu_day'])
          if obj_check.exists():
            messages.error(request, '指定された日は既に工数データが存在します。指定日のデータを削除してから再度実行下さい。ERROR018')
            return redirect(to=f'/detail/{num}')

        Business_Time_graph.objects.update_or_create(id=num, defaults={
          'work_day2': request.POST['kosu_day'],
          'tyoku2': request.POST['tyoku'],
          'work_time': request.POST['work'],
          'over_time': request.POST['over_time'],
          'judgement': judgement_check(list(obj_get.time_work), request.POST['work'], request.POST['tyoku'], member_obj, request.POST['over_time'])
          })
        return redirect(to=f'/detail/{num}')

      # 時間指定工数削除時の処理
      if "kosu_delete" in request.POST:
        # 作業内容と作業詳細を取得しリストに解凍
        work_list = list(obj_get.time_work)
        detail_list = obj_get.detail_work.split('$')
        start_time = request.POST['start_time']
        end_time = request.POST['end_time']

        # 時間指定を空でPOSTした場合、リダイレクト
        if start_time in ["", None] or end_time in ["", None]:
          messages.error(request, '時間が指定されていません。ERROR019')
          return redirect(to = '/detail/{}'.format(num))
        
        # 作業開始、終了の時と分取得
        start_time_hour, start_time_min = time_index(start_time)
        end_time_hour, end_time_min = time_index(end_time)

        # 作業開始、終了時間のインデックス取得
        start_indent = int(int(start_time_hour)*12 + int(start_time_min)/5)
        end_indent = int(int(end_time_hour)*12 + int(end_time_min)/5)


        # 翌日チェック状態
        check = 1 if 'tomorrow_check' in request.POST else 0

        # 削除開始時間が削除終了時間より遅い時間の場合、リダイレクト
        if (start_indent > end_indent) and check == 0:
          messages.error(request, '削除の開始時間が終了時間よりも遅い時間を指定されましたので処理できません。ERROR020')
          return redirect(to = '/detail/{}'.format(num))

        # 日を超えていない場合の処理
        if check == 0:
          # 指定された時間の作業内容と作業詳細を消す
          work_list, detail_list = kosu_delete(start_indent, end_indent, work_list, detail_list)

        # 日を超えている場合の処理
        else:
          # 指定された時間の作業内容と作業詳細を消す
          work_list, detail_list = kosu_delete(start_indent, 288, work_list, detail_list)
          work_list, detail_list = kosu_delete(0, end_indent, work_list, detail_list)

        # 工数合計取得
        kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

        # 作業内容データの内容を上書きして更新
        Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
          work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                    'detail_work' : detail_list_summarize(detail_list), \
                                                    'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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
        if self.kosu_list[pressed_button - 1] < self.kosu_list[pressed_button]:
          # 指定された時間の作業内容と作業詳細を消す
          work_list, detail_list = kosu_delete(self.kosu_list[pressed_button - 1], self.kosu_list[pressed_button], work_list, detail_list)

        # 日を跨いでいる時の処理
        else:
          # 指定された時間の作業内容と作業詳細を消す
          work_list, detail_list = kosu_delete(self.kosu_list[pressed_button - 1], 288, work_list, detail_list)
          work_list, detail_list = kosu_delete(0, self.kosu_list[pressed_button], work_list, detail_list)

        # 工数合計取得
        kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

        # 作業内容データの内容を上書きして更新
        Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
          work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                    'detail_work' : detail_list_summarize(detail_list), \
                                                    'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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

        # 入力エラー検出
        response = kosu_edit_check(start_time, end_time, edit_id, num, request)
        if response:
          return response

        # 作業開始、終了の時と分取得
        start_time_hour, start_time_min = time_index(start_time)
        end_time_hour, end_time_min = time_index(end_time)

        # 作業開始、終了時間のインデックス取得
        start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
        end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

        # 作業内容と作業詳細を取得しリストに解凍
        work_list = list(obj_get.time_work)
        detail_list = obj_get.detail_work.split('$')


        # 変更前の作業時間が日を跨いでいない時の処理
        if self.kosu_list[edit_id - 1] < self.kosu_list[edit_id]:
          # 指定された時間の作業内容と作業詳細を削除
          work_list, detail_list = kosu_delete(self.kosu_list[edit_id - 1], self.kosu_list[edit_id], work_list, detail_list)

        # 変更前の作業時間が日を跨いでいる時の処理
        else:
          # 指定された時間の作業内容と作業詳細を削除
          work_list, detail_list = kosu_delete(self.kosu_list[edit_id - 1], 288, work_list, detail_list)
          work_list, detail_list = kosu_delete(0, self.kosu_list[edit_id], work_list, detail_list)

        # 変更後の作業時間が日を跨いでいない時の処理
        if start_time_ind < end_time_ind:
          # 工数編集書き込み
          work_list, detail_list = kosu_edit_write(start_time_ind, end_time_ind, work_list, detail_list, edit_id, request)

          # 工数変更ができなかった場合のリダイレクト処理
          if work_list is None or detail_list is None:
            return redirect(to='/detail/{}'.format(num))

        # 変更後の作業時間が日を跨いでいる時の処理
        else:
          # 工数編集書き込み
          work_list, detail_list = kosu_edit_write(start_time_ind, 288, work_list, detail_list,edit_id, request)
          work_list, detail_list = kosu_edit_write(0, end_time_ind, work_list, detail_list, edit_id, request)

          # 工数変更ができなかった場合のリダイレクト処理
          if work_list is None or detail_list is None:
            return redirect(to='/detail/{}'.format(num))

        # 作業内容データの内容を上書きして更新
        Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
          work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                    'detail_work' : detail_list_summarize(detail_list), \
                                                    'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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
        for def_t in range(len(self.time_list_start)):
          if def_t + 1 not in selected_num:
            # 工数区分定義と作業詳細が空欄でない場合の処理
            if not (self.def_time[def_t] in ["", None] and self.detail_time[def_t] in ["", None]):
              # 休憩時間は作業時間被りから除外
              if self.def_time[def_t] != '休憩':
                # 作業時間の時と分取得 
                start_time_hour, start_time_min = time_index(self.time_list_start[def_t])
                end_time_hour, end_time_min = time_index(self.time_list_end[def_t])
                # 作業時間のインデックス取得
                start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
                end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

                # 作業可以外の作業時間インデックス格納
                for def_tt in range(start_time_ind, end_time_ind):
                  index_list.append(def_tt)

              # 休憩時間の処理
              else:
                # 作業時間の時と分取得 
                start_time_hour, start_time_min = time_index(self.time_list_start[def_t])
                end_time_hour, end_time_min = time_index(self.time_list_end[def_t])
                # 作業時間のインデックス取得
                start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
                end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

                # 休憩時間のインデックス取得
                for def_tt in range(start_time_ind, end_time_ind):
                  break_index_list.append(def_tt)

        # 工数入力時間に被りがある場合、リダイレクト
        if len(index_list) != len(set(index_list)):
          messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR021')
          return redirect(to = '/detail/{}'.format(num))


        # 作業可部分の変更を書き込むループ
        for d in selected_num:
          # 作業時間取得
          start_time = request.POST.get('start_time{}'.format(d))
          end_time = request.POST.get('end_time{}'.format(d))

          # 入力エラー検出
          response = kosu_edit_check(start_time, end_time, d, num, request)
          if response:
            return response

          # 作業開始、終了の時と分取得
          start_time_hour, start_time_min = time_index(start_time)
          end_time_hour, end_time_min = time_index(end_time)

          # 作業開始、終了時間のインデックス取得
          start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
          end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


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

        # 作業内容データの内容を上書きして更新
        Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
          work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                    'detail_work' : detail_list_summarize(detail_list), \
                                                    'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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


      # 基本的なデータを取得してリロード
      return redirect(to=f'/detail/{num}')



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
    if def_time[k] in ["", None]:
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
    # 指定日が空欄の場合、リダイレクト
    if request.POST['kosu_day'] in ["", None]:
      messages.error(request, '変更する日付を指定して下さい。ERROR016')
      return redirect(to = '/detail/{}'.format(num))

    # 残業空欄の場合、リダイレクト
    if request.POST['over_time'] in ["", None]:
      messages.error(request, '残業は空欄で登録できません。ERROR017')
      return redirect(to = '/detail/{}'.format(num))

    # 日付に変更がある場合の処理
    if request.POST['kosu_day'] != str(obj_get.work_day2):
      # 指定日に工数データがあるか確認
      obj_check = Business_Time_graph.objects.filter(employee_no3 = request.session['login_No'], \
                                                     work_day2 = request.POST['kosu_day'])

      # 指定日に工数データがある場合、リダイレクト
      if obj_check.exists():
        messages.error(request, '指定された日は既に工数データが存在します。指定日のデータを削除してから再度実行下さい。ERROR018')
        return redirect(to = '/detail/{}'.format(num))

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(id = num, \
                                                defaults = {'work_day2' : request.POST['kosu_day'], \
                                                            'tyoku2' : request.POST['tyoku'], \
                                                            'work_time' : request.POST['work'], \
                                                            'over_time' : request.POST['over_time'], \
                                                            'judgement' : judgement_check(list(obj_get.time_work), request.POST['work'], request.POST['tyoku'], member_obj, request.POST['over_time'])})

    # このページ読み直し
    return redirect(to = '/detail/{}'.format(num))



  # 時間指定工数削除時の処理
  if "kosu_delete" in request.POST:
    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')
    start_time = request.POST['start_time']
    end_time = request.POST['end_time']

    # 時間指定を空でPOSTした場合、リダイレクト
    if start_time in ["", None] or end_time in ["", None]:
      messages.error(request, '時間が指定されていません。ERROR019')
      return redirect(to = '/detail/{}'.format(num))
    
    # 作業開始、終了の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始、終了時間のインデックス取得
    start_indent = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_indent = int(int(end_time_hour)*12 + int(end_time_min)/5)


    # 翌日チェック状態
    check = 1 if 'tomorrow_check' in request.POST else 0

    # 削除開始時間が削除終了時間より遅い時間の場合、リダイレクト
    if (start_indent > end_indent) and check == 0:
      messages.error(request, '削除の開始時間が終了時間よりも遅い時間を指定されましたので処理できません。ERROR020')
      return redirect(to = '/detail/{}'.format(num))

    # 日を超えていない場合の処理
    if check == 0:
      # 指定された時間の作業内容と作業詳細を消す
      work_list, detail_list = kosu_delete(start_indent, end_indent, work_list, detail_list)

    # 日を超えている場合の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      work_list, detail_list = kosu_delete(start_indent, 288, work_list, detail_list)
      work_list, detail_list = kosu_delete(0, end_indent, work_list, detail_list)

    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_summarize(detail_list), \
                                                 'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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
      work_list, detail_list = kosu_delete(kosu_list[pressed_button - 1], kosu_list[pressed_button], work_list, detail_list)

    # 日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を消す
      work_list, detail_list = kosu_delete(kosu_list[pressed_button - 1], 288, work_list, detail_list)
      work_list, detail_list = kosu_delete(0, kosu_list[pressed_button], work_list, detail_list)

    # 工数合計取得
    kosu_total = 1440 - (work_list.count('#')*5) - (work_list.count('$')*5)

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_summarize(detail_list), \
                                                 'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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

    # 入力エラー検出
    response = kosu_edit_check(start_time, end_time, edit_id, num, request)
    if response:
      return response

    # 作業開始、終了の時と分取得
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)

    # 作業開始、終了時間のインデックス取得
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

    # 作業内容と作業詳細を取得しリストに解凍
    work_list = list(obj_get.time_work)
    detail_list = obj_get.detail_work.split('$')


    # 変更前の作業時間が日を跨いでいない時の処理
    if kosu_list[edit_id - 1] < kosu_list[edit_id]:
      # 指定された時間の作業内容と作業詳細を削除
      work_list, detail_list = kosu_delete(kosu_list[edit_id - 1], kosu_list[edit_id], work_list, detail_list)

    # 変更前の作業時間が日を跨いでいる時の処理
    else:
      # 指定された時間の作業内容と作業詳細を削除
      work_list, detail_list = kosu_delete(kosu_list[edit_id - 1], 288, work_list, detail_list)
      work_list, detail_list = kosu_delete(0, kosu_list[edit_id], work_list, detail_list)

    # 変更後の作業時間が日を跨いでいない時の処理
    if start_time_ind < end_time_ind:
      # 工数編集書き込み
      work_list, detail_list = kosu_edit_write(start_time_ind, end_time_ind, work_list, detail_list, edit_id, request)

      # 工数変更ができなかった場合のリダイレクト処理
      if work_list is None or detail_list is None:
        return redirect(to='/detail/{}'.format(num))

    # 変更後の作業時間が日を跨いでいる時の処理
    else:
      # 工数編集書き込み
      work_list, detail_list = kosu_edit_write(start_time_ind, 288, work_list, detail_list,edit_id, request)
      work_list, detail_list = kosu_edit_write(0, end_time_ind, work_list, detail_list, edit_id, request)

      # 工数変更ができなかった場合のリダイレクト処理
      if work_list is None or detail_list is None:
        return redirect(to='/detail/{}'.format(num))

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                 'detail_work' : detail_list_summarize(detail_list), \
                                                 'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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
        if not (def_time[def_t] in ["", None] and detail_time[def_t] in ["", None]):
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

    # 工数入力時間に被りがある場合、リダイレクト
    if len(index_list) != len(set(index_list)):
      messages.error(request, '入力された作業時間には既に工数が入力されているので入力できません。ERROR021')
      return redirect(to = '/detail/{}'.format(num))


    # 作業可部分の変更を書き込むループ
    for d in selected_num:
      # 作業時間取得
      start_time = request.POST.get('start_time{}'.format(d))
      end_time = request.POST.get('end_time{}'.format(d))

      # 入力エラー検出
      response = kosu_edit_check(start_time, end_time, d, num, request)
      if response:
        return response

      # 作業開始、終了の時と分取得
      start_time_hour, start_time_min = time_index(start_time)
      end_time_hour, end_time_min = time_index(end_time)

      # 作業開始、終了時間のインデックス取得
      start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
      end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)


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

    # 作業内容データの内容を上書きして更新
    Business_Time_graph.objects.update_or_create(employee_no3 = request.session['login_No'], \
      work_day2 = obj_get.work_day2, defaults = {'time_work' : ''.join(work_list), \
                                                'detail_work' : detail_list_summarize(detail_list), \
                                                'judgement' : judgement_check(work_list, obj_get.work_time, obj_get.tyoku2, member_obj, obj_get.over_time)})

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
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
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
  # テンプレート,フォーム,リダイレクト先定義
  template_name = 'kosu/total.html'
  form_class = kosu_dayForm
  success_url = 'total'


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


  # 初期データを設定
  def get_initial(self):
    #  親クラスのget_initialメソッドを呼び出す
    initial = super().get_initial()
    # 今日の日付を取得
    today = datetime.date.today()
    # フォーム初期値設定
    initial['kosu_day'] = str(today)
    return initial


  # GETリクエストの処理
  def get(self, request, *args, **kwargs):
    # 今日の日付取得
    today = datetime.date.today()
    # グラフ色指定
    color_list = [
      'plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 'deepskyblue', 'aqua',
      'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 'lawngreen', 'greenyellow', 'gold',
      'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 'lightsalmon', 'tomato', 'orangered', 'red',
      'deeppink', 'hotpink', 'violet', 'magenta', 'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue',
      'cadetblue', 'mediumseagreen', 'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue',
      'darkblue', 'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon',
      'darkmagenta', 'indigo', 'black'
      ]

    # 今日の工数データがあるか確認
    kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=today)
    # 今日の工数データがない場合の処理
    if not kosu_total.exists():
      # 工数区分定義リストを取得
      graph_item, def_num = get_def_library_data(request.session['input_def'])
      # 定義分の空のデータが入ったブラフデータ生成
      graph_list = list(itertools.repeat(0, def_num))

    # 今日の工数データがある場合の処理
    else:
      # 工数データ取得
      graph_data = kosu_total.first()
      # 使用している工数区分定義バージョン取得しリスト作成
      def_name = graph_data.def_ver2 if graph_data.def_ver2 not in ('', None) else request.session['input_def']  # 工数区分定義のバージョンを取得
      graph_item, def_num = get_def_library_data(def_name)
      # 工数区分定義用記号を設定
      str_list = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')[:def_num]
      # 工数区分定義別の累積工数を取得
      graph_list = [graph_data.time_work.count(i) * 5 for i in str_list]

    # コンテキストを設定し、HTMLに渡す
    context = self.get_context_data(graph_item=graph_item, graph_list=graph_list, color_list=color_list, default_day=str(today))
    return self.render_to_response(context)


  # POSTリクエストの処理
  def post(self, request, *args, **kwargs):
    # フォーム定義
    form = self.get_form()
    # フォームが有効な場合、有効処理を実行
    if form.is_valid():
      return self.form_valid(form)
    # フォームが無効な場合、無効処理を実行
    else:
      return self.form_invalid(form)


  # フォームが有効な場合の処理
  def form_valid(self, form):
    # リクエスト取得
    request = self.request
    
    # フォームから日付,期間,並び順を取得
    post_day = request.POST.get('kosu_day')
    summarize_type = form.cleaned_data.get('kosu_summarize')
    kosu_order = form.cleaned_data.get('kosu_order')
    # グラフ色指定
    color_list = [
      'plum', 'darkgray', 'slategray', 'steelblue', 'royalblue', 'dodgerblue', 'deepskyblue', 'aqua',
      'mediumturquoise', 'lightseagreen', 'springgreen', 'limegreen', 'lawngreen', 'greenyellow', 'gold',
      'darkorange', 'burlywood', 'sandybrown', 'lightcoral', 'lightsalmon', 'tomato', 'orangered', 'red',
      'deeppink', 'hotpink', 'violet', 'magenta', 'mediumorchid', 'darkviolet', 'mediumpurple', 'mediumblue',
      'cadetblue', 'mediumseagreen', 'forestgreen', 'darkkhaki', 'crimson', 'rosybrown', 'dimgray', 'midnightblue',
      'darkblue', 'darkslategray', 'darkgreen', 'olivedrab', 'darkgoldenrod', 'sienna', 'firebrick', 'maroon',
      'darkmagenta', 'indigo', 'black'
      ]

    # 集計期間に基づいて工数データを取得
    # 年間
    if summarize_type == '3':
      kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day[:4])
    # 月間
    elif summarize_type == '2':
      kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day[:7])
    # 日付指定
    else:
      kosu_total = Business_Time_graph.objects.filter(employee_no3=request.session['login_No'], work_day2__startswith=post_day)

    # 工数データがない場合の処理
    if not kosu_total.exists():
      # 工数区分定義のリストとその数分の空のグラフデータ作成
      graph_item, def_num = get_def_library_data(request.session['input_def'])
      graph_list = list(itertools.repeat(0, def_num))
    
    # 工数データがある場合の処理
    else:
      # 工数データ取得
      first_record = kosu_total.first()
      # 工数区分定義バージョン取得しそのリスト作成
      def_name = first_record.def_ver2 if first_record.def_ver2 not in ('', None) else request.session['input_def']  # 工数区分定義のバージョンを取得
      graph_item, def_num = get_def_library_data(def_name)
      # 工数区分定義用記号を設定
      str_list = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx')[:def_num]
      # 工数区分定義別の累積工数を取得
      graph_list = accumulate_kosu_data(kosu_total, str_list, def_num)

    # 工数大きい順に並び替えを行う場合の処理
    if kosu_order == '2':
      color_list, graph_item, graph_list = zip(*sorted(zip(color_list, graph_item, graph_list), key=lambda x: x[2], reverse=True))  # 工数順にソートする

    # コンテキストを設定し、HTMLに渡す
    context = self.get_context_data(form=form, color_list=color_list, graph_item=graph_item, graph_list=graph_list, default_day=post_day, member_obj=self.member_obj)
    return self.render_to_response(context)


  # フォームが無効な場合の処理
  def form_invalid(self, form):
    return self.render_to_response(self.get_context_data(form=form))

  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    # 親クラスのget_context_dataメソッドを呼び出す
    context = super().get_context_data(**kwargs)
    # コンテキストデータ指定
    context.update({
      'title': '工数集計',
      'data': self.member_obj,
      'default_day': kwargs.get('default_day', self.initial.get('kosu_day', '')),
      'graph_list': kwargs.get('graph_list', []),
      'graph_item': kwargs.get('graph_item', []),
      'color_list': kwargs.get('color_list', []),
      'graph_library': dict(zip(kwargs.get('graph_item', []), kwargs.get('graph_list', []))),
      })
    return context




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



  # POST時の処理
  if request.method == 'POST' and request.headers.get('x-requested-with') == 'XMLHttpRequest':
    # カレンダー更新時の処理
    if  "update" in request.POST:
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
      form_default_list = schedule_default(year, month, day_list, request)
      # 勤務フォーム定義
      form = scheduleForm(form_default_list)

      # カレンダー設定フォーム定義
      form2 = schedule_timeForm(request.POST)

      # 工数入力時間表示
      OK_NG_list, time_list = work_default(day_list, year, month, member_obj, request)


    # 直一括入力の処理
    elif "default_tyoku" in request.POST:
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

      # 勤務フォーム初期値定義
      form_default_list = schedule_default(year, month, day_list, request)
      # 勤務フォーム定義
      form = scheduleForm(form_default_list)
      # カレンダー設定フォーム定義
      form2 = schedule_timeForm(request.POST)

      # 工数入力時間表示
      OK_NG_list, time_list = work_default(day_list, year, month, member_obj, request)



    # デフォルト勤務入力の処理
    elif "default_work" in request.POST:
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

      # 勤務フォーム初期値定義
      form_default_list = schedule_default(year, month, day_list, request)
      # 勤務フォーム定義
      form = scheduleForm(form_default_list)
      # カレンダー設定フォーム定義
      form2 = schedule_timeForm(request.POST)

      # 工数入力時間表示
      OK_NG_list, time_list = work_default(day_list, year, month, member_obj, request)



    # 勤務登録時の処理
    elif "work_update" in request.POST:
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
            if record_del.work_time in ["", None] and record_del.over_time == 0 and \
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


      # 勤務フォーム初期値定義
      form_default_list = schedule_default(year, month, day_list, request)
      # 勤務フォーム定義
      form = scheduleForm(form_default_list)

      # 工数入力時間表示
      OK_NG_list, time_list = work_default(day_list, year, month, member_obj, request)



    # contextの定義
    context = {
      'form' : form,
      'form2' : form2,
      'day_list' : day_list,
      'OK_NG_list' : OK_NG_list,
      'time_list': time_list,
      }

    # 部分テンプレート（テーブル部分）のレンダリング
    html = render_to_string('kosu/schedule_table.html', context, request)
    return JsonResponse({'html': html})
  


  # GET時の処理
  else:
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
    form_default_list = schedule_default(year, month, day_list, request)
    # 勤務フォーム定義
    form = scheduleForm(form_default_list)

    # 工数入力時間表示
    OK_NG_list, time_list = work_default(day_list, year, month, member_obj, request)

    # HTMLに渡す辞書
    context = {
      'title' : '勤務入力',
      'form' : form,
      'form2' : form2,
      'day_list' : day_list,
      'OK_NG_list' : OK_NG_list,
      'time_list': time_list,
    }

    # 指定したHTMLに辞書を渡して表示を完成させる
    return render(request, 'kosu/schedule.html', context)





#--------------------------------------------------------------------------------------------------------





# 残業管理画面定義
class OverTimeView(FormView):
  # テンプレート,フォーム定義
  template_name = 'kosu/over_time.html'
  form_class = schedule_timeForm


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


  # GET & POST共通処理
  def _generate_context_data(self, year, month, day_list):
    # 残業リスト定義
    over_time_list = []
    over_time_total = 0

    # 残業リスト作成ループ
    for day in day_list:
      # 日付がある場合
      if day != '':
        over_time_filter = Business_Time_graph.objects.filter(
          employee_no3=self.request.session['login_No'],
          work_day2=datetime.date(year, month, day))
        
        # 指定日に工数データがある場合の処理
        if over_time_filter.exists():
          # 工数データ取得,残業を分⇒時に変更,残業リストに追加
          over_time_get = over_time_filter.first()
          over_time_minutes = int(over_time_get.over_time) / 60
          over_time_list.append(over_time_minutes)
          # 残業の合計
          over_time_total += over_time_minutes
        # 指定日に工数データがない場合、残業0をリストに追加
        else:
          over_time_list.append('0')
      # 日付ない場合、残業リストに空を入れる
      else:
        over_time_list.append('')

    # 工数データ整合性リスト作成
    OK_NG_list = OK_NF_check(year, month, day_list, self.member_obj)
    OK_NG_list.reverse()

    return {
      'day_list': day_list,
      'over_time_list': over_time_list,
      'over_time_total': over_time_total,
      'OK_NG_list': OK_NG_list,
      }


  # GET時の初期値定義
  def get_initial(self):
    # 本日の日付取得し年,月を返す
    today = datetime.date.today()
    return {'year': today.year, 'month': today.month}


  # フォームが有効な場合に呼び出されるメソッドをオーバーライド
  def form_valid(self, form):
    # POSTした年,月をセッションに保存
    year = int(form.cleaned_data['year'])
    month = int(form.cleaned_data['month'])
    self.request.session['update_year'] = year
    self.request.session['update_month'] = month

    # 日付リスト作成
    day_list = calendar_day(year, month)
    # 共通部分のコンテキストデータ取得
    context_data = self._generate_context_data(year, month, day_list)

    # POST分のコンテキストデータ追加
    context_data.update({
      'title': '残業管理',
      'form': form,
      })
    return self.render_to_response(context_data)


  # フォームバリデーションが失敗した際の処理
  def form_invalid(self, form):
    request = self.request
    messages.error(request, f'バリテーションエラーが発生しました。IT担当者に連絡してください。{form.errors} ERROR059')
    return redirect(to='/new')


  # GET時のコンテキストデータ定義
  def get_context_data(self, **kwargs):
    # 共通部分のコンテキストデータ取得
    context = super().get_context_data(**kwargs)
    # 本日の年,月取得
    today = datetime.date.today()
    year = today.year
    month = today.month

    # セッション更新
    self.request.session['update_year'] = year
    self.request.session['update_month'] = month
    # 日付リスト作成
    day_list = calendar_day(year, month)
    # GET分のコンテキストデータ追加
    context_data = self._generate_context_data(year, month, day_list)
    context_data.update({
      'title': '残業管理',
      'form': kwargs.get('form', self.get_form()),
      })
    context.update(context_data)
    return context





#--------------------------------------------------------------------------------------------------------





# 全工数操作画面定義
class AllKosuListView(ListView):
  # テンプレート,オブジェクト名定義
  template_name = 'kosu/all_kosu.html'
  context_object_name = 'data'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj

    # 今日の日付を取得
    self.today = datetime.date.today()
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フィルタリングキーワード生成
  def get_filter_kwargs(self, request):
    if 'kosu_find' not in request.POST:
      return {}

    # 名前&従業員番号リスト作成
    employee_no_name_list = member.objects.filter(shop=request.POST.get('shop', None)).values_list('employee_no', flat=True) if request.POST.get('shop') else member.objects.all().values_list('employee_no', flat=True)
    employee_no_name_list = list(employee_no_name_list)
    
    # フォーム初期値記憶
    request.session['find_start_day'] = request.POST.get('start_day', '').strip()
    request.session['find_end_day'] = request.POST.get('end_day', '').strip()
    
    # 整合性検索リスト作成
    judgement = [True] if request.POST.get('OK_NG') == 'OK' else [False] if request.POST.get('OK_NG') == 'NG' else [True, False]
    
    # フィルタリング
    filter_kwargs = {
      'employee_no3__contains': request.POST.get('name', ''),
      'employee_no3__in': employee_no_name_list,
      'judgement__in': judgement,
      }
    
    # ID指定ある場合はIDでもフィルタリング
    if request.POST.get('identification'):
      filter_kwargs['id'] = request.POST.get('identification')
    
    # 期間指定ある場合は期間でもフィルタリング
    if request.POST.get('start_day', '').strip() and request.POST.get('end_day', '').strip():
      filter_kwargs.update({
        'work_day2__gte': request.POST.get('start_day', '').strip(),
        'work_day2__lte': request.POST.get('end_day', '').strip()
        })

    # 直指定ある場合は直でもフィルタリング
    if request.POST.get('tyoku'):
      filter_kwargs.update({
        'tyoku2__contains': request.POST.get('tyoku'),
        })

    # 勤務指定ある場合は勤務でもフィルタリング
    if request.POST.get('work'):
      filter_kwargs.update({
        'work_time__contains': request.POST.get('work'),
        })

    return filter_kwargs


  # フィルタリングされたデータ取得
  def get_queryset(self):
    return Business_Time_graph.objects.filter(**self.get_filter_kwargs(self.request)).order_by('work_day2').reverse()


  # HTMLに送る辞書定義
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context.update({
      'title': '全工数履歴',
      'default_start_day': self.request.session.get('find_start_day', str(self.today)),
      'default_end_day': self.request.session.get('find_end_day', str(self.today)),
      'form': self.form,
      'num': self.kwargs.get('num'),
      })

    return context


  # GET時の処理
  def get(self, request, *args, **kwargs):
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

    # フォーム定義
    self.form = all_kosu_findForm()
    # フォーム選択肢定義
    self.form.fields['name'].choices = name_list

    # フィルタリングしたデータをページネーションで絞り込み
    paginator = Paginator(self.get_queryset(), 500)
    self.object_list = paginator.get_page(kwargs.get('num'))
    # HTMLに送るデータに追加
    context = self.get_context_data(object_list=paginator.get_page(kwargs.get('num')))
    # HTMLにデータ送信
    return self.render_to_response(context)


  # POST時の処理
  def post(self, request, *args, **kwargs):
    # 工数一括削除時の処理
    if 'kosu_delete' in request.POST:
      shop = request.POST.get('shop', '')
      # 名前、従業員番号リスト作成
      employee_no_name_list = member.objects.filter(shop=shop).values_list('employee_no', flat=True) if shop else member.objects.all().values_list('employee_no', flat=True)
      employee_no_name_list = list(employee_no_name_list)

      # フィルタリング指定
      filters = {
        'employee_no3__contains': request.POST.get('name', ''),
        'employee_no3__in': employee_no_name_list,
        'judgement__in': {'OK': [True], 'NG': [False]}.get(request.POST.get('OK_NG', ''), [True, False]),
        }

      # 期間指定ある場合は期間フィルタリング追加
      if request.POST.get('start_day') and request.POST.get('end_day'):
        filters['work_day2__gte'] = request.POST['start_day']
        filters['work_day2__lte'] = request.POST['end_day']
      # 直指定ある場合は直フィルタリング追加
      if request.POST.get('tyoku'):
        filters['tyoku2__contains'] = request.POST['tyoku']
      # 勤務指定ある場合は勤務フィルタリング追加
      if request.POST.get('work'):
        filters['work_time__contains'] = request.POST['work']

      # レコード削除
      Business_Time_graph.objects.filter(**filters).delete()
      return redirect(to='/all_kosu/1')

    # 工数データのある従業員番号リスト作成
    employee_no_list = Business_Time_graph.objects.values_list('employee_no3', flat=True).order_by('employee_no3').distinct()
    name_list = [['', '']] + [[No, member.objects.get(employee_no=No)] for No in employee_no_list if member.objects.filter(employee_no=No).exists()]

    # フォーム定義
    self.form = all_kosu_findForm(request.POST)
    self.form.fields['name'].choices = name_list

    # フィルタリングしたデータをページネーションで絞り込み
    paginator = Paginator(self.get_queryset(), 500)
    self.object_list = paginator.get_page(kwargs.get('num'))
    context = self.get_context_data(object_list=self.object_list)
    return self.render_to_response(context)





#--------------------------------------------------------------------------------------------------------





# 全工数編集画面定義
class AllKosuDetailView(FormView):
  # テンプレート,フォーム定義
  template_name = 'kosu/all_kosu_detail.html'
  form_class = all_kosuForm


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_data = member_obj

    # 設定データ取得（最後の管理者データ）
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      admin_data_last = administrator_data(menu_row=20)
    else:
      admin_data_last = last_record

    # ログイン者が問い合わせ担当者でない場合、メインMENUへ
    login_no = str(request.session['login_No'])
    if login_no not in (admin_data_last.administrator_employee_no1,
                        admin_data_last.administrator_employee_no2,
                        admin_data_last.administrator_employee_no3):
      return redirect('/')

    # 工数データ取得しできなければ一覧へ
    num = self.kwargs.get('num')
    try:
      self.obj_get = Business_Time_graph.objects.get(id=num)
    except Business_Time_graph.DoesNotExist:
      return redirect('/all_kosu/1')

    return super().dispatch(request, *args, **kwargs)


  # フォーム初期状態
  def get_form(self, form_class=None):
    form = super().get_form(form_class)
    # 工数定義区分Verリストを選択肢に設定
    ver_list = kosu_division.objects.values_list('kosu_name', flat=True).order_by('id').distinct()
    ver_choose = [[ver, ver] for ver in ver_list]
    form.fields['def_ver'].choices = ver_choose
    return form


  # フォーム初期値定義
  def get_initial(self):
    # dispatch で取得した obj_get を利用
    obj_get = self.obj_get

    # フォーム初期値リスト作成
    detail_list = obj_get.detail_work.split('$')
    time_work_list = [obj_get.time_work[i * 12:(i + 1) * 12] for i in range(24)]
    detail_work_list = [detail_list[i * 12:(i + 1) * 12] for i in range(24)]

    # フォーム初期値定義
    initial_data = {
      'employee_no': obj_get.employee_no3,
      'def_ver': obj_get.def_ver2,
      'tyoku': obj_get.tyoku2,
      'work_time': obj_get.work_time,
      'over_time': obj_get.over_time,
      'breaktime': obj_get.breaktime,
      'breaktime_over1': obj_get.breaktime_over1,
      'breaktime_over2': obj_get.breaktime_over2,
      'breaktime_over3': obj_get.breaktime_over3,
      'judgement': obj_get.judgement,
      'break_change': obj_get.break_change,
      }

    # フォーム初期値追加
    for i in range(24):
      initial_data[f'time_work{i}'] = time_work_list[i]
      initial_data[f'detail_work{i}'] = '$'.join(detail_work_list[i])

    # セッションに保存
    self.request.session['memory_No'] = str(obj_get.employee_no3)
    self.request.session['memory_day'] = str(obj_get.work_day2)

    return initial_data


  # コンテキストデータを設定
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)

    context.update({
      'title': '工数データ編集',
      'default_day': self.request.session.get('memory_day', ''),
      'num': self.kwargs['num']
      })

    return context


  # フォームが有効な場合に呼び出されるメソッドをオーバーライド
  def form_valid(self, form):
    # 工数データID取得
    num = self.kwargs['num']

    # 作業内容の整形
    time_work = ''.join(self.request.POST.get(f'time_work{i}', '') for i in range(24))
    detail_work = '$'.join(self.request.POST.get(f'detail_work{i}', '') for i in range(24))

    # 従業員番号チェック
    employee_no = self.request.POST.get('employee_no', '')
    if not member.objects.filter(employee_no=employee_no).exists():
      messages.error(self.request, 'その従業員番号は人員データにありません。ERROR022')
      return redirect(f'/all_kosu_detail/{num}')

    # 必須項目（従業員番号、就業日）が空の場合
    if not employee_no or not self.request.POST.get('work_day', ''):
      messages.error(self.request, '従業員番号か就業日が未入力です。ERROR023')
      return redirect(f'/all_kosu_detail/{num}')

    # 作業内容の正規表現チェック
    time_work_pattern = r'^[a-zA-Z#$]{12}$'
    for i in range(24):
      time_work_value = self.request.POST.get(f'time_work{i}', '')
      if not re.fullmatch(time_work_pattern, time_work_value):
        messages.error(self.request, f'{i}時台の作業内容の入力値が不適切です。ERROR024')
        return redirect(f'/all_kosu_detail/{num}')

    # 作業詳細の整合性チェック
    for i in range(24):
      detail_work_value = self.request.POST.get(f'detail_work{i}', '')
      if detail_work_value.count('$') != 11:
        messages.error(self.request, f'{i}時台の作業詳細の入力値が不適切です。ERROR025')
        return redirect(f'/all_kosu_detail/{num}')

    # 残業時間の整合性チェック
    if int(self.request.POST.get('over_time', 0)) % 5 != 0:
      messages.error(self.request, '残業の入力値が5の倍数ではありません。ERROR026')
      return redirect(f'/all_kosu_detail/{num}')

    # 休憩時間フォーマットチェック
    breaktime_fields = ['breaktime', 'breaktime_over1', 'breaktime_over2', 'breaktime_over3']
    breaktime_name = ['昼休憩', '残業休憩時間1', '残業休憩時間2', '残業休憩時間3']
    breaktime_pattern = r'^#([0-9]{8})$'

    # 休憩時間データ形状チェック
    for i, field in enumerate(breaktime_fields):
      match = re.fullmatch(breaktime_pattern, self.request.POST.get(field, ''))
      if not match:
        messages.error(self.request, f'{breaktime_name[i]}の記入が#+数字8桁の形式になっていません。ERROR027')
        return redirect(f'/all_kosu_detail/{num}')

      # 時刻の範囲チェック（60進数、5分刻み）
      number_part = match.group(1)
      hours1, minutes1, hours2, minutes2 = map(int, [number_part[:2], number_part[2:4], number_part[4:6], number_part[6:]])
      invalid_time = (
        hours1 not in range(24) or minutes1 not in range(0, 60, 5) or
        hours2 not in range(24) or minutes2 not in range(0, 60, 5)
        )
      if invalid_time:
        messages.error(self.request, f'{breaktime_name[i]}の設定が60進数の入力でないか5分刻みの数字ではありません。ERROR028')
        return redirect(f'/all_kosu_detail/{num}')

    # 従業員番号・日付変更時の確認
    original_employee_no = self.request.session['memory_No']
    original_work_day = self.request.session['memory_day']
    new_employee_no = self.request.POST['employee_no']
    new_work_day = self.request.POST['work_day']

    # 新しい日付に既存データがある場合はリダイレクト
    if new_employee_no != original_employee_no or new_work_day != original_work_day:
      if Business_Time_graph.objects.filter(employee_no3=new_employee_no, work_day2=new_work_day).exists():
        messages.error(self.request, 'その日付には既に工数データがあります。ERROR029')
        return redirect(f'/all_kosu_detail/{num}')

      # 元のデータを削除
      obj_get = Business_Time_graph.objects.get(id=num)
      obj_get.delete()

    # 工数データの保存または更新
    member_instance = member.objects.get(employee_no=new_employee_no)
    Business_Time_graph.objects.update_or_create(
      employee_no3=new_employee_no,
      work_day2=new_work_day,
      defaults={
        'name': member_instance,
        'def_ver2': self.request.POST['def_ver'],
        'work_time': self.request.POST['work_time'],
        'tyoku2': self.request.POST['tyoku'],
        'time_work': time_work,
        'detail_work': detail_work,
        'over_time': self.request.POST['over_time'],
        'breaktime': self.request.POST['breaktime'],
        'breaktime_over1': self.request.POST['breaktime_over1'],
        'breaktime_over2': self.request.POST['breaktime_over2'],
        'breaktime_over3': self.request.POST['breaktime_over3'],
        'judgement': 'judgement' in self.request.POST,
        'break_change': 'break_change' in self.request.POST,
        }
        )

    messages.success(self.request, '工数データを更新しました！')
    return redirect(f'/all_kosu_detail/{num}')





#--------------------------------------------------------------------------------------------------------




# 工数削除画面定義
class AllKosuDeleteView(DeleteView):
  # モデル、テンプレート、リダイレクト先などを指定
  model = Business_Time_graph
  template_name = 'kosu/all_kosu_delete.html'
  success_url = reverse_lazy('all_kosu', args = [1])
  context_object_name = 'obj'


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      page_num = administrator_data(menu_row=20)
    else:
      page_num = last_record

    # ログイン者が問い合わせ担当者でない場合、メインページに飛ぶ
    if str(request.session['login_No']) not in (page_num.administrator_employee_no1,
                                                page_num.administrator_employee_no2,
                                                page_num.administrator_employee_no3):
      return redirect('/')

    # 人員情報取得
    member_obj = get_member(request)
    # 人員情報なしor未ログインの場合ログイン画面へ
    if isinstance(member_obj, HttpResponseRedirect):
      return member_obj
    self.member_obj = member_obj
    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
      context = super().get_context_data(**kwargs)
      context['title'] = '工数データ削除'
      context['num'] = self.kwargs['pk']
      return context





#--------------------------------------------------------------------------------------------------------

