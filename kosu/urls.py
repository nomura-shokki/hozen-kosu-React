from django.urls import path
from .views import main_views
from .views import kosu_views
from .views import member_views
from .views import team_views
from .views import def_views
from .views import inquiry_views



urlpatterns = [
    path('dynamic-choices/', kosu_views.dynamic_choices, name='dynamic_choices'),
    path('all-choices/', kosu_views.all_choices, name='all_choices'),
    path('help', main_views.help, name = 'help'),
    path('login', main_views.login, name = 'login'),
    path('', main_views.main, name = 'main'),
    path('kosu_main', main_views.kosu_main, name = 'kosu_main'),
    path('def_main', main_views.def_main, name = 'def_main'),
    path('member_main', main_views.member_main, name = 'member_main'),
    path('team_main', main_views.team_main, name = 'team_main'),
    path('inquiry_main', main_views.inquiry_main, name = 'inquiry_main'),
    path('administrator', main_views.administrator_menu, name = 'administrator'),
    path('all_kosu/<int:num>', kosu_views.all_kosu, name = 'all_kosu'),
    path('all_kosu_detail/<int:num>', kosu_views.all_kosu_detail, name = 'all_kosu_detail'),
    path('all_kosu_delete/<int:num>', kosu_views.all_kosu_delete, name = 'all_kosu_delete'),
    path('input', kosu_views.input, name = 'input'),
    path('today_break_time', kosu_views.TodayBreakTimeUpdateView.as_view(), name = 'today_break_time'),
    path('list/<int:num>', kosu_views.KosuListView.as_view(), name = 'kosu_list'),
    path('break_time', kosu_views.BreakTimeUpdateView.as_view(), name = 'break_time'),
    path('detail/<int:num>', kosu_views.detail, name = 'detail'),
    path('delete/<int:pk>', kosu_views.KosuDeleteView.as_view(), name = 'delete'),
    path('total', kosu_views.total, name = 'total'),
    path('over_time', kosu_views.over_time, name = 'over_time'),
    path('schedule', kosu_views.schedule, name = 'schedule'),
    path('member/<int:num>', member_views.MemberPageView.as_view(), name='member'),
    path('new', member_views.MemberNewView.as_view(), name = 'member_new'),
    path('member_edit/<int:num>', member_views.MemberEditView.as_view(), name = 'member_edit'),
    path('member_delete/<int:num>', member_views.MemberDeleteView.as_view(), name = 'member_delete'),
    path('team', team_views.team, name = 'team'),
    path('team_graph', team_views.team_graph, name = 'team_graph'),
    path('team_kosu/<int:num>', team_views.team_kosu, name = 'team_kosu'),
    path('team_detail/<int:num>', team_views.team_detail, name = 'team_detail'),
    path('team_calendar', team_views.team_calendar, name = 'team_calendar'),
    path('team_over_time', team_views.team_over_time, name = 'team_over_time'),
    path('class_list', team_views.class_list, name = 'class_list'),
    path('class_detail/<int:num>', team_views.class_detail, name = 'class_detail'),
    path('kosu_def', def_views.kosu_def, name = 'kosu_def'),
    path('kosu_Ver', def_views.kosu_Ver, name = 'kosu_Ver'),
    path('def_list/<int:num>', def_views.def_list, name = 'def_list'),
    path('def_new', def_views.def_new, name = 'def_new'),
    path('def_edit/<int:num>', def_views.def_edit, name = 'def_edit'),
    path('def_delete/<int:num>', def_views.def_delete, name = 'def_delete'),
    path('inquiry_new', inquiry_views.inquiry_new, name = 'inquiry_new'),
    path('inquiry_list/<int:num>',inquiry_views.inquiry_list, name = 'inquiry_list'),
    path('inquiry_display/<int:num>',inquiry_views.inquiry_display, name = 'inquiry_display'),
    path('inquiry_edit/<int:num>',inquiry_views.inquiry_edit, name = 'inquiry_edit'),
    path('stopwatch', main_views.stopwatch, name = 'stopwatch'),
    ]

