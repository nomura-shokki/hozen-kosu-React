from django.shortcuts import get_object_or_404
from ..models import member
from ..models import Business_Time_graph
from ..models import kosu_division
from .kosu_utils import kosu_sort
from .kosu_utils import create_kosu
from .kosu_utils import kosu_division_dictionary
from .kosu_utils import get_def_library_data
import datetime





#--------------------------------------------------------------------------------------------------------




# 班員入力工数Excel出力関数
def excel_function(employee_no_data, wb, request):
  # 人員データ取得
  member_obj = get_object_or_404(member, employee_no=employee_no_data)

  # POSTされた値を日付に設定
  day_data = datetime.datetime.strptime(request.POST['work_day'], '%Y-%m-%d')
  year, month = day_data.year, day_data.month

  # 最終日取得
  select_month = datetime.date(year_end := (year + 1 if month == 12 else year), 
                                month_end := (1 if month == 12 else month + 1), 1)
  day_end = (select_month - datetime.timedelta(days=1)).day

  # Excelに班員のシート作成
  member_sheet = wb.create_sheet(title=member_obj.name)
  member_sheet.cell(row=1, column=1, value=f"{member_obj.name}の{year}年{month}月の勤務状況")

  # 工数データ書き込み
  for day in range(1, day_end + 1):
    kosu_obj = Business_Time_graph.objects.filter(employee_no3=employee_no_data, 
                                                  work_day2=datetime.date(year, month, day)).first()
    # 初期化
    time_display_list, work_list, def_list, graph_list = [], [], [], []
    integrity, work, tyoku, over_time = 'NG', '', '', 0

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
          # 工数区分定義辞書もどき、工数区分数取得
          def_library, def_n = kosu_division_dictionary(kosu_obj.def_ver2)
          # 工数区分定義リスト取得
          def_list, def_num = get_def_library_data(kosu_obj.def_ver2)
          # 作業内容用記号定義
          str_list = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx")[:def_n]
          # 定義区分別の累積工数取得
          graph_list = [kosu_obj.time_work.count(i) * 5 for i in str_list]

    # エクセルファイルに書き込み
    member_sheet.cell(row=2, column=(day * 2) - 1, value=f'{day}日')
    member_sheet.cell(row=2, column=day * 2, value=integrity)
    member_sheet.cell(row=3, column=(day * 2) - 1, value=work)
    member_sheet.cell(row=3, column=day * 2, value=tyoku)
    member_sheet.cell(row=4, column=(day * 2) - 1, value='残業')
    member_sheet.cell(row=4, column=day * 2, value=over_time)

    # 工数区分定義別の累積工数書き込み
    for i, row_num in enumerate(def_list):
      member_sheet.cell(row=(6 + i), column=(day * 2) - 1, value=row_num)
      member_sheet.cell(row=(6 + i), column=day * 2, value=graph_list[i])

    # 作業時間ごとの作業内容書き込み
    for i2, item in enumerate(time_display_list):
      member_sheet.cell(row=(8 + i + i2), column=(day * 2) - 1, value=item[0])
      member_sheet.cell(row=(8 + i + i2), column=day * 2, value=item[1])

  return time_display_list






#--------------------------------------------------------------------------------------------------------





# 班員情報取得関数
def team_member_name_get(member_no):

  # 班員の従業員番号が空でない場合の処理
  if member_no != '':
    # 従業員番号の人員がいるか確認
    member_obj_filter = member.objects.filter(employee_no__contains = member_no)

    # 従業員番号の人員がいる場合の処理
    if member_obj_filter.count() == 1:
      # 班員の人員情報取得
      member_obj_get = member_obj_filter.first()

    # 班員の従業員番号の人員がいない場合の処理
    else:
      # 班員情報に空を入れる
      member_obj_get = ''

  # 従業員番号が空の場合の処理
  else:
    # 班員情報に空を入れる
    member_obj_get = ''

  return member_obj_get





#--------------------------------------------------------------------------------------------------------





# 指定日取得
def day_get(request):
  # セッションに表示日の指定がない場合の処理
  if request.session.get('display_day', None) == None:
    # 今日の日付取得
    today = datetime.date.today()
    # 取得した値をセッションに登録
    request.session['display_day'] = str(today)[0: 10]
    today = datetime.datetime.strptime(request.session['display_day'], '%Y-%m-%d')

  # セッションに表示日の指定がある場合の処理
  else:
    # 表示日にセッションの値を入れる
    today = datetime.datetime.strptime(request.session['display_day'], '%Y-%m-%d')

  return today



#--------------------------------------------------------------------------------------------------------

