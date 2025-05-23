from django.test import TestCase, Client
from django.urls import reverse
from datetime import datetime, timedelta
from kosu.models import member, kosu_division, Business_Time_graph, team_member, administrator_data, inquiry_data



class KosuListViewTests(TestCase):
  def setUp(self):
    self.client = Client()
    # memberダミーデータ
    for i in range(120):
        member.objects.create(
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
          break_time5 = '#10401130',
          break_time5_over1 = '#15101520',
          break_time5_over2 = '#20202110',
          break_time5_over3 = '#01400150',
          break_time6 = '#21202210',
          break_time6_over1 = '#01500200',
          break_time6_over2 = '#07000750',
          break_time6_over3 = '#12201230',
          break_check = False,
          def_prediction = False,
          )

    # administrator_dataダミーデータ
    administrator_data.objects.create(
      menu_row = 20,
      administrator_employee_no1 = '111',
      administrator_employee_no2 = '',
      administrator_employee_no3 = '',
      )

    # kosu_divisionダミーデータ
    for i in range(120):
        kosu_division.objects.create(
          kosu_name = f'トライ定義{i}',
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
    start_date = datetime(2000, 1, 1)
    # memberインスタンスを取得
    member_instance = member.objects.first()
    for i in range(120):
      date = start_date + timedelta(days=i)
      Business_Time_graph.objects.create(
        employee_no3=111,
        name=member_instance,
        def_ver2=kosu_division.kosu_name,
        work_day2=date.strftime("%Y-%m-%d"),
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
    team_member.objects.create(
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


    # セッション定義
    session = self.client.session
    session['login_No'] = '111'
    session['input_def'] =  'トライ定義'
    session['day'] =  '2000-01-01'
    session['break_today'] =  '2000-01-01'
    session['find_year'] =  2000
    session['find_month'] =  1
    session.save()



  # 工数履歴ページネーションテスト
  def test_kosu_pagination_navigation(self):
    # 最初のページにアクセス
    response = self.client.get(reverse('kosu_list', kwargs={'num': 1}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '1/6')
    
    # 2ページにアクセス
    response = self.client.get(reverse('kosu_list', kwargs={'num': 2}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '2/6')
    self.assertContains(response, '&laquo; 最初', count=1)
    self.assertNotContains(response, '/kosu_list/0">')

    # 最終ページにアクセス
    response = self.client.get(reverse('kosu_list', kwargs={'num': 6}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '6/6')
    # 最後のページでは、「次」ボタンが無効化されていることを確認
    self.assertContains(response, '次&raquo;', count=1)
    self.assertNotContains(response, '/kosu_list/7">')

    # 最後のページから「前」ボタンで5ページ目に遷移
    response = self.client.get(reverse('kosu_list', kwargs={'num': 5}))
    self.assertEqual(response.status_code, 200)
    self.assertContains(response, '5/6')



  # 人員一覧ページネーションテスト
  def test_member_pagination_navigation(self):
    # 最初のページにアクセス
    response = self.client.get(reverse('member', kwargs={'num': 1}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '1/6')
    
    # 2ページにアクセス
    response = self.client.get(reverse('member', kwargs={'num': 2}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '2/6')
    self.assertContains(response, '&laquo; 最初', count=1)
    self.assertNotContains(response, '/member/0">')

    # 最終ページにアクセス
    response = self.client.get(reverse('member', kwargs={'num': 6}))
    self.assertEqual(response.status_code, 200)
    self.assertEqual(len(response.context['data']), 20)
    self.assertContains(response, '6/6')
    # 最後のページでは、「次」ボタンが無効化されていることを確認
    self.assertContains(response, '次&raquo;', count=1)
    self.assertNotContains(response, '/member/7">')

    # 最後のページから「前」ボタンで5ページ目に遷移
    response = self.client.get(reverse('member', kwargs={'num': 5}))
    self.assertEqual(response.status_code, 200)
    self.assertContains(response, '5/6')






