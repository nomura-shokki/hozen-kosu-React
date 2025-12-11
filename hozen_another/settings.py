from pathlib import Path
import os
import environ
from logging.handlers import RotatingFileHandler



BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY=env('SECRET_KEY')

DEBUG=env.bool('DEBUG')

DEFAULT_CHARSET = 'utf-8'

ALLOWED_HOSTS = [
    'hozen-kosu-another-c6e2gyeraydpdnhq.japaneast-01.azurewebsites.net',
    'localhost',
    '127.0.0.1'
    ]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'bootstrap4',
    'bootstrap_datepicker_plus',
    'kosu',
    'django_q',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', 
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'kosu.middleware.clear_session_middleware.CurrentRequestMiddleware',
]

CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
}

SESSION_ENGINE = 'django.contrib.sessions.backends.db'

SESSION_COOKIE_AGE = 315360000

SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = True

ROOT_URLCONF = 'hozen_another.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            'builtins':[ 
                'bootstrap4.templatetags.bootstrap4',
                ]
        },
    },
]

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'frontend/build/static'),
]

# Reactのbuild内のindex.htmlをテンプレートとして指定
TEMPLATES[0]['DIRS'] = [os.path.join(BASE_DIR, 'frontend/build')]

BOOTSTRAP4 = {
    'include_jquery': True,
}

WSGI_APPLICATION = 'hozen_another.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', ''),
        'USER': os.getenv('DB_USER', ''),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', ''),
        'PORT': '5432',
    }
}

# Django Q の設定
Q_CLUSTER = {
    'orm': 'default',
    'workers': 4, 
    'recycle': 2000,
    'retry': 2000,
    'timeout': 1800,
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'ja'

TIME_ZONE = 'Asia/Tokyo'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

CSRF_TRUSTED_ORIGINS = [
  'https://hozen-kosu-another-c6e2gyeraydpdnhq.japaneast-01.azurewebsites.net',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# バックアップファイル保存先指定
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {  
            'format': '{message}',
            'style': '{',
        },
    },
    'handlers': {
        'web_console': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'formatter': 'simple',
            'filename': 'web_console.log',
            'maxBytes': 1024 * 1024 * 1,  # 最大ファイルサイズ (1MB)
            'backupCount': 1,
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'views_logger': {
            'handlers': ['web_console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}