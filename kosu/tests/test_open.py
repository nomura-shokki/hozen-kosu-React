from django.test import TestCase, Client
from django.urls import reverse
from kosu.models import member, kosu_division, Business_Time_graph, team_member, administrator_data, inquiry_data





# 各ページ開きテスト
class Open_pages(TestCase):
    # 初期データ作成
    @classmethod
    def setUpTestData(cls):   
        # memberダミーデータ
        cls.member = member.objects.create(
            employee_no = '11111',
            name = 'テストユーザー',
            shop = 'その他',
            authority = True,
            administrator = True,
            break_time1 = '#10401130',
            break_time1_over1 = '#15101520',
            break_time1_over2 = '#20202110',
            break_time1_over3 = '#01400150',
            break_time2 = '#17501840',
            break_time2_over1 = '#22302240',
            break_time2_over2 = '#03400430',
            break_time2_over3 = '#09000910',
            break_time3 = '#01400230',
            break_time3_over1 = '#07050715',
            break_time3_over2 = '#12151305',
            break_time3_over3 = '#17351745',
            break_time4 = '#12001300',
            break_time4_over1 = '#19001915',
            break_time4_over2 = '#01150215',
            break_time4_over3 = '#06150630',
            )

        # administrator_dataダミーデータ
        cls.administrator_data = administrator_data.objects.create(
            menu_row = 20,
            administrator_employee_no1 = '11111',
            administrator_employee_no2 = '',
            administrator_employee_no3 = '',
            )

        # kosu_divisionダミーデータ
        cls.kosu_division = kosu_division.objects.create(
            kosu_name = 'トライ定義',
            kosu_title_1 = '工数区分名1',
            kosu_division_1_1 = '定義1',
            kosu_division_2_1 = '作業内容1',
            kosu_title_2 = '工数区分名2',
            kosu_division_1_2 = '定義2',
            kosu_division_2_2 = '作業内容2',
            kosu_title_3 = '工数区分名3',
            kosu_division_1_3 = '定義3',
            kosu_division_2_3 = '作業内容3',
            kosu_title_4 = '工数区分名4',
            kosu_division_1_4 = '定義4',
            kosu_division_2_4 = '作業内容4',
            kosu_title_5 = '工数区分名5',
            kosu_division_1_5 = '定義5',
            kosu_division_2_5 = '作業内容5',
            kosu_title_6 = '工数区分名6',
            kosu_division_1_6 = '定義6',
            kosu_division_2_6 = '作業内容6',
            kosu_title_7 = '工数区分名7',
            kosu_division_1_7 = '定義7',
            kosu_division_2_7 = '作業内容7',
            kosu_title_8 = '工数区分名8',
            kosu_division_1_8 = '定義8',
            kosu_division_2_8 = '作業内容8',
            kosu_title_9 = '工数区分名9',
            kosu_division_1_9 = '定義9',
            kosu_division_2_9 = '作業内容9',
            kosu_title_10 = '工数区分名10',
            kosu_division_1_10 = '定義10',
            kosu_division_2_10 = '作業内容10',
        )

        # Business_Time_graphダミーデータ
        cls.Business_Time_graph = Business_Time_graph.objects.create(
            employee_no3 = '11111',
            name = cls.member,
            def_ver2 = cls.kosu_division.kosu_name,
            work_day2 = '2000-01-01',
            tyoku2 = '4',
            time_work = '################################################################################################AAAAAAAAAAAABBBBBBBBBBBBCCCCCCCCCCCCDDDDDDDDDDDD$$$$$$$$$$$$EEEEEEEEEEEEFFFFFFFFFFFFGGGGGGGGGGGGHHHHHHHHHHHHIIIIIIIIIIIIJJJJJJJJJJ##############################################################',
            detail_work = '$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$aaa$aaa$aaa$aaa$aaa$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$bbb$bbb$bbb$bbb$bbb$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$',
            over_time = 120,
            breaktime = '#12001300',
            breaktime_over1 = '#19001915',
            breaktime_over2 = '#01150215',
            breaktime_over3 = '#06150630',
            work_time = '出勤',
            judgement = True,
            break_change = False,
            )

        # team_memberダミーデータ
        cls.team_member = team_member.objects.create(
            employee_no5 = '11111',
            member1 = '',
            member2 = '11111',
            member3 = '',
            member4 = '11111',
            member5 = '',
            member6 = '11111',
            member7 = '',
            member8 = '11111',
            member9 = '',
            member10 = '11111',
            member11 = '',
            member12 = '11111',
            member13 = '',
            member14 = '11111',
            member15 = '',
            )

        # inquiry_dataダミーデータ
        cls.inquiry_data = inquiry_data.objects.create(
            employee_no2 = '11111',
            name = cls.member,
            content_choice = '問い合わせ',
            inquiry = '',
            answer = '回答'
            )



    # 初期データ
    def setUp(self):
        # テストクライアント初期化
        self.client = Client()
        # セッション定義
        self.session = self.client.session
        self.session['login_No'] = self.member.employee_no
        self.session['input_def'] = self.kosu_division.kosu_name
        self.session['break_today'] = self.Business_Time_graph.work_day2
        self.session.save()



    # ヘルプページ開きチェック
    def test_help(self):
        # URL定義
        url = reverse('help')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「ヘルプ」という文字列が含まれていることを確認
        self.assertContains(response, 'ヘルプ')



    # ログインページ開きチェック
    def test_login(self):
        # セッション削除
        session = self.client.session
        del session['login_No']
        session.save()

        # URL定義
        url = reverse('login')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「ログイン」という文字列が含まれていることを確認
        self.assertContains(response, 'ログイン')
    


    # MENUページ開きチェック
    def test_main(self):
        # URL定義
        url = reverse('main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「MENU」という文字列が含まれていることを確認
        self.assertContains(response, 'MENU')



    # 工数MENUページ開きチェック
    def test_kosu_main(self):
        # URL定義
        url = reverse('kosu_main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数MENU」という文字列が含まれていることを確認
        self.assertContains(response, '工数MENU')



    # 工数区分定義MENUページ開きチェック
    def test_def_main(self):
        # URL定義
        url = reverse('def_main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義MENU」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義MENU')



    # 人員MENUページ開きチェック
    def test_member_main(self):
        # URL定義
        url = reverse('member_main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「人員MENU」という文字列が含まれていることを確認
        self.assertContains(response, '人員MENU')



    # 班員MENUページ開きチェック
    def test_team_main(self):
        # URL定義
        url = reverse('team_main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「班員MENU」という文字列が含まれていることを確認
        self.assertContains(response, '班員MENU')



    # 問い合わせMENUページ開きチェック
    def test_inquiry_main(self):
        # URL定義
        url = reverse('inquiry_main')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「問い合わせMENU」という文字列が含まれていることを確認
        self.assertContains(response, '問い合わせMENU')



    # 管理者MENUページ開きチェック
    def test_administrator(self):
        # URL定義
        url = reverse('administrator')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「管理者MENU」という文字列が含まれていることを確認
        self.assertContains(response, '管理者MENU')



    # 工数登録ページ開きチェック
    def test_input(self):
        # URL定義
        url = reverse('input')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさんの工数登録」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの工数登録')



    # 当日休憩変更ページ開きチェック
    def test_today_break_time(self):
        # URL定義
        url = reverse('today_break_time')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「2000年1月1日の休憩変更」という文字列が含まれていることを確認
        self.assertContains(response, '2000年1月1日の休憩変更')



    # 休憩変更ページ開きチェック
    def test_break_time(self):
        # URL定義
        url = reverse('break_time')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「休憩時間定義」という文字列が含まれていることを確認
        self.assertContains(response, '休憩時間定義')



    # 工数履歴ページ開きチェック
    def test_kosu_list(self):
        # URL定義
        url = reverse('kosu_list', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「休憩時間定義」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの工数履歴')



    # 工数詳細ページ開きチェック
    def test_detail(self):
        # URL定義
        url = reverse('detail', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「2000年1月1日の工数詳細」という文字列が含まれていることを確認
        self.assertContains(response, '2000年1月1日の工数詳細')



    # 工数データ削除ページ開きチェック
    def test_delete(self):
        # URL定義
        url = reverse('delete', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数データ削除」という文字列が含まれていることを確認
        self.assertContains(response, '工数データ削除')



    # 全工数データページ開きチェック
    def test_all_kosu(self):
        # URL定義
        url = reverse('all_kosu', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)
        if response.status_code == 302:
            print(f'飛び先: {response.url}')
        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「全工数履歴」という文字列が含まれていることを確認
        self.assertContains(response, '全工数履歴')



    # 全工数データページ開きチェック
    def test_all_kosu_detail(self):
        # URL定義
        url = reverse('all_kosu_detail', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数データ編集」という文字列が含まれていることを確認
        self.assertContains(response, '工数データ編集')



    # 全工数データページ開きチェック
    def test_all_kosu_delete(self):
        # URL定義
        url = reverse('all_kosu_delete', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数データ編集」という文字列が含まれていることを確認
        self.assertContains(response, '工数データ削除')



    # 工数集計ページ開きチェック
    def test_total(self):
        # URL定義
        url = reverse('total')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさんの工数集計」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの工数集計')



    # 勤務入力ページ開きチェック
    def test_schedule(self):
        # URL定義
        url = reverse('schedule')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「勤務入力」という文字列が含まれていることを確認
        self.assertContains(response, '勤務入力')



    # 残業管理ページ開きチェック
    def test_over_time(self):
        # URL定義
        url = reverse('over_time')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「残業管理」という文字列が含まれていることを確認
        self.assertContains(response, '残業管理')



    # 工数区分定義確認ページ開きチェック
    def test_kosu_def(self):
        # URL定義
        url = reverse('kosu_def')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義確認」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義確認')



    # 工数区分定義切り替えページ開きチェック
    def test_kosu_Ver(self):
        # URL定義
        url = reverse('kosu_Ver')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義切り替え」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義切り替え')



    # 工数区分定義一覧ページ開きチェック
    def test_def_list(self):
        # URL定義
        url = reverse('def_list', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義一覧」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義一覧')



    # 工数区分定義新規登録ページ開きチェック
    def test_def_new(self):
        # URL定義
        url = reverse('def_new')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義新規登録」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義新規登録')



    # 工数区分定義編集ページ開きチェック
    def test_def_edit(self):
        # URL定義
        url = reverse('def_edit', args = [self.kosu_division.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義編集」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義編集')



    # 工数区分定義削除ページ開きチェック
    def test_def_delete(self):
        # URL定義
        url = reverse('def_delete', args = [self.kosu_division.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数区分定義削除」という文字列が含まれていることを確認
        self.assertContains(response, '工数区分定義削除')



    # 人員登録ページ開きチェック
    def test_member_new(self):
        # URL定義
        url = reverse('member_new')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「人員登録」という文字列が含まれていることを確認
        self.assertContains(response, '人員登録')



    # 人員一覧ページ開きチェック
    def test_member(self):
        # URL定義
        url = reverse('member', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「人員一覧」という文字列が含まれていることを確認
        self.assertContains(response, '人員一覧')


    # 人員編集ページ開きチェック
    def test_member_edit(self):
        # URL定義
        url = reverse('member_edit', args = [self.member.employee_no])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「人員編集」という文字列が含まれていることを確認
        self.assertContains(response, '人員編集')



    # 人員削除ページ開きチェック
    def test_member_delete(self):
        # URL定義
        url = reverse('member_delete', args = [self.member.employee_no])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「人員削除」という文字列が含まれていることを確認
        self.assertContains(response, '人員削除')



    # 班員設定ページ開きチェック
    def test_team(self):
        # URL定義
        url = reverse('team')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさんの班員設定」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの班員設定')



    # 班員工数グラフページ開きチェック
    def test_team_graph(self):
        # URL定義
        url = reverse('team_graph')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「班員工数グラフ」という文字列が含まれていることを確認
        self.assertContains(response, '班員工数グラフ')



    # 班員工数確認ページ開きチェック
    def test_team_kosu(self):
        # URL定義
        url = reverse('team_kosu', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさん班員工数確認」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさん班員工数確認')



    # 工数詳細ページ開きチェック
    def test_team_detail(self):
        # URL定義
        url = reverse('team_detail', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさんの工数詳細」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの工数詳細')



    # 班員工数入力状況一覧ページ開きチェック
    def test_team_calendar(self):
        # URL定義
        url = reverse('team_calendar')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「班員工数入力状況一覧」という文字列が含まれていることを確認
        self.assertContains(response, '班員工数入力状況一覧')



    # 班員残業管理ページ開きチェック
    def test_team_over_time(self):
        # URL定義
        url = reverse('team_over_time')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「班員残業管理」という文字列が含まれていることを確認
        self.assertContains(response, '班員残業管理')



    # 工数入力可否(ショップ単位)ページ開きチェック
    def test_class_list(self):
        # URL定義
        url = reverse('class_list')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「工数入力可否(ショップ単位)」という文字列が含まれていることを確認
        self.assertContains(response, '工数入力可否(ショップ単位)')



    # 工数詳細ページ開きチェック
    def test_class_detail(self):
        # URL定義
        url = reverse('class_detail', args = [self.Business_Time_graph.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「テストユーザーさんの工数詳細」という文字列が含まれていることを確認
        self.assertContains(response, 'テストユーザーさんの工数詳細')



    # 問い合わせ入力ページ開きチェック
    def test_inquiry_new(self):
        # URL定義
        url = reverse('inquiry_new')
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「問い合わせ入力」という文字列が含まれていることを確認
        self.assertContains(response, '問い合わせ入力')



    # 問い合わせ履歴ページ開きチェック
    def test_inquiry_list(self):
        # URL定義
        url = reverse('inquiry_list', args = [1])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「問い合わせ履歴」という文字列が含まれていることを確認
        self.assertContains(response, '問い合わせ履歴')



    # 問い合わせ詳細ページ開きチェック
    def test_inquiry_display(self):
        # URL定義
        url = reverse('inquiry_display', args = [self.inquiry_data.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「問い合わせ詳細」という文字列が含まれていることを確認
        self.assertContains(response, '問い合わせ詳細')



    # 問い合わせ編集ページ開きチェック
    def test_inquiry_edit(self):
        # URL定義
        url = reverse('inquiry_edit', args = [self.inquiry_data.id])
        # URLに対してGETリクエスト送信
        response = self.client.get(url)

        # リクエストのレスポンスステータスコードが200(OK)であることを確認
        self.assertEqual(response.status_code, 200)
        # レスポンスコンテンツに「問い合わせ編集」という文字列が含まれていることを確認
        self.assertContains(response, '問い合わせ編集')