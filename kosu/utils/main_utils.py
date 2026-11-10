# ============================================================
# ファイル名 : main_utils.py
# 種別       : ユーティリティ（複数の画面で共通に使う部品）
# 概要       : 一覧APIのページネーション（ページ分け）、従業員番号の入力チェック、
#              アプリ内のモデル名一覧の取得をまとめたファイル。
#
# 主なクラス / 関数:
#   - CustomPagination             : 管理者設定の「一覧表示項目数」でページ分けするクラス
#                                    （kosu_views / member_views / team_views / def_views /
#                                      inquiry_views / main_views の一覧APIで使用）
#   - validate_employee_no_logic   : 従業員番号の入力チェック（現在は tests/test_backend.py からのみ使用）
#   - get_all_model_names_in_myapp : kosu アプリのモデル名一覧を返す
#                                    （main_views.py の操作履歴一覧で、テーブル名の絞り込み候補に使用）
#
# 関連ファイル: models.py（administrator_data / 各モデル）, views/ 配下の各ビュー
# ============================================================

# ============================================================
# インポート
# ============================================================
# inspect: モジュール内のクラスなどを調べるための Python 標準ライブラリ
import inspect
import datetime
# DRF 標準のページ番号方式ページネーション（?page=2 のようにページを指定する方式）
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
# Django のモデル基底クラス（models.Model）を判定に使う
from django.db import models
# kosu アプリの models.py をモジュールごと読み込む（モデル名一覧の取得用）
from kosu import models as myapp_models
# 管理者設定（一覧表示項目数を読み出すため）
from ..models import administrator_data



# ============================================================
# ページネーション
# ============================================================

# ------------------------------------------------------------
# CustomPagination: 一覧API共通のページネーションクラス
#   ページネーション（pagination）とは、大量のデータを一定件数ずつに区切って
#   1ページ分だけ返す仕組みのこと。
#   1ページの件数は管理者設定の「一覧表示項目数」(menu_row) を使う。
#   ページ番号はクエリパラメータ page（例: /api/member_list/?page=2）で指定する。
# ------------------------------------------------------------
class CustomPagination(PageNumberPagination):
  page_size = 20  # 1ページの件数の初期値（管理者設定が1件も無い場合にこの値を使う）

  # インスタンス生成時に、1ページの件数を管理者設定から読み込む。
  #
  # 管理者画面で件数を変更したらすぐ反映されるよう、クラス定義時ではなく
  # 一覧APIが呼ばれて CustomPagination() が作られるたびにデータベースから読む。
  #
  # 引数:
  #   なし
  # 戻り値:
  #   なし（self.page_size を上書きする）
  def __init__(self):
    # administrator_data から動的にページサイズを設定
    #   ID順に並べた最後の1件（＝最も新しく登録された管理者設定）を取得
    last_record = administrator_data.objects.order_by("id").last()
    # 管理者設定が存在する場合のみ「一覧表示項目数」で上書きする
    #   ※menu_row は文字列項目（CharField）のため、ここでは "20" のような文字列が入る。
    #     Django の Paginator が内部で int() に変換するのでページ分け自体は正しく動く
    if last_record is not None:
      self.page_size = last_record.menu_row

  # ページ分けした結果をレスポンス（JSON）の形にまとめて返す。
  #
  # DRF 標準のレスポンス（count / next / previous / results）の代わりに、
  # フロント側の各一覧画面（KosuList.tsx など）で総ページ数（count ÷ page_size）を
  # 計算できるよう、1ページの件数（page_size）を含めた独自の形で返す。
  #
  # 引数:
  #   data: シリアライズ済みの、現在ページ分のデータ（辞書のリスト）
  # 戻り値:
  #   Response: {'count': 全件数, 'page_size': 1ページの件数, 'results': 現在ページのデータ}
  def get_paginated_response(self, data):
    return Response({
      'count': self.page.paginator.count,  # 合計件数（絞り込み後の全ページ分の件数）
      'page_size': self.page_size,  # ページサイズをレスポンスに含める（フロント側で総ページ数の計算に使う。管理者設定から読んだ場合は文字列）
      'results': data,  # 現在のページのデータ
    })



# ============================================================
# 入力チェック
# ============================================================

# 従業員番号として入力された値が正しいかをチェックする。
#
# 空欄は許可し、入力がある場合は「自然数（1以上の整数）であること」と
# 「その従業員番号の人員が登録済みであること」を順に確認する。
# エラーメッセージは「は自然数で入力して下さい」のように助詞から始まる形で返すため、
# 呼び出し側で項目名（例: "班員1"）の後ろにつなげて使う想定。
#
# 引数:
#   value       : チェックする値（文字列または数値。空欄の場合は None や ''）
#   member_model: 人員モデル（member）。存在確認の検索に使う
# 戻り値:
#   (True, None)         : 空欄（チェック不要としてOK）
#   (True, 従業員番号int): チェックOK。整数に変換した従業員番号を返す
#   (False, メッセージ)  : チェックNG。項目名の後ろにつなげるエラーメッセージ
def validate_employee_no_logic(value, member_model):
  # 1. 空欄チェック: 値が存在しない、または空文字列の場合は空欄を許可する
  if not value:
    return True, None
  
  # 2. 整数変換チェック
  try:
    value_int = int(value)
  except ValueError:
    # intに変換できなかった場合 (例: 'abc'などの文字列)
    return False, 'は自然数で入力して下さい'

  # 3. 自然数チェック (1以上の整数)
  #    0 やマイナスの値は従業員番号として不正なのでNGにする
  if value_int <= 0:
    return False, 'は自然数で入力して下さい'
  
  # 4. 従業員番号の存在チェック
  #    人員データに同じ従業員番号の人がいればOK、いなければ DoesNotExist 例外でNG
  try:
    member_model.objects.get(employee_no=value_int)
    return True, value_int # バリデーション成功
  # 該当する人員がいない場合は例外を握りつぶし、エラーメッセージを返す
  except member_model.DoesNotExist:
    return False, 'に入力された従業員番号の人員は存在しません'





# ============================================================
# モデル情報の取得
# ============================================================

# kosu アプリの models.py で定義されているモデルのクラス名一覧を返す。
#
# 操作履歴一覧（main_views.py の AdministratorHistoryList）で、
# 「テーブル名」による絞り込みの選択肢として使われる。
# 抽象モデル・プロキシモデル・他モジュールから import しただけのクラスは除外する。
#
# 引数:
#   なし
# 戻り値:
#   list[str]: モデルのクラス名のリスト（例: ['AsyncTask', 'Business_Time_graph', 'History', ...]）
#              inspect.getmembers の仕様により名前のアルファベット順に並ぶ
def get_all_model_names_in_myapp():
  # 結果を入れるリスト
  model_names = []
  
  # myapp_modelsモジュールのメンバーを全て取得
  #   name: 変数名・クラス名、obj: その実体（クラス・関数・モジュールなど）
  for name, obj in inspect.getmembers(myapp_models):
    # 次の条件をすべて満たすものだけを「このアプリのモデル」として採用する
    #   - クラスであり、Django のモデル（models.Model）を継承している
    #   - 抽象モデル（abstract: テーブルを持たない継承専用のモデル）ではない
    #   - プロキシモデル（proxy: 既存テーブルを別名で扱うモデル）ではない
    #   - models.py 自身で定義されている（import してきた外部のモデルは除外）
    if (inspect.isclass(obj) and 
      issubclass(obj, models.Model) and 
      not obj._meta.abstract and 
      not obj._meta.proxy and
      obj.__module__ == myapp_models.__name__):
      model_names.append(name)

  return model_names





# 管理者設定（administrator_data）を1件返す。
#
# 設定は1件だけを使う決まり。最新（IDが最大）の1件を返し、1件も無ければ初期値（一覧表示項目数 20）で作ってから返す。
#   ※ .last() は「無い」時に例外ではなく None を返すので、try / except administrator_data.DoesNotExist では防げない
#
# 戻り値:
#   administrator_data: 管理者設定
def get_settings():
  admin_data = administrator_data.objects.order_by("id").last()
  if admin_data is None:
    admin_data = administrator_data.objects.create(menu_row='20')
  return admin_data





# 画面から届いた UTC の日時の文字列（例: "2026-11-08T23:30:00.000Z"）を、日本時間の "HH:MM" にする。
#
# 引数:
#   value: 日時の文字列（届いていない場合は None）
# 戻り値:
#   str: 日本時間の "HH:MM"（例: "08:30"）
# 例外:
#   ValueError: 届いていない・形が違う場合（呼ぶ側で捕まえて 400 を返す）
def utc_to_jst_hhmm(value):
  if not isinstance(value, str):
    raise ValueError('時刻がありません')
  utc_time = datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
  return utc_time.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime("%H:%M")





# 画面から届いた年・月を確かめて、数値の (年, 月) にする。
#
# 引数:
#   data: request.data（year・month を持つ）
# 戻り値:
#   (int, int): (年, 月)
# 例外:
#   ValueError: 数字でない・月が 1〜12 でない場合（呼ぶ側で捕まえて 400 を返す）
def parse_year_month(data):
  try:
    year, month = int(data.get('year')), int(data.get('month'))
  except (TypeError, ValueError):
    raise ValueError('年・月が数字ではありません')
  if not (2000 <= year <= 2100 and 1 <= month <= 12):
    raise ValueError('年・月の範囲が正しくありません')
  return year, month
