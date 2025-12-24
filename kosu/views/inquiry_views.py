from ..models import member, administrator_data, inquiry_data
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, InquirSerializer
from ..utils.main_utils import CustomPagination





class InquirList(APIView):
  # GET時の動作
  def get(self, request):
    # セッションからデータ取得
    login_no = request.session.get('login_No')
    def_ver = request.session.get('input_def')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # クエリパラメータで絞り込み条件を取得
    item = request.query_params.get('item')
    member_id = request.query_params.get('member_id')

    # 問い合わせデータ全取得
    inquirs = inquiry_data.objects.select_related('name').all().order_by('-id')

    # 絞り込みある場合はフィルタリング
    if member_id:
      inquirs = inquirs.filter(employee_no2__icontains=member_id)
    if item:
      inquirs = inquirs.filter(content_choice=item)

    # 問い合わせ者の人員情報取得
    inquir_member = list(inquiry_data.objects.values_list('employee_no2', flat=True).order_by('employee_no2').distinct())
    member_filter = member.objects.filter(employee_no__in=inquir_member)

    # ページネーション処理
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(inquirs, request)
    inquir_serializer = InquirSerializer(result_page, many=True)
    member_serializer = MemberSerializer(member_filter, many=True)

    # 送信データ
    response_data = {
      'inquir_data': paginator.get_paginated_response(inquir_serializer.data).data,
      'member_data': member_serializer.data,
    }
    return Response(response_data)



class InquirNew(APIView):
  # GET時の動作
  def get(self, request):
    # セッションからデータ取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
      if not member_data.authority:
        return Response({'status': 'error', 'message': 'アクセス権限がありません。'}, status=status.HTTP_403_FORBIDDEN)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    serializer = MemberSerializer([member_data], many=True)
    return Response(serializer.data)


  def post(self, request):
    login_no = request.session.get('login_No')

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data

    # 更新可能なフィールドを定義
    updatable_fields = ['content_choice', 'inquiry']

    # 問い合わせデータの新規作成
    new_inquiry = inquiry_data(employee_no2=request.session['login_No'], name=member_data, answer='')

    for field in updatable_fields:
      if field in data:
        setattr(new_inquiry, field, data[field])

    # 問い合わせデータ更新
    new_inquiry.save()

    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    inquiry_data_id = inquiry_data.objects.order_by('id').last()
    # ポップアップ書き込み処理
    for i in range(1, 6):
      pop_up_field = f'pop_up{i}'
      pop_up_id_field = f'pop_up_id{i}'
      if getattr(admin_data, pop_up_field) in ["", None]:
        administrator_data.objects.update_or_create(
          id=admin_data.id,
          defaults={
            pop_up_id_field: inquiry_data_id.id,
            pop_up_field: f'{member_data.name}さんからの新しい問い合わせがあります。'
          }
        )
        break

    return Response({'status': 'success', 'message': 'データが更新されました。'})



class InquirDetail(APIView):
  # 指定IDの問い合わせデータ取得
  def get_object(self, pk):
    try:
      return inquiry_data.objects.get(id=pk)
    except inquiry_data.DoesNotExist:
      return None


  # GET時の動作
  def get(self, request, pk):
    # 問い合わせデータ取得
    inquir_instance = self.get_object(pk)
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # セッションからデータ取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 質問者データ確認
    try:
      inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '質問者の人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 個人ポップアップ削除処理
    for i in range(1, 6):
      pop_up_id_field = f'pop_up_id{i}'
      pop_up_field = f'pop_up{i}'
      if str(getattr(inquir_member, pop_up_id_field)) == str(pk):
        member.objects.update_or_create(
          employee_no=inquir_instance.employee_no2,
          defaults={pop_up_id_field: '', pop_up_field: ''}
        )
        # メンバー情報再取得
        inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
        break

    # 個人ポップアップ移行処理(ポップアップデータを前詰め)
    for i in range(1, 5):
      pop_up_id_field = f'pop_up_id{i}'
      pop_up_field = f'pop_up{i}'
      next_pop_up_id_field = f'pop_up_id{i+1}'
      next_pop_up_field = f'pop_up{i+1}'

      if getattr(inquir_member, pop_up_field) in ['', None]:
        member.objects.update_or_create(
          employee_no=inquir_instance.employee_no2,
          defaults={
            pop_up_id_field: getattr(inquir_member, next_pop_up_id_field),
            pop_up_field: getattr(inquir_member, next_pop_up_field),
            next_pop_up_id_field: '',
            next_pop_up_field: ''
          }
        )
        # メンバー情報再取得
        inquir_member = member.objects.get(employee_no=inquir_member.employee_no)

    # 管理者通知ポップアップ削除処理
    if admin_data.administrator_employee_no1 == str(login_no) or \
      admin_data.administrator_employee_no2 == str(login_no) or \
      admin_data.administrator_employee_no3 == str(login_no):
      for i in range(1, 6):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        if str(getattr(admin_data, pop_up_id_field)) == str(pk):
          administrator_data.objects.update_or_create(
            id=admin_data.id, defaults={pop_up_id_field: '', pop_up_field: ''}
          )
          # 設定データ再取得
          admin_data = administrator_data.objects.order_by('id').last()
          break

      # 管理者通知ポップアップ移行処理(ポップアップデータを前詰め)
      for i in range(1, 5):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        next_pop_up_id_field = f'pop_up_id{i+1}'
        next_pop_up_field = f'pop_up{i+1}'

        if getattr(admin_data, pop_up_id_field) in ['', None]:
          administrator_data.objects.update_or_create(
            id=admin_data.id,
            defaults={
              pop_up_id_field: getattr(admin_data, next_pop_up_id_field),
              pop_up_field: getattr(admin_data, next_pop_up_field),
              next_pop_up_id_field: '',
              next_pop_up_field: ''
            }
          )
          # 設定データ再取得
          admin_data = administrator_data.objects.order_by('id').last()

    # 次・前のデータの取得
    next_record_obj = inquiry_data.objects.filter(id__gt=pk).order_by('id').first()
    next_record_id = next_record_obj.id if next_record_obj else None

    # 前のレコード
    before_record_obj = inquiry_data.objects.filter(id__lt=pk).order_by('-id').first()
    before_record_id = before_record_obj.id if before_record_obj else None

    # データ変換
    inquir_serializer = InquirSerializer(inquir_instance)
    login_serializer = MemberSerializer(member_data, many=False)
    inquir_member_serializer = MemberSerializer(inquir_member, many=False)

    # 送信データ
    response_data = {
      'inquir_data': inquir_serializer.data,
      'login_data': login_serializer.data,
      'inquir_member_data': inquir_member_serializer.data,
      'next_id': next_record_id,
      'before_id': before_record_id,
    }

    return Response(response_data)



class InquirUpdate(APIView):
  # 指定IDの問い合わせデータ取得
  def get_object(self, pk):
    try:
      return inquiry_data.objects.get(id=pk)
    except inquiry_data.DoesNotExist:
      return None


  # GET時の動作
  def get(self, request, pk):
    # 問い合わせデータ取得
    inquir_instance = self.get_object(pk)
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # セッションからデータ取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if int(login_no) != int(inquir_instance.employee_no2) or \
      int(login_no) in [admin_data.administrator_employee_no1, admin_data.administrator_employee_no2, admin_data.administrator_employee_no3]:
      return Response({'status': 'error', 'message': '権限がありません。'}, status=status.HTTP_403_FORBIDDEN)


    # データ変換
    inquir_serializer = InquirSerializer(inquir_instance)
    login_serializer = MemberSerializer(member_data, many=False)

    # 送信データ
    response_data = {
      'inquir_data': inquir_serializer.data,
      'login_data': login_serializer.data,
    }

    return Response(response_data)


  def put(self, request, pk):
    # セッションからデータ取得
    login_no = request.session.get('login_No')

    # 未ログインや定義が未定義の場合はログイン画面へ
    if not login_no:
      return Response({'status': 'error', 'message': 'ログイン情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者データ確認
    try:
      member_data = member.objects.get(employee_no=login_no)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 問い合わせデータ取得
    inquir_instance = self.get_object(pk)
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    data = request.data
    serializer = InquirSerializer(inquir_instance, data=data)

    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if serializer.is_valid():
      changed_fields = set() 
      # 変更の有無とフィールドをチェック
      for field, new_value in serializer.validated_data.items():
          original_value = getattr(inquir_instance, field, None)
          
          # 値が異なるかチェック（型やフォーマットの違いに注意）
          if original_value != new_value:
              changed_fields.add(field)

      # 問い合わせの内容に変更のあった場合
      if 'content_choice' in changed_fields or 'inquiry' in changed_fields:
        # 管理者へのポップアップ通知
        for i in range(1, 6):
          pop_up_attr = f'pop_up{i}'
          pop_up_id_attr = f'pop_up_id{i}'
          if getattr(admin_data, pop_up_attr) in ['', None]:
            administrator_data.objects.update_or_create(
              id=admin_data.id,
              defaults={
                pop_up_attr: f'ID{pk}の問い合わせが編集されました。',
                pop_up_id_attr: pk,
              }
            )
            break

      # 回答に変更があった場合
      if 'answer' in changed_fields:
        # 問い合わせ者に回答通知
        for i in range(1, 6):
          pop_up_attr = f'pop_up{i}'
          pop_up_id_attr = f'pop_up_id{i}'
          if getattr(member_data, pop_up_attr) in ['', None]:
            member.objects.update_or_create(
              employee_no=login_no,
              defaults={
                pop_up_attr: f'ID{pk}の問い合わせに回答が来ています。',
                pop_up_id_attr: pk,
              },
            )
            break

      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)


  def delete(self, request, pk):
    # 問い合わせデータ取得
    inquir_instance = self.get_object(pk)
    if inquir_instance is None:
      return Response({'status': 'error', 'message': 'Record not found'}, status=status.HTTP_401_UNAUTHORIZED)

    # 質問者データ確認
    try:
      inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '質問者の人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)


    # 削除する問い合わせに関する通知を削除
    for i in range(1, 6):
      pop_up_id_attr = f'pop_up_id{i}'
      pop_up_attr = f'pop_up{i}'
      if getattr(inquir_member, pop_up_id_attr) == str(pk):
        member.objects.update_or_create(
          employee_no=inquir_instance.employee_no2,
          defaults={pop_up_id_attr: '', pop_up_attr: ''}
        )
    # 問い合わせ者の人員情報再取得
    inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)

    # 問い合わせ者の通知情報整理
    for i in range(1, 5):
      pop_up_attr = f'pop_up{i}'
      pop_up_id_attr = f'pop_up_id{i}'
      next_pop_up_attr = f'pop_up{i + 1}'
      next_pop_up_id_attr = f'pop_up_id{i + 1}'

      if getattr(inquir_member, pop_up_attr) in ['', None]:
        member.objects.update_or_create(
          employee_no=inquir_instance.employee_no2,
          defaults={
            pop_up_attr: getattr(inquir_member, next_pop_up_attr),
            pop_up_id_attr: getattr(inquir_member, next_pop_up_id_attr),
            next_pop_up_attr: '',
            next_pop_up_id_attr: ''
          }
        )
        # 問い合わせ者の人員情報再取得
        inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)

    # 削除する問い合わせに関する通知を削除
    for i in range(1, 6):
      pop_up_id_attr = f"pop_up_id{i}"
      pop_up_attr = f"pop_up{i}"
      if getattr(admin_data, pop_up_id_attr) == str(pk):
        administrator_data.objects.update_or_create(
          id=admin_data.id,
          defaults={pop_up_id_attr: '', pop_up_attr: ''}
        )
    # 設定再取得
    admin_data = administrator_data.objects.order_by('id').last()

    # 管理者用通知整理
    for i in range(1, 5):
      pop_up_attr = f"pop_up{i}"
      pop_up_id_attr = f"pop_up_id{i}"
      next_pop_up_attr = f"pop_up{i + 1}"
      next_pop_up_id_attr = f"pop_up_id{i + 1}"
      if getattr(admin_data, pop_up_attr) in ["", None]:
        administrator_data.objects.update_or_create(
          id=admin_data.id,
          defaults={
            pop_up_attr: getattr(admin_data, next_pop_up_attr),
            pop_up_id_attr: getattr(admin_data, next_pop_up_id_attr),
            next_pop_up_attr: '',
            next_pop_up_id_attr: ''
          }
        )

    # レコードを削除
    inquir_instance.delete()
    return Response({'status': 'error', 'message': 'Record deleted'}, status=status.HTTP_204_NO_CONTENT)










