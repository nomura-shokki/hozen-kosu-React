from django.http import FileResponse, JsonResponse
import os
import threading
import uuid
from ..tasks import generate_kosu_backup
from ..models import AsyncTask





#--------------------------------------------------------------------------------------------------------





# 工数データバックアップ非同期処理メイン関数
def start_kosu_backup(request):
  if request.method == 'POST':
    # 必須パラメータ `data_day` と `data_day2` の取得
    data_day = request.POST.get('data_day')
    data_day2 = request.POST.get('data_day2')

    # 入力された日付が範囲指定されていない場合、エラーレスポンスを返却
    if not data_day or not data_day2:
      return JsonResponse(
        {'status': 'error', 'message': 'バックアップする日付を指定してください。'},
        status=400
      )

    # 入力日付の開始日が終了日を超えている場合、エラーレスポンスを返却
    if data_day > data_day2:
      return JsonResponse(
        {'status': 'error', 'message': '読み込み開始日が終了日を超えています。'},
        status=400
      )

    # 非同期タスク用に一意のタスクIDを生成
    task_id = str(uuid.uuid4())

    # 非同期タスク情報をデータベース（AsyncTaskモデル）に登録（ステータスは初期状態として 'pending'）
    AsyncTask.objects.create(task_id=task_id, status='pending')

    # スレッドを使用してバックアップ処理を非同期で実行
    # `handle_kosu_backup_task` 関数の呼び出しと引数の渡し
    thread = threading.Thread(target=handle_kosu_backup_task, args=(task_id, data_day, data_day2))
    thread.start()

    # クライアントに成功レスポンスとしてタスクIDを返却
    return JsonResponse({'status': 'success', 'task_id': task_id})





#--------------------------------------------------------------------------------------------------------





# 工数データバックアップ非同期処理&DB記録関数
def handle_kosu_backup_task(task_id, data_day, data_day2):
  try:
    # 実際のバックアップ処理を実行し、生成されたファイルパスを取得する
    file_path = generate_kosu_backup(data_day, data_day2)

    # タスクの状態を `success` に変更し、結果のファイルパスを保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'success'
    task.result = file_path
    task.save()

  except Exception as e:
    # タスク実行中にエラーが発生した場合、状態を `error` に変更し、エラーメッセージを保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'error'
    task.result = str(e)
    task.save()





#--------------------------------------------------------------------------------------------------------





# 非同期処理監視関数
def check_kosu_backup_status(request):
  # クライアントから送信されたタスクIDを取得
  task_id = request.GET.get('task_id')

  # タスクIDが指定されていない場合、エラーレスポンスを返却
  if not task_id:
    return JsonResponse({'status': 'error', 'message': 'タスクIDが指定されていません。'}, status=400)

  try:
    # タスクIDに基づいてデータベースからタスク情報を取得
    task = AsyncTask.objects.get(task_id=task_id)

    # タスクが成功している場合、ファイルパスをレスポンスとして返却
    if task.status == 'success':
      return JsonResponse({'status': 'success', 'file_path': task.result})

    # タスク実行中にエラーがある場合、エラーメッセージをレスポンスとして返却
    elif task.status == 'error':
      return JsonResponse({'status': 'error', 'message': task.result})

    # タスクがまだ実行中の場合、ステータスを `pending` としてレスポンスを返却
    else:
      return JsonResponse({'status': 'pending'}, status=202)

  except AsyncTask.DoesNotExist:
    # 指定されたタスクIDのデータが存在しない場合、エラーレスポンスを返却
    return JsonResponse({'status': 'error', 'message': '無効なタスクIDです。'}, status=404)





#--------------------------------------------------------------------------------------------------------





# バックアップファイルダウンロード&一時ファイル削除関数
def download_kosu_backup(request):
  # ファイルパスを取得
  file_path = request.GET.get('file_path')

  # ファイルパスが存在しない、または指定されたファイルが見つからない場合、エラー出力
  if not file_path or not os.path.exists(file_path):
    return JsonResponse({'status': 'error', 'message': 'ファイルが見つかりません。'}, status=404)

  # ファイルをレスポンスとして送信
  response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=os.path.basename(file_path))

  # 一時ファイル削除関数
  def file_cleanup():
    if os.path.exists(file_path):
      os.remove(file_path)

  # 一時ファイル削除
  response['Cleanup-Callback'] = file_cleanup()  # ファイル削除を呼び出し
  return response





#--------------------------------------------------------------------------------------------------------


