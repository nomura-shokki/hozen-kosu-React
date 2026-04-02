from django.shortcuts import get_object_or_404
from ..models import member, Business_Time_graph, kosu_division
from .kosu_utils import kosu_sort
from .kosu_utils import create_kosu
from .kosu_utils import kosu_division_dictionary
from .kosu_utils import get_def_library_data
import datetime



# 班員入力工数Excel出力関数
def excel_function(employee_no_data, wb, year, month, request, member_kosu_data):
  # 人員データ取得
  member_obj = get_object_or_404(member, employee_no=employee_no_data)

  # 最終日取得
  select_month = datetime.date(year_end := (year + 1 if month == 12 else year), 
                              month_end := (1 if month == 12 else month + 1), 1)
  day_end = (select_month - datetime.timedelta(days=1)).day

  # Excelに班員のシート作成
  member_sheet = wb.create_sheet(title=member_obj.name)
  member_sheet.cell(row=1, column=1, value=f"{member_obj.name}の{year}年{month}月の勤務状況")

  # 工数データ書き込み
  for day in range(1, day_end + 1):
    current_date = datetime.date(year, month, day)
    kosu_obj = member_kosu_data.get(current_date)

    # 初期化
    time_display_list, work_list, def_list, graph_list = [], [], [], []
    integrity, work, tyoku, over_time = 'NG', '', '', 0
    fluctuation_total = 0
    fixed_total = 0

    # 工数データある場合の処理
    if kosu_obj:
      # データ取得と書き換え
      integrity = 'OK' if kosu_obj.judgement else 'NG'
      work = kosu_obj.work_time or ''
      tyoku = { '1': '1直', '2': '2直', '3': '3直', '4': '常昼', '5': '1直(連2)', '6': '2直(連2)' }.get(kosu_obj.tyoku2, '')
      over_time = kosu_obj.over_time or 0

      # 工数区分定義バージョンある場合の処理
      if kosu_obj.def_ver2:
        # 作業内容と作業詳細を直によって表示変更
        work_list, detail_list = kosu_sort(kosu_obj, member_obj)
        # 作業時間、作業内容リスト作成
        time_display_list = create_kosu(work_list, detail_list, kosu_obj, member_obj, request)
        # 工数区分定義リスト取得
        def_list, def_num = get_def_library_data(kosu_obj.def_ver2)
        # 作業内容用記号定義
        str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:def_num]
        # 定義区分別の累積工数取得
        graph_list = [kosu_obj.time_work.count(i) * 5 for i in str_list]
        # 区分定義 変動/固定 取得
        # ※ここも本来は外でキャッシュすべきですが、定義変更が少ないため一旦維持します
        kosu_div_obj = kosu_division.objects.get(kosu_name=kosu_obj.def_ver2)
        fluctuation_boolean = []
        for n in range(1, 51):
          val = getattr(kosu_div_obj, f'kosu_division_3_{n}')
          fluctuation_boolean.append(val)

        for ind, d in enumerate(graph_list):
          if fluctuation_boolean[ind]:
            fluctuation_total += d
          else:
            fixed_total += d

    # エクセルファイルに書き込み
    member_sheet.cell(row=2, column=(day * 3) - 2, value=f'{day}日')
    member_sheet.cell(row=2, column=(day * 3) - 1, value=integrity)
    member_sheet.cell(row=3, column=(day * 3) - 2, value=work)
    member_sheet.cell(row=3, column=(day * 3) - 1, value=tyoku)
    member_sheet.cell(row=4, column=(day * 3) - 2, value='残業')
    member_sheet.cell(row=4, column=(day * 3) - 1, value=over_time)

    # 工数区分定義別の累積工数書き込み
    for i, row_num in enumerate(def_list):
      member_sheet.cell(row=(6 + i), column=(day * 3) - 2, value=row_num)
      member_sheet.cell(row=(6 + i), column=(day * 3) - 1, value=graph_list[i])

    member_sheet.cell(row=(7 + len(def_list)), column=(day * 3) - 2, value='固定')
    member_sheet.cell(row=(8 + len(def_list)), column=(day * 3) - 2, value='可動')
    member_sheet.cell(row=(7 + len(def_list)), column=(day * 3) - 1, value=fixed_total)
    member_sheet.cell(row=(8 + len(def_list)), column=(day * 3) - 1, value=fluctuation_total)

    # 作業時間ごとの作業内容書き込み
    for i2, item in enumerate(time_display_list):
      member_sheet.cell(row=(10 + len(def_list) + i2), column=(day * 3) - 2, value=item[0])
      member_sheet.cell(row=(10 + len(def_list) + i2), column=(day * 3) - 1, value=item[1])
      member_sheet.cell(row=(10 + len(def_list) + i2), column=day * 3, value=item[2])

  return wb