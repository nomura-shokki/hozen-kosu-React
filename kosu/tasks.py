import os
from django.conf import settings
import openpyxl
import pandas as pd
from .models import Business_Time_graph, kosu_division
from .utils.kosu_utils import kosu_division_dictionary





#--------------------------------------------------------------------------------------------------------





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





#--------------------------------------------------------------------------------------------------------





# 工数データバックアップ非同期処理
def generate_prediction(data_day, data_day2):
  # 期間内の工数データ取得
  kosu_filter = Business_Time_graph.objects.filter(
    work_day2__gte=data_day, work_day2__lte=data_day2
    )

  # Excelに書き出すためのデータを準備
  data = []
  # 取得した工数データを処理
  for kosu in kosu_filter:
    # 作業内容をリストに解凍
    kosu_list = list(kosu.time_work)
    # 作業詳細をリストに解凍
    detail_list = kosu.detail_work.split('$')
    # 工数定義区分取得
    def_filter = kosu_division.objects.filter(kosu_name=kosu.def_ver2)

    # リストの長さ取得
    max_length = max(len(kosu_list), len(detail_list))
    # 1要素ごとにExcelに書き込み
    for i in range(max_length):
      # 工数定義区分がある場合の処理
      if def_filter.exists():
        # 工数定義区分リスト作成
        choices_list, def_n = kosu_division_dictionary(kosu.def_ver2)

        # 作業内容を工数区分定義に変換
        for k in choices_list:
          # 工数区分定義の記号と作業内容が同じ場合の処理
          if k[0] == kosu_list[i]:
            # 作業詳細が空欄でない場合の処理
            if detail_list[i] != '':
              # 作業内容と作業詳細をセットで定義
              row = [
                  k[1] if i < len(kosu_list) else '',
                  detail_list[i] if i < len(detail_list) else '',
              ]
              # 作業内容と作業詳細を書き込み
              data.append(row)
              #ループから抜ける
              break

  # DataFrameに変換
  df = pd.DataFrame(data, columns=['工数定義区分', '作業詳細'])

  # フィルタリング条件に基づいて不要な行を削除
  df = df[~df['工数定義区分'].isin(['', '#', '$'])]
  df = df[df['作業詳細'] != '']

  # 工数定義区分と作業詳細の重複行を削除
  df = df.drop_duplicates(subset=['工数定義区分', '作業詳細'], keep='first')

  # 保存先のディレクトリ確認・作成
  media_dir = settings.MEDIA_ROOT
  if not os.path.exists(media_dir):
    os.makedirs(media_dir)

  # ファイル名作成と保存
  filename = f'工数予測データバックアップ_{data_day}_{data_day2}.xlsx'
  filepath = os.path.join(media_dir, filename)
  
  # Excelファイルをメモリ上で作成して保存
  with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
      df.to_excel(writer, index=False)

  # ファイルパスを返却
  return filepath





#--------------------------------------------------------------------------------------------------------


from django_q.tasks import async_task
from .models import Business_Time_graph, AsyncTask  # 必要なモデルをインポート

def delete_kosu_data(data_day, data_day2, task_id):
    """
    非同期で指定された日付範囲の工数データを削除するタスク。
    """
    try:
        # 工数データ取得
        kosu_obj = Business_Time_graph.objects.filter(work_day2__gte=data_day, work_day2__lte=data_day2)
        # 取得した工数データを削除
        deleted_count = kosu_obj.delete()

        # 成功したステータスを記録する
        AsyncTask.objects.filter(task_id=task_id).update(
            status='success',
            result=f'Deleted {deleted_count[0]} records.',
        )
    except Exception as e:
        # エラー時のステータスと結果記録
        AsyncTask.objects.filter(task_id=task_id).update(
            status='error',
            result=str(e),
        )