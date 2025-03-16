from django.test import TestCase, Client
from django.urls import reverse
from datetime import datetime, timedelta
from kosu.models import member, kosu_division, Business_Time_graph, team_member, administrator_data, inquiry_data


class KosuListPaginationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # memberダミーデータ
        for i in range(120):
            cls.member = member.objects.create(
                employee_no = 111 + i,
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
                break_check = False,
                def_prediction = False,
                )

        # administrator_dataダミーデータ
        cls.administrator_data = administrator_data.objects.create(
            menu_row = 20,
            administrator_employee_no1 = '111',
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
        start_date = datetime(2000, 1, 1)  # 開始日
        for i in range(120):
            date = start_date + timedelta(days=i)  # 日付を増加
            cls.Business_Time_graph = Business_Time_graph.objects.create(
                employee_no3=111,
                name=cls.member,
                def_ver2=cls.kosu_division.kosu_name,
                work_day2=date.strftime("%Y-%m-%d"),  # 日付を設定
                tyoku2='1',
                time_work='################################################################################################AAAAAAAAAAAABBBBBBBBBBBBCCCCCCCCCCCCDDDDDDDDDDDD$$$$$$$$$$$$EEEEEEEEEEEEFFFFFFFFFFFFGGGGGGGGGGGGHHHHHHHHHHHHIIIIIIIIIIJJJJJJJJJJJJ##############################################################',
                detail_work='$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$aaa$aaa$aaa$aaa$aaa$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$bbb$bbb$bbb$bbb$bbb$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$',
                over_time=120,
                breaktime='#12001300',
                breaktime_over1='#19001915',
                breaktime_over2='#01150215',
                breaktime_over3='#06150630',
                work_time='出勤',
                judgement=True,
                break_change=False,
            )

        # team_memberダミーデータ
        cls.team_member = team_member.objects.create(
            employee_no5 = 111,
            member1 = '',
            member2 = 111,
            member3 = '',
            member4 = 111,
            member5 = '',
            member6 = 111,
            member7 = '',
            member8 = 111,
            member9 = '',
            member10 = 111,
            member11 = '',
            member12 = 111,
            member13 = '',
            member14 = 111,
            member15 = '',
            follow = True,
            )



    # 初期データ
    def setUp(self):
        # テストクライアント初期化
        self.client = Client()
        # セッション定義
        self.session = self.client.session
        self.session['login_No'] = self.member.employee_no
        self.session['input_def'] =  self.kosu_division.kosu_name
        self.session['day'] =  self.Business_Time_graph.work_day2
        self.session['break_today'] =  self.Business_Time_graph.work_day2
        self.session['find_year'] =  2000
        self.session['find_month'] =  1
        self.session.save()


    
    # 工数一覧最初のページテスト
    def test_kosu_first_page(self):
        # 最初のページを取得
        response = self.client.get(reverse('kosu_list', args=[1]))
        self.assertEqual(response.status_code, 200)

        # 最初のページでは「最初」と「前」ボタンが反応しない
        self.assertNotContains(response, 'href="?page=0"')
        self.assertNotContains(response, 'href="?page=0"')
        # レコード数が20件であることを確認
        self.assertEqual(len(response.context['data']), 20)
        # ページ表記が1/6であること
        self.assertContains(response, '1/6')

        # 「次」ボタンを押した場合、2ページ目に遷移する
        next_page_url = reverse('kosu_list', args=[2])
        self.assertContains(response, next_page_url)
        next_response = self.client.get(next_page_url)
        self.assertEqual(next_response.status_code, 200)
        self.assertContains(next_response, '2/6')

        # 「最後」ボタンを押した場合、6ページ目に遷移する
        last_page_url = reverse('kosu_list', args=[6])
        self.assertContains(response, last_page_url)
        last_response = self.client.get(last_page_url)
        self.assertEqual(last_response.status_code, 200)
        self.assertContains(last_response, '6/6')

    def get_queryset(self):
        queryset = Business_Time_graph.objects.filter(**self.get_filter_kwargs(self.request)).order_by('work_day2').reverse()
        print(f"Filtered Queryset Count: {queryset.count()}")  # データ件数を確認
        print(Business_Time_graph.objects.count())  # 総データ数を確認
        print(response.content.decode())  # HTMLの内容を確認


        return queryset

    # 工数一覧3ページ目テスト
    def test_kosu_middle_page(self):
        # 3ページ目を取得
        response = self.client.get(reverse('kosu_list', args=[3]))
        self.assertEqual(response.status_code, 200)

        # 中間ページでは「前」および「次」ボタンが存在する
        self.assertContains(response, reverse('kosu_list', args=[2]))
        self.assertContains(response, reverse('kosu_list', args=[4]))
        # ページ表記が3/6であること
        self.assertContains(response, '3/6')



    # 工数一覧最終ページテスト
    def test_kosu_last_page(self):
        # 最後のページを取得
        response = self.client.get(reverse('kosu_list', args=[6]))
        self.assertEqual(response.status_code, 200)

        # 最後のページでは「次」と「最後」ボタンが反応しない
        self.assertNotContains(response, 'href="?page=7"')
        self.assertNotContains(response, 'href="?page=6"')
        # ページ表記が6/6であること
        self.assertContains(response, '6/6')



    # 工数一覧レコード数確認
    def test_kosu_record_count_per_page(self):
        # 全ページでレコード数が20件であることを確認
        for page_num in range(1, 7):
            response = self.client.get(reverse('kosu_list', args=[page_num]))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.context['data']), 20)



