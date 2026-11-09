# ============================================================
# ファイル名 : member_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : 人員（member）データの一覧・新規登録・編集・削除を行うAPI群。
#              人員管理画面（frontend/src/MemberPage/）から呼び出される。
#
# 主なクラス:
#   - MemberList   : 人員一覧の取得                 GET        /api/member_list/
#   - MemberNew    : ログイン者情報の取得・人員登録 GET/POST   /api/member_new/
#   - MemberUpdate : 人員1件の取得・更新            GET/PUT    /api/member_update/<従業員番号>/
#   - MemberDelete : 人員1件の削除                  DELETE     /api/member_delete/<従業員番号>/
#
# 権限       : すべて HasAuthority（ログイン済みかつ「権限」ありの人員のみ利用可能）
# 関連ファイル: models.py（member）, views/serializers.py（MemberSerializer）,
#              utils/main_utils.py（CustomPagination）, permissions.py, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.db.models import Case, When, Value, IntegerField  
from ..models import member
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer
from ..utils.main_utils import CustomPagination
from ..permissions import HasAuthority, IsAdministrator




# ------------------------------------------------------------
# MemberList: 人員一覧API
#   URL  : /api/member_list/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : 人員一覧をページネーション付きで返す。
#          従業員番号（部分一致）・ショップ（完全一致）で絞り込み可能。
# ------------------------------------------------------------
class MemberList(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 人員一覧を取得して返す（GET）。
  #
  # 「異動・退社」ショップの人員は一覧の末尾に並べ、それ以外は従業員番号順にする。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     employee_no (任意): 従業員番号の部分一致検索
  #     shop        (任意): ショップの完全一致検索
  #     page        (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: ページネーション済みの人員一覧（count / page_size / results）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの。この処理内では未使用）
    member_data = request.user

    # クエリパラメータから絞り込み条件を取得（指定がなければ None）
    search_number = request.query_params.get('employee_no', None)
    search_shop = request.query_params.get('shop', None)

    # 人員データを全件取得し、並び順を決める
    #   shop_order: 「異動・退社」なら 1、それ以外は 0 という並び替え用の一時的な列を追加
    #   → shop_order の昇順（在籍者が先）、次に従業員番号の昇順で並べる
    members = member.objects.annotate(  
        shop_order=Case(  
            When(shop='異動・退社', then=Value(1)),  
            default=Value(0),  
            output_field=IntegerField(),  
        )  
    ).order_by('shop_order', 'employee_no')  

    # 絞り込み条件がある場合はフィルタリング
    #   employee_no__icontains: 従業員番号に検索文字列を含むもの（部分一致）
    if search_number:
      members = members.filter(employee_no__icontains=search_number)
    # ショップは完全一致で絞り込む
    if search_shop:
      members = members.filter(shop=search_shop)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(members, request)
    # 取り出した人員データをJSONに変換できる形（辞書のリスト）にする
    serializer = MemberSerializer(result_page, many=True)

    # 件数・ページサイズ・データをまとめたレスポンスを返す
    return paginator.get_paginated_response(serializer.data)



# ------------------------------------------------------------
# MemberNew: 人員新規登録API
#   URL  : /api/member_new/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : ログイン者自身の人員データを返す（登録画面の初期表示用）
#   POST : 人員を新規登録する。休憩時間はショップに応じた初期値を自動設定する。
# ------------------------------------------------------------
class MemberNew(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # ログイン者自身の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: ログイン者の人員データ1件を要素とするリスト（JSON）
  def get(self, request):
    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 1件だけだがリスト形式で返すため、リストに包んで many=True でシリアライズする
    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  # 人員を新規登録する（POST）。
  #
  # 従業員番号の重複を確認したうえで、ショップに応じた休憩時間の初期値を
  # 送信データに追加し、バリデーション（入力チェック）を通れば保存する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に登録する人員の情報（従業員番号・氏名・ショップ等）
  # 戻り値:
  #   Response: 成功時は登録した人員データ（201）
  #             従業員番号が重複している場合・入力チェックに失敗した場合は 400 エラー
  def post(self, request):
    # 画面から送信された登録内容
    data = request.data

    # 同じ従業員番号の人員がすでに存在する場合は登録不可
    if member.objects.filter(employee_no=data.get('employee_no')).exists():
      return Response({'status': 'error', 'message': '入力した従業員番号はすでに登録されています。'}, status=status.HTTP_400_BAD_REQUEST)

    # 休憩時間の初期値を設定する
    #   キー名  : break_time{直の番号}（昼休憩） / break_time{直の番号}_over{1〜3}（残業休憩1〜3）
    #             直の番号 1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直
    #   値の形式: "#HHMMHHMM"（開始時刻と終了時刻。例: "#11401240" は 11:40〜12:40）
    # 組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）は、1直〜3直で専用の休憩パターンを使う
    if data.get('shop') in ['W1', 'W2', 'A1', 'A2', 'J', '組長以上(W,A)']:
      data.update({
        'break_time1': '#11401240',
        'break_time1_over1': '#17201735',
        'break_time1_over2': '#23350035',
        'break_time1_over3': '#04350450',
        'break_time2': '#14101510',
        'break_time2_over1': '#22002215',
        'break_time2_over2': '#04150515',
        'break_time2_over3': '#09150930',
        'break_time3': '#23500050',
        'break_time3_over1': '#06400655',
        'break_time3_over2': '#12551355',
        'break_time3_over3': '#17551810',
        'break_time4': '#12001300',
        'break_time4_over1': '#19001915',
        'break_time4_over2': '#01150215',
        'break_time4_over3': '#06150630',
        'break_time5': '#10401130',
        'break_time5_over1': '#15101520',
        'break_time5_over2': '#20202110',
        'break_time5_over3': '#01400150',
        'break_time6': '#21202210',
        'break_time6_over1': '#01500200',
        'break_time6_over2': '#07000750',
        'break_time6_over3': '#12201230',
      })
    # それ以外のショップは標準の休憩パターンを使う（常昼・連1直・連2直は組立系と同じ値）
    else:
      data.update({
        'break_time1': '#10401130',
        'break_time1_over1': '#15101520',
        'break_time1_over2': '#20202110',
        'break_time1_over3': '#01400150',
        'break_time2': '#17501840',
        'break_time2_over1': '#22302240',
        'break_time2_over2': '#03400430',
        'break_time2_over3': '#09000910',
        'break_time3': '#01400230',
        'break_time3_over1': '#07050715',
        'break_time3_over2': '#12151305',
        'break_time3_over3': '#17351745',
        'break_time4': '#12001300',
        'break_time4_over1': '#19001915',
        'break_time4_over2': '#01150215',
        'break_time4_over3': '#06150630',
        'break_time5': '#10401130',
        'break_time5_over1': '#15101520',
        'break_time5_over2': '#20202110',
        'break_time5_over3': '#01400150',
        'break_time6': '#21202210',
        'break_time6_over1': '#01500200',
        'break_time6_over2': '#07000750',
        'break_time6_over3': '#12201230',
      })

    # 送信データ＋休憩時間初期値をシリアライザに渡し、入力チェックを行う
    serializer = MemberSerializer(data=data)
    # 入力チェックOKならデータベースに保存し、登録内容を 201（作成成功）で返す
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)

    # 入力チェックNG（必須項目の不足・形式違いなど）の場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# MemberUpdate: 人員編集API
#   URL  : /api/member_update/<従業員番号>/
#   権限 : HasAuthority（権限ありの人員のみ）
#   GET  : 指定した従業員番号の人員データを返す（編集画面の初期表示用）
#   PUT  : 指定した従業員番号の人員データを更新する（従業員番号の変更も可能）
# ------------------------------------------------------------
class MemberUpdate(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 従業員番号から人員データを1件取得する。
  #
  # 引数:
  #   pk: 従業員番号（URLの <int:pk> 部分。主キーのIDではない点に注意）
  # 戻り値:
  #   member: 該当する人員データ。存在しない場合は None
  def get_object(self, pk):
    try:
      return member.objects.get(employee_no=pk)
    # 該当する人員がいない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except member.DoesNotExist:
      return None


  # 指定した人員のデータを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 従業員番号（URLから取得）
  # 戻り値:
  #   Response: 人員データ（JSON）。該当なしの場合は 404 エラー
  def get(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # URLで指定された従業員番号の人員データを取得
    member_instance = self.get_object(pk)
    # 該当する人員がいない場合は 404（見つからない）を返す
    if member_instance is None:
      return Response({'status': 'error', 'message': '人員データが確認できません。'}, status=status.HTTP_404_NOT_FOUND)

    # 人員データをJSONに変換できる形にして返す
    serializer = MemberSerializer(member_instance)
    return Response(serializer.data)


  # 指定した人員のデータを更新する（PUT）。
  #
  # 従業員番号を変更する場合は、変更後の番号が他の人員と重複していないかを確認する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の人員情報（全項目）
  #   pk     : 更新対象の従業員番号（URLから取得。変更前の番号）
  # 戻り値:
  #   Response: 成功時は更新後の人員データ（200）
  #             該当なしの場合は 404、重複・入力チェックNGの場合は 400 エラー
  def put(self, request, pk):
    # 更新対象の人員データを取得
    member_instance = self.get_object(pk)
    # 該当する人員がいない場合は 404 を返す
    if member_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 既存データと送信データをシリアライザに渡し、入力チェックの準備をする
    data = request.data
    serializer = MemberSerializer(member_instance, data=data)
    if serializer.is_valid():
      # 従業員番号の一意性確認:
      #   送信された従業員番号が変更前（pk）と異なり、かつ他の人員がその番号を使っている場合は更新不可
      if data.get('employee_no') != pk and member.objects.filter(employee_no=data.get('employee_no')).exists():
        return Response({'status': 'error', 'message': '入力した従業員番号はすでに登録されています。'},status=status.HTTP_400_BAD_REQUEST)
      # 問題なければデータベースに保存し、更新後の内容を 200（成功）で返す
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



# ------------------------------------------------------------
# MemberDelete: 人員削除API
#   URL    : /api/member_delete/<従業員番号>/
#   権限   : HasAuthority（権限ありの人員のみ）
#   DELETE : 指定した従業員番号の人員データを削除する
# ------------------------------------------------------------
class MemberDelete(APIView):
  # このAPIを利用できるのは「権限」ありのログイン者のみ
  permission_classes = [HasAuthority]
  # 従業員番号から人員データを1件取得する。
  #
  # 引数:
  #   pk: 従業員番号（URLの <int:pk> 部分）
  # 戻り値:
  #   member: 該当する人員データ。存在しない場合は None
  def get_object(self, pk):
    try:
      return member.objects.get(employee_no=pk)
    # 該当する人員がいない場合は None を返して呼び出し元で 404 にする
    except member.DoesNotExist:
      return None


  # 指定した人員のデータを削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の従業員番号（URLから取得）
  # 戻り値:
  #   Response: 成功時は 204（削除成功）。該当なしの場合は 404 エラー
  def delete(self, request, pk):
    # 削除対象の人員データを取得
    member_instance = self.get_object(pk)
    # 該当する人員がいない場合は 404 を返す
    if member_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # データベースから削除し、204（成功・返すデータなし）を返す
    #   ※工数データ・問い合わせ・操作履歴の氏名(name)は on_delete=SET_NULL のため、
    #     それらのデータは削除されずに残り、name が NULL（空）になる
    member_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)

