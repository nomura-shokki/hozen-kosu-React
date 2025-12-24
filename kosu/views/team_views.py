import datetime
import openpyxl
import urllib.parse
from ..models import member, Business_Time_graph, kosu_division, team_member
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TeamSerializer, MemberSerializer, KosuSerializer, DefSerializer
from ..utils.team_utils import excel_function
from ..utils.main_utils import CustomPagination
from io import BytesIO
from django.http import HttpResponse



class TeamNew(APIView):
  def get(self, request):
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '該当するデータが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.authority:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    team_filter = team_member.objects.filter(employee_no5=login_no)
    if team_filter.count() > 1:
      return Response({'status': 'error', 'message': '複数の班員データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
    
    if team_filter.exists():
      team_data = team_filter.first()
    else:
      team_data = team_member.objects.create(employee_no5=login_no)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
        team_data.member1, team_data.member2, team_data.member3,
        team_data.member4, team_data.member5, team_data.member6,
        team_data.member7, team_data.member8, team_data.member9,
        team_data.member10, team_data.member11, team_data.member12,
        team_data.member13, team_data.member14, team_data.member15
    ]
    valid_member_numbers = [
        num for num in member_numbers if num is not None and num != ''
    ]
    team_member_choices = member.objects.filter(employee_no__in=valid_member_numbers)

    member_serializer = MemberSerializer(member_data, many=False)
    team_serializer = TeamSerializer(team_data, many=False)
    team_member_default = MemberSerializer(team_member_choices, many=True)

    if member_data.shop == '組長以上(P,R,T,その他)' or member_data.shop == '組長以上(W,A)':
      member_all = member.objects.all().order_by('employee_no')
    else:
      member_all = member.objects.filter(shop=member_data.shop).order_by('employee_no')
    member_select = MemberSerializer(member_all, many=True)

    # 送信データ
    response_data = {
      'member_data': member_serializer.data,
      'team_data': team_serializer.data,
      'member_default': team_member_default.data,
      'member_select': member_select.data,
    }
    return Response(response_data)


  def post(self, request):
    data = request.data
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    team_data, created = team_member.objects.get_or_create(
      employee_no5=login_no,
      defaults={
        'employee_no5': login_no,
      }
    )

    # 更新可能フィールド定義
    updatable_fields = [
      'member1', 'member2','member3', 'member4', 'member5', 'member6', 
      'member7', 'member8', 'member9', 'member10', 'member11', 'member12', 
      'member13', 'member14', 'member15','follow',
    ]

    # 項目毎にデータを上書き
    for field in updatable_fields:
      if field in data:
        setattr(team_data, field, data[field])
    team_data.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



class TeamList(APIView):
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      # ログインユーザーのデータ取得
      member_data = member.objects.get(employee_no=login_no)
      # 権限がない場合はMenu画面へ
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員情報取得
    try:
      team_data = team_member.objects.get(employee_no5=login_no)
    except team_member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '班員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    # 班員の人員情報取得
    team_member_choices = member.objects.filter(employee_no__in=valid_member_numbers)

    # 検索パラメータの取得
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'
    member_id = request.query_params.get('member_id')

    # 工数履歴データの取得
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')

    # 従業員番号による絞り込みをkosusクエリに追加
    if member_id:
      kosus = kosus.filter(employee_no3=member_id)

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

    # データ変換
    team_member_select = MemberSerializer(team_member_choices, many=True)
    return Response({
      'pagination_data': paginator.get_paginated_response(serializer.data).data,
      'team_member_select': team_member_select.data,
    })



class TeamDetail(APIView):
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
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員データ確認
    member_query_set = member.objects.filter(employee_no=kosu_instance.employee_no3)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    member_data = member_query_set.first()

    # 工数区分定義確認
    if kosu_instance.def_ver2:
      def_query_set = kosu_division.objects.filter(kosu_name=kosu_instance.def_ver2)
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
      def_instance = def_query_set.first()
    else:
      def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
      def_instance = def_query_set.first()

    # データ変換
    kosu_serializer = KosuSerializer(kosu_instance)
    def_serializer = DefSerializer(def_instance)
    member_serializer = MemberSerializer(member_data, many=False)

    # 送信データ
    response_data = {
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'member_data': member_serializer.data,
    }

    return Response(response_data)



class TeamCalendar(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # アクセス権限取得
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 表示日取得
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day
    
    # 表示日の週の始まり取得
    datetime_object = datetime.datetime.strptime(day, '%Y-%m-%d')
    date_object = datetime_object.date()
    current_weekday = date_object.weekday()
    days_to_subtract = (current_weekday + 1) % 7
    day_sunday = date_object - datetime.timedelta(days=days_to_subtract)

    # 班員情報取得
    try:
      team_data = team_member.objects.get(employee_no5=login_no)
    except team_member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '班員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    member_name_list = []
    for m in valid_member_numbers:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    end_day = day_sunday + datetime.timedelta(days=6)

    # 工数履歴データの取得
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')
    kosus = kosus.filter(work_day2__range=[day_sunday, end_day])

    # データ変換
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ
    response_data = {
      'Search_day': day,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list
    }
    return Response(response_data)


  # POST処理
  def post(self, request):
    request.session['day'] = request.data.get('day',str(datetime.date.today()))
    return Response({'status': 'success', 'message': '日付セッションを更新しました。'})



class TeamCalendarWeekJump(APIView):
  # POST処理
  def post(self, request):
    # 表示日取得
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    datetime_object = datetime.datetime.strptime(day, '%Y-%m-%d')
    if request.data.get('week') == 'B':
      date_object = datetime_object.date() - datetime.timedelta(days=7)
    elif request.data.get('week') == 'A':
      date_object = datetime_object.date() + datetime.timedelta(days=7)
    request.session['day'] = str(date_object)

    return Response({'status': 'success', 'message': '日付セッションを更新しました。'})



# 工数入力状況出力関数
class TeamExport(APIView):
  # POST処理
  def post(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 指定日の年,月取得し記録
    today = datetime.datetime.strptime(request.data.get('day'), '%Y-%m-%d')
    year, month = today.year, today.month
    request.session['display_day'] = request.data.get('day')

    # 新しいExcelブック作成
    wb = openpyxl.Workbook()

    # 班員データ取得
    team_data = team_member.objects.get(employee_no5=login_no)

    # 班員リスト作成
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    employee_no_nums = []
    for m in valid_member_numbers:
      employee_no_nums.append(m)

    # 班員毎にExcelに書き込み
    for ind, employee_no_num in enumerate(employee_no_nums):
      wb = excel_function(employee_no_num, wb, request)
    # 不要なシート削除
    del wb['Sheet']

    # メモリ上にExcelファイルを作成し、BytesIOオブジェクトに保存
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # URLエンコーディングされたファイル名を生成
    filename = f'班員の{year}年{month}月度業務工数入力状況.xlsx'
    quoted_filename = urllib.parse.quote(filename)

    response = HttpResponse(
      excel_file.read(),
      content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename*=UTF-8\'\'{quoted_filename}'

    return response



class TeamOverTime(APIView):
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
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員情報取得
    try:
      team_data = team_member.objects.get(employee_no5=login_no)
    except team_member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '班員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    member_name_list = []
    for m in valid_member_numbers:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    # 工数履歴データの取得
    Search_month = str(datetime.date(year, month , 1))
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')
    kosus = kosus.filter(work_day2__startswith=Search_month[:7])

    # データ変換
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list
    }
    return Response(response_data)


  # POST処理
  def post(self, request):
    # セッション値取得
    request.session['year'] = request.data.get('year')
    request.session['month'] = request.data.get('month')
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'})



class TeamView(APIView):
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
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    shop = request.session.get('shop', member_data.shop)
    team_shop = list(member.objects.filter(shop=shop).values_list('employee_no', flat=True))

    member_name_list = []
    for m in team_shop:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    # 工数履歴データの取得
    Search_month = str(datetime.date(year, month , 1))
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=team_shop).order_by('-work_day2')
    kosus = kosus.filter(work_day2__startswith=Search_month[:7])

    # データ変換
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list,
      'shop_default': shop,
    }
    return Response(response_data)


  # POST処理
  def post(self, request):
    # セッション値取得
    request.session['year'] = request.data.get('year')
    request.session['month'] = request.data.get('month')
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'})



class TeamShopSelect(APIView):
  # POST処理
  def post(self, request):
    # セッション値取得
    request.session['shop'] = request.data.get('shop_default')
    return Response({'status': 'success', 'message': '表示ショップが更新されました。'})






