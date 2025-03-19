import os
from django.conf import settings
import openpyxl
from .models import Business_Time_graph





# 工数データバックアップ非同期処理
def generate_kosu_backup(data_day, data_day2):
  # 新しいExcelブック作成
  wb = openpyxl.Workbook()
  ws = wb.active

  # ヘッダー作成
  headers = [
    '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直',
    '作業内容', '作業詳細', '残業時間', '昼休憩時間',
    '残業休憩時間1', '残業休憩時間2', '残業休憩時間3',
    '就業形態', '工数入力OK_NG', '休憩変更チェック',
    ]
  ws.append(headers)

  # 工数データ取得
  kosu_data = Business_Time_graph.objects.filter(
    work_day2__gte=data_day, work_day2__lte=data_day2
    )

  # データ書き込み
  for item in kosu_data:
    row = [
      item.employee_no3, str(item.name), item.def_ver2, item.work_day2,
      item.tyoku2, item.time_work, item.detail_work, item.over_time,
      item.breaktime, item.breaktime_over1, item.breaktime_over2,
      item.breaktime_over3, item.work_time, item.judgement,
      item.break_change,
      ]
    ws.append(row)

  # 保存先のディレクトリ確認・作成
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名作成と保存
  filename = f'工数データバックアップ_{data_day}_{data_day2}.xlsx'
  filepath = os.path.join(media_dir, filename)
  wb.save(filepath)

  # ファイルパスを返却
  return filepath
  