#!/usr/bin/env python
# ============================================================
# ファイル名 : manage.py
# 種別       : Django 管理コマンドの実行ファイル
# 概要       : 開発・運用でよく使う Django のコマンドを実行するための入口。
#              「python manage.py コマンド名」の形で使う。
#
# 主な使い方 :
#   python manage.py runserver        : 開発用サーバーを起動（http://localhost:8000）
#   python manage.py migrate          : モデルの定義に合わせてデータベースのテーブルを作成・変更
#   python manage.py makemigrations   : models.py の変更内容からマイグレーションファイルを作成
#   python manage.py test --settings=hozen_another.test_settings : バックエンドのテストを実行
#
# 補足       : 1行目の「#!/usr/bin/env python」はシバン（Linux 等でこのファイルを直接実行したときに
#              使うプログラムを指定する特別な行）。必ずファイルの1行目に置く必要があるため、
#              このヘッダーはその下に書いている。
#              ※この下の """ で囲まれた英語の説明文は Django が自動生成したもの（変更しない）。
# 関連ファイル: hozen_another/settings.py
# ============================================================
"""Django's command-line utility for administrative tasks."""
# ============================================================
# インポート
# ============================================================
import os
import sys


# 管理コマンドを実行する。
#
# コマンドライン引数（sys.argv。例: ['manage.py', 'runserver']）をそのまま Django に渡し、
# 対応するコマンドを実行させる。
#
# 引数:
#   なし
# 戻り値:
#   なし
# 例外:
#   ImportError: Django がインストールされていない（または仮想環境が有効でない）場合
def main():
    """Run administrative tasks."""
    # 使用する設定ファイルを指定する（環境変数が既にあればそちらを優先。--settings 指定でも上書きされる）
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hozen_another.settings')
    try:
        # Django のコマンド実行用関数を読み込む
        from django.core.management import execute_from_command_line
    # 読み込めない場合は、原因（インストール漏れ・仮想環境の有効化忘れ）を案内するエラーを出す
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    # 引数に応じたコマンド（runserver / migrate など）を実行する
    execute_from_command_line(sys.argv)


# このファイルが直接実行されたとき（python manage.py 〜）だけ main() を呼ぶ
#   他のファイルから import された場合は実行しない
if __name__ == '__main__':
    main()
