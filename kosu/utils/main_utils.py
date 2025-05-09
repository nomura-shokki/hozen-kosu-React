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





