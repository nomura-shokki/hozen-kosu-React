from django.db.models import Case, When, Value, IntegerField
from ..models import kosu_division, member, def_choice
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, DefSerializer, DefChoiceSerializer
from ..utils.main_utils import CustomPagination
import string



class DefVer(APIView):
  def get(self, request, *args, **kwargs):
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # データベースから全ての工数区分データを取得
    divisions = kosu_division.objects.all()

    # シリアライザーを使用してデータをシリアライズ
    serializer = DefSerializer(divisions, many=True)

    response_data = {
      'choices': serializer.data,
      'current_version': def_ver,
    }
    return Response(response_data)


  def post(self, request, *args, **kwargs):
    # POSTリクエスト取得
    selected_version = request.data.get('versionchoice')

    # 未選択時のエラーハンドリング
    if not selected_version:
      return Response({'status': 'error', 'message': 'Versionchoice is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # セッションに工数区分定義保存
    request.session['input_def'] = selected_version

    # 成功レスポンス
    return Response(status=status.HTTP_200_OK)



class DefList(APIView):
  def get(self, request):
    # ログイン情報をセッションから取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

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
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

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
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  def post(self, request):
    data = request.data

    if not data.get('kosu_name'):
      return Response({'status': 'error', 'message': '工数区分定義Ver名を入力してください'}, status=status.HTTP_400_BAD_REQUEST)

    if kosu_division.objects.filter(kosu_name=data.get('kosu_name')).exists():
      return Response({'status': 'error', 'message': '同一の工数区分定義Ver名が既に登録されています。'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DefSerializer(data=data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



class DefUpdate(APIView):
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    except kosu_division.DoesNotExist:
      return None


  def get(self, request, pk):
    def_instance = self.get_object(pk)
    if not def_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    member_data = member.objects.get(employee_no=login_no)
    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DefSerializer(def_instance)
    return Response(serializer.data)

  def put(self, request, pk):
    def_instance = self.get_object(pk)
    if not def_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    serializer = DefSerializer(def_instance, data=data)
    if serializer.is_valid():
      if data.get('kosu_name') != def_instance.kosu_name and kosu_division.objects.filter(kosu_name=data.get('kosu_name')).exists():
        return Response(
          {'status': 'error', 'message': '入力した工数区分定義Ver名はすでに登録されています。'},
          status=status.HTTP_400_BAD_REQUEST
        )
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



class DefDelete(APIView):
  def get_object(self, pk):
    try:
      return kosu_division.objects.get(id=pk)
    except kosu_division.DoesNotExist:
      return None


  def delete(self, request, pk):
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ログイン情報が正しくありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    def_instance = self.get_object(pk)
    if def_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)
    def_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)



class DefDetailList(APIView):
  def get(self, request):
    # ログイン情報をセッションから取得
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    # クエリパラメータで絞り込み条件を取得
    search_symbol = request.query_params.get('def_symbol', None)

    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # 絞り込みある場合はフィルタリング
    if search_symbol:
      detail_choice = detail_choice.filter(def_symbol=search_symbol)

    # ページネーション処理
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(detail_choice, request)
    serializer = DefChoiceSerializer(result_page, many=True)

    # 絞り込み選択肢取得
    symbol_list = list(def_choice.objects.values_list('def_symbol', flat=True).distinct().order_by('def_symbol'))

    # 通常のパージネーションレスポンスを取得
    response = paginator.get_paginated_response(serializer.data)
    
    # レスポンスデータに symbol_list を追加
    response.data['symbol_list'] = symbol_list
    
    return response



class DefDetailNew(APIView):
  def get(self, request):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    # 工数区分定義確認
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)

    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    serializer = DefSerializer(def_data, many=False)
    return Response(serializer.data)


  def post(self, request):
    data = request.data

    if def_choice.objects.filter(def_select=data.get('def_select')).exists():
      return Response({'status': 'error', 'message': '入力した作業詳細はすでに登録されています。'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = DefChoiceSerializer(data=data)
    if serializer.is_valid():
      serializer.save()
      return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



class DefDetailUpdate(APIView):
  def get_object(self, pk):
    try:
      return def_choice.objects.get(id=pk)
    except def_choice.DoesNotExist:
      return None


  def get(self, request, pk):
    # セッション値取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ユーザーが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    choice_instance = self.get_object(pk)
    if not choice_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 工数区分定義確認
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)

    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    symbol_list = []
    if def_data:
      count = 0
      for i in range(1, 51):
        if getattr(def_data, f'kosu_title_{i}'):
          count += 1
        else:
          break

      all_letters = string.ascii_uppercase + string.ascii_lowercase
      symbol_list = list(all_letters[:count])
      symbol_list.append("$")

    serializer = DefChoiceSerializer(choice_instance)

    return Response({
            'formData': serializer.data,
            'symbol_list': symbol_list
            })


  def put(self, request, pk):
    choice_instance = self.get_object(pk)
    if not choice_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    serializer = DefChoiceSerializer(choice_instance, data=data)
    if serializer.is_valid():
      if data.get('def_select') != choice_instance.def_select and def_choice.objects.filter(def_select=data.get('def_select')).exists():
        return Response(
          {'status': 'error', 'message': '入力した作業詳細はすでに登録されています。'},
          status=status.HTTP_400_BAD_REQUEST
        )
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)



class DefDetailDelete(APIView):
  def get_object(self, pk):
    try:
      return def_choice.objects.get(id=pk)
    except def_choice.DoesNotExist:
      return None


  def delete(self, request, pk):
    login_no = request.session.get('login_No')
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': 'ログイン情報が正しくありません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if not member_data.administrator:
      return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    choice_instance = self.get_object(pk)
    if choice_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)
    choice_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)





