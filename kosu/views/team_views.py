# ============================================================
# ファイル名 : team_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : 班員（ログイン者が管理する班のメンバー）の登録と、班員・ショップ全体の
#              工数入力状況の確認（履歴一覧・詳細・週カレンダー・月一覧・Excel出力）を行うAPI群。
#              班員関連画面（frontend/src/TeamPage/）から呼び出される。
#
# 主なクラス:
#   - TeamNew              : 班員設定の取得・保存                 GET/POST /api/team_new/
#   - TeamList             : 班員の工数履歴一覧の取得             GET      /api/team_list/
#   - TeamDetail           : 班員の工数データ1件の詳細取得        GET      /api/team_detail/<ID>/
#   - TeamCalendar         : 班員の1週間分の工数取得・表示日変更  GET/POST /api/team_calendar/
#   - TeamCalendarWeekJump : 週カレンダーの前週・翌週への移動     POST     /api/team_calendar_week_jump/
#   - TeamExport           : ショップ全員の工数入力状況をExcel出力 POST     /api/team_export/
#   - TeamOverTime         : 班員の1か月分の工数取得・表示年月変更 GET/POST /api/team_overtime/
#   - TeamView             : ショップ全体の1か月分の工数取得・表示年月変更 GET/POST /api/team_view/
#   - TeamShopSelect       : 工数入力状況(全体)の表示ショップ変更 POST     /api/team_shop_select/
#
# 権限       : TeamShopSelect は IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#              それ以外はすべて HasAuthority（ログイン済みかつ「権限」ありの人員のみ利用可能）
# セッション : day（週カレンダーの表示日 "YYYY-MM-DD"）、year / month（月表示の年・月）、
#              shop（工数入力状況(全体)の表示ショップ）を画面間で保持する。
#              ※ day / year / month は工数入力画面（kosu_views.py）など他のAPIでも同じキー名で読み書きされる
# 関連ファイル: models.py（team_member, member, Business_Time_graph, kosu_division, administrator_data）,
#              views/serializers.py（TeamSerializer, MemberSerializer, KosuSerializer, DefSerializer）,
#              utils/team_utils.py（excel_function）, utils/main_utils.py（CustomPagination）,
#              permissions.py, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
import datetime
# openpyxl: Excelファイル（.xlsx）を作成・編集するライブラリ
import openpyxl
# urllib.parse: 日本語のファイル名をURLエンコード（%xx 形式）するために使う
import urllib.parse
from django.db.models import Case, When, Value, IntegerField  
from ..models import member, Business_Time_graph, kosu_division, team_member, administrator_data
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import TeamSerializer, MemberSerializer, KosuSerializer, DefSerializer
from ..utils.team_utils import excel_function, team_member_numbers
from ..utils.main_utils import CustomPagination, get_settings, parse_year_month
from ..permissions import HasAuthority
# BytesIO: ファイルをディスクに保存せず、メモリ上で作成するための入れ物
from io import BytesIO
from django.http import HttpResponse



# ------------------------------------------------------------
# TeamNew: 班員登録API
#   URL  : /api/team_new/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : ログイン者の班員設定と、班員として選べる人員の一覧を返す（班員登録画面の初期表示用）
#          班員設定がまだ無い場合は空の班員設定をこの時点で作成する。
#   POST : ログイン者の班員（最大15人）とフォローON/OFFを保存する
# ------------------------------------------------------------
class TeamNew(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # ログイン者の班員設定と選択肢を返す（GET）。
  #
  # 班員として選べる人員は、ログイン者のショップが「組長以上」なら全人員（異動・退社は末尾）、
  # それ以外ならログイン者と同じショップの人員に限る。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: member_data（ログイン者）/ team_data（班員設定）/
  #             member_default（現在登録されている班員の人員データ）/ member_select（選択肢の人員一覧）
  #             班員設定が複数存在する場合は 401 エラー
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者が班長として登録している班員設定を検索（employee_no5 = 班長の従業員番号）
    team_filter = team_member.objects.filter(employee_no5=member_data.employee_no)
    # 1人の班長に班員設定が複数ある場合はどれを使うか決められないためエラーにする
    if team_filter.count() > 1:
      return Response({'status': 'error', 'message': '複数の班員データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # 班員設定があればそれを使い、無ければ班員が空の班員設定を新規作成する
    if team_filter.exists():
      team_data = team_filter.first()
    else:
      team_data = team_member.objects.create(employee_no5=member_data.employee_no)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
        team_data.member1, team_data.member2, team_data.member3,
        team_data.member4, team_data.member5, team_data.member6,
        team_data.member7, team_data.member8, team_data.member9,
        team_data.member10, team_data.member11, team_data.member12,
        team_data.member13, team_data.member14, team_data.member15
    ]
    # 未設定（None または空文字）の枠を除き、登録済みの班員の従業員番号だけにする
    valid_member_numbers = [
        num for num in member_numbers if num is not None and num != ''
    ]
    # 登録済みの班員の人員データを取得（画面の各選択欄の初期値表示用）
    team_member_choices = member.objects.filter(employee_no__in=valid_member_numbers)

    # ログイン者・班員設定・班員の人員データをJSONに変換できる形にする
    member_serializer = MemberSerializer(member_data, many=False)
    team_serializer = TeamSerializer(team_data, many=False)
    team_member_default = MemberSerializer(team_member_choices, many=True)

    # 班員の選択肢を作成する
    # ログイン者のショップが「組長以上」の場合は、ショップをまたいで全人員から選べるようにする
    #   shop_order: 「異動・退社」なら 1、それ以外は 0 という並び替え用の一時的な列を追加
    #   → shop_order の昇順（在籍者が先）、次に従業員番号の昇順で並べる
    if member_data.shop == '組長以上(P,R,T,その他)' or member_data.shop == '組長以上(W,A)':
      member_all = member.objects.annotate(  
        shop_order=Case(  
          When(shop='異動・退社', then=Value(1)),  
          default=Value(0),  
          output_field=IntegerField(),  
        )  
      ).order_by('shop_order', 'employee_no')  
    # それ以外のショップは、ログイン者と同じショップの人員を従業員番号順に並べる
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


  # ログイン者の班員設定を保存する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に member1〜member15（班員の従業員番号。空欄可）と
  #            follow（フォローON/OFF: ONにすると班員MENUに工数未入力のお知らせが出る）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self, request):
    # 画面から送信された班員設定
    data = request.data

    # ログイン者の人員データ（班長として班員設定を保存する）
    member_data = request.user

    # ログイン者の班員設定を取得し、無ければ新規作成する
    #   get_or_create の戻り値: (班員設定, 新規作成したかどうか)
    team_data, created = team_member.objects.get_or_create(
      employee_no5=member_data.employee_no,
      defaults={
        'employee_no5': member_data.employee_no,
      }
    )

    # 画面から更新を受け付ける項目（班員1〜15 とフォローON/OFF）
    updatable_fields = [
      'member1', 'member2','member3', 'member4', 'member5', 'member6', 
      'member7', 'member8', 'member9', 'member10', 'member11', 'member12', 
      'member13', 'member14', 'member15','follow',
    ]

    # 受け付ける項目のうち、送信されてきたものだけを上書きして保存する
    for field in updatable_fields:
      if field in data:
        setattr(team_data, field, data[field])
    team_data.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# ------------------------------------------------------------
# TeamList: 班員工数履歴API
#   URL  : /api/team_list/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : ログイン者の班員全員の工数データを新しい日付順にページネーション付きで返す。
#          就業日（日 / 月単位）・班員（従業員番号）で絞り込み可能。
# ------------------------------------------------------------
class TeamList(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 班員の工数履歴一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     day       (任意): 検索日 "YYYY-MM-DD"（filter が "true" のときだけ有効）
  #     mode      (任意): "month" なら day の年月で月単位検索、それ以外（既定 "day"）は日単位検索
  #     filter    (任意): "true" のとき日付での絞り込みを行う
  #     member_id (任意): 班員の従業員番号（完全一致）
  #     page      (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: pagination_data（ページネーション済みの工数一覧: count / page_size / results）と
  #             team_member_select（絞り込み用の班員の人員データ一覧）
  #             班員設定が無い場合は 400 エラー
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の班員設定を取得
    try:
      team_data = team_member.objects.get(employee_no5=member_data.employee_no)
    except team_member.DoesNotExist:
      # 班員設定が無い場合は、班員登録を促すメッセージで 400 を返す
      return Response({'status': 'error', 'message': '班員情報を登録してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    # 未設定（None または空文字）の枠を除き、登録済みの班員の従業員番号だけにする
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    # 班員の人員データを取得（絞り込みプルダウンの選択肢用）
    team_member_choices = member.objects.filter(employee_no__in=valid_member_numbers)

    # クエリパラメータから検索条件を取得
    #   filter_flag: "true" という文字列で送られてきたときだけ True
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'
    member_id = request.query_params.get('member_id')

    # 班員全員の工数データを就業日の降順（新しい日付が先頭）で取得
    #   select_related('name'): 氏名（人員データへの外部キー）を同じSQLでまとめて取得する
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')

    # 班員が指定されている場合は、その班員の工数データだけに絞り込む
    if member_id:
      kosus = kosus.filter(employee_no3=member_id)

    # 日付での絞り込み（検索日があり、filter="true" のときのみ）
    #   月単位: 検索日の先頭7文字（"YYYY-MM"）で始まる就業日 → その月の全日
    #   日単位: 就業日が検索日と一致
    if search_day and filter_flag:
      if mode == 'month':
        kosus = kosus.filter(work_day2__startswith=search_day[:7])
      else:
        kosus = kosus.filter(work_day2=search_day)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(kosus, request)
    # 取り出した工数データをJSONに変換できる形にする
    serializer = KosuSerializer(result_page, many=True)

    # 班員の人員データをJSONに変換し、工数一覧と一緒に返す
    team_member_select = MemberSerializer(team_member_choices, many=True)
    return Response({
      'pagination_data': paginator.get_paginated_response(serializer.data).data,
      'team_member_select': team_member_select.data,
    })



# ------------------------------------------------------------
# TeamDetail: 班員工数詳細API
#   URL  : /api/team_detail/<ID>/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : 指定したIDの工数データと、その工数の人員データ・工数区分定義を返す（工数履歴詳細画面用）
# ------------------------------------------------------------
class TeamDetail(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # IDから工数データを1件取得する。
  #
  # 引数:
  #   pk: 工数データのID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   Business_Time_graph: 該当する工数データ。存在しない場合は None
  def get_object(self, pk):
    try:
      return Business_Time_graph.objects.get(id=pk)
    # 該当するデータがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except Business_Time_graph.DoesNotExist:
      return None


  # 工数データの詳細を返す（GET）。
  #
  # 工数区分定義は、工数データに記録されているVer（def_ver2）を優先し、
  # 記録が無い場合はセッションで使用中のVerを使う（入力時の定義で表示するため）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 工数データのID（URLから取得）
  # 戻り値:
  #   Response: kosu_data（工数データ）/ def_data（工数区分定義）/ member_data（工数データの人員）
  #             該当なしの場合は 404、工数区分定義Verが未選択・人員や定義が無い場合は 401、
  #             人員や定義が複数ある場合は 400 エラー
  def get(self, request, pk):
    # URLで指定されたIDの工数データを取得
    kosu_instance = self.get_object(pk)

    # 該当するデータがない場合、またはログイン者の班員の工数データでない場合は 404（見つからない）を返す
    if not kosu_instance or (not request.user.administrator and kosu_instance.employee_no3 not in team_member_numbers(request.user.employee_no)):
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッションから、現在使用中の工数区分定義Ver名を取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 工数データの持ち主（従業員番号 employee_no3）の人員データを検索
    #   該当なしは 401、同じ従業員番号の人員が複数いる場合は 400 を返す
    member_query_set = member.objects.filter(employee_no=kosu_instance.employee_no3)
    if not member_query_set.exists():
      return Response({'status': 'error', 'message': 'メンバーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif member_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数のメンバーが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    # 1件だけ存在することが確定したので、その1件を取り出す
    member_data = member_query_set.first()

    # 工数区分定義を決める
    # 工数データに入力時の工数区分定義Ver（def_ver2）が記録されている場合はそのVerを使う
    if kosu_instance.def_ver2:
      def_query_set = kosu_division.objects.filter(kosu_name=kosu_instance.def_ver2)
      # 該当なしは 401、同じVer名が複数ある場合は 400 を返す
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
      def_instance = def_query_set.first()
    # 記録が無い場合は、セッションで使用中の工数区分定義Verを使う
    else:
      def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
      # 該当なしは 401、同じVer名が複数ある場合は 400 を返す
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
      def_instance = def_query_set.first()

    # 工数データ・工数区分定義・人員データをJSONに変換できる形にする
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



# ------------------------------------------------------------
# TeamCalendar: 班員工数入力状況（週カレンダー）API
#   URL  : /api/team_calendar/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : セッションの表示日を含む週（日曜〜土曜）の、班員全員の工数データを返す
#   POST : 表示日（セッションの day）を指定した日付に変更する
# ------------------------------------------------------------
class TeamCalendar(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 表示日を含む1週間分の班員の工数データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: Search_day（表示日 "YYYY-MM-DD"）/ kosu_data（その週の班員の工数データ）/
  #             member_name_list（[従業員番号, 氏名] の班員リスト）
  #             班員設定が無い場合は 400 エラー
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # セッションから表示日を取得。未設定（または空文字）なら今日の日付を表示日にしてセッションにも保存する
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day
    
    # 表示日を含む週の日曜日を求める
    #   weekday(): 月曜=0, 火曜=1, … 土曜=5, 日曜=6
    #   (weekday + 1) % 7 で「直前の日曜から何日経ったか」になる
    #   例: 水曜(2) → 3日前が日曜 / 日曜(6) → 0日前（当日）が日曜
    datetime_object = datetime.datetime.strptime(day, '%Y-%m-%d')
    date_object = datetime_object.date()
    current_weekday = date_object.weekday()
    days_to_subtract = (current_weekday + 1) % 7
    day_sunday = date_object - datetime.timedelta(days=days_to_subtract)

    # ログイン者の班員設定を取得
    try:
      team_data = team_member.objects.get(employee_no5=member_data.employee_no)
    except team_member.DoesNotExist:
      # 班員設定が無い場合は、班員登録を促すメッセージで 400 を返す
      return Response({'status': 'error', 'message': '班員情報を登録してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    # 未設定（None または空文字）の枠を除き、登録済みの班員の従業員番号だけにする
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    # 画面の行見出し用に [従業員番号, 氏名] のリストを班員の登録順に作る
    #   ※班員に登録された従業員番号の人員が削除されていると member.DoesNotExist が発生する
    member_name_list = []
    for m in valid_member_numbers:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    # 週の最終日（日曜日の6日後＝土曜日）
    end_day = day_sunday + datetime.timedelta(days=6)

    # 班員全員の工数データのうち、就業日が日曜〜土曜の範囲にあるものを取得
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')
    kosus = kosus.filter(work_day2__range=[day_sunday, end_day])

    # 工数データをJSONに変換できる形にする
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ
    response_data = {
      'Search_day': day,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list
    }
    return Response(response_data)


  # 表示日を変更する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の day に表示したい日付 "YYYY-MM-DD"（未送信なら今日）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self, request):
    # 送信された日付をセッションの表示日に保存する（次回の GET でその週が表示される）
    request.session['day'] = request.data.get('day',str(datetime.date.today()))
    return Response({'status': 'success', 'message': '日付セッションを更新しました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# TeamCalendarWeekJump: 週カレンダー週移動API
#   URL  : /api/team_calendar_week_jump/
#   権限 : HasAuthority（権限ありの人員のみ）
#   POST : セッションの表示日を1週間前（week="B"）または1週間後（week="A"）にずらす
# ------------------------------------------------------------
class TeamCalendarWeekJump(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 表示日を前週・翌週へ移動する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の week に "B"（前週へ）または "A"（翌週へ）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  #             ※week が "A" / "B" 以外の場合は date_object が未定義のままとなり例外が発生する
  def post(self, request):
    # セッションから表示日を取得。未設定（または空文字）なら今日の日付を表示日にする
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # 表示日を文字列から日付に変換し、7日前 / 7日後にずらす
    datetime_object = datetime.datetime.strptime(day, '%Y-%m-%d')
    # "B"（Before）: 1週間前へ
    if request.data.get('week') == 'B':
      date_object = datetime_object.date() - datetime.timedelta(days=7)
    # "A"（After）: 1週間後へ
    elif request.data.get('week') == 'A':
      date_object = datetime_object.date() + datetime.timedelta(days=7)
    # "A" / "B" 以外は 400（前は date_object が無いまま進んで 500 になった）
    else:
      return Response({'status': 'error', 'message': 'week は A か B を指定してください。'}, status=status.HTTP_400_BAD_REQUEST)
    # ずらした日付を "YYYY-MM-DD" 文字列にしてセッションの表示日に保存する
    request.session['day'] = str(date_object)

    return Response({'status': 'success', 'message': '日付セッションを更新しました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# TeamExport: 工数入力状況Excel出力API
#   URL  : /api/team_export/
#   権限 : HasAuthority（権限ありの人員のみ）
#   POST : 指定したショップの全人員について、指定年月の工数入力状況をExcelファイルで返す。
#          人員ごとに1シートを作成し、日ごとのOK/NG・就業形態・直・残業・工数区分別の時間などを書き込む。
# ------------------------------------------------------------
class TeamExport(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 工数入力状況のExcelファイルを作成して返す（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data で以下を受け付ける
  #     year  : 対象年（数値。例: 2026）
  #     month : 対象月（数値。1〜12）
  #     shop2 : 対象ショップ（例: "W1"）
  # 戻り値:
  #   HttpResponse: Excelファイル（.xlsx）のダウンロード用レスポンス
  #                 ファイル名は「{年}年{月}月度_工数入力状況_{ショップ}.xlsx」
  def post(self, request):
    # 送信された対象年・月・ショップを取得（年・月は数字か確かめる。数字でなければ 400）
    post_data = request.data
    try:
      year, month = parse_year_month(post_data)
    except ValueError:
      return Response({'status': 'error', 'message': '年・月が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
    shop = post_data.get('shop2')

    # 新しいExcelブックを作成（最初から "Sheet" という名前の空シートが1枚入っている）
    wb = openpyxl.Workbook()

    # 対象ショップの人員を従業員番号順に取得し、従業員番号だけのリストも作る
    member_list = member.objects.filter(shop=shop).order_by('employee_no')
    employee_no_nums = list(member_list.values_list('employee_no', flat=True))

    # 対象月の初日
    start_date = datetime.date(year, month, 1)
    # 翌月の1日から1日引いて月末日を算出
    #   12月は翌月が翌年の1月になるため、年を1つ進める
    if month == 12:
      end_date = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
      end_date = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)

    # 対象ショップ全員の、対象月（初日〜月末日）の工数データを一括取得
    all_kosu_qs = Business_Time_graph.objects.filter(
      employee_no3__in=employee_no_nums,
      work_day2__range=(start_date, end_date)
    )

    # 検索を高速化するために辞書化 {employee_no: {work_day: obj}}
    #   人員ごと・日ごとに毎回DBを検索せず、辞書から直接取り出せるようにする
    kosu_data_dict = {}
    for k in all_kosu_qs:
      if k.employee_no3 not in kosu_data_dict:
        kosu_data_dict[k.employee_no3] = {}
      kosu_data_dict[k.employee_no3][k.work_day2] = k

    # 人員ごとにExcelに書き込み（excel_function が人員1人分のシートを追加して返す）
    for ind, employee_no_num in enumerate(employee_no_nums):
      # 該当する従業員のデータのみを切り出して渡す（工数データが1件も無い人員は空の辞書）
      member_kosu_data = kosu_data_dict.get(employee_no_num, {})
      wb = excel_function(employee_no_num, wb, year, month, request, member_kosu_data)
    
    # ブック作成時に自動で入っていた空シート "Sheet" を削除
    del wb['Sheet']

    # メモリ上にExcelファイルを作成し、BytesIOオブジェクトに保存
    #   seek(0): 読み出し位置を先頭に戻す（書き込み直後は末尾にあるため）
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    # URLエンコーディングされたファイル名を生成
    #   日本語のファイル名をそのままヘッダーに入れると文字化けするため、%xx 形式に変換する
    filename = f'{year}年{month}月度_工数入力状況_{shop}.xlsx'
    quoted_filename = urllib.parse.quote(filename)

    # Excelファイルの中身をレスポンス本文にする（content_type は .xlsx 形式を表す値）
    response = HttpResponse(
      excel_file.read(),
      content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    # ダウンロードとして扱わせ、ファイル名を指定する
    #   filename*=UTF-8''〜 は「UTF-8でURLエンコードしたファイル名」を表す書き方
    response['Content-Disposition'] = f'attachment; filename*=UTF-8\'\'{quoted_filename}'

    return response



# ------------------------------------------------------------
# TeamOverTime: 班員工数入力状況（月一覧）API
#   URL  : /api/team_overtime/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : セッションの表示年月の、班員全員の工数データを返す（残業時間・入力OK/NGの月一覧用）
#   POST : 表示年月（セッションの year / month）を変更する
# ------------------------------------------------------------
class TeamOverTime(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 表示年月の班員の工数データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: session_year / session_month（表示年月）/ kosu_data（その月の班員の工数データ）/
  #             member_name_list（[従業員番号, 氏名] の班員リスト）
  #             班員設定が無い場合は 400 エラー
  def get(self, request):
    # セッションから表示年・月を取得。未設定なら今日の年・月を使う（この場合セッションには保存しない）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の班員設定を取得
    try:
      team_data = team_member.objects.get(employee_no5=member_data.employee_no)
    except team_member.DoesNotExist:
      # 班員設定が無い場合は、班員登録を促すメッセージで 400 を返す
      return Response({'status': 'error', 'message': '班員情報を登録してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # 班員の従業員番号をリストにまとめる
    member_numbers = [
      team_data.member1, team_data.member2, team_data.member3,
      team_data.member4, team_data.member5, team_data.member6,
      team_data.member7, team_data.member8, team_data.member9,
      team_data.member10, team_data.member11, team_data.member12,
      team_data.member13, team_data.member14, team_data.member15
    ]
    # 未設定（None または空文字）の枠を除き、登録済みの班員の従業員番号だけにする
    valid_member_numbers = [
      num for num in member_numbers if num is not None and num != ''
    ]
    # 画面の行見出し用に [従業員番号, 氏名] のリストを班員の登録順に作る
    #   ※班員に登録された従業員番号の人員が削除されていると member.DoesNotExist が発生する
    member_name_list = []
    for m in valid_member_numbers:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    # 表示月の工数データを取得
    #   Search_month: 表示月の1日 "YYYY-MM-01"。先頭7文字 "YYYY-MM" で始まる就業日＝その月の全日
    Search_month = str(datetime.date(year, month , 1))
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=valid_member_numbers).order_by('-work_day2')
    kosus = kosus.filter(work_day2__startswith=Search_month[:7])

    # 工数データをJSONに変換できる形にする
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list
    }
    return Response(response_data)


  # 表示年月を変更する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の year / month に表示したい年・月（数値）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self, request):
    # 送信された年・月を確かめてからセッションに保存する（次回の GET でその月が表示される）
    try:
      year, month = parse_year_month(request.data)
    except ValueError:
      return Response({'status': 'error', 'message': '年・月が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
    request.session['year'] = year
    request.session['month'] = month
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'})



# ------------------------------------------------------------
# TeamView: 工数入力状況(全体)API
#   URL  : /api/team_view/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : 表示ショップに所属する人員全員の、表示年月の工数データを返す（入力OK/NGの月一覧用）
#          表示ショップはセッションの shop（未設定ならログイン者のショップ）。
#   POST : 表示年月（セッションの year / month）を変更する
# ------------------------------------------------------------
class TeamView(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 表示ショップ・表示年月の工数データを返す（GET）。
  #
  # 問い合わせ担当者（管理者設定の担当者従業員番号1〜3）に登録されている人員は表示対象から除く。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: session_year / session_month（表示年月）/ kosu_data（その月の工数データ）/
  #             member_name_list（[従業員番号, 氏名] の人員リスト）/ shop_default（表示ショップ）
  def get(self, request):
    # セッションから表示年・月を取得。未設定なら今日の年・月を使う（この場合セッションには保存しない）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 最新（IDが最大）の管理者設定を取得（問い合わせ担当者の従業員番号を知るため。無ければ初期値で作る）
    admin_data = get_settings()

    # 問い合わせ担当者の従業員番号1〜3（文字列項目。空欄の場合もある）
    admin_list_raw = [
      admin_data.administrator_employee_no1,
      admin_data.administrator_employee_no2,
      admin_data.administrator_employee_no3
    ]
    # 空欄や数字以外を除き、数値に変換した担当者従業員番号のリストを作る
    #   例: ["123", "", None] → [123]
    admin_list = []
    for a in admin_list_raw:
      if a and str(a).strip().isdigit():
        admin_list.append(int(a))

    # 表示ショップ: セッションの shop（TeamShopSelect で保存）、未設定ならログイン者のショップ
    shop = request.session.get('shop', member_data.shop)
    # 表示ショップに所属する人員の従業員番号を取得し、問い合わせ担当者を除く
    team_shop = list(member.objects.filter(shop=shop).values_list('employee_no', flat=True))
    team_shop = [x for x in team_shop if x not in admin_list]

    # 画面の行見出し用に [従業員番号, 氏名] のリストを作る
    member_name_list = []
    for m in team_shop:
      member_obj = member.objects.get(employee_no=m)
      member_name_list.append([m, member_obj.name])

    # 表示月の工数データを取得
    #   Search_month: 表示月の1日 "YYYY-MM-01"。先頭7文字 "YYYY-MM" で始まる就業日＝その月の全日
    Search_month = str(datetime.date(year, month , 1))
    kosus = Business_Time_graph.objects.select_related('name').filter(employee_no3__in=team_shop).order_by('-work_day2')
    kosus = kosus.filter(work_day2__startswith=Search_month[:7])

    # 工数データをJSONに変換できる形にする
    kosu_serializer = KosuSerializer(kosus, many=True)

    # 送信データ（shop_default は画面のショップ選択欄の初期値に使う）
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
      'member_name_list': member_name_list,
      'shop_default': shop,
    }
    return Response(response_data)


  # 表示年月を変更する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の year / month に表示したい年・月（数値）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self, request):
    # 送信された年・月を確かめてからセッションに保存する（TeamOverTime と同じキーのため表示年月は共通になる）
    try:
      year, month = parse_year_month(request.data)
    except ValueError:
      return Response({'status': 'error', 'message': '年・月が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
    request.session['year'] = year
    request.session['month'] = month
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# TeamShopSelect: 表示ショップ変更API
#   URL  : /api/team_shop_select/
#   権限 : IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#   POST : 工数入力状況(全体)画面で表示するショップ（セッションの shop）を変更する
# ------------------------------------------------------------
class TeamShopSelect(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 表示ショップを変更する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の shop_default に表示したいショップ（例: "W1"）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self, request):
    # 送信されたショップをセッションに保存する（次回の TeamView の GET で使われる）
    request.session['shop'] = request.data.get('shop_default')
    return Response({'status': 'success', 'message': '表示ショップが更新されました。'}, status=status.HTTP_200_OK)






