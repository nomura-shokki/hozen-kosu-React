# ============================================================
# ファイル名 : asynchronous_views.py
# 種別       : APIビュー（Django REST Framework の関数ベースビュー）
# 概要       : 管理者用の「データ管理」画面（/manager-loading）から呼ばれる、
#              データのバックアップ・削除・ロード（Excelファイルからの復元）を
#              非同期（画面を待たせずに裏側で処理）で実行するAPI群。
#              時間のかかる処理を別スレッドで動かし、画面にはすぐにタスクIDを返す。
#
# 主な関数:
#   - backup            : 非同期タスクの開始           POST /api/kosu_backup/ ほか計19種類のURL
#   - validate_dates    : 期間（開始日・終了日）の入力チェック（内部用）
#   - check_task_status : タスクの状態確認             GET  /api/check_backup_status?task_id=...
#   - download_file     : 作成ファイルのダウンロード   GET  /api/download_backup?file_path=...
#   - handle_task       : タスク関数の実行と結果の保存（内部用）
#
# 処理の流れ:
#   1. 画面 → backup            : AsyncTask（非同期タスク）を status='pending' で作成し task_id を返す
#   2. 別スレッドで handle_task : tasks.py のタスク関数を実行し、結果を AsyncTask に保存
#   3. 画面 → check_task_status : status が 'success' / 'error' になるまで1秒ごとに確認
#   4. 画面 → download_file     : バックアップの場合のみ、作成されたExcelファイルを取得（取得後に自動削除）
#
# 権限       : すべて IsAdministrator（ログイン済みかつ「管理者」の人員のみ利用可能）
# 補足       : タスクの実行には Django-Q ではなく、Python 標準の threading（スレッド）を使っている。
# 関連ファイル: tasks.py（各タスク関数）, models.py（AsyncTask）, permissions.py, urls.py,
#              frontend/src/AdministratorPage/AdministratorLoading.tsx（呼び出し元の画面）
# ============================================================

# ============================================================
# インポート
# ============================================================
# 標準ライブラリ
import os  # 一時ファイル・作成ファイルの存在確認と削除
import threading  # タスクやファイル削除を別スレッドで実行する
import uuid  # 重複しないタスクIDの生成
import datetime  # 日付の入力チェック
import time  # ファイル削除前の待機
import tempfile  # アップロードファイルを一時保存する一時ファイルの作成
from pathlib import Path
# Django / Django REST Framework
from django.conf import settings  # settings.TESTING（テスト実行中かどうか）の参照
from django.urls import resolve  # アクセスされたURLから urls.py のURL名を調べる
from django.http import JsonResponse, FileResponse  # JSON応答 / ファイルダウンロード応答
from rest_framework import status  # HTTPステータスコードの定数（400, 500 など）
from rest_framework.decorators import (  
    api_view,  # 関数を DRF のAPIビューにするデコレータ
    parser_classes,  # リクエスト本文の読み取り方式を指定するデコレータ
    permission_classes,  # 利用権限を指定するデコレータ
)  
from rest_framework.parsers import (  
    MultiPartParser,  # ファイル添付フォーム（multipart/form-data）
    JSONParser,  # JSON形式の本文
    FormParser,  # 通常のフォーム送信
)  
# 別スレッドで実行するタスク関数（tasks.py）
#   generate_〇〇: バックアップファイル作成 / load_〇〇: ファイルから復元 / delete_〇〇: 期間指定削除
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
from ..models import AsyncTask  # 非同期タスクの状態を記録するモデル
from ..permissions import IsAdministrator  # 管理者のみ許可する権限クラス

# ============================================================
# 非同期タスク開始API
# ============================================================
# ------------------------------------------------------------
# backup: 非同期タスク開始API（バックアップ / 削除 / ロード 共通の入口）
#   URL  : 以下の19種類のURLがすべてこの関数を呼ぶ（kosu/urls.py）。
#          アクセスされたURLの名前（url_name）で、実行するタスク関数を切り替える。
#            期間指定あり（start_day / end_day が必須）:
#              /api/kosu_backup/      → generate_kosu_backup       工数データバックアップ
#              /api/kosu_delet/       → delete_kosu_data           工数データ削除
#              /api/AsyncTask_backup/ → generate_AsyncTask_backup  タスク履歴バックアップ
#              /api/AsyncTask_delet/  → delete_AsyncTask_data      タスク履歴削除
#              /api/History_backup/   → generate_History_backup    操作履歴バックアップ
#              /api/History_delet/    → delete_History_data        操作履歴削除
#            全件バックアップ（引数なし）:
#              /api/def_backup/  /api/choice_backup/  /api/member_backup/
#              /api/team_backup/ /api/inquiry_backup/ /api/setting_backup/
#            ファイルロード（file 項目にExcelファイルを添付）:
#              /api/kosu_load/  /api/def_load/     /api/choice_load/  /api/member_load/
#              /api/team_load/  /api/inquiry_load/ /api/setting_load/
#   権限 : IsAdministrator（管理者のみ）
#   POST : AsyncTask を作成してタスクを開始し、すぐに task_id を返す（完了は待たない）。
#
# 引数:
#   request: HTTPリクエスト。request.data / request.FILES で以下を受け付ける
#     start_day (期間指定のURLのみ必須): 開始日 "YYYY-MM-DD"
#     end_day   (期間指定のURLのみ必須): 終了日 "YYYY-MM-DD"（昨日まで）
#     file      (ロードのURLのみ)      : 復元するExcelファイル（.xlsx）
# 戻り値:
#   JsonResponse: 開始成功時は {'status': 'success', 'task_id': タスクID}（200）
#                 期間の入力エラー・未対応のURLの場合は 400、一時ファイル書き込み失敗時は 500 エラー
# ------------------------------------------------------------
@api_view(['POST'])  # POST のみ受け付ける DRF のAPIにする
@permission_classes([IsAdministrator])  # 管理者のみ利用可能
@parser_classes([MultiPartParser, JSONParser, FormParser])  # ファイル添付・JSON・フォームの本文を読めるようにする
def backup(request):  
    # タスクIDを生成する
    #   uuid4: 重複しないランダムなID（例: "3f2b9c1e-..."）。画面はこのIDで進み具合を問い合わせる
    task_id = str(uuid.uuid4())  
    # 非同期タスクの状態を管理するレコードを「処理中（pending）」で作成する
    #   ※この時点で作成するため、以下の入力チェックでエラーを返した場合も pending のレコードが残る
    AsyncTask.objects.create(  
        task_id=task_id,  
        status='pending',  
    )  
    # リクエスト本文から開始日と終了日を取得する（期間指定のタスクでのみ使用）
    start_day = request.data.get('start_day')  
    end_day = request.data.get('end_day')  
    # 現在アクセスされているURLのパス（例: "/api/kosu_backup/"）を取得する
    current_path = request.path  
    # パスから urls.py のURLパターン情報を逆引きする
    match = resolve(current_path)  
    # URLパターンに付けた名前（path(..., name='kosu_backup') の name）を取得する
    url_name = match.url_name
    # ロード（*_load）なのにファイルが添付されていない場合は 400
    if url_name.endswith('_load') and not request.FILES.get('file'):
        return JsonResponse({'status': 'error', 'message': 'ファイルを選択してください。'}, status=status.HTTP_400_BAD_REQUEST)  
    # URL名に応じて、実行するタスク関数（task_function）と渡す引数（args）を決める
    # 工数データバックアップ: 期間をチェックしてから generate_kosu_backup(開始日, 終了日)
    if url_name == 'kosu_backup':  
        # 期間の入力チェック。エラーがあれば 400 のレスポンスをそのまま返して終了
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = generate_kosu_backup  
        args = (start_day, end_day)  
    # 工数データ削除: 期間をチェックしてから delete_kosu_data(開始日, 終了日)
    elif url_name == 'kosu_delet':  
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = delete_kosu_data  
        args = (start_day, end_day)  
    # 工数データロード: アップロードされたExcelを一時ファイルに保存し、load_kosu_file(一時ファイルのパス)
    elif url_name == 'kosu_load':  
        # フォームの 'file' 項目で送られたアップロードファイルを取得（未添付なら None）
        kosu_file = request.FILES.get('file')  
        # 一時ファイルのパス（記録前は None。エラー時の後片付けの判定に使う）
        temp_file_path = None  
        try:  
            # 拡張子 .xlsx の一時ファイル（OSの一時フォルダに作られるファイル）を作成する
            #   delete=False: with を抜けても自動削除しない（別スレッドのタスクが後で読むため。
            #                 読み込み後の削除は tasks.py のロード関数が行う）
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                # アップロードファイルを小分け（chunk）にして順に書き込む（大きなファイルでもメモリを圧迫しないため）
                for chunk in kosu_file.chunks():  
                    temp_file.write(chunk)  
                # 書き込んだ一時ファイルのパスを記録する
                temp_file_path = temp_file.name  
            task_function = load_kosu_file  
            args = (temp_file_path,)  
        # 一時ファイルの作成・書き込みに失敗した場合（ファイル未添付で None の場合もここに来る）
        except Exception as e:  
            # 一時ファイルのパスが記録済みで、ファイルが存在すれば削除する
            if temp_file_path and os.path.exists(temp_file_path):  
                os.remove(temp_file_path)  
            # 500（サーバー内部エラー）とエラー内容を返す
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': f'ファイル書き込みエラー: {str(e)}',  
                },  
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,  
            )  
    # 工数区分定義データバックアップ: generate_def_backup()（引数なし・全件）
    elif url_name == 'def_backup':  
        task_function = generate_def_backup  
        args = ()
    # 工数区分定義データロード: 一時ファイルに保存して load_def_file(一時ファイルのパス)
    elif url_name == 'def_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        def_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in def_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_def_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # 作業詳細選択肢データバックアップ: generate_choice_backup()（引数なし・全件）
    elif url_name == 'choice_backup':  
        task_function = generate_choice_backup  
        args = ()  
    # 作業詳細選択肢データロード: 一時ファイルに保存して load_choice_file(一時ファイルのパス)
    elif url_name == 'choice_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        choice_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in choice_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_choice_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # 人員データバックアップ: generate_member_backup()（引数なし・全件）
    elif url_name == 'member_backup':  
        task_function = generate_member_backup  
        args = ()  
    # 人員データロード: 一時ファイルに保存して load_member_file(一時ファイルのパス)
    elif url_name == 'member_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        member_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in member_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_member_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # 班員データバックアップ: generate_team_backup()（引数なし・全件）
    elif url_name == 'team_backup':  
        task_function = generate_team_backup  
        args = ()  
    # 班員データロード: 一時ファイルに保存して load_team_file(一時ファイルのパス)
    elif url_name == 'team_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        team_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in team_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_team_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # 問い合わせデータバックアップ: generate_inquiry_backup()（引数なし・全件）
    elif url_name == 'inquiry_backup':  
        task_function = generate_inquiry_backup  
        args = ()  
    # 問い合わせデータロード: 一時ファイルに保存して load_inquiry_file(一時ファイルのパス)
    elif url_name == 'inquiry_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        inquiry_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in inquiry_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_inquiry_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # 管理者設定データバックアップ: generate_setting_backup()（引数なし・全件）
    elif url_name == 'setting_backup':  
        task_function = generate_setting_backup  
        args = ()  
    # 管理者設定データロード: 一時ファイルに保存して load_setting_file(一時ファイルのパス)
    elif url_name == 'setting_load':  
        # アップロードファイルを取得し、一時ファイルのパスを初期化
        setting_file = request.FILES.get('file')  
        temp_file_path = None  
        try:  
            # 一時ファイル（.xlsx・自動削除なし）を作成し、アップロードファイルを小分けに書き込む
            with tempfile.NamedTemporaryFile(  
                suffix='.xlsx',  
                delete=False,  
            ) as temp_file:  
                for chunk in setting_file.chunks():  
                    temp_file.write(chunk)  
                temp_file_path = temp_file.name  
            task_function = load_setting_file  
            args = (temp_file_path,)  
        # 書き込み失敗時: 一時ファイルがあれば削除し、500 エラーを返す
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
    # タスク履歴（AsyncTask）バックアップ: 期間をチェックしてから generate_AsyncTask_backup(開始日, 終了日)
    elif url_name == 'AsyncTask_backup':  
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = generate_AsyncTask_backup  
        args = (start_day, end_day)  
    # タスク履歴（AsyncTask）削除: 期間をチェックしてから delete_AsyncTask_data(開始日, 終了日)
    elif url_name == 'AsyncTask_delet':  
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = delete_AsyncTask_data  
        args = (start_day, end_day)  
    # 操作履歴（History）バックアップ: 期間をチェックしてから generate_History_backup(開始日, 終了日)
    elif url_name == 'History_backup':  
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = generate_History_backup  
        args = (start_day, end_day)  
    # 操作履歴（History）削除: 期間をチェックしてから delete_History_data(開始日, 終了日)
    elif url_name == 'History_delet':  
        error_response = validate_dates(start_day, end_day)  
        if error_response:  
            return error_response  
        task_function = delete_History_data  
        args = (start_day, end_day)  
    # 上記以外のURL名の場合は 400（未対応のタスク種類）を返す
    else:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '無効なタスクタイプです。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # テスト時（settings.TESTING が True。hozen_another/test_settings.py で設定）は、
    # 別スレッドを作らずにその場でタスクを実行する。
    #  
    # テスト用データベースとしてSQLiteの':memory:'を使用している場合、  
    # 別スレッドからデータベースへアクセスすると、  
    # database table is locked が発生しやすくなるため。
    if getattr(settings, 'TESTING', False):  
        # handle_task(タスクID, タスク関数, 引数...) を直接呼ぶ（*args で引数のタプルを展開して渡す）
        handle_task(  
            task_id,  
            task_function,  
            *args,  
        )  
    # 本番環境では、別スレッドで実行する（タスクの完了を待たずに画面へ応答を返すため）
    else:
        # handle_task を別スレッドで動かす準備（target: 実行する関数 / args: その関数に渡す引数）
        thread = threading.Thread(  
            target=handle_task,  
            args=(task_id, task_function, *args),  
        )  
        # デーモンスレッドにする: メイン処理（サーバー）の終了時にスレッドが残り続けないようにする
        thread.daemon = True  
        # 非同期タスクを開始する（ここではタスクの完了を待たない）
        thread.start()  
    # タスクIDを返し、処理開始を通知する（画面はこのIDで check_backup_status を呼び、進み具合を確認する）
    return JsonResponse(  
        {  
            'status': 'success',  
            'task_id': task_id,  
        }  
    )  

# ============================================================
# ヘルパー関数: 期間の入力チェック
# ============================================================
# 期間指定（開始日・終了日）の入力内容をチェックする。
#
# 次の順にチェックし、最初に見つかったエラーを返す。
#   1. 開始日・終了日のどちらかが未入力
#   2. 日付の形式が "YYYY-MM-DD" でない
#   3. 終了日が今日以降（昨日までしか指定できない）
#   4. 開始日が終了日より後
#
# 引数:
#   start_day: 開始日の文字列（"YYYY-MM-DD"）。未指定なら None
#   end_day  : 終了日の文字列（"YYYY-MM-DD"）。未指定なら None
# 戻り値:
#   JsonResponse: エラーがある場合は 400 エラーのレスポンス（呼び出し元はこれをそのまま返す）
#   None        : エラーが無い場合
def validate_dates(start_day, end_day):  
    # 今日の日付を "YYYY-MM-DD" 形式の文字列にする
    today_str = datetime.date.today().strftime('%Y-%m-%d')  
    # 開始日または終了日が指定されていない場合は 400 エラー
    if not start_day or not end_day:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '日付を指定してください。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    try:  
        # 文字列を日付型（datetime.date）へ変換して比較できるようにする
        #   fromisoformat: "2026-11-09" のようなISO形式の文字列を日付に変換する
        end_date_obj = datetime.date.fromisoformat(end_day)  
        today_date_obj = datetime.date.fromisoformat(today_str)  
        start_date_obj = datetime.date.fromisoformat(start_day)  
    except ValueError:  
        # 日付の形式が正しくない場合（例: "2026/11/09"）は 400 エラー
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '日付の形式が不正です。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # 終了日が今日以降の場合は 400 エラー（昨日までしか指定できない）
    if end_date_obj >= today_date_obj:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '昨日の日付までしか指定できません。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # 開始日が終了日より後の場合は 400 エラー
    if start_date_obj > end_date_obj:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '開始日が終了日を超えています。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    # エラーが無い場合は None を返す
    return None  

# ============================================================
# タスク状態確認API
# ============================================================
# ------------------------------------------------------------
# check_task_status: 非同期タスクの状態確認API
#   URL  : /api/check_backup_status?task_id=<タスクID>（末尾スラッシュなし）
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 指定したタスクIDの AsyncTask を調べ、状態（success / error / pending）を返す。
#          画面（AdministratorLoading.tsx）は success か error になるまで1秒ごとに呼び出す。
#
# 引数:
#   request: HTTPリクエスト。クエリパラメータ task_id にタスクIDを指定する
# 戻り値:
#   JsonResponse: 正常終了 → {'status': 'success', 'file_path': タスクの結果}（200）
#                   file_path にはタスクの結果が入る（バックアップならExcelファイルのパス）
#                 エラー終了 → {'status': 'error', 'message': エラー内容}（200）
#                 処理中 → {'status': 'pending'}（202）
#                 task_id 未指定・存在しないタスクIDの場合は 400 エラー
# ------------------------------------------------------------
@api_view(['GET'])  # GET のみ受け付ける DRF のAPIにする
@permission_classes([IsAdministrator])  # 管理者のみ利用可能
def check_task_status(request):  
    # クエリパラメータからタスクIDを取得する
    task_id = request.GET.get('task_id')  
    # タスクIDが指定されていない場合は 400 エラー
    if not task_id:  
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': 'タスクIDが指定されていません。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  
    try:  
        # タスクIDが一致する非同期タスクのレコードを取得する（無ければ DoesNotExist 例外）
        task = AsyncTask.objects.get(task_id=task_id)  
        # タスクが正常終了している場合: 結果のファイル名だけを file_path として返す
        # （サーバーの中のフォルダの場所は画面に知らせない。ダウンロードAPIもファイル名だけで探す）
        if task.status == 'success':
            return JsonResponse(
                {
                    'status': 'success',
                    'file_path': os.path.basename(task.result) if task.result else None,
                }
            )
        # タスクがエラー終了している場合: 保存されたエラー内容を message として返す
        elif task.status == 'error':  
            return JsonResponse(  
                {  
                    'status': 'error',  
                    'message': task.result,  
                }  
            )  
        # それ以外（pending）は処理中として 202（受付済み・処理中）を返す
        else:  
            return JsonResponse(  
                {  
                    'status': 'pending',  
                },  
                status=status.HTTP_202_ACCEPTED,  
            )  
    except AsyncTask.DoesNotExist:  
        # 指定されたタスクIDが存在しない場合は 400 エラー
        return JsonResponse(  
            {  
                'status': 'error',  
                'message': '無効なタスクIDです。',  
            },  
            status=status.HTTP_400_BAD_REQUEST,  
        )  

# ============================================================
# ファイルダウンロードAPI
# ============================================================
# ------------------------------------------------------------
# download_file: バックアップファイルのダウンロードAPI
#   URL  : /api/download_backup?file_path=<ファイルパス>（末尾スラッシュなし）
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 指定されたパスのファイルを添付ファイルとして返し、
#          レスポンス終了後に3秒待ってからサーバー上のファイルを削除する。
#          file_path には check_backup_status が返したファイルパス（media フォルダ内）が入る。
#
# 引数:
#   request: HTTPリクエスト。クエリパラメータ file_path にファイルのパスを指定する
# 戻り値:
#   FileResponse: ファイルをダウンロードさせるレスポンス
# ------------------------------------------------------------
@api_view(['GET'])  # GET のみ受け付ける DRF のAPIにする
@permission_classes([IsAdministrator])  # 管理者のみ利用可能
def download_file(request):
    # バックアップの保存先（media フォルダ）の絶対パス
    backup_dir = Path(settings.MEDIA_ROOT).resolve()

    # 受け取るのはファイル名だけにする（フォルダの部分は捨てる。例: "../../.env" → ".env"）
    file_name = os.path.basename(request.GET.get('file_path') or '')
    file_path = (backup_dir / file_name).resolve()
    # 名前が空・media フォルダの直下でない・ファイルが無い場合は 404（ほかの場所のファイルは決して開かない）
    if not file_name or file_path.parent != backup_dir or not file_path.is_file():
        return JsonResponse(
            {
                'status': 'error',
                'message': 'ファイルが見つかりません。',
            },
            status=status.HTTP_404_NOT_FOUND,
        )
    # ファイルをダウンロードさせるレスポンスを作成する
    #   as_attachment=True: ブラウザで表示せず、ファイルとして保存させる
    response = FileResponse(
        open(file_path, 'rb'),
        as_attachment=True,
        filename=file_name,
    )
    # 送り終わった時（Django が close() を呼ぶ時）に、まず元の close()（開いたファイルを閉じる）を呼び、
    # そのあとファイルを消す（閉じてから消すので、Windows でも消せる。待つための別スレッドも要らない）
    original_close = response.close

    def close_then_delete():
        original_close()
        try:
            file_path.unlink()
        except OSError:
            pass  # 消せなくてもダウンロードには影響しない

    response.close = close_then_delete
    return response 

# ============================================================
# ヘルパー関数: タスクの実行と結果の保存
# ============================================================
# タスク関数を実行し、結果を非同期タスク（AsyncTask）のレコードに保存する（汎用版）。
#
# backup() から、本番では別スレッドで、テスト時はその場で呼ばれる。
# タスク関数の戻り値によって、AsyncTask の status と result を次のように更新する。
#   - ({'status': 'error', 'message': ...}, ...) の形のタプル
#       → status='error'、result=message（tasks.py のロード関数がエラー時に返す形）
#   - それ以外（ファイルパスの文字列 / None / 成功を表すタプル など）
#       → status='success'、result=戻り値（result は TextField（文字列の列）のため文字列に変換されて保存される）
#   - 実行中に例外が発生した場合
#       → status='error'、result=例外のメッセージ
#
# 引数:
#   task_id      : 更新する AsyncTask のタスクID
#   task_function: 実行するタスク関数（tasks.py の generate_〇〇 / load_〇〇 / delete_〇〇）
#   *args        : タスク関数に渡す位置引数（例: 開始日と終了日 / 一時ファイルのパス）
#   **kwargs     : タスク関数に渡すキーワード引数（現在の呼び出し元では未使用）
# 戻り値:
#   なし（結果は AsyncTask に保存される）
# 例外:
#   タスク関数内で発生した例外はすべてここで捕まえて AsyncTask に記録し、呼び出し元には投げない
def handle_task(task_id, task_function, *args, **kwargs):  
    try:  
        # タスク関数を実行し、戻り値を受け取る
        result = task_function(*args, **kwargs)  
        # タスク関数が明示的にエラーを返したかを判定する
        #   条件: 戻り値がタプル かつ 要素が1つ以上 かつ 先頭が辞書 かつ その 'status' が 'error'
        #   例: ({'status': 'error', 'message': '無効なファイルフォーマットです。'}, None)
        is_explicit_error = (  
            isinstance(result, tuple)  
            and len(result) > 0  
            and isinstance(result[0], dict)  
            and result[0].get('status') == 'error'  
        )  
        # タスクIDに対応する非同期タスクのレコードを取得する
        task = AsyncTask.objects.get(task_id=task_id)  
        if is_explicit_error:  
            # タスク関数がエラー情報を返した場合: エラー状態にし、メッセージを結果として記録する
            #   message が無い場合は既定の文言を入れる
            error_dict = result[0]  
            task.status = 'error'  
            task.result = error_dict.get(  
                'message',  
                'タスク関数が明示的なエラーを返しました。',  
            )  
        else:  
            # タスク関数が正常終了した場合: 成功状態にし、戻り値を結果として記録する
            task.status = 'success'  
            task.result = result  
        # タスクの状態と結果をDBに保存する（画面は check_backup_status でこの値を受け取る）
        task.save()  
    except Exception as e:  
        # タスク処理中に予期しないエラー（例外）が発生した場合
        try:  
            # エラーになったタスクのレコードを取得する
            task = AsyncTask.objects.get(task_id=task_id)  
            # タスクをエラー状態にし、例外のメッセージを結果として記録する
            task.status = 'error'  
            task.result = str(e)  
            # エラー内容をDBに保存する
            task.save()  
        except AsyncTask.DoesNotExist:  
            # 対応するタスクのレコードがすでに削除されている場合は、標準出力にログを出すだけにする
            print(  
                f'Error: AsyncTask with id {task_id} not found.'  
            )  