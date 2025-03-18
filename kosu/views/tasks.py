import openpyxl
from io import BytesIO
import urllib.parse
from django.http import JsonResponse
from kosu.models import Business_Time_graph

def backup_kosu_data(data_day, data_day2):
  try:
    # 新しいExcelブック作成
    wb = openpyxl.Workbook()
    ws = wb.active

    # ヘッダー情報
    headers = [
      '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直', '作業内容',
      '作業詳細', '残業時間', '昼休憩時間', '残業休憩時間1', '残業休憩時間2',
      '残業休憩時間3', '就業形態', '工数入力OK_NG', '休憩変更チェック'
      ]
    ws.append(headers)

    # 工数データ取得
    kosu_data = Business_Time_graph.objects.filter(work_day2__gte=data_day, work_day2__lte=data_day2)

    # Excelへのデータ追加
    for item in kosu_data:
      row = [
        item.employee_no3, str(item.name), item.def_ver2, item.work_day2,
        item.tyoku2, item.time_work, item.detail_work, item.over_time,
        item.breaktime, item.breaktime_over1, item.breaktime_over2,
        item.breaktime_over3, item.work_time, item.judgement, item.break_change,
        ]
      ws.append(row)

    # メモリ上にExcelファイルを作成して保存
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    filename = f'工数データバックアップ_{data_day}.xlsx'
    return {
      "success": True,
      "file_content": excel_file,
      "filename": filename
      }
  except Exception as e:
    print(f"バックアップ処理でエラー発生: {e}")
    return {"success": False, "error": str(e)}
        