import datetime
from django.test import TestCase, Client
from django.urls import reverse
import os
from kosu.models import member, kosu_division, Business_Time_graph, team_member, administrator_data, inquiry_data





# 各ページリンクテスト
class Page_jump(TestCase):
    # 初期データ作成
    @classmethod
    def setUpTestData(cls):       
        # memberダミーデータ
        cls.member = member.objects.create(
            employee_no = '111',
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
        cls.Business_Time_graph = Business_Time_graph.objects.create(
            employee_no3 = '111',
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
            employee_no5 = '111',
            member1 = '',
            member2 = '111',
            member3 = '',
            member4 = '111',
            member5 = '',
            member6 = '111',
            member7 = '',
            member8 = '111',
            member9 = '',
            member10 = '111',
            member11 = '',
            member12 = '111',
            member13 = '',
            member14 = '111',
            member15 = '',
            )

        # inquiry_dataダミーデータ
        cls.inquiry_data = inquiry_data.objects.create(
            employee_no2 = '111',
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
        self.session['input_def'] =  self.kosu_division.kosu_name
        self.session['day'] =  self.Business_Time_graph.work_day2
        self.session['break_today'] =  self.Business_Time_graph.work_day2
        self.session.save()



    # ログイン画面からヘルプ画面へジャンプテスト
    def test_login_help_jump(self):
        # セッション削除
        session = self.client.session
        del session['login_No']
        session.save()

        # ログインページにアクセス
        response = self.client.get(reverse('login'))
        self.assertEqual(response.status_code, 200)
        
        # リンクが含まれているか確認する
        self.assertContains(response, f'href="{reverse('help')}"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('help'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/help.html')



    # ヘルプからログインへジャンプテスト
    def test_help_login_jump(self):
        # ヘルプページにアクセス
        response = self.client.get(reverse('help'))
        self.assertEqual(response.status_code, 200)

        # セッション削除
        session = self.client.session
        del session['login_No']
        session.save()

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('login') + '" class="text-dark h6">ログインページへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('login'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/login.html')



    # ヘルプパスワード入力後に画面切り替わるかテスト
    def test_help_display(self):
        # 環境変数からHELP_PATHを取得
        help_path = os.getenv('HELP_PATH')

        # 特定の値を入力してフォームを送信する
        response = self.client.post(reverse('help'),{
            'help_path': help_path,
            'help_button': '決定'
            }
        )

        # レスポンスが成功したことを確認
        self.assertEqual(response.status_code, 200)
        # display変数がTrueになることを確認
        self.assertTrue(response.context['display'])



    # ログインできるかテスト
    def test_login_jump(self):
        # フォームの値を定義
        data = {
            'employee_no4': self.member.employee_no
            }
        # ログインページにアクセスしてフォームにデータを投稿します
        response = self.client.post(reverse('login'), data)

        # リダイレクトされているかを確認
        self.assertRedirects(response, reverse('main'))



    # MAINから工数MENUへジャンプテスト
    def test_main_kosu_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/kosu_main\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/kosu_main')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 工数MENUからMAINへジャンプテスト
    def test_kosu_main_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # MAINから工数定義区分MENUへジャンプテスト
    def test_main_def_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/def_main\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/def_main')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_main.html')



    # 工数定義区分MENUからMAINへジャンプテスト
    def test_def_main_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('def_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" class="text-success">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # MAINから人員MENUへジャンプテスト
    def test_main_member_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/member_main\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/member_main')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_main.html')



    # 人員MENUからMAINへジャンプテスト
    def test_member_main_jump(self):
        # 人員MENUページにアクセス
        response = self.client.get(reverse('member_main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" class="text-warning">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # MAINから班員MENUへジャンプテスト
    def test_main_team_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team_main\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/team_main')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員MENUからMAINへジャンプテスト
    def test_team_main_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" class="text-danger">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # MAINから問い合わせMENUへジャンプテスト
    def test_main_inquiry_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/inquiry_main\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/inquiry_main')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_main.html')



    # 問い合わせMENUからMAINへジャンプテスト
    def test_inquiry_main_jump(self):
        # 問い合わせMENUページにアクセス
        response = self.client.get(reverse('inquiry_main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" class="text-pink">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # MAINから管理者MENUへジャンプテスト
    def test_main_administrator_jump(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)
        
        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/administrator\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/administrator')
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/administrator_menu.html')



    # 管理者MENUからMAINへジャンプテスト
    def test_administrator_main_jump(self):
        # 管理者MENUページにアクセス
        response = self.client.get(reverse('administrator'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" class="text-dark">メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # ログアウトテスト
    def test_logout(self):
        # メインページにアクセス
        response = self.client.get(reverse('main'))
        self.assertEqual(response.status_code, 200)

        # ログアウトボタンを押す
        response = self.client.post(reverse('main'), {
            'btn-blue2': 'ログアウト'
        })

        # ログアウトボタンを押した後に 'login' ページにリダイレクトされることを確認
        self.assertRedirects(response, reverse('login'))
        


    # 工数MENUから工数登録へジャンプテスト
    def test_kosu_MENU_input_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/input\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('input'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/input.html')



    # 工数登録から工数MENUへジャンプテスト
    def test_input_kosu_MENU_jump(self):
        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 工数登録からメインMENUへジャンプテスト
    def test_input_main_MENU_jump(self):
        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数登録から工数履歴へジャンプテスト
    def test_input_kosu_list_jump(self):
        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_list', args = [1]) + '" >履歴へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_list', args = [1]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_list.html')



    # 工数履歴から工数登録へジャンプテスト
    def test_kosu_list_input_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('input') + '" >工数入力へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('input'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/input.html')



    # 工数登録から工数編集へジャンプテスト
    def test_input_detail_jump(self):
        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('detail', args = [self.Business_Time_graph.id]) + '" >工数編集</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('detail', args = [self.Business_Time_graph.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/detail.html')



    # 工数編集から工数登録へジャンプテスト
    def test_detail_input_jump(self):
        # 工数編集ページにアクセス
        response = self.client.get(reverse('detail', args = [self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('input') + '" >工数入力へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('input'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/input.html')



    # 工数登録から工数区分定義確認へジャンプテスト(スマホ画面)
    def test_input_kosu_def_time_smartphone(self):

        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # 定義確認を押す
        response = self.client.post(reverse('input'), {
            'work_day': '2000-01-01',
            'tyoku': '',
            'tyoku2': self.Business_Time_graph.tyoku2,
            'work': '',
            'work2': self.Business_Time_graph.work_time,
            'kosu_def_list': 'A',
            'work_detail': 'テスト',
            'over_work': self.Business_Time_graph.over_time,
            'start_time': '20:00',
            'end_time': '21:00',
            'tomorrow_check': False,
            'def_find': '定義確認',
        })

        # 定義確認を押した後に 'today_break_time' ページにリダイレクトされることを確認
        self.assertRedirects(response, reverse('kosu_def'))



    # 工数登録から工数区分定義確認へジャンプテスト(PC画面)
    def test_input_kosu_def_time_pc(self):

        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # 定義確認を押す
        response = self.client.post(reverse('input'), {
            'work_day': '2000-01-01',
            'tyoku2': '',
            'tyoku': self.Business_Time_graph.tyoku2,
            'work2': '',
            'work': self.Business_Time_graph.work_time,
            'kosu_def_list': 'A',
            'work_detail': 'テスト',
            'over_work': self.Business_Time_graph.over_time,
            'start_time': '20:00',
            'end_time': '21:00',
            'tomorrow_check': False,
            'def_find': '定義確認',
        })

        # 定義確認を押した後に 'today_break_time' ページにリダイレクトされることを確認
        self.assertRedirects(response, reverse('kosu_def'))



    # 工数区分定義確認から工数登録へジャンプテスト
    def test_kosu_def_input_jump(self):
        # 工数区分定義確認ページにアクセス
        response = self.client.get(reverse('kosu_def'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('input') + '" >工数入力へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('input'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/input.html')



    # 工数登録から当日休憩変更へジャンプテスト
    def test_input_today_break_time(self):
        # 工数登録ページにアクセス
        response = self.client.get(reverse('input'))
        self.assertEqual(response.status_code, 200)

        # 休憩変更登録を押す
        response = self.client.post(reverse('input'), {
            'work_day': self.Business_Time_graph.work_day2,
            'change_display': '休憩変更登録'
        })

        # 休憩変更登録を押した後に 'today_break_time' ページにリダイレクトされることを確認
        self.assertRedirects(response, reverse('today_break_time'))



    # 当日休憩変更から工数登録へジャンプテスト
    def test_today_break_time_input(self):
        # 当日休憩変更ページにアクセス
        response = self.client.get(reverse('today_break_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('input') + '" >工数入力へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('input'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/input.html')



    # 工数MENUから休憩設定へジャンプテスト
    def test_kosu_MENU_break_time_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/break_time\'"')
        # ボタンを押すシミュレーション
        response = self.client.get('/break_time')

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/break_time.html')



    # 休憩設定から工数MENUへジャンプテスト
    def test_break_time_kosu_MENU_jump(self):
        # 休憩設定ページにアクセス
        response = self.client.get(reverse('break_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 休憩設定からメインMENUへジャンプテスト
    def test_break_time_main_MENU_jump(self):
        # 休憩設定ページにアクセス
        response = self.client.get(reverse('break_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数MENUから工数履歴へジャンプテスト
    def test_kosu_MENU_kosu_list_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/list/1\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_list.html')



    # 工数履歴から工数MENUへジャンプテスト
    def test_kosu_list_kosu_MENU_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 工数履歴からメインMENUへジャンプテスト
    def test_kosu_list_main_MENU_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数履歴から全工数データへジャンプテスト
    def test_kosu_list_all_kosu_jump(self):
        # 工数データページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('all_kosu', args = [1]) + '" >全データ確認</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('all_kosu', args = [1]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/all_kosu.html')



    # 全工数確認から工数MENUへジャンプテスト
    def test_all_kosu_kosu_MENU_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('all_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 全工数確認から工数データへジャンプテスト
    def test_all_kosu_all_kosu_detail_jump(self):
        # 全工数確認ページにアクセス
        response = self.client.get(reverse('all_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('all_kosu_detail', args=[self.Business_Time_graph.id]) + '">詳細</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('all_kosu_detail', args = [self.Business_Time_graph.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/all_kosu_detail.html')



    # 工数データから全工数確認へジャンプテスト
    def test_all_kosu_detail_all_kosu_jump(self):
        # 工数データページにアクセス
        response = self.client.get(reverse('all_kosu_detail', args = [self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('all_kosu', args = [1]) + '" >データ一覧へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('all_kosu', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/all_kosu.html')



    # 全工数確認から工数データ削除へジャンプテスト
    def test_all_kosu_all_kosu_delete_jump(self):
        # 全工数確認ページにアクセス
        response = self.client.get(reverse('all_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('all_kosu_delete', args=[self.Business_Time_graph.id]) + '">削除</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('all_kosu_delete', args = [self.Business_Time_graph.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/all_kosu_delete.html')



    # 工数データ削除から全工数確認へジャンプテスト
    def test_all_kosu_delete_all_kosu_jump(self):
        # 工数データ削除ページにアクセス
        response = self.client.get(reverse('all_kosu_delete', args = [self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('all_kosu', args = [1]) + '" >データ一覧へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('all_kosu', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/all_kosu.html')



    # 工数履歴から工数詳細へジャンプテスト
    def test_kosu_list_detail_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('detail', args=[self.Business_Time_graph.id]) + '">詳細</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('detail', args = [self.Business_Time_graph.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/detail.html')



    # 工数詳細から工数履歴へジャンプテスト
    def test_detail_kosu_list_jump(self):
        # 工数詳細ページにアクセス
        response = self.client.get(reverse('detail', args=[self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_list', args = [1]) + '" >履歴へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_list.html')



    # 工数詳細前後ページ移行ジャンプテスト
    def test_detail_jump(self):
        # Business_Time_graphダミーデータ
        for day in range(1, 3):
            self.Business_Time_graph = Business_Time_graph.objects.create(
                employee_no3 = 111,
                name = self.member,
                def_ver2 = self.kosu_division.kosu_name,
                work_day2 = datetime.datetime.strptime('2000-01-01', '%Y-%m-%d').date() + datetime.timedelta(days = day),
                tyoku2 = '4',
                time_work = '################################################################################################AAAAAAAAAAAABBBBBBBBBBBBCCCCCCCCCCCCDDDDDDDDDDDD$$$$$$$$$$$$EEEEEEEEEEEEFFFFFFFFFFFFGGGGGGGGGGGGHHHHHHHHHHHHIIIIIIIIIIJJJJJJJJJJJJ##############################################################',
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


        # 1月2日の工数データ取得
        obj = Business_Time_graph.objects.get(work_day2 = '2000-01-02')

        # 工数詳細ページにアクセス
        response = self.client.get(reverse('detail', args=[obj.id]))
        self.assertEqual(response.status_code, 200)

        # フォームデータ定義
        form_data = {
            'after': '◀次のデータ',
            }

        # URLに対してPOSTリクエスト送信
        response = self.client.post(reverse('detail', args=[obj.id]), form_data)
        # リクエストのレスポンスステータスコードが302(リダイレクト)であることを確認
        self.assertEqual(response.status_code, 302)

        # リダイレクト先のURLを確認
        next_obj = Business_Time_graph.objects.get(work_day2 = '2000-01-03')
        expected_url = reverse('detail', args = [next_obj.id])
        self.assertRedirects(response, expected_url)


        # 1月2日の工数データ取得
        obj = Business_Time_graph.objects.get(work_day2 = '2000-01-02')

        # 工数詳細ページにアクセス
        response = self.client.get(reverse('detail', args=[obj.id]))
        self.assertEqual(response.status_code, 200)

        # フォームデータ定義
        form_data = {
            'before': '前のデータ▶',
            }

        # URLに対してPOSTリクエスト送信
        response = self.client.post(reverse('detail', args=[obj.id]), form_data)
        # リクエストのレスポンスステータスコードが302(リダイレクト)であることを確認
        self.assertEqual(response.status_code, 302)

        # リダイレクト先のURLを確認
        before_obj = Business_Time_graph.objects.get(work_day2 = '2000-01-01')
        expected_url = reverse('detail', args = [before_obj.id])
        self.assertRedirects(response, expected_url)



    # 工数履歴から工数削除へジャンプテスト
    def test_kosu_list_delete_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('kosu_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('delete', args=[self.Business_Time_graph.id]) + '">削除</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('delete', args = [self.Business_Time_graph.id]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/delete.html')



    # 工数削除から工数履歴へジャンプテスト
    def test_delete_kosu_list_jump(self):
        # 工数削除ページにアクセス
        response = self.client.get(reverse('delete', args=[self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_list', args = [1]) + '" >履歴へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_list.html')



    # 工数MENUから工数集計へジャンプテスト
    def test_kosu_MENU_kosu_total_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/total\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('total'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/total.html')



    # 工数集計から工数MENUへジャンプテスト
    def test_total_kosu_MENU_jump(self):
        # 工数集計ページにアクセス
        response = self.client.get(reverse('total'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 工数集計からメインMENUへジャンプテスト
    def test_total_main_MENU_jump(self):
        # 工数集計ページにアクセス
        response = self.client.get(reverse('total'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数MENUから勤務入力へジャンプテスト
    def test_kosu_MENU_kosu_schedule_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/schedule\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('schedule'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/schedule.html')



    # 勤務入力から工数MENUへジャンプテスト
    def test_schedule_kosu_MENU_jump(self):
        # 勤務入力ページにアクセス
        response = self.client.get(reverse('schedule'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 勤務入力からメインMENUへジャンプテスト
    def test_schedule_main_MENU_jump(self):
        # 勤務入力ページにアクセス
        response = self.client.get(reverse('schedule'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数MENUから残業管理へジャンプテスト
    def test_kosu_MENU_kosu_over_time_jump(self):
        # 工数MENUページにアクセス
        response = self.client.get(reverse('kosu_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/over_time\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('over_time'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/over_time.html')



    # 残業管理から工数MENUへジャンプテスト
    def test_over_time_kosu_MENU_jump(self):
        # 残業管理ページにアクセス
        response = self.client.get(reverse('over_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('kosu_main') + '" >工数MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_main.html')



    # 残業管理からメインMENUへジャンプテスト
    def test_over_time_main_MENU_jump(self):
        # 残業管理ページにアクセス
        response = self.client.get(reverse('over_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('main') + '" >メインMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/main.html')



    # 工数区分定義MENUから工数区分定義確認へジャンプテスト
    def test_def_MENU_kosu_def_jump(self):
        # 工数区分定義MENUページにアクセス
        response = self.client.get(reverse('def_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/kosu_def\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_def'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_def.html')



    # 工数区分定義確認から工数区分定義MENUへジャンプテスト
    def test_kosu_def_def_MENU_jump(self):
        # 工数区分定義確認ページにアクセス
        response = self.client.get(reverse('kosu_def'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_main') + '" class="text-success">工数区分定義MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_main.html')



    # 工数区分定義MENUから工数区分定義切り替えへジャンプテスト
    def test_def_MENU_def_Ver_jump(self):
        # 工数区分定義MENUページにアクセス
        response = self.client.get(reverse('def_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/kosu_Ver\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('kosu_Ver'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/kosu_Ver.html')



    # 工数区分定義切り替えから工数区分定義MENUへジャンプテスト
    def test_def_Ver_def_MENU_jump(self):
        # 工数区分定義確認ページにアクセス
        response = self.client.get(reverse('kosu_Ver'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_main') + '" class="text-success">工数区分定義MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_main.html')



    # 工数区分定義MENUから工数区分定義一覧へジャンプテスト
    def test_def_MENU_def_list_jump(self):
        # 工数区分定義MENUページにアクセス
        response = self.client.get(reverse('def_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/def_list/1\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_list.html')



    # 工数区分定義一覧から工数区分定義MENUへジャンプテスト
    def test_def_list_def_MENU_jump(self):
        # 工数区分定義一覧ページにアクセス
        response = self.client.get(reverse('def_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_main') + '" class="text-success">工数区分定義MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_main.html')



    # 工数区分定義一覧から工数区分定義新規作成へジャンプテスト
    def test_def_list_def_new_jump(self):
        # 工数区分定義一覧ページにアクセス
        response = self.client.get(reverse('def_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_new') + '" class="text-success">新規登録</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_new'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_new.html')



    # 工数定義区分新規作成から工数区分定義一覧へジャンプテスト
    def test_def_new_def_list_jump(self):
        # 工数定義区分新規作成ページにアクセス
        response = self.client.get(reverse('def_new'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_list', args = [1]) + '" class="text-success">一覧へ戻る</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_list.html')



    # 工数区分定義一覧から工数区分定義編集へジャンプテスト
    def test_def_list_def_edit_jump(self):
        # 工数区分定義一覧ページにアクセス
        response = self.client.get(reverse('def_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_edit', args=[self.kosu_division.id]) + '" class="text-success">編集</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_edit', args = [self.kosu_division.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_edit.html')



    # 工数定義区分編集から工数区分定義一覧へジャンプテスト
    def test_def_edit_def_list_jump(self):
        # 工数定義区分編集ページにアクセス
        response = self.client.get(reverse('def_edit', args = [self.kosu_division.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_list', args = [1]) + '" class="text-success">一覧へ戻る</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_list.html')



    # 工数区分定義一覧から工数区分定義削除へジャンプテスト
    def test_def_list_def_delete_jump(self):
        # 工数履歴ページにアクセス
        response = self.client.get(reverse('def_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_delete', args=[self.kosu_division.id]) + '" class="text-success">削除</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_delete', args = [self.kosu_division.id]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_delete.html')



    # 工数定義区分削除から工数区分定義一覧へジャンプテスト
    def test_def_delete_def_list_jump(self):
        # 工数定義区分編集ページにアクセス
        response = self.client.get(reverse('def_delete', args = [self.kosu_division.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('def_list', args = [1]) + '" class="text-success">一覧へ戻る</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('def_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/def_list.html')



    # 人員MENUから人員新規作成へジャンプテスト
    def test_member_MENU_member_new_jump(self):
        # 人員MENUページにアクセス
        response = self.client.get(reverse('member_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/new\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_new'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_edit.html')



    # 人員新規作成から人員MENUへジャンプテスト
    def test_member_new_member_MENU_jump(self):
        # 人員新規作成ページにアクセス
        response = self.client.get(reverse('member_new'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_main') + '" class="text-warning">人員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_main.html')



    # 人員新規作成から人員一覧へジャンプテスト
    def test_member_new_member_list_jump(self):
        # 人員新規作成ページにアクセス
        response = self.client.get(reverse('member_new'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member', args = [1]) + '" class="text-warning">人員一覧へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member', args = [1]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member.html')



    # 人員MENUから人員一覧へジャンプテスト
    def test_member_MENU_member_list_jump(self):
        # 人員MENUページにアクセス
        response = self.client.get(reverse('member_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/member/1\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member.html')



    # 人員一覧から人員MENUへジャンプテスト
    def test_member_list_member_MENU_jump(self):
        # 人員新規作成ページにアクセス
        response = self.client.get(reverse('member', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_main') + '" class="text-warning">人員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_main.html')



    # 人員一覧から人員新規作成へジャンプテスト
    def test_member_list_member_new_jump(self):
        # 人員一覧ページにアクセス
        response = self.client.get(reverse('member', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_new') + '" class="text-warning">新規登録</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_new'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_edit.html')



    # 人員一覧から人員編集へジャンプテスト
    def test_member_list_member_edit_jump(self):
        # 人員一覧ページにアクセス
        response = self.client.get(reverse('member', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_edit', args=[self.member.employee_no]) + '" class="text-warning">編集</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_edit', args=[self.member.employee_no]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_edit.html')



    # 人員編集から人員MENUへジャンプテスト
    def test_member_edit_member_MENU_jump(self):
        # 人員編集ページにアクセス
        response = self.client.get(reverse('member_edit', args = [self.member.employee_no]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_main') + '" class="text-warning">人員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_main.html')



    # 人員編集から人員一覧へジャンプテスト
    def test_member_edit_member_list_jump(self):
        # 人員編集ページにアクセス
        response = self.client.get(reverse('member_edit', args = [self.member.employee_no]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member', args = [1]) + '" class="text-warning">人員一覧へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member.html')



    # 人員一覧から人員削除へジャンプテスト
    def test_member_list_member_delete_jump(self):
        # 人員一覧ページにアクセス
        response = self.client.get(reverse('member', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member_delete', args=[self.member.employee_no]) + '" class="text-warning">削除</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member_delete', args=[self.member.employee_no]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member_delete.html')



    # 人員削除から人員一覧へジャンプテスト
    def test_member_delete_member_list_jump(self):
        # 人員編集ページにアクセス
        response = self.client.get(reverse('member_delete', args = [self.member.employee_no]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('member', args = [1]) + '" class="text-warning">一覧へ戻る</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('member', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/member.html')



    # 班員MENUから班員登録へジャンプテスト
    def test_team_MENU_team_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team.html')



    # 班員登録から班員員MENUへジャンプテスト
    def test_team_team_MENU_jump(self):
        # 班員登録ページにアクセス
        response = self.client.get(reverse('team'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員MENUから班員工数グラフへジャンプテスト
    def test_team_MENU_team_graph_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team_graph\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_graph'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_graph.html')
    


    # 班員工数グラフから班員MENUへジャンプテスト
    def test_team_graph_team_MENU_jump(self):
        # 班員工数グラフページにアクセス
        response = self.client.get(reverse('team_graph'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員工数グラフから班員工数詳細へジャンプテスト
    def test_team_graph_team_kosu_jump(self):
        # 班員工数グラフページにアクセス
        response = self.client.get(reverse('team_graph'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_kosu', args = [1]) + '" class="text-danger">班員工数詳細へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_kosu', args = [1]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_kosu.html')



    # 班員MENUから班員工数詳細へジャンプテスト
    def test_team_MENU_team_kosu_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team_kosu/1\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_kosu', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_kosu.html')



    # 班員工数詳細から班員MENUへジャンプテスト
    def test_team_kosu_team_MENU_jump(self):
        # 班員工数詳細一覧ページにアクセス
        response = self.client.get(reverse('team_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員工数詳細から班員工数グラフへジャンプテスト
    def test_team_kosu_team_graph_jump(self):
        # 班員工数詳細一覧ページにアクセス
        response = self.client.get(reverse('team_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_graph') + '" class="text-danger">班員工数グラフへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_graph'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_graph.html')



    # 班員工数詳細から工数詳細へジャンプテスト
    def test_team_kosu_team_detail_jump(self):
        # 班員工数詳細ページにアクセス
        response = self.client.get(reverse('team_kosu', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_detail', args=[self.Business_Time_graph.id]) + '" >詳細</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_detail', args=[self.Business_Time_graph.id]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_detail.html')



    # 工数詳細から班員工数詳細へジャンプテスト
    def test_team_detail_team_kosu_jump(self):
        # 工数詳細ページにアクセス
        response = self.client.get(reverse('team_detail', args = [self.Business_Time_graph.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_kosu', args = [1]) + '" class="text-danger">班員工数詳細へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_kosu', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_kosu.html')



    # 班員MENUから班員工数入力状況一覧へジャンプテスト
    def test_team_MENU_team_calendar_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team_calendar\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_calendar'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_calendar.html')



    # 班員工数入力状況一覧から班員MENUへジャンプテスト
    def test_team_calendar_team_MENU_jump(self):
        # 班員工数詳細一覧ページにアクセス
        response = self.client.get(reverse('team_calendar'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員MENUから班員残業管理へジャンプテスト
    def test_team_MENU_team_over_time_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/team_over_time\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_over_time'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_over_time.html')



    # 班員工数入力状況一覧から班員MENUへジャンプテスト
    def test_team_over_time_team_MENU_jump(self):
        # 班員残業管理ページにアクセス
        response = self.client.get(reverse('team_over_time'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 班員MENUから工数入力可否(ショップ単位)へジャンプテスト
    def test_team_MENU_class_list_jump(self):
        # 班員MENUページにアクセス
        response = self.client.get(reverse('team_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/class_list\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('class_list'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/class_list.html')



    # 工数入力可否(ショップ単位)から班員MENUへジャンプテスト
    def test_class_list_time_team_MENU_jump(self):
        # 工数入力可否(ショップ単位)ページにアクセス
        response = self.client.get(reverse('class_list'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('team_main') + '" class="text-danger">班員MENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('team_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/team_main.html')



    # 問い合わせMENUから問い合わせ入力へジャンプテスト
    def test_inquiry_MENU_inquiry_new_jump(self):
        # 問い合わせMENUページにアクセス
        response = self.client.get(reverse('inquiry_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/inquiry_new\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_new'))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_new.html')



    # 問い合わせ入力から問い合わせMENUへジャンプテスト
    def test_inquiry_new_inquiry_MENU_jump(self):
        # 工数入力可否(ショップ単位)ページにアクセス
        response = self.client.get(reverse('inquiry_new'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('inquiry_main') + '" class="text-pink">問い合わせMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_main.html')



    # 問い合わせMENUから問い合わせ履歴へジャンプテスト
    def test_inquiry_MENU_inquiry_list_jump(self):
        # 問い合わせMENUページにアクセス
        response = self.client.get(reverse('inquiry_main'))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, 'onclick="location.href=\'/inquiry_list/1\'"')
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_list.html')



    # 問い合わせ履歴から問い合わせMENUへジャンプテスト
    def test_inquiry_list_inquiry_MENU_jump(self):
        # 問い合わせ履歴ページにアクセス
        response = self.client.get(reverse('inquiry_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('inquiry_main') + '" class="text-pink">問い合わせMENUへ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_main'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_main.html')



    # 問い合わせ履歴から問い合わせ表示へジャンプテスト
    def test_inquiry_list_inquiry_display_jump(self):
        # 問い合わせ履歴ページにアクセス
        response = self.client.get(reverse('inquiry_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('inquiry_display', args=[self.inquiry_data.id]) + '" class="text-pink">' + str(self.inquiry_data.name) + '</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_display', args=[self.inquiry_data.id]))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_display.html')



    # 問い合わせ表示から問い合わせ履歴へジャンプテスト
    def test_inquiry_display_inquiry_list_jump(self):
        # 問い合わせ表示ページにアクセス
        response = self.client.get(reverse('inquiry_display', args=[self.inquiry_data.id]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a href="' + reverse('inquiry_list', args = [1]) + '" class="text-pink">お問い合わせ履歴へ</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_list', args = [1]))

        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_list.html')



    # 問い合わせ表示から問い合わせ編集へジャンプテスト
    def test_inquiry_display_inquiry_edit(self):
        # 問い合わせ表示ページにアクセス
        response = self.client.get(reverse('inquiry_display', args=[self.inquiry_data.id]))
        self.assertEqual(response.status_code, 200)

        # 編集ボタンを押した場合のPOSTリクエスト
        response = self.client.post(reverse('inquiry_display', args=[self.inquiry_data.id]), {
            'Registration': '編集'
        })

        # 問い合わせ編集ページにリダイレクトされることを確認
        self.assertRedirects(response, reverse('inquiry_edit', args=[self.inquiry_data.id]))



    # 問い合わせ表示ページ移行ジャンプテスト
    def test_inquiry_display_jump(self):
        # Business_Time_graphダミーデータ
        for nnn in range(1, 4):
            # inquiry_dataダミーデータ
            self.inquiry_data = inquiry_data.objects.create(
                employee_no2 = '111',
                name = self.member,
                content_choice = '問い合わせ',
                inquiry = '質問内容{}'.format(nnn),
                answer = '回答'
                )

        # 2つ目の問い合わせデータ取得
        obj = inquiry_data.objects.get(inquiry = '質問内容2')

        # 問い合わせ表示ページにアクセス
        response = self.client.get(reverse('inquiry_display', args=[obj.id]))
        self.assertEqual(response.status_code, 200)

        # フォームデータ定義
        form_data = {
            'after': '◀次のデータ',
            }

        # URLに対してPOSTリクエスト送信
        response = self.client.post(reverse('inquiry_display', args=[obj.id]), form_data)
        # リクエストのレスポンスステータスコードが302(リダイレクト)であることを確認
        self.assertEqual(response.status_code, 302)

        # リダイレクト先のURLを確認
        next_obj = inquiry_data.objects.get(inquiry = '質問内容3')
        expected_url = reverse('inquiry_display', args = [next_obj.id])
        self.assertRedirects(response, expected_url)


        # 2つ目の問い合わせデータ取得
        obj = inquiry_data.objects.get(inquiry = '質問内容2')

        # 問い合わせ表示ページにアクセス
        response = self.client.get(reverse('inquiry_display', args=[obj.id]))
        self.assertEqual(response.status_code, 200)

        # フォームデータ定義
        form_data = {
            'before': '前のデータ▶',
            }

        # URLに対してPOSTリクエスト送信
        response = self.client.post(reverse('inquiry_display', args=[obj.id]), form_data)
        # リクエストのレスポンスステータスコードが302(リダイレクト)であることを確認
        self.assertEqual(response.status_code, 302)

        # リダイレクト先のURLを確認
        next_obj = inquiry_data.objects.get(inquiry = '質問内容1')
        expected_url = reverse('inquiry_display', args = [next_obj.id])
        self.assertRedirects(response, expected_url)



    # 問い合わせ履歴から問い合わせ入力へジャンプテスト
    def test_inquiry_list_inquiry_new_jump(self):
        # 問い合わせ履歴ページにアクセス
        response = self.client.get(reverse('inquiry_list', args = [1]))
        self.assertEqual(response.status_code, 200)

        # HTMLに含まれるボタンが正しく設定されているかを確認
        self.assertContains(response, '<a class="text-pink" href="' + reverse('inquiry_new') + '" >問い合わせ入力</a>', html=True)
        # ボタンを押すシミュレーション
        response = self.client.get(reverse('inquiry_new'))
        
        # リダイレクトが成功し、ステータスコードが200であることを確認
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'kosu/inquiry_new.html')











