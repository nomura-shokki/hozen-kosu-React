from threading import local
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import History, member, Business_Time_graph, team_member, kosu_division, administrator_data, inquiry_data
from .middleware.clear_session_middleware import get_current_request

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
  # 新規作成時は全データ取得
  if created:
    return {field.name: getattr(instance, field.name) for field in instance._meta.fields}

  # 更新時は更新前と比較し差分を取得
  old_instance = get_instance_cache()
  changes = {}

  # キャッシュが存在する場合のみ処理
  if old_instance:
    for field in instance._meta.fields:
      field_name = field.name
      old_value = getattr(old_instance, field_name)
      new_value = getattr(instance, field_name)

      # 差分があるフィールドのみ記録
      if old_value != new_value:
        changes[field_name] = {'old': old_value, 'new': new_value}

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




