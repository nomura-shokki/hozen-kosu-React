# ============================================================
# ファイル名 : urls.py（kosu アプリ）
# 種別       : URLルーティング定義（Django）
# 概要       : APIのURLと、それを処理するビュー（views/ 以下のクラス・関数）の対応表。
#              hozen_another/urls.py で path('api/', include('kosu.urls')) として読み込まれるため、
#              ここに書いた 'login/' は実際には /api/login/ というURLになる。
#              （'BA' という接頭辞でも同じ対応表が読み込まれている。hozen_another/urls.py 参照）
#
# 主な内容   : 機能ごとに以下の順で並んでいる
#   - ログイン・ヘルプ・メニュー           : main_views.py
#   - 工数（入力・編集・勤務入力・集計）   : kosu_views.py
#   - 工数区分定義・作業詳細選択肢         : def_views.py
#   - 人員                                 : member_views.py
#   - 班員                                 : team_views.py
#   - 問い合わせ                           : inquiry_views.py
#   - 管理者                               : main_views.py
#   - バックアップ・復元・データ削除       : asynchronous_views.py
#
# 補足       : <int:pk> はURLの一部を整数として受け取り、ビューの引数 pk に渡す書き方。
#              （例: /api/kosu_update/12/ → pk=12）
#              name='...' はURLに付ける名前。asynchronous_views.backup はこの名前で処理内容を切り替えている。
#              権限はビュー側の permission_classes で決まる（指定なしはログイン必須。permissions.py 参照）。
# 関連ファイル: hozen_another/urls.py（/api/ の接頭辞）, views/*.py, permissions.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.urls import path
from .views import main_views
from .views import kosu_views
from .views import member_views
from .views import team_views
from .views import def_views
from .views import inquiry_views
from kosu.views import asynchronous_views
from django.conf import settings
from django.conf.urls.static import static



# ============================================================
# URLパターン定義
#   path('URL', 処理するビュー, name='URLの名前')
#   クラス形式のビューは .as_view() を付けて「リクエストを受け取る関数」に変換して渡す
# ============================================================
urlpatterns = [
  # ---------- ログイン・ヘルプ・各メニュー（main_views.py） ----------
  # POST /api/login/ : ログイン（従業員番号が人員に登録済みならセッションに保存）→ Login
  path('login/', main_views.Login.as_view(), name='login'),
  # POST /api/logout/ : ログアウト（セッションを削除）→ Logout
  path('logout/', main_views.Logout.as_view(), name='logout'),
  # POST /api/help/ : ヘルプ画面からのデータ初期化（人員・工数区分定義・管理者設定を初期データに戻す。ヘルプ用パスワード必須）→ Help
  path('help/', main_views.Help.as_view(), name='help'),
  # POST /api/help_pass/ : ヘルプ画面に入るためのパスワード判定 → HelpPass
  path('help_pass/', main_views.HelpPass.as_view(), name='help_pass'),
  # GET /api/main_menu/ : メインメニュー画面の表示データ（ログイン者情報・お知らせ等）→ Menu
  path('main_menu/', main_views.Menu.as_view(), name='main_menu'),
  # GET /api/kosu_menu/ : 工数メニュー画面の表示データ → KosuMenu
  path('kosu_menu/', main_views.KosuMenu.as_view(), name='kosu_menu'),

  # ---------- 工数（kosu_views.py） ----------
  # GET/POST /api/kosu_new/ : 工数入力画面の表示データ取得 / 工数の書き込み → KosuNew
  path('kosu_new/', kosu_views.KosuNew.as_view(), name='kosu_new'),
  # POST /api/set_day/ : 工数入力画面で選んだ就業日をセッションに保存 → SetDay
  path('set_day/', kosu_views.SetDay.as_view(), name='set_day'),
  # POST /api/over_time/ : 残業時間の登録 → OverTime
  path('over_time/', kosu_views.OverTime.as_view(), name='over_time'),
  # GET /api/kosu_list/ : ログイン者の工数一覧（工数履歴画面）→ KosuList
  path('kosu_list/', kosu_views.KosuList.as_view(), name='kosu_list'), 
  # GET/PUT /api/kosu_update/<工数データID>/ : 工数データ1件の取得 / 一括編集 → KosuUpdate
  path('kosu_update/<int:pk>/', kosu_views.KosuUpdate.as_view(), name='kosu_update'),
  # GET /api/kosu_calendar/ : 勤務入力画面（月カレンダー）の表示データ → KosuCalendar
  path('kosu_calendar/', kosu_views.KosuCalendar.as_view(), name='kosu_calendar'),
  # POST /api/kosu_calendar_change/ : 勤務入力画面で表示する年・月をセッションに保存 → KosuCalendarChange
  path('kosu_calendar_change/', kosu_views.KosuCalendarChange.as_view(), name='kosu_calendar_change'),
  # POST /api/kosu_work_write/ : 勤務入力画面で入力した就業形態・直の書き込み → KosuWorkWrite
  path('kosu_work_write/', kosu_views.KosuWorkWrite.as_view(), name='kosu_work_write'),
  # POST /api/work_default/ : 表示中の月で就業形態が未入力の日に、初期値（平日=出勤 / 土日=休日）を一括書き込み → WorkDefault
  path('work_default/', kosu_views.WorkDefault.as_view(), name='work_default'),
  # POST /api/tyoku_default/ : 表示中の月の平日で直が未入力の日に、週ごとに指定された直を一括書き込み → TyokuDefault
  path('tyoku_default/', kosu_views.TyokuDefault.as_view(), name='tyoku_default'),
  # POST /api/kosu_link/ : 勤務入力画面から工数入力画面へ移る前に、対象日をセッションに保存 → KosuLink
  path('kosu_link/', kosu_views.KosuLink.as_view(), name='kosu_link'),
  # PUT /api/day_update/ : 工数データの就業日を変更 → DayUpdate
  #   ※name が 'item_delete' になっている（下の item_delete/ と名前が入れ替わっている）
  path('day_update/', kosu_views.DayUpdate.as_view(), name='item_delete'),
  # POST /api/item_delete/ : 工数編集画面で選んだ項目（時間帯）の工数を削除 → ItemDlete
  #   ※name が 'day_update' になっている（上の day_update/ と名前が入れ替わっている）
  path('item_delete/', kosu_views.ItemDlete.as_view(), name='day_update'),
  # DELETE /api/kosu_delete/<工数データID>/ : 工数データ1件の削除 → KosuDelete
  path('kosu_delete/<int:pk>/', kosu_views.KosuDelete.as_view(), name='kosu_delete'),
  # GET/POST /api/today_break_time/ : 当日休憩時間変更画面の表示データ取得 / その日の休憩時間の更新 → TodayBreakTime
  path('today_break_time/', kosu_views.TodayBreakTime.as_view(), name='today_break_time'), 
  # GET/POST /api/break_time/ : 休憩時間変更画面（直ごとの休憩時間の既定値）の取得 / 更新 → BreakTime
  path('break_time/', kosu_views.BreakTime.as_view(), name='break_time'),
  # GET/POST /api/kosu_total/ : 工数集計画面の表示データ取得 / 指定日・期間での再集計 → KosuTotal
  path('kosu_total/', kosu_views.KosuTotal.as_view(), name='kosu_total'),

  # ---------- 工数区分定義・作業詳細選択肢（def_views.py） ----------
  # GET /api/def_menu/ : 工数区分定義メニュー画面の表示データ → DefMenu（main_views.py）
  path('def_menu/', main_views.DefMenu.as_view(), name='def_menu'),
  # GET/POST /api/def_new/ : 工数区分定義の新規登録（管理者のみ）→ DefNew
  path('def_new/', def_views.DefNew.as_view(), name='def_new'), 
  # GET /api/def_list/ : 工数区分定義の一覧（管理者のみ）→ DefList
  path('def_list/', def_views.DefList.as_view(), name='def_list'), 
  # GET/PUT /api/def_update/<ID>/ : 工数区分定義1件の取得 / 更新（管理者のみ）→ DefUpdate
  path('def_update/<int:pk>/', def_views.DefUpdate.as_view(), name='def_update'),
  # DELETE /api/def_delete/<ID>/ : 工数区分定義1件の削除（管理者のみ）→ DefDelete
  path('def_delete/<int:pk>/', def_views.DefDelete.as_view(), name='def_delete'),
  # GET/POST /api/def_ver/ : 使用する工数区分定義Verの選択肢取得 / 切り替え（セッションに保存）→ DefVer
  path('def_ver/', def_views.DefVer.as_view(), name='def_ver'), 
  # GET /api/def_search/ : 選択中の工数区分定義Verの内容（工数区分定義確認画面）→ DefSearch
  path('def_search/', def_views.DefSearch.as_view(), name='def_search'), 
  # GET/POST /api/def_detail_new/ : 作業詳細選択肢の新規登録（管理者のみ）→ DefDetailNew
  path('def_detail_new/', def_views.DefDetailNew.as_view(), name='def_detail_new'),
  # GET /api/def_detail_list/ : 作業詳細選択肢の一覧（管理者のみ）→ DefDetailList
  path('def_detail_list/', def_views.DefDetailList.as_view(), name='def_detail_list'), 
  # GET/PUT /api/def_detail_update/<ID>/ : 作業詳細選択肢1件の取得 / 更新（管理者のみ）→ DefDetailUpdate
  path('def_detail_update/<int:pk>/', def_views.DefDetailUpdate.as_view(), name='def_detail_update'),
  # DELETE /api/def_detail_delete/<ID>/ : 作業詳細選択肢1件の削除（管理者のみ）→ DefDetailDelete
  path('def_detail_delete/<int:pk>/', def_views.DefDetailDelete.as_view(), name='def_detail_delete'),

  # ---------- 人員（member_views.py） ----------
  # GET /api/member_menu/ : 人員メニュー画面の表示データ（権限ありのみ）→ MemberMenu（main_views.py）
  path('member_menu/', main_views.MemberMenu.as_view(), name='member_menu'),
  # GET /api/member_list/ : 人員一覧（権限ありのみ）→ MemberList
  path('member_list/', member_views.MemberList.as_view(), name='member_list'),
  # GET/POST /api/member_new/ : ログイン者情報の取得 / 人員の新規登録（権限ありのみ）→ MemberNew
  path('member_new/', member_views.MemberNew.as_view(), name='member_new'),
  # GET/PUT /api/member_update/<従業員番号>/ : 人員1件の取得 / 更新（権限ありのみ）→ MemberUpdate
  #   ※pk は主キーのIDではなく従業員番号
  path('member_update/<int:pk>/', member_views.MemberUpdate.as_view(), name='member_update'),
  # DELETE /api/member_delete/<従業員番号>/ : 人員1件の削除（権限ありのみ）→ MemberDelete
  path('member_delete/<int:pk>/', member_views.MemberDelete.as_view(), name='member_delete'),

  # ---------- 班員（team_views.py） ----------
  # GET /api/team_menu/ : 班員メニュー画面の表示データ（班員フォローのお知らせ等。権限ありのみ）→ TeamMenu（main_views.py）
  path('team_menu/', main_views.TeamMenu.as_view(), name='team_menu'),
  # GET/POST /api/team_new/ : 班員（ログイン者が管理する班のメンバー）の取得 / 登録 → TeamNew
  path('team_new/', team_views.TeamNew.as_view(), name='team_new'),
  # GET /api/team_list/ : 班員の工数履歴一覧 → TeamList
  path('team_list/', team_views.TeamList.as_view(), name='team_list'),
  # GET /api/team_detail/<工数データID>/ : 班員の工数データ1件の詳細 → TeamDetail
  path('team_detail/<int:pk>/', team_views.TeamDetail.as_view(), name='team_detail'),
  # GET/POST /api/team_calendar/ : 班員工数入力状況（週単位）の取得 / 表示日をセッションに保存 → TeamCalendar
  path('team_calendar/', team_views.TeamCalendar.as_view(), name='team_calendar'),
  # POST /api/team_calendar_week_jump/ : 班員工数入力状況の表示週を前後に移動 → TeamCalendarWeekJump
  path('team_calendar_week_jump/', team_views.TeamCalendarWeekJump.as_view(), name='team_calendar_week_jump'),
  # POST /api/team_export/ : 班員の工数入力状況を Excel ファイルで出力 → TeamExport
  path('team_export/', team_views.TeamExport.as_view(), name='team_export'),
  # GET/POST /api/team_overtime/ : 班員の残業（月単位）の取得 / 表示する年・月をセッションに保存 → TeamOverTime
  path('team_overtime/', team_views.TeamOverTime.as_view(), name='team_overtime'),
  # GET/POST /api/team_view/ : ショップ単位の工数入力状況の取得 / 表示する年・月をセッションに保存 → TeamView
  path('team_view/', team_views.TeamView.as_view(), name='team_view'),
  # POST /api/team_shop_select/ : ショップ単位工数入力状況で表示するショップをセッションに保存 → TeamShopSelect
  path('team_shop_select/', team_views.TeamShopSelect.as_view(), name='team_shop_select/'),

  # ---------- 問い合わせ（inquiry_views.py） ----------
  # GET /api/inquir_menu/ : 問い合わせメニュー画面の表示データ → InquirMenu（main_views.py）
  path('inquir_menu/', main_views.InquirMenu.as_view(), name='inquir_menu'),
  # GET/POST /api/inquir_new/ : 問い合わせの新規登録（登録時に問い合わせ担当者へお知らせを設定）→ InquirNew
  path('inquir_new/', inquiry_views.InquirNew.as_view(), name='inquir_new'),
  # GET /api/inquir_list/ : 問い合わせ履歴の一覧 → InquirList
  path('inquir_list/', inquiry_views.InquirList.as_view(), name='inquir_list'),
  # GET /api/inquir_detail/<問い合わせID>/ : 問い合わせ1件の内容 → InquirDetail
  path('inquir_detail/<int:pk>/', inquiry_views.InquirDetail.as_view(), name='inquir_detail'),
  # GET/PUT/DELETE /api/inquir_update/<問い合わせID>/ : 問い合わせ1件の取得 / 編集・回答 / 削除 → InquirUpdate
  path('inquir_update/<int:pk>/', inquiry_views.InquirUpdate.as_view(), name='inquir_update'),

  # ---------- 管理者（main_views.py。すべて管理者のみ） ----------
  # GET /api/manager_menu/ : 管理者メニュー画面の表示データ → AdministratorMenu
  path('manager_menu/', main_views.AdministratorMenu.as_view(), name='admin_menu'),
  # GET/PUT /api/manager_update/ : 管理者設定（一覧表示項目数・問い合わせ担当者など）の取得 / 更新 → AdministratorUpdate
  path('manager_update/', main_views.AdministratorUpdate.as_view(), name='admin_update'),
  # GET /api/manager_loading/ : データ管理画面（バックアップ・復元）の表示データ → AdministratorLoading
  path('manager_loading/', main_views.AdministratorLoading.as_view(), name='admin_loading'),
  # GET /api/manager_kosu/ : 全人員の工数データ一覧（全工数管理画面）→ AdministratorKosuList
  path('manager_kosu/', main_views.AdministratorKosuList.as_view(), name='admin_kosu'),
  # GET/PUT/DELETE /api/manager_kosu_update/<工数データID>/ : 工数データ1件の取得 / 更新 / 削除 → AdministratorKosuUpdate
  path('manager_kosu_update/<int:pk>/', main_views.AdministratorKosuUpdate.as_view(), name='admin_kosu_update'),
  # GET /api/manager_task/ : 非同期タスク（バックアップ等の処理記録）の一覧 → AdministratorTaskList
  path('manager_task/', main_views.AdministratorTaskList.as_view(), name='admin_task'),
  # GET/DELETE /api/manager_task_detail/<ID>/ : 非同期タスク1件の取得 / 削除 → AdministratorTaskDetail
  path('manager_task_detail/<int:pk>/', main_views.AdministratorTaskDetail.as_view(), name='admin_task_detail'),
  # GET /api/manager_history/ : 操作履歴（データ変更の記録）の一覧 → AdministratorHistoryList
  path('manager_history/', main_views.AdministratorHistoryList.as_view(), name='admin_history'),
  # GET/DELETE /api/manager_history_detail/<ID>/ : 操作履歴1件の取得 / 削除 → AdministratorHistoryDetail
  path('manager_history_detail/<int:pk>/', main_views.AdministratorHistoryDetail.as_view(), name='admin_history_detail'),

  # ---------- バックアップ・復元・データ削除（asynchronous_views.py。すべて管理者のみ・POST） ----------
  # 以下はすべて同じ関数 asynchronous_views.backup が処理する。
  # backup はアクセスされたURLの name を調べて実行する処理を切り替え、別スレッドで実行する。
  #   〜_backup : データを Excel ファイルに書き出す（media/ フォルダに保存）
  #   〜_load   : アップロードされた Excel ファイルからデータを復元する
  #   〜_delet  : 指定期間のデータを削除する（「delete」ではなく「delet」という綴り）
  # 処理の結果は check_backup_status で確認する（下記）。
  # 工数データ: バックアップ（期間指定）/ 期間指定削除 / 復元
  path('kosu_backup/', asynchronous_views.backup, name='kosu_backup'),
  path('kosu_delet/', asynchronous_views.backup, name='kosu_delet'),
  path('kosu_load/', asynchronous_views.backup, name='kosu_load'),
  # 工数区分定義: バックアップ / 復元
  path('def_backup/', asynchronous_views.backup, name='def_backup'),
  path('def_load/', asynchronous_views.backup, name='def_load'),
  # 作業詳細選択肢: バックアップ / 復元
  path('choice_backup/', asynchronous_views.backup, name='choice_backup'),
  path('choice_load/', asynchronous_views.backup, name='choice_load'),
  # 人員: バックアップ / 復元
  path('member_backup/', asynchronous_views.backup, name='member_backup'),
  path('member_load/', asynchronous_views.backup, name='member_load'),
  # 班員: バックアップ / 復元
  path('team_backup/', asynchronous_views.backup, name='team_backup'),
  path('team_load/', asynchronous_views.backup, name='team_load'),
  # 問い合わせ: バックアップ / 復元
  path('inquiry_backup/', asynchronous_views.backup, name='inquiry_backup'),
  path('inquiry_load/', asynchronous_views.backup, name='inquiry_load'),
  # 管理者設定: バックアップ / 復元
  path('setting_backup/', asynchronous_views.backup, name='setting_backup'),
  path('setting_load/', asynchronous_views.backup, name='setting_load'),
  # 非同期タスク: バックアップ（期間指定）/ 期間指定削除
  path('AsyncTask_backup/', asynchronous_views.backup, name='AsyncTask_backup'),
  path('AsyncTask_delet/', asynchronous_views.backup, name='AsyncTask_delet'),
  # 操作履歴: バックアップ（期間指定）/ 期間指定削除
  path('History_backup/', asynchronous_views.backup, name='History_backup'),
  path('History_delet/', asynchronous_views.backup, name='History_delet'),

  # GET /api/check_backup_status?task_id=〜 : 非同期タスクの状態（処理中 / 成功 / エラー）を確認 → check_task_status
  #   ※他のURLと違い末尾に「/」が無い
  path('check_backup_status', asynchronous_views.check_task_status, name='check_member_backup_status'),
  # GET /api/download_backup?file_path=〜 : バックアップで作られた Excel ファイルをダウンロード → download_file
  path('download_backup', asynchronous_views.download_file, name='download_member_backup'),

  # ---------- その他 ----------
  # GET /api/web_console_log/ : サーバーのログファイル（web_console.log）の内容を返す（管理者のみ）→ WebConsoleLogView
  path('web_console_log/', main_views.WebConsoleLogView.as_view(), name='web_console_log'),
]

# アップロード・バックアップファイル置き場（media/）のファイルをURLで配信する設定を追加する
#   static() は settings.DEBUG が True（開発環境）のときだけURLパターンを返し、本番では何も追加しない。
#   このファイルは /api/ の下に読み込まれるため、実際のURLは /api/media/〜 になる。
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
