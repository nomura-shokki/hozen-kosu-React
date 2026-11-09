# ============================================================
# ファイル名 : __init__.py（kosu/views/ フォルダ）
# 種別       : パッケージ初期化ファイル（中身は空）
# 概要       : このフォルダ（kosu/views/）を Python の「パッケージ」として認識させるための空ファイル。
#              パッケージとは、複数の .py ファイルをフォルダ単位でひとまとめにしたもの。
#              このファイルがあることで、urls.py から
#              「from .views import kosu_views」のようにフォルダ名を使って各APIビューを import（読み込み）できる。
#
# 補足       : views/ には機能ごとのAPIビュー（main_views / kosu_views / member_views / team_views /
#              def_views / inquiry_views / asynchronous_views）とシリアライザ（serializers.py）が入っている。
#              コードを書く必要はないため、空のまま残しておくこと（削除しない）。
# 関連ファイル: kosu/urls.py（各ビューとURLの対応表）
# ============================================================