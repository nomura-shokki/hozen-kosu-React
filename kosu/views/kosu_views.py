import datetime
import itertools
from django.db.models import Case, When, Value, IntegerField
from ..models import member, Business_Time_graph, kosu_division, def_choice
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, DefSerializer, KosuSerializer, DefChoiceSerializer
from ..utils.main_utils import CustomPagination
from ..utils.kosu_utils import time_index, break_get, break_time_process, break_time_delete, \
                                break_time_write, detail_list_summarize, judgement_check, parse_break_time, \
                                  get_week_of_month, kosu_write



# 工数履歴
class KosuList(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 検索パラメータの取得
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'

    # 工数履歴データの取得
    kosus = Business_Time_graph.objects.filter(employee_no3=login_no).order_by('-work_day2')

    # 工数履歴データ絞り込み
    if search_day and filter_flag:
      if mode == 'month':
        kosus = kosus.filter(work_day2__startswith=search_day[:7])
      else:
        kosus = kosus.filter(work_day2=search_day)

    # ページネーション
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(kosus, request)
    serializer = KosuSerializer(result_page, many=True)

    return paginator.get_paginated_response(serializer.data)



# 工数入力
class KosuNew(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 就業日取得
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数データ確認
    kosu_query_set = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    if kosu_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    kosu_data = kosu_query_set.first()

    # 工数区分定義確認
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # 工数区分定義が最新Verか確認
    def_new_obj = kosu_division.objects.order_by('-id').first()
    warning_message = None
    if def_new_obj and def_new_obj.kosu_name != def_ver:
      warning_message = f"警告: 設定されている工数区分定義は最新の工数区分定義ではありません。任意に過去の工数入力する以外の場合は工数区分定義を最新のものにして工数入力を実施してください。"

    # 作業詳細取得
    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # データ変換
    member_serializer = MemberSerializer(member_data, many=False)
    kosu_serializer = KosuSerializer(kosu_data, many=False)
    def_serializer = DefSerializer(def_data, many=False)
    detail_serializer = DefChoiceSerializer(detail_choice, many=True)

    # 送信データ
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'detail_list': detail_serializer.data,
      'session_day': day,
      'session_def': def_ver,
    }
    if warning_message:
      response_data['warning'] = warning_message

    return Response(response_data)


  # POST処理
  def post(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # POSTデータ取得
    post_data = request.data
    day = post_data.get('work_day2')
    tyoku = post_data.get('tyoku2')

    # ログイン者情報取得
    member_obj = member.objects.get(employee_no=login_no)

    # 就業日未指定エラー
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    # セッション更新
    else:
      request.session['day'] = str(day)

    # チェックBOX状態取得
    break_change = 1 if post_data.get("break_change", False) else 0
    # 作業時間から時間のみ抽出
    jst = datetime.timezone(datetime.timedelta(hours=9))
    start_time = datetime.datetime.strptime(post_data.get('time1'), "%Y-%m-%dT%H:%M:%S.%fZ")
    end_time = datetime.datetime.strptime(post_data.get('time2'), "%Y-%m-%dT%H:%M:%S.%fZ")
    start_time = start_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
    end_time = end_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
    start_time = start_time.strftime("%H:%M")
    end_time = end_time.strftime("%H:%M")
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

    # 工数データ確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    obj = obj_filter.first() if obj_filter.exists() else None

    # 作業内容、作業詳細取得
    work_list = list(obj.time_work) if obj and obj.time_work else ['#'] * 288
    detail_list = obj.detail_work.split('$') if obj and obj.detail_work else [''] * 288

    # 工数区分定義チェックエラー
    if obj:
      if obj.def_ver2:
        if obj.def_ver2 != def_ver:
          return Response({'status': 'error', 'message': '指定就業日を入力している工数定義区分と使用しようとしている工数定義区分が違います。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データがある場合
    if obj_filter.exists():
      # 工数データに休憩時間データ無いか直が変更されている場合、人員データから取得
      if obj.breaktime in [None, ""] or obj.breaktime_over1 in [None, ""] or \
        obj.breaktime_over2 in [None, ""] or obj.breaktime_over3 in [None, ""] or \
          obj.tyoku2 != tyoku:
        breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, login_no)

      # 工数データに休憩時間データある場合、工数データから休憩時間取得
      else:
        breaktime = obj.breaktime
        breaktime_over1 = obj.breaktime_over1
        breaktime_over2 = obj.breaktime_over2
        breaktime_over3 = obj.breaktime_over3

    # 工数データがない場合、人員データから休憩時間取得
    else:
      breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, login_no)

    # 休憩時間のインデックス＆日またぎ変数定義
    break_start1, break_end1, break_next_day1 = break_time_process(breaktime)
    break_start2, break_end2, break_next_day2 = break_time_process(breaktime_over1)
    break_start3, break_end3, break_next_day3 = break_time_process(breaktime_over2)
    break_start4, break_end4, break_next_day4 = break_time_process(breaktime_over3)

    # 工数に被りがないかチェック
    ranges = [(start_time_ind, 288), (0, end_time_ind)] if end_time_ind < start_time_ind else [(start_time_ind, end_time_ind)]
    for ind in ranges:
      for kosu in range(ind[0], ind[1]):
        # 工数データの要素が空でない場合、エラー
        if work_list[kosu] != '$':
          if work_list[kosu] != '#':
            return Response({'status': 'error', 'message': '入力された作業時間には既に工数が入力されているので入力できません。'}, status=status.HTTP_400_BAD_REQUEST)

    # 作業内容、作業詳細書き込み
    for start, end in ranges:
      work_list, detail_list = kosu_write(start, end, work_list, detail_list, post_data)

    # 休憩変更チェックが入っていない場合、休憩時間を書き込み
    if break_change == 0:
      # 各休憩時間の処理
      for break_num in range(1, 5):
        # 各変数の値を動的に取得
        break_start = locals()[f'break_start{break_num}']
        break_end = locals()[f'break_end{break_num}']
        break_next_day = locals()[f'break_next_day{break_num}']

        # 日を超えている場合の処理
        if break_next_day == 1:
          # 休憩時間内の工数データを削除
          error_message, work_list, detail_list = break_time_delete(break_start, 288, work_list, detail_list, member_obj)
          error_message, work_list, detail_list = break_time_delete(0, break_end, work_list, detail_list, member_obj)
          if error_message:
            return Response({'status': 'error', 'message': error_message}, status=status.HTTP_400_BAD_REQUEST)
          # 休憩時間直後の時間に工数入力がある場合の処理
          if work_list[int(break_end)] != '#':
            # 休憩時間内の工数データを休憩に書き換え
            work_list, detail_list = break_time_write(break_start, 288, work_list, detail_list)
            work_list, detail_list = break_time_write(0, break_end, work_list, detail_list)

        # 日を超えていない場合の処理
        else:
          # 休憩時間内の工数データを削除
          error_message, work_list, detail_list = break_time_delete(break_start, break_end, work_list, detail_list, member_obj)
          if error_message:
            return Response({'status': 'error', 'message': error_message}, status=status.HTTP_400_BAD_REQUEST)

          # 休憩時間直後の時間に工数入力がある場合の処理
          if work_list[int(break_end)] != '#':
            # 休憩時間内の工数データを休憩に書き換え
            work_list, detail_list = break_time_write(break_start, break_end, work_list, detail_list)

    work_count = work_list.count("#")
    if work_count < 24:
      return Response({'status': 'error', 'message': '作業時間が長すぎます。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データの取得または新規作成
    kosu_data, created = Business_Time_graph.objects.get_or_create(
      employee_no3=login_no,
      work_day2=day,
      defaults={
        'employee_no3': login_no,
        'work_day2': day,
      }
    )

    # 更新可能フィールド定義
    updatable_fields = [
      'tyoku2', 'over_time','work_time', 'break_change',
    ]

    # 項目毎にデータを上書き
    for field in updatable_fields:
      if field in post_data:
        setattr(kosu_data, field, post_data[field])
    kosu_data.name = member.objects.get(employee_no=login_no)
    kosu_data.time_work = ''.join(work_list)
    kosu_data.detail_work = detail_list_summarize(detail_list)
    kosu_data.judgement = judgement_check(work_list, post_data.get('work_time'), tyoku, member_obj, post_data.get('over_time', 0))
    kosu_data.def_ver2 = def_ver
    kosu_data.breaktime = breaktime
    kosu_data.breaktime_over1 = breaktime_over1
    kosu_data.breaktime_over2 = breaktime_over2
    kosu_data.breaktime_over3 = breaktime_over3

    # 工数データ更新
    kosu_data.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# 就業日切り替え処理
class SetDay(APIView):
  # POST処理
  def post(self, request, *args, **kwargs):
    # 就業日取得、空の場合エラー
    day = request.data.get('day', None)
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    else:
      # セッションに就業日保存
      request.session['day'] = str(day)
      return Response({'status': 'success', 'message': '就業日がセッションに保存されました。'})



# 残業登録
class OverTime(APIView):
  # POST処理
  def post(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    # POST値取得
    post_data = request.data
    day = post_data.get('work_day2')
    # ログイン者情報取得
    member_obj = member.objects.get(employee_no=login_no)

    # 就業日未指定エラー
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    # セッション値取得
    else:
      request.session['day'] = str(day)

    # 工数データ取得
    obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    obj = obj_filter.first() if obj_filter.exists() else None
    work_list = obj.time_work if obj and obj.time_work else '#'*288
    detail_list = obj.detail_work if obj and obj.detail_work else '$'*287
    work_time = obj.work_time if obj and obj.work_time else ''
    tyoku = obj.tyoku2 if obj and obj.tyoku2 else ''

    # 更新可能なフィールドを定義
    updatable_fields = ['over_time']

    # 工数データの取得または新規作成
    kosu_data, created = Business_Time_graph.objects.get_or_create(
      employee_no3=login_no,
      work_day2=day,
      defaults={
        'employee_no3': login_no,
        'work_day2': day,
      }
    )

    # 項目毎にデータ上書き
    for field in updatable_fields:
      if field in post_data:
        setattr(kosu_data, field, post_data[field])
    kosu_data.name = member.objects.get(employee_no=login_no)
    if obj == None or not obj.time_work :
      kosu_data.time_work = work_list
      kosu_data.detail_work = detail_list
    kosu_data.judgement = judgement_check(work_list, work_time, tyoku, member_obj, post_data.get('over_time', 0))
    # 工数データ更新
    kosu_data.save()
    return Response({'status': 'success', 'message': '残業が更新されました。'})



# 当日休憩変更
class TodayBreakTime(APIView):
  # 指定工数データ取得
  def get_object(self, login_no, day):
    try:
      return Business_Time_graph.objects.get(employee_no3=login_no, work_day2=day)
    except Business_Time_graph.DoesNotExist:
      return None


  # GET処理
  def get(self, request, *args, **kwargs):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 就業日取得
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # 工数データ取得
    kosu_instance = self.get_object(login_no, day)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # データ変換
    kosu_serializer = KosuSerializer(kosu_instance, many=False)

    # 送信データ
    response_data = {
      'kosu_data': kosu_serializer.data,
      'session_day': day,
    }
    return Response(response_data)


  # POST処理
  def post(self, request, *args, **kwargs):
    # セッション値取得
    login_no = request.session.get('login_No')
    day = request.session.get('day')
    post_data = request.data
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    try:
      # ログインユーザーのデータ取得
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数データ取得
    kosu_instance = self.get_object(login_no, day)
    if not kosu_instance:
      kosu_instance = Business_Time_graph(
        employee_no3=login_no, 
        name=member.objects.get(employee_no=login_no), 
        work_day2=day, 
        work_time='', 
        tyoku2='', 
        time_work='#'*288, 
        detail_work='$'*287, 
        judgement=False, 
        over_time=0, 
        )

    kosu_list = list(kosu_instance.time_work)
    detail_list = kosu_instance.detail_work.split('$')

    # JSTタイムゾーンの作成
    jst = datetime.timezone(datetime.timedelta(hours=9))

    # breakTime1〜breakTime8を処理
    time_data = []
    time_str_list = []
    try:
      for i in range(1, 5):
        start_ind, end_ind, time_str = parse_break_time(
          post_data.get(f'breakTime{2 * i - 1}'),
          post_data.get(f'breakTime{2 * i}'),
          jst
        )
        time_data.append((start_ind, end_ind))
        time_str_list.append(time_str)

    except ValueError as e:
      return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    for time_inds in time_data:
      if time_inds[0] < time_inds[1]:
        if kosu_list[time_inds[1]] != '#':
          for k in range(time_inds[0], time_inds[1]):
            kosu_list[k] = '$'
            detail_list[k] = ''
      else:
        if kosu_list[time_inds[1]] != '#':
          for k in range(time_inds[1], 288):
            kosu_list[k] = '$'
            detail_list[k] = ''
          for k in range(0, time_inds[0]):
            kosu_list[k] = '$'
            detail_list[k] = ''

    kosu_instance.time_work = ''.join(kosu_list)
    kosu_instance.detail_work = detail_list_summarize(detail_list)
    kosu_instance.breaktime = time_str_list[0]
    kosu_instance.breaktime_over1 = time_str_list[1]
    kosu_instance.breaktime_over2 = time_str_list[2]
    kosu_instance.breaktime_over3 = time_str_list[3]
    kosu_instance.judgement = judgement_check(kosu_list, kosu_instance.work_time, kosu_instance.tyoku2, member_data, kosu_instance.over_time)

    kosu_instance.save()
    return Response({'status': 'success', 'message': f'{day}の休憩時間が更新されました'})



# 休憩変更
class BreakTime(APIView):
  # GET処理
  def get(self, request):
    # ユーザーの従業員番号、使用工数区分定義取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッションない場合エラー出力
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      # ログインユーザーのデータ取得
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # シリアライザーによるシリアライズ処理
    member_serializer = MemberSerializer(member_data, many=False)

    # レスポンスデータの構築
    response_data = {
      'member_data': member_serializer.data,
    }

    return Response(response_data)


# POST処理
  def post(self, request):
    login_no = request.session.get('login_No')
    post_data = request.data

    try:
      # ログインユーザーのデータ取得
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # JSTタイムゾーンの作成
    jst = datetime.timezone(datetime.timedelta(hours=9))

    # breakTime1〜breakTime48を処理
    time_data = []
    time_str_list = []
    try:
      for i in range(1, 25):
        start_ind, end_ind, time_str = parse_break_time(
          post_data.get(f'breakTime{2 * i - 1}'),
          post_data.get(f'breakTime{2 * i}'),
          jst
        )
        time_data.append((start_ind, end_ind))
        time_str_list.append(time_str)
    except ValueError as e:
      return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    member_data.break_time1 = time_str_list[0]
    member_data.break_time1_over1 = time_str_list[1]
    member_data.break_time1_over2 = time_str_list[2]
    member_data.break_time1_over3 = time_str_list[3]
    member_data.break_time2 = time_str_list[4]
    member_data.break_time2_over1 = time_str_list[5]
    member_data.break_time2_over2 = time_str_list[6]
    member_data.break_time2_over3 = time_str_list[7]
    member_data.break_time3 = time_str_list[8]
    member_data.break_time3_over1 = time_str_list[9]
    member_data.break_time3_over2 = time_str_list[10]
    member_data.break_time3_over3 = time_str_list[11]
    member_data.break_time4 = time_str_list[12]
    member_data.break_time4_over1 = time_str_list[13]
    member_data.break_time4_over2 = time_str_list[14]
    member_data.break_time4_over3 = time_str_list[15]
    member_data.break_time5 = time_str_list[16]
    member_data.break_time5_over1 = time_str_list[17]
    member_data.break_time5_over2 = time_str_list[18]
    member_data.break_time5_over3 = time_str_list[19]
    member_data.break_time6 = time_str_list[20]
    member_data.break_time6_over1 = time_str_list[21]
    member_data.break_time6_over2 = time_str_list[22]
    member_data.break_time6_over3 = time_str_list[23]

    member_data.save()
    return Response({'status': 'success', 'message': '休憩時間が更新されました'})



# 工数編集(一括)
class KosuUpdate(APIView):
  # 指定IDの工数データ取得
  def get_object(self, pk):
    try:
      return Business_Time_graph.objects.get(id=pk)
    except Business_Time_graph.DoesNotExist:
      return None


  # GET処理
  def get(self, request, pk):
    # 工数データ取得
    kosu_instance = self.get_object(pk)

    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッション値、日付取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')
    request.session['day'] = str(kosu_instance.work_day2)

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数区分定義確認
    if kosu_instance.def_ver2:
      def_query_set = kosu_division.objects.filter(kosu_name=kosu_instance.def_ver2)
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
      def_instance = def_query_set.first()
    else:
      def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
      def_instance = def_query_set.first()

    # 作業詳細取得
    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # データ変換
    kosu_serializer = KosuSerializer(kosu_instance)
    def_serializer = DefSerializer(def_instance)
    member_serializer = MemberSerializer(member_data, many=False)
    detail_serializer = DefChoiceSerializer(detail_choice, many=True)

    # 送信データ
    response_data = {
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'member_data': member_serializer.data,
      'detail_data_list': detail_serializer.data,
    }

    return Response(response_data)


  # PUT処理
  def put(self, request, pk):
    # 工数データ取得
    kosu_instance = self.get_object(pk)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッション値、日付、ログイン者データ取得
    def_ver = request.session.get('input_def')
    login_no = request.session.get('login_No')
    day = request.session.get('day')
    member_obj = member.objects.get(employee_no=login_no)

    # 工数区分定義設定エラー
    if kosu_instance.def_ver2:
      if kosu_instance.def_ver2 != def_ver:
        return Response({'status': 'error', 'message': '指定就業日を入力している工数定義区分と使用しようとしている工数定義区分が違います。'}, status=status.HTTP_400_BAD_REQUEST)
    # 日付更新エラー
    if day != request.data.get('work_day2'):
      return Response({'status': 'error', 'message': '更新ボタンで就業日の修正はできません。就業日更新で変更してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # フォームの数取得
    keys = [key for key in request.data.keys() if key.startswith('time1_')]
    numbers = [int(key[len('time1_'):]) for key in keys if key[len('time1_'):].isdigit()]
    max_num = max(numbers) if numbers else None

    # 空の作業内容リスト作成
    work_list = list(itertools.repeat('#', 288))
    detail_list = list(itertools.repeat('', 288))

    # 工数書き込み
    jst = datetime.timezone(datetime.timedelta(hours=9))
    if max_num:
      for n in range(max_num):
        start_time = datetime.datetime.strptime(request.data.get(f'time1_{n + 1}'), "%Y-%m-%dT%H:%M:%S.%fZ")
        end_time = datetime.datetime.strptime(request.data.get(f'time2_{n + 1}'), "%Y-%m-%dT%H:%M:%S.%fZ")
        start_time = start_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
        end_time = end_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
        start_time = start_time.strftime("%H:%M")
        end_time = end_time.strftime("%H:%M")
        start_time_hour, start_time_min = time_index(start_time)
        end_time_hour, end_time_min = time_index(end_time)
        start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
        end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

        if start_time_ind < end_time_ind:
          for i in range(start_time_ind, end_time_ind):
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)

        elif start_time_ind > end_time_ind:
          for i in range(start_time_ind, 288):
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)
          for i in range(0, end_time_ind):
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)
      kosu_instance.time_work = ''.join(work_list)
      kosu_instance.detail_work = detail_list_summarize(detail_list)

    kosu_instance.tyoku2 = request.data.get('tyoku2')
    kosu_instance.work_time = request.data.get('work_time')
    kosu_instance.judgement = judgement_check(work_list, kosu_instance.work_time, kosu_instance.tyoku2, member_obj, request.data.get('over_time', 0))
    if not kosu_instance.def_ver2:
      kosu_instance.def_ver2 = def_ver
    kosu_instance.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# 工数編集(就業日変更)
class DayUpdate(APIView):
  # PUT処理
  def put(self, request):
    # セッション値、日付取得
    login_no = request.session.get('login_No')
    day = request.data.get('work_day2')

    # 日付取得
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    else:
      request.session['day'] = str(day)

    # 工数データ確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    # 変更日に工数データがある場合、エラー
    if obj_filter.exists():
      return Response({'status': 'error', 'message': '変更日に既に工数データがあります。変更先の工数データを削除してから実行してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データ日付更新
    Business_Time_graph.objects.update_or_create(
      id=request.data.get('id'), 
      defaults = {'work_day2': day}
      )
    return Response({'status': 'success', 'message': '日付が変更されました。'})



# 工数編集(項目削除)
class ItemDlete(APIView):
  # POST処理
  def post(self, request):
    # セッション値、日付取得
    login_no = request.session.get('login_No')
    day = request.data.get('work_day2')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数データ確認
    obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    # 工数データがある場合
    if obj_filter.exists():
      # 工数データ取得
      obj_get = obj_filter.first()
      # 作業内容がある場合、作業内容、作業詳細取得
      if obj_get.time_work:
        work_list = list(obj_get.time_work)
        detail_list = obj_get.detail_work.split('$')
      # 作業内容がない場合エ、エラー
      else:
        return Response({'status': 'error', 'message': '工数データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)
    # 工数データがない場合、エラー
    else:
      return Response({'status': 'error', 'message': '工数データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 項目番号から削除時間取得
    jst = datetime.timezone(datetime.timedelta(hours=9))
    start_time = datetime.datetime.strptime(request.data.get(f'time1'), "%Y-%m-%dT%H:%M:%S.%fZ")
    end_time = datetime.datetime.strptime(request.data.get(f'time2'), "%Y-%m-%dT%H:%M:%S.%fZ")
    start_time = start_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
    end_time = end_time.replace(tzinfo=datetime.timezone.utc).astimezone(jst)
    start_time = start_time.strftime("%H:%M")
    end_time = end_time.strftime("%H:%M")
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

    # 工数削除
    if start_time_ind < end_time_ind:
      for i in range(start_time_ind, end_time_ind):
        work_list[i] = '#'
        detail_list[i] = ''
    elif start_time_ind > end_time_ind:
      for i in range(start_time_ind, 288):
        work_list[i] = '#'
        detail_list[i] = ''
      for i in range(0, end_time_ind):
        work_list[i] = '#'
        detail_list[i] = ''

    # 工数データ更新
    Business_Time_graph.objects.update_or_create(
      employee_no3=login_no, 
      work_day2=day, 
      defaults = {
        'time_work': ''.join(work_list), 
        'detail_work': detail_list_summarize(detail_list), 
      }
    )
    return Response({'status': 'success', 'message': '項目が削除されました。'})



# 工数削除
class KosuDelete(APIView):
  # 指定IDの工数データ取得
  def get_object(self, pk):
    try:
      return Business_Time_graph.objects.get(id=pk)
    except Business_Time_graph.DoesNotExist:
      return None


  # DELETE処理
  def delete(self, request, pk):
    # セッション値取得
    login_no = request.session.get('login_No')
    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 削除対象のオブジェクトを取得
    kosu_instance = self.get_object(pk)
    if kosu_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # レコードを削除
    kosu_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)



# 勤務入力
class KosuCalendar(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # アクセス権限取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数履歴データの取得
    Search_month = str(datetime.date(year, month , 1))
    kosu_data = Business_Time_graph.objects.filter(employee_no3=login_no).order_by('-work_day2')
    kosu_data = kosu_data.filter(work_day2__startswith=Search_month[:7])
    # データ変換
    kosu_serializer = KosuSerializer(kosu_data, many=True)

    # 送信データ
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
    }
    return Response(response_data)



# 勤務入力(カレンダー変更)
class KosuCalendarChange(APIView):
  # POST処理
  def post(self, request):
    # セッション値取得
    request.session['year'] = request.data.get('year')
    request.session['month'] = request.data.get('month')
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'})



# 勤務入力(個別変更)
class KosuWorkWrite(APIView):
  # POST処理
  def post(self, request, *args, **kwargs):
    # セッション値取得
    login_no = request.session.get('login_No')
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者データ確認
    member_query_set = member.objects.filter(employee_no=login_no)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 指定月の最終日取得
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 勤務、直書き込み
    for d in range(day_end):
      obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=datetime.date(year, month, d + 1))
      obj = obj_filter.first() if obj_filter.exists() else None
      day_key = f'{datetime.date(year, month, d + 1)}'
      day_data = request.data.get(day_key)
      if obj_filter.exists():
        if day_data and (day_data.get('work_time') or day_data.get('tyoku2')):
          Business_Time_graph.objects.update_or_create(
            employee_no3=login_no, 
            work_day2 = datetime.date(year, month, d + 1), 
            defaults = {
              'work_time': day_data.get('work_time', ''),
              'tyoku2': day_data.get('tyoku2', ''),
              'judgement': judgement_check(list(obj.time_work), day_data.get('work_time', ''), day_data.get('tyoku2', ''), member_data, obj.over_time)
            }
          )

        else:
          if obj.time_work == '#'*288 and obj.detail_work == '$'*287 and obj.over_time == 0:
            obj.delete()

      else:
        if day_data and (day_data.get('work_time') or day_data.get('tyoku2')):
          Business_Time_graph.objects.update_or_create(
            employee_no3=login_no, 
            work_day2 = datetime.date(year, month, d + 1), 
            defaults = {
              'name': member_data,
              'work_time': day_data.get('work_time', ''),
              'tyoku2': day_data.get('tyoku2', ''),
              'time_work': '#'*288,
              'detail_work': '$'*287,
              'over_time': 0,
              'judgement': judgement_check(list('#'*288), day_data.get('work_time', ''), day_data.get('tyoku2', ''), member_data, 0)
            }
          )

    return Response({'status': 'success', 'message': '勤務が更新されました。'})



# 勤務入力(工数編集へジャンプ)
class KosuLink(APIView):
  # POST処理
  def post(self, request):
    # 表示日更新
    request.session['day'] = request.data.get('day',str(datetime.date.today()))
    return Response({'status': 'success', 'message': '日付セッションを更新しました。'})



# デフォルト勤務書き込み
class WorkDefault(APIView):
  # POST処理
  def post(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    member_query_set = member.objects.filter(employee_no=login_no)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 選択月の最終日取得
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 直、勤務書き込み
    for d in range(day_end):
      # 工数データ取得しデータがあるか確認
      day = datetime.date(year, month, d + 1)
      obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
      obj = obj_filter.first() if obj_filter.exists() else None

      # 該当日に工数データがない場合、工数データ作成
      if not obj_filter.exists(): 
        Business_Time_graph.objects.update_or_create(
          employee_no3=login_no, 
          work_day2 = day, 
          defaults = {
            'name': member_data,
            'work_time': '休日' if day.weekday() in [5, 6] else '出勤',
            'time_work': '#'*288,
            'detail_work': '$'*287,
            'over_time': 0,
            'judgement': True if day.weekday() in [5, 6] else False
          }
        )
      # 該当日に工数データはあり勤務形態のデータがない場合、勤務形態書き込み
      elif not obj.work_time:
        Business_Time_graph.objects.update_or_create(
          employee_no3=login_no, 
          work_day2 = day, 
          defaults = {
            'work_time': '休日' if day.weekday() in [5, 6] else '出勤',
            'judgement': judgement_check(list(obj.time_work), '休日' if day.weekday() in [5, 6] else '出勤', obj.tyoku2, member_data, obj.over_time)
          }
        )

    return Response({'status': 'success', 'message': 'デフォルト勤務を設定しました。'})



# デフォルト直書き込み
class TyokuDefault(APIView):
  # POST処理
  def post(self, request, *args, **kwargs):
    # セッション値取得
    login_no = request.session.get('login_No')
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者データ確認
    member_query_set = member.objects.filter(employee_no=login_no)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 月の最終日取得
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 直書き込み
    for d in range(day_end):
      # 1日毎に工数データ確認
      day = datetime.date(year, month, d + 1)
      obj_filter = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)

      # 平日の場合
      if day.weekday() < 5:
        # 工数データ取得
        obj = obj_filter.first() if obj_filter.exists() else None
        # 該当日の対応週の直データ取得
        week_data = request.data.get(f'default_tyoku{get_week_of_month(day)}', None)
        # 該当日に工数データがない場合、工数データ作成
        if week_data and not obj:
          Business_Time_graph.objects.update_or_create(
            employee_no3=login_no,
            work_day2 = day,
            defaults = {
              'name': member_data,
              'tyoku2': week_data,
              'time_work': '#'*288,
              'detail_work': '$'*287,
              'over_time': 0,
              'judgement': False
            }
          )
        # 該当日に工数データはあり直のデータがない場合、直書き込み
        elif week_data and not obj.tyoku2:
          Business_Time_graph.objects.update_or_create(
            employee_no3=login_no,
            work_day2 = day,
            defaults = {
              'tyoku2': week_data,
              'judgement': judgement_check(list(obj.time_work), obj.work_time, week_data, member_data, obj.over_time)
            }
          )
    return Response({'status': 'success', 'message': 'デフォルト直を設定しました。'})



# 工数集計
class KosuTotal(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver_session = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 就業日取得
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # ログイン者データ確認
    member_query_set = member.objects.filter(employee_no=login_no)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 工数データ確認
    kosu_query_set = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day)
    if kosu_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データ取得
    kosu_data = kosu_query_set.first()
    if kosu_data is None:
      kosu_data = Business_Time_graph()
      kosu_data.employee_no3 = login_no
      kosu_data.work_day2 = day
      kosu_data.def_ver2 = def_ver_session
      kosu_data.time_work = '#'*288

    # 工数区分定義確認
    def_query_set = kosu_division.objects.filter(kosu_name=kosu_data.def_ver2 if kosu_data.def_ver2 else def_ver_session)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # データ変換
    member_serializer = MemberSerializer(member_data, many=False)
    kosu_serializer = KosuSerializer(kosu_data)
    def_serializer = DefSerializer(def_data, many=False)

    # 送信データ
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'session_day': day,
    }
    return Response(response_data)


  # POST処理
  def post(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver_session = request.session.get('input_def')

    # 就業日取得
    day = request.data.get('date')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day
    day_object = datetime.datetime.strptime(day, '%Y-%m-%d')

    # ログイン者データ確認
    member_query_set = member.objects.filter(employee_no=login_no)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 工数データ確認
    if request.data.get('period') == '日間':
      kosu_query_set = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2=day_object)
      kosu_data = kosu_query_set.first()
      if kosu_query_set.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = login_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288
    elif request.data.get('period') == '月間':
      kosu_data = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2__month=day_object.month, work_day2__year=day_object.year)
      if kosu_data.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = login_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288
    elif request.data.get('period') == '年間':
      kosu_data = Business_Time_graph.objects.filter(employee_no3=login_no, work_day2__year=day_object.year)
      if kosu_data.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = login_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288

    # 工数区分定義確認
    if isinstance(kosu_data, Business_Time_graph):
      def_ver_to_filter = kosu_data.def_ver2 if kosu_data.def_ver2 else def_ver_session
    else:
      first_kosu_with_def = kosu_data.exclude(def_ver2__isnull=True).exclude(def_ver2__exact='').order_by('id').first()
      if first_kosu_with_def:
        def_ver_to_filter = first_kosu_with_def.def_ver2
      else:
        def_ver_to_filter = def_ver_session
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver_to_filter)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # データ変換
    member_serializer = MemberSerializer(member_data, many=False)
    def_serializer = DefSerializer(def_data, many=False)
    if isinstance(kosu_data, Business_Time_graph):
      kosu_serializer = KosuSerializer(kosu_data)
    else:
      kosu_serializer = KosuSerializer(kosu_data, many=True)

    # 送信データ
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'session_day': day,
    }
    return Response(response_data)
