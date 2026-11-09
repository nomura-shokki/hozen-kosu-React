# ============================================================
# ファイル名 : main_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : ログイン・ログアウト・ヘルプ（データ初期化）、各MENU画面の初期表示、
#              管理者機能（設定編集・全工数管理・非同期タスク管理・操作履歴管理・ログ表示）を行うAPI群。
#              あわせて、Reactの画面（index.html）と Web App Manifest を返す関数、
#              print の出力をログファイル（web_console.log）へ記録する仕組みもここで定義する。
#              メイン・各MENU画面（frontend/src/MainPage/ など）と管理者画面（frontend/src/AdministratorPage/）から呼び出される。
#
# 主なクラス / 関数:
#   - react_view                 : Reactの画面（index.html）を返す    GET            下記以外の全URL（admin/ で始まるものを除く）
#   - manifest                   : Web App Manifest を返す            GET            /manifest.json
#   - Login                      : ログイン                           POST           /api/login/
#   - Help                       : データ初期化（ヘルプ画面）         POST           /api/help/
#   - HelpPass                   : ヘルプ画面のパスワード判定         POST           /api/help_pass/
#   - Logout                     : ログアウト                         POST           /api/logout/
#   - Menu                       : メインMENUの初期表示               GET            /api/main_menu/
#   - MemberMenu                 : 人員MENUの初期表示                 GET            /api/member_menu/
#   - DefMenu                    : 工数区分定義MENUの初期表示         GET            /api/def_menu/
#   - KosuMenu                   : 工数MENUの初期表示                 GET            /api/kosu_menu/
#   - TeamMenu                   : 班員MENUの初期表示（未入力お知らせ） GET          /api/team_menu/
#   - InquirMenu                 : 問い合わせMENUの初期表示           GET            /api/inquir_menu/
#   - AdministratorMenu          : 管理者MENUの初期表示               GET            /api/manager_menu/
#   - AdministratorUpdate        : 管理者設定の取得・更新             GET/PUT        /api/manager_update/
#   - AdministratorLoading       : データ管理画面の初期表示           GET            /api/manager_loading/
#   - AdministratorKosuList      : 全工数データの一覧取得             GET            /api/manager_kosu/
#   - AdministratorKosuUpdate    : 工数データ1件の取得・更新・削除    GET/PUT/DELETE /api/manager_kosu_update/<ID>/
#   - AdministratorTaskList      : 非同期タスクの一覧取得             GET            /api/manager_task/
#   - AdministratorTaskDetail    : 非同期タスク1件の取得・削除        GET/DELETE     /api/manager_task_detail/<ID>/
#   - AdministratorHistoryList   : 操作履歴の一覧取得                 GET            /api/manager_history/
#   - AdministratorHistoryDetail : 操作履歴1件の取得・削除            GET/DELETE     /api/manager_history_detail/<ID>/
#   - WebConsoleLogView          : ログファイルの内容取得             GET            /api/web_console_log/
#
# 権限       : Login / Help / HelpPass / Logout は AllowAny（ログイン不要。Help は代わりにヘルプ用パスワードを毎回確認する）
#              MemberMenu / TeamMenu は HasAuthority（ログイン済みかつ「権限」ありの人員のみ）
#              Administrator〇〇 / WebConsoleLogView は IsAdministrator（ログイン済みかつ「管理者」の人員のみ）
#              それ以外は IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
# 関連ファイル: models.py, views/serializers.py,
#              utils/main_utils.py（CustomPagination, get_all_model_names_in_myapp）, permissions.py, urls.py,
#              hozen_another/urls.py（react_view, manifest の登録）,
#              hozen_another/settings.py（LOGGING: views_logger → web_console.log）
# ============================================================

# ============================================================
# インポート
# ============================================================
import datetime
import os
import sys
import logging
# environ: .env ファイル（環境変数の設定ファイル）を読み込むライブラリ（django-environ）
import environ
import json
from pathlib import Path
from django.shortcuts import render
from django.http import JsonResponse
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from ..models import member, Business_Time_graph, kosu_division, team_member, administrator_data, AsyncTask, History
from .serializers import MemberSerializer, AdministratorSerializer, KosuSerializer, DefSerializer, TaskSerializer, HistorySerializer
from ..utils.main_utils import CustomPagination, get_all_model_names_in_myapp
from ..permissions import HasAuthority, IsAdministrator




# ============================================================
# ログ出力の設定（print の出力を web_console.log に記録する）
# ============================================================
# 専用ロガー取得('views_logger'という名前のカスタムロガーを使用しログメッセージ記録)
#   views_logger の出力先は settings.py の LOGGING で設定されている
#   （プロジェクトルートの web_console.log。1MBを超えたら1世代だけ残して新しいファイルに切り替わる）
views_logger = logging.getLogger('views_logger')

# ------------------------------------------------------------
# PrintToLogger: 標準出力の代わりになるクラス
#   print 関数は sys.stdout の write() を呼び出して文字を出力する。
#   sys.stdout をこのクラスに差し替えることで、print の出力を views_logger に流し、
#   管理者画面のログ表示（WebConsoleLogView）で確認できるようにする。
# ------------------------------------------------------------
class PrintToLogger:
  # print から渡された文字列をログに記録する。
  #
  # 引数:
  #   message: 出力しようとした文字列（print は本文と末尾の改行を別々に渡してくることがある）
  # 戻り値:
  #   なし
  def write(self, message):
    # 受け取った標準出力のメッセージ処理(空白および改行のみのメッセージは無視)
    if message.strip():  
      views_logger.info(message)

  # バッファ（出力待ちの文字）を書き出す。
  #
  # sys.stdout として使うには flush() が必要なため用意しているが、
  # ログへは write() の時点で書き込み済みなので何もしない。
  #
  # 戻り値:
  #   なし
  def flush(self):
    # 処理不要のため空処理
    pass

# 標準出力をロガーへリダイレクト(sys.stdoutをPrintToLoggerのインスタンスに設定)
#   このファイルが読み込まれた時点で実行され、以降はサーバープロセス全体の print 出力が対象になる
sys.stdout = PrintToLogger()

# 記録されたログを JSON で返す（関数ビュー）。
#
# ※現在 urls.py には登録されておらず、どこからも呼ばれていない。
#   管理者画面のログ表示には WebConsoleLogView（/api/web_console_log/）が使われている。
#
# 引数:
#   request: HTTPリクエスト
# 戻り値:
#   JsonResponse: {'logs': ログファイルの各行を要素とするリスト}
def get_logs(request):
  # 'web_console.log' ファイルを読み込み専用モードで開く（サーバー起動時のカレントフォルダからの相対パス）
  with open('web_console.log', 'r') as log_file:
    # ファイルの内容を行ごとにリストとして格納
    logs = log_file.readlines()
  # JSONレスポンスとして、ログを返す
  return JsonResponse({'logs': logs})





#--------------------------------------------------------------------------------------------------------
# ここから下: 画面配信・ログイン関連・各MENU・管理者機能のビュー




# Reactメインページ呼び出し（関数ビュー）。
#
# React をビルドした index.html（settings.py の TEMPLATES で frontend/build を参照）を返す。
# hozen_another/urls.py で /api/ などに当てはまらなかった全URLがここに来るため、
# ブラウザで /kosu-list などを直接開いても React の画面が表示され、React Router が画面を切り替える。
#
# 引数:
#   request: HTTPリクエスト
# 戻り値:
#   HttpResponse: index.html の内容
def react_view(request):
  return render(request, 'index.html')



# Web App Manifestファイル生成（関数ビュー）。
#
# Web App Manifest は、スマートフォンのホーム画面に追加したときのアプリ名や色などを
# ブラウザに伝えるためのJSON。/manifest.json へのアクセスで返す。
#
# 引数:
#   request: HTTPリクエスト
# 戻り値:
#   JsonResponse: マニフェストの内容
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



# ------------------------------------------------------------
# Login: ログインAPI
#   URL  : /api/login/
#   権限 : AllowAny（ログイン前に呼ぶためログイン不要）
#   POST : 従業員番号が人員データに登録されていればログインさせる。
#          セッションに従業員番号と最新の工数区分定義Ver名を保存する。
# ------------------------------------------------------------
class Login(APIView):
  # ログインしていなくても呼び出せるようにする
  permission_classes = [AllowAny]
  # ログインする（POST）。
  #
  # セッションに保存する値:
  #   login_No  : ログイン者の従業員番号（以降の全APIでログイン者の特定に使われる）
  #   input_def : 使用する工数区分定義Ver名（ID が最大＝最後に登録された工数区分定義）
  #
  # 引数:
  #   request: HTTPリクエスト。本文（JSON）の employee_no に従業員番号
  # 戻り値:
  #   JsonResponse: 成功時は {'status': 'success'}（200）
  #                 JSONの形式不正・未登録の従業員番号・工数区分定義が1件も無い場合は 400 エラー
  def post(self, request):
    try:
      # 送られてきたデータ確認（リクエスト本文のJSONを辞書に変換し、従業員番号を取り出す）
      data = json.loads(request.body)
      input_number = data.get('employee_no')
    # 本文がJSONとして読めない場合は 400 を返す
    except json.JSONDecodeError:
      return JsonResponse({'status': 'error', 'message': 'JSON形式が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)

    # POSTされた従番が人員データにある場合、セッションに保存&最新工数区分定義取得
    if member.objects.filter(employee_no=input_number).exists():
      request.session['login_No'] = input_number
      # ID が最大（最後に登録された）工数区分定義を「最新」として取得
      def_Ver = kosu_division.objects.order_by("id").last()

      # 工数区分定義が1件も無い場合は工数入力ができないため 400 を返す
      #   ※login_No はすでにセッションに保存された状態のまま返る
      if not def_Ver:
        return JsonResponse({'status': 'error', 'message': '利用可能な工数区分がありません。ERROR052'}, status=status.HTTP_400_BAD_REQUEST)
      # 取得した工数区分定義のVer名をセッションに保存し、ログイン成功を返す
      else:
        request.session['input_def'] = def_Ver.kosu_name
        return JsonResponse({'status': 'success'})

    # 従業員番号が人員データに無い場合は 400 を返す
    else:
      return JsonResponse({'status': 'error', 'message': '入力された従業員番号は登録がありません。ERROR048'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# ヘルプ用パスワードの判定（HelpPass と Help の両方で使う共通関数）
# ------------------------------------------------------------
# 入力されたパスワードがヘルプ用パスワード（環境変数 HELP_PATH）と一致するかを判定する。
#
# 引数:
#   password: 画面から送信されたパスワード（送信されていない場合は None）
# 戻り値:
#   bool: 一致すれば True、一致しない・未送信なら False
def is_valid_help_password(password):
  # このファイルの2つ上のフォルダを取得
  #   __file__ = kosu/views/main_views.py → parent = kosu/views → parent.parent = kosu/
  #   ※プロジェクトのルートではなく kosu/ フォルダを指す
  BASE_DIR = Path(__file__).resolve().parent.parent
  # 環境変数ファイルを読み込む（kosu/.env が対象）
  #   kosu/.env が無い場合も、settings.py がルートの .env から読み込んだ環境変数を env() で参照できる
  env = environ.Env()
  env.read_env(os.path.join(BASE_DIR, '.env'))
  # 入力値と環境変数 HELP_PATH を比較する（未送信の None は必ず不一致になる）
  return password == env('HELP_PATH')



# ------------------------------------------------------------
# Help: データ初期化API（ヘルプ画面）
#   URL  : /api/help/
#   権限 : AllowAny（ログインできなくなった場合に使うためログイン不要）
#          ※ログイン不要の代わりに、送信されたヘルプ用パスワードを毎回確認する
#   POST : ヘルプ用パスワードが正しい場合だけ、指定された種類のデータ
#          （人員 / 工数区分定義 / 管理者設定）を全削除し、初期データ1件だけにする。
# ------------------------------------------------------------
class Help(APIView):
  # ログインしていなくても呼び出せるようにする
  permission_classes = [AllowAny]
  # データを初期化する（POST）。
  #
  # 画面の HelpPass による認証を通さずにこのAPIを直接呼ばれても初期化されないよう、
  # 処理の最初にヘルプ用パスワードを確認する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data で以下を受け付ける（true のものだけ初期化する）
  #     password     : ヘルプ用パスワード（必須。環境変数 HELP_PATH と一致する必要がある）
  #     memberReset  : 人員データを初期化（従業員番号12345・管理者権限ありの "admin" のみになる）
  #     defReset     : 工数区分定義を初期化（Ver名 "default"・工数区分 A/B/C のみになる）
  #     settingReset : 管理者設定を初期化（一覧表示項目数 20 のみの設定になる）
  # 戻り値:
  #   Response: 成功時は 200。パスワードが違う・未送信の場合は 403、
  #             処理中に例外が発生した場合は 400 エラー
  def post(self, request):
    # パスワード確認: ヘルプ用パスワードが正しくない（または送られていない）場合は何も削除せず 403 を返す
    if not is_valid_help_password(request.data.get('password')):
      return Response({'status': 'error', 'message': 'パスワードが正しくありません。'}, status=status.HTTP_403_FORBIDDEN)

    # 画面から送信された初期化フラグを取得
    post_data = request.data
    memberReset = post_data.get('memberReset')
    defReset = post_data.get('defReset')
    settingReset = post_data.get('settingReset')

    try:
      # 人員データの初期化
      if memberReset:
        # 人員データを全件削除
        #   ※工数データ・問い合わせ等の氏名(name)は on_delete=SET_NULL のため、それらは残り name が NULL になる
        member.objects.all().delete()
        # 初期管理者の人員データを作成
        #   従業員番号 12345 / 氏名 admin / ショップ その他 / 権限あり / 管理者あり
        #   休憩時間は member_views.py の組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）と同じ初期値
        #   （値の形式は "#HHMMHHMM"＝開始時刻と終了時刻。例: "#11401240" は 11:40〜12:40）
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

      # 工数区分定義の初期化
      if defReset:
        # 工数区分定義を全件削除し、Ver名 "default" に工数区分 A / B / C の3つだけを持つ定義を作成
        #   kosu_title_N: 工数区分名 / kosu_division_1_N: 定義 / kosu_division_2_N: 作業内容
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
        default_def.save()

      # 管理者設定の初期化
      if settingReset:
        # 管理者設定を全件削除し、一覧表示項目数（1ページの表示件数）20 だけを持つ設定を作成
        administrator_data.objects.all().delete()
        default_administrator = administrator_data(menu_row='20')
        default_administrator.save()

      # すべて成功したら 200 を返す
      return Response({'status': 'success', 'message': 'OK'}, status=status.HTTP_200_OK)
    # 削除・作成中に何らかの例外が発生した場合は内容を返さず 400 を返す
    except Exception as e:
      return Response({'status': 'error', 'message': 'データの初期化中にエラーが発生しました。'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# HelpPass: ヘルプ画面パスワード判定API
#   URL  : /api/help_pass/
#   権限 : AllowAny（ログイン不要）
#   POST : 入力されたパスワードが環境変数 HELP_PATH の値と一致するかを返す
# ------------------------------------------------------------
class HelpPass(APIView):
  # ログインしていなくても呼び出せるようにする
  permission_classes = [AllowAny]
  # ヘルプ画面のパスワードを判定する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の password に入力されたパスワード
  # 戻り値:
  #   Response: 一致すれば True（200）、一致しなければ False（403）
  def post(self, request):
    # パスワード判定: 入力値と環境変数 HELP_PATH を比較し（is_valid_help_password）、結果を True / False で返す
    if is_valid_help_password(request.data.get('password')):
      return Response(True, status=status.HTTP_200_OK)
    # 不一致の場合は 403（権限なし）として False を返す
    else:
      return Response(False, status=status.HTTP_403_FORBIDDEN)



# ------------------------------------------------------------
# Logout: ログアウトAPI
#   URL  : /api/logout/
#   権限 : AllowAny（ログイン不要）
#   POST : セッションを削除してログアウトする
# ------------------------------------------------------------
class Logout(APIView):
  # ログインしていなくても呼び出せるようにする
  permission_classes = [AllowAny]
  # ログアウトする（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: 成功メッセージ（200）
  def post(self,request):
    # セッション削除（login_No・input_def などセッションに保存した値をすべて消す）
    request.session.flush()
    return Response({'status': 'success', 'message': 'セッションが削除されました。'})



# ------------------------------------------------------------
# Menu: メインMENU API
#   URL  : /api/main_menu/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : ログイン者の人員データと管理者設定を返す
#          （メインMENU画面で、権限・管理者に応じたメニューの表示切り替えと、
#            問い合わせ担当者向け・本人向けのお知らせ表示に使われる）
# ------------------------------------------------------------
class Menu(APIView):
  # メインMENUの表示に必要なデータを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: login_data（ログイン者の人員データ）と admin_data（管理者設定）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 最新（IDが最大）の管理者設定を取得
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者・管理者設定をJSONに変換できる形にする
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    # 送信データ
    response_data = {
      'login_data': login_serializer.data,
      'admin_data': admin_serializer.data,
    }
    return Response(response_data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# MemberMenu: 人員MENU API
#   URL  : /api/member_menu/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : ログイン者の人員データを返す（人員MENU画面を開けるかの確認・表示用）
# ------------------------------------------------------------
class MemberMenu(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ（権限なしは 403 → 画面側でトップへ戻される）
  permission_classes = [HasAuthority]
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ（200）。工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の人員データをJSONに変換できる形にして返す
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# DefMenu: 工数区分定義MENU API
#   URL  : /api/def_menu/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : ログイン者の人員データを返す（工数区分定義MENU画面で、管理者用ボタンの表示切り替えに使われる）
# ------------------------------------------------------------
class DefMenu(APIView):
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ（200）。工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の人員データをJSONに変換できる形にして返す
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# KosuMenu: 工数MENU API
#   URL  : /api/kosu_menu/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : ログイン者の人員データを返す（工数MENU画面を開けるかの確認用）
# ------------------------------------------------------------
class KosuMenu(APIView):
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ（200）。工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の人員データをJSONに変換できる形にして返す
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# TeamMenu: 班員MENU API
#   URL  : /api/team_menu/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : ログイン者の人員データと、班員の工数未入力お知らせの一覧を返す
#          お知らせは班員設定の「フォロー」が ON の場合のみ作成する。
# ------------------------------------------------------------
class TeamMenu(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 班員MENUの表示に必要なデータを返す（GET）。
  #
  # 工数未入力の判定: 昨日から7日前までの各日について、
  #   工数データが無い、または工数入力OK/NG判定（judgement）が NG の日が1日でもあれば
  #   「〇〇氏の工数未入力があります。」を1件追加する（1人につき最大1件）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: follow_message_list（お知らせ文言のリスト）と member_data（ログイン者の人員データ）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 班員フォローメッセージ（お知らせ文言）を入れるリスト
    follow_message_list = []
    # ログイン者が班長として登録している班員設定を検索（無ければ None）
    team_filter = team_member.objects.filter(employee_no5=member_data.employee_no)
    team_get = team_filter.first() if team_filter.exists() else None

    # 班員設定があり、フォローが ON の場合のみ未入力チェックを行う
    if team_filter.exists() and team_get.follow:
      # 班員1〜15 の従業員番号をリストにまとめる
      member_numbers = [
        team_get.member1, team_get.member2, team_get.member3,
        team_get.member4, team_get.member5, team_get.member6,
        team_get.member7, team_get.member8, team_get.member9,
        team_get.member10, team_get.member11, team_get.member12,
        team_get.member13, team_get.member14, team_get.member15
      ]
      # 未設定（None または空文字）の枠を除き、登録済みの班員の従業員番号だけにする
      valid_member_numbers = [
        num for num in member_numbers if num is not None and num != ''
      ]

      # 過去7日分の日付リスト作成（今日は含まず、昨日〜7日前）
      #   例: 今日が 11/9 → [11/8, 11/7, 11/6, 11/5, 11/4, 11/3, 11/2]
      today = datetime.date.today()
      day_list = [today - datetime.timedelta(days=d) for d in range(1, 8)]

      # 班員ごとに工数未入力確認
      for m in valid_member_numbers:
        follow_message = ''
        # 人員データが存在する班員だけを対象にする（削除済みの従業員番号は飛ばす）
        if member.objects.filter(employee_no=m).exists():
          member_name = member.objects.get(employee_no=m).name
          for d in day_list:
            # その日の工数データがある場合: 工数入力OK/NG判定が NG ならお知らせを追加して次の班員へ
            if Business_Time_graph.objects.filter(employee_no3=m, work_day2=d).exists():
              kosu_get = Business_Time_graph.objects.get(employee_no3=m, work_day2=d)
              if not kosu_get.judgement:
                follow_message = f'{member_name}氏の工数未入力があります。'
                follow_message_list.append(follow_message)
                break
            # その日の工数データが無い場合: 未入力としてお知らせを追加して次の班員へ
            else:
              follow_message = f'{member_name}氏の工数未入力があります。'
              follow_message_list.append(follow_message)
              break

    # ログイン者の人員データをJSONに変換できる形にする
    serializer = MemberSerializer(member_data, many=False)

    # 送信データ
    response_data = {
      'follow_message_list': follow_message_list,
      'member_data': serializer.data,
    }
    return Response(response_data)



# ------------------------------------------------------------
# InquirMenu: 問い合わせMENU API
#   URL  : /api/inquir_menu/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : ログイン者の人員データを返す（問い合わせMENU画面を開けるかの確認用）
# ------------------------------------------------------------
class InquirMenu(APIView):
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ（200）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の人員データをJSONに変換できる形にして返す
    serializer = MemberSerializer(member_data, many=False)
    return Response(serializer.data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# AdministratorMenu: 管理者MENU API
#   URL  : /api/manager_menu/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : ログイン者の人員データと管理者設定を返す（管理者MENU画面を開けるかの確認用）
# ------------------------------------------------------------
class AdministratorMenu(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ（管理者でなければ 403）
  permission_classes = [IsAdministrator]
  # 管理者MENUの表示に必要なデータを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: login_data（ログイン者の人員データ）と admin_data（管理者設定）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 最新（IDが最大）の管理者設定を取得
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者・管理者設定をJSONに変換できる形にする
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    # 送信データ
    response_data = {
      'login_data': login_serializer.data,
      'admin_data': admin_serializer.data,
    }
    return Response(response_data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# AdministratorUpdate: 管理者設定編集API
#   URL  : /api/manager_update/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 現在の管理者設定とログイン者の人員データを返す（設定編集画面の初期表示用）
#   PUT  : 管理者設定（一覧表示項目数・問い合わせ担当者など）を更新する
# ------------------------------------------------------------
class AdministratorUpdate(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 現在の管理者設定を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: admin_data（管理者設定）と login_data（ログイン者の人員データ）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 最新（IDが最大）の管理者設定を取得
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者・管理者設定をJSONに変換できる形にする
    login_serializer = MemberSerializer(member_data, many=False)
    admin_serializer = AdministratorSerializer(admin_data, many=False)

    # 送信データ（画面側では admin_data をフォームの初期値に使う）
    response_data = {
      'admin_data': admin_serializer.data,
      'login_data': login_serializer.data,
    }

    return Response(response_data)


  # 管理者設定を更新する（PUT）。
  #
  # 問い合わせ担当者の従業員番号1〜3 が入力されている場合は、その人員が存在するかを確認する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の管理者設定（全項目）
  # 戻り値:
  #   Response: 成功時は更新後の管理者設定（200）
  #             担当者の従業員番号が人員データに無い場合は 406、入力チェックNGの場合は 400 エラー
  def put(self, request):
    # 最新（IDが最大）の管理者設定を取得（更新対象）
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # データ更新&変換: 既存の設定と送信データをシリアライザに渡し、入力チェックの準備をする
    serializer = AdministratorSerializer(admin_data, data=request.data)
    # バリテーション成功時
    if serializer.is_valid():
      # 問い合わせ担当者の従業員番号が入る項目名
      emp_keys = ['administrator_employee_no1', 'administrator_employee_no2', 'administrator_employee_no3']
      # 社員番号の存在チェック: 入力されている担当者の従業員番号が人員データに無ければ 406 を返す（空欄は確認しない）
      for key in emp_keys:
        emp_no = request.data.get(key)
        if emp_no:
          if not member.objects.filter(employee_no=emp_no).exists():
            return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_406_NOT_ACCEPTABLE)

      # データ保存し、更新後の内容を 200（成功）で返す
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# AdministratorLoading: データ管理API
#   URL  : /api/manager_loading/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : ログイン者の人員データを返す（データ管理画面を開けるかの確認用）
#          ※バックアップ・復元そのものは asynchronous_views.py の各APIが行う
# ------------------------------------------------------------
class AdministratorLoading(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: login_data（ログイン者の人員データ）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # ログイン者の人員データをJSONに変換できる形にする
    login_serializer = MemberSerializer(member_data, many=False)

    # 送信データ
    response_data = {
      'login_data': login_serializer.data,
    }

    return Response(response_data)



# ------------------------------------------------------------
# AdministratorKosuList: 全工数管理（一覧）API
#   URL  : /api/manager_kosu/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 全人員の工数データを新しい日付順にページネーション付きで返す。
#          就業日（日 / 月単位）・人員・ショップ・直・就業形態・工数入力OK/NG判定で絞り込み可能。
#          絞り込み用に、工数データがある人員の一覧も一緒に返す。
# ------------------------------------------------------------
class AdministratorKosuList(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 全工数データの一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     day       (任意): 検索日 "YYYY-MM-DD"（filter が "true" のときだけ有効）
  #     mode      (任意): "month" なら day の年月で月単位検索、それ以外（既定 "day"）は日単位検索
  #     filter    (任意): "true" のとき日付での絞り込みを行う
  #     member    (任意): 従業員番号（完全一致）
  #     shop      (任意): ショップ（その人員の工数データに絞る）
  #     tyoku     (任意): 直（"1"〜"6"）
  #     work      (任意): 就業形態（例: "出勤"）
  #     judgement (任意): "OK" なら判定OKのみ、それ以外の値なら判定NGのみ
  #     page      (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: member_data（絞り込み用の人員一覧）と
  #             kosu_data（ページネーション済みの工数一覧: count / page_size / results）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得（未ログイン状態の判定に使う）
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # クエリパラメータから検索条件を取得（指定がなければ None。mode の既定は 'day'）
    #   filter_flag: "true" という文字列で送られてきたときだけ True
    search_day = request.query_params.get('day')
    search_shop = request.query_params.get('shop')
    search_tyoku = request.query_params.get('tyoku')
    search_work = request.query_params.get('work')
    search_judgement = request.query_params.get('judgement')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'
    search_member = request.query_params.get('member')

    # 工数データを全件、就業日の降順（新しい日付が先頭）で取得
    kosus = Business_Time_graph.objects.all().order_by('-work_day2')

    # 絞り込みプルダウン用の人員一覧:
    #   工数データに登場する従業員番号を重複なしで集め、その人員データを従業員番号順に取得
    kosu_member = list(Business_Time_graph.objects.values_list('employee_no3', flat=True).order_by('employee_no3').distinct())
    member_filter = member.objects.filter(employee_no__in=kosu_member).order_by('employee_no')

    # 日付での絞り込み（検索日があり、filter="true" のときのみ）
    #   月単位: 検索日の先頭7文字（"YYYY-MM"）で始まる就業日 → その月の全日
    #   日単位: 就業日が検索日と一致
    if search_day and filter_flag:
      if mode == 'month':
        kosus = kosus.filter(work_day2__startswith=search_day[:7])
      else:
        kosus = kosus.filter(work_day2=search_day)
    # 人員（従業員番号）での絞り込み
    if search_member:
      kosus = kosus.filter(employee_no3=search_member)
    # ショップでの絞り込み:
    #   そのショップに所属する人員の従業員番号を集め、その人員の工数データだけにする。
    #   人員プルダウンも「工数データがある」かつ「そのショップ所属」の人員に絞る（集合の共通部分 &）
    if search_shop:
      member_shop = member.objects.filter(shop=search_shop).values_list('employee_no', flat=True)
      kosus = kosus.filter(employee_no3__in=member_shop)
      common_employee_no = set(kosu_member) & set(member_shop)
      member_filter = member.objects.filter(employee_no__in=list(common_employee_no)).order_by('employee_no')
    # 直での絞り込み
    if search_tyoku:
      kosus = kosus.filter(tyoku2=search_tyoku)
    # 就業形態での絞り込み
    if search_work:
      kosus = kosus.filter(work_time=search_work)
    # 工数入力OK/NG判定での絞り込み（"OK" → True、それ以外 → False）
    if search_judgement:
      judgement = True if search_judgement == 'OK' else False
      kosus = kosus.filter(judgement=judgement)

    # 人員一覧をJSONに変換できる形にする
    member_serializer = MemberSerializer(member_filter, many=True)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(kosus, request)
    serializer = KosuSerializer(result_page, many=True)

    # 送信データ: 人員一覧と、ページネーション済みの工数一覧（count / page_size / results）
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': paginator.get_paginated_response(serializer.data).data,
    }
    return Response(response_data)



# ------------------------------------------------------------
# AdministratorKosuUpdate: 全工数管理（編集）API
#   URL    : /api/manager_kosu_update/<ID>/
#   権限   : IsAdministrator（管理者のみ）
#   GET    : 指定したIDの工数データ・その人員データ・全工数区分定義を返す（全工数データ編集画面の初期表示用）
#            編集前の就業日・従業員番号をセッションに保存する（PUT での重複確認に使う）
#   PUT    : 指定したIDの工数データを更新する（従業員番号・就業日の変更も可能）
#   DELETE : 指定したIDの工数データを削除する
# ------------------------------------------------------------
class AdministratorKosuUpdate(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 指定IDの工数データ取得
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


  # 編集する工数データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 工数データのID（URLから取得）
  # 戻り値:
  #   Response: kosu_data（工数データ）/ member_data（工数データの人員）/
  #             choices（全工数区分定義のリスト）/ current_version（使用中の工数区分定義Ver名）
  #             該当なしの場合は 404、工数区分定義Verが未選択・人員データが無い場合は 401 エラー
  def get(self, request, pk):
    # URLで指定されたIDの工数データを取得し、なければ 404 を返す
    kosu_instance = self.get_object(pk)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッション値、編集前の日付、従業員番号取得
    #   day / employee_no: 編集前の就業日と従業員番号を文字列でセッションに保存し、PUT 時の重複確認に使う
    #   ※ day は工数入力画面・班員の週カレンダーなどでも使う共通のセッションキー
    #   ※工数区分定義Verの確認より前に保存している
    def_ver = request.session.get('input_def')
    request.session['day'] = str(kosu_instance.work_day2)
    request.session['employee_no'] = str(kosu_instance.employee_no3)

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 工数データの持ち主（従業員番号 employee_no3）の人員データを取得。なければ 401 を返す
    try:
      kosu_member = member.objects.get(employee_no=kosu_instance.employee_no3)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '工数データのユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # データベースから全ての工数区分定義を取得（編集画面の「工数区分定義Ver」選択欄の選択肢になる）
    divisions = kosu_division.objects.all()

    # 工数データ・人員データ・工数区分定義をJSONに変換できる形にする
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


  # 工数データを更新する（PUT）。
  #
  # 従業員番号または就業日を変更する場合は、変更後の「従業員番号＋就業日」の工数データが
  # すでに存在しないかを確認する（工数データは1人1日1件として扱われるため）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の工数データ（全項目）
  #   pk     : 更新対象の工数データのID（URLから取得）
  # 戻り値:
  #   Response: 成功時は成功メッセージ（200）
  #             該当なしの場合は 404、従業員番号が未登録・就業日の重複・入力チェックNGの場合は 400 エラー
  def put(self, request, pk):
    # 更新対象の工数データを取得し、なければ 404 を返す
    kosu_instance = self.get_object(pk)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # GET 時にセッションへ保存した、編集前の就業日（"YYYY-MM-DD"）と従業員番号（文字列）を取得
    day = request.session.get('day')
    employee_no = request.session.get('employee_no')

    # 既存データと送信データをシリアライザに渡し、入力チェックの準備をする
    data = request.data
    serializer = KosuSerializer(kosu_instance, data=data)

    if serializer.is_valid():
      # 変更後の従業員番号が人員データに無い場合は 400 を返す
      if not member.objects.filter(employee_no=data.get('employee_no3')).exists():
        return Response({'status': 'error', 'message': '入力した従業員番号は登録されていません。'},status=status.HTTP_400_BAD_REQUEST)
      # 就業日か従業員番号が編集前から変わっていて、変更後の「従業員番号＋就業日」の工数データが
      # すでに存在する場合は 400 を返す（同じ人の同じ日の工数データが2件にならないようにする）
      if (day != data.get('work_day2') or int(employee_no) != data.get('employee_no3')) and Business_Time_graph.objects.filter(employee_no3=data.get('employee_no3'), work_day2=data.get('work_day2')).exists():
        return Response({'status': 'error', 'message': '入力した就業日には既に工数データがあります。'},status=status.HTTP_400_BAD_REQUEST)

      # 問題なければデータベースに保存し、200（成功）を返す
      serializer.save()
      return Response({'status': 'success', 'message': 'データが更新されました。'}, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー。'}, status=status.HTTP_400_BAD_REQUEST)


  # 工数データを削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の工数データのID（URLから取得）
  # 戻り値:
  #   Response: 成功時は成功メッセージ（200）。該当なしの場合は 404 エラー
  def delete(self, request, pk):
    # 削除対象のオブジェクトを取得し、なければ 404 を返す
    kosu_instance = self.get_object(pk)
    if kosu_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # レコードを削除し、200（成功）を返す
    kosu_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# AdministratorTaskList: 非同期タスクデータ管理（一覧）API
#   URL  : /api/manager_task/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 非同期タスク（バックアップ/復元などのバックグラウンド処理）の記録を
#          新しい順にページネーション付きで返す。作成日（日 / 月単位）で絞り込み可能。
# ------------------------------------------------------------
class AdministratorTaskList(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 非同期タスクの一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     day  (任意): 検索日 "YYYY-MM-DD"
  #     mode (任意): "month" なら day の年月で月単位検索、それ以外（既定 "day"）は日単位検索
  #     page (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: task_data（ページネーション済みの非同期タスク一覧: count / page_size / results）
  def get(self, request):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # クエリパラメータから検索条件を取得（mode の既定は 'day'）
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')

    # 非同期タスクの記録を全件、作成日時の降順（新しいものが先頭）で取得
    tasks = AsyncTask.objects.all().order_by('-created_at')

    # 作成日での絞り込み（検索日がある場合のみ）
    #   月単位: 作成日時が検索日の先頭7文字（"YYYY-MM"）で始まるもの → その月の全件
    #   日単位: 作成日時の日付部分（created_at__date）が検索日と一致するもの
    if search_day:
      if mode == 'month':
        tasks = tasks.filter(created_at__startswith=search_day[:7])
      else:
        tasks = tasks = tasks.filter(created_at__date=search_day)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(tasks, request)
    serializer = TaskSerializer(result_page, many=True)

    # 送信データ: ページネーション済みの非同期タスク一覧（count / page_size / results）
    response_data = {
      'task_data': paginator.get_paginated_response(serializer.data).data,
    }
    return Response(response_data)



# ------------------------------------------------------------
# AdministratorTaskDetail: 非同期タスク詳細API
#   URL    : /api/manager_task_detail/<ID>/
#   権限   : IsAdministrator（管理者のみ）
#   GET    : 指定したIDの非同期タスクの記録を返す（非同期タスク詳細画面用）
#   DELETE : 指定したIDの非同期タスクの記録を削除する
# ------------------------------------------------------------
class AdministratorTaskDetail(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから非同期タスクの記録を1件取得する。
  #
  # 引数:
  #   pk: 非同期タスクのID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   AsyncTask: 該当する非同期タスク。存在しない場合は None
  def get_object(self, pk):
    try:
      return AsyncTask.objects.get(id=pk)
    # 該当するデータがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except AsyncTask.DoesNotExist:
      return None


  # 非同期タスクの記録を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 非同期タスクのID（URLから取得）
  # 戻り値:
  #   Response: task_data（非同期タスク: タスクID・状態・結果・作成/更新日時）。該当なしの場合は 404 エラー
  def get(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 表示対象の非同期タスクを取得し、なければ 404 を返す
    task_instance = self.get_object(pk)
    if task_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 非同期タスクをJSONに変換できる形にする
    serializer = TaskSerializer(task_instance)

    # 送信データ
    response_data = {
      'task_data': serializer.data,
    }
    return Response(response_data)


  # 非同期タスクの記録を削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の非同期タスクのID（URLから取得）
  # 戻り値:
  #   Response: 成功時は成功メッセージ（200）。該当なしの場合は 404 エラー
  def delete(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 削除対象のオブジェクトを取得し、なければ 404 を返す
    task_instance = self.get_object(pk)
    if task_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # レコードを削除し、200（成功）を返す
    task_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# AdministratorHistoryList: データ操作履歴一覧API
#   URL  : /api/manager_history/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 操作履歴（データ変更の監査ログ。signals.py が自動で記録する）を
#          新しい順にページネーション付きで返す。
#          操作日（日 / 月単位）・レコードID・テーブル名・操作者の従業員番号で絞り込み可能。
#          絞り込み用に、全人員の一覧とテーブル名（モデル名）の一覧も一緒に返す。
# ------------------------------------------------------------
class AdministratorHistoryList(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 操作履歴の一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     day        (任意): 検索日 "YYYY-MM-DD"
  #     mode       (任意): "month" なら day の年月で月単位検索、それ以外（既定 "day"）は日単位検索
  #     record_id  (任意): 変更されたレコードのID（部分一致）
  #     table_name (任意): テーブル名（モデル名。完全一致。例: "member"）
  #     login_No   (任意): 操作者の従業員番号（部分一致）
  #     page       (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: history_data（ページネーション済みの操作履歴一覧: count / page_size / results）/
  #             member_select（全人員の一覧）/ model_choices（History を除くモデル名の一覧）
  def get(self, request):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user
    
    # 全人員を取得し、JSONに変換できる形にする（画面で操作者の従業員番号から氏名を表示するため）
    member_all = member.objects.all()
    member_select = MemberSerializer(member_all, many=True)

    # クエリパラメータから検索条件を取得（mode の既定は 'day'）
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    search_ID = request.query_params.get('record_id')
    table_name = request.query_params.get('table_name')
    login_No = request.query_params.get('login_No')

    # 操作履歴を全件、記録日時の降順（新しいものが先頭）で取得
    historys = History.objects.all().order_by('-timestamp')

    # 操作日での絞り込み（検索日がある場合のみ）
    #   月単位: 記録日時が検索日の先頭7文字（"YYYY-MM"）で始まるもの / 日単位: 記録日時の日付部分が一致するもの
    if search_day:
      if mode == 'month':
        historys = historys.filter(timestamp__startswith=search_day[:7])
      else:
        historys = historys.filter(timestamp__date=search_day)
    # レコードIDの部分一致で絞り込み（例: "12" → 12, 120, 312 などが該当）
    if search_ID:
      historys = historys.filter(record_id__contains=search_ID)
    # テーブル名（モデル名）の完全一致で絞り込み
    if table_name:
      historys = historys.filter(table_name=table_name)
    # 操作者の従業員番号の部分一致で絞り込み
    if login_No:
      historys = historys.filter(login_No__contains=login_No)

    # テーブル名の絞り込み選択肢: kosu アプリの全モデル名から、操作履歴自身（History）を除いたもの
    model_remove = 'History'
    model_choices = get_all_model_names_in_myapp()
    model_choices.remove(model_remove)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(historys, request)
    serializer = HistorySerializer(result_page, many=True)

    # 送信データ
    response_data = {
      'history_data': paginator.get_paginated_response(serializer.data).data,
      'member_select':member_select.data,
      'model_choices': model_choices,
    }
    return Response(response_data)



# ------------------------------------------------------------
# AdministratorHistoryDetail: データ操作履歴詳細API
#   URL    : /api/manager_history_detail/<ID>/
#   権限   : IsAdministrator（管理者のみ）
#   GET    : 指定したIDの操作履歴を返す（データ操作履歴詳細画面用）
#   DELETE : 指定したIDの操作履歴を削除する
# ------------------------------------------------------------
class AdministratorHistoryDetail(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから操作履歴を1件取得する。
  #
  # 引数:
  #   pk: 操作履歴のID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   History: 該当する操作履歴。存在しない場合は None
  def get_object(self, pk):
    try:
      return History.objects.get(id=pk)
    # 該当するデータがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except History.DoesNotExist:
      return None


  # 操作履歴を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 操作履歴のID（URLから取得）
  # 戻り値:
  #   Response: history_data（操作履歴: 操作種別・テーブル名・レコードID・操作者・変更内容・日時）
  #             該当なしの場合は 404 エラー
  def get(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 表示対象の操作履歴を取得
    history_instance = self.get_object(pk)

    # 該当するデータがない場合は 404 を返す
    if history_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 操作履歴をJSONに変換できる形にする
    serializer = HistorySerializer(history_instance)

    # 送信データ
    response_data = {
      'history_data': serializer.data,
    }
    return Response(response_data)


  # 操作履歴を削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の操作履歴のID（URLから取得）
  # 戻り値:
  #   Response: 成功時は成功メッセージ（200）。該当なしの場合は 404 エラー
  def delete(self, request, pk):
    # 削除対象のオブジェクトを取得し、なければ 404 を返す
    history_instance = self.get_object(pk)
    if history_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # レコードを削除し、200（成功）を返す
    history_instance.delete()
    return Response({'status': 'success', 'message': 'データを削除しました。'}, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# WebConsoleLogView: ログ表示API
#   URL  : /api/web_console_log/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : web_console.log（print の出力などを記録したログファイル）の全内容を文字列で返す
#          設定編集画面のログ表示（Components/LogConsole.tsx）が5秒ごとに呼び出す。
# ------------------------------------------------------------
class WebConsoleLogView(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # ログファイルの内容を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト（*args, **kwargs は URL から渡される追加の値。ここでは未使用）
  # 戻り値:
  #   JsonResponse: {"log_content": ログの全文}（200）
  #                 ファイルが無い場合は {"log_content": "Log file not found."}（200）
  #                 読み込み中に例外が発生した場合は {"error": エラー内容}（500）
  def get(self, request, *args, **kwargs):
    # プロジェクトルートからのweb_console.logの相対パス（settings.BASE_DIR はプロジェクトのルートフォルダ）
    LOG_FILE_PATH = os.path.join(settings.BASE_DIR, 'web_console.log')
    try:
      # ファイルが存在するか確認（無ければエラーにせず、その旨の文字列を返す）
      if not os.path.exists(LOG_FILE_PATH):
        return JsonResponse({"log_content": "Log file not found."}, status =status.HTTP_200_OK)

      # ファイルの内容を読み込む（UTF-8 として全文を1つの文字列で読む）
      with open(LOG_FILE_PATH, 'r', encoding='utf-8') as f:
        log_content = f.read()
      
      # log_contentをクライアントに返す
      return JsonResponse({"log_content": log_content}, status =status.HTTP_200_OK)

    # 読み込みエラー（権限不足・文字コード不正など）が発生した場合は、エラー内容を 500 で返す
    except Exception as e:
      # 読み込みエラーが発生した場合（str(e) で例外の内容を文字列にして返す）
      return JsonResponse({"error": str(e)}, status=500)

