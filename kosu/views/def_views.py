from ..models import kosu_division, member
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, DefSerializer
from ..utils.main_utils import CustomPagination



class DefVer(APIView):
  def get(self, request, *args, **kwargs):
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=401)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=401)

    # データベースから全ての工数区分データを取得
    divisions = kosu_division.objects.all()

    # シリアライザーを使用してデータをシリアライズ
    serializer = DefSerializer(divisions, many=True)

    # JSON形式で選択肢データ（choices）と現在のバージョンを返す
    return Response({
      'choices': serializer.data,  # シリアライズされた工数区分データ
      'current_version': def_ver  # 現在の工数区分定義のバージョン
    }, status=status.HTTP_200_OK)  # HTTP 200で成功レスポンスを返す


  def post(self, request, *args, **kwargs):
    # POSTリクエスト取得
    selected_version = request.data.get('versionchoice')

    # 未選択時のエラーハンドリング
    if not selected_version:
      return Response({'error': 'Versionchoice is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # セッションに工数区分定義保存
    request.session['input_def'] = selected_version

    # 成功レスポンス
    return Response(status=status.HTTP_200_OK)



class DefList(APIView):
  def get(self, request):
    # ログイン情報をセッションから取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_404_NOT_FOUND)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_404_NOT_FOUND)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    defs = kosu_division.objects.all().order_by('-id')

    # ページネーション処理
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(defs, request)
    serializer = DefSerializer(result_page, many=True)

    return paginator.get_paginated_response(serializer.data)



class DefSearch(APIView):
  def get(self, request, *args, **kwargs):
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=401)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません'}, status=401)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません'}, status=status.HTTP_404_NOT_FOUND)

    # データベースから全ての工数区分データを取得
    divisions = kosu_division.objects.filter(kosu_name=def_ver)

    # シリアライザーを使用してデータをシリアライズ
    serializer = DefSerializer(divisions, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)



class DefNew(APIView):
  def get(self, request):
    # ユーザーの従業員番号、使用工数区分定義取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    if not login_no:
      return Response({'error': 'ログイン情報が確認できません。'}, status=status.HTTP_404_NOT_FOUND)
    if not def_ver:
      return Response({'error': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_404_NOT_FOUND)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません'}, status=status.HTTP_404_NOT_FOUND)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  def post(self, request):
    data = request.data

    if not data.get('kosu_name'):
      return Response({'error': '工数区分定義Ver名を入力してください'}, status=status.HTTP_400_BAD_REQUEST)

    if kosu_division.objects.filter(kosu_name=data.get('kosu_name')).exists():
      return Response({'error': '同一の工数区分定義Ver名が既に登録されています'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DefSerializer(data=data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class DefUpdate(APIView):
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    except kosu_division.DoesNotExist:
      return None

  def get(self, request, pk):
    def_instance = self.get_object(pk)
    if not def_instance:
      return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_404_NOT_FOUND)

    member_data = member.objects.get(employee_no=login_no)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DefSerializer(def_instance)
    return Response(serializer.data)

  def put(self, request, pk):
    def_instance = self.get_object(pk)
    if not def_instance:
      return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    serializer = DefSerializer(def_instance, data=data)
    if serializer.is_valid():
      if data.get('kosu_name') != def_instance.kosu_name and kosu_division.objects.filter(kosu_name=data.get('kosu_name')).exists():
        return Response(
          {'error': '入力した工数区分定義Ver名はすでに登録されています'},
          status=status.HTTP_400_BAD_REQUEST
        )
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class DefDelete(APIView):
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    except kosu_division.DoesNotExist:
      return None

  def delete(self, request, pk):
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません'}, status=status.HTTP_404_NOT_FOUND)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ログイン情報が正しくありません'}, status=status.HTTP_404_NOT_FOUND)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません'}, status=status.HTTP_403_FORBIDDEN)

    def_instance = self.get_object(pk)
    if def_instance is None:
      return Response({'error': 'Record not found'}, status=status.HTTP_404_NOT_FOUND)
    def_instance.delete()
    return Response({'message': 'Record deleted'}, status=status.HTTP_204_NO_CONTENT)



