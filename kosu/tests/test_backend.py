# ============================================================
# ファイル名 : test_backend.py
# 種別       : テストコード（Django TestCase + Django REST Framework の APIClient）
# テスト対象 : バックエンド（kosu アプリ）全体
#              models.py / views/*.py（全API） / views/serializers.py /
#              utils/main_utils.py / utils/kosu_utils.py / tasks.py
# 概要       : モデル・API・シリアライザ・ユーティリティ関数・非同期タスク関数が
#              想定どおりに動くか（ステータスコード・返却データ・DBの変化）を確認する。
#              バックエンドのテストはこのファイル1つにまとまっている（全331件）。
#
# 主なクラス（番号は下の区切り線の番号と対応）:
#   - BaseTestCase               : 全テスト共通の準備（管理者設定・工数区分定義・人員2名）とログイン用ヘルパー
#   - 1.  TestModels             : 各モデルの作成と文字列表現（__str__）
#   - 2.  TestLoginLogout        : ログイン / ログアウトAPI
#   - 3.  TestMainMenuViews      : 各メニュー画面用API（ログイン・権限チェック）
#   - 4.  TestMemberViews        : 人員の一覧・登録・編集・削除API
#   - 5.  TestDefViews           : 工数区分定義・作業詳細選択肢のAPI
#   - 6.  TestInquiryViews       : 問い合わせAPI
#   - 7.  TestKosuViews          : 工数一覧・削除・集計API
#   - 8.  TestTeamViews          : 班員API（基本）
#   - 9.  TestAdministratorViews : 管理者設定・タスク履歴・操作履歴API
#   - 10. TestSerializers        : シリアライザの変換結果
#   - 11. TestUtils              : main_utils.py の関数
#   - 12. TestKosuUtils          : kosu_utils.py の関数（工数計算の中心部分）
#   - 13〜18                     : 工数入力・編集・休憩・カレンダー・日付変更・集計API
#   - 19〜28                     : 班員・管理者・問い合わせ・バックアップ等の追加ケース
#   - 29. TestTasks              : tasks.py のバックアップ/削除/読み込み関数
#
# テストの仕組み:
#   - Django の TestCase は、テストメソッド1件ごとにDBの変更を自動で取り消す
#     （トランザクション＝まとめて取り消せる処理単位で包む）。
#     そのため各テストは、他のテストが作ったデータの影響を受けない。
#   - setUp（各テストの直前に毎回実行される準備処理）でテスト用データを作る。
#   - API は APIClient（テスト用の疑似ブラウザ）で呼び出す。ログインは
#     /api/login/ を実際に呼んでセッションを作る方式（BaseTestCase.login）。
#   - DB は hozen_another/test_settings.py の設定で SQLite のメモリ上DBを使う
#     （本番の PostgreSQL には一切触れない）。
#
# モック方針 :
#   - モック（偽物への差し替え）は使用していない（patch / MagicMock は import のみで未使用）。
#   - test_settings.py の TESTING=True により、バックアップ等の非同期処理は
#     別スレッドではなくその場で同期実行されるため、結果をそのまま確認できる。
#
# 実行方法   : python manage.py test kosu --settings=hozen_another.test_settings
# 注意       : バックアップExcelの保存先（MEDIA_ROOT）は、test_settings.py で毎回新しい一時フォルダに
#              差し替えているため、テストを実行してもリポジトリ直下の media/ フォルダには書き込まない。
#              （TestTasks はさらに、テストごとに別の一時フォルダへ差し替えてから実行する）
# 関連ファイル: hozen_another/test_settings.py, kosu/urls.py, kosu/permissions.py, kosu/signals.py
# ============================================================

# ============================================================
# インポート
# ============================================================
# Django のテスト基底クラス（テストごとにDBの変更を自動で巻き戻す）
from django.test import TestCase
# APIClient: DRF のテスト用クライアント。get/post/put/delete でAPIを呼び出せる
from rest_framework.test import APIClient
# HTTPステータスの定数（このファイル内では未使用。検証は数値で直接比較している）
from rest_framework import status
# テストで直接作成・確認するモデル（データベースのテーブル定義）
from kosu.models import (
    member, Business_Time_graph, kosu_division, def_choice,
    team_member, administrator_data, inquiry_data, AsyncTask, History
)
# TestSerializers で使うシリアライザ（モデル ⇔ JSON 変換の部品）
from kosu.views.serializers import (
    MemberSerializer, KosuSerializer, DefSerializer, DefChoiceSerializer,
    InquirSerializer, AdministratorSerializer, TaskSerializer, HistorySerializer
)
# TestUtils で使う共通ユーティリティ関数
from kosu.utils.main_utils import get_all_model_names_in_myapp
# TestKosuUtils で使う工数計算用の関数（create_kosu_basic は import のみで未使用）
from kosu.utils.kosu_utils import (
    time_index, break_time_process, kosu_write, break_time_delete,
    break_time_write, detail_list_summarize, judgement_check, kosu_sort,
    break_get, parse_break_time, get_week_of_month, kosu_division_dictionary,
    get_def_library_data, create_kosu_basic
)
# json: ログインAPIへ送るJSON文字列の作成に使う
import json
# os: ファイルの存在確認・削除に使う
import os
# tempfile: 一時ファイル（テスト後に消してよいファイル）の作成に使う
import tempfile
# datetime モジュール本体（タイムゾーン JST の作成に使うため別名で読み込む）
import datetime as dt_module
# date: 日付の作成 / timedelta: 「〇日前」などの日付計算に使う
from datetime import date, timedelta
# モック用の部品（このファイル内では未使用）
from unittest.mock import patch, MagicMock


# ============================================================
# ヘルパー関数
# ============================================================

# 人員（member）作成時に必須の休憩時間24項目を、すべて同じ値でまとめて作る。
#
# member モデルは休憩時間の項目が必須のため、テストで人員を作るたびに使う。
# 値はショップ「P」など標準パターンの1直の値（"#HHMMHHMM"＝開始時刻と終了時刻）を
# 1直〜連2直の6種類すべてに入れている。
#   昼休憩      : #10401130（10:40〜11:30）
#   残業休憩1〜3: #15101520 / #20202110 / #01400150
#
# 引数:
#   なし
# 戻り値:
#   dict: {'break_time1': '#10401130', 'break_time1_over1': ..., ...} の24項目
def make_break_times():
    """Helper to generate all required break_time fields."""
    # 休憩時間を入れる辞書
    bt = {}
    # 直の番号 1〜6（1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直）ごとに4項目ずつ作る
    for i in range(1, 7):
        # 昼休憩 / 残業休憩1 / 残業休憩2 / 残業休憩3
        bt[f'break_time{i}'] = '#10401130'
        bt[f'break_time{i}_over1'] = '#15101520'
        bt[f'break_time{i}_over2'] = '#20202110'
        bt[f'break_time{i}_over3'] = '#01400150'
    return bt


# ============================================================
# 共通の基底クラス
# ============================================================

# ------------------------------------------------------------
# BaseTestCase: 多くのテストクラスが継承する共通の土台
#   準備 : 各テストの前に、ログインに必要な最低限のデータを作る
#            - 管理者設定（一覧表示件数 20）
#            - 工数区分定義Ver「TestVer」（工数区分は「作業A」の1つだけ）
#            - 管理者ユーザー 12345「テスト太郎」（権限あり・管理者権限あり・ショップP）
#            - 一般ユーザー   99999「一般ユーザー」（権限なし・管理者権限なし・ショップP）
#   ヘルパー: login / login_as_admin / login_as_normal でログイン状態を作れる
# ------------------------------------------------------------
class BaseTestCase(TestCase):
    # 各テストの前に: APIクライアントとテスト用の基本データを作成する。
    #
    # 引数:
    #   なし
    # 戻り値:
    #   なし（作成したデータは self.admin_settings / self.division /
    #         self.member / self.normal_member に保存し、各テストから参照する）
    def setUp(self):
        # DRF のテスト用クライアントを用意（Django標準の Client を上書きする）
        self.client = APIClient()

        # 管理者設定を作成
        #   menu_row: 一覧表示項目数。ページネーション（CustomPagination）の1ページ件数になる
        self.admin_settings = administrator_data.objects.create(menu_row='20')

        # 工数区分定義Verを作成
        #   ログインAPIは「最後に登録された工数区分定義Ver」をセッションに保存するため、
        #   1件もないとログインできない（400 エラーになる）
        self.division = kosu_division.objects.create(
            kosu_name='TestVer', kosu_title_1='作業A'
        )

        # 人員作成に必須の休憩時間24項目
        break_times = make_break_times()

        # 管理者ユーザー（権限・管理者権限ともにあり）。多くのテストはこの人でログインする
        self.member = member.objects.create(
            employee_no=12345, name='テスト太郎', shop='P',
            authority=True, administrator=True, **break_times
        )

        # 一般ユーザー（権限・管理者権限ともになし）。権限チェック（403）の確認に使う
        self.normal_member = member.objects.create(
            employee_no=99999, name='一般ユーザー', shop='P',
            authority=False, administrator=False, **break_times
        )

    # ログインAPIを実際に呼び出し、テスト用クライアントにログイン状態（セッション）を作る。
    #
    # ログインAPIは成功するとセッションに以下を保存する:
    #   login_No : ログイン者の従業員番号
    #   input_def: 使用する工数区分定義Ver名（最後に登録された定義Ver）
    # 以降、同じ self.client で呼ぶAPIはログイン済みとして扱われる。
    #
    # 引数:
    #   employee_no: ログインする従業員番号（省略時は管理者ユーザー 12345）
    # 戻り値:
    #   Response: ログインAPIのレスポンス（成功 200 / 失敗 400）
    def login(self, employee_no=12345):
        """Helper to set session via login endpoint."""
        # POST /api/login/ : ログインAPIはリクエスト本文を直接 json.loads で読むため、
        #   辞書を JSON 文字列に変換し、content_type に application/json を指定して送る
        response = self.client.post(
            '/api/login/',
            json.dumps({'employee_no': employee_no}),
            content_type='application/json'
        )
        return response

    # 管理者ユーザー（12345: 権限・管理者権限あり）でログインする。
    #
    # 引数:
    #   なし
    # 戻り値:
    #   Response: ログインAPIのレスポンス
    def login_as_admin(self):
        return self.login(12345)

    # 一般ユーザー（99999: 権限・管理者権限なし）でログインする。
    #
    # 引数:
    #   なし
    # 戻り値:
    #   Response: ログインAPIのレスポンス
    def login_as_normal(self):
        return self.login(99999)


# ============================================================
# テスト本体（各テストクラス）
# ============================================================

# ---------------------------------------------------------------------------
# 1. TestModels: モデル単体のテスト
#   対象 : models.py（member, Business_Time_graph, kosu_division, def_choice,
#          team_member, administrator_data, inquiry_data, AsyncTask, History）
#   内容 : モデルを直接作成し、__str__（管理画面などで表示される文字列）の形式と、
#          AsyncTask の件数上限（1000件）による古いデータの自動削除を確認する。
#   準備 : BaseTestCase を継承せず、各テスト内で必要なデータだけを作成する
# ---------------------------------------------------------------------------
class TestModels(TestCase):
    # 【テスト】人員を作成でき、文字列表現が氏名になること
    #   前提: なし
    #   操作: 従業員番号 11111・氏名「山田太郎」の人員を作成する
    #   期待: str() が「山田太郎」、employee_no が 11111
    def test_member_creation_and_str(self):
        # 準備: 必須の休憩時間24項目を用意し、人員を作成する
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        # 検証: 文字列表現は氏名、従業員番号は作成時の値
        self.assertEqual(str(m), '山田太郎')
        self.assertEqual(m.employee_no, 11111)

    # 【テスト】工数データを作成でき、文字列表現が「ID__就業日:従業員番号」になること
    #   前提: 人員 11111 が存在する
    #   操作: 2026-01-01・1直の工数データを作成する
    #   期待: str() が「{ID}__2026-01-01:11111」
    def test_business_time_graph_creation_and_str(self):
        # 準備: 工数データの氏名（外部キー）に紐づける人員を作成
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        # 操作: 工数データを作成（name には人員オブジェクトを渡す＝外部キー）
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=m, work_day2=date(2026, 1, 1),
            tyoku2='1', over_time=0
        )
        # 検証: models.py の __str__ と同じ形式の文字列になっている（ID は自動採番のため変数で埋め込む）
        expected = f'{kosu.id}__2026-01-01:11111'
        self.assertEqual(str(kosu), expected)

    # 【テスト】工数区分定義を作成でき、文字列表現に定義Ver名が含まれること
    #   前提: なし
    #   操作: 定義Ver名「Ver2」の工数区分定義を作成する
    #   期待: str()（「ID : 定義Ver名」形式）に「Ver2」が含まれる
    def test_kosu_division_creation(self):
        # 操作: 工数区分定義を作成
        div = kosu_division.objects.create(kosu_name='Ver2', kosu_title_1='TaskA')
        # 検証: 文字列表現に定義Ver名が含まれる
        self.assertIn('Ver2', str(div))

    # 【テスト】作業詳細の選択肢を作成でき、文字列表現が「定義記号＋作業詳細」になること
    #   前提: なし
    #   操作: 定義記号「A」・作業詳細「溶接作業」の選択肢を作成する
    #   期待: str() が「A溶接作業」
    def test_def_choice_creation(self):
        # 操作: 作業詳細の選択肢を作成
        choice = def_choice.objects.create(def_symbol='A', def_select='溶接作業')
        # 検証: 定義記号と作業詳細を連結した文字列になる
        self.assertEqual(str(choice), 'A溶接作業')

    # 【テスト】班員データを作成でき、文字列表現が班の管理者（班長）の従業員番号になること
    #   前提: なし
    #   操作: 班長 12345・メンバー1 に 11111 を登録した班員データを作成する
    #   期待: str() が「12345」
    def test_team_member_creation(self):
        # 操作: 班員データを作成（employee_no5 は班を管理するログイン者の従業員番号）
        tm = team_member.objects.create(employee_no5=12345, member1='11111')
        # 検証: 文字列表現は employee_no5 の値
        self.assertEqual(str(tm), '12345')

    # 【テスト】管理者設定を作成でき、文字列表現が「設定{ID}」になること
    #   前提: なし
    #   操作: 一覧表示項目数 30 の管理者設定を作成する
    #   期待: str() に「設定」が含まれる
    def test_administrator_data_creation(self):
        # 操作: 管理者設定を作成
        ad = administrator_data.objects.create(menu_row='30')
        # 検証: 文字列表現に「設定」が含まれる
        self.assertIn('設定', str(ad))

    # 【テスト】問い合わせを人員に紐づけて作成でき、文字列表現に氏名が含まれること
    #   前提: 人員 11111「山田太郎」が存在する
    #   操作: その人員を氏名（外部キー）に指定して問い合わせを作成する
    #   期待: str()（「ID＋氏名」形式）に「山田太郎」が含まれる
    def test_inquiry_data_creation_with_fk(self):
        # 準備: 問い合わせの氏名（外部キー）に紐づける人員を作成
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        # 操作: 問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=11111, name=m, content_choice='要望',
            inquiry='テスト問い合わせ', answer=''
        )
        # 検証: 文字列表現に紐づけた人員の氏名が含まれる
        self.assertIn('山田太郎', str(inq))

    # 【テスト】非同期タスクの記録が上限（MAX_RECORDS=1000件）を超えると古いものから自動削除されること
    #   前提: なし
    #   操作: タスク記録を 1002 件作成する
    #   期待: 件数が上限以下に保たれ、最初に作った「task_00000」が削除されている
    def test_async_task_max_records_auto_deletion(self):
        """Create 1001+ records and verify oldest are deleted."""
        # 操作: タスク記録を 1002 件作成（task_id は task_00000〜task_01001）
        #   AsyncTask.save() は保存のたびに件数を数え、上限を超えた分を作成日時の古い順に削除する
        for i in range(1002):
            AsyncTask.objects.create(
                task_id=f'task_{i:05d}', status='success'
            )
        # 検証: 件数が上限（1000件）以下
        self.assertLessEqual(AsyncTask.objects.count(), AsyncTask.MAX_RECORDS)
        # 検証: 一番古い記録（最初に作った task_00000）は削除されている
        self.assertFalse(AsyncTask.objects.filter(task_id='task_00000').exists())

    # 【テスト】非同期タスク記録の文字列表現に状態とタスクIDが含まれること
    #   前提: なし
    #   操作: 状態 pending・タスクID「test-task-1」の記録を作成する
    #   期待: str()（「作成日時 on 状態 (TaskID: タスクID)」形式）に両方が含まれる
    def test_async_task_str_format(self):
        # 操作: タスク記録を作成し、文字列表現を取得
        task = AsyncTask.objects.create(task_id='test-task-1', status='pending')
        s = str(task)
        # 検証: 状態とタスクIDが含まれる
        self.assertIn('pending', s)
        self.assertIn('test-task-1', s)

    # 【テスト】操作履歴を保存でき、文字列表現が「操作 on テーブル名 (ID: レコードID)」になること
    #   前提: なし
    #   操作: member テーブルの ID 1 に対する CREATE の操作履歴を作成する
    #   期待: str() が「CREATE on member (ID: 1)」
    def test_history_save_works(self):
        # 操作: 操作履歴を作成（changes は変更内容を入れる JSON 項目）
        h = History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={'field': 'value'}
        )
        # 検証: 決まった形式の文字列になる
        self.assertEqual(str(h), 'CREATE on member (ID: 1)')


# ---------------------------------------------------------------------------
# 2. TestLoginLogout: ログイン / ログアウトAPIのテスト
#   対象 : POST /api/login/（main_views.Login）, POST /api/logout/（main_views.Logout）
#   内容 : 登録済み / 未登録の従業員番号・不正なJSONでのログイン結果と、
#          ログイン後にセッションが有効になること・ログアウトで無効になることを確認する。
# ---------------------------------------------------------------------------
class TestLoginLogout(BaseTestCase):
    # 【テスト】登録済みの従業員番号でログインできること
    #   前提: 人員 12345 が登録されている
    #   操作: 従業員番号 12345 でログインAPIを呼ぶ
    #   期待: 200 が返り、本文の status が "success"
    def test_login_success(self):
        # 操作: 管理者ユーザーの従業員番号でログイン
        response = self.login(12345)
        # 検証: 成功（200）し、レスポンス本文（JSON）の status が success
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')

    # 【テスト】未登録の従業員番号ではログインできないこと
    #   前提: 従業員番号 0 の人員は存在しない
    #   操作: 従業員番号 00000（= 数値の 0）でログインAPIを呼ぶ
    #   期待: 400（入力エラー）が返る
    def test_login_nonexistent_employee(self):
        # 操作: 存在しない従業員番号でログイン（00000 は Python では整数 0 として扱われる）
        response = self.login(00000)
        # 検証: 「登録がありません」エラーの 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】JSON として読めない本文を送るとログインできないこと
    #   前提: なし
    #   操作: 本文に文字列 "not-json" を入れてログインAPIを呼ぶ
    #   期待: 400（JSON形式が正しくない）が返る
    def test_login_invalid_json(self):
        # 操作: content_type は JSON だが中身が JSON ではない本文を送る
        response = self.client.post(
            '/api/login/', 'not-json',
            content_type='application/json'
        )
        # 検証: json.loads の失敗を検知して 400 を返す
        self.assertEqual(response.status_code, 400)

    # 【テスト】ログイン後はログイン必須のAPIを呼べること（セッションが作られていること）
    #   前提: なし
    #   操作: ログインしてからメインメニューAPIを呼ぶ
    #   期待: 200 が返る
    def test_login_sets_session(self):
        # 準備: 管理者ユーザーでログイン
        self.login(12345)
        # 操作: ログイン必須のメインメニューAPIを呼び、セッションが有効か確かめる
        response = self.client.get('/api/main_menu/')
        # 検証: ログイン済みとして扱われ 200 が返る
        self.assertEqual(response.status_code, 200)

    # 【テスト】ログアウトするとセッションが消え、ログイン必須のAPIが 401 になること
    #   前提: ログイン済み
    #   操作: ログアウトAPIを呼んだ後、メインメニューAPIを呼ぶ
    #   期待: ログアウトは 200、その後のメインメニューは 401（未ログイン）
    def test_logout_flushes_session(self):
        # 準備: 管理者ユーザーでログイン
        self.login(12345)
        # 操作: POST /api/logout/ でログアウト（サーバー側のセッションを全削除する）
        response = self.client.post('/api/logout/')
        # 検証: ログアウト自体は成功（200）
        self.assertEqual(response.status_code, 200)
        # 操作: ログアウト後にログイン必須のAPIを呼ぶ
        response = self.client.get('/api/main_menu/')
        # 検証: セッションが無いため 401（未ログイン → フロントではログイン画面へ戻される）
        self.assertEqual(response.status_code, 401)


# ---------------------------------------------------------------------------
# 3. TestMainMenuViews: 各メニュー画面用APIのテスト
#   対象 : /api/main_menu/, /api/kosu_menu/, /api/member_menu/, /api/def_menu/,
#          /api/inquir_menu/, /api/manager_menu/, /api/team_menu/（main_views.py）
#   内容 : 未ログインなら 401、必要な権限が無ければ 403、条件を満たせば 200 になることを確認する。
#          ※権限チェックの仕組み（kosu/permissions.py）:
#            401 = 未ログイン（IsLoggedIn が全APIに既定でかかっている）
#            403 = ログイン済みだが「権限」(HasAuthority) や「管理者権限」(IsAdministrator) が無い
# ---------------------------------------------------------------------------
class TestMainMenuViews(BaseTestCase):
    # 【テスト】未ログインでメインメニューAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/main_menu/
    #   期待: 401（未ログイン）
    def test_menu_get_without_login(self):
        # 操作: ログインせずにメインメニューAPIを呼ぶ
        response = self.client.get('/api/main_menu/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】ログイン後はメインメニューAPIがログイン者情報と管理者設定を返すこと
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/main_menu/
    #   期待: 200 が返り、login_data（ログイン者）と admin_data（管理者設定）が含まれる
    def test_menu_get_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: メインメニューAPIを呼ぶ
        response = self.client.get('/api/main_menu/')
        # 検証: 200 で、ログイン者情報と管理者設定の両方が返る
        self.assertEqual(response.status_code, 200)
        self.assertIn('login_data', response.data)
        self.assertIn('admin_data', response.data)

    # 【テスト】未ログインで工数メニューAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/kosu_menu/
    #   期待: 401（未ログイン）
    def test_kosu_menu_without_login(self):
        # 操作: ログインせずに工数メニューAPIを呼ぶ
        response = self.client.get('/api/kosu_menu/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】ログイン後は工数メニューAPIを呼べること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/kosu_menu/
    #   期待: 200
    def test_kosu_menu_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数メニューAPIを呼ぶ
        response = self.client.get('/api/kosu_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】未ログインで人員メニューAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/member_menu/
    #   期待: 401（未ログイン）
    def test_member_menu_without_login(self):
        # 操作: ログインせずに人員メニューAPIを呼ぶ
        response = self.client.get('/api/member_menu/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】「権限」ありのユーザーは人員メニューAPIを呼べること
    #   前提: 管理者ユーザー（権限あり）でログイン済み
    #   操作: GET /api/member_menu/
    #   期待: 200
    def test_member_menu_with_authority(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 人員メニューAPIを呼ぶ
        response = self.client.get('/api/member_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】「権限」なしのユーザーは人員メニューAPIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/member_menu/
    #   期待: 403（権限なし）
    def test_member_menu_without_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 人員メニューAPIを呼ぶ
        response = self.client.get('/api/member_menu/')
        # 検証: HasAuthority の条件を満たさないため 403
        self.assertEqual(response.status_code, 403)

    # 【テスト】ログイン後は工数区分定義メニューAPIを呼べること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/def_menu/
    #   期待: 200
    def test_def_menu_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義メニューAPIを呼ぶ
        response = self.client.get('/api/def_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】ログイン後は問い合わせメニューAPIを呼べること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/inquir_menu/
    #   期待: 200
    def test_inquir_menu_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 問い合わせメニューAPIを呼ぶ
        response = self.client.get('/api/inquir_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】未ログインで管理者メニューAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/manager_menu/
    #   期待: 401（未ログイン）
    def test_administrator_menu_without_login(self):
        # 操作: ログインせずに管理者メニューAPIを呼ぶ
        response = self.client.get('/api/manager_menu/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】管理者権限ありのユーザーは管理者メニューAPIを呼べること
    #   前提: 管理者ユーザー（管理者権限あり）でログイン済み
    #   操作: GET /api/manager_menu/
    #   期待: 200
    def test_administrator_menu_with_admin(self):
        # 準備: 管理者権限ありのユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者メニューAPIを呼ぶ
        response = self.client.get('/api/manager_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者権限なしのユーザーは管理者メニューAPIを呼べないこと
    #   前提: 一般ユーザー（管理者権限なし）でログイン済み
    #   操作: GET /api/manager_menu/
    #   期待: 403（権限なし）
    def test_administrator_menu_non_admin(self):
        # 準備: 管理者権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 管理者メニューAPIを呼ぶ
        response = self.client.get('/api/manager_menu/')
        # 検証: IsAdministrator の条件を満たさないため 403
        self.assertEqual(response.status_code, 403)

    # 【テスト】権限ありのユーザーは班員メニューAPIを呼べること
    #   前提: 管理者ユーザー（権限あり）でログイン済み
    #   操作: GET /api/team_menu/
    #   期待: 200
    def test_team_menu_with_login(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員メニューAPIを呼ぶ
        response = self.client.get('/api/team_menu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 4. TestMemberViews: 人員（member）APIのテスト
#   対象 : /api/member_list/, /api/member_new/, /api/member_update/<従業員番号>/,
#          /api/member_delete/<従業員番号>/（member_views.py。すべて「権限」ありのみ利用可）
#   内容 : 一覧の取得と絞り込み、新規登録（ショップ別の休憩時間初期値・重複チェック）、
#          編集（重複チェック）、削除を確認する。
# ---------------------------------------------------------------------------
class TestMemberViews(BaseTestCase):
    # 【テスト】未ログインで人員一覧APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/member_list/
    #   期待: 401（未ログイン）
    def test_member_list_without_login(self):
        # 操作: ログインせずに人員一覧APIを呼ぶ
        response = self.client.get('/api/member_list/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】権限ありのユーザーは人員一覧をページネーション形式で取得できること
    #   前提: 管理者ユーザー（権限あり）でログイン済み
    #   操作: GET /api/member_list/
    #   期待: 200 が返り、本文に results（その時のページの人員一覧）が含まれる
    def test_member_list_with_authority(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 人員一覧APIを呼ぶ
        response = self.client.get('/api/member_list/')
        # 検証: 200 で、ページネーション形式（count / page_size / results）の results がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    # 【テスト】権限なしのユーザーは人員一覧APIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/member_list/
    #   期待: 403（権限なし）
    def test_member_list_without_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 人員一覧APIを呼ぶ
        response = self.client.get('/api/member_list/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】従業員番号で人員一覧を絞り込めること（部分一致）
    #   前提: 人員は 12345 と 99999 の2名
    #   操作: GET /api/member_list/?employee_no=12345
    #   期待: 200 が返り、結果は 12345 の1件だけ
    def test_member_list_search_by_employee_no(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 従業員番号 12345 を検索条件にして一覧を取得（GET の第2引数はクエリパラメータになる）
        response = self.client.get('/api/member_list/', {'employee_no': '12345'})
        # 検証: 200 で、「12345」を含む人員（1名）だけが返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    # 【テスト】ショップで人員一覧を絞り込めること（完全一致）
    #   前提: 人員 12345・99999 はどちらもショップ P
    #   操作: GET /api/member_list/?shop=P
    #   期待: 200 が返り、結果は2件
    def test_member_list_search_by_shop(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ショップ P を検索条件にして一覧を取得
        response = self.client.get('/api/member_list/', {'shop': 'P'})
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: 管理者ユーザー・一般ユーザーともにショップ P のため2件返る
        self.assertEqual(len(response.data['results']), 2)

    # 【テスト】権限ありのユーザーは人員登録画面の初期表示用APIを呼べること
    #   前提: 管理者ユーザー（権限あり）でログイン済み
    #   操作: GET /api/member_new/
    #   期待: 200（ログイン者自身の人員データが返る）
    def test_member_new_get_with_authority(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 人員登録画面の初期表示用APIを呼ぶ
        response = self.client.get('/api/member_new/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】人員を新規登録できること
    #   前提: 従業員番号 55555 の人員は存在しない
    #   操作: 従業員番号 55555・ショップ P の人員を POST /api/member_new/ で登録する
    #   期待: 201（作成成功）が返り、DBに 55555 の人員が存在する
    def test_member_new_post_creates_member(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容（休憩時間は送らない。API側でショップに応じた初期値が自動で入る）
        data = {
            'employee_no': 55555, 'name': '新規太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        # 操作: 人員登録APIを呼ぶ（format='json' で辞書を JSON に変換して送信する）
        response = self.client.post('/api/member_new/', data, format='json')
        # 検証: 201（作成成功）で、DBに登録されている
        self.assertEqual(response.status_code, 201)
        self.assertTrue(member.objects.filter(employee_no=55555).exists())

    # 【テスト】既に登録済みの従業員番号では人員を登録できないこと
    #   前提: 従業員番号 12345 の人員が存在する
    #   操作: 従業員番号 12345 で人員登録APIを呼ぶ
    #   期待: 400（「すでに登録されています」エラー）
    def test_member_new_post_duplicate_employee_no(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 既存の管理者ユーザーと同じ従業員番号の登録内容
        data = {
            'employee_no': 12345, 'name': '重複太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        # 操作: 人員登録APIを呼ぶ
        response = self.client.post('/api/member_new/', data, format='json')
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】組立系ショップ（W1）で登録すると、組立系用の休憩時間初期値が入ること
    #   前提: なし
    #   操作: ショップ W1 の人員 66666 を登録する
    #   期待: 201 が返り、1直の昼休憩 break_time1 が "#11401240"（11:40〜12:40）
    def test_member_new_post_shop_w1_sets_correct_break_times(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: ショップ W1 の登録内容
        data = {
            'employee_no': 66666, 'name': 'W1太郎', 'shop': 'W1',
            'authority': False, 'administrator': False,
        }
        # 操作: 人員登録APIを呼ぶ
        response = self.client.post('/api/member_new/', data, format='json')
        # 検証: 201（作成成功）
        self.assertEqual(response.status_code, 201)
        # 検証: 登録された人員をDBから取り出す
        created = member.objects.get(employee_no=66666)
        # 検証: W1 は組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）の分岐に入り、
        #       1直の昼休憩が "#11401240" になる
        self.assertEqual(created.break_time1, '#11401240')

    # 【テスト】組立系以外のショップ（P）で登録すると、標準の休憩時間初期値が入ること
    #   前提: なし
    #   操作: ショップ P の人員 77777 を登録する
    #   期待: 201 が返り、1直の昼休憩 break_time1 が "#10401130"（10:40〜11:30）
    def test_member_new_post_shop_p_sets_correct_break_times(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: ショップ P の登録内容
        data = {
            'employee_no': 77777, 'name': 'P太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        # 操作: 人員登録APIを呼ぶ
        response = self.client.post('/api/member_new/', data, format='json')
        # 検証: 201（作成成功）
        self.assertEqual(response.status_code, 201)
        # 検証: 登録された人員をDBから取り出す
        created = member.objects.get(employee_no=77777)
        # 検証: P は組立系以外（else 側）の分岐に入り、1直の昼休憩が "#10401130" になる
        self.assertEqual(created.break_time1, '#10401130')

    # 【テスト】従業員番号を指定して人員1件を取得できること
    #   前提: 人員 12345 が存在する
    #   操作: GET /api/member_update/12345/
    #   期待: 200 が返り、employee_no が 12345
    def test_member_update_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 人員編集画面の初期表示用APIを呼ぶ（URLの数字は主キーIDではなく従業員番号）
        response = self.client.get(f'/api/member_update/{self.member.employee_no}/')
        # 検証: 200 で、指定した人員のデータが返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['employee_no'], 12345)

    # 【テスト】人員データを更新できること
    #   前提: 人員 12345「テスト太郎」が存在する
    #   操作: 氏名を「更新太郎」にした全項目を PUT /api/member_update/12345/ で送る
    #   期待: 200 が返り、DBの氏名が「更新太郎」になる
    def test_member_update_put(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 更新内容（PUT は全項目の送信が必要なため、休憩時間24項目も含める）
        bt = make_break_times()
        data = {
            'employee_no': 12345, 'name': '更新太郎', 'shop': 'P',
            'authority': True, 'administrator': True, **bt
        }
        # 操作: 人員編集APIを呼ぶ
        response = self.client.put(
            f'/api/member_update/{self.member.employee_no}/',
            data, format='json'
        )
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから最新の値を読み直し（refresh_from_db）、氏名が更新されている
        self.member.refresh_from_db()
        self.assertEqual(self.member.name, '更新太郎')

    # 【テスト】他の人員が使っている従業員番号には変更できないこと
    #   前提: 人員 12345 と 99999 が存在する
    #   操作: 12345 の従業員番号を 99999 に変更する PUT を送る
    #   期待: 400（「すでに登録されています」エラー）
    def test_member_update_put_duplicate_employee_no(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 従業員番号を一般ユーザーと同じ 99999 にした更新内容
        bt = make_break_times()
        data = {
            'employee_no': 99999, 'name': '重複更新', 'shop': 'P',
            'authority': True, 'administrator': True, **bt
        }
        # 操作: 12345 の人員編集APIを呼ぶ
        response = self.client.put(
            f'/api/member_update/{self.member.employee_no}/',
            data, format='json'
        )
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】人員を削除できること
    #   前提: 人員 99999 が存在する
    #   操作: DELETE /api/member_delete/99999/
    #   期待: 204（削除成功・返すデータなし）が返り、DBから 99999 が消えている
    def test_member_delete(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 一般ユーザーを削除する
        response = self.client.delete(
            f'/api/member_delete/{self.normal_member.employee_no}/'
        )
        # 検証: 204 で、DBに存在しない
        self.assertEqual(response.status_code, 204)
        self.assertFalse(member.objects.filter(employee_no=99999).exists())


# ---------------------------------------------------------------------------
# 5. TestDefViews: 工数区分定義・作業詳細選択肢APIのテスト
#   対象 : /api/def_list/, /api/def_new/, /api/def_update/<ID>/, /api/def_delete/<ID>/,
#          /api/def_ver/, /api/def_search/, /api/def_detail_new/, /api/def_detail_list/,
#          /api/def_detail_update/<ID>/, /api/def_detail_delete/<ID>/（def_views.py）
#   内容 : 工数区分定義（作業カテゴリの定義セット）の一覧・登録・編集・削除・使用Ver切り替えと、
#          作業詳細選択肢（def_choice）の登録・一覧・編集・削除を確認する。
#          ※def_list / def_new / def_update / def_delete / def_detail_* は管理者権限が必要
# ---------------------------------------------------------------------------
class TestDefViews(BaseTestCase):
    # 【テスト】管理者は工数区分定義の一覧を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/def_list/
    #   期待: 200 が返り、results（一覧）が含まれる
    def test_def_list_with_admin(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義一覧APIを呼ぶ
        response = self.client.get('/api/def_list/')
        # 検証: 200 で、ページネーション形式の results がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    # 【テスト】管理者権限なしのユーザーは工数区分定義の一覧を取得できないこと
    #   前提: 一般ユーザー（管理者権限なし）でログイン済み
    #   操作: GET /api/def_list/
    #   期待: 403（権限なし）
    def test_def_list_non_admin(self):
        # 準備: 一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 工数区分定義一覧APIを呼ぶ
        response = self.client.get('/api/def_list/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】管理者は工数区分定義の登録画面用APIを呼べること
    #   前提: 管理者ユーザーでログイン済み（セッションに工数区分定義Verあり）
    #   操作: GET /api/def_new/
    #   期待: 200
    def test_def_new_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義の登録画面用APIを呼ぶ
        response = self.client.get('/api/def_new/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数区分定義を新規登録できること
    #   前提: 定義Ver名「NewVer」は未登録
    #   操作: 定義Ver名「NewVer」・工数区分1「新作業」を POST /api/def_new/ で登録する
    #   期待: 200（このAPIは登録成功時も 201 ではなく 200 を返す）、DBに NewVer が存在する
    def test_def_new_post_creates_definition(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容（kosu_name: 定義Ver名 / kosu_title_1: 1番目の工数区分名）
        data = {'kosu_name': 'NewVer', 'kosu_title_1': '新作業'}
        # 操作: 工数区分定義の登録APIを呼ぶ
        response = self.client.post('/api/def_new/', data, format='json')
        # 検証: 200 で、DBに登録されている
        self.assertEqual(response.status_code, 200)
        self.assertTrue(kosu_division.objects.filter(kosu_name='NewVer').exists())

    # 【テスト】登録済みの定義Ver名では工数区分定義を登録できないこと
    #   前提: 定義Ver名「TestVer」が登録済み
    #   操作: 定義Ver名「TestVer」で登録APIを呼ぶ
    #   期待: 400（「同一の工数区分定義Ver名が既に登録されています」エラー）
    def test_def_new_post_duplicate_name(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: setUp で作成済みの定義Ver名と同じ名前の登録内容
        data = {'kosu_name': 'TestVer', 'kosu_title_1': '重複'}
        # 操作: 工数区分定義の登録APIを呼ぶ
        response = self.client.post('/api/def_new/', data, format='json')
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】定義Ver名が空欄では工数区分定義を登録できないこと
    #   前提: なし
    #   操作: 定義Ver名を空文字にして登録APIを呼ぶ
    #   期待: 400（「工数区分定義Ver名を入力してください」エラー）
    def test_def_new_post_empty_name(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 定義Ver名が空の登録内容
        data = {'kosu_name': '', 'kosu_title_1': 'X'}
        # 操作: 工数区分定義の登録APIを呼ぶ
        response = self.client.post('/api/def_new/', data, format='json')
        # 検証: 未入力のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】IDを指定して工数区分定義1件を取得できること
    #   前提: 工数区分定義「TestVer」が存在する
    #   操作: GET /api/def_update/<TestVer のID>/
    #   期待: 200 が返り、kosu_name が「TestVer」
    def test_def_update_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義の編集画面用APIを呼ぶ（URLの数字は工数区分定義の主キーID）
        response = self.client.get(f'/api/def_update/{self.division.id}/')
        # 検証: 200 で、指定した定義が返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kosu_name'], 'TestVer')

    # 【テスト】工数区分定義を更新できること
    #   前提: 工数区分定義「TestVer」が存在する
    #   操作: 定義Ver名を「UpdatedVer」にして PUT /api/def_update/<ID>/ を送る
    #   期待: 200 が返り、DBの定義Ver名が「UpdatedVer」になる
    def test_def_update_put(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 更新内容
        data = {'kosu_name': 'UpdatedVer', 'kosu_title_1': '更新A'}
        # 操作: 工数区分定義の編集APIを呼ぶ
        response = self.client.put(
            f'/api/def_update/{self.division.id}/', data, format='json'
        )
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから読み直し、定義Ver名が更新されている
        self.division.refresh_from_db()
        self.assertEqual(self.division.kosu_name, 'UpdatedVer')

    # 【テスト】工数区分定義を削除できること
    #   前提: 工数区分定義「TestVer」が存在する
    #   操作: DELETE /api/def_delete/<ID>/
    #   期待: 204（削除成功）が返り、DBから消えている
    def test_def_delete(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義の削除APIを呼ぶ
        response = self.client.delete(f'/api/def_delete/{self.division.id}/')
        # 検証: 204 で、DBに存在しない
        self.assertEqual(response.status_code, 204)
        self.assertFalse(kosu_division.objects.filter(id=self.division.id).exists())

    # 【テスト】工数区分定義Verの選択肢と現在使用中のVerを取得できること
    #   前提: ログイン済み（セッションの使用Verは「TestVer」）
    #   操作: GET /api/def_ver/
    #   期待: 200 が返り、choices（全定義の一覧）と current_version（使用中のVer名）が含まれる
    def test_def_ver_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義Ver選択画面用APIを呼ぶ
        response = self.client.get('/api/def_ver/')
        # 検証: 200 で、選択肢と現在のVerが返る
        self.assertEqual(response.status_code, 200)
        self.assertIn('choices', response.data)
        self.assertIn('current_version', response.data)

    # 【テスト】使用する工数区分定義Verを切り替えられること
    #   前提: 定義Ver「Ver2」が存在する
    #   操作: POST /api/def_ver/ に versionchoice="Ver2" を送る
    #   期待: 200（セッションの使用Verが Ver2 に変わる。セッションの中身自体はこのテストでは確認していない）
    def test_def_ver_post_switches_version(self):
        # 準備: 管理者ユーザーでログインし、切り替え先の定義Ver「Ver2」を作成
        self.login_as_admin()
        kosu_division.objects.create(kosu_name='Ver2')
        # 操作: 使用Verの切り替えAPIを呼ぶ
        response = self.client.post(
            '/api/def_ver/', {'versionchoice': 'Ver2'}, format='json'
        )
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】使用中の工数区分定義の内容を取得できること
    #   前提: ログイン済み（セッションの使用Verは「TestVer」）
    #   操作: GET /api/def_search/
    #   期待: 200
    def test_def_search_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義確認APIを呼ぶ（セッションの使用Verと同じ名前の定義を返す）
        response = self.client.get('/api/def_search/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】作業詳細の選択肢を新規登録できること
    #   前提: 作業詳細「テスト作業詳細」は未登録
    #   操作: 定義記号「A」・作業詳細「テスト作業詳細」を POST /api/def_detail_new/ で登録する
    #   期待: 201（作成成功）が返り、DBに存在する
    def test_def_detail_new_post_creates_choice(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容（def_symbol: 工数区分の記号 / def_select: 作業詳細の文言）
        data = {'def_symbol': 'A', 'def_select': 'テスト作業詳細'}
        # 操作: 作業詳細選択肢の登録APIを呼ぶ
        response = self.client.post('/api/def_detail_new/', data, format='json')
        # 検証: 201 で、DBに登録されている
        self.assertEqual(response.status_code, 201)
        self.assertTrue(def_choice.objects.filter(def_select='テスト作業詳細').exists())

    # 【テスト】作業詳細の選択肢一覧を取得できること
    #   前提: 作業詳細の選択肢が1件存在する
    #   操作: GET /api/def_detail_list/
    #   期待: 200 が返り、results（一覧）が含まれる
    def test_def_detail_list_get(self):
        # 準備: 管理者ユーザーでログインし、選択肢を1件作成
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='作業X')
        # 操作: 作業詳細選択肢の一覧APIを呼ぶ
        response = self.client.get('/api/def_detail_list/')
        # 検証: 200 で、ページネーション形式の results がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    # 【テスト】作業詳細の選択肢を更新できること
    #   前提: 作業詳細「旧作業」の選択肢が存在する
    #   操作: 作業詳細を「新作業」にして PUT /api/def_detail_update/<ID>/ を送る
    #   期待: 200 が返り、DBの作業詳細が「新作業」になる
    def test_def_detail_update_put(self):
        # 準備: 管理者ユーザーでログインし、更新対象の選択肢を作成
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='A', def_select='旧作業')
        # 準備: 更新内容
        data = {'def_symbol': 'A', 'def_select': '新作業'}
        # 操作: 作業詳細選択肢の編集APIを呼ぶ
        response = self.client.put(
            f'/api/def_detail_update/{choice.id}/', data, format='json'
        )
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから読み直し、作業詳細が更新されている
        choice.refresh_from_db()
        self.assertEqual(choice.def_select, '新作業')

    # 【テスト】作業詳細の選択肢を削除できること
    #   前提: 作業詳細「削除対象」の選択肢が存在する
    #   操作: DELETE /api/def_detail_delete/<ID>/
    #   期待: 204（削除成功）が返り、DBから消えている
    def test_def_detail_delete(self):
        # 準備: 管理者ユーザーでログインし、削除対象の選択肢を作成
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='B', def_select='削除対象')
        # 操作: 作業詳細選択肢の削除APIを呼ぶ
        response = self.client.delete(f'/api/def_detail_delete/{choice.id}/')
        # 検証: 204 で、DBに存在しない
        self.assertEqual(response.status_code, 204)
        self.assertFalse(def_choice.objects.filter(id=choice.id).exists())


# ---------------------------------------------------------------------------
# 6. TestInquiryViews: 問い合わせAPIのテスト
#   対象 : /api/inquir_list/, /api/inquir_new/, /api/inquir_detail/<ID>/,
#          /api/inquir_update/<ID>/（inquiry_views.py）
#   内容 : 問い合わせの一覧・新規登録・詳細表示・編集（回答の書き込み）・削除を確認する。
#   準備 : 管理者ユーザー 12345 を「問い合わせ担当者1」に設定する
# ---------------------------------------------------------------------------
class TestInquiryViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、管理者ユーザーを問い合わせ担当者にする
    def setUp(self):
        # 親クラス（BaseTestCase）の setUp を先に実行し、共通データを作る
        super().setUp()
        # 管理者設定の「問い合わせ担当者従業員番号1」に 12345 を設定して保存する
        #   問い合わせ編集APIは「質問者本人」か「問い合わせ担当者」しか開けないため
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    # 【テスト】問い合わせ一覧を取得できること
    #   前提: ログイン済み
    #   操作: GET /api/inquir_list/
    #   期待: 200 が返り、inquir_data（ページネーション済みの一覧）が含まれる
    def test_inquir_list_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 問い合わせ一覧APIを呼ぶ
        response = self.client.get('/api/inquir_list/')
        # 検証: 200 で、inquir_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)

    # 【テスト】問い合わせ登録画面の初期表示用APIを呼べること
    #   前提: ログイン済み
    #   操作: GET /api/inquir_new/
    #   期待: 200
    def test_inquir_new_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 問い合わせ登録画面用APIを呼ぶ
        response = self.client.get('/api/inquir_new/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】問い合わせを新規登録できること
    #   前提: ログイン済み
    #   操作: 内容「要望」・本文「テスト要望内容」を POST /api/inquir_new/ で登録する
    #   期待: 200 が返り、DBに問い合わせが存在する
    def test_inquir_new_post_creates_inquiry(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容（content_choice: 要望/不具合/問い合わせ の区分 / inquiry: 本文）
        data = {'content_choice': '要望', 'inquiry': 'テスト要望内容'}
        # 操作: 問い合わせ登録APIを呼ぶ（従業員番号・氏名はログイン者の情報が自動で入る）
        response = self.client.post('/api/inquir_new/', data, format='json')
        # 検証: 200 で、DBに登録されている
        self.assertEqual(response.status_code, 200)
        self.assertTrue(inquiry_data.objects.filter(inquiry='テスト要望内容').exists())

    # 【テスト】問い合わせ詳細と前後の問い合わせIDを取得できること
    #   前提: 問い合わせが1件存在する
    #   操作: GET /api/inquir_detail/<ID>/
    #   期待: 200 が返り、inquir_data・next_id（次のID）・before_id（前のID）が含まれる
    def test_inquir_detail_get(self):
        # 準備: 管理者ユーザーでログインし、管理者ユーザーを質問者とする問い合わせを作成
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='詳細テスト', answer=''
        )
        # 操作: 問い合わせ詳細APIを呼ぶ
        response = self.client.get(f'/api/inquir_detail/{inq.id}/')
        # 検証: 200 で、詳細と前後のID（該当なしなら None）のキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)
        self.assertIn('next_id', response.data)
        self.assertIn('before_id', response.data)

    # 【テスト】問い合わせ編集画面用のデータを取得できること
    #   前提: 管理者ユーザーが質問者の問い合わせが存在する
    #   操作: GET /api/inquir_update/<ID>/
    #   期待: 200 が返り、inquir_data が含まれる
    def test_inquir_update_get(self):
        # 準備: 管理者ユーザーでログインし、問い合わせを作成
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='不具合', inquiry='更新テスト', answer=''
        )
        # 操作: 問い合わせ編集画面用APIを呼ぶ
        response = self.client.get(f'/api/inquir_update/{inq.id}/')
        # 検証: 200 で、inquir_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)

    # 【テスト】問い合わせに回答を書き込めること
    #   前提: 回答が空の問い合わせが存在する
    #   操作: 回答「回答テスト」を含む全項目を PUT /api/inquir_update/<ID>/ で送る
    #   期待: 200 が返り、DBの回答が「回答テスト」になる
    def test_inquir_update_put(self):
        # 準備: 管理者ユーザーでログインし、回答が空の問い合わせを作成
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='元の問い合わせ', answer=''
        )
        # 準備: 更新内容（name は外部キーのため人員の主キーIDを送る）
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '要望', 'inquiry': '更新された問い合わせ', 'answer': '回答テスト'
        }
        # 操作: 問い合わせ編集APIを呼ぶ
        response = self.client.put(
            f'/api/inquir_update/{inq.id}/', data, format='json'
        )
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから読み直し、回答が書き込まれている
        inq.refresh_from_db()
        self.assertEqual(inq.answer, '回答テスト')

    # 【テスト】問い合わせを削除できること
    #   前提: 問い合わせが1件存在する
    #   操作: DELETE /api/inquir_update/<ID>/
    #   期待: 204（削除成功）が返り、DBから消えている
    def test_inquir_update_delete(self):
        # 準備: 管理者ユーザーでログインし、削除対象の問い合わせを作成
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='削除テスト', answer=''
        )
        # 操作: 問い合わせ削除API（編集APIの DELETE）を呼ぶ
        response = self.client.delete(f'/api/inquir_update/{inq.id}/')
        # 検証: 204 で、DBに存在しない
        self.assertEqual(response.status_code, 204)
        self.assertFalse(inquiry_data.objects.filter(id=inq.id).exists())


# ---------------------------------------------------------------------------
# 7. TestKosuViews: 工数（Business_Time_graph）の一覧・削除・集計APIのテスト
#   対象 : /api/kosu_list/, /api/kosu_delete/<ID>/, /api/kosu_total/（kosu_views.py）
#   内容 : ログイン者自身の工数データ一覧（日付絞り込み）・削除・集計画面用データ取得を確認する。
#   準備 : 管理者ユーザー 12345 の 2026-04-01 の工数データを1件作成する
# ---------------------------------------------------------------------------
class TestKosuViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 管理者ユーザーの 2026-04-01・1直・残業0 の工数データ（作業内容は未入力）
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    # 【テスト】未ログインで工数一覧APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/kosu_list/
    #   期待: 401（未ログイン）
    def test_kosu_list_without_login(self):
        # 操作: ログインせずに工数一覧APIを呼ぶ
        response = self.client.get('/api/kosu_list/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】ログイン者の工数一覧を取得できること
    #   前提: 管理者ユーザーでログイン済み・工数データ1件あり
    #   操作: GET /api/kosu_list/
    #   期待: 200 が返り、results（一覧）が含まれる
    def test_kosu_list_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数一覧APIを呼ぶ
        response = self.client.get('/api/kosu_list/')
        # 検証: 200 で、ページネーション形式の results がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    # 【テスト】就業日を指定して工数一覧を絞り込めること（日単位）
    #   前提: 2026-04-01 の工数データが1件ある
    #   操作: GET /api/kosu_list/?day=2026-04-01&filter=true（mode 省略時は日単位）
    #   期待: 200 が返り、結果は1件
    def test_kosu_list_with_date_filter(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 検索日を指定し、filter=true（絞り込み有効）で一覧を取得
        response = self.client.get(
            '/api/kosu_list/', {'day': '2026-04-01', 'filter': 'true'}
        )
        # 検証: 200 で、指定日の1件だけが返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    # 【テスト】自分の工数データを削除できること
    #   前提: 管理者ユーザーの工数データが1件ある
    #   操作: DELETE /api/kosu_delete/<ID>/
    #   期待: 204（削除成功）が返り、DBから消えている
    def test_kosu_delete(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数削除APIを呼ぶ
        response = self.client.delete(f'/api/kosu_delete/{self.kosu.id}/')
        # 検証: 204 で、DBに存在しない
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Business_Time_graph.objects.filter(id=self.kosu.id).exists()
        )

    # 【テスト】存在しないIDの工数データは削除できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: DELETE /api/kosu_delete/99999/
    #   期待: 404（見つからない）
    def test_kosu_delete_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで工数削除APIを呼ぶ
        response = self.client.delete('/api/kosu_delete/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】工数集計画面用のデータを取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/kosu_total/
    #   期待: 200 が返り、member_data（ログイン者）・kosu_data（工数）・def_data（工数区分定義）が含まれる
    def test_kosu_total_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数集計APIを呼ぶ（セッションに就業日が無ければ今日の日付で集計する）
        response = self.client.get('/api/kosu_total/')
        # 検証: 200 で、3種類のデータのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)


# ---------------------------------------------------------------------------
# 8. TestTeamViews: 班員APIのテスト（基本）
#   対象 : /api/team_new/, /api/team_list/, /api/team_detail/<ID>/（team_views.py。権限ありのみ）
#   内容 : 班員の登録画面・登録、班員の工数一覧、班員の工数詳細の取得を確認する。
#   準備 : 管理者ユーザー 12345 の班に一般ユーザー 99999 を登録し、99999 の工数データを1件作成する
# ---------------------------------------------------------------------------
class TestTeamViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、班員データと班員の工数データを作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 班員データ: 班長（ログイン者）12345 の班のメンバー1 に 99999 を登録
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999'
        )
        # 班員 99999 の 2026-04-01 の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    # 【テスト】班員登録画面用のデータを取得できること
    #   前提: 管理者ユーザー（権限あり）でログイン済み
    #   操作: GET /api/team_new/
    #   期待: 200 が返り、member_data（ログイン者）と team_data（班員データ）が含まれる
    def test_team_new_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員登録画面用APIを呼ぶ
        response = self.client.get('/api/team_new/')
        # 検証: 200 で、ログイン者と班員データのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('team_data', response.data)

    # 【テスト】班員を登録（更新）できること
    #   前提: 管理者ユーザーの班員データが存在する
    #   操作: メンバー1=99999・メンバー2=空・フォローON を POST /api/team_new/ で送る
    #   期待: 200
    def test_team_new_post(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容（member1〜15: 班員の従業員番号 / follow: 工数未入力のフォロー表示ON/OFF）
        data = {'member1': '99999', 'member2': '', 'follow': True}
        # 操作: 班員登録APIを呼ぶ（送られた項目だけを上書きする）
        response = self.client.post('/api/team_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員の工数一覧を取得できること
    #   前提: 班員 99999 の工数データが1件ある
    #   操作: GET /api/team_list/
    #   期待: 200 が返り、pagination_data（工数一覧）と team_member_select（班員の選択肢）が含まれる
    def test_team_list_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員工数一覧APIを呼ぶ
        response = self.client.get('/api/team_list/')
        # 検証: 200 で、一覧と班員選択肢のキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('pagination_data', response.data)
        self.assertIn('team_member_select', response.data)

    # 【テスト】未ログインで班員工数一覧APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/team_list/
    #   期待: 401（未ログイン）
    def test_team_list_without_login(self):
        # 操作: ログインせずに班員工数一覧APIを呼ぶ
        response = self.client.get('/api/team_list/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】班員の工数データ1件の詳細を取得できること
    #   前提: 班員 99999 の工数データが存在する
    #   操作: GET /api/team_detail/<工数データのID>/
    #   期待: 200 が返り、kosu_data・def_data・member_data（工数の持ち主）が含まれる
    def test_team_detail_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員工数詳細APIを呼ぶ
        response = self.client.get(f'/api/team_detail/{self.kosu.id}/')
        # 検証: 200 で、工数・工数区分定義・人員のキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('member_data', response.data)


# ---------------------------------------------------------------------------
# 9. TestAdministratorViews: 管理者画面用APIのテスト
#   対象 : /api/manager_update/, /api/manager_kosu/, /api/manager_task/,
#          /api/manager_task_detail/<ID>/, /api/manager_history/,
#          /api/manager_history_detail/<ID>/（main_views.py。すべて管理者権限が必要）
#   内容 : 管理者設定の取得・更新、全員分の工数一覧、非同期タスク記録・操作履歴の
#          一覧・詳細・削除を確認する。
# ---------------------------------------------------------------------------
class TestAdministratorViews(BaseTestCase):
    # 【テスト】管理者は管理者設定を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/manager_update/
    #   期待: 200 が返り、admin_data（管理者設定）が含まれる
    def test_administrator_update_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者設定の取得APIを呼ぶ
        response = self.client.get('/api/manager_update/')
        # 検証: 200 で、admin_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('admin_data', response.data)

    # 【テスト】管理者権限なしのユーザーは管理者設定を取得できないこと
    #   前提: 一般ユーザーでログイン済み
    #   操作: GET /api/manager_update/
    #   期待: 403（権限なし）
    def test_administrator_update_get_non_admin(self):
        # 準備: 一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 管理者設定の取得APIを呼ぶ
        response = self.client.get('/api/manager_update/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】管理者設定を更新できること
    #   前提: 管理者設定（一覧表示項目数 20）が存在する
    #   操作: 一覧表示項目数 30・問い合わせ担当者1 に 12345 を PUT /api/manager_update/ で送る
    #   期待: 200 が返り、DBの一覧表示項目数が "30" になる
    def test_administrator_update_put(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 更新内容（問い合わせ担当者1〜3 は存在する従業員番号か空欄である必要がある）
        data = {
            'menu_row': '30',
            'administrator_employee_no1': '12345',
            'administrator_employee_no2': '',
            'administrator_employee_no3': '',
        }
        # 操作: 管理者設定の更新APIを呼ぶ
        response = self.client.put('/api/manager_update/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから読み直し、一覧表示項目数が更新されている
        self.admin_settings.refresh_from_db()
        self.assertEqual(self.admin_settings.menu_row, '30')

    # 【テスト】存在しない従業員番号を問い合わせ担当者に設定できないこと
    #   前提: 従業員番号 1 の人員は存在しない
    #   操作: 問い合わせ担当者1 に "00001" を指定して更新APIを呼ぶ
    #   期待: 406（「ユーザーが存在しません」エラー。このAPIは 400 ではなく 406 を返す）
    def test_administrator_update_put_invalid_employee(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 存在しない従業員番号を含む更新内容
        data = {
            'menu_row': '20',
            'administrator_employee_no1': '00001',
        }
        # 操作: 管理者設定の更新APIを呼ぶ
        response = self.client.put('/api/manager_update/', data, format='json')
        # 検証: 406（Not Acceptable）
        self.assertEqual(response.status_code, 406)

    # 【テスト】管理者は全員分の工数一覧を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/manager_kosu/
    #   期待: 200
    def test_administrator_kosu_list_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者用の工数一覧APIを呼ぶ
        response = self.client.get('/api/manager_kosu/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者権限なしのユーザーは全員分の工数一覧を取得できないこと
    #   前提: 一般ユーザーでログイン済み
    #   操作: GET /api/manager_kosu/
    #   期待: 403（権限なし）
    def test_administrator_kosu_list_non_admin(self):
        # 準備: 一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 管理者用の工数一覧APIを呼ぶ
        response = self.client.get('/api/manager_kosu/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】非同期タスク記録の一覧を取得できること
    #   前提: タスク記録が1件存在する
    #   操作: GET /api/manager_task/
    #   期待: 200 が返り、task_data（ページネーション済みの一覧）が含まれる
    def test_administrator_task_list_get(self):
        # 準備: 管理者ユーザーでログインし、タスク記録を1件作成
        self.login_as_admin()
        AsyncTask.objects.create(task_id='t1', status='success')
        # 操作: タスク履歴一覧APIを呼ぶ
        response = self.client.get('/api/manager_task/')
        # 検証: 200 で、task_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('task_data', response.data)

    # 【テスト】非同期タスク記録1件の詳細を取得できること
    #   前提: タスク記録が1件存在する
    #   操作: GET /api/manager_task_detail/<ID>/
    #   期待: 200 が返り、task_data が含まれる
    def test_administrator_task_detail_get(self):
        # 準備: 管理者ユーザーでログインし、タスク記録を1件作成
        self.login_as_admin()
        task = AsyncTask.objects.create(task_id='t2', status='pending')
        # 操作: タスク履歴詳細APIを呼ぶ
        response = self.client.get(f'/api/manager_task_detail/{task.id}/')
        # 検証: 200 で、task_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('task_data', response.data)

    # 【テスト】非同期タスク記録を削除できること
    #   前提: タスク記録が1件存在する
    #   操作: DELETE /api/manager_task_detail/<ID>/
    #   期待: 200（このAPIは削除成功時に 204 ではなく 200 を返す）、DBから消えている
    def test_administrator_task_detail_delete(self):
        # 準備: 管理者ユーザーでログインし、削除対象のタスク記録を作成
        self.login_as_admin()
        task = AsyncTask.objects.create(task_id='t3', status='error')
        # 操作: タスク履歴の削除APIを呼ぶ
        response = self.client.delete(f'/api/manager_task_detail/{task.id}/')
        # 検証: 200 で、DBに存在しない
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AsyncTask.objects.filter(id=task.id).exists())

    # 【テスト】操作履歴の一覧を取得できること
    #   前提: 操作履歴が1件以上存在する
    #   操作: GET /api/manager_history/
    #   期待: 200 が返り、history_data（一覧）と model_choices（絞り込み用のテーブル名一覧）が含まれる
    def test_administrator_history_list_get(self):
        # 準備: 管理者ユーザーでログインし、操作履歴を1件作成
        #   （人員作成時などにも signals.py が自動で操作履歴を記録するため、実際は複数件ある）
        self.login_as_admin()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={}
        )
        # 操作: 操作履歴一覧APIを呼ぶ
        response = self.client.get('/api/manager_history/')
        # 検証: 200 で、一覧とテーブル名一覧のキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('history_data', response.data)
        self.assertIn('model_choices', response.data)

    # 【テスト】操作履歴1件の詳細を取得できること
    #   前提: 操作履歴が存在する
    #   操作: GET /api/manager_history_detail/<ID>/
    #   期待: 200 が返り、history_data が含まれる
    def test_administrator_history_detail_get(self):
        # 準備: 管理者ユーザーでログインし、UPDATE の操作履歴を1件作成
        self.login_as_admin()
        h = History.objects.create(
            operation='UPDATE', table_name='member',
            record_id=1, changes={'name': ['old', 'new']}
        )
        # 操作: 操作履歴詳細APIを呼ぶ
        response = self.client.get(f'/api/manager_history_detail/{h.id}/')
        # 検証: 200 で、history_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('history_data', response.data)

    # 【テスト】操作履歴を削除できること
    #   前提: 操作履歴が存在する
    #   操作: DELETE /api/manager_history_detail/<ID>/
    #   期待: 200（削除成功時も 200）、DBから消えている
    def test_administrator_history_detail_delete(self):
        # 準備: 管理者ユーザーでログインし、削除対象の操作履歴を作成
        self.login_as_admin()
        h = History.objects.create(
            operation='DELETE', table_name='member',
            record_id=1, changes={}
        )
        # 操作: 操作履歴の削除APIを呼ぶ
        response = self.client.delete(f'/api/manager_history_detail/{h.id}/')
        # 検証: 200 で、DBに存在しない
        self.assertEqual(response.status_code, 200)
        self.assertFalse(History.objects.filter(id=h.id).exists())


# ---------------------------------------------------------------------------
# 10. TestSerializers: シリアライザ（モデル ⇔ JSON 変換の部品）のテスト
#   対象 : views/serializers.py（全シリアライザとも fields='__all__' で全項目を出力する）
#   内容 : モデルのデータを渡したとき、APIで返す辞書に必要な項目と正しい値が入るかを確認する。
#          APIは呼ばず、シリアライザを直接使う。
# ---------------------------------------------------------------------------
class TestSerializers(BaseTestCase):
    # 【テスト】人員シリアライザが従業員番号・氏名・休憩時間・ショップを出力すること
    #   前提: 管理者ユーザー 12345「テスト太郎」が存在する
    #   操作: MemberSerializer に人員データを渡して .data を取り出す
    #   期待: employee_no=12345・name="テスト太郎"、break_time1 と shop の項目がある
    def test_member_serializer(self):
        # 操作: 人員データを変換し、辞書（.data）を取り出す
        serializer = MemberSerializer(self.member)
        data = serializer.data
        # 検証: 値と項目の存在を確認
        self.assertEqual(data['employee_no'], 12345)
        self.assertEqual(data['name'], 'テスト太郎')
        self.assertIn('break_time1', data)
        self.assertIn('shop', data)

    # 【テスト】工数シリアライザが就業日を "YYYY-MM-DD" 形式の文字列で出力すること
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: KosuSerializer に工数データを渡して .data を取り出す
    #   期待: employee_no3=12345・work_day2="2026-04-01"、time_work（作業内容）の項目がある
    def test_kosu_serializer(self):
        # 準備: 変換対象の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        # 操作: 工数データを変換
        serializer = KosuSerializer(kosu)
        data = serializer.data
        # 検証: 日付は date 型ではなく文字列で出力される
        self.assertEqual(data['employee_no3'], 12345)
        self.assertEqual(data['work_day2'], '2026-04-01')
        self.assertIn('time_work', data)

    # 【テスト】工数区分定義シリアライザが定義Ver名・工数区分名・定義の項目を出力すること
    #   前提: 工数区分定義「TestVer」（工数区分1=作業A）が存在する
    #   操作: DefSerializer に工数区分定義を渡して .data を取り出す
    #   期待: kosu_name="TestVer"・kosu_title_1="作業A"、kosu_division_1_1（定義1）の項目がある
    def test_def_serializer(self):
        # 操作: 工数区分定義を変換
        serializer = DefSerializer(self.division)
        data = serializer.data
        # 検証: 値と項目の存在を確認
        self.assertEqual(data['kosu_name'], 'TestVer')
        self.assertEqual(data['kosu_title_1'], '作業A')
        self.assertIn('kosu_division_1_1', data)

    # 【テスト】作業詳細選択肢シリアライザが定義記号と作業詳細を出力すること
    #   前提: 定義記号「A」・作業詳細「テスト」の選択肢が存在する
    #   操作: DefChoiceSerializer に選択肢を渡して .data を取り出す
    #   期待: def_symbol="A"・def_select="テスト"
    def test_def_choice_serializer(self):
        # 準備: 変換対象の選択肢を作成
        choice = def_choice.objects.create(def_symbol='A', def_select='テスト')
        # 操作: 選択肢を変換
        serializer = DefChoiceSerializer(choice)
        data = serializer.data
        # 検証: 値を確認
        self.assertEqual(data['def_symbol'], 'A')
        self.assertEqual(data['def_select'], 'テスト')

    # 【テスト】問い合わせシリアライザが従業員番号・内容区分・本文を出力すること
    #   前提: 管理者ユーザーの問い合わせが存在する
    #   操作: InquirSerializer に問い合わせを渡して .data を取り出す
    #   期待: employee_no2=12345、content_choice と inquiry の項目がある
    def test_inquir_serializer(self):
        # 準備: 変換対象の問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='テスト', answer=''
        )
        # 操作: 問い合わせを変換
        serializer = InquirSerializer(inq)
        data = serializer.data
        # 検証: 値と項目の存在を確認
        self.assertEqual(data['employee_no2'], 12345)
        self.assertIn('content_choice', data)
        self.assertIn('inquiry', data)

    # 【テスト】管理者設定シリアライザが一覧表示項目数を出力すること
    #   前提: 管理者設定（menu_row="20"）が存在する
    #   操作: AdministratorSerializer に管理者設定を渡して .data を取り出す
    #   期待: menu_row="20"（文字列項目のため文字列で出力される）
    def test_administrator_serializer(self):
        # 操作: 管理者設定を変換
        serializer = AdministratorSerializer(self.admin_settings)
        data = serializer.data
        # 検証: 値を確認
        self.assertEqual(data['menu_row'], '20')

    # 【テスト】非同期タスクシリアライザがタスクIDと状態を出力すること
    #   前提: タスクID「ser-t1」・状態 success のタスク記録が存在する
    #   操作: TaskSerializer にタスク記録を渡して .data を取り出す
    #   期待: task_id="ser-t1"・status="success"
    def test_task_serializer(self):
        # 準備: 変換対象のタスク記録を作成
        task = AsyncTask.objects.create(task_id='ser-t1', status='success')
        # 操作: タスク記録を変換
        serializer = TaskSerializer(task)
        data = serializer.data
        # 検証: 値を確認
        self.assertEqual(data['task_id'], 'ser-t1')
        self.assertEqual(data['status'], 'success')

    # 【テスト】操作履歴シリアライザが操作種類と変更内容を出力すること
    #   前提: CREATE の操作履歴が存在する
    #   操作: HistorySerializer に操作履歴を渡して .data を取り出す
    #   期待: operation="CREATE"、changes（変更内容）の項目がある
    def test_history_serializer(self):
        # 準備: 変換対象の操作履歴を作成
        h = History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={'x': 'y'}
        )
        # 操作: 操作履歴を変換
        serializer = HistorySerializer(h)
        data = serializer.data
        # 検証: 値と項目の存在を確認
        self.assertEqual(data['operation'], 'CREATE')
        self.assertIn('changes', data)


# ---------------------------------------------------------------------------
# 11. TestUtils: 共通ユーティリティ関数のテスト
#   対象 : utils/main_utils.py
#            get_all_model_names_in_myapp: kosu アプリの全モデル名の一覧取得
#   内容 : 関数を直接呼び出し、戻り値を確認する。
# ---------------------------------------------------------------------------
class TestUtils(BaseTestCase):
    # 【テスト】kosu アプリのモデル名一覧に主要なモデルが含まれること
    #   前提: なし
    #   操作: get_all_model_names_in_myapp()
    #   期待: member / Business_Time_graph / kosu_division / AsyncTask / History が含まれる
    def test_get_all_model_names(self):
        # 操作: モデル名の一覧（文字列のリスト）を取得
        names = get_all_model_names_in_myapp()
        # 検証: 主要なモデル名が含まれる
        self.assertIn('member', names)
        self.assertIn('Business_Time_graph', names)
        self.assertIn('kosu_division', names)
        self.assertIn('AsyncTask', names)
        self.assertIn('History', names)


# ---------------------------------------------------------------------------
# 12. TestKosuUtils: 工数計算用ユーティリティ関数のテスト
#   対象 : utils/kosu_utils.py（工数入力・休憩・OK/NG判定の計算の中心部分）
#   内容 : 関数を直接呼び出し、時刻 ⇔ インデックス変換、休憩時間の処理、
#          工数入力OK/NG判定（judgement_check）、直に合わせた並び替えなどを確認する。
#   前提知識（作業内容 time_work の仕組み）:
#     1日（24時間）を5分ごとに区切った 288 マスの文字列（リスト）で表す。
#       インデックス = 時 × 12 + 分 ÷ 5   （例: 10:40 → 10×12 + 40÷5 = 128）
#     各マスの文字: 工数区分の記号（'A','B',…） / '#' = 未入力（空き） / '$' = 休憩
#     作業時間（分）= 1440 − ('#' の数 × 5) − ('$' の数 × 5)
#   準備 : BaseTestCase を使わず、ショップ P と W1 の人員・工数区分定義「UtilVer」を作成する
# ---------------------------------------------------------------------------
class TestKosuUtils(TestCase):
    # 各テストの前に: ショップ別の判定を確認するための人員2名と、工数区分定義を作成する
    def setUp(self):
        # 標準ショップ（P）の人員 11111。休憩時間は make_break_times の標準パターン
        bt = make_break_times()
        self.member_p = member.objects.create(
            employee_no=11111, name='UtilTest', shop='P',
            authority=False, administrator=False, **bt
        )
        # 組立系ショップ（W1）の人員 22222。休憩時間は人員登録APIが W1 に設定する組立系の初期値と同じ値
        self.member_w = member.objects.create(
            employee_no=22222, name='UtilTestW', shop='W1',
            authority=False, administrator=False,
            break_time1='#11401240', break_time1_over1='#17201735',
            break_time1_over2='#23350035', break_time1_over3='#04350450',
            break_time2='#14101510', break_time2_over1='#22002215',
            break_time2_over2='#04150515', break_time2_over3='#09150930',
            break_time3='#23500050', break_time3_over1='#06400655',
            break_time3_over2='#12551355', break_time3_over3='#17551810',
            break_time4='#12001300', break_time4_over1='#19001915',
            break_time4_over2='#01150215', break_time4_over3='#06150630',
            break_time5='#10401130', break_time5_over1='#15101520',
            break_time5_over2='#20202110', break_time5_over3='#01400150',
            break_time6='#21202210', break_time6_over1='#01500200',
            break_time6_over2='#07000750', break_time6_over3='#12201230',
        )
        # 工数区分定義「UtilVer」: 工数区分は2つ（記号 A=TaskA, B=TaskB）
        self.division = kosu_division.objects.create(
            kosu_name='UtilVer', kosu_title_1='TaskA',
            kosu_division_1_1='A', kosu_division_2_1='A',
            kosu_title_2='TaskB', kosu_division_1_2='B', kosu_division_2_2='B',
        )

    # 【テスト】"HH:MM" 形式の時刻を時と分に分けられること
    #   前提: なし
    #   操作: time_index('08:30')
    #   期待: ('08', '30')（数値ではなく文字列のまま返る）
    def test_time_index_basic(self):
        # 操作: 時刻文字列を ':' の位置で分割する
        h, m = time_index('08:30')
        # 検証: 時と分が文字列で返る
        self.assertEqual(h, '08')
        self.assertEqual(m, '30')

    # 【テスト】0時0分（"00:00"）も正しく分けられること
    #   前提: なし
    #   操作: time_index('00:00')
    #   期待: ('00', '00')
    def test_time_index_midnight(self):
        # 操作: 境界値（1日の始まり）の時刻を分割する
        h, m = time_index('00:00')
        # 検証: 時と分が "00" で返る
        self.assertEqual(h, '00')
        self.assertEqual(m, '00')

    # 【テスト】休憩時間文字列から開始・終了のインデックスを計算できること（日またぎなし）
    #   前提: なし
    #   操作: break_time_process('#10401130')（10:40〜11:30）
    #   期待: 開始 128.0・終了 138.0・日またぎフラグ 0
    def test_break_time_process_normal(self):
        # 計算: "#HHMMHHMM" の開始 10:40 → 10×12 + 40÷5 = 128、終了 11:30 → 11×12 + 30÷5 = 138
        #       （÷ の結果が小数型になるため 128.0 のように float で返る）
        # 操作: 休憩時間文字列を変換
        start, end, next_day = break_time_process('#10401130')
        # 検証: 開始 < 終了 なので日またぎなし（0）
        self.assertEqual(start, 128.0)
        self.assertEqual(end, 138.0)
        self.assertEqual(next_day, 0)

    # 【テスト】終了時刻が開始時刻より早い休憩は「日またぎ」と判定されること
    #   前提: なし
    #   操作: break_time_process('#23350035')（23:35〜翌0:35）
    #   期待: 日またぎフラグが 1
    def test_break_time_process_next_day(self):
        # 計算: 開始 23:35 → 23×12 + 35÷5 = 283、終了 0:35 → 0×12 + 35÷5 = 7
        #       開始(283) > 終了(7) のため、日付をまたぐ休憩と判定される
        # 操作: 日をまたぐ休憩時間文字列を変換
        start, end, next_day = break_time_process('#23350035')
        # 検証: 日またぎフラグが 1
        self.assertEqual(next_day, 1)

    # 【テスト】指定した範囲のマスに工数区分の記号と作業詳細を書き込めること
    #   前提: 288マスすべて未入力
    #   操作: kosu_write(10, 15, …) で記号 'A'・作業詳細 'detail1' を書き込む
    #   期待: インデックス 10〜14 が 'A'、15 は '#' のまま（終了インデックスは含まない）
    def test_kosu_write(self):
        # 準備: 未入力の作業内容リスト・作業詳細リストと、画面から送られる入力内容（time_work: 記号）
        work_list = ['#'] * 288
        detail_list = [''] * 288
        post_data = {'time_work': 'A', 'detail_work': 'detail1'}
        # 操作: インデックス 10 以上 15 未満（0:50〜1:15）に書き込む
        work_list, detail_list = kosu_write(10, 15, work_list, detail_list, post_data)
        # 検証: 範囲の先頭と末尾は 'A'、範囲外（15）は未入力のまま、作業詳細も書き込まれている
        self.assertEqual(work_list[10], 'A')
        self.assertEqual(work_list[14], 'A')
        self.assertEqual(work_list[15], '#')
        self.assertEqual(detail_list[10], 'detail1')

    # 【テスト】休憩エラーチェックOFFの人は、休憩時間帯の工数が消去（未入力に）されること
    #   前提: 288マスすべて 'A'（作業あり）、人員の break_check（休憩エラー有効チェック）が False
    #   操作: break_time_delete(10, 20, …)
    #   期待: エラーなし（None）、インデックス 10〜19 が '#'・作業詳細が空になる
    def test_break_time_delete_no_break_check(self):
        # 準備: 全マス作業ありのリストを用意し、休憩エラーチェックを OFF にする（DBには保存しない）
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        self.member_p.break_check = False
        # 操作: インデックス 10〜19 を休憩時間として処理
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        # 検証: エラーメッセージなし
        self.assertIsNone(err)
        # 検証: 休憩時間帯のマスがすべて未入力・作業詳細なしになっている
        for i in range(10, 20):
            self.assertEqual(wl[i], '#')
            self.assertEqual(dl[i], '')

    # 【テスト】休憩エラーチェックONの人が休憩時間帯に工数を入れているとエラーになること
    #   前提: 288マスすべて 'A'、人員の break_check が True
    #   操作: break_time_delete(10, 20, …)
    #   期待: エラーメッセージ「休憩時間に工数を入力できません…」が返る
    def test_break_time_delete_with_break_check_error(self):
        # 準備: 全マス作業ありのリストを用意し、休憩エラーチェックを ON にする
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        self.member_p.break_check = True
        # 操作: インデックス 10〜19 を休憩時間として処理
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        # 検証: 休憩時間帯に作業（'#' でも '$' でもないマス）があるためエラーが返る
        self.assertIsNotNone(err)
        self.assertIn('休憩時間に工数を入力できません', err)

    # 【テスト】休憩エラーチェックONでも、休憩時間帯が未入力ならエラーにならないこと
    #   前提: 288マスすべて '#'（未入力）、人員の break_check が True
    #   操作: break_time_delete(10, 20, …)
    #   期待: エラーなし（None）
    def test_break_time_delete_with_break_check_empty(self):
        # 準備: 全マス未入力のリストを用意し、休憩エラーチェックを ON にする
        work_list = ['#'] * 288
        detail_list = [''] * 288
        self.member_p.break_check = True
        # 操作: インデックス 10〜19 を休憩時間として処理
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        # 検証: エラーメッセージなし
        self.assertIsNone(err)

    # 【テスト】指定した範囲のマスを休憩（'$'）に書き換えられること
    #   前提: 288マスすべて 'A'
    #   操作: break_time_write(5, 10, …)
    #   期待: インデックス 5〜9 が '$'・作業詳細が空になる
    def test_break_time_write(self):
        # 準備: 全マス作業ありのリスト
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        # 操作: インデックス 5 以上 10 未満を休憩にする
        wl, dl = break_time_write(5, 10, work_list, detail_list)
        # 検証: 範囲内のマスが休憩記号 '$'・作業詳細なしになっている
        for i in range(5, 10):
            self.assertEqual(wl[i], '$')
            self.assertEqual(dl[i], '')

    # 【テスト】作業詳細リストを '$' 区切りの1つの文字列にまとめられること
    #   前提: なし
    #   操作: detail_list_summarize(['a', 'b', 'c'])
    #   期待: 'a$b$c'（DB の detail_work 項目にはこの形式で保存される）
    def test_detail_list_summarize(self):
        # 準備: 3要素の作業詳細リスト
        dl = ['a', 'b', 'c']
        # 操作: 文字列にまとめる
        result = detail_list_summarize(dl)
        # 検証: 要素の間にだけ '$' が入る（末尾には付かない）
        self.assertEqual(result, 'a$b$c')

    # 【テスト】要素が1つだけなら区切り文字 '$' が付かないこと
    #   前提: なし
    #   操作: detail_list_summarize(['a'])
    #   期待: 'a'
    def test_detail_list_summarize_single(self):
        # 準備: 1要素の作業詳細リスト
        dl = ['a']
        # 操作: 文字列にまとめる
        result = detail_list_summarize(dl)
        # 検証: 区切り文字なしでそのまま返る
        self.assertEqual(result, 'a')

    # 【テスト】就業形態「休日」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力（作業時間 0分）
    #   操作: judgement_check(作業内容, '休日', 直='1', ショップPの人員, 残業=0)
    #   期待: True（OK）
    def test_judgement_check_work_holiday(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 休み系の就業形態で判定する
        result = judgement_check(work_list, '休日', '1', self.member_p, 0)
        # 検証: 休み系（休日/シフト休/年休/代休/公休/欠勤）は作業0分・残業0分で OK
        self.assertTrue(result)

    # 【テスト】就業形態「年休」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力
    #   操作: judgement_check(作業内容, '年休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_work_nenkyuu(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 年休で判定する
        result = judgement_check(work_list, '年休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「シフト休」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力
    #   操作: judgement_check(作業内容, 'シフト休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shift_yasumi(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: シフト休で判定する
        result = judgement_check(work_list, 'シフト休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「代休」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力
    #   操作: judgement_check(作業内容, '代休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_daikyuu(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 代休で判定する
        result = judgement_check(work_list, '代休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「公休」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力
    #   操作: judgement_check(作業内容, '公休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_koukyuu(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 公休で判定する
        result = judgement_check(work_list, '公休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「欠勤」で作業時間0・残業0なら工数入力OKになること
    #   前提: 288マスすべて未入力
    #   操作: judgement_check(作業内容, '欠勤', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_kekkin(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 欠勤で判定する
        result = judgement_check(work_list, '欠勤', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「出勤」で作業時間が 470分（残業0）なら工数入力OKになること
    #   前提: 先頭94マスだけ作業 'A'、残りは未入力
    #   操作: judgement_check(作業内容, '出勤', '1', ショップPの人員, 残業=0)
    #   期待: True（OK）
    def test_judgement_check_shukkin_correct(self):
        # 判定式: 出勤は「作業時間 − 残業時間 = 470分（7時間50分）」で OK
        #   作業時間 = 1440 − ('#' の数 × 5) − ('$' の数 × 5)
        #   470分 ÷ 5分 = 94マスに作業を入れ、残り194マスは '#'（1440 − 194×5 = 470）
        # 準備: 全マス未入力のリストを作り、先頭94マス（0:00〜7:50）に作業 'A' を入れる
        work_list = ['#'] * 288
        for i in range(94):
            work_list[i] = 'A'
        # 操作: 出勤・残業0分で判定する
        result = judgement_check(work_list, '出勤', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】就業形態「出勤」で作業時間が足りない（0分）と工数入力NGになること
    #   前提: 288マスすべて未入力（作業時間 0分）
    #   操作: judgement_check(作業内容, '出勤', '1', ショップPの人員, 0)
    #   期待: False（NG）
    def test_judgement_check_shukkin_incorrect(self):
        # 準備: 作業が1つも入っていない作業内容
        work_list = ['#'] * 288
        # 操作: 出勤で判定する
        result = judgement_check(work_list, '出勤', '1', self.member_p, 0)
        # 検証: 0分 ≠ 470分 のため NG
        self.assertFalse(result)

    # 【テスト】就業形態「休出」で作業時間と残業時間が一致（0以外）すれば工数入力OKになること
    #   前提: 先頭20マス（100分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '休出', '1', ショップPの人員, 残業=100)
    #   期待: True（OK）
    def test_judgement_check_kyushutsu(self):
        # 判定式: 休出は「作業時間 = 残業時間」かつ「残業時間 ≠ 0」で OK
        #         （作業した時間をすべて残業時間として入力しているかを見る）
        # 準備: 先頭20マス（20 × 5分 = 100分）に作業を入れる
        work_list = ['#'] * 288
        for i in range(20):
            work_list[i] = 'A'
        # 操作: 休出・残業100分で判定する
        result = judgement_check(work_list, '休出', '1', self.member_p, 100)
        # 検証: 作業100分 = 残業100分 のため OK
        self.assertTrue(result)

    # 【テスト】就業形態「早退・遅刻」は作業時間が0分でなければ工数入力OKになること
    #   前提: 先頭1マス（5分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '早退・遅刻', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_soutai(self):
        # 判定式: 早退・遅刻は「作業時間 ≠ 0」だけで OK（決まった時間との一致は確認しない）
        # 準備: 先頭1マス（5分）にだけ作業を入れる
        work_list = ['#'] * 288
        work_list[0] = 'A'
        # 操作: 早退・遅刻で判定する
        result = judgement_check(work_list, '早退・遅刻', '1', self.member_p, 0)
        # 検証: 作業時間が 5分（0ではない）ため OK
        self.assertTrue(result)

    # 【テスト】就業形態「シフト出」も出勤と同じく作業時間 470分で工数入力OKになること
    #   前提: 先頭94マス（470分）だけ作業 'A'
    #   操作: judgement_check(作業内容, 'シフト出', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shift_shukkin(self):
        # 準備: 先頭94マス（94 × 5分 = 470分）に作業を入れる
        work_list = ['#'] * 288
        for i in range(94):
            work_list[i] = 'A'
        # 操作: シフト出・残業0分で判定する
        result = judgement_check(work_list, 'シフト出', '1', self.member_p, 0)
        # 検証: 470分 のため OK
        self.assertTrue(result)

    # 【テスト】常昼（直=4）の「半前年休」は作業時間 230分で工数入力OKになること
    #   前提: 先頭46マス（230分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '4', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_hanzen_tyoku4(self):
        # 判定式: 常昼の半前年休は「作業時間 − 残業 = 230分」で OK（46マス × 5分 = 230分）
        # 準備: 先頭46マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        # 操作: 常昼・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '4', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】常昼（直=4）の「半後年休」は作業時間 240分で工数入力OKになること
    #   前提: 先頭48マス（240分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '4', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_hango_tyoku4(self):
        # 判定式: 常昼の半後年休は「作業時間 − 残業 = 240分」で OK（48マス × 5分 = 240分）
        # 準備: 先頭48マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        # 操作: 常昼・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '4', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】連1直（直=5）の「半前年休」は作業時間 220分で工数入力OKになること
    #   前提: 先頭44マス（220分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '5', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_hanzen_tyoku5(self):
        # 判定式: 直が 5（連1直）または 6（連2直）の半前年休は「作業時間 − 残業 = 220分」で OK
        #         （44マス × 5分 = 220分）
        # 準備: 先頭44マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(44):
            work_list[i] = 'A'
        # 操作: 連1直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '5', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】連2直（直=6）の「半後年休」は作業時間 250分で工数入力OKになること
    #   前提: 先頭50マス（250分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '6', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_hango_tyoku6(self):
        # 判定式: 直が 5（連1直）または 6（連2直）の半後年休は「作業時間 − 残業 = 250分」で OK
        #         （50マス × 5分 = 250分）
        # 準備: 先頭50マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(50):
            work_list[i] = 'A'
        # 操作: 連2直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '6', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・1直の「半前年休」は作業時間 230分で工数入力OKになること
    #   前提: 先頭46マス（230分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '1', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku1_hanzen(self):
        # 判定式: 組立系ショップ（W1/W2/A1/A2/J/組長以上(W,A)）・1直の半前年休は 230分で OK（46マス）
        # 準備: 先頭46マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        # 操作: W1・1直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '1', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・2直の「半前年休」は作業時間 290分で工数入力OKになること
    #   前提: 先頭58マス（290分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '2', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku2_hanzen(self):
        # 判定式: 組立系ショップ・2直の半前年休は 290分で OK（58マス × 5分 = 290分）
        # 準備: 先頭58マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(58):
            work_list[i] = 'A'
        # 操作: W1・2直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '2', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・3直の「半前年休」は作業時間 230分で工数入力OKになること
    #   前提: 先頭46マス（230分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '3', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku3_hanzen(self):
        # 判定式: 組立系ショップ・3直の半前年休は 230分で OK（46マス × 5分 = 230分）
        # 準備: 先頭46マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        # 操作: W1・3直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '3', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・1直の「半前年休」は作業時間 220分で工数入力OKになること
    #   前提: 先頭44マス（220分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku1_hanzen(self):
        # 判定式: 標準ショップ（P/R/T1/T2/その他/組長以上(P,R,T,その他)）・1直の半前年休は 220分で OK（44マス）
        # 準備: 先頭44マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(44):
            work_list[i] = 'A'
        # 操作: P・1直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・2直の「半前年休」は作業時間 230分で工数入力OKになること
    #   前提: 先頭46マス（230分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '2', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku2_hanzen(self):
        # 判定式: 標準ショップ・2直の半前年休は 230分で OK（46マス × 5分 = 230分）
        # 準備: 先頭46マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        # 操作: P・2直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '2', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・3直の「半前年休」は作業時間 275分で工数入力OKになること
    #   前提: 先頭55マス（275分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半前年休', '3', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku3_hanzen(self):
        # 判定式: 標準ショップ・3直の半前年休は 275分で OK（55マス × 5分 = 275分）
        # 準備: 先頭55マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(55):
            work_list[i] = 'A'
        # 操作: P・3直・半前年休で判定する
        result = judgement_check(work_list, '半前年休', '3', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・2直の「半後年休」は作業時間 240分で工数入力OKになること
    #   前提: 先頭48マス（240分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '2', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku2_hango(self):
        # 判定式: 標準ショップ・2直の半後年休は 240分で OK（48マス × 5分 = 240分）
        # 準備: 先頭48マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        # 操作: P・2直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '2', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・3直の「半後年休」は作業時間 195分で工数入力OKになること
    #   前提: 先頭39マス（195分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '3', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku3_hango(self):
        # 判定式: 標準ショップ・3直の半後年休は 195分で OK（39マス × 5分 = 195分）
        # 準備: 先頭39マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(39):
            work_list[i] = 'A'
        # 操作: P・3直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '3', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・2直の「半後年休」は作業時間 180分で工数入力OKになること
    #   前提: 先頭36マス（180分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '2', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku2_hango(self):
        # 判定式: 組立系ショップ・2直の半後年休は 180分で OK（36マス × 5分 = 180分）
        # 準備: 先頭36マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(36):
            work_list[i] = 'A'
        # 操作: W1・2直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '2', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・3直の「半後年休」は作業時間 240分で工数入力OKになること
    #   前提: 先頭48マス（240分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '3', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku3_hango(self):
        # 判定式: 組立系ショップ・3直の半後年休は 240分で OK（48マス × 5分 = 240分）
        # 準備: 先頭48マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        # 操作: W1・3直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '3', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】標準ショップ（P）・1直の「半後年休」は作業時間 250分で工数入力OKになること
    #   前提: 先頭50マス（250分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '1', ショップPの人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_p_tyoku1_hango(self):
        # 判定式: 標準ショップ・1直の半後年休は 250分で OK（50マス × 5分 = 250分）
        # 準備: 先頭50マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(50):
            work_list[i] = 'A'
        # 操作: P・1直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '1', self.member_p, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】組立系ショップ（W1）・1直の「半後年休」は作業時間 240分で工数入力OKになること
    #   前提: 先頭48マス（240分）だけ作業 'A'
    #   操作: judgement_check(作業内容, '半後年休', '1', ショップW1の人員, 0)
    #   期待: True（OK）
    def test_judgement_check_shop_w1_tyoku1_hango(self):
        # 判定式: 組立系ショップ・1直の半後年休は 240分で OK（48マス × 5分 = 240分）
        # 準備: 先頭48マスに作業を入れる
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        # 操作: W1・1直・半後年休で判定する
        result = judgement_check(work_list, '半後年休', '1', self.member_w, 0)
        # 検証: OK
        self.assertTrue(result)

    # 【テスト】直=1（1直）なら人員の1直用の休憩時間を取得できること
    #   前提: 人員 11111 の休憩時間は make_break_times の値
    #   操作: break_get('1', 11111)
    #   期待: 1つ目の戻り値（昼休憩）が人員の break_time1 と一致
    def test_break_get_tyoku_1(self):
        # 操作: 直と従業員番号を渡し、(昼休憩, 残業休憩1, 残業休憩2, 残業休憩3) を取得
        bt, bt1, bt2, bt3 = break_get('1', 11111)
        # 検証: 昼休憩が1直用の値
        self.assertEqual(bt, self.member_p.break_time1)

    # 【テスト】直=2（2直）なら2直用の休憩時間を取得できること
    #   前提: 人員 11111 が存在する
    #   操作: break_get('2', 11111)
    #   期待: 昼休憩が人員の break_time2 と一致
    def test_break_get_tyoku_2(self):
        # 操作: 2直の休憩時間を取得
        bt, bt1, bt2, bt3 = break_get('2', 11111)
        # 検証: 昼休憩が2直用の値
        self.assertEqual(bt, self.member_p.break_time2)

    # 【テスト】直=3（3直）なら3直用の休憩時間を取得できること
    #   前提: 人員 11111 が存在する
    #   操作: break_get('3', 11111)
    #   期待: 昼休憩が人員の break_time3 と一致
    def test_break_get_tyoku_3(self):
        # 操作: 3直の休憩時間を取得
        bt, bt1, bt2, bt3 = break_get('3', 11111)
        # 検証: 昼休憩が3直用の値
        self.assertEqual(bt, self.member_p.break_time3)

    # 【テスト】直=4（常昼）なら常昼用の休憩時間を取得できること
    #   前提: 人員 11111 が存在する
    #   操作: break_get('4', 11111)
    #   期待: 昼休憩が人員の break_time4 と一致
    def test_break_get_tyoku_4(self):
        # 操作: 常昼の休憩時間を取得
        bt, bt1, bt2, bt3 = break_get('4', 11111)
        # 検証: 昼休憩が常昼用の値
        self.assertEqual(bt, self.member_p.break_time4)

    # 【テスト】直=5（連1直）なら連1直用の休憩時間を取得できること
    #   前提: 人員 11111 が存在する
    #   操作: break_get('5', 11111)
    #   期待: 昼休憩が人員の break_time5 と一致
    def test_break_get_tyoku_5(self):
        # 操作: 連1直の休憩時間を取得
        bt, bt1, bt2, bt3 = break_get('5', 11111)
        # 検証: 昼休憩が連1直用の値
        self.assertEqual(bt, self.member_p.break_time5)

    # 【テスト】直=6（連2直）なら連2直用の休憩時間を取得できること
    #   前提: 人員 11111 が存在する
    #   操作: break_get('6', 11111)
    #   期待: 昼休憩が人員の break_time6 と一致
    def test_break_get_tyoku_6(self):
        # 操作: 連2直の休憩時間を取得
        bt, bt1, bt2, bt3 = break_get('6', 11111)
        # 検証: 昼休憩が連2直用の値
        self.assertEqual(bt, self.member_p.break_time6)

    # 【テスト】画面から送られる UTC の日時文字列を、日本時間の休憩時間文字列に変換できること
    #   前提: なし
    #   操作: parse_break_time('2026-04-01T01:40:00.000Z', '2026-04-01T02:30:00.000Z', JST)
    #   期待: 3つ目の戻り値が "#10401130"（日本時間 10:40〜11:30）
    def test_parse_break_time_valid(self):
        # 準備: 日本時間（JST = UTC+9時間）のタイムゾーンを作る
        jst = dt_module.timezone(timedelta(hours=9))
        # 準備: 末尾の Z は UTC（協定世界時）を表す。UTC 01:40 は日本時間 10:40
        start = '2026-04-01T01:40:00.000Z'  # 10:40 JST
        end = '2026-04-01T02:30:00.000Z'    # 11:30 JST
        # 操作: (開始インデックス, 終了インデックス, "#HHMMHHMM") を取得
        start_ind, end_ind, time_str = parse_break_time(start, end, jst)
        # 検証: 日本時間に直した "#HHMMHHMM" 形式になっている
        self.assertEqual(time_str, '#10401130')

    # 【テスト】開始時刻が None（未入力）だと ValueError（値エラー）が発生すること
    #   前提: なし
    #   操作: parse_break_time(None, '2026-04-01T02:30:00.000Z', JST)
    #   期待: ValueError（「未入力箇所があります」）
    def test_parse_break_time_none_raises(self):
        # 準備: 日本時間のタイムゾーン
        jst = dt_module.timezone(timedelta(hours=9))
        # 操作＋検証: with ブロック内で ValueError が発生すればテスト成功
        with self.assertRaises(ValueError):
            parse_break_time(None, '2026-04-01T02:30:00.000Z', jst)

    # 【テスト】開始時刻が空文字（未入力）だと ValueError が発生すること
    #   前提: なし
    #   操作: parse_break_time('', '2026-04-01T02:30:00.000Z', JST)
    #   期待: ValueError（「未入力箇所があります」）
    def test_parse_break_time_empty_raises(self):
        # 準備: 日本時間のタイムゾーン
        jst = dt_module.timezone(timedelta(hours=9))
        # 操作＋検証: 空文字を渡すと ValueError が発生する
        with self.assertRaises(ValueError):
            parse_break_time('', '2026-04-01T02:30:00.000Z', jst)

    # 【テスト】日時の形式が不正だと ValueError が発生すること
    #   前提: なし
    #   操作: parse_break_time('bad', 'data', JST)
    #   期待: ValueError（「入力値の形式が不正です」）
    def test_parse_break_time_bad_format_raises(self):
        # 準備: 日本時間のタイムゾーン
        jst = dt_module.timezone(timedelta(hours=9))
        # 操作＋検証: 日時として読めない文字列を渡すと ValueError が発生する
        with self.assertRaises(ValueError):
            parse_break_time('bad', 'data', jst)

    # 【テスト】日付からその月の第何週かを取得できること
    #   前提: なし
    #   操作: get_week_of_month(2026-04-01)
    #   期待: None ではなく 1 以上の数値（2026-04-01 は水曜日で、日曜始まりのカレンダーでは第1週）
    def test_get_week_of_month(self):
        # 準備: 対象日
        d = date(2026, 4, 1)
        # 操作: 週番号を取得
        week = get_week_of_month(d)
        # 検証: 値が返り、1 以上である
        self.assertIsNotNone(week)
        self.assertGreaterEqual(week, 1)

    # 【テスト】工数区分定義から「記号と工数区分名」の選択肢リストを作れること
    #   前提: 工数区分定義「UtilVer」に工数区分が2つ（TaskA, TaskB）
    #   操作: kosu_division_dictionary('UtilVer')
    #   期待: 件数 2、選択肢の1つ目が ['A', 'TaskA']
    def test_kosu_division_dictionary(self):
        # 操作: (選択肢リスト, 登録されている工数区分の数) を取得
        choices, n = kosu_division_dictionary('UtilVer')
        # 検証: 工数区分は2つ。1番目の記号は 'A'、名前は 'TaskA'（記号は A,B,C… の順に割り当てられる）
        self.assertEqual(n, 2)
        self.assertEqual(len(choices), 2)
        self.assertEqual(choices[0][0], 'A')
        self.assertEqual(choices[0][1], 'TaskA')

    # 【テスト】工数区分定義から工数区分名だけのリストを作れること
    #   前提: 工数区分定義「UtilVer」に工数区分が2つ（TaskA, TaskB）
    #   操作: get_def_library_data('UtilVer')
    #   期待: 件数 2、名前のリストが ['TaskA', 'TaskB']
    def test_get_def_library_data(self):
        # 操作: (工数区分名のリスト, 工数区分の数) を取得
        labels, n = get_def_library_data('UtilVer')
        # 検証: 件数と名前の並び順
        self.assertEqual(n, 2)
        self.assertEqual(labels[0], 'TaskA')
        self.assertEqual(labels[1], 'TaskB')

    # 【テスト】1直の工数データを並び替えても 288マスのまま保たれること
    #   前提: 作業内容が 288マスすべて 'A' の1直の工数データ
    #   操作: kosu_sort(工数データ, ショップPの人員)
    #   期待: 戻り値の作業内容リストが 288 要素
    #   補足: kosu_sort は 0:00 始まりの 288マスを、直の始業時刻から並ぶように回転させる
    #         （1直・連1直は 4:30 始まり＝先頭 54マスを後ろへ回す）。
    #         このテストでは並び順ではなく要素数だけを確認している（以下の kosu_sort テストも同様）。
    def test_kosu_sort_tyoku1(self):
        # 準備: 作業内容 288マス・作業詳細 288個（'$' 区切り）の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 1), def_ver2='UtilVer',
            tyoku2='1', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】標準ショップ（P）・2直の並び替えでも 288マスのまま保たれること
    #   前提: 2直の工数データ（ショップ P の人員）
    #   操作: kosu_sort(工数データ, ショップPの人員)（P の2直は 12:00 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku2_p(self):
        # 準備: 2直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 2), def_ver2='UtilVer',
            tyoku2='2', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】組立系ショップ（W1）・2直の並び替えでも 288マスのまま保たれること
    #   前提: 2直の工数データ（ショップ W1 の人員）
    #   操作: kosu_sort(工数データ, ショップW1の人員)（組立系の2直は 9:00 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku2_w(self):
        # 準備: W1 の人員の2直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=22222, name=self.member_w,
            work_day2=date(2026, 4, 2), def_ver2='UtilVer',
            tyoku2='2', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_w)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】標準ショップ（P）・3直の並び替えでも 288マスのまま保たれること
    #   前提: 3直の工数データ（ショップ P の人員）
    #   操作: kosu_sort(工数データ, ショップPの人員)（P の3直は 20:30 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku3_p(self):
        # 準備: 3直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 3), def_ver2='UtilVer',
            tyoku2='3', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】組立系ショップ（W1）・3直の並び替えでも 288マスのまま保たれること
    #   前提: 3直の工数データ（ショップ W1 の人員）
    #   操作: kosu_sort(工数データ, ショップW1の人員)（組立系の3直は 18:00 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku3_w(self):
        # 準備: W1 の人員の3直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=22222, name=self.member_w,
            work_day2=date(2026, 4, 3), def_ver2='UtilVer',
            tyoku2='3', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_w)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】常昼（直=4）の並び替えでも 288マスのまま保たれること
    #   前提: 常昼の工数データ
    #   操作: kosu_sort(工数データ, ショップPの人員)（常昼は 6:00 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku4(self):
        # 準備: 常昼の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 4), def_ver2='UtilVer',
            tyoku2='4', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】連1直（直=5）の並び替えでも 288マスのまま保たれること
    #   前提: 連1直の工数データ
    #   操作: kosu_sort(工数データ, ショップPの人員)（連1直は1直と同じ 4:30 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku5(self):
        # 準備: 連1直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 5), def_ver2='UtilVer',
            tyoku2='5', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】連2直（直=6）の並び替えでも 288マスのまま保たれること
    #   前提: 連2直の工数データ
    #   操作: kosu_sort(工数データ, ショップPの人員)（連2直は 15:00 始まり）
    #   期待: 288 要素
    def test_kosu_sort_tyoku6(self):
        # 準備: 連2直の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 6), def_ver2='UtilVer',
            tyoku2='6', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)

    # 【テスト】直が未入力（空文字）でも 288マスのまま保たれること
    #   前提: 直が空の工数データ
    #   操作: kosu_sort(工数データ, ショップPの人員)（直なしは並び替えず 0:00 始まりのまま）
    #   期待: 288 要素
    def test_kosu_sort_no_tyoku(self):
        # 準備: 直が空文字の工数データを作成
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 7), def_ver2='UtilVer',
            tyoku2='', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        # 操作: 直に合わせて並び替える（どの条件にも当てはまらない分岐を通る）
        wl, dl = kosu_sort(kosu, self.member_p)
        # 検証: 要素数が変わっていない
        self.assertEqual(len(wl), 288)


# ---------------------------------------------------------------------------
# 13. TestKosuNewViews: 工数入力API（KosuNew）のテスト
#   対象 : GET/POST /api/kosu_new/（kosu_views.KosuNew）, POST /api/set_day/（就業日をセッションへ保存）
#   内容 : 工数入力画面の初期表示データ・古い工数区分定義Ver使用時の警告と、
#          工数の書き込み（就業日未指定・時間の重複・定義Ver不一致・休憩変更・日またぎ）を確認する。
#   前提知識: 画面から送る時刻（time1/time2）は UTC の ISO 形式（例 "2026-04-10T01:40:00.000Z"）。
#             API 側で日本時間（+9時間）に直し、5分単位のインデックスに変換して作業内容に書き込む。
#   準備 : 管理者ユーザー 12345 の 2026-04-01（1直・作業内容すべて未入力・休憩時間あり）の工数データを作成する
# ---------------------------------------------------------------------------
class TestKosuNewViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、作業内容が空の工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01 の工数データ
        #   time_work  : '#' × 288（全マス未入力）
        #   detail_work: 空文字 288個を '$' でつないだもの（作業詳細なし）
        #   breaktime〜breaktime_over3: その日の昼休憩・残業休憩1〜3（"#HHMMHHMM"）
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            breaktime='#10401130', breaktime_over1='#15101520',
            breaktime_over2='#20202110', breaktime_over3='#01400150',
        )

    # 【テスト】未ログインで工数入力画面用APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/kosu_new/
    #   期待: 401（未ログイン）
    def test_kosu_new_get_without_login(self):
        # 操作: ログインせずに工数入力画面用APIを呼ぶ
        response = self.client.get('/api/kosu_new/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】工数入力画面の初期表示に必要なデータがそろって返ること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/kosu_new/
    #   期待: 200 が返り、member_data / kosu_data / def_data / detail_list（作業詳細の選択肢）/
    #         session_day（入力対象の就業日）が含まれる
    def test_kosu_new_get_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数入力画面用APIを呼ぶ（セッションに就業日が無いため今日の日付が対象になる）
        response = self.client.get('/api/kosu_new/')
        # 検証: 200 で、画面表示に使う5種類のデータのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('detail_list', response.data)
        self.assertIn('session_day', response.data)

    # 【テスト】最新ではない工数区分定義Verを使っていると警告メッセージが返ること
    #   前提: TestVer より後に「NewerVer」が登録されている。セッションの使用Verは TestVer
    #   操作: GET /api/kosu_new/
    #   期待: 200 が返り、warning（警告メッセージ）が含まれる
    def test_kosu_new_get_warning_old_version(self):
        # 準備: 新しい工数区分定義Ver「NewerVer」を作成（最新の定義Verになる）
        kosu_division.objects.create(kosu_name='NewerVer', kosu_title_1='XX')
        # 準備: ログイン（この時点ではログインAPIが最新の NewerVer をセッションに保存する）
        self.login_as_admin()
        # 準備: テスト用クライアントのセッションを直接書き換え、使用Verを古い TestVer に戻す
        #   self.client.session で取り出したセッションは、save() するとサーバー側にも反映される
        session = self.client.session
        session['input_def'] = 'TestVer'
        session.save()
        # 操作: 工数入力画面用APIを呼ぶ
        response = self.client.get('/api/kosu_new/')
        # 検証: 200 で、使用Ver（TestVer）≠ 最新Ver（NewerVer）のため warning が付く
        self.assertEqual(response.status_code, 200)
        self.assertIn('warning', response.data)

    # 【テスト】工数入力（POST）が成功すること
    #   前提: 2026-04-10 の工数データは無い
    #   操作: 2026-04-10・1直・10:40〜11:30（日本時間）に工数区分 'A' を入力して POST /api/kosu_new/
    #   期待: 200
    #   補足: 入力した時間帯はこの人の1直の昼休憩（#10401130）と同じ。break_change=False のため
    #         API は休憩時間帯の工数を消去してから保存する（保存結果の中身はこのテストでは確認しない）
    def test_kosu_new_post_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: POST /api/set_day/ でセッションの就業日を工数データの無い 2026-04-10 にする
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-10'}),
                         content_type='application/json')
        # 準備: 工数入力画面から送られる内容
        data = {
            # work_day2: 就業日 / tyoku2: 直（'1' = 1直）
            'work_day2': '2026-04-10',
            'tyoku2': '1',
            # time1 / time2: 作業の開始・終了日時（UTC）。日本時間では 10:40〜11:30
            'time1': '2026-04-10T01:40:00.000Z',
            'time2': '2026-04-10T02:30:00.000Z',
            # time_work: 工数区分の記号 / detail_work: 作業詳細
            'time_work': 'A',
            'detail_work': 'test detail',
            # tomorrow_check: 翌日フラグ（画面は常に False を送り、API 側でもこの値は参照していない）
            # break_change  : 休憩変更チェック。False なら休憩時間の処理を行う
            #                  （休憩時間帯の工数を消す。休憩エラー有効の人は消さずにエラーになる）
            # over_time     : 残業時間（分） / work_time: 就業形態
            'tomorrow_check': False,
            'break_change': False,
            'over_time': 0,
            'work_time': '出勤',
        }
        # 操作: 工数入力APIを呼ぶ
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】就業日が未指定だと工数を入力できないこと
    #   前提: なし
    #   操作: work_day2 を空文字にして POST /api/kosu_new/
    #   期待: 400（「就業日が未指定です」エラー）
    def test_kosu_new_post_no_day(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 就業日が空の入力内容
        data = {
            'work_day2': '',
            'tyoku2': '1',
            'time1': '2026-04-10T01:40:00.000Z',
            'time2': '2026-04-10T02:30:00.000Z',
            'time_work': 'A',
            'detail_work': '',
        }
        # 操作: 工数入力APIを呼ぶ
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 400（就業日未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】既に工数が入っている時間帯には重ねて入力できないこと
    #   前提: 2026-04-10 の工数データは無い
    #   操作: 同じ時間帯（10:40〜11:30）の工数入力を2回続けて POST する
    #   期待: 1回目は 200、2回目は 400（「既に工数が入力されている」エラー）
    def test_kosu_new_post_overlap_error(self):
        self.login_as_admin()
        # 準備: セッションの就業日を工数データの無い 2026-04-10 にする
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-10'}),
                         content_type='application/json')
        # 準備: 入力内容（break_change=True なので休憩時間帯でも工数が消去されずに残る）
        data = {
            'work_day2': '2026-04-10',
            'tyoku2': '1',
            'time1': '2026-04-10T01:40:00.000Z',
            'time2': '2026-04-10T02:30:00.000Z',
            'time_work': 'A',
            'detail_work': 'test',
            'tomorrow_check': False,
            'break_change': True,
            'over_time': 0,
            'work_time': '出勤',
        }
        # 操作: 1回目の工数入力
        resp1 = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 1回目は成功（200）
        self.assertEqual(resp1.status_code, 200)
        # 操作: 同じ内容（同じ時間帯）で2回目の工数入力
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 1回目で入力済みの時間帯と重なるため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】就業日の工数データと異なる工数区分定義Verでは入力できないこと
    #   前提: 2026-04-01 の工数データの定義Verを「OtherVer」に変更。セッションの使用Verは TestVer
    #   操作: 2026-04-01 の工数入力を POST /api/kosu_new/
    #   期待: 400（「工数定義区分が違います」エラー）
    def test_kosu_new_post_def_ver_mismatch(self):
        # 準備: 管理者ユーザーでログイン（使用Verは TestVer）
        self.login_as_admin()
        # 準備: setUp で作った工数データの工数区分定義Verを別の値に書き換えて保存
        self.kosu.def_ver2 = 'OtherVer'
        self.kosu.save()
        # 準備: その工数データと同じ就業日（2026-04-01）への入力内容
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'time1': '2026-04-01T06:00:00.000Z',
            'time2': '2026-04-01T07:00:00.000Z',
            'time_work': 'A',
            'detail_work': '',
            'tomorrow_check': False,
            'break_change': False,
            'over_time': 0,
            'work_time': '出勤',
        }
        # 操作: 工数入力APIを呼ぶ
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 定義Ver（OtherVer ≠ TestVer）が違うため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】休憩変更チェックONなら休憩時間帯にも工数を入力できること
    #   前提: 2026-04-15 の工数データは無い
    #   操作: break_change=True・昼休憩と同じ 10:40〜11:30 に工数を入力して POST
    #   期待: 200
    def test_kosu_new_post_with_break_change(self):
        # 準備: 管理者ユーザーでログインし、セッションの就業日を 2026-04-15 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-15'}),
                         content_type='application/json')
        # 準備: break_change=True（休憩時間帯の工数を消去しない）の入力内容
        data = {
            'work_day2': '2026-04-15',
            'tyoku2': '1',
            'time1': '2026-04-15T01:40:00.000Z',
            'time2': '2026-04-15T02:30:00.000Z',
            'time_work': 'A',
            'detail_work': 'test',
            'tomorrow_check': False,
            'break_change': True,
            'over_time': 0,
            'work_time': '出勤',
        }
        # 操作: 工数入力APIを呼ぶ
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】日付をまたぐ時間帯（23:50〜翌0:10）の工数を入力できること
    #   前提: 2026-04-16 の工数データは無い
    #   操作: 開始 23:50・終了 0:10（日本時間）で工数を入力して POST
    #   期待: 200
    #   補足: API は「終了インデックス < 開始インデックス」を日またぎと判断し、
    #         286〜287 と 0〜1 の2つの範囲に分けて書き込む（tomorrow_check の値は使っていない）
    def test_kosu_new_post_with_tomorrow_check(self):
        # 準備: 管理者ユーザーでログインし、セッションの就業日を 2026-04-16 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-16'}),
                         content_type='application/json')
        # 準備: 日付をまたぐ時間帯の入力内容
        data = {
            'work_day2': '2026-04-16',
            'tyoku2': '1',
            'time1': '2026-04-16T14:50:00.000Z',  # 23:50 JST
            'time2': '2026-04-16T15:10:00.000Z',  # 00:10 JST（翌日）
            'time_work': 'A',
            'detail_work': 'test',
            'tomorrow_check': True,
            'break_change': True,
            'over_time': 0,
            'work_time': '出勤',
        }
        # 操作: 工数入力APIを呼ぶ
        response = self.client.post('/api/kosu_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 14. TestKosuUpdateViews: 工数編集API（KosuUpdate）のテスト
#   対象 : GET/PUT /api/kosu_update/<工数データのID>/（kosu_views.KosuUpdate）
#   内容 : 編集画面用データの取得と、作業内容の全面書き換え（PUT）の成功・失敗パターン、
#          残業時間（over_time）の保存を確認する。
#   前提知識: GET を呼ぶとその工数データの就業日がセッション（day）に保存される。
#             PUT は送られた work_day2 がセッションの就業日と一致しないとエラーになる。
#             PUT の作業時間は time1_N / time2_N / timeData_work_N / timeData_detail_N（N=1,2,…）で送る。
#   準備 : 管理者ユーザー 12345 の 2026-04-01（1直・出勤・作業内容すべて未入力）の工数データを作成する
# ---------------------------------------------------------------------------
class TestKosuUpdateViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、編集対象の工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01・1直・就業形態「出勤」・作業内容すべて未入力の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            work_time='出勤',
        )

    # 【テスト】工数編集画面用のデータを取得できること
    #   前提: 編集対象の工数データが存在する
    #   操作: GET /api/kosu_update/<ID>/
    #   期待: 200 が返り、kosu_data / def_data / member_data / detail_data_list（作業詳細の選択肢）が含まれる
    def test_kosu_update_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数編集画面用APIを呼ぶ
        response = self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 検証: 200 で、4種類のデータのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('member_data', response.data)
        self.assertIn('detail_data_list', response.data)

    # 【テスト】存在しないIDの工数データは取得できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: GET /api/kosu_update/99999/
    #   期待: 404（見つからない）
    def test_kosu_update_get_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで工数編集画面用APIを呼ぶ
        response = self.client.get('/api/kosu_update/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】工数データを編集（作業内容を書き換え）できること
    #   前提: GET でセッションの就業日が 2026-04-01 になっている
    #   操作: 10:40〜11:30 に工数区分 'A' を入れた内容を PUT /api/kosu_update/<ID>/ で送る
    #   期待: 200
    def test_kosu_update_put_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 先に GET を呼び、セッションの就業日を工数データの就業日（2026-04-01）にする
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: 編集内容（作業時間は1件。_1 は1件目を表す番号）
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'work_time': '出勤',
            'over_time': 0,
            # time1_1 / time2_1: 1件目の開始・終了日時（UTC。日本時間 10:40〜11:30）
            # timeData_work_1 / timeData_detail_1: 1件目の工数区分の記号・作業詳細
            'time1_1': '2026-04-01T01:40:00.000Z',
            'time2_1': '2026-04-01T02:30:00.000Z',
            'timeData_work_1': 'A',
            'timeData_detail_1': 'updated detail',
        }
        # 操作: 工数編集APIを呼ぶ（作業内容は送った作業時間だけで全面的に作り直される）
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数編集で変更した残業時間がデータベースに保存されること
    #   前提: 編集対象の工数データの残業時間は 0。GET でセッションの就業日が 2026-04-01 になっている
    #   操作: 残業時間を 30（分）にして PUT /api/kosu_update/<ID>/ で送る
    #   期待: 200 が返り、保存された工数データの over_time が 30 になっている
    def test_kosu_update_put_saves_over_time(self):
        # 準備: 管理者ユーザーでログインし、GET でセッションの就業日を合わせる
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: 残業時間だけを 0 → 30 に変えた編集内容（作業時間は1件: 日本時間 10:40〜11:30）
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'work_time': '出勤',
            'over_time': 30,
            'time1_1': '2026-04-01T01:40:00.000Z',
            'time2_1': '2026-04-01T02:30:00.000Z',
            'timeData_work_1': 'A',
            'timeData_detail_1': 'updated detail',
        }
        # 操作: 工数編集APIを呼ぶ
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 200 で、データベースから読み直した残業時間が 30 になっている
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(self.kosu.over_time, 30)

    # 【テスト】工数編集で残業時間を送らなかった場合は、保存済みの残業時間がそのまま残ること
    #   前提: 編集対象の工数データの残業時間は 45。GET でセッションの就業日が 2026-04-01 になっている
    #   操作: over_time を含めずに PUT /api/kosu_update/<ID>/ で送る
    #   期待: 200 が返り、保存された工数データの over_time は 45 のまま
    def test_kosu_update_put_keeps_over_time_when_not_sent(self):
        # 準備: 編集対象の残業時間を 45 にしておく
        self.kosu.over_time = 45
        self.kosu.save()
        # 準備: 管理者ユーザーでログインし、GET でセッションの就業日を合わせる
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: over_time を含まない編集内容（作業時間は1件: 日本時間 10:40〜11:30）
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'work_time': '出勤',
            'time1_1': '2026-04-01T01:40:00.000Z',
            'time2_1': '2026-04-01T02:30:00.000Z',
            'timeData_work_1': 'A',
            'timeData_detail_1': 'updated detail',
        }
        # 操作: 工数編集APIを呼ぶ
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 200 で、残業時間は保存済みの 45 のまま
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(self.kosu.over_time, 45)

    # 【テスト】存在しないIDの工数データは編集できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: PUT /api/kosu_update/99999/（中身は空）
    #   期待: 404（見つからない）
    def test_kosu_update_put_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで工数編集APIを呼ぶ
        response = self.client.put('/api/kosu_update/99999/', {}, format='json')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】編集APIでは就業日を変更できないこと
    #   前提: GET でセッションの就業日が 2026-04-01 になっている
    #   操作: work_day2 を 2026-04-05 にして PUT
    #   期待: 400（「更新ボタンで就業日の修正はできません」エラー）
    def test_kosu_update_put_day_mismatch(self):
        # 準備: 管理者ユーザーでログインし、GET でセッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: セッションの就業日と異なる就業日を送る
        data = {'work_day2': '2026-04-05', 'tyoku2': '1'}
        # 操作: 工数編集APIを呼ぶ
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 就業日が一致しないため 400（就業日の変更は日付変更API /api/day_update/ で行う）
        self.assertEqual(response.status_code, 400)

    # 【テスト】作業時間を1件も送らなくても、直・就業形態だけを更新できること
    #   前提: GET でセッションの就業日が 2026-04-01 になっている
    #   操作: 直='2'・就業形態「出勤」だけを PUT（time1_N の項目なし）
    #   期待: 200（作業内容は元のまま、直と就業形態だけが更新される）
    def test_kosu_update_put_no_time_data(self):
        # 準備: 管理者ユーザーでログインし、GET でセッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: 作業時間の項目を含まない編集内容
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '2',
            'work_time': '出勤',
            'over_time': 0,
        }
        # 操作: 工数編集APIを呼ぶ
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】送った作業時間どうしが重なっているとエラーになること
    #   前提: GET でセッションの就業日が 2026-04-01 になっている
    #   操作: 1件目 10:40〜11:30・2件目 11:00〜12:00（日本時間）を PUT
    #   期待: 400（「入力した作業時間に被りがあります」エラー）
    def test_kosu_update_put_overlap_error(self):
        # 準備: 管理者ユーザーでログインし、GET でセッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 準備: 11:00〜11:30 の30分が重なる2件の作業時間
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'work_time': '出勤',
            'over_time': 0,
            'time1_1': '2026-04-01T01:40:00.000Z',
            'time2_1': '2026-04-01T02:30:00.000Z',
            'timeData_work_1': 'A',
            'timeData_detail_1': 'a',
            'time1_2': '2026-04-01T02:00:00.000Z',
            'time2_2': '2026-04-01T03:00:00.000Z',
            'timeData_work_2': 'B',
            'timeData_detail_2': 'b',
        }
        # 操作: 工数編集APIを呼ぶ
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 2件目を書き込む時に1件目と重なるため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】工数区分定義Verが未設定の工数データでも編集画面用データを取得できること
    #   前提: 工数データの def_ver2 が None
    #   操作: GET /api/kosu_update/<ID>/
    #   期待: 200（工数データに定義Verが無い場合は、セッションの使用Verの定義を使う）
    def test_kosu_update_get_no_def_ver2(self):
        """Test kosu_update GET when kosu has no def_ver2 (uses session def)."""
        # 準備: 工数データの工数区分定義Verを空（None）にして保存
        self.kosu.def_ver2 = None
        self.kosu.save()
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数編集画面用APIを呼ぶ
        response = self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 15. TestKosuMiscViews: 就業日・残業・休憩時間の設定APIのテスト
#   対象 : POST /api/set_day/（SetDay）, POST /api/over_time/（OverTime）,
#          GET/POST /api/break_time/（BreakTime: 人員の既定の休憩時間）,
#          GET/POST /api/today_break_time/（TodayBreakTime: その日だけの休憩時間）（kosu_views.py）
#   内容 : セッションへの就業日保存、残業時間の更新（工数データが無ければ新規作成）、
#          休憩時間の取得・更新（未入力があればエラー）を確認する。
#   準備 : 管理者ユーザー 12345 の 2026-04-01（休憩時間あり）の工数データを作成する
# ---------------------------------------------------------------------------
class TestKosuMiscViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01・1直・出勤・作業内容すべて未入力・休憩時間あり の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            work_time='出勤',
            breaktime='#10401130', breaktime_over1='#15101520',
            breaktime_over2='#20202110', breaktime_over3='#01400150',
        )

    # 【テスト】就業日をセッションに保存できること
    #   前提: なし
    #   操作: POST /api/set_day/ に day="2026-04-05" を送る
    #   期待: 200
    def test_set_day_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 保存する就業日
        data = {'day': '2026-04-05'}
        # 操作: 就業日設定APIを呼ぶ
        response = self.client.post('/api/set_day/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】就業日が空だとエラーになること
    #   前提: なし
    #   操作: POST /api/set_day/ に day="" を送る
    #   期待: 400（「就業日が未指定です」エラー）
    def test_set_day_empty(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 空の就業日
        data = {'day': ''}
        # 操作: 就業日設定APIを呼ぶ
        response = self.client.post('/api/set_day/', data, format='json')
        # 検証: 400（就業日未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】既存の工数データの残業時間を更新できること
    #   前提: 2026-04-01 の工数データ（残業0）が存在する
    #   操作: POST /api/over_time/ に就業日 2026-04-01・残業 60 を送る
    #   期待: 200 が返り、DBの残業時間が 60 になる
    def test_overtime_post_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 就業日と残業時間（分）
        data = {'work_day2': '2026-04-01', 'over_time': 60}
        # 操作: 残業時間設定APIを呼ぶ
        response = self.client.post('/api/over_time/', data, format='json')
        # 検証: 200 で、DBから読み直した残業時間が 60
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(self.kosu.over_time, 60)

    # 【テスト】就業日が空だと残業時間を更新できないこと
    #   前提: なし
    #   操作: POST /api/over_time/ に就業日 ""・残業 60 を送る
    #   期待: 400（「就業日が未指定です」エラー）
    def test_overtime_post_no_day(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 就業日が空の内容
        data = {'work_day2': '', 'over_time': 60}
        # 操作: 残業時間設定APIを呼ぶ
        response = self.client.post('/api/over_time/', data, format='json')
        # 検証: 400（就業日未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】工数データの無い日に残業時間を送ると、工数データが新規作成されること
    #   前提: 2026-04-20 の工数データは無い
    #   操作: POST /api/over_time/ に就業日 2026-04-20・残業 30 を送る
    #   期待: 200 が返り、DBに 12345 の 2026-04-20 の工数データが存在する
    def test_overtime_post_new_kosu(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 工数データの無い就業日と残業時間
        data = {'work_day2': '2026-04-20', 'over_time': 30}
        # 操作: 残業時間設定APIを呼ぶ（get_or_create で無ければ作成される）
        response = self.client.post('/api/over_time/', data, format='json')
        # 検証: 200 で、工数データが作成されている
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Business_Time_graph.objects.filter(
            employee_no3=12345, work_day2=date(2026, 4, 20)).exists())

    # 【テスト】未ログインで休憩時間設定画面用APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/break_time/
    #   期待: 401（未ログイン）
    def test_break_time_get_without_login(self):
        # 操作: ログインせずに休憩時間設定画面用APIを呼ぶ
        response = self.client.get('/api/break_time/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】ログイン者の休憩時間設定（人員データ）を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/break_time/
    #   期待: 200 が返り、member_data（休憩時間を含む人員データ）が含まれる
    def test_break_time_get_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 休憩時間設定画面用APIを呼ぶ
        response = self.client.get('/api/break_time/')
        # 検証: 200 で、member_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)

    # 【テスト】人員の既定の休憩時間（6種類の直 × 4項目 = 24項目）を更新できること
    #   前提: なし
    #   操作: breakTime1〜breakTime48 の48個の日時を POST /api/break_time/ で送る
    #   期待: 200
    def test_break_time_post_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 休憩1つにつき「開始・終了」の2個の日時が必要なため 24項目 × 2 = 48個を送る
        #   （breakTime1・2 が1つ目の休憩の開始・終了、3・4 が2つ目 …。値はすべて同じ UTC 01:40）
        data = {}
        for i in range(1, 49):
            data[f'breakTime{i}'] = '2026-04-01T01:40:00.000Z'
        # 操作: 休憩時間設定APIを呼ぶ
        response = self.client.post('/api/break_time/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】休憩時間に未入力があると更新できないこと
    #   前提: なし
    #   操作: breakTime1 だけを POST /api/break_time/ で送る
    #   期待: 400（「未入力箇所があります」エラー）
    def test_break_time_post_missing_data(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 1つ目の休憩の開始だけを送る（終了 breakTime2 以降が無い）
        data = {'breakTime1': '2026-04-01T01:40:00.000Z'}
        # 操作: 休憩時間設定APIを呼ぶ
        response = self.client.post('/api/break_time/', data, format='json')
        # 検証: parse_break_time が ValueError を出し、API が 400 を返す
        self.assertEqual(response.status_code, 400)

    # 【テスト】未ログインで当日休憩時間APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/today_break_time/
    #   期待: 401（未ログイン）
    def test_today_break_time_get_without_login(self):
        # 操作: ログインせずに当日休憩時間APIを呼ぶ
        response = self.client.get('/api/today_break_time/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】セッションの就業日に工数データがあれば、その日の休憩時間を取得できること
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: 就業日を 2026-04-01 にしてから GET /api/today_break_time/
    #   期待: 200 が返り、kosu_data（その日の工数データ）が含まれる
    def test_today_break_time_get_with_kosu(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: セッションの就業日を、工数データのある 2026-04-01 にする
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        # 操作: 当日休憩時間APIを呼ぶ
        response = self.client.get('/api/today_break_time/')
        # 検証: 200 で、kosu_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)

    # 【テスト】セッションの就業日に工数データが無ければ 404 になること
    #   前提: 2026-05-01 の工数データは無い
    #   操作: 就業日を 2026-05-01 にしてから GET /api/today_break_time/
    #   期待: 404（見つからない）
    def test_today_break_time_get_no_kosu(self):
        # 準備: 管理者ユーザーでログインし、セッションの就業日を工数データの無い 2026-05-01 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-05-01'}),
                         content_type='application/json')
        # 操作: 当日休憩時間APIを呼ぶ
        response = self.client.get('/api/today_break_time/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】その日の休憩時間（昼休憩＋残業休憩3つ = 4項目）を更新できること
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: 就業日を 2026-04-01 にしてから breakTime1〜8 の8個の日時を POST
    #   期待: 200
    def test_today_break_time_post_success(self):
        # 準備: 管理者ユーザーでログインし、セッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        # 準備: 4項目 × 開始・終了 = 8個の日時を送る
        data = {}
        for i in range(1, 9):
            data[f'breakTime{i}'] = '2026-04-01T01:40:00.000Z'
        # 操作: 当日休憩時間の更新APIを呼ぶ
        response = self.client.post('/api/today_break_time/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】その日の休憩時間に未入力があると更新できないこと
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: breakTime1 だけを POST /api/today_break_time/ で送る
    #   期待: 400（「未入力箇所があります」エラー）
    def test_today_break_time_post_missing_data(self):
        # 準備: 管理者ユーザーでログインし、セッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        # 準備: 1つ目の休憩の開始だけを送る
        data = {'breakTime1': '2026-04-01T01:40:00.000Z'}
        # 操作: 当日休憩時間の更新APIを呼ぶ
        response = self.client.post('/api/today_break_time/', data, format='json')
        # 検証: 400（未入力あり）
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 16. TestKosuCalendarViews: 工数カレンダー関連APIのテスト
#   対象 : GET /api/kosu_calendar/, POST /api/kosu_calendar_change/, POST /api/kosu_link/,
#          POST /api/kosu_work_write/, POST /api/work_default/, POST /api/tyoku_default/（kosu_views.py）
#   内容 : カレンダー表示データの取得、表示年月・就業日のセッション保存、
#          カレンダーからの就業形態・直の一括書き込み、既定の就業形態・直の一括設定を確認する。
#   前提知識: 表示する年月はセッション（year / month）に保存され、無ければ今日の年月になる。
# ---------------------------------------------------------------------------
class TestKosuCalendarViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備だけを行う（このクラス独自のデータは作らない）
    def setUp(self):
        super().setUp()

    # 【テスト】未ログインで工数カレンダーAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/kosu_calendar/
    #   期待: 401（未ログイン）
    def test_kosu_calendar_get_without_login(self):
        # 操作: ログインせずに工数カレンダーAPIを呼ぶ
        response = self.client.get('/api/kosu_calendar/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】工数カレンダーの表示データを取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/kosu_calendar/
    #   期待: 200 が返り、kosu_data（その月の工数）・session_year・session_month（表示年月）が含まれる
    def test_kosu_calendar_get_with_login(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数カレンダーAPIを呼ぶ（セッションに年月が無いため今日の年月が対象）
        response = self.client.get('/api/kosu_calendar/')
        # 検証: 200 で、3種類のデータのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('session_year', response.data)
        self.assertIn('session_month', response.data)

    # 【テスト】カレンダーの表示年月を変更できること
    #   前提: なし
    #   操作: POST /api/kosu_calendar_change/ に year=2026・month=5 を送る
    #   期待: 200（セッションの year / month が更新される）
    def test_kosu_calendar_change_post(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示したい年月
        data = {'year': 2026, 'month': 5}
        # 操作: 表示年月変更APIを呼ぶ
        response = self.client.post('/api/kosu_calendar_change/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】カレンダーの日付クリックで、その日を工数入力の就業日にできること
    #   前提: なし
    #   操作: POST /api/kosu_link/ に day="2026-04-10" を送る
    #   期待: 200（セッションの day が更新される）
    def test_kosu_link_post(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 工数入力画面で開きたい就業日
        data = {'day': '2026-04-10'}
        # 操作: 就業日リンクAPIを呼ぶ
        response = self.client.post('/api/kosu_link/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】カレンダーから日ごとの就業形態・直を一括で書き込めること
    #   前提: 表示年月が 2026年4月
    #   操作: 4/1=出勤・1直、4/2=休日 を POST /api/kosu_work_write/ で送る
    #   期待: 200（工数データの無い日は新規作成される）
    def test_kosu_work_write_post(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示年月変更APIでセッションの表示年月を 2026年4月 にする
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        # 準備: キーが "YYYY-MM-DD"、値が {就業形態, 直} の辞書
        data = {
            '2026-04-01': {'work_time': '出勤', 'tyoku2': '1'},
            '2026-04-02': {'work_time': '休日', 'tyoku2': ''},
        }
        # 操作: 勤務一括書き込みAPIを呼ぶ（表示月の1日〜末日を順に処理する）
        response = self.client.post('/api/kosu_work_write/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】送信データに無い日で、中身が空の工数データは削除されること（処理が成功すること）
    #   前提: 2026-04-01 に作業内容・作業詳細・残業がすべて空の工数データがある。表示年月は 2026年4月
    #   操作: 空の辞書 {} を POST /api/kosu_work_write/ で送る
    #   期待: 200（API は「作業内容が '#'×288・作業詳細が '$'×287・残業0」の工数データを削除する。
    #         削除されたかどうかはこのテストでは確認していない）
    def test_kosu_work_write_cleans_empty_data(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 中身が空の工数データを作成
        #   time_work '#'×288 = 全マス未入力 / detail_work '$'×287 = 空の作業詳細288個を '$' でつないだ形
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), time_work='#' * 288,
            detail_work='$' * 287, over_time=0
        )
        # 準備: セッションの表示年月を 2026年4月 にする
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        # 準備: どの日のデータも送らない（4/1 は「送信なし ＋ 中身が空」で削除対象になる）
        data = {}  # 4/1 分のデータも送らない
        # 操作: 勤務一括書き込みAPIを呼ぶ
        response = self.client.post('/api/kosu_work_write/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】表示月の全日に既定の就業形態（平日=出勤・土日=休日）を設定できること
    #   前提: 表示年月が 2026年4月
    #   操作: POST /api/work_default/
    #   期待: 200（工数データの無い日は作成し、就業形態が空の日だけ設定する）
    def test_work_default_post(self):
        # 準備: 管理者ユーザーでログインし、セッションの表示年月を 2026年4月 にする
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        # 操作: デフォルト勤務設定APIを呼ぶ（送信データは不要）
        response = self.client.post('/api/work_default/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】未ログインでデフォルト勤務設定APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: POST /api/work_default/
    #   期待: 401（未ログイン）
    def test_work_default_post_without_login(self):
        # 操作: ログインせずにデフォルト勤務設定APIを呼ぶ
        response = self.client.post('/api/work_default/', {}, format='json')
        # 検証: このAPIは個別の権限設定を持たないが、settings.py の既定設定（IsLoggedIn）により
        #       全APIでログインが必須のため 401（未ログイン）になる
        self.assertEqual(response.status_code, 401)

    # 【テスト】表示月の平日に、週ごとの既定の直を設定できること
    #   前提: 表示年月が 2026年4月
    #   操作: POST /api/tyoku_default/ に default_tyoku1='1'・default_tyoku2='2' を送る
    #   期待: 200
    def test_tyoku_default_post(self):
        # 準備: 管理者ユーザーでログインし、セッションの表示年月を 2026年4月 にする
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        # 準備: default_tyoku{N}: 月の第N週（日曜始まり）の平日に設定する直（第1週=1直、第2週=2直）
        data = {'default_tyoku1': '1', 'default_tyoku2': '2'}
        # 操作: デフォルト直設定APIを呼ぶ
        response = self.client.post('/api/tyoku_default/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】12月でもデフォルト勤務設定ができること（月末日の計算で年をまたぐ分岐）
    #   前提: 表示年月が 2025年12月
    #   操作: POST /api/work_default/
    #   期待: 200（翌月1日＝翌年1月1日の前日として 12月31日 を求める処理が通る）
    def test_work_default_post_december(self):
        # 準備: 管理者ユーザーでログインし、セッションの表示年月を 2025年12月 にする
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2025, 'month': 12}),
                         content_type='application/json')
        # 操作: デフォルト勤務設定APIを呼ぶ
        response = self.client.post('/api/work_default/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】12月でもデフォルト直設定ができること（月末日の計算で年をまたぐ分岐）
    #   前提: 表示年月が 2025年12月
    #   操作: POST /api/tyoku_default/ に default_tyoku1='1' を送る
    #   期待: 200
    def test_tyoku_default_post_december(self):
        # 準備: 管理者ユーザーでログインし、セッションの表示年月を 2025年12月 にする
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2025, 'month': 12}),
                         content_type='application/json')
        # 準備: 第1週の平日だけ 1直 にする
        data = {'default_tyoku1': '1'}
        # 操作: デフォルト直設定APIを呼ぶ
        response = self.client.post('/api/tyoku_default/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 17. TestDayUpdateItemDelete: 工数データの日付変更・時間帯削除APIのテスト
#   対象 : PUT /api/day_update/（DayUpdate）, POST /api/item_delete/（ItemDlete）（kosu_views.py）
#   内容 : 工数データの就業日の付け替え（変更先に既にデータがあればエラー）と、
#          指定した時間帯の作業内容を未入力に戻す処理を確認する。
#   準備 : 管理者ユーザー 12345 の 2026-04-01 の工数データ（先頭20マス＝0:00〜1:40 に作業 'A'）を作成する
# ---------------------------------------------------------------------------
class TestDayUpdateItemDelete(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、作業の入った工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01 の工数データ
        #   time_work  : 先頭20マス（0:00〜1:40）が 'A'、残り268マスが未入力
        #   detail_work: 先頭20個が 'd'、残りが空の作業詳細を '$' でつないだもの
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0,
            time_work='A' * 20 + '#' * 268,
            detail_work='$'.join(['d'] * 20 + [''] * 268),
            work_time='出勤',
        )

    # 【テスト】工数データの就業日を別の日に変更できること
    #   前提: 2026-04-20 の工数データは無い
    #   操作: PUT /api/day_update/ に 新しい就業日 2026-04-20・工数データのID を送る
    #   期待: 200 が返り、DBの就業日が 2026-04-20 になる
    def test_day_update_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 変更後の就業日と、変更する工数データのID
        data = {'work_day2': '2026-04-20', 'id': self.kosu.id}
        # 操作: 日付変更APIを呼ぶ
        response = self.client.put('/api/day_update/', data, format='json')
        # 検証: 200 で、DBから読み直した就業日が変更後の日付
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(str(self.kosu.work_day2), '2026-04-20')

    # 【テスト】変更後の就業日が空だとエラーになること
    #   前提: なし
    #   操作: PUT /api/day_update/ に 就業日 "" を送る
    #   期待: 400（「就業日が未指定です」エラー）
    def test_day_update_no_day(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 就業日が空の内容
        data = {'work_day2': '', 'id': self.kosu.id}
        # 操作: 日付変更APIを呼ぶ
        response = self.client.put('/api/day_update/', data, format='json')
        # 検証: 400（就業日未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】変更先の日に既に工数データがあると就業日を変更できないこと
    #   前提: 2026-04-05 に別の工数データがある
    #   操作: 2026-04-01 の工数データの就業日を 2026-04-05 に変更する PUT
    #   期待: 400（「変更日に既に工数データがあります」エラー）
    def test_day_update_existing_data(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 変更先の日（2026-04-05）に別の工数データを作成
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 5), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        # 準備: 既にデータがある日への変更内容
        data = {'work_day2': '2026-04-05', 'id': self.kosu.id}
        # 操作: 日付変更APIを呼ぶ
        response = self.client.put('/api/day_update/', data, format='json')
        # 検証: 変更先に工数データがあるため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】指定した時間帯の作業内容を未入力に戻せること
    #   前提: 2026-04-01 の 0:00〜1:40 に作業が入っている
    #   操作: POST /api/item_delete/ に 0:00〜0:50（日本時間）を送る
    #   期待: 200（インデックス 0〜9 が '#' に戻る。中身はこのテストでは確認していない）
    def test_item_delete_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 削除する就業日と時間帯（UTC 3/31 15:00〜15:50 = 日本時間 4/1 0:00〜0:50）
        data = {
            'work_day2': '2026-04-01',
            'time1': '2026-03-31T15:00:00.000Z',  # 00:00 JST
            'time2': '2026-03-31T15:50:00.000Z',  # 00:50 JST
        }
        # 操作: 時間帯削除APIを呼ぶ
        response = self.client.post('/api/item_delete/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】未ログインで時間帯削除APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: POST /api/item_delete/
    #   期待: 401（未ログイン）
    def test_item_delete_no_login(self):
        # 準備: 削除内容（ログインはしない）
        data = {
            'work_day2': '2026-04-01',
            'time1': '2026-03-31T15:00:00.000Z',
            'time2': '2026-03-31T15:50:00.000Z',
        }
        # 操作: ログインせずに時間帯削除APIを呼ぶ
        response = self.client.post('/api/item_delete/', data, format='json')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】指定日に工数データが無いと時間帯削除ができないこと
    #   前提: 2026-05-01 の工数データは無い
    #   操作: POST /api/item_delete/ に就業日 2026-05-01 を送る
    #   期待: 404（工数データが見つかりません。ログインが切れた時の 401 とは分ける）
    def test_item_delete_no_kosu(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 工数データの無い日の削除内容
        data = {
            'work_day2': '2026-05-01',
            'time1': '2026-05-01T00:00:00.000Z',
            'time2': '2026-05-01T01:00:00.000Z',
        }
        # 操作: 時間帯削除APIを呼ぶ
        response = self.client.post('/api/item_delete/', data, format='json')
        # 検証: 404（工数データなし）
        self.assertEqual(response.status_code, 404)

    # 【テスト】作業内容が未登録（None）の工数データでは時間帯削除ができないこと
    #   前提: 2026-04-08 に作業内容 None の工数データがある
    #   操作: POST /api/item_delete/ に就業日 2026-04-08 を送る
    #   期待: 404（「工数データが見つかりません」）
    def test_item_delete_no_time_work(self):
        # 準備: 管理者ユーザーでログインし、作業内容が None の工数データを作成
        self.login_as_admin()
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 8), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work=None
        )
        # 準備: その日の削除内容
        data = {
            'work_day2': '2026-04-08',
            'time1': '2026-04-08T00:00:00.000Z',
            'time2': '2026-04-08T01:00:00.000Z',
        }
        # 操作: 時間帯削除APIを呼ぶ
        response = self.client.post('/api/item_delete/', data, format='json')
        # 検証: 404（作業内容なし）
        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# 18. TestKosuTotalViews: 工数集計API（POST）のテスト
#   対象 : POST /api/kosu_total/（kosu_views.KosuTotal）
#   内容 : 指定日を基準に、日間・月間・年間の工数データを集計用に取得できることを確認する。
#   準備 : 管理者ユーザー 12345 の 2026-04-01 の工数データを作成する
#   ※後半の test_kosu_total_post_with_existing_* の3件は、前半の3件と同じ内容
#     （どちらも setUp の工数データがある状態で同じリクエストを送っている）
# ---------------------------------------------------------------------------
class TestKosuTotalViews(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、集計対象の工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01・1直・出勤・作業内容すべて未入力の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    # 【テスト】日間の工数集計データを取得できること
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="日間" を送る
    #   期待: 200
    def test_kosu_total_post_daily(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（日間 = その日1日分）
        data = {'date': '2026-04-01', 'period': '日間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】月間の工数集計データを取得できること
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="月間" を送る
    #   期待: 200
    def test_kosu_total_post_monthly(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（月間 = 基準日と同じ年月の全データ）
        data = {'date': '2026-04-01', 'period': '月間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】年間の工数集計データを取得できること
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="年間" を送る
    #   期待: 200
    def test_kosu_total_post_yearly(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（年間 = 基準日と同じ年の全データ）
        data = {'date': '2026-04-01', 'period': '年間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数データがある日の日間集計ができること（test_kosu_total_post_daily と同じ内容）
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="日間" を送る
    #   期待: 200
    def test_kosu_total_post_with_existing_daily(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（日間）
        data = {'date': '2026-04-01', 'period': '日間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数データがある月の月間集計ができること（test_kosu_total_post_monthly と同じ内容）
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="月間" を送る
    #   期待: 200
    def test_kosu_total_post_with_existing_monthly(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（月間）
        data = {'date': '2026-04-01', 'period': '月間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数データがある年の年間集計ができること（test_kosu_total_post_yearly と同じ内容）
    #   前提: 2026-04-01 の工数データがある
    #   操作: POST /api/kosu_total/ に date=2026-04-01・period="年間" を送る
    #   期待: 200
    def test_kosu_total_post_with_existing_yearly(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 基準日と集計期間（年間）
        data = {'date': '2026-04-01', 'period': '年間'}
        # 操作: 工数集計APIを呼ぶ
        response = self.client.post('/api/kosu_total/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 19. TestTeamViewsExtended: 班員APIのテスト（追加ケース）
#   対象 : /api/team_calendar/, /api/team_calendar_week_jump/, /api/team_overtime/, /api/team_view/,
#          /api/team_shop_select/, /api/team_export/, /api/team_list/, /api/team_new/（team_views.py）
#   内容 : 班員の週カレンダー・残業管理・ショップ単位の工数表示・Excel出力・一覧の絞り込みと、
#          未ログイン（401）・権限なし（403）・班員未登録（400）のエラーを確認する。
#   準備 : 管理者ユーザー 12345 の班（メンバー1=99999・フォローON）と、99999 の 2026-04-01 の工数データを作成する
# ---------------------------------------------------------------------------
class TestTeamViewsExtended(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、班員データと班員の工数データを作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 班員データ: 班長 12345 の班のメンバー1 に 99999、フォロー（工数未入力の通知）ON
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999', follow=True
        )
        # 班員 99999 の 2026-04-01・1直・出勤 の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    # 【テスト】班員の週カレンダー表示データを取得できること
    #   前提: 管理者ユーザー（権限あり）の班に 99999 が登録されている
    #   操作: GET /api/team_calendar/
    #   期待: 200 が返り、kosu_data（その週の班員の工数）と member_name_list（[従業員番号, 氏名] のリスト）が含まれる
    def test_team_calendar_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員カレンダーAPIを呼ぶ（セッションの就業日が無ければ今日を含む日曜〜土曜の週が対象）
        response = self.client.get('/api/team_calendar/')
        # 検証: 200 で、工数と班員名リストのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    # 【テスト】未ログインで班員カレンダーAPIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/team_calendar/
    #   期待: 401（未ログイン）
    def test_team_calendar_get_without_login(self):
        # 操作: ログインせずに班員カレンダーAPIを呼ぶ
        response = self.client.get('/api/team_calendar/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】権限なしのユーザーは班員カレンダーAPIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/team_calendar/
    #   期待: 403（権限なし）
    def test_team_calendar_get_without_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 班員カレンダーAPIを呼ぶ
        response = self.client.get('/api/team_calendar/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】班員カレンダーの基準日をセッションに保存できること
    #   前提: なし
    #   操作: POST /api/team_calendar/ に day="2026-04-05" を送る
    #   期待: 200
    def test_team_calendar_post(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示したい週に含まれる日付
        data = {'day': '2026-04-05'}
        # 操作: 班員カレンダーの基準日設定APIを呼ぶ
        response = self.client.post('/api/team_calendar/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員カレンダーを1週間後に進められること
    #   前提: セッションの就業日が 2026-04-01
    #   操作: POST /api/team_calendar_week_jump/ に week="A" を送る
    #   期待: 200（セッションの就業日が7日後になる）
    def test_team_calendar_week_jump_forward(self):
        # 準備: 権限ありの管理者ユーザーでログインし、セッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        # 準備: week="A" は「次の週へ」（+7日）
        data = {'week': 'A'}
        # 操作: 週移動APIを呼ぶ
        response = self.client.post('/api/team_calendar_week_jump/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員カレンダーを1週間前に戻せること
    #   前提: セッションの就業日が 2026-04-01
    #   操作: POST /api/team_calendar_week_jump/ に week="B" を送る
    #   期待: 200（セッションの就業日が7日前になる）
    def test_team_calendar_week_jump_backward(self):
        # 準備: 権限ありの管理者ユーザーでログインし、セッションの就業日を 2026-04-01 にする
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        # 準備: week="B" は「前の週へ」（−7日）
        data = {'week': 'B'}
        # 操作: 週移動APIを呼ぶ
        response = self.client.post('/api/team_calendar_week_jump/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員の残業管理画面用データを取得できること
    #   前提: 管理者ユーザー（権限あり）の班に 99999 が登録されている
    #   操作: GET /api/team_overtime/
    #   期待: 200 が返り、kosu_data（表示月の班員の工数）と member_name_list が含まれる
    def test_team_overtime_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員残業管理APIを呼ぶ（セッションに年月が無ければ今日の年月が対象）
        response = self.client.get('/api/team_overtime/')
        # 検証: 200 で、工数と班員名リストのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    # 【テスト】未ログインで班員残業管理APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/team_overtime/
    #   期待: 401（未ログイン）
    def test_team_overtime_get_without_login(self):
        # 操作: ログインせずに班員残業管理APIを呼ぶ
        response = self.client.get('/api/team_overtime/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】権限なしのユーザーは班員残業管理APIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/team_overtime/
    #   期待: 403（権限なし）
    def test_team_overtime_get_without_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 班員残業管理APIを呼ぶ
        response = self.client.get('/api/team_overtime/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】班員残業管理の表示年月をセッションに保存できること
    #   前提: なし
    #   操作: POST /api/team_overtime/ に year=2026・month=4 を送る
    #   期待: 200
    def test_team_overtime_post(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示したい年月
        data = {'year': 2026, 'month': 4}
        # 操作: 表示年月の設定APIを呼ぶ
        response = self.client.post('/api/team_overtime/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】ショップ単位の工数入力状況データを取得できること
    #   前提: 管理者ユーザー（権限あり・ショップP）でログイン済み
    #   操作: GET /api/team_view/
    #   期待: 200 が返り、kosu_data と member_name_list（ショップの人員。問い合わせ担当者は除く）が含まれる
    def test_team_view_get(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数入力状況APIを呼ぶ（表示ショップはセッションの値、無ければログイン者のショップ）
        response = self.client.get('/api/team_view/')
        # 検証: 200 で、工数と人員名リストのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    # 【テスト】未ログインで工数入力状況APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/team_view/
    #   期待: 401（未ログイン）
    def test_team_view_get_without_login(self):
        # 操作: ログインせずに工数入力状況APIを呼ぶ
        response = self.client.get('/api/team_view/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】権限なしのユーザーは工数入力状況APIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/team_view/
    #   期待: 403（権限なし）
    def test_team_view_get_without_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 工数入力状況APIを呼ぶ
        response = self.client.get('/api/team_view/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】工数入力状況の表示年月をセッションに保存できること
    #   前提: なし
    #   操作: POST /api/team_view/ に year=2026・month=4 を送る
    #   期待: 200
    def test_team_view_post(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示したい年月
        data = {'year': 2026, 'month': 4}
        # 操作: 表示年月の設定APIを呼ぶ
        response = self.client.post('/api/team_view/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数入力状況で表示するショップをセッションに保存できること
    #   前提: なし
    #   操作: POST /api/team_shop_select/ に shop_default="P" を送る
    #   期待: 200
    def test_team_shop_select_post(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 表示したいショップ
        data = {'shop_default': 'P'}
        # 操作: 表示ショップの設定APIを呼ぶ
        response = self.client.post('/api/team_shop_select/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】ショップ・年月を指定して工数入力状況を Excel ファイルで出力できること
    #   前提: ショップ P に人員 12345・99999 がいる
    #   操作: POST /api/team_export/ に year=2026・month=4・shop2="P" を送る
    #   期待: 200 が返り、Content-Type（返すデータの種類）が Excel（.xlsx）形式
    def test_team_export_post(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 出力する年・月・ショップ
        data = {'year': 2026, 'month': 4, 'shop2': 'P'}
        # 操作: Excel出力APIを呼ぶ（人員ごとに1シートの Excel が返る）
        response = self.client.post('/api/team_export/', data, format='json')
        # 検証: 200 で、レスポンスヘッダーの Content-Type が .xlsx の MIME タイプ
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    # 【テスト】班員工数一覧を就業日（日単位）と班員で絞り込めること
    #   前提: 班員 99999 の 2026-04-01 の工数データがある
    #   操作: GET /api/team_list/?day=2026-04-01&filter=true&mode=day&member_id=99999
    #   期待: 200
    def test_team_list_with_filters(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 日付・日単位モード・班員の従業員番号を指定して一覧を取得
        response = self.client.get('/api/team_list/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day',
            'member_id': '99999'
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員工数一覧を月単位で絞り込めること
    #   前提: 班員 99999 の 2026-04-01 の工数データがある
    #   操作: GET /api/team_list/?day=2026-04&filter=true&mode=month
    #   期待: 200
    def test_team_list_month_filter(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: "YYYY-MM" と月単位モードを指定して一覧を取得（就業日の先頭7文字で一致を見る）
        response = self.client.get('/api/team_list/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month'
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員15枠すべてとフォロー設定をまとめて登録できること
    #   前提: 管理者ユーザーの班員データが存在する
    #   操作: member1〜member15（1人目だけ 99999、他は空）と follow=False を POST /api/team_new/
    #   期待: 200
    def test_team_new_post_with_all_members(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 班員は最大15人。空文字の枠は「未登録」として扱われる
        data = {
            'member1': '99999', 'member2': '', 'member3': '',
            'member4': '', 'member5': '', 'member6': '',
            'member7': '', 'member8': '', 'member9': '',
            'member10': '', 'member11': '', 'member12': '',
            'member13': '', 'member14': '', 'member15': '',
            'follow': False
        }
        # 操作: 班員登録APIを呼ぶ
        response = self.client.post('/api/team_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】組長以上のショップのユーザーは、班員の選択肢に全ショップの人員が出ること
    #   前提: 管理者ユーザーのショップを「組長以上(P,R,T,その他)」に変更
    #   操作: GET /api/team_new/
    #   期待: 200（組長以上は全人員、それ以外は自分と同じショップの人員だけが選択肢になる。中身は未確認）
    def test_team_new_get_kumichou_shop(self):
        """Test team_new GET with kumichou shop shows all members."""
        # 準備: ログイン者のショップを組長以上に変更して保存
        self.member.shop = '組長以上(P,R,T,その他)'
        self.member.save()
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員登録画面用APIを呼ぶ
        response = self.client.get('/api/team_new/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】班員データが無いと班員カレンダーを表示できないこと
    #   前提: 管理者ユーザーの班員データを削除済み
    #   操作: GET /api/team_calendar/
    #   期待: 400（「班員情報を登録してください」エラー）
    def test_team_calendar_no_team_data(self):
        """Test team_calendar when no team data exists."""
        # 準備: setUp で作った班員データを削除し、管理者ユーザーでログイン
        self.team.delete()
        self.login_as_admin()
        # 操作: 班員カレンダーAPIを呼ぶ
        response = self.client.get('/api/team_calendar/')
        # 検証: 400（班員未登録）
        self.assertEqual(response.status_code, 400)

    # 【テスト】班員データが無いと班員残業管理を表示できないこと
    #   前提: 管理者ユーザーの班員データを削除済み
    #   操作: GET /api/team_overtime/
    #   期待: 400（「班員情報を登録してください」エラー）
    def test_team_overtime_no_team_data(self):
        # 準備: 班員データを削除し、管理者ユーザーでログイン
        self.team.delete()
        self.login_as_admin()
        # 操作: 班員残業管理APIを呼ぶ
        response = self.client.get('/api/team_overtime/')
        # 検証: 400（班員未登録）
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 20. TestMainViewsExtended: 管理者・ヘルプ・メニュー関連APIのテスト（追加ケース）
#   対象 : /api/manager_loading/, /api/manager_kosu_update/<ID>/, /api/manager_kosu/,
#          /api/web_console_log/, /api/help/, /api/manager_history/, /api/manager_task/,
#          /api/team_menu/（main_views.py）
#   内容 : 管理者による任意の工数データの取得・更新・削除、一覧の各種絞り込み、
#          ログ表示、ヘルプ（データ初期化）、班員メニューのフォロー通知を確認する。
#   準備 : 管理者ユーザー 12345 の 2026-04-01 の工数データを作成する
# ---------------------------------------------------------------------------
class TestMainViewsExtended(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、工数データを1件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01・1直・出勤・作業内容すべて未入力の工数データ
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    # 【テスト】管理者はバックアップ/読み込み画面用のデータを取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/manager_loading/
    #   期待: 200 が返り、login_data（ログイン者）が含まれる
    def test_administrator_loading_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者のデータ読み込み画面用APIを呼ぶ
        response = self.client.get('/api/manager_loading/')
        # 検証: 200 で、login_data がある
        self.assertEqual(response.status_code, 200)
        self.assertIn('login_data', response.data)

    # 【テスト】管理者権限なしのユーザーは読み込み画面用APIを呼べないこと
    #   前提: 一般ユーザーでログイン済み
    #   操作: GET /api/manager_loading/
    #   期待: 403（権限なし）
    def test_administrator_loading_non_admin(self):
        # 準備: 一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 読み込み画面用APIを呼ぶ
        response = self.client.get('/api/manager_loading/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】未ログインで読み込み画面用APIを呼ぶと 401 になること
    #   前提: ログインしていない
    #   操作: GET /api/manager_loading/
    #   期待: 401（未ログイン）
    def test_administrator_loading_no_login(self):
        # 操作: ログインせずに読み込み画面用APIを呼ぶ
        response = self.client.get('/api/manager_loading/')
        # 検証: 401（未ログイン）
        self.assertEqual(response.status_code, 401)

    # 【テスト】管理者は任意の工数データ1件を編集用に取得できること
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: GET /api/manager_kosu_update/<ID>/
    #   期待: 200 が返り、kosu_data・member_data（工数の持ち主）・choices（全工数区分定義）が含まれる
    def test_administrator_kosu_update_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者用の工数編集画面APIを呼ぶ（工数データの就業日・従業員番号がセッションに保存される）
        response = self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        # 検証: 200 で、3種類のデータのキーがある
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_data', response.data)
        self.assertIn('choices', response.data)

    # 【テスト】存在しないIDの工数データは取得できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: GET /api/manager_kosu_update/99999/
    #   期待: 404（見つからない）
    def test_administrator_kosu_update_get_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで管理者用の工数編集画面APIを呼ぶ
        response = self.client.get('/api/manager_kosu_update/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】管理者は工数データを直接更新できること
    #   前提: GET でセッションに就業日 2026-04-01・従業員番号 12345 が保存されている
    #   操作: 同じ従業員番号・就業日で残業30 などを PUT /api/manager_kosu_update/<ID>/
    #   期待: 200
    def test_administrator_kosu_update_put_success(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 先に GET を呼び、セッションに元の就業日（day）と従業員番号（employee_no）を保存する
        #   （PUT はこの値と比べて「就業日・従業員番号を変えたか」を判断する）
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        # 準備: 更新内容（作業内容 time_work は 288マスの文字列をそのまま送る）
        data = {
            'employee_no3': 12345,
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'over_time': 30,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        # 操作: 管理者用の工数更新APIを呼ぶ
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】存在しないIDの工数データは更新できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: PUT /api/manager_kosu_update/99999/（中身は空）
    #   期待: 404（見つからない）
    def test_administrator_kosu_update_put_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで管理者用の工数更新APIを呼ぶ
        response = self.client.put('/api/manager_kosu_update/99999/', {}, format='json')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】未登録の従業員番号には工数データを付け替えられないこと
    #   前提: 人員 88888 は存在しない
    #   操作: employee_no3=88888 にして PUT /api/manager_kosu_update/<ID>/
    #   期待: 400（「入力した従業員番号は登録されていません」エラー）
    def test_administrator_kosu_update_put_invalid_employee(self):
        # 準備: 管理者ユーザーでログインし、GET でセッションに元の就業日・従業員番号を保存する
        self.login_as_admin()
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        # 準備: 存在しない従業員番号を指定した更新内容
        data = {
            'employee_no3': 88888,
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'over_time': 0,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        # 操作: 管理者用の工数更新APIを呼ぶ
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 400（従業員番号が未登録）
        self.assertEqual(response.status_code, 400)

    # 【テスト】同じ人の工数データが既にある日には就業日を変更できないこと
    #   前提: 12345 の 2026-04-05 の工数データが別にある
    #   操作: 2026-04-01 の工数データの就業日を 2026-04-05 にして PUT
    #   期待: 400（「入力した就業日には既に工数データがあります」エラー）
    def test_administrator_kosu_update_put_duplicate_day(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 同じ従業員の別の日（2026-04-05）の工数データを作成
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 5), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        # 準備: GET でセッションに元の就業日（2026-04-01）・従業員番号を保存する
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        # 準備: 就業日を既にデータのある 2026-04-05 に変更する内容
        data = {
            'employee_no3': 12345,
            'work_day2': '2026-04-05',
            'tyoku2': '1',
            'over_time': 0,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        # 操作: 管理者用の工数更新APIを呼ぶ
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        # 検証: 就業日を変更し、かつ変更先に同じ人のデータがあるため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】管理者は工数データを削除できること
    #   前提: 2026-04-01 の工数データが存在する
    #   操作: DELETE /api/manager_kosu_update/<ID>/
    #   期待: 200（このAPIは削除成功時に 200 を返す）、DBから消えている
    def test_administrator_kosu_update_delete(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 管理者用の工数削除APIを呼ぶ
        response = self.client.delete(f'/api/manager_kosu_update/{self.kosu.id}/')
        # 検証: 200 で、DBに存在しない
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Business_Time_graph.objects.filter(id=self.kosu.id).exists())

    # 【テスト】存在しないIDの工数データは削除できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: DELETE /api/manager_kosu_update/99999/
    #   期待: 404（見つからない）
    def test_administrator_kosu_update_delete_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで管理者用の工数削除APIを呼ぶ
        response = self.client.delete('/api/manager_kosu_update/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】管理者用の工数一覧をすべての条件で絞り込めること
    #   前提: 2026-04-01 の工数データがある
    #   操作: 就業日・日単位・ショップ・直・就業形態・判定(NG)・従業員番号を指定して GET /api/manager_kosu/
    #   期待: 200
    def test_administrator_kosu_list_filters(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 絞り込み条件を全部指定して一覧を取得（judgement: 'OK' なら OK のみ、それ以外は NG のみ）
        response = self.client.get('/api/manager_kosu/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day',
            'shop': 'P', 'tyoku': '1', 'work': '出勤', 'judgement': 'NG',
            'member': '12345',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者用の工数一覧を月単位で絞り込めること
    #   前提: 2026-04-01 の工数データがある
    #   操作: GET /api/manager_kosu/?day=2026-04&filter=true&mode=month
    #   期待: 200
    def test_administrator_kosu_list_month_filter(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: "YYYY-MM" と月単位モードで一覧を取得
        response = self.client.get('/api/manager_kosu/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者用の工数一覧を工数入力OKのデータだけに絞り込めること
    #   前提: なし
    #   操作: GET /api/manager_kosu/?judgement=OK
    #   期待: 200
    def test_administrator_kosu_list_judgement_ok(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 判定 OK だけを条件にして一覧を取得
        response = self.client.get('/api/manager_kosu/', {
            'judgement': 'OK',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者はサーバーのログファイル（web_console.log）の内容を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/web_console_log/
    #   期待: 200（ログファイルが無い場合も "Log file not found." を 200 で返す）
    def test_web_console_log_view(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ログ表示APIを呼ぶ
        response = self.client.get('/api/web_console_log/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】正しいパスワード付きならヘルプAPIで人員データを初期化できること（ログイン不要）
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help/ に memberReset=True と正しい password を送る
    #   期待: 200 が返り、全人員が削除されて初期管理者 12345「admin」の1件だけになる
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_post_member_reset(self):
        """Test Help endpoint with member reset."""
        # 準備: 人員データだけを初期化する指定と、正しいヘルプ用パスワード
        data = {'memberReset': True, 'password': 'test-help-pass'}
        # 操作: ヘルプ（データ初期化）APIを呼ぶ（AllowAny のため未ログインでも呼べる）
        response = self.client.post('/api/help/', data, format='json')
        # 検証: 200（成功）で、人員データが初期管理者 admin の1件だけになっている
        self.assertEqual(response.status_code, 200)
        self.assertEqual(member.objects.count(), 1)
        self.assertTrue(member.objects.filter(employee_no=12345, name='admin').exists())

    # 【テスト】初期化の指定がすべて False ならヘルプAPIは何もせず成功すること
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help/ に memberReset / defReset / settingReset をすべて False、正しい password を送る
    #   期待: 200
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_post_no_reset(self):
        # 準備: 人員・工数区分定義・管理者設定のどれも初期化しない指定と、正しいヘルプ用パスワード
        data = {'memberReset': False, 'defReset': False, 'settingReset': False, 'password': 'test-help-pass'}
        # 操作: ヘルプAPIを呼ぶ
        response = self.client.post('/api/help/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】パスワードなしではヘルプAPIでデータを初期化できないこと
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help/ に memberReset / defReset / settingReset=True だけを送る（password なし）
    #   期待: 403（権限なし）が返り、人員・工数区分定義・管理者設定はどれも削除されない
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_post_without_password_forbidden(self):
        # 準備: 3種類すべてを初期化する指定（パスワードは付けない）
        data = {'memberReset': True, 'defReset': True, 'settingReset': True}
        # 操作: 画面のパスワード認証を通さず、ヘルプAPIを直接呼ぶ
        response = self.client.post('/api/help/', data, format='json')
        # 検証: 403 で、BaseTestCase で作った既存データが残っている
        self.assertEqual(response.status_code, 403)
        self.assertTrue(member.objects.filter(employee_no=12345, name='テスト太郎').exists())
        self.assertTrue(member.objects.filter(employee_no=99999).exists())
        self.assertTrue(kosu_division.objects.filter(kosu_name='TestVer').exists())
        self.assertTrue(administrator_data.objects.filter(id=self.admin_settings.id).exists())

    # 【テスト】間違ったパスワードではヘルプAPIでデータを初期化できないこと
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help/ に memberReset=True と間違った password を送る
    #   期待: 403（権限なし）が返り、人員データは削除されない
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_post_wrong_password_forbidden(self):
        # 準備: 人員データを初期化する指定と、間違ったパスワード
        data = {'memberReset': True, 'password': 'wrong-pass'}
        # 操作: ヘルプAPIを呼ぶ
        response = self.client.post('/api/help/', data, format='json')
        # 検証: 403 で、既存の人員データ（12345 テスト太郎）が残っている
        self.assertEqual(response.status_code, 403)
        self.assertTrue(member.objects.filter(employee_no=12345, name='テスト太郎').exists())

    # 【テスト】ヘルプ画面のパスワード判定APIは、正しいパスワードなら True を返すこと（ログイン不要）
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help_pass/ に正しい password を送る
    #   期待: 200 で、応答本文が True
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_pass_correct_password(self):
        # 操作: 正しいパスワードでパスワード判定APIを呼ぶ
        response = self.client.post('/api/help_pass/', {'password': 'test-help-pass'}, format='json')
        # 検証: 200 で True が返る
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data, True)

    # 【テスト】ヘルプ画面のパスワード判定APIは、間違ったパスワードなら 403 と False を返すこと
    #   前提: ログインしていない。ヘルプ用パスワード（環境変数 HELP_PATH）は 'test-help-pass'
    #   操作: POST /api/help_pass/ に間違った password を送る
    #   期待: 403 で、応答本文が False
    @patch.dict(os.environ, {'HELP_PATH': 'test-help-pass'})
    def test_help_pass_wrong_password(self):
        # 操作: 間違ったパスワードでパスワード判定APIを呼ぶ
        response = self.client.post('/api/help_pass/', {'password': 'wrong-pass'}, format='json')
        # 検証: 403 で False が返る
        self.assertEqual(response.status_code, 403)
        self.assertIs(response.data, False)

    # 【テスト】操作履歴の一覧をすべての条件で絞り込めること
    #   前提: 操作者 12345 の member テーブルの操作履歴がある
    #   操作: 今日の日付・日単位・レコードID・テーブル名・操作者No を指定して GET /api/manager_history/
    #   期待: 200
    def test_administrator_history_filters(self):
        # 準備: 管理者ユーザーでログインし、操作者 No を記録した操作履歴を作成
        self.login_as_admin()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={}, login_No='12345'
        )
        # 操作: 絞り込み条件を全部指定して一覧を取得（操作日時は自動で今日になるため day に今日を指定）
        response = self.client.get('/api/manager_history/', {
            'day': str(date.today()), 'mode': 'day',
            'record_id': '1', 'table_name': 'member', 'login_No': '12345'
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】操作履歴の一覧を月単位で絞り込めること
    #   前提: 操作履歴がある
    #   操作: 今月（"YYYY-MM"）・月単位を指定して GET /api/manager_history/
    #   期待: 200
    def test_administrator_history_month_filter(self):
        # 準備: 管理者ユーザーでログインし、操作履歴を作成
        self.login_as_admin()
        History.objects.create(
            operation='UPDATE', table_name='member',
            record_id=2, changes={}
        )
        # 操作: str(date.today())[:7] で今日の日付文字列の先頭7文字（"YYYY-MM"）を取り出して指定
        response = self.client.get('/api/manager_history/', {
            'day': str(date.today())[:7], 'mode': 'month',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】非同期タスク記録の一覧を日単位で絞り込めること
    #   前提: 今日作成したタスク記録がある
    #   操作: 今日の日付・日単位を指定して GET /api/manager_task/
    #   期待: 200
    def test_administrator_task_day_filter(self):
        # 準備: 管理者ユーザーでログインし、タスク記録を作成（作成日時は自動で今日）
        self.login_as_admin()
        AsyncTask.objects.create(task_id='tf1', status='success')
        # 操作: 今日の日付で絞り込んで一覧を取得
        response = self.client.get('/api/manager_task/', {
            'day': str(date.today()), 'mode': 'day',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】非同期タスク記録の一覧を月単位で絞り込めること
    #   前提: 今日作成したタスク記録がある
    #   操作: 今月（"YYYY-MM"）・月単位を指定して GET /api/manager_task/
    #   期待: 200
    def test_administrator_task_month_filter(self):
        # 準備: 管理者ユーザーでログインし、タスク記録を作成
        self.login_as_admin()
        AsyncTask.objects.create(task_id='tf2', status='success')
        # 操作: 今月で絞り込んで一覧を取得
        response = self.client.get('/api/manager_task/', {
            'day': str(date.today())[:7], 'mode': 'month',
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】フォローONの班員に工数未入力（または入力NG）の日があると通知メッセージが返ること
    #   前提: 12345 の班（メンバー1=99999・フォローON）。99999 の昨日の工数データは判定NG
    #   操作: GET /api/team_menu/
    #   期待: 200 が返り、follow_message_list（通知メッセージのリスト）が含まれる
    def test_team_menu_with_follow(self):
        """Test team_menu with follow enabled and team data."""
        # 準備: フォローONの班員データを作成（このクラスの setUp では班員データを作っていない）
        team_member.objects.create(
            employee_no5=12345, member1='99999', follow=True
        )
        # 準備: 班員 99999 の昨日の工数データを判定NG（judgement=False）で作成
        #   班員メニューAPIは過去7日分を新しい日から調べ、データが無いかNGの日があれば通知を作る
        Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date.today() - timedelta(days=1),
            tyoku2='1', over_time=0, judgement=False,
        )
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 班員メニューAPIを呼ぶ
        response = self.client.get('/api/team_menu/')
        # 検証: 200 で、通知メッセージのリストのキーがある（中身の件数は確認していない）
        self.assertEqual(response.status_code, 200)
        self.assertIn('follow_message_list', response.data)


# ---------------------------------------------------------------------------
# 21. TestInquiryViewsExtended: 問い合わせAPIのテスト（追加ケース）
#   対象 : /api/inquir_list/, /api/inquir_detail/<ID>/, /api/inquir_new/, /api/inquir_update/<ID>/
#   内容 : 一覧の絞り込み、ポップアップ通知（新着・編集・回答のお知らせ）の作成と既読時の消去、
#          編集権限のチェック、前後の問い合わせIDの取得を確認する。
#   前提知識: ポップアップ通知は member / administrator_data の pop_up1〜5（文言）と
#             pop_up_id1〜5（問い合わせID）に保存される。空いている枠の先頭から使う。
#   準備 : 管理者ユーザー 12345 を「問い合わせ担当者1」に設定する
# ---------------------------------------------------------------------------
class TestInquiryViewsExtended(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、管理者ユーザーを問い合わせ担当者にする
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 管理者設定の問い合わせ担当者1 に 12345 を設定して保存
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    # 【テスト】問い合わせ一覧を内容区分と従業員番号で絞り込めること
    #   前提: 12345 の「要望」の問い合わせがある
    #   操作: GET /api/inquir_list/?item=要望&member_id=12345
    #   期待: 200
    def test_inquir_list_with_filters(self):
        # 準備: 管理者ユーザーでログインし、問い合わせを1件作成
        self.login_as_admin()
        inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Filter test', answer=''
        )
        # 操作: item（内容区分の完全一致）と member_id（従業員番号の部分一致）で絞り込んで取得
        response = self.client.get('/api/inquir_list/', {
            'item': '要望', 'member_id': '12345'
        })
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】問い合わせ担当者が詳細を開くと、その問い合わせの管理者側ポップアップが消えること
    #   前提: 管理者設定の pop_up1 / pop_up_id1 にこの問い合わせの通知が入っている。
    #         ログイン者 12345 は問い合わせ担当者1
    #   操作: GET /api/inquir_detail/<ID>/
    #   期待: 200 が返り、管理者設定の pop_up1 が空（'' または None）になる
    def test_inquir_detail_clears_popup(self):
        """Test that viewing detail clears admin popup."""
        # 準備: 問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Popup test', answer=''
        )
        # 準備: 管理者設定の1枠目に、この問い合わせのポップアップ通知を入れて保存
        self.admin_settings.pop_up1 = 'test popup'
        self.admin_settings.pop_up_id1 = str(inq.id)
        self.admin_settings.save()
        # 準備: 問い合わせ担当者である管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 問い合わせ詳細APIを呼ぶ（既読扱いになる）
        response = self.client.get(f'/api/inquir_detail/{inq.id}/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: DBから管理者設定を読み直す
        self.admin_settings.refresh_from_db()
        # 検証: 通知を消した後は後ろの枠が前に詰められるため、pop_up1 は '' か None になる（どちらも偽として判定）
        self.assertFalse(self.admin_settings.pop_up1)

    # 【テスト】問い合わせを新規登録すると、管理者側に新着のポップアップ通知が作られること
    #   前提: 管理者設定のポップアップ枠はすべて空
    #   操作: POST /api/inquir_new/ で「不具合」の問い合わせを登録する
    #   期待: 200 が返り、管理者設定の pop_up1 に「新しい問い合わせ」を含む文言が入る
    def test_inquir_new_popup_write(self):
        """Test that posting new inquiry creates popup."""
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 登録内容
        data = {'content_choice': '不具合', 'inquiry': 'Bug report'}
        # 操作: 問い合わせ登録APIを呼ぶ
        response = self.client.post('/api/inquir_new/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)
        # 検証: 管理者設定を読み直し、1枠目に「{氏名}さんからの新しい問い合わせがあります。」が入っている
        #       （pop_up1 が None の場合でも assertIn が失敗しないよう `or ''` で空文字にしている）
        self.admin_settings.refresh_from_db()
        self.assertIn('新しい問い合わせ', self.admin_settings.pop_up1 or '')

    # 【テスト】質問者本人でも問い合わせ担当者でもない人は問い合わせ編集画面を開けないこと
    #   前提: 質問者は 12345。問い合わせ担当者は未設定に変更。ログイン者は一般ユーザー 99999
    #   操作: GET /api/inquir_update/<ID>/
    #   期待: 403（権限なし）
    def test_inquir_update_access_denied(self):
        """Test non-admin non-owner can't access update."""
        # 準備: 12345 を質問者とする問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Access test', answer=''
        )
        # 準備: 問い合わせ担当者1 を空にして保存（担当者が誰もいない状態）
        self.admin_settings.administrator_employee_no1 = ''
        self.admin_settings.save()
        # 準備: 質問者ではない一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 問い合わせ編集画面用APIを呼ぶ
        response = self.client.get(f'/api/inquir_update/{inq.id}/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】回答を書き込む更新ができること（回答の変更時は質問者へのポップアップ通知が作られる）
    #   前提: 回答が空の問い合わせがある
    #   操作: 回答だけを変更した内容を PUT /api/inquir_update/<ID>/
    #   期待: 200（通知の中身はこのテストでは確認していない）
    def test_inquir_update_put_with_answer_change(self):
        """Test that changing answer creates popup for inquirer."""
        # 準備: 回答が空の問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Answer test', answer=''
        )
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 回答（answer）だけを変更した更新内容
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '要望', 'inquiry': 'Answer test',
            'answer': 'Here is the answer'
        }
        # 操作: 問い合わせ編集APIを呼ぶ
        response = self.client.put(f'/api/inquir_update/{inq.id}/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】内容区分・本文を変更する更新ができること（変更時は管理者側へのポップアップ通知が作られる）
    #   前提: 「要望」・本文「Original」の問い合わせがある
    #   操作: 内容区分を「不具合」・本文を「Changed」に変更して PUT
    #   期待: 200（通知の中身はこのテストでは確認していない）
    def test_inquir_update_put_with_inquiry_change(self):
        """Test that changing inquiry creates admin popup."""
        # 準備: 変更前の問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Original', answer=''
        )
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 内容区分（content_choice）と本文（inquiry）を変更した更新内容
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '不具合', 'inquiry': 'Changed',
            'answer': ''
        }
        # 操作: 問い合わせ編集APIを呼ぶ
        response = self.client.put(f'/api/inquir_update/{inq.id}/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】問い合わせ詳細で「次」「前」の問い合わせIDが正しく返ること
    #   前提: 問い合わせが2件（inq1 → inq2 の順に作成）
    #   操作: 1件目の詳細 GET /api/inquir_detail/<inq1のID>/
    #   期待: next_id が inq2 のID、before_id が None（1件目より前は無い）
    def test_inquir_detail_pagination(self):
        """Test next and before record navigation."""
        # 準備: 問い合わせを2件作成（IDは作成順に大きくなる）
        inq1 = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='First', answer=''
        )
        inq2 = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Second', answer=''
        )
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 1件目の問い合わせ詳細APIを呼ぶ
        response = self.client.get(f'/api/inquir_detail/{inq1.id}/')
        # 検証: 200 で、次のID = 2件目、前のID = なし
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['next_id'], inq2.id)
        self.assertIsNone(response.data['before_id'])


# ---------------------------------------------------------------------------
# 22. TestAsyncViews: バックアップ・削除・タスク状況確認・ファイルダウンロードAPIのテスト
#   対象 : asynchronous_views.py
#            backup            : /api/{kosu,def,member,team,choice,inquiry,setting}_backup/ などの共通処理
#            check_task_status : GET /api/check_backup_status（末尾スラッシュなし）
#            download_file     : GET /api/download_backup（末尾スラッシュなし）
#   内容 : 非同期タスクの状態に応じた応答、各種バックアップ/削除の受け付けと日付チェックを確認する。
#          test_settings.py の TESTING=True により、バックアップ処理はその場で同期実行される。
#   注意 :
#     - setUp で super().setUp() を呼んでいないため、BaseTestCase のデータ（人員 12345 など）は作られず、
#       self.client も APIClient ではなく Django 標準の Client のままになる。
#       （Django 標準の Client.post には format 引数が無いため format='json' は無視され、
#         データはフォーム形式（multipart）で送られる。backup はこの形式も受け付ける）
#     - 各テストの login_as_admin() は人員 12345 が存在しないため失敗する（400）が、
#       setUp でセッションに 11111 を直接入れてあるため、11111 の管理者としてAPIが呼ばれる。
#     - バックアップ系のテストは MEDIA_ROOT を差し替えないため、リポジトリの media/ にExcelが作成される。
# ---------------------------------------------------------------------------
class TestAsyncViews(BaseTestCase):
    # 各テストの前に: 管理者の人員 11111 を作成し、セッションに直接ログイン情報を書き込む
    #   （ログインAPIは使わず、セッションに login_No を直接書き込んでログイン状態を作る）
    def setUp(self):  
        # テスト用の管理者（権限・管理者権限あり）を作成する
        self.test_member = member.objects.create(  
            employee_no='11111',  
            administrator=True,  
            authority=True,  
        )  
        # LoginNoAuthentication（permissions.py）が参照するセッション値 login_No を設定して保存する
        #   これで以降のリクエストは 11111 がログインしている状態として扱われる
        session = self.client.session  
        session['login_No'] = '11111'  
        session.save()

    # 【テスト】成功したタスクの状況確認で、結果ファイルの名前（フォルダの場所は除く）が返ること
    #   前提: タスクID「test-check-1」・状態 success・結果 "/path/to/file.xlsx" のタスク記録がある
    #   操作: GET /api/check_backup_status?task_id=test-check-1
    #   期待: 200 が返り、本文の status が "success"、file_path が "file.xlsx"
    def test_check_task_status_success(self):
        # 準備: 成功済みのタスク記録を作成（result には作成したファイルのパスが入る）
        AsyncTask.objects.create(
            task_id='test-check-1', status='success', result='/path/to/file.xlsx')
        # 操作: タスク状況確認APIを呼ぶ
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-1'})
        # 検証: 200 で、本文（JSON）の状態とファイル名が正しい
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['file_path'], 'file.xlsx')

    # 【テスト】失敗したタスクの状況確認で、状態 "error" が返ること
    #   前提: 状態 error のタスク記録がある
    #   操作: GET /api/check_backup_status?task_id=test-check-2
    #   期待: 200 が返り、本文の status が "error"（HTTPステータスはエラー時も 200）
    def test_check_task_status_error(self):
        # 準備: 失敗したタスク記録を作成（result にはエラー内容が入る）
        AsyncTask.objects.create(
            task_id='test-check-2', status='error', result='Something went wrong')
        # 操作: タスク状況確認APIを呼ぶ
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-2'})
        # 検証: HTTPステータスは 200、本文の状態が error
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'error')

    # 【テスト】処理中のタスクの状況確認で 202 が返ること
    #   前提: 状態 pending のタスク記録がある
    #   操作: GET /api/check_backup_status?task_id=test-check-3
    #   期待: 202（Accepted＝受け付け済み・処理中）が返り、本文の status が "pending"
    def test_check_task_status_pending(self):
        # 準備: 処理中のタスク記録を作成
        AsyncTask.objects.create(task_id='test-check-3', status='pending')
        # 操作: タスク状況確認APIを呼ぶ
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-3'})
        # 検証: 202 で、本文の状態が pending（画面側はこの間、状況確認を繰り返す）
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data['status'], 'pending')

    # 【テスト】タスクIDを指定しないと状況確認できないこと
    #   前提: なし
    #   操作: GET /api/check_backup_status（task_id なし）
    #   期待: 400（「タスクIDが指定されていません」エラー）
    def test_check_task_status_no_id(self):
        # 操作: タスクIDなしでタスク状況確認APIを呼ぶ
        response = self.client.get('/api/check_backup_status')
        # 検証: 400（タスクID未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】存在しないタスクIDでは状況確認できないこと
    #   前提: タスクID「nonexistent」の記録は無い
    #   操作: GET /api/check_backup_status?task_id=nonexistent
    #   期待: 400（「無効なタスクIDです」エラー）
    def test_check_task_status_invalid_id(self):
        # 操作: 存在しないタスクIDでタスク状況確認APIを呼ぶ
        response = self.client.get('/api/check_backup_status', {'task_id': 'nonexistent'})
        # 検証: 400（無効なタスクID）
        self.assertEqual(response.status_code, 400)

    # 【テスト】media フォルダの中のファイルを、ファイル名でダウンロードでき、送った後に消えること
    #   前提: media フォルダ（テストでは一時フォルダ。test_settings.py の MEDIA_ROOT）に .xlsx ファイルがある
    #   操作: GET /api/download_backup?file_path=<ファイル名>
    #   期待: 200 で中身が返り、読み終わるとファイルが消える
    def test_download_file(self):
        # 準備: media フォルダに中身 "test content" のファイルを作る
        from django.conf import settings
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        file_path = os.path.join(settings.MEDIA_ROOT, 'test_download.xlsx')
        with open(file_path, 'wb') as f:
            f.write(b'test content')
        # 操作: ファイルダウンロードAPIを呼ぶ（ファイル名だけを渡す）
        response = self.client.get('/api/download_backup', {'file_path': 'test_download.xlsx'})
        # 検証: 200（成功）で中身が返り、読み終わるとファイルが消える
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), b'test content')
        self.assertFalse(os.path.exists(file_path))

    # 【テスト】工数区分定義のバックアップを受け付け、タスクIDが返ること
    #   前提: 管理者 11111 としてログイン済み（setUp のセッション）
    #   操作: POST /api/def_backup/
    #   期待: 200 が返り、本文に task_id が含まれる
    def test_backup_def_backup(self):
        # 準備: login_as_admin は失敗するが、setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 工数区分定義バックアップAPIを呼ぶ（テスト時はその場で Excel 作成まで実行される）
        response = self.client.post('/api/def_backup/', {}, format='json')
        # 検証: 200 で、状況確認に使う task_id が返る
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('task_id', data)

    # 【テスト】人員データのバックアップを受け付け、タスクIDが返ること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/member_backup/
    #   期待: 200 が返り、本文に task_id が含まれる
    def test_backup_member_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 人員バックアップAPIを呼ぶ
        response = self.client.post('/api/member_backup/', {}, format='json')
        # 検証: 200 で、task_id が返る
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('task_id', data)

    # 【テスト】班員データのバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/team_backup/
    #   期待: 200
    def test_backup_team_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 班員バックアップAPIを呼ぶ
        response = self.client.post('/api/team_backup/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】作業詳細選択肢のバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/choice_backup/
    #   期待: 200
    def test_backup_choice_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 作業詳細選択肢バックアップAPIを呼ぶ
        response = self.client.post('/api/choice_backup/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】問い合わせデータのバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/inquiry_backup/
    #   期待: 200
    def test_backup_inquiry_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 問い合わせバックアップAPIを呼ぶ
        response = self.client.post('/api/inquiry_backup/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】管理者設定のバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/setting_backup/
    #   期待: 200
    def test_backup_setting_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 管理者設定バックアップAPIを呼ぶ
        response = self.client.post('/api/setting_backup/', {}, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数データのバックアップは期間を指定しないと受け付けないこと
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/kosu_backup/（start_day / end_day なし）
    #   期待: 400（「日付を指定してください」エラー）
    def test_backup_kosu_backup_no_dates(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 操作: 期間なしで工数バックアップAPIを呼ぶ
        response = self.client.post('/api/kosu_backup/', {}, format='json')
        # 検証: 400（期間未指定）
        self.assertEqual(response.status_code, 400)

    # 【テスト】正しい期間（過去の日付・開始 ≦ 終了）なら工数データのバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/kosu_backup/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200
    def test_backup_kosu_backup_with_valid_dates(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（変数名は yesterday / day_before だが、実際の値は 2日前 / 3日前）
        #   終了日は「今日より前」である必要があるため、実行日に関係なく通る過去の日付にしている
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: 工数バックアップAPIを呼ぶ
        response = self.client.post('/api/kosu_backup/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】正しい期間なら工数データの一括削除を受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/kosu_delet/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200（その期間の工数データを削除する。このテストでは対象データは無い）
    def test_backup_kosu_delet_with_valid_dates(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（2日前 / 3日前）
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: 工数データ削除APIを呼ぶ
        response = self.client.post('/api/kosu_delet/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】終了日が今日以降だと工数データのバックアップを受け付けないこと
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/kosu_backup/ に 開始=今日・終了=明日 を送る
    #   期待: 400（「昨日の日付までしか指定できません」エラー）
    def test_backup_kosu_backup_future_date_error(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 終了日が明日の期間
        tomorrow = str(date.today() + timedelta(days=1))
        data = {'start_day': str(date.today()), 'end_day': tomorrow}
        # 操作: 工数バックアップAPIを呼ぶ
        response = self.client.post('/api/kosu_backup/', data, format='json')
        # 検証: 400（終了日が今日以降）
        self.assertEqual(response.status_code, 400)

    # 【テスト】開始日が終了日より後だと工数データのバックアップを受け付けないこと
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/kosu_backup/ に 開始=1日前・終了=3日前 を送る
    #   期待: 400（「開始日が終了日を超えています」エラー）
    def test_backup_kosu_backup_start_after_end_error(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 開始日（昨日）が終了日（3日前）より後の期間
        data = {
            'start_day': str(date.today() - timedelta(days=1)),
            'end_day': str(date.today() - timedelta(days=3)),
        }
        # 操作: 工数バックアップAPIを呼ぶ
        response = self.client.post('/api/kosu_backup/', data, format='json')
        # 検証: 400（開始日 > 終了日）
        self.assertEqual(response.status_code, 400)

    # 【テスト】正しい期間なら非同期タスク記録のバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/AsyncTask_backup/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200
    def test_backup_asynctask_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（2日前 / 3日前）
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: タスク履歴バックアップAPIを呼ぶ
        response = self.client.post('/api/AsyncTask_backup/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】正しい期間なら非同期タスク記録の一括削除を受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/AsyncTask_delet/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200
    def test_backup_asynctask_delet(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（2日前 / 3日前）
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: タスク履歴削除APIを呼ぶ
        response = self.client.post('/api/AsyncTask_delet/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】正しい期間なら操作履歴のバックアップを受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/History_backup/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200
    def test_backup_history_backup(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（2日前 / 3日前）
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: 操作履歴バックアップAPIを呼ぶ
        response = self.client.post('/api/History_backup/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】正しい期間なら操作履歴の一括削除を受け付けること
    #   前提: 管理者 11111 としてログイン済み
    #   操作: POST /api/History_delet/ に 開始=3日前・終了=2日前 を送る
    #   期待: 200
    def test_backup_history_delet(self):
        # 準備: setUp のセッション（11111）でログイン済みの扱い
        self.login_as_admin()
        # 準備: 期間（2日前 / 3日前）
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        # 操作: 操作履歴削除APIを呼ぶ
        response = self.client.post('/api/History_delet/', data, format='json')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 23. TestDefViewsExtended: 工数区分定義APIのテスト（追加ケース）
#   対象 : /api/def_list/, /api/def_search/, /api/def_update/<ID>/, /api/def_ver/（def_views.py）
#   内容 : 定義Ver名の重複による更新エラー、使用Ver未指定のエラーなどを確認する。
# ---------------------------------------------------------------------------
class TestDefViewsExtended(BaseTestCase):
    # 【テスト】工数区分定義の一覧を取得できること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/def_list/（テスト名に search とあるが、検索条件は送っていない）
    #   期待: 200
    def test_def_list_with_search(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 工数区分定義一覧APIを呼ぶ
        response = self.client.get('/api/def_list/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】工数区分定義確認APIに検索パラメータを付けても正常に応答すること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: GET /api/def_search/?search=Test
    #   期待: 200（このAPIは search パラメータを参照せず、セッションの使用Verの定義を返す）
    def test_def_search_filters(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: search パラメータ付きで工数区分定義確認APIを呼ぶ
        response = self.client.get('/api/def_search/', {'search': 'Test'})
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】他の定義と同じ定義Ver名には変更できないこと
    #   前提: 定義Ver「TestVer」と「DupVer」が存在する
    #   操作: TestVer の定義Ver名を「DupVer」にして PUT /api/def_update/<ID>/
    #   期待: 400（「すでに登録されています」エラー）
    def test_def_update_put_duplicate_name(self):
        # 準備: 管理者ユーザーでログインし、重複相手となる定義Ver「DupVer」を作成
        self.login_as_admin()
        kosu_division.objects.create(kosu_name='DupVer', kosu_title_1='XX')
        # 準備: 既存の DupVer と同じ名前に変更する内容
        data = {'kosu_name': 'DupVer', 'kosu_title_1': 'YY'}
        # 操作: TestVer の工数区分定義編集APIを呼ぶ
        response = self.client.put(
            f'/api/def_update/{self.division.id}/', data, format='json')
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】使用Verを空で指定すると切り替えできないこと
    #   前提: なし
    #   操作: POST /api/def_ver/ に versionchoice="" を送る
    #   期待: 400（"Versionchoice is required." エラー）
    def test_def_ver_post_empty_version(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 空の使用Verで切り替えAPIを呼ぶ
        response = self.client.post(
            '/api/def_ver/', {'versionchoice': ''}, format='json')
        # 検証: 400（未指定）
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 24. TestKosuListFilters: 工数一覧APIの絞り込みテスト
#   対象 : GET /api/kosu_list/（kosu_views.KosuList）
#   内容 : 月単位・日単位の絞り込みで、該当する件数だけが返ることを確認する。
#   準備 : 管理者ユーザー 12345 の工数データを 2026-04-01 と 2026-04-15 の2件作成する
# ---------------------------------------------------------------------------
class TestKosuListFilters(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、同じ月の別の日の工数データを2件作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 2026-04-01 の工数データ
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        # 2026-04-15 の工数データ
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 15), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    # 【テスト】月単位の絞り込みで、その月の工数データがすべて返ること
    #   前提: 2026年4月の工数データが2件ある
    #   操作: GET /api/kosu_list/?day=2026-04&filter=true&mode=month
    #   期待: 200 が返り、結果は2件
    def test_kosu_list_month_filter(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: "YYYY-MM" と月単位モードで一覧を取得
        response = self.client.get('/api/kosu_list/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month'
        })
        # 検証: 200 で、4/1 と 4/15 の2件が返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)

    # 【テスト】日単位の絞り込みで、その日の工数データだけが返ること
    #   前提: 2026年4月の工数データが2件ある（4/1 と 4/15）
    #   操作: GET /api/kosu_list/?day=2026-04-01&filter=true&mode=day
    #   期待: 200 が返り、結果は1件
    def test_kosu_list_day_filter(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: "YYYY-MM-DD" と日単位モードで一覧を取得
        response = self.client.get('/api/kosu_list/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day'
        })
        # 検証: 200 で、4/1 の1件だけが返る
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)


# ---------------------------------------------------------------------------
# 25. TestDefViewsMore: 作業詳細選択肢APIのテスト（追加ケース）
#   対象 : /api/def_detail_new/, /api/def_detail_update/<ID>/, /api/def_detail_list/, /api/def_new/（def_views.py）
#   内容 : 作業詳細選択肢の登録画面・編集画面用データの取得、重複チェック、記号での絞り込みを確認する。
# ---------------------------------------------------------------------------
class TestDefViewsMore(BaseTestCase):
    # 【テスト】作業詳細選択肢の登録画面用データ（使用中の工数区分定義）を取得できること
    #   前提: ログイン済み（セッションの使用Verは TestVer）
    #   操作: GET /api/def_detail_new/
    #   期待: 200
    def test_def_detail_new_get(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 作業詳細選択肢の登録画面用APIを呼ぶ
        response = self.client.get('/api/def_detail_new/')
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】作業詳細選択肢の編集画面用データを取得できること
    #   前提: 作業詳細選択肢が1件存在する
    #   操作: GET /api/def_detail_update/<ID>/
    #   期待: 200 が返り、formData（選択肢のデータ）と symbol_list（選べる記号の一覧）が含まれる
    def test_def_detail_update_get(self):
        # 準備: 管理者ユーザーでログインし、選択肢を1件作成
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='A', def_select='GetTest')
        # 操作: 作業詳細選択肢の編集画面用APIを呼ぶ
        response = self.client.get(f'/api/def_detail_update/{choice.id}/')
        # 検証: 200 で、2種類のデータのキーがある
        #   （symbol_list は使用中の定義の工数区分数ぶんの記号＋'$'。TestVer は工数区分1つなので ['A', '$']）
        self.assertEqual(response.status_code, 200)
        self.assertIn('formData', response.data)
        self.assertIn('symbol_list', response.data)

    # 【テスト】存在しないIDの作業詳細選択肢は取得できないこと
    #   前提: ID 99999 の選択肢は存在しない
    #   操作: GET /api/def_detail_update/99999/
    #   期待: 404（見つからない）
    def test_def_detail_update_get_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで編集画面用APIを呼ぶ
        response = self.client.get('/api/def_detail_update/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)

    # 【テスト】他の選択肢と同じ作業詳細には変更できないこと
    #   前提: 作業詳細「Existing」と「Original」の選択肢がある
    #   操作: 「Original」の作業詳細を「Existing」にして PUT /api/def_detail_update/<ID>/
    #   期待: 400（「入力した作業詳細はすでに登録されています」エラー）
    def test_def_detail_update_put_duplicate(self):
        # 準備: 管理者ユーザーでログインし、重複相手と更新対象の2件の選択肢を作成
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='Existing')
        choice = def_choice.objects.create(def_symbol='B', def_select='Original')
        # 準備: 作業詳細を既存の「Existing」に変える内容（作業詳細は記号に関係なく重複不可）
        data = {'def_symbol': 'B', 'def_select': 'Existing'}
        # 操作: 作業詳細選択肢の編集APIを呼ぶ
        response = self.client.put(
            f'/api/def_detail_update/{choice.id}/', data, format='json')
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】既にある作業詳細では選択肢を新規登録できないこと（記号が違っても不可）
    #   前提: 記号「A」・作業詳細「DupSelect」の選択肢がある
    #   操作: 記号「B」・作業詳細「DupSelect」を POST /api/def_detail_new/
    #   期待: 400（「入力した作業詳細はすでに登録されています」エラー）
    def test_def_detail_new_post_duplicate(self):
        # 準備: 管理者ユーザーでログインし、既存の選択肢を作成
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='DupSelect')
        # 準備: 記号は違うが作業詳細が同じ登録内容
        data = {'def_symbol': 'B', 'def_select': 'DupSelect'}
        # 操作: 作業詳細選択肢の登録APIを呼ぶ
        response = self.client.post('/api/def_detail_new/', data, format='json')
        # 検証: 重複のため 400
        self.assertEqual(response.status_code, 400)

    # 【テスト】作業詳細選択肢の一覧を記号で絞り込めること
    #   前提: 記号「A」と「B」の選択肢が1件ずつある
    #   操作: GET /api/def_detail_list/?def_symbol=A
    #   期待: 200（件数はこのテストでは確認していない）
    def test_def_detail_list_with_symbol_filter(self):
        # 準備: 管理者ユーザーでログインし、記号 A・B の選択肢を作成
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='FilterA')
        def_choice.objects.create(def_symbol='B', def_select='FilterB')
        # 操作: 記号 A で絞り込んで一覧を取得
        response = self.client.get('/api/def_detail_list/', {'def_symbol': 'A'})
        # 検証: 200（成功）
        self.assertEqual(response.status_code, 200)

    # 【テスト】定義Ver名だけを指定して工数区分定義を登録できること
    #   前提: 定義Ver名「ValidName」は未登録
    #   操作: kosu_name だけを POST /api/def_new/ で送る
    #   期待: 200（登録成功）
    #   ※テスト名・docstring は「入力チェックで失敗するケース」となっているが、
    #     実際は工数区分名などを省略しても入力チェックを通り、登録に成功することを確認している
    def test_def_new_post_validation_error(self):
        """Test DefNew POST with invalid data that fails validation."""
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: 定義Ver名だけの登録内容（工数区分名・定義などは送らない）
        data = {'kosu_name': 'ValidName'}
        # 操作: 工数区分定義の登録APIを呼ぶ
        response = self.client.post('/api/def_new/', data, format='json')
        # 検証: 200（登録成功）
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 26. TestAsyncViewsMore: バックアップ/読み込みAPIのテスト（追加ケース）
#   対象 : asynchronous_views.backup（validate_dates の日付形式チェック、各 *_load の読み込み受付）
#   内容 : 日付の形式が不正な場合と、読み込み（復元）APIにファイルを付けずに呼んだ場合のエラーを確認する。
#   ※こちらは BaseTestCase の setUp をそのまま使うため、APIClient と管理者ユーザー 12345 でログインする
# ---------------------------------------------------------------------------
class TestAsyncViewsMore(BaseTestCase):
    # 【テスト】日付として読めない期間を指定するとバックアップを受け付けないこと
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/kosu_backup/ に 開始="bad"・終了="format" を送る
    #   期待: 400（「日付の形式が不正です」エラー）
    def test_validate_dates_bad_format(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 準備: "YYYY-MM-DD" 形式ではない期間
        data = {'start_day': 'bad', 'end_day': 'format'}
        # 操作: 工数バックアップAPIを呼ぶ
        response = self.client.post('/api/kosu_backup/', data, format='json')
        # 検証: 400（日付形式エラー）
        self.assertEqual(response.status_code, 400)

    # 【テスト】ファイルを付けずに工数データ読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/kosu_load/（ファイルなし）
    #   期待: 400 または 500（実際のAPIは、ファイル書き込み処理の例外を捕まえて 500 を返す）
    def test_backup_kosu_load_no_file(self):
        """kosu_load without a file should error."""
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに工数データ読み込みAPIを呼ぶ
        response = self.client.post('/api/kosu_load/', {}, format='json')
        # 検証: ファイルが無いためエラー（400 か 500 のどちらかならテスト成功）
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに工数区分定義の読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/def_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_def_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/def_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに人員データの読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/member_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_member_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/member_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに作業詳細選択肢の読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/choice_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_choice_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/choice_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに班員データの読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/team_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_team_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/team_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに問い合わせデータの読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/inquiry_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_inquiry_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/inquiry_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])

    # 【テスト】ファイルを付けずに管理者設定の読み込みAPIを呼ぶとエラーになること
    #   前提: 管理者ユーザーでログイン済み
    #   操作: POST /api/setting_load/（ファイルなし）
    #   期待: 400 または 500
    def test_backup_setting_load_no_file(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: ファイルを付けずに読み込みAPIを呼ぶ
        response = self.client.post('/api/setting_load/', {}, format='json')
        # 検証: 400 か 500 のどちらか
        self.assertIn(response.status_code, [400, 500])


# ---------------------------------------------------------------------------
# 27. TestTeamViewPost: 班員APIの権限・データなしのテスト
#   対象 : /api/team_new/, /api/team_list/, /api/team_detail/<ID>/（team_views.py）
#   内容 : 権限なし（403）・班員データなし（400）・工数データなし（404）を確認する。
#          （区切り線の元の説明は「post to set shop」だが、POST のテストは含まれていない）
#   準備 : 管理者ユーザー 12345 の班（メンバー1=99999・フォローOFF）を作成する
# ---------------------------------------------------------------------------
class TestTeamViewPost(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、班員データを作成する
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 班員データ: 班長 12345 の班のメンバー1 に 99999、フォローOFF
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999', follow=False
        )

    # 【テスト】権限なしのユーザーは班員登録画面用APIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/team_new/
    #   期待: 403（権限なし）
    def test_team_new_no_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 班員登録画面用APIを呼ぶ
        response = self.client.get('/api/team_new/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】班員データが無いと班員工数一覧を表示できないこと
    #   前提: 管理者ユーザーの班員データを削除済み
    #   操作: GET /api/team_list/
    #   期待: 400（「班員情報を登録してください」エラー）
    def test_team_list_no_team(self):
        """Test team list when no team data."""
        # 準備: 班員データを削除し、管理者ユーザーでログイン
        self.team.delete()
        self.login_as_admin()
        # 操作: 班員工数一覧APIを呼ぶ
        response = self.client.get('/api/team_list/')
        # 検証: 400（班員未登録）
        self.assertEqual(response.status_code, 400)

    # 【テスト】権限なしのユーザーは班員工数一覧APIを呼べないこと
    #   前提: 一般ユーザー（権限なし）でログイン済み
    #   操作: GET /api/team_list/
    #   期待: 403（権限なし）
    def test_team_list_no_authority(self):
        # 準備: 権限なしの一般ユーザーでログイン
        self.login_as_normal()
        # 操作: 班員工数一覧APIを呼ぶ
        response = self.client.get('/api/team_list/')
        # 検証: 403（権限なし）
        self.assertEqual(response.status_code, 403)

    # 【テスト】存在しないIDの工数データは班員工数詳細で取得できないこと
    #   前提: ID 99999 の工数データは存在しない
    #   操作: GET /api/team_detail/99999/
    #   期待: 404（見つからない）
    def test_team_detail_not_found(self):
        # 準備: 権限ありの管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで班員工数詳細APIを呼ぶ
        response = self.client.get('/api/team_detail/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# 28. TestInquiryDeleteExtended: 問い合わせ削除・編集APIのテスト（追加ケース）
#   対象 : /api/inquir_update/<ID>/（inquiry_views.InquirUpdate の DELETE / GET）
#   内容 : ポップアップ通知が残っている問い合わせの削除と、存在しないIDの取得を確認する。
#   準備 : 管理者ユーザー 12345 を「問い合わせ担当者1」に設定する
# ---------------------------------------------------------------------------
class TestInquiryDeleteExtended(BaseTestCase):
    # 各テストの前に: BaseTestCase の共通準備に加え、管理者ユーザーを問い合わせ担当者にする
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備
        super().setUp()
        # 管理者設定の問い合わせ担当者1 に 12345 を設定して保存
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    # 【テスト】質問者側・管理者側にポップアップ通知が残っている問い合わせを削除できること
    #   前提: 問い合わせ1件。質問者（12345）と管理者設定の pop_up1 / pop_up_id1 にその通知が入っている
    #   操作: DELETE /api/inquir_update/<ID>/
    #   期待: 204（削除成功）
    #   補足: API は削除時に関連する通知も消すが、通知が消えたかどうかはこのテストでは確認していない
    def test_inquir_update_delete_clears_popups(self):
        """Test delete removes related popups."""
        # 準備: 回答済みの問い合わせを作成
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Delete popup test', answer='回答'
        )
        # 準備: 質問者（管理者ユーザー 12345）の1枠目に、この問い合わせの通知を入れて保存
        self.member.pop_up1 = 'test popup'
        self.member.pop_up_id1 = str(inq.id)
        self.member.save()
        # 準備: 管理者設定の1枠目にも、この問い合わせの通知を入れて保存
        self.admin_settings.pop_up1 = 'admin popup'
        self.admin_settings.pop_up_id1 = str(inq.id)
        self.admin_settings.save()

        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 問い合わせ削除APIを呼ぶ
        response = self.client.delete(f'/api/inquir_update/{inq.id}/')
        # 検証: 204（削除成功）
        self.assertEqual(response.status_code, 204)

    # 【テスト】存在しないIDの問い合わせは編集画面用データを取得できないこと
    #   前提: ID 99999 の問い合わせは存在しない
    #   操作: GET /api/inquir_update/99999/
    #   期待: 404（見つからない）
    def test_inquir_update_not_found(self):
        # 準備: 管理者ユーザーでログイン
        self.login_as_admin()
        # 操作: 存在しないIDで問い合わせ編集画面用APIを呼ぶ
        response = self.client.get('/api/inquir_update/99999/')
        # 検証: 404（見つからない）
        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# 29. TestTasks: 非同期タスク関数（tasks.py）のテスト
#   対象 : tasks.py の generate_*_backup（Excel作成）/ delete_*_data（期間削除）/ load_kosu_file（読み込み）
#   内容 : APIを通さず関数を直接呼び、Excelファイルが作られること・データが削除/復元されることを確認する。
#   準備 : Excel の保存先（settings.MEDIA_ROOT）を一時フォルダに差し替え、
#          テスト後に元へ戻して一時フォルダごと削除する（リポジトリの media/ を汚さないため）
# ---------------------------------------------------------------------------
class TestTasks(BaseTestCase):
    """Tests for kosu/tasks.py backup/delete functions."""

    # 各テストの前に: BaseTestCase の共通準備に加え、ファイルの保存先を一時フォルダに差し替える
    def setUp(self):
        # 親クラス（BaseTestCase）の共通準備（人員 12345 などを作成）
        super().setUp()
        # 関数内で必要なモジュールを読み込む（tempfile はファイル先頭でも import 済み）
        import tempfile
        from django.conf import settings as django_settings
        # tearDown でも使うため、Django の設定オブジェクトを保存する
        self.django_settings = django_settings
        # 空の一時フォルダを作成（mkdtemp はフォルダのパスを返す）
        self.temp_media = tempfile.mkdtemp()
        # 元の MEDIA_ROOT（リポジトリの media/）を保存する（tearDown で元に戻すため）
        self._orig_media_root = django_settings.MEDIA_ROOT
        # バックアップ関数の保存先（MEDIA_ROOT）を一時フォルダに差し替える
        django_settings.MEDIA_ROOT = self.temp_media

    # 各テストの後に: MEDIA_ROOT を元に戻し、一時フォルダを中身ごと削除する
    def tearDown(self):
        # shutil: フォルダを中身ごと削除する rmtree を使うために読み込む
        import shutil
        # 保存先（MEDIA_ROOT）を元の設定値に戻す
        self.django_settings.MEDIA_ROOT = self._orig_media_root
        # 一時フォルダを削除（ignore_errors=True: 削除できないファイルがあってもエラーにしない）
        shutil.rmtree(self.temp_media, ignore_errors=True)
        # 親クラスの後片付け処理を呼ぶ
        super().tearDown()

    # 【テスト】工数データのバックアップ関数が Excel ファイルを作成すること
    #   前提: 2025-01-15 の工数データが1件ある
    #   操作: generate_kosu_backup('2025-01-01', '2025-01-31')
    #   期待: 戻り値のパスにファイルが存在する
    def test_generate_kosu_backup_creates_file(self):
        # 準備: テスト対象の関数を読み込み、期間内の工数データを1件作成
        from kosu.tasks import generate_kosu_backup
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', over_time=0, work_time='出勤'
        )
        # 操作: 2025年1月分のバックアップを作成（戻り値は保存したファイルのパス）
        filepath = generate_kosu_backup('2025-01-01', '2025-01-31')
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】期間内に工数データが無くても、見出し行だけの Excel ファイルが作成されること
    #   前提: 2099年1月の工数データは無い
    #   操作: generate_kosu_backup('2099-01-01', '2099-01-31')
    #   期待: ファイルが存在する
    def test_generate_kosu_backup_empty_data(self):
        # 準備: テスト対象の関数を読み込む
        from kosu.tasks import generate_kosu_backup
        # 操作: データの無い期間でバックアップを作成
        filepath = generate_kosu_backup('2099-01-01', '2099-01-31')
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】工数データ削除関数が期間内の工数データを削除すること
    #   前提: 2025-01-15 の工数データが1件ある
    #   操作: delete_kosu_data('2025-01-01', '2025-01-31')
    #   期待: 工数データの件数が 1 → 0 になる
    def test_delete_kosu_data(self):
        # 準備: テスト対象の関数を読み込み、期間内の工数データを1件作成
        from kosu.tasks import delete_kosu_data
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', over_time=0, work_time='出勤'
        )
        # 準備: 削除前は1件あることを確認
        self.assertEqual(Business_Time_graph.objects.count(), 1)
        # 操作: 2025年1月分の工数データを削除
        delete_kosu_data('2025-01-01', '2025-01-31')
        # 検証: 0件になっている
        self.assertEqual(Business_Time_graph.objects.count(), 0)

    # 【テスト】バックアップした Excel から工数データを読み込んで復元できること
    #   前提: 2025-01-15 の工数データが1件ある
    #   操作: バックアップ作成 → DBの工数データを全削除 → load_kosu_file で読み込む
    #   期待: 結果の status が "success" で、工数データが1件に戻る
    def test_load_kosu_file_success(self):
        # 準備: テスト対象の関数を読み込み、全項目を埋めた工数データを1件作成
        from kosu.tasks import generate_kosu_backup, load_kosu_file
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', detail_work='test', over_time=30,
            work_time='出勤', judgement=True, break_change=False
        )
        # 準備: バックアップファイルを作り、DBの工数データをすべて削除する
        filepath = generate_kosu_backup('2025-01-01', '2025-01-31')
        Business_Time_graph.objects.all().delete()
        # 操作: バックアップファイルを読み込む（戻り値は (結果の辞書, None)。読み込み後にファイルは関数側で削除される）
        result, _ = load_kosu_file(filepath)
        # 検証: 成功し、工数データが1件復元されている
        self.assertEqual(result['status'], 'success')
        self.assertEqual(Business_Time_graph.objects.count(), 1)

    # 【テスト】見出し行が正しくない Excel は読み込まずにエラーを返すこと
    #   前提: 1行目が ['bad', 'header'] の Excel ファイル
    #   操作: load_kosu_file(ファイルパス)
    #   期待: 結果の status が "error" で、message に「無効なファイルフォーマット」が含まれる
    def test_load_kosu_file_invalid_header(self):
        # 準備: テスト対象の関数と、Excel を作るライブラリ openpyxl を読み込む
        from kosu.tasks import load_kosu_file
        import openpyxl
        # 準備: 新しいブックを作り、1枚目のシートに正しくない見出し行を書いて一時フォルダに保存
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['bad', 'header'])
        filepath = os.path.join(self.temp_media, 'bad.xlsx')
        wb.save(filepath)
        # 操作: 不正なファイルを読み込む
        result, _ = load_kosu_file(filepath)
        # 検証: エラーになり、ファイル形式が無効である旨のメッセージが返る
        self.assertEqual(result['status'], 'error')
        self.assertIn('無効なファイルフォーマット', result['message'])

    # 【テスト】班員データのバックアップ関数が Excel ファイルを作成すること
    #   前提: 班員データが1件ある
    #   操作: generate_team_backup()
    #   期待: ファイルが存在する
    def test_generate_team_backup_creates_file(self):
        # 準備: テスト対象の関数を読み込み、班員データを1件作成
        from kosu.tasks import generate_team_backup
        team_member.objects.create(employee_no5=12345, member1='99999')
        # 操作: 班員データのバックアップを作成
        filepath = generate_team_backup()
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】タスク記録削除関数が期間内（作成日基準）のタスク記録を削除すること
    #   前提: 今日作成したタスク記録が1件ある
    #   操作: delete_AsyncTask_data('2020-01-01', '2099-12-31')
    #   期待: タスク記録の件数が 1 → 0 になる
    def test_delete_async_task_data(self):
        # 準備: テスト対象の関数を読み込み、タスク記録を1件作成して件数を確認
        from kosu.tasks import delete_AsyncTask_data
        AsyncTask.objects.create(task_id='test-del-1', status='success')
        self.assertEqual(AsyncTask.objects.count(), 1)
        # 操作: 今日を含む十分に広い期間で削除
        delete_AsyncTask_data('2020-01-01', '2099-12-31')
        # 検証: 0件になっている
        self.assertEqual(AsyncTask.objects.count(), 0)

    # 【テスト】操作履歴削除関数が期間内（操作日時基準）の操作履歴を削除すること
    #   前提: 操作履歴を全削除したうえで1件作成する
    #   操作: delete_History_data('2020-01-01', '2099-12-31')
    #   期待: 操作履歴の件数が 0 になる
    def test_delete_history_data(self):
        # 準備: テスト対象の関数を読み込む
        from kosu.tasks import delete_History_data
        # 準備: setUp の人員作成時に signals.py が自動で記録した操作履歴を消してから、1件作成する
        History.objects.all().delete()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, login_No='12345'
        )
        # 準備: 削除前に1件以上あることを確認
        self.assertTrue(History.objects.count() >= 1)
        # 操作: 今日を含む十分に広い期間で削除
        delete_History_data('2020-01-01', '2099-12-31')
        # 検証: 0件になっている
        self.assertEqual(History.objects.count(), 0)

    # 【テスト】タスク記録のバックアップ関数が Excel ファイルを作成すること
    #   前提: タスク記録が1件ある
    #   操作: generate_AsyncTask_backup('2020-01-01', '2099-12-31')
    #   期待: ファイルが存在する
    def test_generate_async_task_backup(self):
        # 準備: テスト対象の関数を読み込み、タスク記録を1件作成
        from kosu.tasks import generate_AsyncTask_backup
        AsyncTask.objects.create(task_id='test-bk', status='success')
        # 操作: 期間を指定してバックアップを作成
        filepath = generate_AsyncTask_backup('2020-01-01', '2099-12-31')
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】操作履歴のバックアップ関数が Excel ファイルを作成すること
    #   前提: 操作履歴がある
    #   操作: generate_History_backup('2020-01-01', '2099-12-31')
    #   期待: ファイルが存在する
    def test_generate_history_backup(self):
        # 準備: テスト対象の関数を読み込み、操作履歴を1件作成
        from kosu.tasks import generate_History_backup
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, login_No='12345'
        )
        # 操作: 期間を指定してバックアップを作成
        filepath = generate_History_backup('2020-01-01', '2099-12-31')
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】作業詳細選択肢のバックアップ関数が Excel ファイルを作成すること
    #   前提: 選択肢が1件ある
    #   操作: generate_choice_backup()
    #   期待: ファイルが存在する
    def test_generate_choice_backup(self):
        # 準備: テスト対象の関数を読み込み、選択肢を1件作成
        from kosu.tasks import generate_choice_backup
        def_choice.objects.create(def_symbol='A', def_select='テスト')
        # 操作: バックアップを作成
        filepath = generate_choice_backup()
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】問い合わせのバックアップ関数が Excel ファイルを作成すること
    #   前提: 問い合わせが1件ある
    #   操作: generate_inquiry_backup()
    #   期待: ファイルが存在する
    def test_generate_inquiry_backup(self):
        # 準備: テスト対象の関数を読み込み、問い合わせを1件作成
        from kosu.tasks import generate_inquiry_backup
        inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='テスト'
        )
        # 操作: バックアップを作成
        filepath = generate_inquiry_backup()
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】管理者設定のバックアップ関数が Excel ファイルを作成すること
    #   前提: 管理者設定が1件ある（BaseTestCase で作成）
    #   操作: generate_setting_backup()
    #   期待: ファイルが存在する
    def test_generate_setting_backup(self):
        # 準備: テスト対象の関数を読み込む
        from kosu.tasks import generate_setting_backup
        # 操作: バックアップを作成
        filepath = generate_setting_backup()
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】工数区分定義のバックアップ関数が Excel ファイルを作成すること
    #   前提: 工数区分定義が1件ある（BaseTestCase で作成）
    #   操作: generate_def_backup()
    #   期待: ファイルが存在する
    def test_generate_def_backup(self):
        # 準備: テスト対象の関数を読み込む
        from kosu.tasks import generate_def_backup
        # 操作: バックアップを作成
        filepath = generate_def_backup()
        # 検証: ファイルが存在する。確認後に削除する
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    # 【テスト】未登録の従業員番号の行は読み飛ばし、処理全体は成功すること
    #   前提: 見出し行は正しく、データ行の従業員番号 88888 は人員に存在しない
    #   操作: load_kosu_file(ファイルパス)
    #   期待: 結果の status が "success" で、工数データは1件も作られない
    def test_load_kosu_file_nonexistent_member(self):
        """Load file with employee_no not in DB - should skip that row."""
        # 準備: テスト対象の関数と openpyxl を読み込み、新しいブックを作る
        from kosu.tasks import load_kosu_file
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        # 準備: 工数データバックアップと同じ15列の見出し行（load_kosu_file が期待する並び）
        headers = [
            '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直',
            '作業内容', '作業詳細', '残業時間', '昼休憩時間',
            '残業休憩時間1', '残業休憩時間2', '残業休憩時間3',
            '就業形態', '工数入力OK_NG', '休憩変更チェック',
        ]
        # 準備: 見出し行と、未登録の従業員番号 88888 のデータ行1行を書き込む
        ws.append(headers)
        ws.append([88888, 'nobody', 'v1', '2025-01-01', '1',
                   'A', '', 0, '', '', '', '', '出勤', True, False])
        # 準備: 一時フォルダに保存
        filepath = os.path.join(self.temp_media, 'test_load.xlsx')
        wb.save(filepath)
        # 操作: ファイルを読み込む
        result, _ = load_kosu_file(filepath)
        # 検証: 成功扱いだが、該当行はスキップされ工数データは0件
        self.assertEqual(result['status'], 'success')
        self.assertEqual(Business_Time_graph.objects.count(), 0)


# ---------------------------------------------------------------------------
# 30. TestCorsSettings: CORS（別オリジンからのAPI呼び出し許可）の設定のテスト
#   対象 : settings.py の CORS_ALLOWED_ORIGINS / CORS_ALLOW_CREDENTIALS（django-cors-headers）
#   内容 : 許可リストにあるオリジンには許可ヘッダーが付き、それ以外のオリジンには付かないことを確認する。
#   前提知識: ブラウザは、別オリジンのAPIの応答に Access-Control-Allow-Origin ヘッダーが無いと、
#             その結果を画面のプログラムに渡さない（Cookie 付きの呼び出しも同様）。
# ---------------------------------------------------------------------------
class TestCorsSettings(BaseTestCase):
    # 【テスト】許可リストにあるオリジン（開発用の http://localhost:3000）からの呼び出しには許可ヘッダーが付くこと
    #   前提: ログインしていない
    #   操作: Origin ヘッダーを http://localhost:3000 にして GET /api/main_menu/
    #   期待: Access-Control-Allow-Origin がそのオリジン、Access-Control-Allow-Credentials が "true"
    def test_cors_allowed_origin_gets_headers(self):
        # 操作: 許可リストにあるオリジンから呼び出す（未ログインなので本体は 401 だが、CORS のヘッダーは付く）
        response = self.client.get('/api/main_menu/', HTTP_ORIGIN='http://localhost:3000')
        # 検証: そのオリジンに対する許可ヘッダーと、Cookie の送受信を許可するヘッダーが付いている
        self.assertEqual(response.get('Access-Control-Allow-Origin'), 'http://localhost:3000')
        self.assertEqual(response.get('Access-Control-Allow-Credentials'), 'true')

    # 【テスト】許可リストに無いオリジンからの呼び出しには許可ヘッダーが付かないこと
    #   前提: ログインしていない
    #   操作: Origin ヘッダーを https://evil.example.com にして GET /api/main_menu/
    #   期待: Access-Control-Allow-Origin ヘッダーが無い（ブラウザは結果を受け取れない）
    def test_cors_disallowed_origin_gets_no_headers(self):
        # 操作: 許可リストに無い外部サイトのオリジンから呼び出す
        response = self.client.get('/api/main_menu/', HTTP_ORIGIN='https://evil.example.com')
        # 検証: 許可ヘッダーが付いていない
        self.assertNotIn('Access-Control-Allow-Origin', response)
