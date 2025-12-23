import datetime
import os
import sys
import logging
import environ
import json
from pathlib import Path
from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..models import member, Business_Time_graph, kosu_division, team_member, administrator_data, AsyncTask, History
from .serializers import MemberSerializer, AdministratorSerializer, KosuSerializer, DefSerializer, TaskSerializer, HistorySerializer
from ..utils.main_utils import CustomPagination, get_all_model_names_in_myapp




# 専用ロガー取得('views_logger'という名前のカスタムロガーを使用しログメッセージ記録)
views_logger = logging.getLogger('views_logger')

# 標準出力をロガーにリダイレクト(sys.stdoutをカスタムロガーへリダイレクト)
# print関数の出力をログとして記録
class PrintToLogger:
  def write(self, message):
    # 受け取った標準出力のメッセージ処理(空白および改行のみのメッセージは無視)
    if message.strip():  
      views_logger.info(message)

  def flush(self):
    # 処理不要のため空処理
    pass

# 標準出力をロガーへリダイレクト(sys.stdoutをPrintToLoggerのインスタンスに設定)
sys.stdout = PrintToLogger()

# 記録されたログを画面上に表示
def get_logs(request):
  # 'web_console.log' ファイルを読み込み専用モードで開く
  with open('web_console.log', 'r') as log_file:
    # ファイルの内容を行ごとにリストとして格納
    logs = log_file.readlines()
  # JSONレスポンスとして、ログを返す
  return JsonResponse({'logs': logs})





#--------------------------------------------------------------------------------------------------------




# Reactメインページ呼び出し
def react_view(request):
  return render(request, 'index.html')



# Web App Manifestファイル生成
def manifest(request):
  data = {
    "name": "業務工数システム", # アプリ名称
    "short_name": "業務工数", # 短い名称
    "start_url": "/", # アプリ起動時に最初に開くURL
    "display": "standalone", # 表示モード設定(ブラウザUI非表示)
    "background_color": "#ffffff", # 起動画面の背景色
    "theme_color": "#000000" # アプリUI要素のテーマカラー
  }
  return JsonResponse(data)



# ログイン
class Login(APIView):
  # POST処理
  def post(self, request):
    try:
      # 送られてきたデータ確認
      data = json.loads(request.body)
      input_number = data.get('employee_no')
    except json.JSONDecodeError:
      return JsonResponse({'status': 'error', 'message': 'JSON形式が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)

    # POSTされた従番が人員データにある場合、セッションに保存&最新工数区分定義取得
    if member.objects.filter(employee_no=input_number).exists():
      request.session['login_No'] = input_number
      def_Ver = kosu_division.objects.order_by("id").last()

      # 取得した工数区分定義をセッションに保存
      if not def_Ver:
        return JsonResponse({'status': 'error', 'message': '利用可能な工数区分がありません。ERROR052'})
      else:
        request.session['input_def'] = def_Ver.kosu_name
        return JsonResponse({'status': 'success'})

    else:
      return JsonResponse({'status': 'error', 'message': '入力された従業員番号は登録がありません。ERROR048'})



class Help(APIView):
  # POST処理
  def post(self, request):
    post_data = request.data
    memberReset = post_data.get('memberReset')
    defReset = post_data.get('defReset')
    settingReset = post_data.get('settingReset')

    try:
      if memberReset:
        member.objects.all().delete()
        default_member = member(employee_no=12345,
                                name='admin',
                                shop='その他',
                                authority=True,
                                administrator=True,
                                break_time1='#11401240',
                                break_time1_over1='#17201735',
                                break_time1_over2='#23350035',
                                break_time1_over3='#04350450',
                                break_time2='#14101510',
                                break_time2_over1='#22002215',
                                break_time2_over2='#04150515',
                                break_time2_over3='#09150930',
                                break_time3='#23500050',
                                break_time3_over1='#06400655',
                                break_time3_over2='#12551355',
                                break_time3_over3='#17551810',
                                break_time4='#12001300',
                                break_time4_over1='#19001915',
                                break_time4_over2='#01150215',
                                break_time4_over3='#06150630',
                                break_time5='#10401130',
                                break_time5_over1='#15101520',
                                break_time5_over2='#20202110',
                                break_time5_over3='#01400150',
                                break_time6='#21202210',
                                break_time6_over1='#01500200',
                                break_time6_over2='#07000750',
                                break_time6_over3='#12201230',
                                )
        default_member.save()

      if defReset:
        kosu_division.objects.all().delete()
        default_def = kosu_division(kosu_name='default',
                                    kosu_title_1='A',
                                    kosu_division_1_1='A',
                                    kosu_division_2_1='A',
                                    kosu_title_2='B',
                                    kosu_division_1_2='B',
                                    kosu_division_2_2='B',
                                    kosu_title_3='C',
                                    kosu_division_1_3='C',
                                    kosu_division_2_3='C',
                                    )
        default_def.seve()

      if settingReset:
        administrator_data.objects.all().delete()
        default_administrator = administrator_data(menu_row='20')
        default_administrator.seve()

      return Response({'status': 'success', 'message': 'OK'}, status=status.HTTP_200_OK)
    except Exception as e:
      return Response({'status': 'error', 'error': 'データの初期化中にエラーが発生しました。'}, status=status.HTTP_400_BAD_REQUEST)



# ヘルプ画面パスワード判定
class HelpPass(APIView):
  # POST処理
  def post(self, request):
    # ルートディレクトリを取得
    BASE_DIR = Path(__file__).resolve().parent.parent
    # 環境変数ファイルを読み込む
    env = environ.Env()
    env.read_env(os.path.join(BASE_DIR, '.env'))

      # パスワード判定
    if request.data.get('password') == env('HELP_PATH'):
      return Response(True, status=status.HTTP_200_OK)
    else:
      return Response(False, status=status.HTTP_403_FORBIDDEN)



# ログアウト
class Logout(APIView):
  # POST処理
  def post(self,request):
    # セッション削除
    request.session.flush()
    return Response({'status': 'success', 'message': 'セッションが削除されました。'})



# メインMenu
class Menu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # 設定データ確認
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    response_data = {
      'login_data': login_serializer.data,
      'admin_data': admin_serializer.data,
    }
    return Response(response_data, status=status.HTTP_200_OK)



# 人員Menu
class MemberMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# 工数区分定義Menu
class DefMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# 工数入力Menu
class KosuMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# 班員Menu
class TeamMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # 班員フォローメッセージ作成
    follow_message_list = []
    # 班員データあるか確認
    team_filter = team_member.objects.filter(employee_no5=login_no)
    team_get = team_filter.first() if team_filter.exists() else None

    # 班員フォロー有効の場合、班員リスト作成
    if team_filter.exists() and team_get.follow:
      member_numbers = [
        team_get.member1, team_get.member2, team_get.member3,
        team_get.member4, team_get.member5, team_get.member6,
        team_get.member7, team_get.member8, team_get.member9,
        team_get.member10, team_get.member11, team_get.member12,
        team_get.member13, team_get.member14, team_get.member15
      ]
      valid_member_numbers = [
        num for num in member_numbers if num is not None and num != ''
      ]

      # 過去7日分の日付リスト作成
      today = datetime.date.today()
      day_list = [today - datetime.timedelta(days=d) for d in range(1, 8)]

      # 班員ごとに工数未入力確認
      for m in valid_member_numbers:
        follow_message = ''
        if member.objects.filter(employee_no=m).exists():
          member_name = member.objects.get(employee_no=m).name
          for d in day_list:
            if Business_Time_graph.objects.filter(employee_no3=m, work_day2=d).exists():
              kosu_get = Business_Time_graph.objects.get(employee_no3=m, work_day2=d)
              if not kosu_get.judgement:
                follow_message = f'{member_name}氏の工数未入力があります。'
                follow_message_list.append(follow_message)
                break
            else:
              follow_message = f'{member_name}氏の工数未入力があります。'
              follow_message_list.append(follow_message)
              break

    # データ変換
    serializer = MemberSerializer(member_data, many=False)

    response_data = {
      'follow_message_list': follow_message_list,
      'member_data': serializer.data,
    }
    return Response(response_data)



# 問い合わせMenu
class InquirMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# 管理者Menu
class AdministratorMenu(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.administrator:
        return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザー情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # 設定データ確認
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    response_data = {
      'login_data': login_serializer.data,
      'admin_data': admin_serializer.data,
    }
    return Response(response_data, status=status.HTTP_200_OK)



# 管理者設定更新
class AdministratorUpdate(APIView):
  # GET処理
  def get(self, request):
    # ログイン者情報取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 設定データ確認
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ変換
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    response_data = {
      'admin_data': admin_serializer.data,
      'login_data': login_serializer.data,
    }

    return Response(response_data)


  # PUT処理
  def put(self, request):
    # 設定データ確認
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ更新&変換
    serializer = AdministratorSerializer(admin_data, data=request.data)
    # バリテーション成功時
    if serializer.is_valid():
      # 問い合わせ担当者情報取得
      emp_keys = ['administrator_employee_no1', 'administrator_employee_no2', 'administrator_employee_no3']
      # 社員番号の存在チェック
      for key in emp_keys:
        emp_no = request.data.get(key)
        if not member.objects.filter(employee_no=emp_no).exists():
          return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_406_NOT_ACCEPTABLE)

      # データ保存
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# データ管理
class AdministratorLoading(APIView):
  # GET処理
  def get(self, request):
    # セッションからデータ取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # データ変換
    login_serializer = MemberSerializer(member_data, many=False)

    response_data = {
      'login_data': login_serializer.data,
    }

    return Response(response_data)



# 全工数履歴
class AdministratorKosuList(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 検索パラメータの取得
    search_day = request.query_params.get('day')
    search_shop = request.query_params.get('shop')
    search_tyoku = request.query_params.get('tyoku')
    search_work = request.query_params.get('work')
    search_judgement = request.query_params.get('judgement')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'
    search_member = request.query_params.get('member')

    # 工数履歴データの取得
    kosus = Business_Time_graph.objects.all().order_by('-work_day2')

    # 人員情報取得
    kosu_member = list(Business_Time_graph.objects.values_list('employee_no3', flat=True).order_by('employee_no3').distinct())
    member_filter = member.objects.filter(employee_no__in=kosu_member).order_by('employee_no')

    # データ絞り込み
    if search_day and filter_flag:
      if mode == 'month':
        kosus = kosus.filter(work_day2__startswith=search_day[:7])
      else:
        kosus = kosus.filter(work_day2=search_day)
    if search_member:
      kosus = kosus.filter(employee_no3=search_member)
    if search_shop:
      member_shop = member.objects.filter(shop=search_shop).values_list('employee_no', flat=True)
      kosus = kosus.filter(employee_no3__in=member_shop)
      common_employee_no = set(kosu_member) & set(member_shop)
      member_filter = member.objects.filter(employee_no__in=list(common_employee_no)).order_by('employee_no')
    if search_tyoku:
      kosus = kosus.filter(tyoku2=search_tyoku)
    if search_work:
      kosus = kosus.filter(work_time=search_work)
    if search_judgement:
      judgement = True if search_judgement == 'OK' else False
      kosus = kosus.filter(judgement=judgement)

    member_serializer = MemberSerializer(member_filter, many=True)

    # ページネーション
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(kosus, request)
    serializer = KosuSerializer(result_page, many=True)

    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': paginator.get_paginated_response(serializer.data).data,
    }
    return Response(response_data)



class AdministratorKosuUpdate(APIView):
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

    # セッション値、編集前の日付、従業員番号取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')
    request.session['day'] = str(kosu_instance.work_day2)
    request.session['employee_no'] = str(kosu_instance.employee_no3)

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 工数データ人員情報取得
    try:
      kosu_member = member.objects.get(employee_no=kosu_instance.employee_no3)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '工数データのユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データベースから全ての工数区分データを取得
    divisions = kosu_division.objects.all()

    # データ変換
    kosu_serializer = KosuSerializer(kosu_instance)
    member_serializer = MemberSerializer(kosu_member, many=False)
    def_serializer = DefSerializer(divisions, many=True)

    # 送信データ
    response_data = {
      'kosu_data': kosu_serializer.data,
      'member_data': member_serializer.data,
      'choices': def_serializer.data,
      'current_version': def_ver 
    }

    return Response(response_data)


  # PUT処理
  def put(self, request, pk):
    # 工数データ取得
    kosu_instance = self.get_object(pk)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # セッション値、日付、人員データ取得
    day = request.session.get('day')
    employee_no = request.session.get('employee_no')

    # クライアントから送られてきたデータをシリアライズ
    data = request.data
    serializer = KosuSerializer(kosu_instance, data=data)

    if serializer.is_valid():
      if not member.objects.filter(employee_no=data.get('employee_no3')).exists():
        return Response({'status': 'error', 'message': '入力した従業員番号は登録されていません。'},status=status.HTTP_400_BAD_REQUEST)
      if (day != data.get('work_day2') or int(employee_no) != data.get('employee_no3')) and Business_Time_graph.objects.filter(employee_no3=data.get('employee_no3'), work_day2=data.get('work_day2')).exists():
        return Response({'status': 'error', 'message': '入力した就業日には既に工数データがあります。'},status=status.HTTP_400_BAD_REQUEST)

      serializer.save()
      return Response({'status': 'success', 'message': 'データが更新されました。'}, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー。'}, status=status.HTTP_400_BAD_REQUEST)


  def delete(self, request, pk):
    # 削除対象のオブジェクトを取得
    kosu_instance = self.get_object(pk)
    if kosu_instance is None:
      return Response({'status': 'error', 'message': 'データがありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # レコードを削除
    kosu_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



class AdministratorTaskList(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 検索パラメータの取得
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')

    # 工数履歴データの取得
    tasks = AsyncTask.objects.all().order_by('-created_at')

    # データ絞り込み
    if search_day:
      if mode == 'month':
        tasks = tasks.filter(created_at__startswith=search_day[:7])
      else:
        tasks = tasks = tasks.filter(created_at__date=search_day)

    # ページネーション
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(tasks, request)
    serializer = TaskSerializer(result_page, many=True)

    response_data = {
      'task_data': paginator.get_paginated_response(serializer.data).data,
    }
    return Response(response_data)



class AdministratorTaskDetail(APIView):
  def get_object(self, pk):
    try:
      return AsyncTask.objects.get(id=pk)
    except AsyncTask.DoesNotExist:
      return None


  def get(self, request, pk):
    # セッションからログイン情報を取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 削除対象のオブジェクトを取得
    task_instance = self.get_object(pk)
    if task_instance is None:
      return Response({'status': 'error', 'message': 'データがありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    serializer = TaskSerializer(task_instance)

    response_data = {
      'task_data': serializer.data,
    }
    return Response(response_data)


  def delete(self, request, pk):
    # セッションからログイン情報を取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 削除対象のオブジェクトを取得
    task_instance = self.get_object(pk)
    if task_instance is None:
      return Response({'status': 'error', 'message': 'データがありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # レコードを削除
    task_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



class AdministratorHistoryList(APIView):
  # GET処理
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')

    # セッション値なしエラー
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 検索パラメータの取得
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    search_ID = request.query_params.get('record_id')
    table_name = request.query_params.get('table_name')
    login_No = request.query_params.get('login_No')

    # 工数履歴データの取得
    historys = History.objects.all().order_by('-timestamp')

    # データ絞り込み
    if search_day:
      if mode == 'month':
        historys = historys.filter(timestamp__startswith=search_day[:7])
      else:
        historys = historys.filter(timestamp__date=search_day)
    if search_ID:
      historys = historys.filter(record_id__contains=search_ID)
    if table_name:
      historys = historys.filter(table_name=table_name)
    if login_No:
      historys = historys.filter(login_No__contains=login_No)

    # モデル名取得
    model_remove = 'History'
    model_choices = get_all_model_names_in_myapp()
    model_choices.remove(model_remove)

    # ページネーション
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(historys, request)
    serializer = HistorySerializer(result_page, many=True)

    response_data = {
      'history_data': paginator.get_paginated_response(serializer.data).data,
      'model_choices': model_choices,
    }
    return Response(response_data)



class AdministratorHistoryDetail(APIView):
  def get_object(self, pk):
    try:
      return History.objects.get(id=pk)
    except History.DoesNotExist:
      return None


  def get(self, request, pk):
    # セッションからログイン情報を取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 削除対象のオブジェクトを取得
    history_instance = self.get_object(pk)

    if history_instance is None:
      return Response({'status': 'error', 'message': 'データがありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    serializer = HistorySerializer(history_instance)

    response_data = {
      'history_data': serializer.data,
    }
    return Response(response_data)


  def delete(self, request, pk):
    # 削除対象のオブジェクトを取得
    history_instance = self.get_object(pk)
    if history_instance is None:
      return Response({'status': 'error', 'message': 'データがありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # レコードを削除
    history_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



class WebConsoleLogView(View):
  def get(self, request, *args, **kwargs):
    # プロジェクトルートからのweb_console.logの相対パス
    LOG_FILE_PATH = os.path.join(settings.BASE_DIR, 'web_console.log')
    try:
      # ファイルが存在するか確認
      if not os.path.exists(LOG_FILE_PATH):
        return JsonResponse({"log_content": "Log file not found."}, status =status.HTTP_200_OK)

      # ファイルの内容を読み込む
      with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
        log_content = f.read()
      
      # log_contentをクライアントに返す
      return JsonResponse({"log_content": log_content}, status =status.HTTP_200_OK)

    except Exception as e:
      # 読み込みエラーが発生した場合
      return JsonResponse({"error": str(e)}, status=500)

