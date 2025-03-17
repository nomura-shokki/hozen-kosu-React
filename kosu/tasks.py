import os
from celery import shared_task
import openpyxl
import datetime
from django.conf import settings
from .models import Business_Time_graph

@shared_task
def kosu_backup(data_day, data_day2):
  # 今日の日付取得
  today = datetime.date.today().strftime('%Y%m%d')

  # 新しいExcelブック作成
  wb = openpyxl.Workbook()
  ws = wb.active

  # ヘッダー書き込み
  headers = [
    '従業員番号', 
    '氏名', 
    '工数区分定義Ver', 
    '就業日', 
    '直', 
    '作業内容',
    '作業詳細', 
    '残業時間', 
    '昼休憩時間', 
    '残業休憩時間1', 
    '残業休憩時間2',
    '残業休憩時間3', 
    '就業形態', 
    '工数入力OK_NG',
    '休憩変更チェック',
    ]
  ws.append(headers)

  # データ取得
  kosu_data = Business_Time_graph.objects.filter(work_day2__gte=data_day, work_day2__lte=data_day2)
  for item in kosu_data:
    row = [
      item.employee_no3, 
      str(item.name), 
      item.def_ver2, 
      item.work_day2,
      item.tyoku2, 
      item.time_work, 
      item.detail_work, 
      item.over_time,
      item.breaktime, 
      item.breaktime_over1, 
      item.breaktime_over2,
      item.breaktime_over3, 
      item.work_time, 
      item.judgement,
      item.break_change,
      ]
    ws.append(row)

  # ファイル保存先のパスを生成
  file_path = os.path.join(settings.MEDIA_ROOT, f'{today}_工数データバックアップ_{data_day}~{data_day2}.xlsx')

  # ファイルを保存
  wb.save(file_path)
  # ファイルパスを返却
  return file_path  

