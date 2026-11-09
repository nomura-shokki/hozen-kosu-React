# ============================================================
# ファイル名 : apps.py
# 種別       : Django アプリ設定ファイル
# 概要       : Django アプリ「kosu」（工数管理システム本体）の基本設定を定義する。
#              Django は起動時に settings.py の INSTALLED_APPS に書かれた 'kosu' を見て、
#              このファイルの KosuConfig を自動で読み込む。
#
# 主なクラス:
#   - KosuConfig : kosu アプリの設定。起動完了時に signals.py（操作履歴の自動記録）を有効化する
#
# 関連ファイル: signals.py（データ変更時に操作履歴 History を記録する処理）, hozen_another/settings.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.apps import AppConfig


# ------------------------------------------------------------
# KosuConfig: kosu アプリの設定クラス
#   default_auto_field : 主キー（id）を自動で作る場合の型
#   name               : アプリ名（フォルダ名と同じ 'kosu'）
#   ready()            : Django の起動準備が整ったときに1回だけ呼ばれる
# ------------------------------------------------------------
class KosuConfig(AppConfig):
    # モデルに主キーを書かなかった場合、自動で作られる id 列を BigAutoField（大きな整数の連番）にする
    default_auto_field = 'django.db.models.BigAutoField'
    # このアプリの名前（INSTALLED_APPS の 'kosu' と対応する）
    name = 'kosu'

    # Django の起動準備（全モデルの読み込み）が完了した直後に呼ばれる処理。
    #
    # signals.py を import（読み込み）するだけで、その中の @receiver で登録した
    # 「データ保存・削除時に操作履歴（History）を記録する処理」が有効になる。
    # signals.py は models.py を import しているため、モデルの準備が終わる前に読むとエラーになる。
    # そのため、準備完了後に呼ばれるこの ready() の中で読み込む（Django の推奨する書き方）。
    #
    # 引数:
    #   なし
    # 戻り値:
    #   なし
    def ready(self):
        # 読み込むこと自体が目的（変数としては使わない）。シグナル受信処理を登録する
        import kosu.signals 
