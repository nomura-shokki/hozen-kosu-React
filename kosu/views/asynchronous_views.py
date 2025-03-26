from django.http import JsonResponse, FileResponse
from django.utils.timezone import now
import os
import threading
import uuid
from ..tasks import generate_kosu_backup, generate_prediction
from ..models import Business_Time_graph, AsyncTask





#--------------------------------------------------------------------------------------------------------





# 工数バックアップ&工数区分定義予測出力非同期タスク処理開始
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
    if task_type == 'backup':
      # バックアップ処理を実行する関数
      task_function = generate_kosu_backup
    elif task_type == 'prediction':
      # 予測処理を実行する関数
      task_function = generate_prediction
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



# 工数バックアップ&工数区分定義予測出力の非同期タスク処理
def handle_task(task_id, task_function, data_day, data_day2):
  """
  スレッド内で実行される非同期タスク処理。
  - 指定された `task_function` を実行し、その結果（ファイルパス）をデータベースに記録します。
  - 処理中にエラーが発生した場合、そのエラーメッセージを記録します。
  
  Args:
      task_id (str): タスクID（UUIDを使用したユニークな識別子）。
      task_function (callable): 実行する関数（`generate_kosu_backup` または `generate_prediction`）。
      data_day (str): タスクの開始日。
      data_day2 (str): タスクの終了日。
  """
  try:
    # 指定されたタスク関数を実行し、生成されたファイルパスを取得
    file_path = task_function(data_day, data_day2)

    # タスクの状態を "success" に更新し、結果（ファイルパス）を保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'success'
    task.result = file_path
    task.save()

  except Exception as e:
    # 処理中にエラーが発生した場合、状態を "error" に更新しエラーメッセージを保存
    task = AsyncTask.objects.get(task_id=task_id)
    task.status = 'error'
    task.result = str(e)
    task.save()


# 非同期タスクの監視関数
def check_task_status(request):
    """
    クライアントから指定されたタスクIDの状態を取得し返却します。
    - タスクが成功していれば、その結果（ファイルパス）を返却。
    - タスクが実行中であれば "pending" 状態を返却。
    - タスクが失敗していればエラーメッセージを返却。
    
    Args:
        request (HttpRequest): クライアントからのリクエスト（タスクIDを含む）。

    Returns:
        JsonResponse: タスク状態（"success", "pending", "error"）と関連するデータ。
    """
    task_id = request.GET.get('task_id')
    if not task_id:
        return JsonResponse({'status': 'error', 'message': 'タスクIDが指定されていません。'}, status=400)

    try:
        # データベースからタスクIDに対応する状態を取得
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


# 汎用的なファイルダウンロード関数
def download_file(request):
    """
    クライアントに指定されたファイルをダウンロードさせる。
    - ファイルが存在しない場合はエラーメッセージを返却。
    - ダウンロード後に一時ファイルを削除する処理を含む。
    
    Args:
        request (HttpRequest): クライアントからのリクエスト（ファイルパスを含む）。

    Returns:
        FileResponse: ファイルを添付したレスポンス。
        JsonResponse: エラーメッセージ（ファイルが見つからない場合）。
    """
    file_path = request.GET.get('file_path')
    if not file_path or not os.path.exists(file_path):
        return JsonResponse({'status': 'error', 'message': 'ファイルが見つかりません。'}, status=404)

    # ファイルを添付してレスポンスを作成
    response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=os.path.basename(file_path))

    # ダウンロード後に一時ファイルを削除
    def file_cleanup():
        if os.path.exists(file_path):
            os.remove(file_path)

    response['Cleanup-Callback'] = file_cleanup()  # ダウンロード後の削除を設定
    return response


# 日付バリデーション関数
def validate_dates(data_day, data_day2):
    """
    指定された日付範囲が正しいかをバリデーションする。
    - 日付が空の場合や開始日が終了日を超えている場合にエラーを返却。
    
    Args:
        data_day (str): 開始日。
        data_day2 (str): 終了日。

    Returns:
        JsonResponse: エラー情報（問題があれば返却）。
        None: 日付が正しければ何も返さない。
    """
    if not data_day or not data_day2:
        return JsonResponse({'status': 'error', 'message': '日付を指定してください。'}, status=400)
    if data_day > data_day2:
        return JsonResponse({'status': 'error', 'message': '開始日が終了日を超えています。'}, status=400)
    return None










def check_kosu_delete_status(request):
    """
    非同期タスクの状態確認用APIエンドポイント。
    """
    task_id = request.GET.get('task_id')
    if not task_id:
        return JsonResponse({'status': 'error', 'message': 'タスクIDが指定されていません。'}, status=400)

    try:
        task = AsyncTask.objects.get(task_id=task_id)
        return JsonResponse({'status': task.status, 'result': task.result})
    except AsyncTask.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': '指定されたタスクが存在しません。'}, status=404)
    






def start_kosu_delete(request):
    """
    非同期で工数データ削除処理を開始するAPIエンドポイント。
    """
    if request.method == 'POST':
        data_day = request.POST.get('data_day')
        data_day2 = request.POST.get('data_day2')

        if not data_day or not data_day2:
            return JsonResponse({'status': 'error', 'message': '削除する日付を指定してください。ERROR069'}, status=400)

        if data_day > data_day2:
            return JsonResponse({'status': 'error', 'message': '削除開始日が終了日を超えています。ERROR070'}, status=400)

        # タスクIDを生成
        task_id = str(now().timestamp())  # タスクIDをタイムスタンプで生成

        # 非同期タスクをモデルに記録
        AsyncTask.objects.create(task_id=task_id, status='pending')

        # 非同期処理を開始 (スレッド)
        threading.Thread(target=delete_kosu_data, args=(data_day, data_day2, task_id)).start()

        return JsonResponse({'status': 'success', 'task_id': task_id})
    return JsonResponse({'status': 'error', 'message': '不正なリクエストです。'}, status=405)


def delete_kosu_data(data_day, data_day2, task_id):
    """
    スレッドで実行される工数データ削除処理。
    """
    try:
        # 工数データ取得
        kosu_obj = Business_Time_graph.objects.filter(work_day2__gte=data_day, work_day2__lte=data_day2)
        deleted_count = kosu_obj.delete()

        # タスク完了状態を更新
        AsyncTask.objects.filter(task_id=task_id).update(
            status='success',
            result=f'Deleted {deleted_count[0]} records.'
        )
    except Exception as e:
        # タスクエラー状態を更新
        AsyncTask.objects.filter(task_id=task_id).update(
            status='error',
            result=str(e)
        )