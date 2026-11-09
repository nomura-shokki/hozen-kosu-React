# ============================================================
# ファイル名 : wsgi.py
# 種別       : サーバー起動用の入口ファイル（WSGI）
# 概要       : WSGI 対応のWebサーバーでこのシステムを動かすときに、サーバーが読み込む「入口」。
#              application という名前の変数をサーバーが呼び出し、リクエストを Django に渡す。
#              WSGI とは、Python のWebアプリとWebサーバーをつなぐ標準的な取り決めのこと。
#
# 使われ方   : settings.py の WSGI_APPLICATION = 'hozen_another.wsgi.application' で指定されており、
#              開発用の python manage.py runserver もこの application を使う。
#              本番用には requirements.txt に WSGI サーバーの gunicorn が含まれている。
#              ※この下の """ で囲まれた英語の説明文は Django が自動生成したもの（変更しない）。
# 関連ファイル: asgi.py, settings.py（WSGI_APPLICATION）
# ============================================================
"""
WSGI config for hozen project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

# ============================================================
# インポート
# ============================================================
import os

from django.core.wsgi import get_wsgi_application

# 使用する設定ファイルを環境変数 DJANGO_SETTINGS_MODULE で指定する
#   setdefault なので、すでに環境変数が設定されている場合はそちらを優先する
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hozen_another.settings')

# Django を初期化し、サーバーから呼び出される WSGI アプリケーション本体を作る
application = get_wsgi_application()
