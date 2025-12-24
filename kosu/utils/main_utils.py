import inspect
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.db import models
from kosu import models as myapp_models
from ..models import administrator_data



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



def validate_employee_no_logic(value, member_model):
  # 1. 空欄チェック: 値が存在しない、または空文字列の場合は空欄を許可する
  if not value:
    return True, None
  
  # 2. 整数変換チェック
  try:
    value_int = int(value)
  except ValueError:
    # intに変換できなかった場合 (例: 'abc'などの文字列)
    return False, 'は自然数で入力して下さい'

  # 3. 自然数チェック (1以上の整数)
  if value_int <= 0:
    return False, 'は自然数で入力して下さい'
  
  # 4. 従業員番号の存在チェック
  try:
    member_model.objects.get(employee_no=value_int)
    return True, value_int # バリデーション成功
  except member_model.DoesNotExist:
    return False, 'に入力された従業員番号の人員は存在しません'





def get_all_model_names_in_myapp():
  model_names = []
  
  # myapp_modelsモジュールのメンバーを全て取得
  for name, obj in inspect.getmembers(myapp_models):
    if (inspect.isclass(obj) and 
      issubclass(obj, models.Model) and 
      not obj._meta.abstract and 
      not obj._meta.proxy and
      obj.__module__ == myapp_models.__name__):
      model_names.append(name)

  return model_names
