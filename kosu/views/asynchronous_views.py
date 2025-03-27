from django.http import JsonResponse, FileResponse
from django.utils.timezone import now
import os
import threading
import uuid
from ..tasks import generate_kosu_backup, generate_prediction, delete_kosu_data
from ..models import AsyncTask





#--------------------------------------------------------------------------------------------------------





# 非同期タスク処理開始
def start_task(request, task_type):
  # POST時の処理
  if request.method == 'POST':
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
      # バックアップ処理を実行する関数
      task_function = generate_kosu_backup
    elif task_type == 'prediction':
      # 予測処理を実行する関数
      task_function = generate_prediction
    elif task_type == 'kosu_delete':
      # 工数を削除する関数
      task_function = delete_kosu_data
    else:
      # 無効なタスクタイプであればエラーを返却
      return JsonResponse({'status': 'error', 'message': '無効なタスクタイプです。'}, status=400)

    # 非同期処理を実行するための新しいスレッド起動
    thread = threading.Thread(target=handle_task, args=(task_id, task_function, data_day, data_day2))
    thread.start()

    # タスクIDを返却し、非同期処理開始を通知
    return JsonResponse({'status': 'success', 'task_id': task_id})

  # POST以外はエラーを返却
  return JsonResponse({'status': 'error', 'message': '無効なリクエストです。'}, status=400)





#--------------------------------------------------------------------------------------------------------





# 非同期タスク処理
def handle_task(task_id, task_function, data_day, data_day2):
  try:
    # 工数バックアップor工数区分定義予測出力のタスクを実行し、ファイルパス取得
    file_path = task_function(data_day, data_day2)

    # タスクを "success" に更新して保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'success'
    task.result = file_path
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


