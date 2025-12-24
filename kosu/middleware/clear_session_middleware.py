import threading



# スレッドローカルオブジェクト作成
_request_local = threading.local()
# 各リクエスト処理中、現在のHTTPリクエストオブジェクトをスレッドローカルストレージに保存
class CurrentRequestMiddleware:
  # ミドルウェア初期化
  def __init__(self, get_response):
    # 次のミドルウェアかget_respons取得
    self.get_response = get_response


  # リクエスト処理
  def __call__(self, request):
    # 現在のリクエストオブジェクトをスレッドローカルに保存
    _request_local.request = request
    # 次のミドルウェアかget_respons取得
    response = self.get_response(request)

    # スレッドローカル内のリクエストオブジェクト削除(メモリリーク、クロススレッドデータ汚染防止)
    _request_local.request = None
    return response



# 現在のスレッドのHTTPリクエストオブジェクト取得
def get_current_request():
  # スレッドローカルストレージから'request'属性値取得
  return getattr(_request_local, 'request', None)

