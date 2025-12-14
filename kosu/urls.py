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
from functools import partial



urlpatterns = [
  path('login/', main_views.Login.as_view(), name='login'),
  path('logout/', main_views.Logout.as_view(), name='logout'),
  path('main_menu/', main_views.Menu.as_view(), name='main_menu'),
  path('kosu_menu/', main_views.KosuMenu.as_view(), name='kosu_menu'),
  path('kosu_new/', kosu_views.KosuNew.as_view(), name='kosu_new'),
  path('set_day/', kosu_views.SetDay.as_view(), name='set_day'),
  path('over_time/', kosu_views.OverTime.as_view(), name='over_time'),
  path('kosu_list/', kosu_views.KosuList.as_view(), name='kosu_list'), 
  path('kosu_update/<int:pk>/', kosu_views.KosuUpdate.as_view(), name='kosu_update'),
  path('kosu_calendar/', kosu_views.KosuCalendar.as_view(), name='kosu_calendar'),
  path('kosu_calendar_change/', kosu_views.KosuCalendarChange.as_view(), name='kosu_calendar_change'),
  path('kosu_work_write/', kosu_views.KosuWorkWrite.as_view(), name='kosu_work_write'),
  path('work_default/', kosu_views.WorkDefault.as_view(), name='work_default'),
  path('tyoku_default/', kosu_views.TyokuDefault.as_view(), name='tyoku_default'),
  path('kosu_link/', kosu_views.KosuLink.as_view(), name='kosu_link'),
  path('day_update/', kosu_views.DayUpdate.as_view(), name='item_delete'),
  path('item_delete/', kosu_views.ItemDlete.as_view(), name='day_update'),
  path('kosu_delete/<int:pk>/', kosu_views.KosuDelete.as_view(), name='kosu_delete'),
  path('today_break_time/', kosu_views.TodayBreakTime.as_view(), name='today_break_time'), 
  path('break_time/', kosu_views.BreakTime.as_view(), name='break_time'),
  path('kosu_total/', kosu_views.KosuTotal.as_view(), name='kosu_total'),
  path('def_menu/', main_views.DefMenu.as_view(), name='def_menu'),
  path('def_new/', def_views.DefNew.as_view(), name='def_new'), 
  path('def_list/', def_views.DefList.as_view(), name='def_list'), 
  path('def_update/<int:pk>/', def_views.DefUpdate.as_view(), name='def_update'),
  path('def_delete/<int:pk>/', def_views.DefDelete.as_view(), name='def_delete'),
  path('def_ver/', def_views.DefVer.as_view(), name='def_ver'), 
  path('def_search/', def_views.DefSearch.as_view(), name='def_search'), 
  path('member_menu/', main_views.MemberMenu.as_view(), name='member_menu'),
  path('member_list/', member_views.MemberList.as_view(), name='member_list'),
  path('member_new/', member_views.MemberNew.as_view(), name='member_new'),
  path('member_update/<int:pk>/', member_views.MemberUpdate.as_view(), name='member_update'),
  path('member_delete/<int:pk>/', member_views.MemberDelete.as_view(), name='member_delete'),
  path('team_menu/', main_views.TeamMenu.as_view(), name='team_menu'),
  path('team_new/', team_views.TeamNew.as_view(), name='team_new'),
  path('team_list/', team_views.TeamList.as_view(), name='team_list'),
  path('team_detail/<int:pk>/', team_views.TeamDetail.as_view(), name='team_detail'),
  path('team_calendar/', team_views.TeamCalendar.as_view(), name='team_calendar'),
  path('team_calendar_week_jump/', team_views.TeamCalendarWeekJump.as_view(), name='team_calendar_week_jump'),
  path('team_overtime/', team_views.TeamOverTime.as_view(), name='team_overtime'),
  path('team_view/', team_views.TeamView.as_view(), name='team_view'),
  path('team_shop_select/', team_views.TeamShopSelect.as_view(), name='team_shop_select/'),
  path('inquir_menu/', main_views.InquirMenu.as_view(), name='inquir_menu'),
  path('inquir_new/', inquiry_views.InquirNew.as_view(), name='inquir_new'),
  path('inquir_list/', inquiry_views.InquirList.as_view(), name='inquir_list'),
  path('inquir_detail/<int:pk>/', inquiry_views.InquirDetail.as_view(), name='inquir_detail'),
  path('inquir_update/<int:pk>/', inquiry_views.InquirUpdate.as_view(), name='inquir_update'),
  path('manager_menu/', main_views.AdministratorMenu.as_view(), name='admin_menu'),
  path('manager_update/', main_views.AdministratorUpdate.as_view(), name='admin_update'),
  path('manager_loading/', main_views.AdministratorLoading.as_view(), name='admin_loading'),
  path('manager_kosu/', main_views.AdministratorKosuList.as_view(), name='admin_kosu'),
  path('manager_kosu_update/<int:pk>/', main_views.AdministratorKosuUpdate.as_view(), name='admin_kosu_update'),
  path('manager_task/', main_views.AdministratorTaskList.as_view(), name='admin_task'),
  path('manager_task_detail/<int:pk>/', main_views.AdministratorTaskDetail.as_view(), name='admin_task_detail'),
  path('manager_history/', main_views.AdministratorHistoryList.as_view(), name='admin_history'),

  path('kosu_backup/', asynchronous_views.backup, name='kosu_backup'),
  path('kosu_delet/', asynchronous_views.backup, name='kosu_delet'),
  path('kosu_load/', asynchronous_views.backup, name='kosu_load'),
  path('def_backup/', asynchronous_views.backup, name='def_backup'),
  path('def_load/', asynchronous_views.backup, name='def_load'),
  path('member_backup/', asynchronous_views.backup, name='member_backup'),
  path('member_load/', asynchronous_views.backup, name='member_load'),
  path('team_backup/', asynchronous_views.backup, name='team_backup'),
  path('team_load/', asynchronous_views.backup, name='team_load'),
  path('inquiry_backup/', asynchronous_views.backup, name='inquiry_backup'),
  path('inquiry_load/', asynchronous_views.backup, name='inquiry_load'),
  path('setting_backup/', asynchronous_views.backup, name='setting_backup'),
  path('setting_load/', asynchronous_views.backup, name='setting_load'),
  path('AsyncTask_backup/', asynchronous_views.backup, name='AsyncTask_backup'),
  path('AsyncTask_delet/', asynchronous_views.backup, name='AsyncTask_delet'),
  path('History_backup/', asynchronous_views.backup, name='History_backup'),
  path('History_delet/', asynchronous_views.backup, name='History_delet'),

  path('check_backup_status', asynchronous_views.check_task_status, name='check_member_backup_status'),
  path('download_backup', asynchronous_views.download_file, name='download_member_backup'),


  ]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
