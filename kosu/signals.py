# ============================================================
# ファイル名 : signals.py
# 種別       : シグナル受信処理（Django signals）
# 概要       : 主要テーブルのデータが登録・更新・削除されたときに自動で呼ばれ、
#              操作履歴（History）に1件ずつ記録する。
#              記録内容は「操作種類・テーブル名・レコードID・操作者の従業員番号・変更内容」。
#              signal（シグナル）: モデルの保存・削除の前後に、登録しておいた関数を
#              Django が自動で呼び出す仕組み。各ビューに履歴記録の処理を書かずに済む。
#
# 主な関数:
#   - set_instance_cache / get_instance_cache : 更新前のデータを一時保存 / 取り出し
#   - get_changes                             : 更新前後を比べて変更内容（差分）を作る
#   - cache_old_〇〇_instance                 : 保存直前（pre_save）に更新前のデータを一時保存
#   - log_create_update_〇〇_history          : 保存直後（post_save）に登録/更新の履歴を記録
#   - log_delete_〇〇_history                 : 削除直後（post_delete）に削除の履歴を記録
#
# 記録対象   : member（人員）, Business_Time_graph（工数データ）, team_member（班員）,
#              kosu_division（工数区分定義）, def_choice（作業詳細選択肢）,
#              administrator_data（管理者設定）, inquiry_data（問い合わせ）
# 補足       : apps.py の KosuConfig.ready() でこのファイルが import されたときに
#              @receiver による登録が行われ、以下の受信処理が有効になる。
# 関連ファイル: models.py（History ほか）, apps.py,
#              middleware/clear_session_middleware.py（get_current_request）,
#              views/main_views.py（操作履歴一覧API AdministratorHistoryList）
# ============================================================

# ============================================================
# インポート
# ============================================================
from threading import local
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import History, member, Business_Time_graph, team_member, kosu_division, def_choice, administrator_data, inquiry_data
from .middleware.clear_session_middleware import get_current_request
from django.db import models



# ============================================================
# 更新前データの一時保存（スレッドローカル）
# ============================================================
# スレッドローカル変数を用意する
#   スレッドローカル: スレッド（同時に動く処理の流れ）ごとに別々の値を持てる変数。
#   複数のリクエストが同時に処理されても、他のリクエストの更新前データと混ざらないようにするため。
_thread_locals = local()

# 保存しようとしているレコードの「更新前のデータ」をDBから取得し、一時保存する。
#
# post_save（保存直後）の時点ではDBがすでに更新後の値になっているため、
# 更新前の値は pre_save（保存直前）のうちに取っておく必要がある。
#
# 引数:
#   instance: これから保存されるモデルのインスタンス（1レコード分のデータ）
# 戻り値:
#   なし（_thread_locals.instance_cache に更新前データ、または None を入れる）
def set_instance_cache(instance):
  # インスタンスのモデルクラス（member や Business_Time_graph など）を取得
  model = type(instance)
  try:
    # 同じ主キー（pk）のレコードをDBから取得し、更新前のデータとしてスレッドローカルに保存
    _thread_locals.instance_cache = model.objects.get(pk=instance.pk)
  except model.DoesNotExist:
    # DBにまだ無い（＝新規作成。pk が None）場合は、更新前データ無しとして None を保存
    _thread_locals.instance_cache = None



# 一時保存しておいた更新前のデータを取り出す。
#
# 引数:
#   なし
# 戻り値:
#   モデルインスタンス: set_instance_cache で保存した更新前データ
#                       まだ一度も保存していない場合・新規作成の場合は None
def get_instance_cache():
  # instance_cache 属性がまだ無い場合でもエラーにせず None を返す
  return getattr(_thread_locals, 'instance_cache', None)



# ============================================================
# 差分（変更内容）の作成
# ============================================================
# 保存されたデータの変更内容（差分）を、JSONとして保存できる辞書の形で作る。
#
# 新規作成時は全項目の値を、更新時は値が変わった項目だけを
# {'old': 更新前, 'new': 更新後} の形で記録する。
# 更新前の値は pre_save で一時保存したデータを使い、無い場合はDBから取得する。
#
# 引数:
#   instance: 保存されたモデルのインスタンス（1レコード分のデータ）
#   created : True なら新規作成、False なら更新（post_save から渡される値）
# 戻り値:
#   dict: 変更内容。例）新規: {'id': 5, 'name': '山田', 'shop': 'P', ...}
#                       更新: {'shop': {'old': 'P', 'new': 'R'}}
def get_changes(instance, created):
  # 項目名 → 変更内容 を入れる辞書
  changes = {}
  
  # pre_save で一時保存した更新前のデータを取得
  old_instance = get_instance_cache()

  # 一時保存されたデータが、今回のインスタンスと別のモデル・別のレコード（pk 違い）の場合は
  # 誤った比較を避けるため使わない（None にする）
  #   例: 人員を保存した後に班員を更新した場合、人員のデータが残っていることがある
  if old_instance and (not isinstance(old_instance, type(instance)) or old_instance.pk != instance.pk):
    old_instance = None

  # モデルの全フィールド（列）を1つずつ比較する
  #   _meta.fields: モデルに定義されたフィールドの一覧（id も含む）
  for field in instance._meta.fields:
    # フィールド名（例: 'employee_no', 'shop'）
    field_name = field.name
    
    # 保存後の値を取得（外部キーの場合は関連先のモデルインスタンスが返る）
    new_value = getattr(instance, field_name)

    # 新規作成時: 更新前の値は無いので、全項目を「変更あり」として扱う
    if created:
      old_value = None
      is_changed = True
    # 更新時: 更新前の値と比べて変わったかどうかを判定する
    else:
      # 一時保存した更新前データがある場合はそれと比較
      if old_instance:
        old_value = getattr(old_instance, field_name)
        is_changed = (old_value != new_value)
      else:
        # 一時保存データが無い場合（pre_save を登録していないモデル・別スレッドとの混同など）は
        # DBから直接取得して比較する
        #   ※post_save の時点ではDBはすでに更新後の値に書き換わっているため、
        #     ここで取得されるのは更新後の値となる
        try:
          old_db_instance = type(instance).objects.get(pk=instance.pk)
          old_value = getattr(old_db_instance, field_name)
          is_changed = (old_value != new_value)
          # 以降の処理（外部キーのID取得など）や次のフィールドの比較でも使えるよう、比較元として保持
          old_instance = old_db_instance
        # DBにレコードが無い場合は、この項目を記録せず次の項目へ
        except type(instance).DoesNotExist:
          continue

    # 新規作成、または値が変わった項目だけを記録する
    if is_changed:
        
      # 外部キー（ForeignKey。例: 工数データの name → 人員）の場合
      #   モデルインスタンスのままではJSONにできないため、ID列（attname。例: 'name_id'）の値を記録する
      if field.is_relation and field.many_to_one:
        # 更新前・更新後の関連先ID（更新前データが無ければ None）
        old_json_safe_value = getattr(old_instance, field.attname) if old_instance else None
        new_json_safe_value = getattr(instance, field.attname)
      
      # 文字列・数値・真偽値・None 以外（日付など）はそのままJSONにできないため変換する
      elif not isinstance(new_value, (str, int, float, bool, type(None))):
        # 値がモデルインスタンスの場合は、ID と表示用文字列（__str__ の結果）の組で記録
        if isinstance(new_value, models.Model):
          old_json_safe_value = {'id': old_value.pk, 'str': str(old_value)} if old_value else None
          new_json_safe_value = {'id': new_value.pk, 'str': str(new_value)}
        # Django のフィールド型（DateField / DateTimeField）の場合はISO形式（例: "2026-11-09"）の文字列にする
        #   ※値そのもの（datetime.date 等）はフィールド型ではないため、
        #     実際の日付の値はこの分岐には入らず、下の else で str() により文字列化される
        elif isinstance(new_value, (models.DateField, models.DateTimeField)):
          old_json_safe_value = old_value.isoformat() if old_value else None
          new_json_safe_value = new_value.isoformat()
        # その他の型は str() で文字列化（更新前の値が空なら None）
        else:
          old_json_safe_value = str(old_value) if old_value else None
          new_json_safe_value = str(new_value)
      
      # 文字列・数値・真偽値・None はそのままJSONにできるので変換しない
      else:
        old_json_safe_value = old_value
        new_json_safe_value = new_value

      # 変更内容を changes 辞書に記録する
      if created:
        # 新規作成時は新しい値のみ記録（例: 'shop': 'P'）
        changes[field_name] = new_json_safe_value
      else:
        # 更新時は更新前と更新後の値を組で記録（例: 'shop': {'old': 'P', 'new': 'R'}）
        changes[field_name] = {'old': old_json_safe_value, 'new': new_json_safe_value}

  return changes



# ============================================================
# 保存直前の処理（pre_save: 更新前データの一時保存）
# ============================================================
# 人員（member）の保存直前に、更新前のデータを一時保存する（pre_save）。
#
# pre_save: モデルの save() でDBに書き込む直前に Django が自動で呼ぶシグナル。
# ここで保存したデータを、保存直後の log_create_update_member_history が差分作成に使う。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（member）
#   instance: これから保存される人員データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし
@receiver(pre_save, sender=member)
def cache_old_member_instance(sender, instance, **kwargs):
  set_instance_cache(instance)



# 工数データ（Business_Time_graph）の保存直前に、更新前のデータを一時保存する（pre_save）。
#
# ここで保存したデータを、保存直後の log_create_update_business_time_graph_history が差分作成に使う。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（Business_Time_graph）
#   instance: これから保存される工数データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし
@receiver(pre_save, sender=Business_Time_graph)
def cache_old_business_time_graph_instance(sender, instance, **kwargs):
    set_instance_cache(instance)



# ============================================================
# 履歴記録（post_save: 登録・更新 / post_delete: 削除）
# ============================================================
# 人員（member）の登録・更新時に操作履歴を記録する（post_save）。
#
# post_save: モデルの save()（objects.create() も含む）が完了した直後に Django が自動で呼ぶシグナル。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（member）
#   instance: 保存された人員データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=member)
def log_create_update_member_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得（middleware がスレッドローカルに保存したもの）
  request = get_current_request()
  # セッションからログイン者の従業員番号（login_No）を取得
  #   リクエストが無い場合（別スレッドで動くバックアップ復元処理などから保存された場合）は None
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  #   table_name: 対象テーブル名 / record_id: 対象レコードのID / login_No: 操作者の従業員番号
  History.objects.create(
    operation=operation,
    table_name='member',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 人員（member）の削除時に操作履歴を記録する（post_delete）。
#
# post_delete: モデルの delete() が完了した直後に Django が自動で呼ぶシグナル。
# QuerySet の一括削除（filter(...).delete()）でも、削除された1件ごとに呼ばれる。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（member）
#   instance: 削除された人員データ（削除前の値を保持している）
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=member)
def log_delete_member_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='member',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 工数データ（Business_Time_graph）の登録・更新時に操作履歴を記録する（post_save）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（Business_Time_graph）
#   instance: 保存された工数データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=Business_Time_graph)
def log_create_update_business_time_graph_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='Business_Time_graph',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 工数データ（Business_Time_graph）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（Business_Time_graph）
#   instance: 削除された工数データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=Business_Time_graph)
def log_delete_business_time_graph_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='Business_Time_graph',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 班員（team_member）の登録・更新時に操作履歴を記録する（post_save）。
#
# ※班員には pre_save の一時保存処理が無いため、更新時の比較元は get_changes 内でDBから取得される。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（team_member）
#   instance: 保存された班員データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=team_member)
def log_create_update_team_member_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='team_member',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 班員（team_member）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（team_member）
#   instance: 削除された班員データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=team_member)
def log_delete_team_member_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='team_member',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 工数区分定義（kosu_division）の登録・更新時に操作履歴を記録する（post_save）。
#
# ※工数区分定義には pre_save の一時保存処理が無いため、更新時の比較元は get_changes 内でDBから取得される。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（kosu_division）
#   instance: 保存された工数区分定義データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=kosu_division)
def log_create_update_kosu_division_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='kosu_division',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 工数区分定義（kosu_division）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（kosu_division）
#   instance: 削除された工数区分定義データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=kosu_division)
def log_delete_kosu_division_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='kosu_division',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 作業詳細選択肢（def_choice）の登録・更新時に操作履歴を記録する（post_save）。
#
# ※作業詳細選択肢には pre_save の一時保存処理が無いため、更新時の比較元は get_changes 内でDBから取得される。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（def_choice）
#   instance: 保存された作業詳細選択肢データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=def_choice)
def log_create_update_def_choice_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='def_choice',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 作業詳細選択肢（def_choice）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（def_choice）
#   instance: 削除された作業詳細選択肢データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=def_choice)
def log_delete_def_choice_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='def_choice',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 管理者設定（administrator_data）の登録・更新時に操作履歴を記録する（post_save）。
#
# ※管理者設定には pre_save の一時保存処理が無いため、更新時の比較元は get_changes 内でDBから取得される。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（administrator_data）
#   instance: 保存された管理者設定データ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=administrator_data)
def log_create_update_administrator_data_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='administrator_data',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 管理者設定（administrator_data）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（administrator_data）
#   instance: 削除された管理者設定データ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=administrator_data)
def log_delete_administrator_data_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='administrator_data',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 問い合わせ（inquiry_data）の登録・更新時に操作履歴を記録する（post_save）。
#
# ※問い合わせには pre_save の一時保存処理が無いため、更新時の比較元は get_changes 内でDBから取得される。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（inquiry_data）
#   instance: 保存された問い合わせデータ
#   created : True なら新規作成、False なら更新
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_save, sender=inquiry_data)
def log_create_update_inquiry_data_history(sender, instance, created, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 更新前後の差分（変更内容）を作成
  changes = get_changes(instance, created)

  # 操作種類を決める: 新規作成なら 'CREATE'、更新なら 'UPDATE'
  operation = 'CREATE' if created else 'UPDATE'

  # 操作履歴を1件登録する
  History.objects.create(
    operation=operation,
    table_name='inquiry_data',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 問い合わせ（inquiry_data）の削除時に操作履歴を記録する（post_delete）。
#
# 引数:
#   sender  : シグナルの送信元モデルクラス（inquiry_data）
#   instance: 削除された問い合わせデータ
#   kwargs  : Django が渡すその他の情報（未使用）
# 戻り値:
#   なし（History に1件追加する）
@receiver(post_delete, sender=inquiry_data)
def log_delete_inquiry_data_history(sender, instance, **kwargs):
  # 現在処理中のHTTPリクエストを取得し、ログイン者の従業員番号を取り出す（リクエストが無ければ None）
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 操作履歴を1件登録する（削除時は変更内容 changes を記録しない）
  History.objects.create(
    operation='DELETE',
    table_name='inquiry_data',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )




