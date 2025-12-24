from ..models import member
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer
from ..utils.main_utils import CustomPagination




# 人員一覧
class MemberList(APIView):
  # GET時の動作
  def get(self, request):
    # セッションからデータ取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      # ログインユーザーのデータ取得
      member_data = member.objects.get(employee_no=login_no)
      # 権限がない場合はMenu画面へ
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      # 人員情報取得できない場合エラー
      return Response({'status': 'error', 'message': '人員情報が見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    # クエリパラメータで絞り込み条件を取得
    search_number = request.query_params.get('employee_no', None)
    search_shop = request.query_params.get('shop', None)

    # 人員データ全取得
    members = member.objects.all().order_by('employee_no')

    # 絞り込みある場合はフィルタリング
    if search_number:
      members = members.filter(employee_no__icontains=search_number)
    if search_shop:
      members = members.filter(shop=search_shop)

    # ページネーション処理
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(members, request)
    serializer = MemberSerializer(result_page, many=True)

    return paginator.get_paginated_response(serializer.data)



# 人員データ新規登録
class MemberNew(APIView):
  def get(self, request):
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '該当するデータが見つかりません'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.authority:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  def post(self, request):
    data = request.data

    if member.objects.filter(employee_no=data.get('employee_no')).exists():
      return Response(
        {'status': 'error', 'message': '入力した従業員番号はすでに登録されています'},
        status=status.HTTP_400_BAD_REQUEST
      )

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

    serializer = MemberSerializer(data=data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)




# 人員データ編集動作
class MemberUpdate(APIView):
  def get_object(self, pk):
    try:
      return member.objects.get(employee_no=pk)
    except member.DoesNotExist:
      return None


  def get(self, request, pk):
    # セッションからログイン情報を取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログインユーザーの権限を確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '権限確認中にエラーが発生しました'}, status=status.HTTP_403_FORBIDDEN)
    if not member_data.authority:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 指定された従業員データを取得
    member_instance = self.get_object(pk)
    if member_instance is None:
      return Response({'status': 'error', 'message': 'error', 'message': '人員データが確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # データをシリアライズして返却
    serializer = MemberSerializer(member_instance)
    return Response(serializer.data)


  def put(self, request, pk):
    # 特定の従業員データを取得
    member_instance = self.get_object(pk)
    if member_instance is None:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # クライアントから送られてきたデータをシリアライズ
    data = request.data
    serializer = MemberSerializer(member_instance, data=data)
    if serializer.is_valid():
      # 従業員番号の一意性確認
      if data.get('employee_no') != pk and member.objects.filter(employee_no=data.get('employee_no')).exists():
        return Response({'status': 'error', 'message': '入力した従業員番号はすでに登録されています'},status=status.HTTP_400_BAD_REQUEST)
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)




# 人員データ削除動作
class MemberDelete(APIView):
  def get_object(self, pk):
    try:
      return member.objects.get(employee_no=pk)
    except member.DoesNotExist:
      return None


  def delete(self, request, pk):
    # セッションからログイン情報を取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者情報取得
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '権限確認中にエラーが発生しました'}, status=status.HTTP_403_FORBIDDEN)
    if not member_data.authority:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    # 削除対象のオブジェクトを取得
    member_instance = self.get_object(pk)
    if member_instance is None:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # レコードを削除
    member_instance.delete()
    return Response({'status': 'error', 'message': 'Record deleted'}, status=status.HTTP_204_NO_CONTENT)

