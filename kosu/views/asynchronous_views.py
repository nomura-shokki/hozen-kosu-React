import os  
import threading  
import uuid  
import datetime  
import time  
import tempfile  
from django.conf import settings  
from django.urls import resolve  
from django.http import JsonResponse, FileResponse  
from rest_framework import status  
from rest_framework.decorators import (  
    api_view,  
    parser_classes,  
    permission_classes,  
)  
from rest_framework.parsers import (  
    MultiPartParser,  
    JSONParser,  
    FormParser,  
)  
from ..tasks import (  
    generate_kosu_backup,  
    delete_kosu_data,  
    load_kosu_file,  
    generate_member_backup,  
    load_member_file,  
    generate_team_backup,  
    load_team_file,  
    generate_def_backup,  
    load_def_file,  
    generate_choice_backup,  
    load_choice_file,  
    generate_inquiry_backup,  
    load_inquiry_file,  
    generate_setting_backup,  
    load_setting_file,  
    generate_AsyncTask_backup,  
    delete_AsyncTask_data,  
    generate_History_backup,  
    delete_History_data,  
)  
from ..models import AsyncTask  
from ..permissions import IsAdministrator  
@api_view(['POST'])  
@permission_classes([IsAdministrator])  
@parser_classes([MultiPartParser, JSONParser, FormParser])  
def backup(request):  
    # タスクIDを生成します。  
    task_id = str(uuid.uuid4())  
    # 非同期処理の状態を管理するレコードを作成します。  
    AsyncTask.objects.create(  
        task_id=task_id,  
        status='pending',  
    )  
    # リクエストから開始日と終了日を取得します。  
    start_day = request.data.get('start_day')  
    end_day = request.data.get('end_day')  
    # 現在アクセスされているURLを取得します。  
    current_path = request.path  
    # URLからURLパターンの情報を取得します。  
    match = resolve(current_path)  
    # URLパターンに設定されている名前を取得します。  
    url_name = match.url_name  
    # URL名に応じて実行するタスク関数を決定します。  
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
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in kosu_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_kosu_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'def_backup':  
        task_function = generate_def_backup  
        args = ()  
    elif url_name == 'def_load':  
        def_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in def_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_def_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'choice_backup':  
        task_function = generate_choice_backup  
        args = ()  
    elif url_name == 'choice_load':  
        choice_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in choice_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_choice_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'member_backup':  
        task_function = generate_member_backup  
        args = ()  
    elif url_name == 'member_load':  
        member_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in member_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_member_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'team_backup':  
        task_function = generate_team_backup  
        args = ()  
    elif url_name == 'team_load':  
        team_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in team_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_team_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'inquiry_backup':  
        task_function = generate_inquiry_backup  
        args = ()  
    elif url_name == 'inquiry_load':  
        inquiry_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in inquiry_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_inquiry_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    elif url_name == 'setting_backup':  
        task_function = generate_setting_backup  
        args = ()  
    elif url_name == 'setting_load':  
        setting_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in setting_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_setting_file  
            args = (temp_file_path,)  
        except Exception as e:  
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
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
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '無効なタスクタイプです。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # テスト時は、別スレッドを作らずにその場でタスクを実行します。  
    #  
    # テスト用データベースとしてSQLiteの':memory:'を使用している場合、  
    # 別スレッドからデータベースへアクセスすると、  
    # database table is locked が発生しやすくなります。  
    if getattr(settings, 'TESTING', False):  
        handle_task(  
            task_id,  
            task_function,  
            *args,  
        )  
    # 本番環境では、これまでどおり別スレッドで実行します。  
    else:  
        thread = threading.Thread(  
            target=handle_task,  
            args=(task_id, task_function, *args),  
        )  
        # メイン処理の終了時にスレッドが残り続けないようにします。  
        thread.daemon = True  
        # 非同期タスクを開始します。  
        thread.start()  
    # タスクIDを返却し、処理開始を通知します。  
    return JsonResponse(  
        {  
            'status': 'success',  
            'task_id': task_id,  
        }  
    )  
# 日付バリデーション関数  
def validate_dates(start_day, end_day):  
    # 今日の日付をYYYY-MM-DD形式の文字列に変換します。  
    today_str = datetime.date.today().strftime('%Y-%m-%d')  
    # 開始日または終了日が指定されていない場合のエラーです。  
    if not start_day or not end_day:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '日付を指定してください。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    try:  
        # 文字列を日付型へ変換します。  
        end_date_obj = datetime.date.fromisoformat(end_day)  
        today_date_obj = datetime.date.fromisoformat(today_str)  
        start_date_obj = datetime.date.fromisoformat(start_day)  
    except ValueError:  
        # 日付形式が正しくない場合のエラーです。  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '日付の形式が不正です。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # 今日以降の日付が指定されている場合のエラーです。  
    if end_date_obj >= today_date_obj:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '昨日の日付までしか指定できません。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # 開始日が終了日より後の場合のエラーです。  
    if start_date_obj > end_date_obj:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '開始日が終了日を超えています。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # エラーがない場合はNoneを返します。  
    return None  
@api_view(['GET'])  
@permission_classes([IsAdministrator])  
def check_task_status(request):  
    # リクエストからタスクIDを取得します。  
    task_id = request.GET.get('task_id')  
    # タスクIDが指定されていない場合のエラーです。  
    if not task_id:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': 'タスクIDが指定されていません。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    try:  
        # データベースからタスクIDに対応するタスクを取得します。  
        task = AsyncTask.objects.get(task_id=task_id)  
        # タスクが正常終了している場合です。  
        if task.status == 'success':  
            return JsonResponse(  
                {  
                    'status': 'success',  
                    'file_path': task.result,  
                }  
            )  
        # タスクがエラー終了している場合です。  
        elif task.status == 'error':  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': task.result,  
                }  
            )  
        # それ以外は処理中として扱います。  
        else:  
            return JsonResponse(  
                {  
                    'status': 'pending',  
                },  
                status=status.HTTP_202_ACCEPTED,  
            )  
    except AsyncTask.DoesNotExist:  
        # 指定されたタスクIDが存在しない場合のエラーです。  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '無効なタスクIDです。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
@api_view(['GET'])  
@permission_classes([IsAdministrator])  
def download_file(request):  
    # ダウンロード対象のファイルパスを取得します。  
    file_path = request.GET.get('file_path')  
    # ファイルを読み込み専用で開きます。  
    file_handle = open(file_path, 'rb')  
    # ファイルをダウンロードするレスポンスを作成します。  
    response = FileResponse(  
        file_handle,  
        as_attachment=True,  
        filename=os.path.basename(file_path),  
    )  
    # ダウンロード後にファイルを削除する処理です。  
    def delayed_file_cleanup():  
        # ファイルが使用中の可能性があるため、少し待機します。  
        time.sleep(3)  
        # ファイルが存在する場合だけ削除します。  
        if os.path.exists(file_path):  
            try:  
                os.remove(file_path)  
            except Exception as e:  
                print(  
                    f'Cleanup failed after delay for '  
                    f'{file_path}: {e}'  
                )  
    # レスポンス終了時に呼び出す処理です。  
    def cleanup_on_close():  
        # ファイル削除処理を別スレッドで実行します。  
        thread = threading.Thread(  
            target=delayed_file_cleanup,  
        )  
        # ファイル削除スレッドをデーモンスレッドにします。  
        thread.daemon = True  
        # ファイル削除処理を開始します。  
        thread.start()  
    # レスポンス終了時の処理を設定します。  
    response.close = cleanup_on_close  
    # ファイルレスポンスを返します。  
    return response  
# 非同期タスク処理（汎用版）  
def handle_task(task_id, task_function, *args, **kwargs):  
    try:  
        # タスク関数を実行し、結果を取得します。  
        result = task_function(*args, **kwargs)  
        # タスク関数が明示的なエラーを返したか確認します。  
        is_explicit_error = (  
            isinstance(result, tuple)  
            and len(result) > 0  
            and isinstance(result[0], dict)  
            and result[0].get('status') == 'error'  
        )  
        # タスクIDに対応するタスクを取得します。  
        task = AsyncTask.objects.get(task_id=task_id)  
        if is_explicit_error:  
            # タスク関数がエラー情報を返した場合です。  
            error_dict = result[0]  
            task.status = 'error'  
            task.result = error_dict.get(  
                'message',  
                'タスク関数が明示的なエラーを返しました。',  
            )  
        else:  
            # タスク関数が正常終了した場合です。  
            task.status = 'success'  
            task.result = result  
        # タスクの状態と結果を保存します。  
        task.save()  
    except Exception as e:  
        # タスク処理中に予期しないエラーが発生した場合です。  
        try:  
            # エラーになったタスクを取得します。  
            task = AsyncTask.objects.get(task_id=task_id)  
            # タスクをエラー状態に更新します。  
            task.status = 'error'  
            task.result = str(e)  
            # エラー内容を保存します。  
            task.save()  
        except AsyncTask.DoesNotExist:  
            # 対応するタスクがすでに削除されている場合です。  
            print(  
                f'Error: AsyncTask with id {task_id} not found.'  
            )  