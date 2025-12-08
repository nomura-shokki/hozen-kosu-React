from django.http import JsonResponse, FileResponse
import os
import threading
import uuid
from ..tasks import generate_kosu_backup, generate_prediction, delete_kosu_data, load_kosu_file, \
                    generate_member_backup, load_member_file, generate_team_backup, load_team_file, \
                    generate_def_backup, load_def_file, generate_inquiry_backup, load_inquiry_file, \
                    generate_setting_backup, load_setting_file, generate_AsyncTask_backup, \
                    delete_AsyncTask_data, generate_Operation_history_backup ,delete_Operation_history_data
from ..models import AsyncTask
from django.views.decorators.csrf import csrf_exempt





#--------------------------------------------------------------------------------------------------------





# 非同期タスク処理開始
@csrf_exempt
def start_task(request, task_type):
  # POST時の処理
  if request.method == 'POST':
    # 日付指定のあるタスク実行時の処理
    if task_type in ['kosu_backup', 'prediction', 'kosu_delete']:
      # 開始日と終了日取得
      data_day = request.POST.get('data_day')
      data_day2 = request.POST.get('data_day2')

      # 日付の範囲指定が正しくない場合エラー
      error_response = validate_dates(data_day, data_day2)
      if error_response:
        return error_response

    # タスクID生成
    task_id = str(uuid.uuid4())

    # 非同期処理のデータを登録（初期状態は "pending"）
    AsyncTask.objects.create(task_id=task_id, status='pending')

    # タスクの種類に応じた処理関数を選択
    if task_type == 'kosu_backup':
      task_function = generate_kosu_backup
      args = (data_day, data_day2)
    elif task_type == 'prediction':
      task_function = generate_prediction
      args = (data_day, data_day2)
    elif task_type == 'kosu_delete':
      task_function = delete_kosu_data
      args = (data_day, data_day2)
    elif task_type == 'kosu_load':
      kosu_file = request.FILES['kosu_file']
      task_function = load_kosu_file
      args = (kosu_file,)
    elif task_type == 'member_backup':
      task_function = generate_member_backup
      args = ()
    elif task_type == 'member_load':
      member_file = request.FILES['member_file']
      task_function = load_member_file
      args = (request, member_file)
    elif task_type == 'team_backup':
      task_function = generate_team_backup
      args = ()
    elif task_type == 'team_load':
      team_file = request.FILES['team_file']
      task_function = load_team_file
      args = (team_file,)
    elif task_type == 'def_backup':
      task_function = generate_def_backup
      args = ()
    elif task_type == 'def_load':
      def_file = request.FILES['def_file']
      task_function = load_def_file
      args = (def_file,)
    elif task_type == 'inquiry_backup':
      task_function = generate_inquiry_backup
      args = ()
    elif task_type == 'inquiry_load':
      inquiry_file = request.FILES['inquiry_file']
      task_function = load_inquiry_file
      args = (inquiry_file,)
    elif task_type == 'setting_backup':
      task_function = generate_setting_backup
      args = ()
    elif task_type == 'setting_load':
      setting_file = request.FILES['setting_file']
      task_function = load_setting_file
      args = (setting_file,)
    else:
      # 無効なタスクタイプであればエラーを返却
      return JsonResponse({'status': 'error', 'message': '無効なタスクタイプです。'}, status=400)

    # 非同期処理を実行するための新しいスレッド起動
    thread = threading.Thread(target=handle_task, args=(task_id, task_function, *args))
    thread.start()

    # タスクIDを返却し、非同期処理開始を通知
    return JsonResponse({'status': 'success', 'task_id': task_id})

  # POST以外はエラーを返却
  return JsonResponse({'status': 'error', 'message': '無効なリクエストです。'}, status=400)











from rest_framework.decorators import api_view
from django.urls import resolve
import datetime
import threading
import uuid
import time
from django.http import JsonResponse
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, JSONParser, FormParser
import tempfile
import os

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
  elif url_name == 'Operation_history_backup':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = generate_Operation_history_backup
    args = (start_day, end_day)
  elif url_name == 'Operation_history_delet':
    error_response = validate_dates(start_day, end_day)
    if error_response:
      return error_response
    task_function = delete_Operation_history_data
    args = (start_day, end_day)
  else:
    return JsonResponse({'status': 'error', 'message': '無効なタスクタイプです。'}, status=400)

  thread = threading.Thread(target=handle_task, args=(task_id, task_function, *args))
  thread.start()

  # タスクIDを返却し、非同期処理開始を通知
  return JsonResponse({'status': 'success', 'task_id': task_id})



# 日付バリデーション関数
def validate_dates(start_day, end_day):
  today_str = datetime.date.today().strftime('%Y-%m-%d')
  if not start_day or not end_day:
    return JsonResponse({'status': 'error', 'message': '日付を指定してください。'}, status=400)

  try:
    end_date_obj = datetime.date.fromisoformat(end_day)
    today_date_obj = datetime.date.fromisoformat(today_str)
    start_date_obj = datetime.date.fromisoformat(start_day)
  except ValueError:
    return JsonResponse({'status': 'error', 'message': '日付の形式が不正です。'}, status=400)
  if end_date_obj >= today_date_obj:
    return JsonResponse({'status': 'error', 'message': '昨日の日付までしか指定できません。'}, status=400)
  if start_date_obj > end_date_obj:
    return JsonResponse({'status': 'error', 'message': '開始日が終了日を超えています。'}, status=400)
  return None



@api_view(['GET'])
def check_task_status(request):
  task_id = request.GET.get('task_id')

  # タスクIDがない場合、エラーを返す
  if not task_id:
    return JsonResponse({'status': 'error', 'message': 'タスクIDが指定されていません。'}, status=400)

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
    return JsonResponse({'status': 'error', 'message': '無効なタスクIDです。'}, status=404)



@api_view(['GET'])
def download_file(request):
  # 1. クエリパラメータからダウンロード対象のファイルパスを取得
  #    このファイルパスは、非同期タスクが作成し、AsyncTask.result に格納したもの（例：/tmp/backup_20250101.xlsx）
  file_path = request.GET.get('file_path')

  # 2. ファイルをバイナリ読み込みモード ('rb') で開く
  #    FileResponse でファイルをクライアントに送信するために、ファイルハンドルが必要です。
  file_handle = open(file_path, 'rb')

  # 3. FileResponse を作成
  #    - file_handle: 開いたファイルオブジェクト
  #    - as_attachment=True: ブラウザに対してファイルをダウンロードさせる指示（Content-Disposition ヘッダーを設定）
  #    - filename: ダウンロード時のファイル名として、元のファイルパスのベース名（ファイル名部分のみ）を設定
  response = FileResponse(file_handle, as_attachment=True, filename=os.path.basename(file_path))

  # 4. ファイルダウンロード完了後に実行するための遅延クリーンアップ関数を定義
  def delayed_file_cleanup():
      # クライアントへのファイル送信が完了する時間を確保するため、3秒待機
      # これにより、Djangoがファイルハンドルを閉じ、レスポンスの送信が開始された後に削除処理が走る
      time.sleep(3) 
      
      # ファイルが存在するか確認（他のプロセスによって削除されていないか）
      if os.path.exists(file_path):
          try:
              # 一時ファイル/バックアップファイルを削除
              os.remove(file_path)
          except Exception as e:
              # 削除に失敗した場合（権限、ファイルロックなど）はログ出力
              print(f"Cleanup failed after delay for {file_path}: {e}")

  # 5. response.close のカスタム実装を定義
  #    FileResponse が提供する close() メソッドが呼び出されたときに、
  #    ファイル削除を別スレッドで実行するための処理をラップする
  def cleanup_on_close():
      # クリーンアップ処理をメインスレッドから切り離し、別スレッドで実行
      # これにより、ダウンロードリクエストの処理がファイル削除の完了を待たずに終了できる
      thread = threading.Thread(target=delayed_file_cleanup)
      thread.start()

  # 6. FileResponse オブジェクトの close() メソッドをカスタム関数に置き換え
  #    Django/WSGIサーバーがレスポンスの送信を終える適切なタイミングで、
  #    この cleanup_on_close() が呼び出される（元の file_handle の close() も自動的に呼び出される）
  response.close = cleanup_on_close 

  # 7. クライアントへのレスポンスを返却（ファイル送信を開始）
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