from django.contrib import admin
from django.urls import path,include, re_path
from kosu.views.main_views import react_view, manifest

urlpatterns = [
  path('admin/', admin.site.urls),
  path('BA', include('kosu.urls')),
  path('api/', include('kosu.urls')),
  path('manifest.json', manifest), 
  path('', react_view),
  re_path(r'^.*$', react_view),
]