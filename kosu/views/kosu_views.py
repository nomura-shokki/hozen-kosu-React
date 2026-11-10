# ============================================================
# ファイル名 : kosu_views.py
# 種別       : APIビュー（Django REST Framework）
# 概要       : 工数データ（1日1人分の作業時間記録）の入力・一覧・編集・削除、
#              休憩時間の変更、勤務入力カレンダー、工数集計を行うAPI群。
#              工数管理画面（frontend/src/KosuPage/）から呼び出される。
#              どのAPIも「ログイン者本人の工数データ」を対象にする。
#
# 主なクラス:
#   - KosuList           : 工数履歴一覧の取得                 GET        /api/kosu_list/
#   - KosuNew            : 工数入力画面の初期表示・工数の登録   GET/POST   /api/kosu_new/
#   - SetDay             : 就業日（表示日）の切り替え           POST       /api/set_day/
#   - OverTime           : 残業時間の登録                       POST       /api/over_time/
#   - TodayBreakTime     : その日だけの休憩時間の取得・変更     GET/POST   /api/today_break_time/
#   - BreakTime          : 人員に登録された休憩時間の取得・変更 GET/POST   /api/break_time/
#   - KosuUpdate         : 工数データ1件の取得・一括更新       GET/PUT    /api/kosu_update/<工数データID>/
#   - DayUpdate          : 工数データの就業日の変更             PUT        /api/day_update/
#   - ItemDlete          : 工数データの一部の時間帯の削除       POST       /api/item_delete/
#   - KosuDelete         : 工数データ1件の削除                  DELETE     /api/kosu_delete/<工数データID>/
#   - KosuCalendar       : 勤務入力カレンダーの表示データ取得   GET        /api/kosu_calendar/
#   - KosuCalendarChange : 勤務入力カレンダーの表示年月の変更   POST       /api/kosu_calendar_change/
#   - KosuWorkWrite      : 勤務入力（就業形態・直）の一括登録   POST       /api/kosu_work_write/
#   - KosuLink           : カレンダーから工数入力画面へ移る準備 POST       /api/kosu_link/
#   - WorkDefault        : 就業形態の初期値の一括設定           POST       /api/work_default/
#   - TyokuDefault       : 直の初期値の一括設定                 POST       /api/tyoku_default/
#   - KosuTotal          : 工数集計（グラフ表示用）データの取得 GET/POST   /api/kosu_total/
#
# 権限       : どのクラスも permission_classes を指定していないため、settings.py の既定
#              （IsLoggedIn: ログイン済みの人員なら誰でも利用可能）が適用される。
#              未ログインの場合は 401 になり、フロント側でログイン画面へ戻される。
#
# 主に使うセッションのキー（セッション＝ログイン中ユーザーの情報をサーバー側で保持する仕組み）:
#   input_def : 使用中の工数区分定義Ver名（ログイン時に最新Verが入り、定義Ver切替で変更できる）
#   day       : 工数入力・休憩変更・工数集計などの画面で選択中の就業日（"YYYY-MM-DD"）
#   year/month: 勤務入力カレンダーで表示中の年・月
#
# データ形式  : 作業内容（time_work）は1日を5分刻みにした288文字、作業詳細（detail_work）は
#              288コマ分を '$' でつないだ文字列。詳細は utils/kosu_utils.py のファイルヘッダーを参照。
# 関連ファイル: models.py（Business_Time_graph / member / kosu_division / def_choice）,
#              views/serializers.py, utils/kosu_utils.py, utils/main_utils.py（CustomPagination）,
#              permissions.py, urls.py
# ============================================================

# ============================================================
# インポート
# ============================================================
import datetime
# itertools: 同じ値を繰り返すリストを作るために使う（工数編集の空リスト作成）
import itertools
# Case / When / Value / IntegerField: 並び替え用の一時的な列を作るための Django の部品
from django.db.models import Case, When, Value, IntegerField
from ..models import member, Business_Time_graph, kosu_division, def_choice
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import MemberSerializer, DefSerializer, KosuSerializer, DefChoiceSerializer
from ..utils.main_utils import CustomPagination, utc_to_jst_hhmm, parse_year_month
# 工数関連の計算・変換・判定の関数（中身は utils/kosu_utils.py を参照）
from ..utils.kosu_utils import time_index, break_get, break_time_process, break_time_delete, \
                                break_time_write, detail_list_summarize, judgement_check, parse_break_time, \
                                  get_week_of_month, kosu_write



# ============================================================
# 工数履歴・工数入力
# ============================================================

# ------------------------------------------------------------
# KosuList: 工数履歴一覧API
#   URL  : /api/kosu_list/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : ログイン者の工数データを就業日の新しい順に、ページネーション付きで返す。
#          日付（日単位）または月単位での絞り込みが可能。
#   画面 : 工数履歴一覧画面（frontend/src/KosuPage/KosuList.tsx）
# ------------------------------------------------------------
class KosuList(APIView):
  # ログイン者の工数データ一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト。query_params で以下を受け付ける
  #     day    (任意): 検索日（"YYYY-MM-DD"）。月検索の場合も先頭7文字 "YYYY-MM" を使う
  #     mode   (任意): 'month' なら月単位、それ以外（既定 'day'）なら日単位で絞り込む
  #     filter (任意): 'true' のときだけ絞り込みを行う（既定 'false'）
  #     page   (任意): ページ番号（CustomPagination が使用）
  # 戻り値:
  #   Response: ページネーション済みの工数データ一覧（count / page_size / results）
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ（LoginNoAuthentication がセットしたもの）
    member_data = request.user

    # 検索パラメータの取得
    #   filter は文字列で届くため、'true' と一致するかどうかで True/False に変換する
    search_day = request.query_params.get('day')
    mode = request.query_params.get('mode', 'day')
    filter_flag = request.query_params.get('filter', 'false') == 'true'

    # 工数履歴データの取得
    #   ログイン者の従業員番号に一致する工数データを、就業日の新しい順（'-' は降順）に取得
    kosus = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no).order_by('-work_day2')

    # 工数履歴データ絞り込み（検索日があり、かつ絞り込み指定がある場合のみ）
    if search_day and filter_flag:
      # 月単位: 就業日が "YYYY-MM"（検索日の先頭7文字）で始まるものに絞り込む
      if mode == 'month':
        kosus = kosus.filter(work_day2__startswith=search_day[:7])
      # 日単位: 就業日が検索日と完全に一致するものに絞り込む
      else:
        kosus = kosus.filter(work_day2=search_day)

    # ページネーション
    #   管理者設定の「一覧表示項目数」ごとに区切り、要求されたページ分だけ取り出す
    paginator = CustomPagination()
    result_page = paginator.paginate_queryset(kosus, request)
    # 取り出した工数データをJSONに変換できる形（辞書のリスト）にする
    serializer = KosuSerializer(result_page, many=True)

    # 件数・ページサイズ・データをまとめたレスポンスを返す
    return paginator.get_paginated_response(serializer.data)



# ------------------------------------------------------------
# KosuNew: 工数入力API
#   URL  : /api/kosu_new/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : 工数入力画面の初期表示に必要なデータ（人員・その日の工数データ・
#          工数区分定義・作業詳細の選択肢・就業日）をまとめて返す。
#   POST : 入力された作業時間帯に工数区分と作業詳細を書き込み、休憩時間を反映して保存する。
#   画面 : 工数入力画面（frontend/src/KosuPage/KosuNew.tsx）
# ------------------------------------------------------------
class KosuNew(APIView):
  # 工数入力画面の初期表示データを返す（GET）。
  #
  # 就業日はセッションの 'day' を使い、未設定なら今日の日付にする。
  # 使用中の工数区分定義Verが最新でない場合は警告メッセージも付ける。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: 以下のキーを持つJSON
  #     member_data : ログイン者の人員データ
  #     kosu_data   : その就業日の工数データ（未登録なら各項目が空のデータ）
  #     def_data    : 使用中の工数区分定義
  #     detail_list : 作業詳細の選択肢の一覧
  #     session_day : 表示する就業日（"YYYY-MM-DD"）
  #     session_def : 使用中の工数区分定義Ver名
  #     warning     : （最新Verでない場合のみ）警告メッセージ
  #   エラー: 工数区分定義Verが未選択・存在しない場合は 401、
  #           工数データ・工数区分定義が重複している場合は 400
  def get(self, request):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 就業日取得
    #   セッションに就業日が無ければ今日の日付（"YYYY-MM-DD"）を使い、セッションにも保存する
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # ログイン者の人員データ
    member_data = request.user

    # 工数データ確認
    #   ログイン者・就業日が一致する工数データを取得。本来1日1件なので、2件以上あれば 400 を返す
    kosu_query_set = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    if kosu_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    # 1件目を取得（未登録なら None）
    kosu_data = kosu_query_set.first()

    # 工数区分定義確認
    #   使用中のVer名の工数区分定義が無ければ 401（ログイン画面へ戻して選び直させる）、
    #   同名が2件以上あれば 400 を返す
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # 工数区分定義が最新Verか確認
    #   ID が最も大きい（最後に登録された）工数区分定義を最新とみなし、
    #   使用中のVerと違う場合は警告メッセージを用意する（入力自体は可能）
    def_new_obj = kosu_division.objects.order_by('-id').first()
    warning_message = None
    if def_new_obj and def_new_obj.kosu_name != def_ver:
      warning_message = f"警告: 設定されている工数区分定義は最新の工数区分定義ではありません。任意に過去の工数入力する以外の場合は工数区分定義を最新のものにして工数入力を実施してください。"

    # 作業詳細取得
    #   作業詳細の選択肢を全件取得し、並び順を決める
    #   symbol_order: 記号が '$'（休憩）なら 1、それ以外は 0 という並び替え用の一時的な列
    #   → 休憩の選択肢を末尾にし、それ以外は記号（A, B, C...）順に並べる
    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # データ変換（各データをJSONに変換できる形にする）
    #   many=False: 1件のデータ / many=True: 複数件のデータ
    #   kosu_data が None の場合は、各項目が空の形で出力される
    member_serializer = MemberSerializer(member_data, many=False)
    kosu_serializer = KosuSerializer(kosu_data, many=False)
    def_serializer = DefSerializer(def_data, many=False)
    detail_serializer = DefChoiceSerializer(detail_choice, many=True)

    # 送信データ（画面に返すデータをまとめる）
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'detail_list': detail_serializer.data,
      'session_day': day,
      'session_def': def_ver,
    }
    # 最新Verでない場合のみ警告メッセージを追加する
    if warning_message:
      response_data['warning'] = warning_message

    return Response(response_data)


  # 入力された作業時間帯の工数を登録する（POST）。
  #
  # 処理の流れ:
  #   1. 作業開始・終了時刻を 5分刻みのインデックス（0〜287）に変換する
  #   2. その日の既存の作業内容・作業詳細を読み込む（無ければ空の288コマ）
  #   3. 入力した時間帯に既に作業が入っていればエラーにする（休憩コマへの上書きは可）
  #   4. 入力した時間帯に工数区分記号と作業詳細を書き込む
  #   5. 「休憩変更」チェックが無ければ、直に応じた休憩時間（昼休憩＋残業休憩1〜3）を反映する
  #   6. 工数入力OK/NG判定をして保存する
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む（KosuNew.tsx から送信）
  #     work_day2  : 就業日（"YYYY-MM-DD"）
  #     tyoku2     : 直（'1'〜'6'）
  #     work_time  : 就業形態（'出勤' など）
  #     time1/time2: 作業開始・終了日時（toISOString() による UTC の ISO形式文字列）
  #     time_work  : 入力する工数区分の記号（'A' など）
  #     detail_work: 作業詳細
  #     over_time  : 残業時間（分）
  #     break_change: 休憩変更チェック（true なら休憩時間を自動反映しない）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ
  #             就業日未指定・工数区分定義Ver違い・作業時間の重複・休憩時間への入力・
  #             作業時間が長すぎる場合は 400 エラー
  def post(self, request):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # POSTデータ取得（就業日と直は何度も使うので変数に取り出す）
    post_data = request.data
    day = post_data.get('work_day2')
    tyoku = post_data.get('tyoku2')

    # ログイン者の人員データ
    member_data = request.user

    # 就業日未指定エラー（セッションの就業日も空にして 400 を返す）
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    # セッション更新（入力した就業日を、次回の画面表示用にセッションへ保存）
    else:
      request.session['day'] = str(day)

    # チェックBOX状態取得（休憩変更チェックが付いていれば 1、付いていなければ 0）
    break_change = 1 if post_data.get("break_change", False) else 0
    # 作業時間から時間のみ抽出
    #   画面からは UTC の ISO形式（例: "2026-11-08T23:30:00.000Z"）で届くため、
    #   日本時間（UTC+9時間）に変換してから "HH:MM" を取り出す（例: → "08:30"）
    #   届いていない・形が違う場合は 500 にせず 400 を返す
    try:
      start_time = utc_to_jst_hhmm(post_data.get('time1'))
      end_time = utc_to_jst_hhmm(post_data.get('time2'))
    except ValueError:
      return Response({'status': 'error', 'message': '作業時間を入力してください。'}, status=status.HTTP_400_BAD_REQUEST)
    # "HH:MM" を時と分に分け、インデックス（時×12 + 分÷5）に変換する
    #   例: "08:30" → 8×12 + 30÷5 = 102
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

    # 工数データ確認（ログイン者・就業日が一致する工数データ。無ければ None）
    obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    obj = obj_filter.first() if obj_filter.exists() else None

    # 作業内容、作業詳細取得
    #   既存データがあればリストに分解し、無ければ空の288コマ（作業内容 '#'、作業詳細 ''）を用意する
    work_list = list(obj.time_work) if obj and obj.time_work else ['#'] * 288
    detail_list = obj.detail_work.split('$') if obj and obj.detail_work else [''] * 288

    # 工数区分定義チェックエラー
    #   その日の工数データが別の工数区分定義Verで入力済みの場合は、記号の意味が変わってしまうため 400 を返す
    if obj:
      if obj.def_ver2:
        if obj.def_ver2 != def_ver:
          return Response({'status': 'error', 'message': '指定就業日を入力している工数定義区分と使用しようとしている工数定義区分が違います。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データがある場合
    if obj_filter.exists():
      # 工数データに休憩時間データ無いか直が変更されている場合、人員データから取得
      #   （人員データには直ごとの休憩時間が登録されている）
      if obj.breaktime in [None, ""] or obj.breaktime_over1 in [None, ""] or \
        obj.breaktime_over2 in [None, ""] or obj.breaktime_over3 in [None, ""] or \
          obj.tyoku2 != tyoku:
        breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, member_data.employee_no)

      # 工数データに休憩時間データある場合、工数データから休憩時間取得
      #   （「当日休憩変更」でその日だけ変えた休憩時間を優先するため）
      else:
        breaktime = obj.breaktime
        breaktime_over1 = obj.breaktime_over1
        breaktime_over2 = obj.breaktime_over2
        breaktime_over3 = obj.breaktime_over3

    # 工数データがない場合、人員データから休憩時間取得
    else:
      breaktime, breaktime_over1, breaktime_over2, breaktime_over3 = break_get(tyoku, member_data.employee_no)

    # 休憩時間のインデックス＆日またぎ変数定義
    #   1: 昼休憩 / 2〜4: 残業休憩1〜3 それぞれの開始・終了インデックスと日またぎ（1/0）
    break_start1, break_end1, break_next_day1 = break_time_process(breaktime)
    break_start2, break_end2, break_next_day2 = break_time_process(breaktime_over1)
    break_start3, break_end3, break_next_day3 = break_time_process(breaktime_over2)
    break_start4, break_end4, break_next_day4 = break_time_process(breaktime_over3)

    # 工数に被りがないかチェック
    #   終了が開始より前（例: 22:00〜2:00 のように0時をまたぐ）なら
    #   [開始〜24:00) と [0:00〜終了) の2つの範囲に分け、そうでなければ1つの範囲にする
    ranges = [(start_time_ind, 288), (0, end_time_ind)] if end_time_ind < start_time_ind else [(start_time_ind, end_time_ind)]
    for ind in ranges:
      for kosu in range(ind[0], ind[1]):
        # 工数データの要素が空でない場合、エラー
        #   休憩（'$'）でも未入力（'#'）でもないコマ＝作業が入力済みのコマがあれば 400 を返す
        if work_list[kosu] != '$':
          if work_list[kosu] != '#':
            return Response({'status': 'error', 'message': '入力された作業時間には既に工数が入力されているので入力できません。'}, status=status.HTTP_400_BAD_REQUEST)

    # 作業内容、作業詳細書き込み（範囲ごとに工数区分記号と作業詳細を書き込む）
    for start, end in ranges:
      work_list, detail_list = kosu_write(start, end, work_list, detail_list, post_data)

    # 休憩変更チェックが入っていない場合、休憩時間を書き込み
    if break_change == 0:
      # 各休憩時間の処理（1: 昼休憩、2〜4: 残業休憩1〜3 の順に処理）
      for break_num in range(1, 5):
        # 各変数の値を動的に取得
        #   locals() は「この関数内の変数名 → 値」の辞書。
        #   例: break_num=2 なら break_start2 / break_end2 / break_next_day2 の値を取り出す
        break_start = locals()[f'break_start{break_num}']
        break_end = locals()[f'break_end{break_num}']
        break_next_day = locals()[f'break_next_day{break_num}']

        # 日を超えている場合の処理（例: 23:35〜0:35）
        if break_next_day == 1:
          # 休憩時間内の工数データを削除
          #   [休憩開始〜24:00) と [0:00〜休憩終了) の2回に分けて処理する
          #   （人員の「休憩エラー有効チェック」がONなら、作業が入っているとエラーメッセージが返る）
          error_message, work_list, detail_list = break_time_delete(break_start, 288, work_list, detail_list, member_data)
          error_message, work_list, detail_list = break_time_delete(0, break_end, work_list, detail_list, member_data)
          # エラーメッセージがあれば 400 を返す
          if error_message:
            return Response({'status': 'error', 'message': error_message}, status=status.HTTP_400_BAD_REQUEST)
          # 休憩時間直後の時間に工数入力がある場合の処理
          #   休憩終了直後のコマに作業がある（＝休憩をはさんで作業が続いている）場合のみ、
          #   休憩範囲を休憩（'$'）で埋める。作業が続いていなければ休憩範囲は空のままにする
          if work_list[int(break_end)] != '#':
            # 休憩時間内の工数データを休憩に書き換え
            work_list, detail_list = break_time_write(break_start, 288, work_list, detail_list)
            work_list, detail_list = break_time_write(0, break_end, work_list, detail_list)

        # 日を超えていない場合の処理
        else:
          # 休憩時間内の工数データを削除（休憩エラー有効チェックONで作業が入っていればエラー）
          error_message, work_list, detail_list = break_time_delete(break_start, break_end, work_list, detail_list, member_data)
          # エラーメッセージがあれば 400 を返す
          if error_message:
            return Response({'status': 'error', 'message': error_message}, status=status.HTTP_400_BAD_REQUEST)

          # 休憩時間直後の時間に工数入力がある場合の処理（休憩をはさんで作業が続いている場合のみ）
          if work_list[int(break_end)] != '#':
            # 休憩時間内の工数データを休憩に書き換え
            work_list, detail_list = break_time_write(break_start, break_end, work_list, detail_list)

    # 未入力コマ（'#'）が24コマ（2時間）未満＝作業と休憩の合計が22時間を超える場合は 400 を返す
    work_count = work_list.count("#")
    if work_count < 24:
      return Response({'status': 'error', 'message': '作業時間が長すぎます。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データの取得または新規作成
    #   ログイン者・就業日が一致するデータがあれば取得し、無ければ defaults の内容で新規作成する
    #   created: 新規作成した場合 True（この処理内では未使用）
    kosu_data, created = Business_Time_graph.objects.get_or_create(
      employee_no3=member_data.employee_no,
      work_day2=day,
      defaults={
        'employee_no3': member_data.employee_no,
        'work_day2': day,
        'name': member_data,
      }
    )

    # 更新可能フィールド定義（送信データの値をそのまま上書きする項目）
    #   直 / 残業時間 / 就業形態 / 休憩変更チェック
    updatable_fields = [
      'tyoku2', 'over_time','work_time', 'break_change',
    ]

    # 項目毎にデータを上書き（送信データに含まれる項目だけを対象にする）
    for field in updatable_fields:
      if field in post_data:
        setattr(kosu_data, field, post_data[field])
    # 氏名（人員データへの紐づけ）を最新の人員データで設定し直す
    kosu_data.name = member.objects.get(employee_no=member_data.employee_no)
    # 作業内容: 288要素のリストを1つの文字列に戻す
    kosu_data.time_work = ''.join(work_list)
    # 作業詳細: '$' 区切りの1つの文字列にまとめる
    kosu_data.detail_work = detail_list_summarize(detail_list)
    # 工数入力OK/NG判定（作業時間の合計が就業形態・直に対して正しいか）
    kosu_data.judgement = judgement_check(work_list, post_data.get('work_time'), tyoku, member_data, post_data.get('over_time', 0))
    # この日の工数を入力した工数区分定義Verを記録する
    kosu_data.def_ver2 = def_ver
    # この日に使った休憩時間を工数データにも保存する（次回入力時に再利用される）
    kosu_data.breaktime = breaktime
    kosu_data.breaktime_over1 = breaktime_over1
    kosu_data.breaktime_over2 = breaktime_over2
    kosu_data.breaktime_over3 = breaktime_over3

    # 工数データ更新（データベースに保存し、成功メッセージを返す）
    kosu_data.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# ------------------------------------------------------------
# SetDay: 就業日切り替えAPI
#   URL  : /api/set_day/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : 画面で選んだ就業日をセッションに保存する（工数入力画面で日付を変えたときに呼ばれる）
#   画面 : 工数入力画面（frontend/src/KosuPage/KosuNew.tsx）
# ------------------------------------------------------------
class SetDay(APIView):
  # 就業日をセッションに保存する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の day に就業日（"YYYY-MM-DD"）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ。day が空の場合は 400 エラー
  def post(self, request, *args, **kwargs):
    # 就業日取得、空の場合エラー（セッションの就業日も空にして 400 を返す）
    day = request.data.get('day', None)
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    else:
      # セッションに就業日保存
      request.session['day'] = str(day)
      return Response({'status': 'success', 'message': '就業日がセッションに保存されました。'})



# ------------------------------------------------------------
# OverTime: 残業登録API
#   URL  : /api/over_time/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : 指定した就業日の残業時間だけを登録し、工数入力OK/NG判定をやり直す。
#          工数データが無い日は、作業内容が空の工数データを新規作成する。
#   画面 : 工数入力画面の「残業送信」（frontend/src/KosuPage/KosuNew.tsx）
# ------------------------------------------------------------
class OverTime(APIView):
  # 残業時間を登録する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む
  #     work_day2: 就業日（"YYYY-MM-DD"）
  #     over_time: 残業時間（分）
  #     （画面の入力内容一式が送られてくるが、このAPIで使うのは上記2つのみ）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ。就業日未指定の場合は 400 エラー
  def post(self, request):
    # POST値取得
    post_data = request.data
    day = post_data.get('work_day2')
    # ログイン者の人員データ
    member_data = request.user

    # 就業日未指定エラー（セッションの就業日も空にして 400 を返す）
    if not day:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    # 指定された就業日をセッションに保存する
    else:
      request.session['day'] = str(day)

    # 工数データ取得（ログイン者・就業日が一致する工数データ。無ければ None）
    obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    obj = obj_filter.first() if obj_filter.exists() else None
    # 判定や新規作成に使う既存の値を取り出す（無ければ空の値）
    #   作業内容: 288文字の文字列（無ければ未入力 '#' が288個）
    #   作業詳細: '$' 区切りの文字列（無ければ区切りの '$' だけが287個）
    #   就業形態・直: 無ければ空文字
    work_list = obj.time_work if obj and obj.time_work else '#'*288
    detail_list = obj.detail_work if obj and obj.detail_work else '$'*287
    work_time = obj.work_time if obj and obj.work_time else ''
    tyoku = obj.tyoku2 if obj and obj.tyoku2 else ''

    # 更新可能なフィールドを定義（このAPIでは残業時間のみ）
    updatable_fields = ['over_time']

    # 工数データの取得または新規作成
    #   ログイン者・就業日が一致するデータがあれば取得し、無ければ defaults の内容で新規作成する
    kosu_data, created = Business_Time_graph.objects.get_or_create(
      employee_no3=member_data.employee_no,
      work_day2=day,
      defaults={
        'employee_no3': member_data.employee_no,
        'work_day2': day,
        'name': member_data,
      }
    )

    # 項目毎にデータ上書き（送信データに残業時間があれば上書きする）
    for field in updatable_fields:
      if field in post_data:
        setattr(kosu_data, field, post_data[field])
    # 氏名（人員データへの紐づけ）を最新の人員データで設定し直す
    kosu_data.name = member.objects.get(employee_no=member_data.employee_no)
    # 元のデータが無い、または作業内容が空の場合は、空の作業内容・作業詳細を設定する
    if obj == None or not obj.time_work :
      kosu_data.time_work = work_list
      kosu_data.detail_work = detail_list
    # 新しい残業時間で工数入力OK/NG判定をやり直す（作業内容・就業形態・直は既存の値を使う）
    kosu_data.judgement = judgement_check(work_list, work_time, tyoku, member_data, post_data.get('over_time', 0))
    # 工数データ更新（データベースに保存し、成功メッセージを返す）
    kosu_data.save()
    return Response({'status': 'success', 'message': '残業が更新されました。'})



# ============================================================
# 休憩時間の変更
# ============================================================

# ------------------------------------------------------------
# TodayBreakTime: 当日休憩変更API
#   URL  : /api/today_break_time/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : セッションの就業日の工数データ（その日の休憩時間を含む）を返す。
#   POST : その就業日だけの休憩時間（昼休憩＋残業休憩1〜3）を変更し、工数データに保存する。
#          人員データに登録された直ごとの休憩時間は変更しない。
#   画面 : 当日休憩変更画面（frontend/src/KosuPage/TodayBreakTime.tsx）
# ------------------------------------------------------------
class TodayBreakTime(APIView):
  # 従業員番号と就業日から工数データを1件取得する。
  #
  # 引数:
  #   login_no: 従業員番号
  #   day     : 就業日（"YYYY-MM-DD"）
  # 戻り値:
  #   Business_Time_graph: 該当する工数データ。存在しない場合は None
  def get_object(self, login_no, day):
    try:
      return Business_Time_graph.objects.get(employee_no3=login_no, work_day2=day)
    # 該当する工数データがない場合は例外を握りつぶし、None を返して呼び出し元で処理を分ける
    except Business_Time_graph.DoesNotExist:
      return None


  # セッションの就業日の工数データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: {'kosu_data': 工数データ, 'session_day': 就業日}
  #             工数区分定義Verが未選択の場合は 401、工数データが無い場合は 404 エラー
  def get(self, request, *args, **kwargs):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ
    member_data = request.user

    # 就業日取得（セッションに無ければ今日の日付を使い、セッションにも保存する）
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # 工数データ取得（その日の工数データが無ければ 404 を返す）
    kosu_instance = self.get_object(member_data.employee_no, day)
    if not kosu_instance:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # データ変換（工数データをJSONに変換できる形にする）
    kosu_serializer = KosuSerializer(kosu_instance, many=False)

    # 送信データ（工数データと就業日を返す）
    response_data = {
      'kosu_data': kosu_serializer.data,
      'session_day': day,
    }
    return Response(response_data)


  # その就業日だけの休憩時間を変更する（POST）。
  #
  # 送信された4つの休憩（昼休憩・残業休憩1〜3）を "#HHMMHHMM" 形式に変換して工数データに保存し、
  # 休憩終了直後のコマに作業が入っている休憩は、その範囲を休憩（'$'）で埋める。
  # その日の工数データが無い場合は、空の工数データを作って保存する。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む（TodayBreakTime.tsx から送信）
  #     breakTime1 / breakTime2: 昼休憩の開始 / 終了（UTC の ISO形式文字列）
  #     breakTime3 / breakTime4: 残業休憩1の開始 / 終了
  #     breakTime5 / breakTime6: 残業休憩2の開始 / 終了
  #     breakTime7 / breakTime8: 残業休憩3の開始 / 終了
  #     （sessionDay も送られてくるが使わない。就業日はセッションの 'day' を使う）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ。未入力・形式不正がある場合は 400 エラー
  def post(self, request, *args, **kwargs):
    # セッションから就業日を取得し、送信データも受け取る
    day = request.session.get('day')
    post_data = request.data
    # セッションに就業日が無ければ今日の日付を使い、セッションにも保存する
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # ログイン者の人員データ
    member_data = request.user

    # 工数データ取得
    #   その日の工数データが無ければ、作業内容・作業詳細が空の新しい工数データを用意する
    #   （この時点ではまだデータベースには保存されず、最後の save() で登録される）
    kosu_instance = self.get_object(member_data.employee_no, day)
    if not kosu_instance:
      kosu_instance = Business_Time_graph(
        employee_no3=member_data.employee_no, 
        name=member.objects.get(employee_no=member_data.employee_no), 
        work_day2=day, 
        work_time='', 
        tyoku2='', 
        time_work='#'*288, 
        detail_work='$'*287, 
        judgement=False, 
        over_time=0, 
        )

    # 作業内容・作業詳細を288要素のリストに分解する
    kosu_list = list(kosu_instance.time_work)
    detail_list = kosu_instance.detail_work.split('$')

    # JSTタイムゾーンの作成（日本時間 = UTC+9時間）
    jst = datetime.timezone(datetime.timedelta(hours=9))

    # breakTime1〜breakTime8を処理
    #   i=1: breakTime1/2（昼休憩）、i=2: breakTime3/4（残業休憩1）、
    #   i=3: breakTime5/6（残業休憩2）、i=4: breakTime7/8（残業休憩3）を開始・終了の組で変換する
    #   time_data    : 各休憩の (開始インデックス, 終了インデックス)
    #   time_str_list: 各休憩の "#HHMMHHMM" 文字列
    time_data = []
    time_str_list = []
    try:
      for i in range(1, 5):
        start_ind, end_ind, time_str = parse_break_time(
          post_data.get(f'breakTime{2 * i - 1}'),
          post_data.get(f'breakTime{2 * i}'),
          jst
        )
        time_data.append((start_ind, end_ind))
        time_str_list.append(time_str)

    # 未入力・形式不正（parse_break_time が ValueError を送出）の場合は、そのメッセージで 400 を返す
    except ValueError as e:
      return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 各休憩を作業内容に反映する
    for time_inds in time_data:
      # 日をまたがない休憩（開始 < 終了）:
      #   休憩終了直後のコマに作業がある場合のみ、休憩範囲を休憩（'$'）で埋める
      if time_inds[0] < time_inds[1]:
        if kosu_list[time_inds[1]] != '#':
          kosu_list, detail_list = break_time_write(time_inds[0], time_inds[1], kosu_list, detail_list)
      # 日をまたぐ休憩（開始 > 終了。例: 23:35〜0:35）:
      #   [開始〜24:00) と [0:00〜終了) の2回に分けて休憩で埋める
      #   （開始 = 終了の休憩はどちらにも当てはまらず、何もしない）
      elif time_inds[0] > time_inds[1]:
        if kosu_list[time_inds[1]] != '#':
          kosu_list, detail_list = break_time_write(time_inds[0], 288, kosu_list, detail_list)
          kosu_list, detail_list = break_time_write(0, time_inds[1], kosu_list, detail_list)

    # 作業内容・作業詳細を保存用の文字列に戻す
    kosu_instance.time_work = ''.join(kosu_list)
    kosu_instance.detail_work = detail_list_summarize(detail_list)
    # 変更後の休憩時間（昼休憩・残業休憩1〜3）を工数データに保存する
    kosu_instance.breaktime = time_str_list[0]
    kosu_instance.breaktime_over1 = time_str_list[1]
    kosu_instance.breaktime_over2 = time_str_list[2]
    kosu_instance.breaktime_over3 = time_str_list[3]
    # 休憩の反映で作業時間が変わるため、工数入力OK/NG判定をやり直す
    kosu_instance.judgement = judgement_check(kosu_list, kosu_instance.work_time, kosu_instance.tyoku2, member_data, kosu_instance.over_time)

    # 工数データ更新（データベースに保存し、成功メッセージを返す）
    kosu_instance.save()
    return Response({'status': 'success', 'message': f'{day}の休憩時間が更新されました'})



# ------------------------------------------------------------
# BreakTime: 休憩変更API
#   URL  : /api/break_time/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : ログイン者の人員データ（直ごとに登録された休憩時間を含む）を返す。
#   POST : ログイン者の人員データに、直ごと（1直〜連2直の6種類）の休憩時間
#          （昼休憩＋残業休憩1〜3 × 6 = 24個）を保存する。
#          ここで保存した値が、以降の工数入力で休憩時間の初期値として使われる。
#   画面 : 休憩変更画面（frontend/src/KosuPage/BreakTime.tsx）
# ------------------------------------------------------------
class BreakTime(APIView):
  # ログイン者の人員データを返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: {'member_data': ログイン者の人員データ}
  #             工数区分定義Verが未選択の場合は 401 エラー
  def get(self, request):
    # ユーザーの従業員番号、使用工数区分定義取得
    #   （セッションから、使用中の工数区分定義Verを取得する）
    def_ver = request.session.get('input_def')

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログインユーザーのデータ取得
    member_data = request.user

    # シリアライザーによるシリアライズ処理（人員データをJSONに変換できる形にする）
    member_serializer = MemberSerializer(member_data, many=False)

    # レスポンスデータの構築
    response_data = {
      'member_data': member_serializer.data,
    }

    return Response(response_data)


  # ログイン者の直ごとの休憩時間を変更する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に breakTime1〜breakTime48（UTC の ISO形式文字列）
  #     2個で1つの休憩（開始・終了）。4休憩（昼休憩・残業休憩1〜3）× 6直 の順に並ぶ
  #       breakTime1〜8  : 1直   / breakTime9〜16 : 2直   / breakTime17〜24: 3直
  #       breakTime25〜32: 常昼  / breakTime33〜40: 連1直 / breakTime41〜48: 連2直
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ。未入力・形式不正がある場合は 400 エラー
  def post(self, request):
    # 画面から送信された休憩時間一式
    post_data = request.data

    # ログインユーザーのデータ取得
    member_data = request.user

    # JSTタイムゾーンの作成（日本時間 = UTC+9時間）
    jst = datetime.timezone(datetime.timedelta(hours=9))

    # breakTime1〜breakTime48を処理
    #   i 番目の休憩 = breakTime(2i-1)（開始）と breakTime(2i)（終了）の組。24組を順に変換する
    #   time_data    : 各休憩の (開始インデックス, 終了インデックス)（この処理内では保存に使わない）
    #   time_str_list: 各休憩の "#HHMMHHMM" 文字列（24個）
    time_data = []
    time_str_list = []
    try:
      for i in range(1, 25):
        start_ind, end_ind, time_str = parse_break_time(
          post_data.get(f'breakTime{2 * i - 1}'),
          post_data.get(f'breakTime{2 * i}'),
          jst
        )
        time_data.append((start_ind, end_ind))
        time_str_list.append(time_str)
    # 未入力・形式不正（parse_break_time が ValueError を送出）の場合は、そのメッセージで 400 を返す
    except ValueError as e:
      return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 変換した24個の休憩時間を、人員データの各項目に順番に設定する
    #   break_time{直} = 昼休憩、break_time{直}_over1〜3 = 残業休憩1〜3
    #   直の番号: 1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直
    # 1直
    member_data.break_time1 = time_str_list[0]
    member_data.break_time1_over1 = time_str_list[1]
    member_data.break_time1_over2 = time_str_list[2]
    member_data.break_time1_over3 = time_str_list[3]
    # 2直
    member_data.break_time2 = time_str_list[4]
    member_data.break_time2_over1 = time_str_list[5]
    member_data.break_time2_over2 = time_str_list[6]
    member_data.break_time2_over3 = time_str_list[7]
    # 3直
    member_data.break_time3 = time_str_list[8]
    member_data.break_time3_over1 = time_str_list[9]
    member_data.break_time3_over2 = time_str_list[10]
    member_data.break_time3_over3 = time_str_list[11]
    # 常昼
    member_data.break_time4 = time_str_list[12]
    member_data.break_time4_over1 = time_str_list[13]
    member_data.break_time4_over2 = time_str_list[14]
    member_data.break_time4_over3 = time_str_list[15]
    # 連1直
    member_data.break_time5 = time_str_list[16]
    member_data.break_time5_over1 = time_str_list[17]
    member_data.break_time5_over2 = time_str_list[18]
    member_data.break_time5_over3 = time_str_list[19]
    # 連2直
    member_data.break_time6 = time_str_list[20]
    member_data.break_time6_over1 = time_str_list[21]
    member_data.break_time6_over2 = time_str_list[22]
    member_data.break_time6_over3 = time_str_list[23]

    # 人員データを保存し、成功メッセージを返す
    member_data.save()
    return Response({'status': 'success', 'message': '休憩時間が更新されました'})



# ============================================================
# 工数の編集・削除
# ============================================================

# ------------------------------------------------------------
# KosuUpdate: 工数編集（一括）API
#   URL  : /api/kosu_update/<工数データID>/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : 指定IDの工数データと、編集画面に必要なデータ（工数区分定義・人員・
#          作業詳細の選択肢）を返す。あわせてセッションの就業日をその工数データの日付にする。
#   PUT  : 編集画面の全行（作業時間帯ごとの工数区分・作業詳細）から作業内容を作り直し、
#          直・就業形態・残業時間とともに上書き保存する（ログイン者本人の工数データのみ）。
#   画面 : 工数編集画面（KosuPage/KosuEdit.tsx）, 工数削除画面（KosuPage/KosuDelete.tsx。GET のみ）
# ------------------------------------------------------------
class KosuUpdate(APIView):
  # 工数データのID（主キー）から工数データを1件取得する。
  #
  # 引数:
  #   pk: 工数データのID（URLの <int:pk> 部分）
  # 戻り値:
  #   Business_Time_graph: 該当する工数データ。存在しない場合は None
  def get_object(self, pk):
    try:
      return Business_Time_graph.objects.get(id=pk)
    # 該当する工数データがない場合は例外を握りつぶし、None を返して呼び出し元で 404 にする
    except Business_Time_graph.DoesNotExist:
      return None


  # 指定IDの工数データと編集画面用のデータを返す（GET）。
  #
  # 工数区分定義は、その工数データを入力したVer（def_ver2）を優先し、
  # 未設定の場合はセッションの使用中Verを使う。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 工数データのID（URLから取得）
  # 戻り値:
  #   Response: 以下のキーを持つJSON
  #     kosu_data       : 工数データ
  #     def_data        : 工数区分定義
  #     member_data     : ログイン者の人員データ
  #     detail_data_list: 作業詳細の選択肢の一覧
  #   エラー: 工数データが無い場合は 404、
  #           工数区分定義Verが未選択・工数区分定義が存在しない/重複している場合は 401
  def get(self, request, pk):
    # 工数データ取得
    kosu_instance = self.get_object(pk)

    # 該当する工数データがない場合、または他人の工数データの場合は 404 を返す
    if not kosu_instance or kosu_instance.employee_no3 != request.user.employee_no:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッション値、日付取得
    #   使用中の工数区分定義Verを取得し、セッションの就業日を編集対象の日付に合わせる
    #   （PUT 時に「就業日が変更されていないか」の確認に使う）
    def_ver = request.session.get('input_def')
    request.session['day'] = str(kosu_instance.work_day2)

    # 工数区分定義Verが未選択の場合は 401 を返す（フロント側でログイン画面へ戻される）
    if not def_ver:
      return Response({'status': 'error', 'message': '使用する工数区分定義情報が確認できません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # ログイン者の人員データ
    member_data = request.user

    # 工数区分定義確認
    #   工数データに入力時の工数区分定義Ver（def_ver2）があればそれを使う
    #   （記号 A, B... の意味は入力時のVerで決まるため）
    if kosu_instance.def_ver2:
      def_query_set = kosu_division.objects.filter(kosu_name=kosu_instance.def_ver2)
      # 該当Verが無い・重複している場合は 401 を返す
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
      def_instance = def_query_set.first()
    # def_ver2 が未設定（作業内容がまだ無いデータ）の場合は、セッションの使用中Verを使う
    else:
      def_query_set = kosu_division.objects.filter(kosu_name=def_ver)
      # 該当Verが無い・重複している場合は 401 を返す
      if not def_query_set.exists():
        return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
      elif def_query_set.count() > 1:
        return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_401_UNAUTHORIZED)
      def_instance = def_query_set.first()

    # 作業詳細取得
    #   作業詳細の選択肢を全件取得し、記号 '$'（休憩）の選択肢を末尾、それ以外を記号順に並べる
    #   （symbol_order は並び替え用の一時的な列。'$' なら 1、それ以外は 0）
    detail_choice = def_choice.objects.all().annotate(
      symbol_order=Case(
        When(def_symbol='$', then=Value(1)),
        default=Value(0),
        output_field=IntegerField(),
        )
      ).order_by('symbol_order', 'def_symbol')

    # データ変換（各データをJSONに変換できる形にする）
    kosu_serializer = KosuSerializer(kosu_instance)
    def_serializer = DefSerializer(def_instance)
    member_serializer = MemberSerializer(member_data, many=False)
    detail_serializer = DefChoiceSerializer(detail_choice, many=True)

    # 送信データ（画面に返すデータをまとめる）
    response_data = {
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'member_data': member_serializer.data,
      'detail_data_list': detail_serializer.data,
    }

    return Response(response_data)


  # 編集画面の内容で工数データを一括更新する（PUT）。
  #
  # 既存の作業内容は使わず、空の288コマに送信された全行を書き込み直す（＝画面の内容で丸ごと置き換え）。
  # 行どうしで時間帯が重なっている場合はエラーにする。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む（KosuEdit.tsx から送信）
  #     work_day2            : 就業日（セッションの就業日と一致している必要がある）
  #     tyoku2 / work_time   : 直 / 就業形態
  #     over_time            : 残業時間（分。保存し、工数入力OK/NG判定にも使う。省略時は保存済みの値のまま）
  #     time1_N / time2_N    : N行目の作業開始・終了日時（UTC の ISO形式文字列。N は1始まり）
  #     timeData_work_N      : N行目の工数区分記号
  #     timeData_detail_N    : N行目の作業詳細
  #   pk     : 更新対象の工数データID（URLから取得）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ
  #             対象が無い・本人のデータでない場合は 404、
  #             工数区分定義Ver違い・就業日の変更・時間帯の重複の場合は 400 エラー
  def put(self, request, pk):
    # 工数データ取得
    kosu_instance = self.get_object(pk)

    # ログイン者の人員データ
    member_data = request.user

    # 工数データが無い、またはログイン者本人の工数データでない場合は 404 を返す
    #   （他人のデータを書き換えられないようにするため）
    if kosu_instance is None or kosu_instance.employee_no3 != member_data.employee_no:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # セッション値、日付、ログイン者データ取得
    #   def_ver: 使用中の工数区分定義Ver / day: GET 時に設定した編集対象の就業日
    def_ver = request.session.get('input_def')
    day = request.session.get('day')
    member_data = request.user

    # 工数区分定義設定エラー
    #   入力時の工数区分定義Verと使用中のVerが違う場合は、記号の意味が変わってしまうため 400 を返す
    if kosu_instance.def_ver2:
      if kosu_instance.def_ver2 != def_ver:
        return Response({'status': 'error', 'message': '指定就業日を入力している工数定義区分と使用しようとしている工数定義区分が違います。'}, status=status.HTTP_400_BAD_REQUEST)
    # 日付更新エラー
    #   送信された就業日がセッションの就業日と違う場合は 400（就業日の変更は DayUpdate で行う）
    if day != request.data.get('work_day2'):
      return Response({'status': 'error', 'message': '更新ボタンで就業日の修正はできません。就業日更新で変更してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # フォームの数取得
    #   送信データのキーから 'time1_N' 形式のものを集め、N（行番号）の最大値＝行数を求める
    #   例: time1_1, time1_2, time1_3 → max_num = 3。行が無ければ None
    keys = [key for key in request.data.keys() if key.startswith('time1_')]
    numbers = [int(key[len('time1_'):]) for key in keys if key[len('time1_'):].isdigit()]
    max_num = max(numbers) if numbers else None

    # 空の作業内容リスト作成（作業内容は '#'（未入力）、作業詳細は '' を288個）
    work_list = list(itertools.repeat('#', 288))
    detail_list = list(itertools.repeat('', 288))

    # 工数書き込み（1行ずつ書き込む）
    if max_num:
      for n in range(max_num):
        # n+1 行目の開始・終了日時（UTC の ISO形式）を日本時間の "HH:MM" に変換する。形が違えば 400
        try:
          start_time = utc_to_jst_hhmm(request.data.get(f'time1_{n + 1}'))
          end_time = utc_to_jst_hhmm(request.data.get(f'time2_{n + 1}'))
        except ValueError:
          return Response({'status': 'error', 'message': f'{n + 1}行目の作業時間が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
        # "HH:MM" をインデックス（時×12 + 分÷5）に変換する
        start_time_hour, start_time_min = time_index(start_time)
        end_time_hour, end_time_min = time_index(end_time)
        start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
        end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

        # 日をまたがない行（開始 < 終了）: [開始〜終了) に書き込む
        if start_time_ind < end_time_ind:
          for i in range(start_time_ind, end_time_ind):
            # まだ空いているコマなら、その行の工数区分記号と作業詳細を書き込む
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            # 既に前の行で埋まっているコマ＝時間帯が重なっているので 400 を返す
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)

        # 日をまたぐ行（開始 > 終了。例: 22:00〜2:00）:
        #   [開始〜24:00) と [0:00〜終了) の2回に分けて書き込む（重なりがあれば 400）
        #   （開始 = 終了の行はどちらにも当てはまらず、何も書き込まない）
        elif start_time_ind > end_time_ind:
          for i in range(start_time_ind, 288):
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)
          for i in range(0, end_time_ind):
            if work_list[i] == '#':
              work_list[i] = request.data.get(f'timeData_work_{n + 1}', '#')
              detail_list[i] = request.data.get(f'timeData_detail_{n + 1}', '')
            else:
              return Response({'status': 'error', 'message': '入力した作業時間に被りがあります。'},status=status.HTTP_400_BAD_REQUEST)
      # 全行を書き込んだ作業内容・作業詳細を保存用の文字列にして設定する
      #   （行が1つも無い場合はこの設定を行わず、既存の作業内容がそのまま残る）
      kosu_instance.time_work = ''.join(work_list)
      kosu_instance.detail_work = detail_list_summarize(detail_list)

    # 直・就業形態を送信された値で上書きする
    kosu_instance.tyoku2 = request.data.get('tyoku2')
    kosu_instance.work_time = request.data.get('work_time')
    # 残業時間を送信された値で上書きする（送信されなかった場合は保存済みの値のまま）
    kosu_instance.over_time = request.data.get('over_time', kosu_instance.over_time)
    # 工数入力OK/NG判定をやり直す（上で設定した、保存される残業時間で判定する）
    kosu_instance.judgement = judgement_check(work_list, kosu_instance.work_time, kosu_instance.tyoku2, member_data, kosu_instance.over_time)
    # 入力時の工数区分定義Verが未設定なら、使用中のVerを記録する
    if not kosu_instance.def_ver2:
      kosu_instance.def_ver2 = def_ver
    # データベースに保存し、成功メッセージを返す
    kosu_instance.save()
    return Response({'status': 'success', 'message': 'データが更新されました。'})



# ------------------------------------------------------------
# DayUpdate: 工数編集（就業日変更）API
#   URL  : /api/day_update/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   PUT  : 指定IDの工数データの就業日を、送信された日付に変更する。
#          変更先の日付にログイン者の工数データが既にある場合は変更できない。
#   画面 : 工数編集画面の「就業日更新」（frontend/src/KosuPage/KosuEdit.tsx）
# ------------------------------------------------------------
class DayUpdate(APIView):
  # 工数データの就業日を変更する（PUT）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む
  #     id       : 就業日を変更する工数データのID
  #     work_day2: 変更後の就業日（"YYYY-MM-DD"）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ
  #             就業日未指定・変更先に工数データがある場合は 400 エラー
  def put(self, request):
    # 変更後の就業日を取得
    day = request.data.get('work_day2')

    # ログイン者の人員データ
    member_data = request.user

    # 就業日が空、または日付として読めない場合は、セッションの就業日も空にして 400 を返す
    try:
      datetime.date.fromisoformat(str(day))
    except ValueError:
      request.session['day'] = ""
      return Response({'status': 'error', 'message': '就業日が未指定です。'},status=status.HTTP_400_BAD_REQUEST)
    # 変更後の就業日をセッションに保存する（以降の画面表示をその日付にするため）
    request.session['day'] = str(day)

    # 就業日を変える工数データを取得する（ログイン者本人の工数データだけが対象）
    # 他人の工数データ・無いIDの場合は 404
    try:
      target = Business_Time_graph.objects.filter(id=int(request.data.get('id')), employee_no3=member_data.employee_no).first()
    except (TypeError, ValueError):
      target = None
    if target is None:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # 工数データ確認（変更先の日付に、ログイン者の工数データがあるか）
    obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    # 変更日に工数データがある場合、エラー（1日1件のルールを守るため）
    if obj_filter.exists():
      return Response({'status': 'error', 'message': '変更日に既に工数データがあります。変更先の工数データを削除してから実行してください。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データ日付更新（見つけた工数データの就業日だけを変更する）
    target.work_day2 = day
    target.save()
    return Response({'status': 'success', 'message': '日付が変更されました。'})



# ------------------------------------------------------------
# ItemDlete: 工数編集（項目削除）API
#   URL  : /api/item_delete/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : 指定した就業日の工数データから、指定した時間帯（編集画面の1行分）の
#          作業内容・作業詳細を削除（未入力に戻す）する。
#   画面 : 工数編集画面の各行の削除ボタン（frontend/src/KosuPage/KosuEdit.tsx）
# ------------------------------------------------------------
class ItemDlete(APIView):
  # 指定した時間帯の工数を削除する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む
  #     work_day2  : 就業日（"YYYY-MM-DD"）
  #     time1/time2: 削除する時間帯の開始・終了日時（UTC の ISO形式文字列）
  #     （行番号 index・作業内容 work・作業詳細 detail も送られてくるが、ここでは使わない）
  # 戻り値:
  #   Response: 成功時は 200 とメッセージ
  #             工数データが無い・作業内容が空の場合は 401 エラー
  def post(self, request):
    # 就業日を取得
    day = request.data.get('work_day2')

    # ログイン者の人員データ
    member_data = request.user

    # 工数データ確認（ログイン者・就業日が一致する工数データ）
    obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    # 工数データがある場合
    if obj_filter.exists():
      # 工数データ取得
      obj_get = obj_filter.first()
      # 作業内容がある場合、作業内容、作業詳細取得（288要素のリストに分解）
      if obj_get.time_work:
        work_list = list(obj_get.time_work)
        detail_list = obj_get.detail_work.split('$')
      # 作業内容がない場合、エラー
      else:
        return Response({'status': 'error', 'message': '工数データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)
    # 工数データがない場合、エラー
    else:
      return Response({'status': 'error', 'message': '工数データが見つかりません。'}, status=status.HTTP_401_UNAUTHORIZED)

    # 項目番号から削除時間取得
    #   削除する時間帯の開始・終了日時（UTC の ISO形式）を日本時間の "HH:MM" にする。形が違えば 400
    try:
      start_time = utc_to_jst_hhmm(request.data.get('time1'))
      end_time = utc_to_jst_hhmm(request.data.get('time2'))
    except ValueError:
      return Response({'status': 'error', 'message': '削除する時間が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
    start_time_hour, start_time_min = time_index(start_time)
    end_time_hour, end_time_min = time_index(end_time)
    start_time_ind = int(int(start_time_hour)*12 + int(start_time_min)/5)
    end_time_ind = int(int(end_time_hour)*12 + int(end_time_min)/5)

    # 工数削除
    #   日をまたがない時間帯（開始 < 終了）: [開始〜終了) を未入力（'#' / ''）に戻す
    if start_time_ind < end_time_ind:
      for i in range(start_time_ind, end_time_ind):
        work_list[i] = '#'
        detail_list[i] = ''
    # 日をまたぐ時間帯（開始 > 終了）: [開始〜24:00) と [0:00〜終了) を未入力に戻す
    elif start_time_ind > end_time_ind:
      for i in range(start_time_ind, 288):
        work_list[i] = '#'
        detail_list[i] = ''
      for i in range(0, end_time_ind):
        work_list[i] = '#'
        detail_list[i] = ''

    # 工数データ更新
    #   ログイン者・就業日の工数データの作業内容・作業詳細を、削除後の内容で上書き保存する
    #   ※工数入力OK/NG判定はここでは再計算しない
    Business_Time_graph.objects.update_or_create(
      employee_no3=member_data.employee_no, 
      work_day2=day, 
      defaults = {
        'time_work': ''.join(work_list), 
        'detail_work': detail_list_summarize(detail_list), 
      }
    )
    return Response({'status': 'success', 'message': '項目が削除されました。'})



# ------------------------------------------------------------
# KosuDelete: 工数削除API
#   URL    : /api/kosu_delete/<工数データID>/
#   権限   : IsLoggedIn（ログイン済みの人員）
#   DELETE : 指定IDの工数データを削除する（ログイン者本人の工数データのみ）
#   画面   : 工数削除画面（frontend/src/KosuPage/KosuDelete.tsx）
# ------------------------------------------------------------
class KosuDelete(APIView):
  # 工数データのID（主キー）から工数データを1件取得する。
  #
  # 引数:
  #   pk: 工数データのID（URLの <int:pk> 部分）
  # 戻り値:
  #   Business_Time_graph: 該当する工数データ。存在しない場合は None
  def get_object(self, pk):
    try:
      return Business_Time_graph.objects.get(id=pk)
    # 該当する工数データがない場合は None を返して呼び出し元で 404 にする
    except Business_Time_graph.DoesNotExist:
      return None


  # 指定IDの工数データを削除する（DELETE）。
  #
  # 引数:
  #   request: HTTPリクエスト
  #   pk     : 削除対象の工数データID（URLから取得）
  # 戻り値:
  #   Response: 成功時は 204（削除成功）
  #             対象が無い・本人のデータでない場合は 404 エラー
  def delete(self, request, pk):
    # 削除対象のオブジェクトを取得
    kosu_instance = self.get_object(pk)

    # ログイン者の人員データ
    member_data = request.user

    # 工数データが無い、またはログイン者本人の工数データでない場合は 404 を返す
    #   （他人のデータを削除できないようにするため）
    if kosu_instance is None or kosu_instance.employee_no3 != member_data.employee_no:
      return Response({'status': 'error', 'message': 'レコードが見つかりません。'}, status=status.HTTP_404_NOT_FOUND)

    # レコードを削除し、204（成功・返すデータなし）を返す
    kosu_instance.delete()
    return Response({'status': 'success', 'message': 'レコードを削除しました。'}, status=status.HTTP_204_NO_CONTENT)



# ============================================================
# 勤務入力（カレンダー）
# ============================================================

# ------------------------------------------------------------
# KosuCalendar: 勤務入力（カレンダー表示）API
#   URL  : /api/kosu_calendar/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : セッションの表示年月（未設定なら今月）の、ログイン者の工数データ一覧を返す。
#   画面 : 勤務入力画面（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class KosuCalendar(APIView):
  # 表示年月の工数データ一覧を返す（GET）。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: {'session_year': 表示年, 'session_month': 表示月, 'kosu_data': その月の工数データ一覧}
  def get(self, request):
    # セッション値取得（カレンダーの表示年・月。未設定なら今日の年・月）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ
    member_data = request.user

    # 工数履歴データの取得
    #   表示月の1日の日付文字列（"YYYY-MM-01"）を作り、先頭7文字 "YYYY-MM" で始まる就業日に絞り込む
    #   （ログイン者の工数データを就業日の新しい順に取得）
    Search_month = str(datetime.date(year, month , 1))
    kosu_data = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no).order_by('-work_day2')
    kosu_data = kosu_data.filter(work_day2__startswith=Search_month[:7])
    # データ変換（複数件の工数データをJSONに変換できる形にする）
    kosu_serializer = KosuSerializer(kosu_data, many=True)

    # 送信データ（表示年月と工数データ一覧を返す）
    response_data = {
      'session_year': year,
      'session_month': month,
      'kosu_data': kosu_serializer.data,
    }
    return Response(response_data)



# ------------------------------------------------------------
# KosuCalendarChange: 勤務入力（カレンダー表示年月の変更）API
#   URL  : /api/kosu_calendar_change/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : カレンダーの表示年・月をセッションに保存する（前月・翌月への切り替え時に呼ばれる）
#   画面 : 勤務入力画面（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class KosuCalendarChange(APIView):
  # 表示年月をセッションに保存する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に year（年）・month（月）を数値で含む
  # 戻り値:
  #   Response: 200 とメッセージ（入力チェックは行わない）
  def post(self, request):
    # 送信された年・月を確かめてからセッションに保存する（数字でない値を入れると、次の GET が 500 になるため）
    try:
      year, month = parse_year_month(request.data)
    except ValueError:
      return Response({'status': 'error', 'message': '年・月が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)
    request.session['year'] = year
    request.session['month'] = month
    return Response({'status': 'success', 'message': 'カレンダーが更新されました。'})



# ------------------------------------------------------------
# KosuWorkWrite: 勤務入力（個別変更）API
#   URL  : /api/kosu_work_write/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : カレンダーで入力した表示月の各日の就業形態・直を、まとめて工数データに保存する。
#          就業形態・直を両方空にした日は、作業内容・作業詳細・残業も空なら工数データを削除する。
#   画面 : 勤務入力画面の「勤務登録」（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class KosuWorkWrite(APIView):
  # 表示月の各日の就業形態・直を一括で保存する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data は日付をキーにした辞書
  #     例: {"2026-11-01": {"work_time": "休日", "tyoku2": ""},
  #          "2026-11-02": {"work_time": "出勤", "tyoku2": "1"}, ...}
  # 戻り値:
  #   Response: 200 とメッセージ
  def post(self, request, *args, **kwargs):
    # セッション値取得（カレンダーの表示年・月。未設定なら今日の年・月）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ
    member_data = request.user

    # 指定月の最終日取得
    #   翌月1日を作り（12月なら翌年1月1日）、そこから1日引いて月末日を求める
    #   例: 2026年11月 → 2026-12-01 の1日前 → 30日
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 勤務、直書き込み（1日〜月末日まで1日ずつ処理。d は 0 始まりなので日付は d + 1）
    for d in range(day_end):
      # その日のログイン者の工数データ（無ければ None）
      obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=datetime.date(year, month, d + 1))
      obj = obj_filter.first() if obj_filter.exists() else None
      # 送信データから、その日（キー "YYYY-MM-DD"）の入力内容を取り出す
      day_key = f'{datetime.date(year, month, d + 1)}'
      day_data = request.data.get(day_key)
      # 既に工数データがある日
      if obj_filter.exists():
        # 就業形態か直のどちらかが入力されていれば、その2項目を上書きし、工数入力OK/NG判定をやり直す
        if day_data and (day_data.get('work_time') or day_data.get('tyoku2')):
          Business_Time_graph.objects.update_or_create(
            employee_no3=member_data.employee_no, 
            work_day2 = datetime.date(year, month, d + 1), 
            defaults = {
              'work_time': day_data.get('work_time', ''),
              'tyoku2': day_data.get('tyoku2', ''),
              'judgement': judgement_check(list(obj.time_work), day_data.get('work_time', ''), day_data.get('tyoku2', ''), member_data, obj.over_time)
            }
          )

        # 就業形態・直がどちらも空の場合:
        #   作業内容が全て未入力・作業詳細が空・残業0 の「中身の無い」工数データなら削除する
        else:
          if obj.time_work == '#'*288 and obj.detail_work == '$'*287 and obj.over_time == 0:
            obj.delete()

      # 工数データがまだ無い日
      else:
        # 就業形態か直のどちらかが入力されていれば、作業内容が空の工数データを新規作成する
        if day_data and (day_data.get('work_time') or day_data.get('tyoku2')):
          Business_Time_graph.objects.update_or_create(
            employee_no3=member_data.employee_no, 
            work_day2 = datetime.date(year, month, d + 1), 
            defaults = {
              'name': member_data,
              'work_time': day_data.get('work_time', ''),
              'tyoku2': day_data.get('tyoku2', ''),
              'time_work': '#'*288,
              'detail_work': '$'*287,
              'over_time': 0,
              'judgement': judgement_check(list('#'*288), day_data.get('work_time', ''), day_data.get('tyoku2', ''), member_data, 0)
            }
          )

    return Response({'status': 'success', 'message': '勤務が更新されました。'})



# ------------------------------------------------------------
# KosuLink: 勤務入力（工数入力画面へのジャンプ）API
#   URL  : /api/kosu_link/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : カレンダーでクリックした日付をセッションの就業日に保存する。
#          フロント側はこの後に工数入力画面（/kosu-new）へ遷移し、その日付で表示する。
#   画面 : 勤務入力画面の日付クリック（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class KosuLink(APIView):
  # クリックした日付をセッションの就業日に保存する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data の day に日付（"YYYY-MM-DD"）。未送信なら今日
  # 戻り値:
  #   Response: 200 とメッセージ
  def post(self, request):
    # 表示日更新（送信された日付、無ければ今日の日付をセッションの就業日にする）
    request.session['day'] = request.data.get('day',str(datetime.date.today()))
    return Response({'status': 'success', 'message': '日付セッションを更新しました。'})



# ------------------------------------------------------------
# WorkDefault: デフォルト勤務書き込みAPI
#   URL  : /api/work_default/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : 表示月の全日について、就業形態が未設定の日に初期値を設定する。
#          土日は「休日」、平日は「出勤」。既に就業形態がある日は変更しない。
#   画面 : 勤務入力画面の「デフォルト勤務」（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class WorkDefault(APIView):
  # 表示月の就業形態の初期値を一括設定する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト（送信データは使わない）
  # 戻り値:
  #   Response: 200 とメッセージ
  def post(self, request):
    # セッション値取得（カレンダーの表示年・月。未設定なら今日の年・月）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ
    member_data = request.user

    # 選択月の最終日取得
    #   翌月1日を作り（12月なら翌年1月1日）、そこから1日引いて月末日を求める
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 直、勤務書き込み（1日〜月末日まで1日ずつ処理）
    #   weekday() は 月曜=0 〜 日曜=6 を返すので、[5, 6] が土曜・日曜
    for d in range(day_end):
      # 工数データ取得しデータがあるか確認
      day = datetime.date(year, month, d + 1)
      obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
      obj = obj_filter.first() if obj_filter.exists() else None

      # 該当日に工数データがない場合、工数データ作成
      #   就業形態: 土日は「休日」、平日は「出勤」
      #   工数入力OK/NG判定: 土日は作業なし・残業0の「休日」なのでOK、平日は作業が空なのでNG
      if not obj_filter.exists(): 
        Business_Time_graph.objects.update_or_create(
          employee_no3=member_data.employee_no, 
          work_day2 = day, 
          defaults = {
            'name': member_data,
            'work_time': '休日' if day.weekday() in [5, 6] else '出勤',
            'time_work': '#'*288,
            'detail_work': '$'*287,
            'over_time': 0,
            'judgement': True if day.weekday() in [5, 6] else False
          }
        )
      # 該当日に工数データはあり勤務形態のデータがない場合、勤務形態書き込み
      #   就業形態を設定し、既存の作業内容・直・残業で工数入力OK/NG判定をやり直す
      elif not obj.work_time:
        Business_Time_graph.objects.update_or_create(
          employee_no3=member_data.employee_no, 
          work_day2 = day, 
          defaults = {
            'work_time': '休日' if day.weekday() in [5, 6] else '出勤',
            'judgement': judgement_check(list(obj.time_work), '休日' if day.weekday() in [5, 6] else '出勤', obj.tyoku2, member_data, obj.over_time)
          }
        )

    return Response({'status': 'success', 'message': 'デフォルト勤務を設定しました。'})



# ------------------------------------------------------------
# TyokuDefault: デフォルト直書き込みAPI
#   URL  : /api/tyoku_default/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   POST : 表示月の平日について、直が未設定の日に「その日が属する週」の直を設定する。
#          週ごとの直は画面のカレンダーの各行（第1週〜最大第6週）で指定する。
#          土日と、既に直がある日は変更しない。
#   画面 : 勤務入力画面の「デフォルト直」（frontend/src/KosuPage/KosuCalendar.tsx）
# ------------------------------------------------------------
class TyokuDefault(APIView):
  # 表示月の直の初期値を一括設定する（POST）。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に default_tyoku1, default_tyoku2, ...
  #            （default_tyokuN = 第N週に設定する直 '1'〜'6'。カレンダーの行数ぶん送られる。
  #              値が空・キーが無い週は設定しない）
  # 戻り値:
  #   Response: 200 とメッセージ
  def post(self, request, *args, **kwargs):
    # セッション値取得（カレンダーの表示年・月。未設定なら今日の年・月）
    year = request.session.get('year', datetime.date.today().year)
    month = request.session.get('month', datetime.date.today().month)

    # ログイン者の人員データ
    member_data = request.user

    # 月の最終日取得
    #   翌月1日を作り（12月なら翌年1月1日）、そこから1日引いて月末日を求める
    select_month = datetime.date(year, month, 1)
    if month == 12:
      month_end = 1
      year_end = year + 1
    else:
      month_end = month + 1
      year_end = year
    select_month = datetime.date(year_end, month_end, 1)
    month_day_end = select_month - datetime.timedelta(days = 1)
    day_end = month_day_end.day

    # 直書き込み（1日〜月末日まで1日ずつ処理）
    for d in range(day_end):
      # 1日毎に工数データ確認
      day = datetime.date(year, month, d + 1)
      obj_filter = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)

      # 平日の場合（weekday() は 月曜=0 〜 日曜=6。5未満なら月〜金）
      if day.weekday() < 5:
        # 工数データ取得（無ければ None）
        obj = obj_filter.first() if obj_filter.exists() else None
        # 該当日の対応週の直データ取得
        #   get_week_of_month で第何週か（日曜始まり）を求め、default_tyoku{週番号} の値を使う
        week_data = request.data.get(f'default_tyoku{get_week_of_month(day)}', None)
        # 該当日に工数データがない場合、工数データ作成
        #   直だけを設定した空の工数データを作る（作業が空なので工数入力OK/NG判定はNG）
        if week_data and not obj:
          Business_Time_graph.objects.update_or_create(
            employee_no3=member_data.employee_no,
            work_day2 = day,
            defaults = {
              'name': member_data,
              'tyoku2': week_data,
              'time_work': '#'*288,
              'detail_work': '$'*287,
              'over_time': 0,
              'judgement': False
            }
          )
        # 該当日に工数データはあり直のデータがない場合、直書き込み
        #   直を設定し、既存の作業内容・就業形態・残業で工数入力OK/NG判定をやり直す
        elif week_data and not obj.tyoku2:
          Business_Time_graph.objects.update_or_create(
            employee_no3=member_data.employee_no,
            work_day2 = day,
            defaults = {
              'tyoku2': week_data,
              'judgement': judgement_check(list(obj.time_work), obj.work_time, week_data, member_data, obj.over_time)
            }
          )
    return Response({'status': 'success', 'message': 'デフォルト直を設定しました。'})



# ============================================================
# 工数集計
# ============================================================

# ------------------------------------------------------------
# KosuTotal: 工数集計API
#   URL  : /api/kosu_total/
#   権限 : IsLoggedIn（ログイン済みの人員）
#   GET  : セッションの就業日（未設定なら今日）の工数データと工数区分定義を返す（画面の初期表示用）。
#   POST : 指定日を基準に、日間（その日）・月間（その月）・年間（その年）の工数データと
#          工数区分定義を返す。グラフの集計（工数区分ごとの合計時間）はフロント側で行う。
#   画面 : 工数集計画面（frontend/src/KosuPage/KosuTotal.tsx）
# ------------------------------------------------------------
class KosuTotal(APIView):
  # 就業日の工数データと工数区分定義を返す（GET）。
  #
  # その日の工数データが無い場合は、作業内容が空の工数データ（保存はしない）を代わりに返す。
  #
  # 引数:
  #   request: HTTPリクエスト
  # 戻り値:
  #   Response: {'member_data': 人員データ, 'kosu_data': 工数データ,
  #              'def_data': 工数区分定義, 'session_day': 就業日}
  #             工数データ・工数区分定義が重複している場合は 400、工数区分定義が無い場合は 401 エラー
  def get(self, request):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver_session = request.session.get('input_def')

    # 就業日取得（セッションに無ければ今日の日付を使い、セッションにも保存する）
    day = request.session.get('day')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day

    # ログイン者の人員データ
    member_data = request.user

    # 工数データ確認（ログイン者・就業日が一致する工数データ。2件以上あれば 400）
    kosu_query_set = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day)
    if kosu_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)

    # 工数データ取得
    #   無ければ、表示用に作業内容が全て未入力の工数データをメモリ上だけで用意する（保存しない）
    kosu_data = kosu_query_set.first()
    if kosu_data is None:
      kosu_data = Business_Time_graph()
      kosu_data.employee_no3 = member_data.employee_no
      kosu_data.work_day2 = day
      kosu_data.def_ver2 = def_ver_session
      kosu_data.time_work = '#'*288

    # 工数区分定義確認
    #   工数データを入力した工数区分定義Ver（def_ver2）があればそれを、無ければセッションの使用中Verを使う
    #   該当Verが無ければ 401、重複していれば 400 を返す
    def_query_set = kosu_division.objects.filter(kosu_name=kosu_data.def_ver2 if kosu_data.def_ver2 else def_ver_session)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # データ変換（各データをJSONに変換できる形にする）
    member_serializer = MemberSerializer(member_data, many=False)
    kosu_serializer = KosuSerializer(kosu_data)
    def_serializer = DefSerializer(def_data, many=False)

    # 送信データ（画面に返すデータをまとめる）
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'session_day': day,
    }
    return Response(response_data)


  # 指定期間（日間・月間・年間）の工数データと工数区分定義を返す（POST）。
  #
  # kosu_data は、日間なら工数データ1件（辞書）、月間・年間で該当データがあれば工数データの一覧（リスト）になる。
  # 該当データが無い場合は、作業内容が空の工数データ1件（保存はしない）を代わりに使う。
  #
  # 引数:
  #   request: HTTPリクエスト。request.data に以下を含む（KosuTotal.tsx から送信）
  #     date  : 基準日（"YYYY-MM-DD"）。空なら今日
  #     period: 集計期間（'日間' / '月間' / '年間'）
  # 戻り値:
  #   Response: {'member_data': 人員データ, 'kosu_data': 工数データ（1件 または 一覧）,
  #              'def_data': 工数区分定義, 'session_day': 基準日}
  #             工数区分定義が無い場合は 401、重複している場合は 400 エラー
  def post(self, request):
    # セッションから、使用中の工数区分定義Verを取得
    def_ver_session = request.session.get('input_def')

    # 就業日取得
    #   送信された基準日を使い、空なら今日の日付を使ってセッションにも保存する
    #   day_object: 年・月での絞り込みに使うため、日付文字列を日時データに変換したもの
    day = request.data.get('date')
    if not day:
      day = str(datetime.date.today())
      request.session['day'] = day
    # 集計期間が「日間・月間・年間」のどれでもない、または日付が読めない場合は 400 を返す
    if request.data.get('period') not in ['日間', '月間', '年間']:
      return Response({'status': 'error', 'message': '集計期間を選んでください。'}, status=status.HTTP_400_BAD_REQUEST)
    try:
      day_object = datetime.datetime.strptime(day, '%Y-%m-%d')
    except (TypeError, ValueError):
      return Response({'status': 'error', 'message': '日付が正しくありません。'}, status=status.HTTP_400_BAD_REQUEST)

    # ログイン者の人員データ
    member_data = request.user

    # 工数データ確認（集計期間ごとに取得方法を変える）
    # 日間: 基準日の工数データ1件。無ければ作業内容が空の工数データを用意する（保存しない）
    if request.data.get('period') == '日間':
      kosu_query_set = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2=day_object)
      kosu_data = kosu_query_set.first()
      if kosu_query_set.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = member_data.employee_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288
    # 月間: 基準日と同じ年・月の工数データ一覧（QuerySet）。1件も無ければ空の工数データ1件にする
    elif request.data.get('period') == '月間':
      kosu_data = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2__month=day_object.month, work_day2__year=day_object.year)
      if kosu_data.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = member_data.employee_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288
    # 年間: 基準日と同じ年の工数データ一覧（QuerySet）。1件も無ければ空の工数データ1件にする
    elif request.data.get('period') == '年間':
      kosu_data = Business_Time_graph.objects.filter(employee_no3=member_data.employee_no, work_day2__year=day_object.year)
      if kosu_data.first() is None:
        kosu_data = Business_Time_graph()
        kosu_data.employee_no3 = member_data.employee_no
        kosu_data.work_day2 = day_object
        kosu_data.def_ver2 = def_ver_session
        kosu_data.time_work = '#'*288

    # 工数区分定義確認
    #   kosu_data が工数データ1件（Business_Time_graph）の場合:
    #     その工数データの工数区分定義Ver（無ければセッションの使用中Ver）を使う
    if isinstance(kosu_data, Business_Time_graph):
      def_ver_to_filter = kosu_data.def_ver2 if kosu_data.def_ver2 else def_ver_session
    #   kosu_data が一覧（QuerySet）の場合:
    #     工数区分定義Verが入っている工数データのうち ID が最も小さいもの（最初に登録されたもの）のVerを使い、
    #     1件も無ければセッションの使用中Verを使う
    else:
      first_kosu_with_def = kosu_data.exclude(def_ver2__isnull=True).exclude(def_ver2__exact='').order_by('id').first()
      if first_kosu_with_def:
        def_ver_to_filter = first_kosu_with_def.def_ver2
      else:
        def_ver_to_filter = def_ver_session
    # 決めたVer名で工数区分定義を取得（無ければ 401、重複していれば 400）
    def_query_set = kosu_division.objects.filter(kosu_name=def_ver_to_filter)
    if not def_query_set.exists():
      return Response({'status': 'error', 'message': '工数区分データが存在しません。'}, status=status.HTTP_401_UNAUTHORIZED)
    elif def_query_set.count() > 1:
      return Response({'status': 'error', 'message': '複数の工数区分データが存在します。'}, status=status.HTTP_400_BAD_REQUEST)
    def_data = def_query_set.first()

    # データ変換（各データをJSONに変換できる形にする）
    #   工数データは1件なら many 指定なし（辞書）、一覧なら many=True（辞書のリスト）で変換する
    member_serializer = MemberSerializer(member_data, many=False)
    def_serializer = DefSerializer(def_data, many=False)
    if isinstance(kosu_data, Business_Time_graph):
      kosu_serializer = KosuSerializer(kosu_data)
    else:
      kosu_serializer = KosuSerializer(kosu_data, many=True)

    # 送信データ（画面に返すデータをまとめる）
    response_data = {
      'member_data': member_serializer.data,
      'kosu_data': kosu_serializer.data,
      'def_data': def_serializer.data,
      'session_day': day,
    }
    return Response(response_data)
