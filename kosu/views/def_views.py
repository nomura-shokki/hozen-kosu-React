# ============================================================
# ファイル名 : def_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : 工数区分定義（kosu_division: 作業カテゴリの定義セット）と
#              作業詳細選択肢（def_choice: 作業詳細の文言と工数区分記号の組）の
#              一覧・新規登録・編集・削除、および使用する工数区分定義Verの切り替えを行うAPI群。
#              工数区分定義関連画面（frontend/src/DefinitionPage/）から呼び出される。
#
# 主なクラス:
#   - DefVer          : 工数区分定義Ver一覧取得・使用Ver切り替え GET/POST   /api/def_ver/
#   - DefList         : 工数区分定義の一覧取得                   GET        /api/def_list/
#   - DefSearch       : 使用中の工数区分定義の取得               GET        /api/def_search/
#   - DefNew          : ログイン者情報の取得・工数区分定義登録   GET/POST   /api/def_new/
#   - DefUpdate       : 工数区分定義1件の取得・更新              GET/PUT    /api/def_update/<ID>/
#   - DefDelete       : 工数区分定義1件の削除                    DELETE     /api/def_delete/<ID>/
#   - DefDetailList   : 作業詳細選択肢の一覧取得                 GET        /api/def_detail_list/
#   - DefDetailNew    : 使用中の工数区分定義取得・選択肢登録     GET/POST   /api/def_detail_new/
#   - DefDetailUpdate : 作業詳細選択肢1件の取得・更新            GET/PUT    /api/def_detail_update/<ID>/
#   - DefDetailDelete : 作業詳細選択肢1件の削除                  DELETE     /api/def_detail_delete/<ID>/
#
# 権限       : DefVer / DefSearch は IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#              それ以外はすべて IsAdministrator（ログイン済みかつ「管理者」の人員のみ利用可能）
# 関連ファイル: models.py（kosu_division, def_choice, member）,
#              views/serializers.py（DefSerializer, DefChoiceSerializer, MemberSerializer）,
#              utils/main_utils.py（CustomPagination）, permissions.py, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.db import transaction  # 複数の書き込みを「全部する / 全部しない」にまとめる
from django.db.models import Case, When, Value, IntegerField
from ..models import kosu_division, member, def_choice, Business_Time_graph
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, DefSerializer, DefChoiceSerializer
from ..utils.main_utils import CustomPagination
from ..permissions import IsAdministrator
# string: 英大文字・小文字の一覧（ascii_uppercase / ascii_lowercase）を使うための標準ライブラリ
import string



# ------------------------------------------------------------
# DefVer: 工数区分定義Ver切り替えAPI
#   URL  : /api/def_ver/
#   権限 : IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#   GET  : 登録済みの工数区分定義をすべてと、現在使用中のVer名を返す（切り替え画面の選択肢用）
#   POST : 選択されたVer名をセッションに保存し、以降の工数入力等で使う定義を切り替える
# ------------------------------------------------------------
class DefVer(APIView):
  # 工数区分定義の一覧と使用中のVer名を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: choices（全工数区分定義のリスト）と current_version（使用中のVer名）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request, *args, **kwargs):
    # セッションから、現在使用中の工数区分定義Ver名を取得
    def_ver = request.session.get('input_def')
    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # データベースから全ての工数区分定義を取得（切り替え先の選択肢になる）
    divisions = kosu_division.objects.all()

    # 工数区分定義をJSONに変換できる形（辞書のリスト）にする
    serializer = DefSerializer(divisions, many=True)

    # 選択肢と、画面で初期選択させる使用中のVer名をまとめて返す
    response_data = {
      'choices': serializer.data,
      'current_version': def_ver,
    }
    return Response(response_data)


  # 使用する工数区分定義Verを切り替える（POST）。
  #
  # 送信されたVer名をそのままセッションに保存する（存在チェックは行わない）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の versionchoice に切り替え先のVer名
  # 戻り値:
  #   Response: 成功時は 200（本文なし）。versionchoice が空の場合は 400 エラー
  def post(self, request, *args, **kwargs):
    # 画面で選択された工数区分定義Ver名を取得
    selected_version = request.data.get('versionchoice')

    # 未選択（空・未送信）の場合は 400 を返す
    if not selected_version:
      return Response({'status': 'error', 'message': 'Versionchoice is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # セッションの input_def（使用中の工数区分定義Ver名）を上書きする
    request.session['input_def'] = selected_version

    # 成功（200）を返す。返すデータはない
    return Response(status=status.HTTP_200_OK)



# ------------------------------------------------------------
# DefList: 工数区分定義一覧API
#   URL  : /api/def_list/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 工数区分定義を新しい順（IDの降順）にページネーション付きで返す
# ------------------------------------------------------------
class DefList(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 工数区分定義の一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params の page でページ番号を指定（CustomPagination が使用）
  # 戻り値:
  #   Response: ページネーション済みの工数区分定義一覧（count / page_size / results）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの。この処理内では未使用）
    member_data = request.user

    # 工数区分定義を全件、ID の降順（新しく登録したものが先頭）で取得
    defs = kosu_division.objects.all().order_by('-id')

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(defs, request)
    # 取り出した工数区分定義をJSONに変換できる形にする
    serializer = DefSerializer(result_page, many=True)

    # 件数・ページサイズ・データをまとめたレスポンスを返す
    return paginator.get_paginated_response(serializer.data)



# ------------------------------------------------------------
# DefSearch: 使用中の工数区分定義取得API
#   URL  : /api/def_search/
#   権限 : IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#   GET  : セッションで選択中のVer名と一致する工数区分定義を返す（工数区分定義確認画面用）
# ------------------------------------------------------------
class DefSearch(APIView):
  # 使用中の工数区分定義を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: Ver名が一致する工数区分定義のリスト（通常は1件。200）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request, *args, **kwargs):
    # セッションから、現在使用中の工数区分定義Ver名を取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # Ver名が使用中のものと一致する工数区分定義だけを取得（全件ではない）
    divisions = kosu_division.objects.filter(kosu_name=def_ver)

    # 工数区分定義をJSONに変換できる形（辞書のリスト）にする
    serializer = DefSerializer(divisions, many=True)

    # リスト形式のまま 200（成功）で返す
    return Response(serializer.data, status=status.HTTP_200_OK)



# ------------------------------------------------------------
# DefNew: 工数区分定義新規登録API
#   URL  : /api/def_new/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : ログイン者自身の人員データを返す（登録画面を開けるかの確認・初期表示用）
#   POST : 工数区分定義を新規登録する。Ver名の未入力・重複はエラーにする。
# ------------------------------------------------------------
class DefNew(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # ログイン者自身の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ1件を要素とするリスト（JSON）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、現在使用中の工数区分定義Ver名を取得（未ログイン状態の判定に使う）
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 1件だけだがリスト形式で返すため、リストに包んで many=True でシリアライズする
    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  # 工数区分定義を新規登録する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に登録内容
  #            （kosu_name: Ver名、kosu_title_N: 工数区分名、kosu_division_1_N〜3_N: 定義・作業内容・変動/固定）
  # 戻り値:
  #   Response: 成功時は登録した工数区分定義（200）
  #             Ver名が未入力・重複している場合、入力チェックに失敗した場合は 400 エラー
  def post(self, request):
    # 画面から送信された登録内容
    data = request.data

    # Ver名（kosu_name）が未入力の場合は登録不可
    if not data.get('kosu_name'):
      return Response({'status': 'error', 'message': '工数区分定義Ver名を入力してください'}, status=status.HTTP_400_BAD_REQUEST)

    # 同じVer名の工数区分定義がすでに存在する場合は登録不可
    #   （セッションには Ver名だけを保存し、各APIは Ver名で工数区分定義を探すため、重複すると特定できない）
    if kosu_division.objects.filter(kosu_name=data.get('kosu_name')).exists():
      return Response({'status': 'error', 'message': '同一の工数区分定義Ver名が既に登録されています。'}, status=status.HTTP_400_BAD_REQUEST)

    # 送信データをシリアライザに渡し、入力チェックを行う
    serializer = DefSerializer(data=data)
    # 入力チェックOKならデータベースに保存し、登録内容を 200（成功）で返す
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNG（形式違いなど）の場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# DefUpdate: 工数区分定義編集API
#   URL  : /api/def_update/<ID>/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 指定したIDの工数区分定義を返す（編集画面・削除確認画面の初期表示用）
#   PUT  : 指定したIDの工数区分定義を更新する（Ver名の変更も可能。ただし重複は不可）
# ------------------------------------------------------------
class DefUpdate(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから工数区分定義を1件取得する。
  #
  # 引数:
  #   pk: 工数区分定義のID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   kosu_division: 該当する工数区分定義。存在しない場合は None
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    # 該当するデータがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except kosu_division.DoesNotExist:
      return None


  # 指定した工数区分定義を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 工数区分定義のID（URLから取得）
  # 戻り値:
  #   Response: 工数区分定義（JSON）。該当なしの場合は 404 エラー
  def get(self, request, pk):
    # URLで指定されたIDの工数区分定義を取得
    def_instance = self.get_object(pk)
    # 該当するデータがない場合は 404（見つからない）を返す
    if not def_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 工数区分定義をJSONに変換できる形にして返す
    serializer = DefSerializer(def_instance)
    return Response(serializer.data)

  # 指定した工数区分定義を更新する（PUT）。
  #
  # Ver名を変更する場合は、変更後のVer名が他の工数区分定義と重複していないかを確認する。
  # Ver名を変えた時は、そのVerで入力した工数データの def_ver2 も、同じトランザクションの中で新しい名前にそろえる。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の工数区分定義（全項目）
  #   pk     : 更新対象の工数区分定義のID（URLから取得）
  # 戻り値:
  #   Response: 成功時は更新後の工数区分定義（200）
  #             該当なしの場合は 404、Ver名の重複・入力チェックNGの場合は 400 エラー
  def put(self, request, pk):
    # 更新対象の工数区分定義を取得
    def_instance = self.get_object(pk)
    # 該当するデータがない場合は 404 を返す
    if not def_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 既存データと送信データをシリアライザに渡し、入力チェックの準備をする
    data = request.data
    serializer = DefSerializer(def_instance, data=data)
    if serializer.is_valid():
      old_name = def_instance.kosu_name
      new_name = serializer.validated_data.get('kosu_name')
      # Ver名の一意性確認:
      #   送信されたVer名が変更前と異なり、かつ他の工数区分定義がそのVer名を使っている場合は更新不可
      if new_name != old_name and kosu_division.objects.filter(kosu_name=new_name).exists():
        return Response(
          {'status': 'error', 'message': '入力した工数区分定義Ver名はすでに登録されています。'},
          status=status.HTTP_400_BAD_REQUEST
        )
      # 保存する。Ver名を変えた時は、そのVerで入力した工数データ（def_ver2）も新しい名前にそろえる
      #   （そろえないと、その工数データの編集・集計の画面が「工数区分データが存在しません」になる）
      with transaction.atomic():
        serializer.save()
        if new_name != old_name:
          Business_Time_graph.objects.filter(def_ver2=old_name).update(def_ver2=new_name)
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# DefDelete: 工数区分定義削除API
#   URL    : /api/def_delete/<ID>/
#   権限   : IsAdministrator（管理者のみ）
#   DELETE : 指定したIDの工数区分定義を削除する（そのVerで入力した工数データが残っている間は削除しない）
# ------------------------------------------------------------
class DefDelete(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから工数区分定義を1件取得する。
  #
  # 引数:
  #   pk: 工数区分定義のID（URLの <int:pk> 部分）
  # 戻り値:
  #   kosu_division: 該当する工数区分定義。存在しない場合は None
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    # 該当するデータがない場合は None を返して呼び出し元で 404 にする
    except kosu_division.DoesNotExist:
      return None


  # 指定した工数区分定義を削除する（DELETE）。
  #
  # 工数データは Ver名を文字列（def_ver2）で持っているだけなので、そのVerで入力した工数データが
  # 残っている間は削除しない（削除すると、その工数データが開けなくなるため）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の工数区分定義のID（URLから取得）
  # 戻り値:
  #   Response: 成功時は 204（削除成功）。該当なしの場合は 404 エラー、
  #             そのVerで入力した工数データが残っている場合は 409 エラー
  def delete(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 削除対象の工数区分定義を取得
    def_instance = self.get_object(pk)
    # 該当するデータがない場合は 404 を返す
    if def_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)
    # このVerで入力した工数データが残っている間は消さない
    #   （工数データは Ver名を文字列（def_ver2）で持っているだけなので、消すとその工数データが開けなくなる）
    used = Business_Time_graph.objects.filter(def_ver2=def_instance.kosu_name).count()
    if used:
      return Response({'status': 'error', 'message': f'この工数区分定義で入力した工数データが {used} 件あるため、削除できません。'}, status=status.HTTP_409_CONFLICT)
    # データベースから削除し、204（成功・返すデータなし）を返す
    def_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)



# ------------------------------------------------------------
# DefDetailList: 作業詳細選択肢一覧API
#   URL  : /api/def_detail_list/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 作業詳細選択肢をページネーション付きで返す。
#          定義記号（完全一致）で絞り込み可能。絞り込み用の記号一覧も一緒に返す。
# ------------------------------------------------------------
class DefDetailList(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 作業詳細選択肢の一覧を返す（GET）。
  #
  # 定義記号が「$」（休憩）の選択肢は一覧の末尾に並べ、それ以外は定義記号順にする。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     def_symbol (任意): 定義記号の完全一致検索（例: "A"、"$"）
  #     page       (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: ページネーション済みの作業詳細選択肢一覧（count / page_size / results）に
  #             symbol_list（登録済みの定義記号の一覧）を追加したもの
  def get(self, request):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # クエリパラメータから絞り込み条件（定義記号）を取得（指定がなければ None）
    search_symbol = request.query_params.get('def_symbol', None)

    # 作業詳細選択肢を全件取得し、並び順を決める
    #   symbol_order: 定義記号が「$」（休憩）なら 1、それ以外は 0 という並び替え用の一時的な列を追加
    #   → symbol_order の昇順（工数区分の記号が先、休憩が最後）、次に定義記号の昇順で並べる
    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # 絞り込み条件がある場合は、定義記号の完全一致でフィルタリング
    if search_symbol:
      detail_choice = detail_choice.filter(def_symbol=search_symbol)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(detail_choice, request)
    # 取り出した作業詳細選択肢をJSONに変換できる形にする
    serializer = DefChoiceSerializer(result_page, many=True)

    # 絞り込みプルダウンの選択肢: 登録済みの定義記号を重複なしで記号順に並べたリスト（例: ["A", "B", "$"]）
    symbol_list = list(def_choice.objects.values_list('def_symbol', flat=True).distinct().order_by('def_symbol'))

    # 通常のページネーションレスポンス（count / page_size / results）を作成
    response = paginator.get_paginated_response(serializer.data)
    
    # レスポンスデータに symbol_list を追加して返す
    response.data['symbol_list'] = symbol_list
    
    return response



# ------------------------------------------------------------
# DefDetailNew: 作業詳細選択肢新規登録API
#   URL  : /api/def_detail_new/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 使用中の工数区分定義を返す（登録画面で選べる定義記号の範囲を決めるため）
#   POST : 作業詳細選択肢を新規登録する。同じ作業詳細の重複登録は不可。
# ------------------------------------------------------------
class DefDetailNew(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # 使用中の工数区分定義を返す（GET）。
  #
  # フロント側（DefDetailNew.tsx）は kosu_title_N が入っている数だけ記号 A, B, C… を
  # 定義記号の選択肢として表示する。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: 使用中の工数区分定義1件（JSON）
  #             該当する定義がない場合は 401、同じVer名が複数ある場合は 400 エラー
  def get(self, request):
    # セッションから、現在使用中の工数区分定義Ver名を取得
    def_ver = request.session.get('input_def')

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 使用中のVer名と一致する工数区分定義を検索
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)

    # 該当なしの場合は 401（フロント側でログイン画面へ戻される）、
    # 同じVer名が複数ある場合はどれを使うか決められないため 400 を返す
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    # 1件だけ存在することが確定したので、その1件を取り出す
    def_data = def_query_set.first()

    # 工数区分定義をJSONに変換できる形にして返す
    serializer = DefSerializer(def_data, many=False)
    return Response(serializer.data)


  # 作業詳細選択肢を新規登録する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に def_symbol（定義記号）と def_select（作業詳細の文言）
  # 戻り値:
  #   Response: 成功時は登録した作業詳細選択肢（201）
  #             作業詳細が重複している場合・入力チェックに失敗した場合は 400 エラー
  def post(self, request):
    # 画面から送信された登録内容
    data = request.data

    # 同じ作業詳細（def_select）がすでに登録されている場合は登録不可
    #   （工数入力画面は選んだ作業詳細の文言で選択肢を探し、その定義記号を工数区分に反映するため、
    #     同じ文言が複数あると区別できない）
    if def_choice.objects.filter(def_select=data.get('def_select')).exists():
      return Response({'status': 'error', 'message': '入力した作業詳細はすでに登録されています。'}, status=status.HTTP_400_BAD_REQUEST)

    # 送信データをシリアライザに渡し、入力チェックを行う
    serializer = DefChoiceSerializer(data=data)
    # 入力チェックOKならデータベースに保存し、登録内容を 201（作成成功）で返す
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)

    # 入力チェックNG（必須項目の不足・定義記号が選択肢外など）の場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# DefDetailUpdate: 作業詳細選択肢編集API
#   URL  : /api/def_detail_update/<ID>/
#   権限 : IsAdministrator（管理者のみ）
#   GET  : 指定したIDの作業詳細選択肢と、選択可能な定義記号の一覧を返す（編集画面・削除確認画面用）
#   PUT  : 指定したIDの作業詳細選択肢を更新する（作業詳細の重複は不可）
# ------------------------------------------------------------
class DefDetailUpdate(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから作業詳細選択肢を1件取得する。
  #
  # 引数:
  #   pk: 作業詳細選択肢のID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   def_choice: 該当する作業詳細選択肢。存在しない場合は None
  def get_object(self, pk):
    try:
      return def_choice.objects.get(id=pk)
    # 該当するデータがない場合は None を返して呼び出し元で 404 にする
    except def_choice.DoesNotExist:
      return None


  # 指定した作業詳細選択肢と、定義記号の選択肢を返す（GET）。
  #
  # 定義記号の選択肢は、使用中の工数区分定義で工数区分名（kosu_title_N）が
  # 1番目から連続して入っている数だけ A, B, C… を並べ、最後に「$」（休憩）を加えたもの。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 作業詳細選択肢のID（URLから取得）
  # 戻り値:
  #   Response: formData（作業詳細選択肢）と symbol_list（定義記号の選択肢）
  #             該当なしの場合は 404、使用中の工数区分定義がない場合は 401、複数ある場合は 400 エラー
  def get(self, request, pk):
    # セッションから、現在使用中の工数区分定義Ver名を取得
    def_ver = request.session.get('input_def')

    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # URLで指定されたIDの作業詳細選択肢を取得し、なければ 404 を返す
    choice_instance = self.get_object(pk)
    if not choice_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 使用中のVer名と一致する工数区分定義を検索
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)

    # 該当なしの場合は 401、同じVer名が複数ある場合は 400 を返す
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    # 1件だけ存在することが確定したので、その1件を取り出す
    def_data = def_query_set.first()

    # 定義記号の選択肢を作成する
    symbol_list = []
    if def_data:
      # 工数区分名1〜50 を順に確認し、空の項目が出てくるまでの個数を数える
      #   例: kosu_title_1〜3 に値があり kosu_title_4 が空 → count = 3
      count = 0
      for i in range(1, 51):
        if getattr(def_data, f'kosu_title_{i}'):
          count += 1
        else:
          break

      # 記号は 英大文字 A〜Z → 英小文字 a〜z の順で工数区分1, 2, 3… に対応する
      #   例: count = 3 → ["A", "B", "C"]
      all_letters = string.ascii_uppercase + string.ascii_lowercase
      symbol_list = list(all_letters[:count])
      # 最後に休憩を表す記号「$」を追加
      symbol_list.append("$")

    # 作業詳細選択肢をJSONに変換できる形にする
    serializer = DefChoiceSerializer(choice_instance)

    # 編集フォームの初期値と定義記号の選択肢をまとめて返す
    return Response({
            'formData': serializer.data,
            'symbol_list': symbol_list
            })


  # 指定した作業詳細選択肢を更新する（PUT）。
  #
  # 作業詳細の文言を変更する場合は、変更後の文言が他の選択肢と重複していないかを確認する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の def_symbol（定義記号）と def_select（作業詳細）
  #   pk     : 更新対象の作業詳細選択肢のID（URLから取得）
  # 戻り値:
  #   Response: 成功時は更新後の作業詳細選択肢（200）
  #             該当なしの場合は 404、作業詳細の重複・入力チェックNGの場合は 400 エラー
  def put(self, request, pk):
    # 更新対象の作業詳細選択肢を取得し、なければ 404 を返す
    choice_instance = self.get_object(pk)
    if not choice_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 既存データと送信データをシリアライザに渡し、入力チェックの準備をする
    data = request.data
    serializer = DefChoiceSerializer(choice_instance, data=data)
    if serializer.is_valid():
      # 作業詳細の一意性確認:
      #   送信された作業詳細が変更前と異なり、かつ他の選択肢がその文言を使っている場合は更新不可
      if data.get('def_select') != choice_instance.def_select and def_choice.objects.filter(def_select=data.get('def_select')).exists():
        return Response(
          {'status': 'error', 'message': '入力した作業詳細はすでに登録されています。'},
          status=status.HTTP_400_BAD_REQUEST
        )
      # 問題なければデータベースに保存し、更新後の内容を 200（成功）で返す
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# DefDetailDelete: 作業詳細選択肢削除API
#   URL    : /api/def_detail_delete/<ID>/
#   権限   : IsAdministrator（管理者のみ）
#   DELETE : 指定したIDの作業詳細選択肢を削除する
# ------------------------------------------------------------
class DefDetailDelete(APIView):
  # このAPIを利用できるのは「管理者」のログイン者のみ
  permission_classes = [IsAdministrator]
  # IDから作業詳細選択肢を1件取得する。
  #
  # 引数:
  #   pk: 作業詳細選択肢のID（URLの <int:pk> 部分）
  # 戻り値:
  #   def_choice: 該当する作業詳細選択肢。存在しない場合は None
  def get_object(self, pk):
    try:
      return def_choice.objects.get(id=pk)
    # 該当するデータがない場合は None を返して呼び出し元で 404 にする
    except def_choice.DoesNotExist:
      return None


  # 指定した作業詳細選択肢を削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の作業詳細選択肢のID（URLから取得）
  # 戻り値:
  #   Response: 成功時は 204（削除成功）。該当なしの場合は 404 エラー
  def delete(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 削除対象の作業詳細選択肢を取得し、なければ 404 を返す
    choice_instance = self.get_object(pk)
    if choice_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)
    # データベースから削除し、204（成功・返すデータなし）を返す
    choice_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)





