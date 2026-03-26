from threading import local
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import History, member, Business_Time_graph, team_member, kosu_division, def_choice, administrator_data, inquiry_data
from .middleware.clear_session_middleware import get_current_request
from django.db import models



# スレッドローカル変数初期化
_thread_locals = local()

# 更新前の値をスレッドローカルキャッシュに保存
def set_instance_cache(instance):
  model = type(instance)
  try:
    # 更新前の値取得→スレッドローカルキャッシュに保存
    _thread_locals.instance_cache = model.objects.get(pk=instance.pk)
  except model.DoesNotExist:
    # レコードなしの場合はNone取得
    _thread_locals.instance_cache = None



# スレッドローカルキャッシュから更新前の値取得
def get_instance_cache():
  return getattr(_thread_locals, 'instance_cache', None)



# 値の差分取得
def get_changes(instance, created):
  changes = {}
  
  # 1. キャッシュを取得
  old_instance = get_instance_cache()

  # 【修正】キャッシュが存在しても、現在のインスタンスと型やPKが違う場合は、誤った比較を避けるためNoneにする
  if old_instance and (not isinstance(old_instance, type(instance)) or old_instance.pk != instance.pk):
    old_instance = None

  # モデルの全フィールド処理
  for field in instance._meta.fields:
    field_name = field.name
    
    # 値取得
    new_value = getattr(instance, field_name)

    # 新規作成時、全て変更として処理
    if created:
      old_value = None
      is_changed = True
    # 更新時、差分取得
    else:
      if old_instance:
        old_value = getattr(old_instance, field_name)
        is_changed = (old_value != new_value)
      else:
        # 【修正】pre_saveでのキャッシュ漏れやスレッドの混同対策としてDBから直接取得を試みる
        try:
          old_db_instance = type(instance).objects.get(pk=instance.pk)
          old_value = getattr(old_db_instance, field_name)
          is_changed = (old_value != new_value)
          # 以降の処理（Relation等）で使うためキャッシュを一時的に更新
          old_instance = old_db_instance
        except type(instance).DoesNotExist:
          continue

    # 変更or新規作成
    if is_changed:
        
      # JSON化できないリレーションフィールド処理
      if field.is_relation and field.many_to_one:
        # 関連ID取得
        old_json_safe_value = getattr(old_instance, field.attname) if old_instance else None
        new_json_safe_value = getattr(instance, field.attname)
      
      # その他オブジェクト処理
      elif not isinstance(new_value, (str, int, float, bool, type(None))):
        # インスタンスが直接フィールドに格納されている場合、IDと文字列表現記録
        if isinstance(new_value, models.Model):
          old_json_safe_value = {'id': old_value.pk, 'str': str(old_value)} if old_value else None
          new_json_safe_value = {'id': new_value.pk, 'str': str(new_value)}
        # Datetimeの場合の処理
        elif isinstance(new_value, (models.DateField, models.DateTimeField)):
          old_json_safe_value = old_value.isoformat() if old_value else None
          new_json_safe_value = new_value.isoformat()
        # その他は文字列化
        else:
          old_json_safe_value = str(old_value) if old_value else None
          new_json_safe_value = str(new_value)
      
      # JSON化可能な基本データ型の処理
      else:
        old_json_safe_value = old_value
        new_json_safe_value = new_value

      # 6. changes辞書に記録
      if created:
        # 新規作成時は新しい値のみ記録
        changes[field_name] = new_json_safe_value
      else:
        # 更新時は古い値と新しい値を記録
        changes[field_name] = {'old': old_json_safe_value, 'new': new_json_safe_value}

  return changes



# 保存前に更新前の値をキャッシュ
@receiver(pre_save, sender=member)
def cache_old_member_instance(sender, instance, **kwargs):
  set_instance_cache(instance)



@receiver(pre_save, sender=Business_Time_graph)
def cache_old_business_time_graph_instance(sender, instance, **kwargs):
    set_instance_cache(instance)



# 履歴を記録　新規作成、更新 (member)
@receiver(post_save, sender=member)
def log_create_update_member_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='member',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (member)
@receiver(post_delete, sender=member)
def log_delete_member_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='member',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (Business_Time_graph)
@receiver(post_save, sender=Business_Time_graph)
def log_create_update_business_time_graph_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='Business_Time_graph',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (Business_Time_graph)
@receiver(post_delete, sender=Business_Time_graph)
def log_delete_business_time_graph_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='Business_Time_graph',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (team_member)
@receiver(post_save, sender=team_member)
def log_create_update_team_member_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='team_member',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (team_member)
@receiver(post_delete, sender=team_member)
def log_delete_team_member_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='team_member',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (kosu_division)
@receiver(post_save, sender=kosu_division)
def log_create_update_kosu_division_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='kosu_division',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (kosu_division)
@receiver(post_delete, sender=kosu_division)
def log_delete_kosu_division_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='kosu_division',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (def_choice)
@receiver(post_save, sender=def_choice)
def log_create_update_def_choice_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='def_choice',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (def_choice)
@receiver(post_delete, sender=def_choice)
def log_delete_def_choice_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='def_choice',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (administrator_data)
@receiver(post_save, sender=administrator_data)
def log_create_update_administrator_data_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='administrator_data',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (administrator_data)
@receiver(post_delete, sender=administrator_data)
def log_delete_administrator_data_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='administrator_data',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )



# 履歴を記録　新規作成、更新 (inquiry_data)
@receiver(post_save, sender=inquiry_data)
def log_create_update_inquiry_data_history(sender, instance, created, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 差分計算
  changes = get_changes(instance, created)

  # 操作内容判定
  operation = 'CREATE' if created else 'UPDATE'

  # 履歴記録
  History.objects.create(
    operation=operation,
    table_name='inquiry_data',
    record_id=instance.id,
    login_No=session_data,
    changes=changes,
  )



# 履歴を記録　削除 (inquiry_data)
@receiver(post_delete, sender=inquiry_data)
def log_delete_inquiry_data_history(sender, instance, **kwargs):
  request = get_current_request()
  session_data = request.session.get('login_No') if request else None

  # 履歴記録
  History.objects.create(
    operation='DELETE',
    table_name='inquiry_data',
    record_id=instance.id,
    login_No=session_data,
    changes=None,
  )




