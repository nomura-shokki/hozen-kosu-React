from django.http import JsonResponse, FileResponse
import os
import threading
import uuid
from ..tasks import generate_kosu_backup, generate_prediction, delete_kosu_data, load_kosu_file, \
                    generate_member_backup, load_member_file, generate_team_backup, load_team_file, \
                    generate_def_backup, load_def_file, generate_inquiry_backup, load_inquiry_file
from ..models import AsyncTask





#--------------------------------------------------------------------------------------------------------





# 非同期タスク処理開始
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





#--------------------------------------------------------------------------------------------------------





# 非同期タスク処理 (汎用版)
def handle_task(task_id, task_function, *args, **kwargs):
  try:
    # タスク関数を実行し、結果を取得
    result = task_function(*args, **kwargs)

    # タスクを "success" に更新し結果を保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'success'
    task.result = result
    task.save()
  except Exception as e:
    # 処理中にエラーが発生した場合、 "error" に更新しエラーメッセージ保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'error'
    task.result = str(e)
    task.save()





#--------------------------------------------------------------------------------------------------------





# 非同期タスク監視関数
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
    # 指定されたタスクIDが存在しない場合にエラーを返す
    return JsonResponse({'status': 'error', 'message': '無効なタスクIDです。'}, status=404)






#--------------------------------------------------------------------------------------------------------





# ファイルダウンロード関数
def download_file(request):
  file_path = request.GET.get('file_path')
  # ファイルパスがない場合、エラーを返す
  if not file_path or not os.path.exists(file_path):
    return JsonResponse({'status': 'error', 'message': 'ファイルが見つかりません。'}, status=404)

  # ファイル添付してレスポンス作成
  response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=os.path.basename(file_path))

  # 一時ファイル削除関数
  def file_cleanup():
    if os.path.exists(file_path):
      os.remove(file_path)

  # 一時ファイル削除実行
  response['Cleanup-Callback'] = file_cleanup()
  return response





#--------------------------------------------------------------------------------------------------------





# 日付バリデーション関数
def validate_dates(data_day, data_day2):
  # 日付指定無かったり、開始日が終了日を越えていた場合エラーを返す
  if not data_day or not data_day2:
    return JsonResponse({'status': 'error', 'message': '日付を指定してください。'}, status=400)
  if data_day > data_day2:
    return JsonResponse({'status': 'error', 'message': '開始日が終了日を超えています。'}, status=400)
  return None





#--------------------------------------------------------------------------------------------------------



