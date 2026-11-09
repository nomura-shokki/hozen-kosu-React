# ============================================================
# ファイル名 : inquiry_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : 問い合わせ（inquiry_data）の一覧・新規登録・詳細表示・編集・削除を行うAPI群。
#              問い合わせ関連画面（frontend/src/InquirPage/）から呼び出される。
#              あわせて、メインメニュー画面に表示する「お知らせ（ポップアップ通知）」の
#              追加・削除（既読化）・前詰めもここで行う。
#
# お知らせ（ポップアップ通知）の仕組み:
#   - 問い合わせ担当者向け: 管理者設定（administrator_data）の pop_up1〜5 / pop_up_id1〜5
#       新しい問い合わせの登録・問い合わせ内容の編集時に追加される
#   - 問い合わせ者本人向け: 人員データ（member）の pop_up1〜5 / pop_up_id1〜5
#       自分の問い合わせに回答が付いたときに追加される
#   pop_upN にはお知らせの文言、pop_up_idN には対象の問い合わせIDが入る。
#   空いている最も若い番号の枠に追加し、枠が5つとも埋まっている場合は追加しない。
#   問い合わせ詳細を開く（既読）・問い合わせを削除すると該当枠を空にし、後ろの枠を前へ詰める。
#
# 主なクラス:
#   - InquirList   : 問い合わせ一覧の取得                     GET            /api/inquir_list/
#   - InquirNew    : ログイン者情報の取得・問い合わせ登録     GET/POST       /api/inquir_new/
#   - InquirDetail : 問い合わせ1件の詳細取得（お知らせ既読化） GET            /api/inquir_detail/<ID>/
#   - InquirUpdate : 問い合わせ1件の取得・更新・削除          GET/PUT/DELETE /api/inquir_update/<ID>/
#
# 権限       : すべて IsLoggedIn（ログイン済みなら誰でも。settings.py の既定値）
#              ※InquirUpdate の GET のみ、問い合わせ者本人または問い合わせ担当者以外を 403 にする
# 関連ファイル: models.py（inquiry_data, member, administrator_data）,
#              views/serializers.py（InquirSerializer, MemberSerializer）,
#              utils/main_utils.py（CustomPagination）, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
from ..models import member, administrator_data, inquiry_data
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, InquirSerializer
from ..utils.main_utils import CustomPagination





# ------------------------------------------------------------
# InquirList: 問い合わせ一覧API
#   URL  : /api/inquir_list/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : 問い合わせを新しい順にページネーション付きで返す。
#          従業員番号（部分一致）・内容選択（完全一致）で絞り込み可能。
#          絞り込み用に、問い合わせをしたことがある人員の一覧も一緒に返す。
# ------------------------------------------------------------
class InquirList(APIView):
  # 問い合わせ一覧を取得して返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     item      (任意): 内容選択（要望 / 不具合 / 問い合わせ）の完全一致検索
  #     member_id (任意): 問い合わせ者の従業員番号の部分一致検索
  #     page      (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: inquir_data（ページネーション済みの問い合わせ一覧: count / page_size / results）と
  #             member_data（問い合わせをしたことがある人員の一覧）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、ログイン時に選択された工数区分定義Verを取得（未ログイン状態の判定に使う）
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの。この処理内では未使用）
    member_data = request.user

    # クエリパラメータから絞り込み条件を取得（指定がなければ None）
    item = request.query_params.get('item')
    member_id = request.query_params.get('member_id')

    # 問い合わせを全件、ID の降順（新しい問い合わせが先頭）で取得
    #   select_related('name'): 氏名（人員データへの外部キー）を同じSQLでまとめて取得する
    inquirs = inquiry_data.objects.select_related('name').all().order_by('-id')

    # 絞り込み条件がある場合はフィルタリング
    #   employee_no2__icontains: 問い合わせ者の従業員番号に検索文字列を含むもの（部分一致）
    if member_id:
      inquirs = inquirs.filter(employee_no2__icontains=member_id)
    # 内容選択は完全一致で絞り込む
    if item:
      inquirs = inquirs.filter(content_choice=item)

    # 絞り込みプルダウン用: 問い合わせデータに登場する従業員番号を重複なしで集め、その人員データを取得
    inquir_member = list(inquiry_data.objects.values_list('employee_no2', flat=True).order_by('employee_no2').distinct())
    member_filter = member.objects.filter(employee_no__in=inquir_member)

    # ページネーション処理: 管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(inquirs, request)
    # 問い合わせ・人員データをJSONに変換できる形（辞書のリスト）にする
    inquir_serializer = InquirSerializer(result_page, many=True)
    member_serializer = MemberSerializer(member_filter, many=True)

    # 送信データ: ページネーション済みの問い合わせ一覧と、絞り込み用の人員一覧
    response_data = {
      'inquir_data': paginator.get_paginated_response(inquir_serializer.data).data,
      'member_data': member_serializer.data,
    }
    return Response(response_data)



# ------------------------------------------------------------
# InquirNew: 問い合わせ新規登録API
#   URL  : /api/inquir_new/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : ログイン者自身の人員データを返す（登録画面の初期表示用）
#   POST : 問い合わせを新規登録し、問い合わせ担当者向けのお知らせを追加する。
# ------------------------------------------------------------
class InquirNew(APIView):
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


  # 問い合わせを新規登録する（POST）。
  #
  # 問い合わせ者はログイン者自身とし、回答は空で登録する。
  # 登録後、管理者設定のお知らせ枠（pop_up1〜5）の空いている最初の枠に
  # 「〇〇さんからの新しい問い合わせがあります。」を書き込む。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に content_choice（内容選択）と inquiry（問い合わせ内容）
  # 戻り値:
  #   Response: 成功メッセージ（200）
  #             ※シリアライザによる入力チェックは行っていない
  def post(self, request):
    # ログイン者の人員データ（問い合わせ者として登録する）
    member_data = request.user

    # 画面から送信された登録内容
    data = request.data

    # 画面から受け付ける項目（これ以外の送信項目は無視する）
    updatable_fields = ['content_choice', 'inquiry']

    # 問い合わせデータを作成（まだ保存しない）
    #   employee_no2: セッションの login_No（ログイン者の従業員番号）
    #   name        : ログイン者の人員データ（外部キー）
    #   answer      : 回答は登録時点では空
    new_inquiry = inquiry_data(employee_no2=request.session['login_No'], name=member_data, answer='')

    # 受け付ける項目のうち、送信されてきたものだけを問い合わせデータに書き込む
    for field in updatable_fields:
      if field in data:
        setattr(new_inquiry, field, data[field])

    # 問い合わせデータをデータベースに保存（新規登録）
    new_inquiry.save()

    # 最新（IDが最大）の管理者設定を取得
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # IDが最大の問い合わせ（＝直前に登録した問い合わせ）を取得し、お知らせのリンク先IDに使う
    inquiry_data_id = inquiry_data.objects.order_by('id').last()
    # 問い合わせ担当者向けお知らせの書き込み:
    #   pop_up1 → pop_up5 の順に確認し、最初に見つかった空き枠に文言と問い合わせIDを書き込んで終了する
    for i in range(1, 6):
      pop_up_field = f'pop_up{i}'
      pop_up_id_field = f'pop_up_id{i}'
      if getattr(admin_data, pop_up_field) in ["", None]:
        # 管理者設定（同じID）のレコードを更新する
        administrator_data.objects.update_or_create(
          id=admin_data.id,
          defaults={
            pop_up_id_field: inquiry_data_id.id,
            pop_up_field: f'{member_data.name}さんからの新しい問い合わせがあります。'
          }
        )
        break

    # 成功メッセージを返す
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# ------------------------------------------------------------
# InquirDetail: 問い合わせ詳細API
#   URL  : /api/inquir_detail/<ID>/
#   権限 : IsLoggedIn（ログイン済みなら誰でも）
#   GET  : 指定したIDの問い合わせ・ログイン者・問い合わせ者の情報と、前後の問い合わせIDを返す。
#          あわせて、この問い合わせに関するお知らせを「既読」として削除する。
# ------------------------------------------------------------
class InquirDetail(APIView):
  # IDから問い合わせデータを1件取得する。
  #
  # 引数:
  #   pk: 問い合わせのID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   inquiry_data: 該当する問い合わせ。存在しない場合は None
  def get_object(self, pk):
    try:
      return inquiry_data.objects.get(id=pk)
    # 該当するデータがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except inquiry_data.DoesNotExist:
      return None

  # 問い合わせの詳細を返す（GET）。
  #
  # 処理の流れ:
  #   1. ログイン者が問い合わせ者本人なら、本人向けお知らせからこの問い合わせの分を削除して前詰め
  #   2. ログイン者が問い合わせ担当者なら、担当者向けお知らせからこの問い合わせの分を削除して前詰め
  #   3. 「次へ」「前へ」ボタン用に、前後の問い合わせIDを求める
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 問い合わせのID（URLから取得）
  # 戻り値:
  #   Response: inquir_data（問い合わせ）/ login_data（ログイン者）/ inquir_member_data（問い合わせ者）/
  #             next_id（次の問い合わせID。なければ None）/ before_id（前の問い合わせID。なければ None）
  #             該当なしの場合は 404、問い合わせ者の人員データがない場合は 401 エラー
  def get(self, request, pk):
    # URLで指定されたIDの問い合わせを取得
    inquir_instance = self.get_object(pk)
    # 該当するデータがない場合は 404（見つからない）を返す
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 問い合わせ者（従業員番号 employee_no2）の人員データを取得
    #   問い合わせ者の人員データが削除されている場合は 401 を返す
    try:
      inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '質問者の人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 最新（IDが最大）の管理者設定を取得（問い合わせ担当者の判定とお知らせ削除に使う）
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者が問い合わせ者本人の場合: 本人向けお知らせ（回答通知）を既読にする
    if inquir_member.employee_no == member_data.employee_no:
      # 本人向けお知らせの削除:
      #   pop_up_id1〜5 のうち、この問い合わせID と一致する最初の枠を空にする
      #   （DBの値は文字列、pk は数値のため、両方 str() にそろえて比較する）
      inquir_member_changed = False
      for i in range(1, 6):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        if str(getattr(inquir_member, pop_up_id_field)) == str(pk):
          setattr(inquir_member, pop_up_id_field, '')
          setattr(inquir_member, pop_up_field, '')
          inquir_member_changed = True
          break

      # 本人向けお知らせの前詰め（削除した場合のみ）:
      #   枠1〜4 を順に見て、文言が空の枠があれば次の枠の内容を移し、次の枠を空にする
      #   例: [A, 空, C, D, 空] → [A, C, D, 空, 空]
      if inquir_member_changed:
        for i in range(1, 5):
          pop_up_id_field = f'pop_up_id{i}'
          pop_up_field = f'pop_up{i}'
          next_pop_up_id_field = f'pop_up_id{i+1}'
          next_pop_up_field = f'pop_up{i+1}'

          if getattr(inquir_member, pop_up_field) in ['', None]:
            setattr(inquir_member, pop_up_id_field, getattr(inquir_member, next_pop_up_id_field))
            setattr(inquir_member, pop_up_field, getattr(inquir_member, next_pop_up_field))
            setattr(inquir_member, next_pop_up_id_field, '')
            setattr(inquir_member, next_pop_up_field, '')
        
        # 削除・前詰めの結果をまとめて最後に一度だけ保存（途中で何度も書き込まないため）
        inquir_member.save()

    # ログイン者が問い合わせ担当者（管理者設定の担当者従業員番号1〜3 のいずれか）の場合:
    # 担当者向けお知らせ（新規・編集通知）を既読にする
    #   ※担当者従業員番号は文字列項目のため、ログイン者の従業員番号を str() にして比較する
    if admin_data and (admin_data.administrator_employee_no1 == str(member_data.employee_no) or \
      admin_data.administrator_employee_no2 == str(member_data.employee_no) or \
      admin_data.administrator_employee_no3 == str(member_data.employee_no)):
      
      # 担当者向けお知らせの削除: この問い合わせID と一致する最初の枠を空にする
      admin_data_changed = False
      for i in range(1, 6):
        pop_up_id_field = f'pop_up_id{i}'
        pop_up_field = f'pop_up{i}'
        if str(getattr(admin_data, pop_up_id_field)) == str(pk):
          setattr(admin_data, pop_up_id_field, '')
          setattr(admin_data, pop_up_field, '')
          admin_data_changed = True
          break

      # 担当者向けお知らせの前詰め（削除した場合のみ）:
      #   枠1〜4 を順に見て、問い合わせIDが空の枠があれば次の枠の内容を移し、次の枠を空にする
      #   （本人向けは「文言」が空かどうか、こちらは「ID」が空かどうかで判定している）
      if admin_data_changed:
        for i in range(1, 5):
          pop_up_id_field = f'pop_up_id{i}'
          pop_up_field = f'pop_up{i}'
          next_pop_up_id_field = f'pop_up_id{i+1}'
          next_pop_up_field = f'pop_up{i+1}'

          if getattr(admin_data, pop_up_id_field) in ['', None]:
            setattr(admin_data, pop_up_id_field, getattr(admin_data, next_pop_up_id_field))
            setattr(admin_data, pop_up_field, getattr(admin_data, next_pop_up_field))
            setattr(admin_data, next_pop_up_id_field, '')
            setattr(admin_data, next_pop_up_field, '')
        
        # 削除・前詰めの結果をまとめて最後に一度だけ保存
        admin_data.save()

    # 次の問い合わせ: 今のIDより大きいIDのうち最小のもの（なければ None）
    next_record_obj = inquiry_data.objects.filter(id__gt=pk).order_by('id').first()
    next_record_id = next_record_obj.id if next_record_obj else None

    # 前の問い合わせ: 今のIDより小さいIDのうち最大のもの（なければ None）
    before_record_obj = inquiry_data.objects.filter(id__lt=pk).order_by('-id').first()
    before_record_id = before_record_obj.id if before_record_obj else None

    # 問い合わせ・ログイン者・問い合わせ者をJSONに変換できる形にする
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



# ------------------------------------------------------------
# InquirUpdate: 問い合わせ編集API
#   URL    : /api/inquir_update/<ID>/
#   権限   : IsLoggedIn（ログイン済みなら誰でも）
#            ※GET のみ、問い合わせ者本人または問い合わせ担当者以外は 403 を返す
#   GET    : 指定したIDの問い合わせとログイン者の情報を返す（編集画面の初期表示用）
#   PUT    : 問い合わせを更新し、変更内容に応じて担当者向け／本人向けのお知らせを追加する
#   DELETE : 問い合わせを削除し、その問い合わせに関するお知らせも削除して前詰めする
# ------------------------------------------------------------
class InquirUpdate(APIView):
  # IDから問い合わせデータを1件取得する。
  #
  # 引数:
  #   pk: 問い合わせのID（URLの <int:pk> 部分。主キー）
  # 戻り値:
  #   inquiry_data: 該当する問い合わせ。存在しない場合は None
  def get_object(self, pk):
    try:
      return inquiry_data.objects.get(id=pk)
    # 該当するデータがない場合は None を返して呼び出し元で 404 にする
    except inquiry_data.DoesNotExist:
      return None


  # 編集する問い合わせを返す（GET）。
  #
  # 編集画面を開けるのは、問い合わせ者本人と問い合わせ担当者（管理者設定の担当者従業員番号1〜3）のみ。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 問い合わせのID（URLから取得）
  # 戻り値:
  #   Response: inquir_data（問い合わせ）と login_data（ログイン者）
  #             該当なしの場合は 404、本人でも担当者でもない場合は 403 エラー
  def get(self, request, pk):
    # URLで指定されたIDの問い合わせを取得し、なければ 404 を返す
    inquir_instance = self.get_object(pk)
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 最新（IDが最大）の管理者設定を取得（問い合わせ担当者の判定に使う）
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 問い合わせ担当者の従業員番号1〜3（文字列項目。空欄の場合もある）
    admin_list_raw = [
      admin_data.administrator_employee_no1,
      admin_data.administrator_employee_no2,
      admin_data.administrator_employee_no3
    ]
    # 空欄や数字以外を除き、数値に変換した担当者従業員番号のリストを作る
    #   例: ["123", "", None] → [123]
    admin_list = []
    for a in admin_list_raw:
      if a and str(a).strip().isdigit():
        admin_list.append(int(a))

    # ログイン者が問い合わせ者本人でも問い合わせ担当者でもない場合は 403（権限なし）を返す
    if int(member_data.employee_no) != int(inquir_instance.employee_no2) and int(member_data.employee_no) not in admin_list:
      return Response({'status': 'error', 'message': '権限がありません。'}, status=status.HTTP_403_FORBIDDEN)

    # 問い合わせ・ログイン者をJSONに変換できる形にする
    inquir_serializer = InquirSerializer(inquir_instance)
    login_serializer = MemberSerializer(member_data, many=False)

    # 送信データ（画面側は login_data の administrator（管理者）が true の場合のみ回答欄を表示する）
    response_data = {
      'inquir_data': inquir_serializer.data,
      'login_data': login_serializer.data,
    }

    return Response(response_data)


  # 問い合わせを更新する（PUT）。
  #
  # 保存前に「どの項目が変わったか」を調べ、
  #   - 内容選択・問い合わせ内容が変わった → 担当者向けお知らせ「ID〇の問い合わせが編集されました。」
  #   - 回答が変わった                     → 本人向けお知らせ「ID〇の問い合わせに回答が来ています。」
  # をそれぞれ空いている最初の枠に追加する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に更新後の問い合わせ（全項目）
  #   pk     : 更新対象の問い合わせのID（URLから取得）
  # 戻り値:
  #   Response: 成功時は更新後の問い合わせ（200）
  #             該当なしの場合は 404、問い合わせ者の人員データがない場合は 401、入力チェックNGの場合は 400 エラー
  def put(self, request, pk):
    # ログイン者の人員データ（この処理内では未使用）
    member_data = request.user

    # 更新対象の問い合わせを取得し、なければ 404 を返す
    inquir_instance = self.get_object(pk)
    if not inquir_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 既存データと送信データをシリアライザに渡し、入力チェックの準備をする
    data = request.data
    serializer = InquirSerializer(inquir_instance, data=data)

    # 最新（IDが最大）の管理者設定を取得（担当者向けお知らせの書き込み先）
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 問い合わせ者の人員データを取得（本人向けお知らせの書き込み先）。なければ 401 を返す
    try:
      inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '質問者の人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    if serializer.is_valid():
      # 値が変わった項目名を集める入れ物（set: 重複しない集合）
      changed_fields = set() 
      # 入力チェック済みの各項目について、保存前の値と比べて変わったものを記録する
      for field, new_value in serializer.validated_data.items():
          original_value = getattr(inquir_instance, field, None)
          
          # 値が異なるかチェック（型やフォーマットの違いに注意）
          if original_value != new_value:
              changed_fields.add(field)

      # 内容選択または問い合わせ内容が変わった場合: 担当者に編集されたことを知らせる
      if 'content_choice' in changed_fields or 'inquiry' in changed_fields:
        # 担当者向けお知らせ: 空いている最初の枠に編集通知を書き込んで保存し、終了する
        for i in range(1, 6):
          pop_up_attr = f'pop_up{i}'
          pop_up_id_attr = f'pop_up_id{i}'
          if getattr(admin_data, pop_up_attr) in ['', None]:
            setattr(admin_data, pop_up_attr, f'ID{pk}の問い合わせが編集されました。')
            setattr(admin_data, pop_up_id_attr, pk)
            admin_data.save()
            break

      # 回答が変わった場合: 問い合わせ者に回答が来たことを知らせる
      #   （編集画面の回答欄は管理者にのみ表示される）
      if 'answer' in changed_fields:
        # 本人向けお知らせ: 問い合わせ者の空いている最初の枠に回答通知を書き込んで保存し、終了する
        for i in range(1, 6):
          pop_up_attr = f'pop_up{i}'
          pop_up_id_attr = f'pop_up_id{i}'
          if getattr(inquir_member, pop_up_attr) in ['', None]:
            setattr(inquir_member, pop_up_attr, f'ID{pk}の問い合わせに回答が来ています。')
            setattr(inquir_member, pop_up_id_attr, pk)
            inquir_member.save()
            break

      # 問い合わせ本体をデータベースに保存し、更新後の内容を 200（成功）で返す
      serializer.save()
      return Response(serializer.data, status=status.HTTP_200_OK)
    # 入力チェックNGの場合は 400 を返す
    return Response({'status': 'error', 'message': 'バリテーションエラー'}, status=status.HTTP_400_BAD_REQUEST)


  # 問い合わせを削除する（DELETE）。
  #
  # 削除した問い合わせへのリンクが残らないよう、本人向け・担当者向けのお知らせから
  # この問い合わせIDの枠をすべて空にして前詰めし、最後に問い合わせ本体を削除する。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の問い合わせのID（URLから取得）
  # 戻り値:
  #   Response: 成功時は 204（削除成功）
  #             該当なしの場合は 404、問い合わせ者の人員データがない場合は 401 エラー
  def delete(self, request, pk):
    # 削除対象の問い合わせを取得し、なければ 404 を返す
    inquir_instance = self.get_object(pk)
    if inquir_instance is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 問い合わせ者の人員データを取得（本人向けお知らせの削除先）。なければ 401 を返す
    try:
      inquir_member = member.objects.get(employee_no=inquir_instance.employee_no2)
    except member.DoesNotExist:
      return Response({'status': 'error', 'message': '質問者の人員情報が見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 最新（IDが最大）の管理者設定を取得（担当者向けお知らせの削除先）
    #   ※ last() はデータが無いとき例外ではなく None を返すため、この except に入ることはない
    try:
      admin_data = administrator_data.objects.order_by("id").last()
    except administrator_data.DoesNotExist:
      return Response({'status': 'error', 'message': '設定データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)


    # 本人向けお知らせの削除: この問い合わせID と一致する枠をすべて空にする（まだ保存しない）
    for i in range(1, 6):
      pop_up_id_attr = f'pop_up_id{i}'
      pop_up_attr = f'pop_up{i}'
      if getattr(inquir_member, pop_up_id_attr) == str(pk):
        setattr(inquir_member, pop_up_id_attr, '')
        setattr(inquir_member, pop_up_attr, '')

    # 本人向けお知らせの前詰め: 文言が空の枠があれば次の枠の内容を移し、次の枠を空にする（まだ保存しない）
    for i in range(1, 5):
      pop_up_attr = f'pop_up{i}'
      pop_up_id_attr = f'pop_up_id{i}'
      next_pop_up_attr = f'pop_up{i + 1}'
      next_pop_up_id_attr = f'pop_up_id{i + 1}'

      if getattr(inquir_member, pop_up_attr) in ['', None]:
        setattr(inquir_member, pop_up_attr, getattr(inquir_member, next_pop_up_attr))
        setattr(inquir_member, pop_up_id_attr, getattr(inquir_member, next_pop_up_id_attr))
        setattr(inquir_member, next_pop_up_attr, '')
        setattr(inquir_member, next_pop_up_id_attr, '')
    
    # 本人向けお知らせの変更を最後に一度だけ保存
    inquir_member.save()

    # 担当者向けお知らせの削除: この問い合わせID と一致する枠をすべて空にする（まだ保存しない）
    for i in range(1, 6):
      pop_up_id_attr = f"pop_up_id{i}"
      pop_up_attr = f"pop_up{i}"
      if getattr(admin_data, pop_up_id_attr) == str(pk):
        setattr(admin_data, pop_up_id_attr, '')
        setattr(admin_data, pop_up_attr, '')

    # 担当者向けお知らせの前詰め: 文言が空の枠があれば次の枠の内容を移し、次の枠を空にする（まだ保存しない）
    for i in range(1, 5):
      pop_up_attr = f"pop_up{i}"
      pop_up_id_attr = f"pop_up_id{i}"
      next_pop_up_attr = f"pop_up{i + 1}"
      next_pop_up_id_attr = f"pop_up_id{i + 1}"
      if getattr(admin_data, pop_up_attr) in ["", None]:
        setattr(admin_data, pop_up_attr, getattr(admin_data, next_pop_up_attr))
        setattr(admin_data, pop_up_id_attr, getattr(admin_data, next_pop_up_id_attr))
        setattr(admin_data, next_pop_up_attr, '')
        setattr(admin_data, next_pop_up_id_attr, '')

    # 担当者向けお知らせの変更を最後に一度だけ保存
    admin_data.save()

    # 問い合わせ本体をデータベースから削除し、204（成功・返すデータなし）を返す
    inquir_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)
