# ============================================================
# ファイル名 : urls.py（hozen_another プロジェクト）
# 種別       : URLルーティング定義（Django プロジェクト全体の入口）
# 概要       : ブラウザから届いたURLを、最初にどこへ振り分けるかを決める対応表。
#              settings.py の ROOT_URLCONF = 'hozen_another.urls' により、すべてのリクエストはここから始まる。
#              上から順に照合し、最初に一致したパターンの処理が使われる。
#
# 振り分け先 :
#   - /admin/〜        : Django 標準の管理サイト（kosu/admin.py で登録したモデルを閲覧・編集）
#   - /api/〜          : APIの本体（kosu/urls.py の対応表へ）
#   - /BA〜            : kosu/urls.py と同じ対応表（接頭辞が 'BA' のみで「/」が無い点に注意）
#   - /manifest.json   : Web App Manifest（ホーム画面追加用の設定）を返す
#   - 上記以外すべて   : React の画面（index.html）を返す。画面の切り替えは React 側（index.tsx）が行う
#
# 関連ファイル: kosu/urls.py, kosu/views/main_views.py（react_view, manifest）, settings.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.contrib import admin
from django.urls import path, include, re_path
from kosu.views.main_views import react_view, manifest
from django.conf import settings
from django.conf.urls.static import static



# ============================================================
# URLパターン定義（上から順に照合される）
# ============================================================
urlpatterns = [
  path('admin/', admin.site.urls),  # Django 標準の管理サイト（/admin/）。下の React 用パターンより先に判定する
  # 'BA' で始まるURLを kosu/urls.py へ振り分ける
  #   'BA' の後ろに「/」が無いため、実際のURLは /BAlogin/ のように 'BA' と kosu 側のURLが直結した形になる
  path('BA', include('kosu.urls')),  # '/BA' パターンの処理
  # '/api/' で始まるURLを kosu/urls.py へ振り分ける（例: /api/login/ → kosu/urls.py の 'login/'）
  path('api/', include('kosu.urls')),  # '/api' パターンの処理（フロントエンドの API 呼び出しはすべてこちら）
  path('manifest.json', manifest),  # manifest.jsonへの対応（アプリ名・起動URL・テーマ色などをJSONで返す）
  # 上記のどれにも一致しないURLは、すべて React の画面（frontend/build/index.html）を返す
  #   正規表現 ^(?!admin).*$ : 「admin で始まらない」任意の文字列に一致する
  #   （(?!admin) は「直後が admin ではない」という条件だけを確認する書き方）
  #   例: /kosu-list や /member-update/123 → index.html を返し、React Router が画面を表示する
  #   ※/api/ の下に存在しないURLもここに一致するため、404 ではなく index.html が返る
  re_path(r'^(?!admin).*$', react_view),  # adminを除外してReactのビューに対応
]

# 開発環境（DEBUG=True）のときだけ、静的ファイル（/static/〜）をURLで配信するパターンを追加する
#   ※上の re_path（admin 以外のすべてに一致）より後ろに追加されるため、/static/ のURLは
#     先に re_path に一致し、このパターンまで照合が進まない。
#     静的ファイルは settings.py の MIDDLEWARE にある WhiteNoise が、URLの振り分けより前に返している。
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)