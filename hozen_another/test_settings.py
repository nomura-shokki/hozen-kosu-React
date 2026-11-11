# ============================================================
# ファイル名 : test_settings.py
# 種別       : 設定ファイル（テスト専用の Django 設定）
# 概要       : バックエンドのテストを実行するときだけ使う設定。
#              通常の settings.py の内容をすべて読み込んだうえで、テストに不向きな項目だけを上書きする。
#
# 使い方     : python manage.py test --settings=hozen_another.test_settings
#              （--settings を付けないと settings.py の PostgreSQL 設定でテストしようとする）
#
# 主な上書き内容:
#   - TESTING           : テスト中であることを示す目印（asynchronous_views.py が参照）
#   - DATABASES         : PostgreSQL の代わりにメモリ上の SQLite を使う（毎回まっさらで高速）
#   - Q_CLUSTER         : Django-Q をテスト向け（同期実行）に設定
#   - MIGRATION_MODULES : マイグレーションを使わず、モデル定義から直接テーブルを作る
#   - REST_FRAMEWORK    : 呼び出し回数の制限（ヘルプの1時間5回）をかけない（同じテストの中で何度もヘルプを呼ぶため）
#   - MEDIA_ROOT        : テストで作るバックアップの Excel の置き場所を、毎回新しい一時フォルダにする
#
# 補足       : settings.py を読み込むため、テスト時も .env の SECRET_KEY・DEBUG は必要。
# 関連ファイル: settings.py, kosu/tests/test_backend.py, kosu/views/asynchronous_views.py
# ============================================================

# 通常の設定（settings.py）の内容をすべて読み込む。以下で必要な項目だけ上書きする
from .settings import *  
# テスト中の目印。asynchronous_views.py はこれが True のとき、
# バックアップ等の処理を別スレッドにせずその場で実行する（SQLite のテーブルロックを避けるため）
TESTING = True  
# データベースをメモリ上の SQLite に切り替える
#   ':memory:' はファイルを作らずメモリ内だけにDBを作る指定。テスト終了とともに消える
DATABASES = {  
    'default': {  
        'ENGINE': 'django.db.backends.sqlite3',  
        'NAME': ':memory:',  
    }  
}  
# Django-Q（非同期タスクキュー）のテスト用設定（settings.py の Q_CLUSTER を丸ごと置き換える）
#   name      … クラスター（タスク実行担当のまとまり）の名前
#   sync: True … タスクを別プロセスに渡さず、その場で順番に実行する
#   timeout   … 1つのタスクの実行時間の上限（秒）
#   orm       … タスクの受け渡しに Django のデータベース（'default'）を使う
#   ※現在のコードはバックアップ等を threading（別スレッド）で実行しており、Django-Q へのタスク登録は行っていない
Q_CLUSTER = {  
    'name': 'test',  
    'sync': True,  
    'timeout': 60,  
    'orm': 'default',  
}  
# ------------------------------------------------------------
# DisableMigrations: マイグレーションを無効化するための設定用クラス
#   マイグレーション（kosu/migrations/ にある、DB構造の変更履歴ファイル）を順に適用する代わりに、
#   現在の models.py の定義から直接テーブルを作らせることで、テスト準備を速くする。
#   下の MIGRATION_MODULES に設定しているため、このファイルを使うテストでは常に有効。
# ------------------------------------------------------------
class DisableMigrations:  
    # 「アプリ名 in MIGRATION_MODULES」の判定に対し、どのアプリでも True（設定あり）を返す
    def __contains__(self, item):  
        return True  
    # 「MIGRATION_MODULES[アプリ名]」の取得に対し None（マイグレーションなし）を返す
    def __getitem__(self, item):  
        return None  
# 全アプリについて「マイグレーションなし」として扱わせる
MIGRATION_MODULES = DisableMigrations()
# テストでは呼び出し回数の制限をかけない（同じテストの中で何度もヘルプを呼ぶため）
#   制限そのもののテストは、test_security.py で上限を書き換えて確かめる
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {'help': None}}
# テストで作るバックアップの Excel は、毎回新しい一時フォルダに置く
#   （media/ に置くと、テストのたびに Excel が増え、リポジトリに入ってしまう）
import tempfile
MEDIA_ROOT = tempfile.mkdtemp(prefix='kosu-test-media-')