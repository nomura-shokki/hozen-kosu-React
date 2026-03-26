import os
import threading
import uuid
import datetime
import time
import tempfile
from ..tasks import generate_kosu_backup, delete_kosu_data, load_kosu_file, \
                    generate_member_backup, load_member_file, generate_team_backup, load_team_file, \
                    generate_def_backup, load_def_file, generate_choice_backup, load_choice_file, \
                    generate_inquiry_backup, load_inquiry_file, generate_setting_backup, load_setting_file, \
                    generate_AsyncTask_backup, delete_AsyncTask_data, generate_History_backup ,delete_History_data
from ..models import AsyncTask
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, JSONParser, FormParser
from django.urls import resolve
from django.http import JsonResponse, FileResponse



@api_view(['POST'])
@parser_classes([MultiPartParser, JSONParser, FormParser])
def backup(request):
  # タスクID生成
  task_id = str(uuid.uuid4())
  AsyncTask.objects.create(task_id=task_id, status='pending')

  start_day = request.data.get('start_day')
  end_day = request.data.get('end_day')

  # url_name属性取得
  current_path = request.path
  match = resolve(current_path)
  url_name = match.url_name

  if url_name == 'kosu_backup':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = generate_kosu_backup
    args = (start_day, end_day)
  elif url_name == 'kosu_delet':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = delete_kosu_data
    args = (start_day, end_day)
  elif url_name == 'kosu_load':
    kosu_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in kosu_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_kosu_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'def_backup':
    task_function = generate_def_backup
    args = ()
  elif url_name == 'def_load':
    def_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in def_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_def_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'choice_backup':
    task_function = generate_choice_backup
    args = ()
  elif url_name == 'choice_load':
    choice_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in choice_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_choice_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'member_backup':
    task_function = generate_member_backup
    args = ()
  elif url_name == 'member_load':
    member_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in member_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_member_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'team_backup':
    task_function = generate_team_backup
    args = ()
  elif url_name == 'team_load':
    team_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in team_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_team_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'inquiry_backup':
    task_function = generate_inquiry_backup
    args = ()
  elif url_name == 'inquiry_load':
    inquiry_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in inquiry_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_inquiry_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'setting_backup':
    task_function = generate_setting_backup
    args = ()
  elif url_name == 'setting_load':
    setting_file = request.FILES.get('file')
    temp_file_path = None
    try:
      with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp_file:
        for chunk in setting_file.chunks():
          temp_file.write(chunk)
        temp_file_path = temp_file.name
      task_function = load_setting_file
      args = (temp_file_path,)
    except Exception as e:
      if temp_file_path and os.path.exists(temp_file_path):
        os.remove(temp_file_path)
      return JsonResponse({'status': 'error', 'message': f'ファイル書き込みエラー: {str(e)}'}, status=500)
  elif url_name == 'AsyncTask_backup':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = generate_AsyncTask_backup
    args = (start_day, end_day)
  elif url_name == 'AsyncTask_delet':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = delete_AsyncTask_data
    args = (start_day, end_day)
  elif url_name == 'History_backup':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = generate_History_backup
    args = (start_day, end_day)
  elif url_name == 'History_delet':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = delete_History_data
    args = (start_day, end_day)
  else:
    return JsonResponse({'status': 'error', 'message': '無効なタスクタイプです。'}, status=status.HTTP_400_BAD_REQUEST)

  thread = threading.Thread(target=handle_task, args=(task_id, task_function, *args))
  thread.start()

  # タスクIDを返却し、非同期処理開始を通知
  return JsonResponse({'status': 'success', 'task_id': task_id})



# 日付バリデーション関数
def validate_dates(start_day, end_day):
  today_str = datetime.date.today().strftime('%Y-%m-%d')
  if not start_day or not end_day:
    return JsonResponse({'status': 'error', 'message': '日付を指定してください。'}, status=status.HTTP_400_BAD_REQUEST)

  try:
    end_date_obj = datetime.date.fromisoformat(end_day)
    today_date_obj = datetime.date.fromisoformat(today_str)
    start_date_obj = datetime.date.fromisoformat(start_day)
  except ValueError:
    return JsonResponse({'status': 'error', 'message': '日付の形式が不正です。'}, status=status.HTTP_400_BAD_REQUEST)
  if end_date_obj >= today_date_obj:
    return JsonResponse({'status': 'error', 'message': '昨日の日付までしか指定できません。'}, status=status.HTTP_400_BAD_REQUEST)
  if start_date_obj > end_date_obj:
    return JsonResponse({'status': 'error', 'message': '開始日が終了日を超えています。'}, status=status.HTTP_400_BAD_REQUEST)
  return None



@api_view(['GET'])
def check_task_status(request):
  task_id = request.GET.get('task_id')

  # タスクIDがない場合、エラーを返す
  if not task_id:
    return JsonResponse({'status': 'error', 'message': 'タスクIDが指定されていません。'}, status=status.HTTP_400_BAD_REQUEST)

  try:
    # データベースからタスクIDに対応する状態を取得し返す
    task = AsyncTask.objects.get(task_id=task_id)
    if task.status == 'success':
      return JsonResponse({'status': 'success', 'file_path': task.result})
    elif task.status == 'error':
      return JsonResponse({'status': 'error', 'message': task.result})
    else:
      return JsonResponse({'status': 'pending'}, status=202)

  except AsyncTask.DoesNotExist:
    return JsonResponse({'status': 'error', 'message': '無効なタスクIDです。'}, status=status.HTTP_400_BAD_REQUEST)



@api_view(['GET'])
def download_file(request):
  file_path = request.GET.get('file_path')
  file_handle = open(file_path, 'rb')
  response = FileResponse(file_handle, as_attachment=True, filename=os.path.basename(file_path))

  def delayed_file_cleanup():
      time.sleep(3) 
      if os.path.exists(file_path):
        try:
          os.remove(file_path)
        except Exception as e:
          print(f"Cleanup failed after delay for {file_path}: {e}")


  def cleanup_on_close():
      thread = threading.Thread(target=delayed_file_cleanup)
      thread.start()

  response.close = cleanup_on_close 

  return response



# 非同期タスク処理 (汎用版)
def handle_task(task_id, task_function, *args, **kwargs):
  try:
    # タスク関数を実行し、結果を取得
    result = task_function(*args, **kwargs)
    is_explicit_error = (
      isinstance(result, tuple) and 
      len(result) > 0 and 
      isinstance(result[0], dict) and 
      result[0].get('status') == 'error'
    )
    
    task = AsyncTask.objects.get(task_id=task_id)

    if is_explicit_error:
      # エラーを返した場合
      error_dict = result[0]
      task.status = 'error'
      task.result = error_dict.get('message', 'タスク関数が明示的なエラーを返しました。')
    else:
      # 正常終了の場合
      task.status = 'success'
      task.result = result
      
    # データベースに保存
    task.save()
    
  except Exception as e:
    # 処理中に予期せぬエラーが発生した場合
    try:
      task = AsyncTask.objects.get(task_id=task_id)
      task.status = 'error'
      task.result = str(e)
      task.save()
    except AsyncTask.DoesNotExist:
      print(f"Error: AsyncTask with id {task_id} not found.")