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



urlpatterns = [
  path('help', main_views.help, name='help'), # ヘルプ画面
  path('login', main_views.LoginView.as_view(), name='login'), # ログイン画面
  path('', main_views.MainView.as_view(), name='main'), # メイン画面
  path('kosu_main', main_views.KosuMainView.as_view(), name='kosu_main'), # 工数MENU画面
  path('def_main', main_views.DefMainView.as_view(), name='def_main'), # 工数区分定義MENU画面
  path('member_main', main_views.MemberMainView.as_view(), name='member_main'), # 人員MENU画面
  path('team_main', main_views.TeamMainView.as_view(), name='team_main'), # 班員MENU画面
  path('inquiry_main', main_views.InquirMainView.as_view(), name='inquiry_main'), # 問い合わせMENU画面
  path('administrator', main_views.administrator_menu, name='administrator'), # 管理者MENU画面
  path('all_kosu/<int:num>', kosu_views.AllKosuListView.as_view(), name='all_kosu'), # 全人員工数一覧画面(管理者用)
  path('all_kosu_detail/<int:num>', kosu_views.AllKosuDetailView.as_view(), name='all_kosu_detail'), # 工数データ詳細画面(管理者用)
  path('all_kosu_delete/<int:pk>', kosu_views.AllKosuDeleteView.as_view(), name='all_kosu_delete'), # 工数データ削除画面(管理者用)
  path('input', kosu_views.input, name='input'), # 工数入力画面
  path('today_break_time', kosu_views.TodayBreakTimeUpdateView.as_view(), name='today_break_time'), # 当日休憩時間変更画面
  path('list/<int:num>', kosu_views.KosuListView.as_view(), name='kosu_list'), # 工数一覧画面
  path('break_time', kosu_views.BreakTimeUpdateView.as_view(), name='break_time'), # 休憩時間変更画面(デフォルト)
  path('detail/<int:num>', kosu_views.detail, name='detail'), # 工数編集画面
  path('delete/<int:pk>', kosu_views.KosuDeleteView.as_view(), name='delete'), # 工数削除画面
  path('total', kosu_views.KosuTotalView.as_view(), name='total'), # 工数集計画面
  path('over_time', kosu_views.over_time, name='over_time'), # 個人残業管理画面
  path('schedule', kosu_views.schedule, name='schedule'), # 勤務入力画面
  path('member/<int:num>', member_views.MemberPageView.as_view(), name='member'), # 人員一覧画面
  path('new', member_views.MemberNewView.as_view(), name='member_new'), # 人員登録画面
  path('member_edit/<int:num>', member_views.MemberEditView.as_view(), name='member_edit'), # 人員情報編集画面
  path('member_delete/<int:num>', member_views.MemberDeleteView.as_view(), name='member_delete'), # 人員情報削除画面
  path('team', team_views.TeamView.as_view(), name='team'), # 班員登録画面
  path('team_graph', team_views.TeamGraphView.as_view(), name='team_graph'), # 班員工数一覧画面(グラフ表示)
  path('team_kosu/<int:num>', team_views.TeamKosuListView.as_view(), name='team_kosu'), # 班員工数データ一覧画面
  path('team_detail/<int:num>', team_views.team_detail, name='team_detail'), # 班員工数詳細画面
  path('team_calendar', team_views.team_calendar, name='team_calendar'), # 班員工数一覧画面(カレンダー表示)
  path('team_over_time', team_views.team_over_time, name='team_over_time'), # 班員残業管理画面
  path('class_list', team_views.ClassListView.as_view(), name='class_list'), # ショップ単位工数入力状態可否画面
  path('class_detail/<int:num>', team_views.class_detail, name='class_detail'), # ショップ単位工数入力状態可否詳細画面
  path('kosu_def', def_views.kosu_def, name='kosu_def'), # 工数気分定義内容確認画面
  path('kosu_Ver', def_views.kosu_Ver, name='kosu_Ver'), # 工数区分定義Ver切替画面
  path('def_list/<int:num>', def_views.DefListView.as_view(), name='def_list'), # 工数区分定義データ一覧画面
  path('def_new', def_views.DefNewView.as_view(), name='def_new'), # 工数区分定義新規登録画面
  path('def_edit/<int:num>', def_views.def_edit, name='def_edit'), # 工数区分定義編集画面
  path('def_delete/<int:num>', def_views.def_delete, name='def_delete'), # 工数区分定義削除画面
  path('inquiry_new', inquiry_views.inquiry_new, name='inquiry_new'), # 問い合わせ新規登録画面
  path('inquiry_list/<int:num>',inquiry_views.inquiry_list, name='inquiry_list'), # 問い合わせ一覧画面
  path('inquiry_display/<int:num>',inquiry_views.inquiry_display, name='inquiry_display'), # 問い合わせ詳細画面
  path('inquiry_edit/<int:num>',inquiry_views.inquiry_edit, name='inquiry_edit'), # 問い合わせ編集画面

  path('dynamic-choices/', kosu_views.dynamic_choices, name='dynamic_choices'), # 作業詳細入力時の工数定義区分予測APIエンドポイント
  path('all-choices/', kosu_views.all_choices, name='all_choices'), # 工数区分定義選択肢生成APIエンドポイント(工数定義区分予測時のみ)

  path('start_kosu_backup', lambda request: asynchronous_views.start_task(request, 'kosu_backup'), name='start_kosu_backup'), # 工数データバックアップ非同期処理開始APIエンドポイント
  path('start_kosu_prediction', lambda request: asynchronous_views.start_task(request, 'prediction'), name='start_kosu_prediction'), # 工数区分定義予測データ作成非同期処理開始APIエンドポイント
  path('start_kosu_delete', lambda request: asynchronous_views.start_task(request, 'kosu_delete'), name='start_kosu_delete'), # 工数データ削除非同期処理開始APIポイント
  path('start_kosu_load', lambda request: asynchronous_views.start_task(request, 'kosu_load'), name='start_kosu_load'), # 工数データロード非同期処理開始APIエンドポイント
  path('start_member_backup', lambda request: asynchronous_views.start_task(request, 'member_backup'), name='start_member_backup'), # 人員データバックアップ非同期処理開始APIエンドポイント
  path('start_member_load', lambda request: asynchronous_views.start_task(request, 'member_load'), name='start_member_load'), # 人員データロード非同期処理開始APIエンドポイント
  path('start_team_backup', lambda request: asynchronous_views.start_task(request, 'team_backup'), name='start_team_backup'),  # 班員データロード非同期処理開始APIエンドポイント
  path('start_team_load', lambda request: asynchronous_views.start_task(request, 'team_load'), name='start_team_load'), # 班員データロード非同期処理開始APIエンドポイント
  path('start_def_backup', lambda request: asynchronous_views.start_task(request, 'def_backup'), name='start_def_backup'),  # 工数区分定義データロード非同期処理開始APIエンドポイント
  path('start_def_load', lambda request: asynchronous_views.start_task(request, 'def_load'), name='start_def_load'), # 工数区分定義データロード非同期処理開始APIエンドポイント

  path('check_kosu_backup_status', asynchronous_views.check_task_status, name='check_kosu_backup_status'), # 工数データバックアップ非同期処理監視APIエンドポイント
  path('check_kosu_prediction_status', asynchronous_views.check_task_status, name='check_kosu_prediction_status'), # 工数定義区分予測データ作成非同期処理監視APIエンドポイント
  path('check_kosu_delete_status', asynchronous_views.check_task_status, name='check_kosu_delete_status'), # 工数データ削除非同期処理監視APIポイント
  path('check_kosu_load_status', asynchronous_views.check_task_status, name='check_kosu_load_status'), # 工数データロード非同期処理監視APIエンドポイント
  path('check_member_backup_status', asynchronous_views.check_task_status, name='check_member_backup_status'), # 人員データバックアップ非同期処理監視APIエンドポイント
  path('check_member_load_status', asynchronous_views.check_task_status, name='check_member_load_status'), # 人員データロード非同期処理監視APIエンドポイント
  path('check_team_backup_status', asynchronous_views.check_task_status, name='check_team_backup_status'), # 班員データバックアップ非同期処理監視APIエンドポイント
  path('check_team_load_status', asynchronous_views.check_task_status, name='check_team_load_status'), # 班員データロード非同期処理監視APIエンドポイント
  path('check_def_backup_status', asynchronous_views.check_task_status, name='check_def_backup_status'), # 工数区分定義データバックアップ非同期処理監視APIエンドポイント
  path('check_def_load_status', asynchronous_views.check_task_status, name='check_def_load_status'), # 班員データロード非同期処理監視APIエンドポイント

  path('download_kosu_backup', asynchronous_views.download_file, name='download_kosu_backup'), # 工数データバックアップファイルダウンロード非同期処理APIエンドポイント
  path('download_kosu_prediction', asynchronous_views.download_file, name='download_kosu_prediction'), # 工数定義区分予測ファイルダウンロード非同期処理APIエンドポイント
  path('download_member_backup', asynchronous_views.download_file, name='download_member_backup'), # 人員データバックアップファイルダウンロード非同期処理APIエンドポイント
  path('download_team_backup', asynchronous_views.download_file, name='download_team_backup'), # 班員データバックアップファイルダウンロード非同期処理APIエンドポイント
  path('download_def_backup', asynchronous_views.download_file, name='download_def_backup'), # 工数区分定義データバックアップファイルダウンロード非同期処理APIエンドポイント
  ]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)