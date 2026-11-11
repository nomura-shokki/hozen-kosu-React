# ============================================================
# ファイル名 : settings.py
# 種別       : 設定ファイル（Django プロジェクト全体の設定）
# 概要       : データベース・セキュリティ・使用するアプリ・セッション・静的ファイル・ログなど、
#              システム全体の動作を決める設定値をまとめたファイル。
#              Django は起動時に、manage.py / wsgi.py で指定された 'hozen_another.settings' としてこのファイルを読む。
#
# 主な設定   :
#   - 秘密情報（SECRET_KEY・DB接続情報）は .env ファイル（環境変数）から読み込み、このファイルには書かない
#   - API は Django REST Framework（DRF）で作り、認証は独自の LoginNoAuthentication（permissions.py）
#   - ログイン状態はセッション（データベースに保存）で管理する
#   - React のビルド結果（frontend/build/。vite.config.mts の出力先）を Django から配信する
#   - 別オリジンからのAPI呼び出し（CORS）は、CORS_ALLOWED_ORIGINS に書いたオリジンだけ許可する
#
# 必要な環境変数（.env）: SECRET_KEY, DEBUG, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST
# 関連ファイル: .env（リポジトリ直下。Git 管理外）, test_settings.py（テスト用の上書き設定）,
#              kosu/permissions.py, kosu/middleware/clear_session_middleware.py, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from pathlib import Path
import os
import environ  # django-environ: .env ファイルの値を読み込むためのライブラリ



# ============================================================
# パス・環境変数
# ============================================================

# プロジェクトのルートフォルダ（manage.py がある場所）
#   __file__（このファイル: hozen_another/settings.py）の親の親 = リポジトリ直下
BASE_DIR = Path(__file__).resolve().parent.parent

# リポジトリ直下の .env ファイルを読み込み、中の値を環境変数（os.environ）に登録する
#   すでに同名の環境変数がある場合（Azure の構成設定など）はそちらが優先される
env = environ.Env()
env.read_env(os.path.join(BASE_DIR, '.env'))

# ============================================================
# セキュリティ・基本設定
# ============================================================

# 暗号化・署名（セッションやCSRFトークンなど）に使う秘密の鍵。.env から読み込む（未設定だと起動エラー）
SECRET_KEY=env('SECRET_KEY')

# デバッグモード（True: エラー時に詳細な画面を表示する開発用 / False: 本番用）。.env から真偽値として読み込む
DEBUG=env.bool('DEBUG')

# レスポンスの文字コード
DEFAULT_CHARSET = 'utf-8'

# このサーバーへのアクセスとして受け付けるホスト名の一覧（ここに無いホスト名宛てのリクエストは 400 エラー）
#   本番（Azure 上のサーバー）のホスト名と、開発用のローカル環境
ALLOWED_HOSTS = [
    'hozen-kosu-react-cwaqashkafgbg5e5.japaneast-01.azurewebsites.net',
    'localhost',
    '127.0.0.1'
    ]

# ============================================================
# アプリケーション・ミドルウェア
# ============================================================

# 使用する Django アプリの一覧（ここに登録したアプリのモデル・管理画面・テンプレート等が有効になる）
INSTALLED_APPS = [
    'django.contrib.admin',  # 管理サイト（/admin/）
    'django.contrib.auth',  # Django 標準のユーザー認証（管理サイトが使用。このシステムのログインは member＋セッションで別に実装）
    'django.contrib.contenttypes',  # モデルの種類を管理する仕組み（admin・auth が依存）
    'django.contrib.sessions',  # セッション（ログイン中ユーザーの情報をサーバー側で保持する仕組み）
    'django.contrib.messages',  # 一時メッセージ表示の仕組み（admin が依存）
    'django.contrib.staticfiles',  # 静的ファイル（CSS・JS・画像）の管理（collectstatic コマンドなど）
    'bootstrap4',  # Django テンプレート用の Bootstrap4 部品（※kosu アプリにテンプレートファイルは無い）
    'bootstrap_datepicker_plus',  # Django フォーム用の日付選択部品（※同上）
    'kosu',  # 工数管理システム本体のアプリ（kosu/）
    'django_q',  # Django-Q（非同期タスクキュー）。下の Q_CLUSTER 参照
    'rest_framework',  # Django REST Framework（APIを作るためのライブラリ）
    'corsheaders',  # django-cors-headers（別オリジンからのAPI呼び出しを許可するための仕組み）
]

# ミドルウェア: すべてのリクエスト/レスポンスに対して、上から順に実行される共通処理
#   （レスポンスを返すときは下から順に戻っていく）
MIDDLEWARE = [
    # CORS（別オリジンからのアクセス許可）のヘッダーを付ける。レスポンスを作る他の処理より前に置く必要がある
    'corsheaders.middleware.CorsMiddleware', 
    # セキュリティ関連のヘッダーを付ける
    'django.middleware.security.SecurityMiddleware',
    # セッションを読み書きできるようにする（request.session が使えるようになる）
    'django.contrib.sessions.middleware.SessionMiddleware',
    # URL末尾の「/」の補完など、共通的な処理
    'django.middleware.common.CommonMiddleware',
    # CSRF（なりすまし送信）対策のトークン確認
    'django.middleware.csrf.CsrfViewMiddleware',
    # Django 標準ユーザーの認証（管理サイト用。API の認証は REST_FRAMEWORK の設定で別に行う）
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # 一時メッセージ（admin 用）
    'django.contrib.messages.middleware.MessageMiddleware',
    # 他サイトの iframe 内に表示されることを防ぐ（クリックジャッキング対策）
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # WhiteNoise: 静的ファイル（/static/〜）を URL の振り分けより前に直接返す
    'whitenoise.middleware.WhiteNoiseMiddleware',
    # 処理中のリクエストを保存し、signals.py（操作履歴の記録）から参照できるようにする独自ミドルウェア
    'kosu.middleware.clear_session_middleware.CurrentRequestMiddleware',
]

# ============================================================
# CORS（オリジン間リソース共有）
#   オリジン = 「プロトコル＋ホスト名＋ポート番号」の組（例: http://localhost:3000）。
#   ブラウザは、画面と異なるオリジンのAPIを呼ぶとき、サーバーの許可が無いと結果を受け取らない。
# ============================================================

# 別オリジンからの呼び出しでも Cookie（セッションID・CSRFトークン）の送受信を許可する
#   ※Cookie 付きで許可するため、許可するオリジンは下の一覧に書いたものだけに限定する
#     （すべてのオリジンを許可すると、外部サイトからログイン中の利用者のセッションでAPIを呼べてしまう）
CORS_ALLOW_CREDENTIALS = True
# 別オリジンからのAPI呼び出しを許可するオリジンの一覧（開発環境）
#   本番は画面（React）とAPIを同じ Django から配信する＝同じオリジンなので、ここに書く必要はない。
#   開発用の画面を別のオリジン（ポート番号）で動かす場合は、そのオリジンをここに追加する。
#   ※書式は「プロトコル://ホスト名:ポート番号」。末尾に / を付けない
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]

# ============================================================
# Django REST Framework（API）の共通設定
# ============================================================
REST_FRAMEWORK = {
    # 一覧のページ分け（ページネーション）の既定値: DRF 標準のページ番号方式、1ページ20件
    #   ※この既定値が自動で使われるのは DRF の汎用ビュー（GenericAPIView 系）のみ。
    #     このプロジェクトのビューは APIView で、一覧APIは utils/main_utils.py の CustomPagination を
    #     直接使うため、実際の件数は管理者設定の「一覧表示項目数」で決まる
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # リクエスト本文は JSON 形式だけを受け付ける
    #   （ファイルアップロードを受ける asynchronous_views.py の backup は個別に MultiPartParser 等を指定）
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    ),
    # レスポンスは JSON 形式だけで返す（DRF のブラウザ用HTML画面は使わない）
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': ['kosu.permissions.LoginNoAuthentication'],  # だれがログインしているか
    'DEFAULT_PERMISSION_CLASSES': ['kosu.permissions.IsLoggedIn'],                 # 最初から全部の API でログインが要る
    'UNAUTHENTICATED_USER': None,                                                 # ログインしていない時の request.user は None
    # 呼び出し回数の上限（throttle_scope を付けた API だけにかかる。1 時間に 5 回まで）
    'DEFAULT_THROTTLE_RATES': {
        'help': '5/hour',
    },
}

# ============================================================
# セッション
# ============================================================

# セッションの保存先: データベース（django_session テーブル）
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

# セッションCookieの有効期間（秒）
#   315,360,000秒 = 3,650日（約10年）。実質的に「ログアウトするまでログイン状態を保つ」設定
SESSION_COOKIE_AGE = 315360000

# セッションCookieは、別のサイトからのリクエストには付けさせない（Lax）
#   画面と API は同じサーバー（同じオリジン）から出しているので、Lax にしても困ることはない。
#   別のサイトに置いた罠のページから、ログイン中の人として操作されるのを防ぐ
SESSION_COOKIE_SAMESITE = 'Lax'
# HTTPS 通信のときだけセッションCookieを送る（手元の http://localhost でも、ブラウザは送る）
SESSION_COOKIE_SECURE = True

# ============================================================
# URL・テンプレート
# ============================================================

# URLの振り分けの入口となるファイル（hozen_another/urls.py）
ROOT_URLCONF = 'hozen_another.urls'

# テンプレート（HTMLのひな形）の設定
TEMPLATES = [
    {
        # Django 標準のテンプレートエンジンを使う
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # テンプレートを探す追加フォルダ（下の TEMPLATES[0]['DIRS'] = ... で frontend/build に上書きされる）
        'DIRS': [],
        # 各アプリの templates/ フォルダも探す（管理サイトの画面などが使う）
        'APP_DIRS': True,
        'OPTIONS': {
            # テンプレート内で自動的に使える変数を追加する処理の一覧
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            # {% load %} を書かなくても全テンプレートで使えるタグ（Bootstrap4 用のタグ）
            'builtins':[ 
                'bootstrap4.templatetags.bootstrap4',
                ]
        },
    },
]

# ============================================================
# 静的ファイル（CSS・JavaScript・画像）
# ============================================================

# collectstatic で集める静的ファイルの追加の置き場（React のビルド結果の static フォルダ）
#   vite.config.mts で JS・CSS・画像を frontend/build/static/ に出力し、/static/〜 のURLで参照させている
#   （ここの static フォルダと STATIC_URL='/static/' がそろっていないと、画面のJS・CSSが読み込めない）
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'frontend/build/static'),
]

# Reactのbuild内のindex.htmlをテンプレートとして指定
#   main_views.py の react_view が render(request, 'index.html') でこのファイルを返す
TEMPLATES[0]['DIRS'] = [os.path.join(BASE_DIR, 'frontend/build')]

# django-bootstrap4 の設定: Bootstrap 用のタグで jQuery も読み込む
BOOTSTRAP4 = {
    'include_jquery': True,
}

# WSGI サーバー（runserver・gunicorn など）が呼び出すアプリケーション本体の場所（hozen_another/wsgi.py）
WSGI_APPLICATION = 'hozen_another.wsgi.application'

# ============================================================
# データベース
# ============================================================

# 接続するデータベース（PostgreSQL）
#   接続情報は環境変数（上で読み込んだ .env の値）から取得し、未設定なら空文字になる
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',  # PostgreSQL を使う
        'NAME': os.getenv('DB_NAME', ''),  # データベース名
        'USER': os.getenv('DB_USER', ''),  # 接続ユーザー名
        'PASSWORD': os.getenv('DB_PASSWORD', ''),  # 接続パスワード
        'HOST': os.getenv('DB_HOST', ''),  # データベースサーバーのホスト名
        'PORT': '5432',  # PostgreSQL の標準ポート番号
    }
}

# Django Q の設定
#   Django-Q: 時間のかかる処理を別プロセス（python manage.py qcluster で起動）に任せる仕組み。
#   ※現在のコードはバックアップ・復元を asynchronous_views.py で threading（別スレッド）により実行しており、
#     Django-Q へのタスク登録（async_task など）は行っていない
Q_CLUSTER = {
    'orm': 'default',  # タスクの受け渡し場所として Django のデータベース（'default'）を使う
    'workers': 4,  # 同時にタスクを処理するワーカー（作業プロセス）の数
    'recycle': 2000,  # 1つのワーカーが2000件処理したら作り直す（メモリの肥大化を防ぐ）
    'retry': 2000,  # 処理完了の報告が無いタスクを、2000秒後に再実行する（timeout より長くする必要がある）
    'timeout': 1800,  # 1つのタスクの実行時間の上限（1800秒 = 30分）
}

# ============================================================
# パスワード検証
#   Django 標準ユーザー（管理サイト用。createsuperuser 等で作成）のパスワードに課すルール。
#   このシステムのログインは従業員番号だけで行うため、人員（member）には関係しない。
# ============================================================
AUTH_PASSWORD_VALIDATORS = [
    {
        # ユーザー名などと似すぎたパスワードを禁止
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        # 短すぎるパスワードを禁止（既定は8文字未満）
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        # よく使われる推測しやすいパスワードを禁止
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        # 数字だけのパスワードを禁止
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ============================================================
# 言語・タイムゾーン
# ============================================================

# 管理サイトやエラーメッセージなどの表示言語（日本語）
LANGUAGE_CODE = 'ja'

# 日時の表示・計算に使うタイムゾーン（日本時間）
TIME_ZONE = 'Asia/Tokyo'

# 翻訳（多言語対応）の仕組みを有効にする
USE_I18N = True

# タイムゾーンを考慮した日時を使う（DBには UTC で保存し、表示時に TIME_ZONE に変換される）
USE_TZ = True

# ============================================================
# 静的ファイルの配信・その他
# ============================================================

# 静的ファイルのURLの先頭部分（例: /static/js/main.js）
STATIC_URL = '/static/'

# モデルに主キーを書かなかった場合に自動で作られる id 列の型（大きな整数の連番。apps.py と同じ）
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# python manage.py collectstatic で静的ファイルを集める先（本番では WhiteNoise がここから配信する）
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# CSRF の確認で「信頼できる送信元」とみなすオリジンの一覧
#   POST/PUT/DELETE のリクエストは、送信元（Origin ヘッダー）がここに含まれるか、同じホストである必要がある
CSRF_TRUSTED_ORIGINS = [
  'https://hozen-kosu-react-cwaqashkafgbg5e5.japaneast-01.azurewebsites.net',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]

# 静的ファイルの保存方式（WhiteNoise）
#   collectstatic 時にファイルを圧縮し、ファイル名に内容のハッシュ値を付ける
#   （例: main.css → main.1a2b3c.css。内容が変わるとURLも変わるので、ブラウザの古いキャッシュが使われない）
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ============================================================
# メディアファイル（バックアップファイル）
# ============================================================

# バックアップファイル保存先指定
#   tasks.py のバックアップ処理が作る Excel ファイルは MEDIA_ROOT（リポジトリ直下の media/）に保存される
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ============================================================
# ログ出力
#   main_views.py で print() の出力を 'views_logger' に送るようにしており、
#   その内容を web_console.log に書き込む。管理者は WebConsoleLogView（/api/web_console_log/）で閲覧できる。
# ============================================================
LOGGING = {
    'version': 1,  # 設定形式のバージョン（Python の logging の仕様で 1 固定）
    'disable_existing_loggers': False,  # Django などが既に用意しているロガーを無効化しない
    # ログ1行の書式
    'formatters': {
        'simple': {  
            'format': '{message}',  # メッセージ本文だけを出力する（日時などは付けない）
            'style': '{',  # format の書き方を {変数名} 形式にする
        },
    },
    # ログの出力先
    'handlers': {
        'web_console': {
            'level': 'INFO',  # INFO 以上の重要度のログを出力する
            'class': 'logging.handlers.RotatingFileHandler',  # 一定サイズでファイルを切り替える出力方式
            'formatter': 'simple',  # 上で定義した書式を使う
            'filename': 'web_console.log',  # 出力先ファイル（サーバーを起動したフォルダからの相対パス）
            'maxBytes': 1024 * 1024 * 1,  # 最大ファイルサイズ (1MB)
            'backupCount': 1,  # 古いログを1世代（web_console.log.1）だけ残す
            'encoding': 'utf-8',  # 文字コード（日本語を正しく書き込むため UTF-8）
        },
    },
    # ロガー（ログを受け付ける窓口）の設定
    'loggers': {
        'views_logger': {
            'handlers': ['web_console'],  # web_console（ファイル）に出力する
            'level': 'INFO',  # INFO 以上を受け付ける
            'propagate': False,  # 上位のロガーには渡さない（同じログが二重に出力されるのを防ぐ）
        },
    },
}