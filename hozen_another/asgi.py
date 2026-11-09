# ============================================================
# ファイル名 : asgi.py
# 種別       : サーバー起動用の入口ファイル（ASGI）
# 概要       : ASGI 対応のWebサーバー（uvicorn / daphne など）でこのシステムを動かす場合に、
#              サーバーが読み込む「入口」。application という名前の変数をサーバーが呼び出す。
#              ASGI とは、Python のWebアプリとWebサーバーをつなぐ取り決め（非同期処理にも対応した新しい方式）。
#
# 補足       : 現在の requirements.txt には ASGI サーバーは含まれておらず、
#              本番は wsgi.py（WSGI 方式）側が使われる構成になっている。
#              ※この下の """ で囲まれた英語の説明文は Django が自動生成したもの（変更しない）。
# 関連ファイル: wsgi.py, settings.py
# ============================================================
"""
ASGI config for hozen project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

# ============================================================
# インポート
# ============================================================
import os

from django.core.asgi import get_asgi_application

# 使用する設定ファイルを環境変数 DJANGO_SETTINGS_MODULE で指定する
#   setdefault なので、すでに環境変数が設定されている場合はそちらを優先する
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hozen_another.settings')

# Django を初期化し、サーバーから呼び出される ASGI アプリケーション本体を作る
application = get_asgi_application()
