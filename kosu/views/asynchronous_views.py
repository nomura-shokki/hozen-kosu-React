from django.http import JsonResponse, FileResponse
import os
import threading
import uuid
from ..tasks import generate_kosu_backup, generate_prediction
from ..models import AsyncTask

# 汎用非同期タスク処理を開始する関数
def start_task(request, task_type):
    """
    クライアントからのリクエストを受け取り、指定された `task_type` に基づいて非同期タスクを開始します。
    - `task_type` が "backup" または "prediction" の場合に適切なタスクを実行します。
    - 非同期タスクはバックエンドで処理され、クライアントにはタスクIDを返却します。
    
    Args:
        request (HttpRequest): クライアントからのリクエスト。
        task_type (str): タスクの種類（"backup" または "prediction" を指定）。

    Returns:
        JsonResponse: タスク開始の結果（タスクIDまたはエラーメッセージ）。
    """
    if request.method == 'POST':
        # 必須パラメータ `data_day` と `data_day2` を取得（開始日と終了日）
        data_day = request.POST.get('data_day')
        data_day2 = request.POST.get('data_day2')

        # 日付データのバリデーション。範囲指定が正しくない場合はエラーを返す。
        error_response = validate_dates(data_day, data_day2)
        if error_response:
            return error_response

        # 非同期タスク用に一意のタスクIDを生成
        task_id = str(uuid.uuid4())

        # 非同期処理に関するデータをデータベースへ登録（初期状態は "pending"）
        AsyncTask.objects.create(task_id=task_id, status='pending')

        # タスクの種類に応じた処理関数を選択
        if task_type == 'backup':
            task_function = generate_kosu_backup  # バックアップ処理を実行する関数
        elif task_type == 'prediction':
            task_function = generate_prediction  # 予測処理を実行する関数
        else:
            # 無効なタスクタイプであればエラーを返却
            return JsonResponse({'status': 'error', 'message': '無効なタスクタイプです。'}, status=400)

        # 非同期で処理を実行するために新しいスレッドを起動
        thread = threading.Thread(target=handle_task, args=(task_id, task_function, data_day, data_day2))
        thread.start()

        # クライアント側にタスクIDを返却し、非同期処理が開始されたことを通知
        return JsonResponse({'status': 'success', 'task_id': task_id})

    # POSTリクエスト以外はエラーを返却
    return JsonResponse({'status': 'error', 'message': '無効なリクエストです。'}, status=400)


# 汎用的な非同期タスクの処理関数
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