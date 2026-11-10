# ============================================================
# ファイル名 : serializers.py
# 種別       : シリアライザ定義（Django REST Framework）
# 概要       : 各モデルのデータを JSON に変換する／JSON から入力チェックして
#              モデルに保存するための「変換ルール」をまとめたファイル。
#              シリアライザ（Serializer）とは、Python のモデルデータと
#              画面とやり取りする JSON を相互に変換する DRF の部品のこと。
#
# 主なクラス:
#   - MemberSerializer        : 人員（member）
#   - DefSerializer           : 工数区分定義（kosu_division）
#   - DefChoiceSerializer     : 作業詳細の選択肢（def_choice）
#   - KosuSerializer          : 工数データ（Business_Time_graph）
#   - TeamSerializer          : 班員（team_member）
#   - InquirSerializer        : 問い合わせ（inquiry_data）
#   - AdministratorSerializer : 管理者設定（administrator_data）
#   - TaskSerializer          : 非同期タスク（AsyncTask）
#   - HistorySerializer       : 操作履歴（History）
#
# 補足       : どのシリアライザも fields = '__all__'（モデルの全項目をそのまま
#              JSON に含める）で、独自の入力チェックや項目の加工は行っていない。
# 関連ファイル: models.py, views/ 配下の各ビュー（kosu_views.py, member_views.py など）
# ============================================================

# ============================================================
# インポート
# ============================================================
# DRF のシリアライザ基底クラス群
from rest_framework import serializers
# 変換対象のモデル（人員・工数データ・工数区分定義・作業詳細の選択肢・
# 班員・問い合わせ・管理者設定・非同期タスク・操作履歴）
from ..models import member, Business_Time_graph, kosu_division, def_choice, \
                      team_member, inquiry_data, administrator_data, AsyncTask, History



# ============================================================
# シリアライザ定義
#   すべて ModelSerializer（モデル定義から項目を自動で作るシリアライザ）を継承し、
#   内部クラス Meta で「どのモデルの」「どの項目を」扱うかだけを指定している。
# ============================================================

# ------------------------------------------------------------
# MemberSerializer: 人員（member）用シリアライザ
#   従業員番号・氏名・ショップ・権限・休憩時間（直ごと）などの全項目を扱う。
#   使用箇所: member_views.py（人員管理）, kosu_views.py（工数入力・休憩変更など）,
#             team_views.py, def_views.py, inquiry_views.py, main_views.py
# ------------------------------------------------------------
class MemberSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = member  # 対象モデル: 人員
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# DefSerializer: 工数区分定義（kosu_division）用シリアライザ
#   工数区分定義Ver名と、工数区分1〜50の名称・定義・作業内容・変動/固定を扱う。
#   使用箇所: def_views.py（定義管理）, kosu_views.py（工数入力・工数集計など）,
#             team_views.py, main_views.py
# ------------------------------------------------------------
class DefSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = kosu_division  # 対象モデル: 工数区分定義
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# DefChoiceSerializer: 作業詳細の選択肢（def_choice）用シリアライザ
#   工数区分の記号（定義記号）と、その区分で選べる作業詳細の文言を扱う。
#   使用箇所: def_views.py（作業詳細の管理）, kosu_views.py（工数入力・工数編集の選択肢）
# ------------------------------------------------------------
class DefChoiceSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = def_choice  # 対象モデル: 作業詳細の選択肢
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# KosuSerializer: 工数データ（Business_Time_graph）用シリアライザ
#   就業日・直・作業内容・作業詳細・残業時間・休憩時間・就業形態・
#   工数入力OK/NG判定など、1日1人分の工数データの全項目を扱う。
#   使用箇所: kosu_views.py（工数履歴・工数入力・工数編集・工数集計など）,
#             team_views.py, main_views.py
# ------------------------------------------------------------
class KosuSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = Business_Time_graph  # 対象モデル: 工数データ
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# TeamSerializer: 班員（team_member）用シリアライザ
#   班を管理する人の従業員番号と、班員1〜15の従業員番号・フォローON/OFFを扱う。
#   使用箇所: team_views.py（班員管理）
# ------------------------------------------------------------
class TeamSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = team_member  # 対象モデル: 班員
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# InquirSerializer: 問い合わせ（inquiry_data）用シリアライザ
#   問い合わせ者の従業員番号・内容区分（要望/不具合/問い合わせ）・本文・回答などを扱う。
#   使用箇所: inquiry_views.py（問い合わせ管理）
# ------------------------------------------------------------
class InquirSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = inquiry_data  # 対象モデル: 問い合わせ
    fields = '__all__'  # 全項目を対象にする
    # 問い合わせた人（従業員番号・氏名）は、編集の時に書き換えさせない（返すだけ）
    read_only_fields = ['employee_no2', 'name']


# ------------------------------------------------------------
# AdministratorSerializer: 管理者設定（administrator_data）用シリアライザ
#   一覧表示項目数・問い合わせ担当者・ポップアップ設定などを扱う。
#   使用箇所: main_views.py（管理者画面）
# ------------------------------------------------------------
class AdministratorSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = administrator_data  # 対象モデル: 管理者設定
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# TaskSerializer: 非同期タスク（AsyncTask）用シリアライザ
#   バックアップ/復元などのバックグラウンド処理のタスクID・状態・結果を扱う。
#   使用箇所: main_views.py（管理者画面のタスク一覧・詳細）
# ------------------------------------------------------------
class TaskSerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = AsyncTask  # 対象モデル: 非同期タスク
    fields = '__all__'  # 全項目を対象にする



# ------------------------------------------------------------
# HistorySerializer: 操作履歴（History）用シリアライザ
#   操作種別・テーブル名・レコードID・操作者・変更内容・日時を扱う。
#   使用箇所: main_views.py（管理者画面の操作履歴一覧・詳細）
# ------------------------------------------------------------
class HistorySerializer(serializers.ModelSerializer):
  # 変換対象のモデルと項目の指定
  class Meta:
    model = History  # 対象モデル: 操作履歴
    fields = '__all__'  # 全項目を対象にする