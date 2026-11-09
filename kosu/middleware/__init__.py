# ============================================================
# ファイル名 : __init__.py（kosu/middleware/ フォルダ）
# 種別       : パッケージ初期化ファイル（中身は空）
# 概要       : このフォルダ（kosu/middleware/）を Python の「パッケージ」として認識させるための空ファイル。
#              パッケージとは、複数の .py ファイルをフォルダ単位でひとまとめにしたもの。
#              このファイルがあることで、settings.py の MIDDLEWARE に
#              'kosu.middleware.clear_session_middleware.CurrentRequestMiddleware' のように
#              フォルダ名を「.」でつないだ名前で指定して読み込める。
#
# 補足       : コードを書く必要はないため、空のまま残しておくこと（削除しない）。
# 関連ファイル: middleware/clear_session_middleware.py, hozen_another/settings.py（MIDDLEWARE）
# ============================================================