import unicodedata
from ..models import member, Business_Time_graph, kosu_division, administrator_data, Operation_history




#--------------------------------------------------------------------------------------------------------





# 半角文字入力チェック関数
def has_non_halfwidth_characters(input_string):
  for char in input_string:
    # Unicodeの文字幅カテゴリ 'Na' は「ナロー（半角）」を意味します。
    if unicodedata.east_asian_width(char) != 'Na':
      # 全角文字かそれ以外（例: 全角スペース、絵文字など）が検出されたらTrueを返す
      return True
    return False





#--------------------------------------------------------------------------------------------------------





# データ変更記録関数
def history_record(post_page, operation_models, status, operation_detail, request):
  try:
    name=member.objects.get(employee_no=request.session['login_No'])
  except member.DoesNotExist:
    name=''

  new_history = Operation_history(employee_no4=request.session['login_No'],
                                  name=name,
                                  post_page=post_page,
                                  operation_models=operation_models,
                                  status=status,
                                  operation_detail=operation_detail,)
  new_history.save()





#--------------------------------------------------------------------------------------------------------


from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

# ページネーションクラス
class CustomPagination(PageNumberPagination):
  page_size = 20  # デフォルトの設定値

  def __init__(self):
    # administrator_data から動的にページサイズを設定
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is not None:
      self.page_size = last_record.menu_row

  def get_paginated_response(self, data):
    return Response({
      'count': self.page.paginator.count,  # 合計件数
      'page_size': self.page_size,  # ページサイズをレスポンスに含める
      'results': data,  # 現在のページのデータ
    })






