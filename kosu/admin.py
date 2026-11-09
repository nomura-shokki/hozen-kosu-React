# ============================================================
# ファイル名 : admin.py
# 種別       : Django 管理サイト設定ファイル
# 概要       : Django 標準の管理サイト（/admin/）で、どのモデル（データの種類）を
#              閲覧・編集できるようにするかを登録する。
#              管理サイトはブラウザからデータベースの中身を直接確認・修正できる開発者向けの画面で、
#              React の画面（管理者MENU など）とは別物。
#
# 主なクラス:
#   - InquiryAdmin   : 問い合わせ（inquiry_data）の管理画面設定（作成・更新日時を読み取り専用にする）
#   - AsyncTaskAdmin : 非同期タスク（AsyncTask）の管理画面設定（作成・更新日時を読み取り専用にする）
#   - HistoryAdmin   : 操作履歴（History）の管理画面設定（記録日時を読み取り専用にする）
#
# 補足       : models.py の Operation_history は登録されていないため、管理サイトには表示されない。
# 関連ファイル: models.py, hozen_another/urls.py（admin/ のURL設定）
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.contrib import admin
from .models import member
from .models import Business_Time_graph
from .models import team_member
from .models import kosu_division
from .models import def_choice
from .models import administrator_data
from .models import inquiry_data
from .models import AsyncTask
from .models import History



# ============================================================
# 管理サイトへのモデル登録
# ============================================================

# 特別な表示設定が不要なモデルは、標準の管理画面のまま登録する
admin.site.register(member)  # 人員
admin.site.register(Business_Time_graph)  # 工数データ（1日1人分の作業時間記録）
admin.site.register(team_member)  # 班員
admin.site.register(kosu_division)  # 工数区分定義
admin.site.register(def_choice)  # 作業詳細選択肢
admin.site.register(administrator_data)  # 管理者設定

# ------------------------------------------------------------
# InquiryAdmin: 問い合わせ（inquiry_data）の管理画面設定
#   readonly_fields : 編集画面で表示のみ（変更不可）にする項目
#                     作成日時・更新日時は自動で記録される値のため、手で変えられないようにする
# ------------------------------------------------------------
class InquiryAdmin(admin.ModelAdmin):
  readonly_fields = ('created_at', 'updated_at')

# 問い合わせを上記の設定付きで登録する
admin.site.register(inquiry_data, InquiryAdmin)


# ------------------------------------------------------------
# AsyncTaskAdmin: 非同期タスク（AsyncTask）の管理画面設定
#   readonly_fields : 作成日時・更新日時を表示のみ（変更不可）にする
# ------------------------------------------------------------
class AsyncTaskAdmin(admin.ModelAdmin):
  readonly_fields = ('created_at', 'updated_at')

# 非同期タスクを上記の設定付きで登録する
admin.site.register(AsyncTask, AsyncTaskAdmin)


# ------------------------------------------------------------
# HistoryAdmin: 操作履歴（History）の管理画面設定
#   readonly_fields : 記録日時（timestamp）を表示のみ（変更不可）にする
#                     ※('timestamp',) の末尾のカンマは「要素1つのタプル」を表すために必要
# ------------------------------------------------------------
class HistoryAdmin(admin.ModelAdmin):
  readonly_fields = ('timestamp',)

# 操作履歴を上記の設定付きで登録する
admin.site.register(History, HistoryAdmin)

