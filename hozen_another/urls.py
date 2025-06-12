from django.contrib import admin
from django.urls import path,include, re_path
from kosu.views.member_views import react_view

urlpatterns = [
  path('admin/', admin.site.urls),
  path('BA', include('kosu.urls')),
  path('api/', include('kosu.urls')),
  path('', react_view),
  re_path(r'^.*$', react_view),
]