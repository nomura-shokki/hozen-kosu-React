from django.contrib import admin
from django.urls import path, include, re_path
from kosu.views.main_views import react_view, manifest
from django.conf import settings
from django.conf.urls.static import static



urlpatterns = [
  path('admin/', admin.site.urls),  # Djangoの管理ページへのアクセスを無視させる
  path('BA', include('kosu.urls')),  # '/BA' パターンの処理
  path('api/', include('kosu.urls')),  # '/api' パターンの処理
  path('manifest.json', manifest),  # manifest.jsonへの対応
  re_path(r'^(?!admin).*$', react_view),  # adminを除外してReactのビューに対応
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)