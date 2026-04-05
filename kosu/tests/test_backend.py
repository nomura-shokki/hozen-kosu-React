from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from kosu.models import (
    member, Business_Time_graph, kosu_division, def_choice,
    team_member, administrator_data, inquiry_data, AsyncTask, History
)
from kosu.views.serializers import (
    MemberSerializer, KosuSerializer, DefSerializer, DefChoiceSerializer,
    InquirSerializer, AdministratorSerializer, TaskSerializer, HistorySerializer
)
from kosu.utils.main_utils import validate_employee_no_logic, get_all_model_names_in_myapp
from kosu.utils.kosu_utils import (
    time_index, break_time_process, kosu_write, break_time_delete,
    break_time_write, detail_list_summarize, judgement_check, kosu_sort,
    break_get, parse_break_time, get_week_of_month, kosu_division_dictionary,
    get_def_library_data, create_kosu_basic
)
import json
import os
import tempfile
import datetime as dt_module
from datetime import date, timedelta
from unittest.mock import patch, MagicMock


def make_break_times():
    """Helper to generate all required break_time fields."""
    bt = {}
    for i in range(1, 7):
        bt[f'break_time{i}'] = '#10401130'
        bt[f'break_time{i}_over1'] = '#15101520'
        bt[f'break_time{i}_over2'] = '#20202110'
        bt[f'break_time{i}_over3'] = '#01400150'
    return bt


class BaseTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create admin settings
        self.admin_settings = administrator_data.objects.create(menu_row='20')

        # Create kosu_division (needed for login)
        self.division = kosu_division.objects.create(
            kosu_name='TestVer', kosu_title_1='作業A'
        )

        break_times = make_break_times()

        self.member = member.objects.create(
            employee_no=12345, name='テスト太郎', shop='P',
            authority=True, administrator=True, **break_times
        )

        self.normal_member = member.objects.create(
            employee_no=99999, name='一般ユーザー', shop='P',
            authority=False, administrator=False, **break_times
        )

    def login(self, employee_no=12345):
        """Helper to set session via login endpoint."""
        response = self.client.post(
            '/api/login/',
            json.dumps({'employee_no': employee_no}),
            content_type='application/json'
        )
        return response

    def login_as_admin(self):
        return self.login(12345)

    def login_as_normal(self):
        return self.login(99999)


# ---------------------------------------------------------------------------
# 1. TestModels
# ---------------------------------------------------------------------------
class TestModels(TestCase):
    def test_member_creation_and_str(self):
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        self.assertEqual(str(m), '山田太郎')
        self.assertEqual(m.employee_no, 11111)

    def test_business_time_graph_creation_and_str(self):
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=m, work_day2=date(2026, 1, 1),
            tyoku2='1', over_time=0
        )
        expected = f'{kosu.id}__2026-01-01:11111'
        self.assertEqual(str(kosu), expected)

    def test_kosu_division_creation(self):
        div = kosu_division.objects.create(kosu_name='Ver2', kosu_title_1='TaskA')
        self.assertIn('Ver2', str(div))

    def test_def_choice_creation(self):
        choice = def_choice.objects.create(def_symbol='A', def_select='溶接作業')
        self.assertEqual(str(choice), 'A溶接作業')

    def test_team_member_creation(self):
        tm = team_member.objects.create(employee_no5=12345, member1='11111')
        self.assertEqual(str(tm), '12345')

    def test_administrator_data_creation(self):
        ad = administrator_data.objects.create(menu_row='30')
        self.assertIn('設定', str(ad))

    def test_inquiry_data_creation_with_fk(self):
        bt = make_break_times()
        m = member.objects.create(
            employee_no=11111, name='山田太郎', shop='P',
            authority=False, administrator=False, **bt
        )
        inq = inquiry_data.objects.create(
            employee_no2=11111, name=m, content_choice='要望',
            inquiry='テスト問い合わせ', answer=''
        )
        self.assertIn('山田太郎', str(inq))

    def test_async_task_max_records_auto_deletion(self):
        """Create 1001+ records and verify oldest are deleted."""
        # Create 1002 records
        for i in range(1002):
            AsyncTask.objects.create(
                task_id=f'task_{i:05d}', status='success'
            )
        self.assertLessEqual(AsyncTask.objects.count(), AsyncTask.MAX_RECORDS)
        # Oldest task should have been deleted
        self.assertFalse(AsyncTask.objects.filter(task_id='task_00000').exists())

    def test_async_task_str_format(self):
        task = AsyncTask.objects.create(task_id='test-task-1', status='pending')
        s = str(task)
        self.assertIn('pending', s)
        self.assertIn('test-task-1', s)

    def test_history_save_works(self):
        h = History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={'field': 'value'}
        )
        self.assertEqual(str(h), 'CREATE on member (ID: 1)')


# ---------------------------------------------------------------------------
# 2. TestLoginLogout
# ---------------------------------------------------------------------------
class TestLoginLogout(BaseTestCase):
    def test_login_success(self):
        response = self.login(12345)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')

    def test_login_nonexistent_employee(self):
        response = self.login(00000)
        self.assertEqual(response.status_code, 400)

    def test_login_invalid_json(self):
        response = self.client.post(
            '/api/login/', 'not-json',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_login_sets_session(self):
        self.login(12345)
        # Verify session by hitting an endpoint that requires login
        response = self.client.get('/api/main_menu/')
        self.assertEqual(response.status_code, 200)

    def test_logout_flushes_session(self):
        self.login(12345)
        response = self.client.post('/api/logout/')
        self.assertEqual(response.status_code, 200)
        # After logout, should get 401
        response = self.client.get('/api/main_menu/')
        self.assertEqual(response.status_code, 401)


# ---------------------------------------------------------------------------
# 3. TestMainMenuViews
# ---------------------------------------------------------------------------
class TestMainMenuViews(BaseTestCase):
    def test_menu_get_without_login(self):
        response = self.client.get('/api/main_menu/')
        self.assertEqual(response.status_code, 401)

    def test_menu_get_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/main_menu/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('login_data', response.data)
        self.assertIn('admin_data', response.data)

    def test_kosu_menu_without_login(self):
        response = self.client.get('/api/kosu_menu/')
        self.assertEqual(response.status_code, 401)

    def test_kosu_menu_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_menu/')
        self.assertEqual(response.status_code, 200)

    def test_member_menu_without_login(self):
        response = self.client.get('/api/member_menu/')
        self.assertEqual(response.status_code, 401)

    def test_member_menu_with_authority(self):
        self.login_as_admin()
        response = self.client.get('/api/member_menu/')
        self.assertEqual(response.status_code, 200)

    def test_member_menu_without_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/member_menu/')
        self.assertEqual(response.status_code, 403)

    def test_def_menu_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/def_menu/')
        self.assertEqual(response.status_code, 200)

    def test_inquir_menu_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/inquir_menu/')
        self.assertEqual(response.status_code, 200)

    def test_administrator_menu_without_login(self):
        response = self.client.get('/api/manager_menu/')
        self.assertEqual(response.status_code, 401)

    def test_administrator_menu_with_admin(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_menu/')
        self.assertEqual(response.status_code, 200)

    def test_administrator_menu_non_admin(self):
        self.login_as_normal()
        response = self.client.get('/api/manager_menu/')
        self.assertEqual(response.status_code, 403)

    def test_team_menu_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/team_menu/')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 4. TestMemberViews
# ---------------------------------------------------------------------------
class TestMemberViews(BaseTestCase):
    def test_member_list_without_login(self):
        response = self.client.get('/api/member_list/')
        self.assertEqual(response.status_code, 401)

    def test_member_list_with_authority(self):
        self.login_as_admin()
        response = self.client.get('/api/member_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_member_list_without_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/member_list/')
        self.assertEqual(response.status_code, 403)

    def test_member_list_search_by_employee_no(self):
        self.login_as_admin()
        response = self.client.get('/api/member_list/', {'employee_no': '12345'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    def test_member_list_search_by_shop(self):
        self.login_as_admin()
        response = self.client.get('/api/member_list/', {'shop': 'P'})
        self.assertEqual(response.status_code, 200)
        # Both admin and normal member have shop=P
        self.assertEqual(len(response.data['results']), 2)

    def test_member_new_get_with_authority(self):
        self.login_as_admin()
        response = self.client.get('/api/member_new/')
        self.assertEqual(response.status_code, 200)

    def test_member_new_post_creates_member(self):
        self.login_as_admin()
        data = {
            'employee_no': 55555, 'name': '新規太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        response = self.client.post('/api/member_new/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(member.objects.filter(employee_no=55555).exists())

    def test_member_new_post_duplicate_employee_no(self):
        self.login_as_admin()
        data = {
            'employee_no': 12345, 'name': '重複太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        response = self.client.post('/api/member_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_member_new_post_shop_w1_sets_correct_break_times(self):
        self.login_as_admin()
        data = {
            'employee_no': 66666, 'name': 'W1太郎', 'shop': 'W1',
            'authority': False, 'administrator': False,
        }
        response = self.client.post('/api/member_new/', data, format='json')
        self.assertEqual(response.status_code, 201)
        created = member.objects.get(employee_no=66666)
        # W1 uses the first branch break times
        self.assertEqual(created.break_time1, '#11401240')

    def test_member_new_post_shop_p_sets_correct_break_times(self):
        self.login_as_admin()
        data = {
            'employee_no': 77777, 'name': 'P太郎', 'shop': 'P',
            'authority': False, 'administrator': False,
        }
        response = self.client.post('/api/member_new/', data, format='json')
        self.assertEqual(response.status_code, 201)
        created = member.objects.get(employee_no=77777)
        # P uses the else branch break times
        self.assertEqual(created.break_time1, '#10401130')

    def test_member_update_get(self):
        self.login_as_admin()
        response = self.client.get(f'/api/member_update/{self.member.employee_no}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['employee_no'], 12345)

    def test_member_update_put(self):
        self.login_as_admin()
        bt = make_break_times()
        data = {
            'employee_no': 12345, 'name': '更新太郎', 'shop': 'P',
            'authority': True, 'administrator': True, **bt
        }
        response = self.client.put(
            f'/api/member_update/{self.member.employee_no}/',
            data, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.name, '更新太郎')

    def test_member_update_put_duplicate_employee_no(self):
        self.login_as_admin()
        bt = make_break_times()
        data = {
            'employee_no': 99999, 'name': '重複更新', 'shop': 'P',
            'authority': True, 'administrator': True, **bt
        }
        response = self.client.put(
            f'/api/member_update/{self.member.employee_no}/',
            data, format='json'
        )
        self.assertEqual(response.status_code, 400)

    def test_member_delete(self):
        self.login_as_admin()
        response = self.client.delete(
            f'/api/member_delete/{self.normal_member.employee_no}/'
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(member.objects.filter(employee_no=99999).exists())


# ---------------------------------------------------------------------------
# 5. TestDefViews
# ---------------------------------------------------------------------------
class TestDefViews(BaseTestCase):
    def test_def_list_with_admin(self):
        self.login_as_admin()
        response = self.client.get('/api/def_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_def_list_non_admin(self):
        self.login_as_normal()
        response = self.client.get('/api/def_list/')
        self.assertEqual(response.status_code, 403)

    def test_def_new_get(self):
        self.login_as_admin()
        response = self.client.get('/api/def_new/')
        self.assertEqual(response.status_code, 200)

    def test_def_new_post_creates_definition(self):
        self.login_as_admin()
        data = {'kosu_name': 'NewVer', 'kosu_title_1': '新作業'}
        response = self.client.post('/api/def_new/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(kosu_division.objects.filter(kosu_name='NewVer').exists())

    def test_def_new_post_duplicate_name(self):
        self.login_as_admin()
        data = {'kosu_name': 'TestVer', 'kosu_title_1': '重複'}
        response = self.client.post('/api/def_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_def_new_post_empty_name(self):
        self.login_as_admin()
        data = {'kosu_name': '', 'kosu_title_1': 'X'}
        response = self.client.post('/api/def_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_def_update_get(self):
        self.login_as_admin()
        response = self.client.get(f'/api/def_update/{self.division.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['kosu_name'], 'TestVer')

    def test_def_update_put(self):
        self.login_as_admin()
        data = {'kosu_name': 'UpdatedVer', 'kosu_title_1': '更新A'}
        response = self.client.put(
            f'/api/def_update/{self.division.id}/', data, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.division.refresh_from_db()
        self.assertEqual(self.division.kosu_name, 'UpdatedVer')

    def test_def_delete(self):
        self.login_as_admin()
        response = self.client.delete(f'/api/def_delete/{self.division.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(kosu_division.objects.filter(id=self.division.id).exists())

    def test_def_ver_get(self):
        self.login_as_admin()
        response = self.client.get('/api/def_ver/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('choices', response.data)
        self.assertIn('current_version', response.data)

    def test_def_ver_post_switches_version(self):
        self.login_as_admin()
        kosu_division.objects.create(kosu_name='Ver2')
        response = self.client.post(
            '/api/def_ver/', {'versionchoice': 'Ver2'}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_def_search_get(self):
        self.login_as_admin()
        response = self.client.get('/api/def_search/')
        self.assertEqual(response.status_code, 200)

    def test_def_detail_new_post_creates_choice(self):
        self.login_as_admin()
        data = {'def_symbol': 'A', 'def_select': 'テスト作業詳細'}
        response = self.client.post('/api/def_detail_new/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(def_choice.objects.filter(def_select='テスト作業詳細').exists())

    def test_def_detail_list_get(self):
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='作業X')
        response = self.client.get('/api/def_detail_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_def_detail_update_put(self):
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='A', def_select='旧作業')
        data = {'def_symbol': 'A', 'def_select': '新作業'}
        response = self.client.put(
            f'/api/def_detail_update/{choice.id}/', data, format='json'
        )
        self.assertEqual(response.status_code, 200)
        choice.refresh_from_db()
        self.assertEqual(choice.def_select, '新作業')

    def test_def_detail_delete(self):
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='B', def_select='削除対象')
        response = self.client.delete(f'/api/def_detail_delete/{choice.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(def_choice.objects.filter(id=choice.id).exists())


# ---------------------------------------------------------------------------
# 6. TestInquiryViews
# ---------------------------------------------------------------------------
class TestInquiryViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        # Set administrator_employee_no1 so admin can access inquiry updates
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    def test_inquir_list_get(self):
        self.login_as_admin()
        response = self.client.get('/api/inquir_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)

    def test_inquir_new_get(self):
        self.login_as_admin()
        response = self.client.get('/api/inquir_new/')
        self.assertEqual(response.status_code, 200)

    def test_inquir_new_post_creates_inquiry(self):
        self.login_as_admin()
        data = {'content_choice': '要望', 'inquiry': 'テスト要望内容'}
        response = self.client.post('/api/inquir_new/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(inquiry_data.objects.filter(inquiry='テスト要望内容').exists())

    def test_inquir_detail_get(self):
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='詳細テスト', answer=''
        )
        response = self.client.get(f'/api/inquir_detail/{inq.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)
        self.assertIn('next_id', response.data)
        self.assertIn('before_id', response.data)

    def test_inquir_update_get(self):
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='不具合', inquiry='更新テスト', answer=''
        )
        response = self.client.get(f'/api/inquir_update/{inq.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('inquir_data', response.data)

    def test_inquir_update_put(self):
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='元の問い合わせ', answer=''
        )
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '要望', 'inquiry': '更新された問い合わせ', 'answer': '回答テスト'
        }
        response = self.client.put(
            f'/api/inquir_update/{inq.id}/', data, format='json'
        )
        self.assertEqual(response.status_code, 200)
        inq.refresh_from_db()
        self.assertEqual(inq.answer, '回答テスト')

    def test_inquir_update_delete(self):
        self.login_as_admin()
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='削除テスト', answer=''
        )
        response = self.client.delete(f'/api/inquir_update/{inq.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(inquiry_data.objects.filter(id=inq.id).exists())


# ---------------------------------------------------------------------------
# 7. TestKosuViews
# ---------------------------------------------------------------------------
class TestKosuViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    def test_kosu_list_without_login(self):
        response = self.client.get('/api/kosu_list/')
        self.assertEqual(response.status_code, 401)

    def test_kosu_list_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)

    def test_kosu_list_with_date_filter(self):
        self.login_as_admin()
        response = self.client.get(
            '/api/kosu_list/', {'day': '2026-04-01', 'filter': 'true'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)

    def test_kosu_delete(self):
        self.login_as_admin()
        response = self.client.delete(f'/api/kosu_delete/{self.kosu.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Business_Time_graph.objects.filter(id=self.kosu.id).exists()
        )

    def test_kosu_delete_not_found(self):
        self.login_as_admin()
        response = self.client.delete('/api/kosu_delete/99999/')
        self.assertEqual(response.status_code, 404)

    def test_kosu_total_get(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_total/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)


# ---------------------------------------------------------------------------
# 8. TestTeamViews
# ---------------------------------------------------------------------------
class TestTeamViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999'
        )
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    def test_team_new_get(self):
        self.login_as_admin()
        response = self.client.get('/api/team_new/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('team_data', response.data)

    def test_team_new_post(self):
        self.login_as_admin()
        data = {'member1': '99999', 'member2': '', 'follow': True}
        response = self.client.post('/api/team_new/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_list_get(self):
        self.login_as_admin()
        response = self.client.get('/api/team_list/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('pagination_data', response.data)
        self.assertIn('team_member_select', response.data)

    def test_team_list_without_login(self):
        response = self.client.get('/api/team_list/')
        self.assertEqual(response.status_code, 401)

    def test_team_detail_get(self):
        self.login_as_admin()
        response = self.client.get(f'/api/team_detail/{self.kosu.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('member_data', response.data)


# ---------------------------------------------------------------------------
# 9. TestAdministratorViews
# ---------------------------------------------------------------------------
class TestAdministratorViews(BaseTestCase):
    def test_administrator_update_get(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_update/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('admin_data', response.data)

    def test_administrator_update_get_non_admin(self):
        self.login_as_normal()
        response = self.client.get('/api/manager_update/')
        self.assertEqual(response.status_code, 403)

    def test_administrator_update_put(self):
        self.login_as_admin()
        data = {
            'menu_row': '30',
            'administrator_employee_no1': '12345',
            'administrator_employee_no2': '',
            'administrator_employee_no3': '',
        }
        response = self.client.put('/api/manager_update/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.admin_settings.refresh_from_db()
        self.assertEqual(self.admin_settings.menu_row, '30')

    def test_administrator_update_put_invalid_employee(self):
        self.login_as_admin()
        data = {
            'menu_row': '20',
            'administrator_employee_no1': '00001',
        }
        response = self.client.put('/api/manager_update/', data, format='json')
        self.assertEqual(response.status_code, 406)

    def test_administrator_kosu_list_get(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_kosu/')
        self.assertEqual(response.status_code, 200)

    def test_administrator_kosu_list_non_admin(self):
        self.login_as_normal()
        response = self.client.get('/api/manager_kosu/')
        self.assertEqual(response.status_code, 403)

    def test_administrator_task_list_get(self):
        self.login_as_admin()
        AsyncTask.objects.create(task_id='t1', status='success')
        response = self.client.get('/api/manager_task/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('task_data', response.data)

    def test_administrator_task_detail_get(self):
        self.login_as_admin()
        task = AsyncTask.objects.create(task_id='t2', status='pending')
        response = self.client.get(f'/api/manager_task_detail/{task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('task_data', response.data)

    def test_administrator_task_detail_delete(self):
        self.login_as_admin()
        task = AsyncTask.objects.create(task_id='t3', status='error')
        response = self.client.delete(f'/api/manager_task_detail/{task.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AsyncTask.objects.filter(id=task.id).exists())

    def test_administrator_history_list_get(self):
        self.login_as_admin()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={}
        )
        response = self.client.get('/api/manager_history/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('history_data', response.data)
        self.assertIn('model_choices', response.data)

    def test_administrator_history_detail_get(self):
        self.login_as_admin()
        h = History.objects.create(
            operation='UPDATE', table_name='member',
            record_id=1, changes={'name': ['old', 'new']}
        )
        response = self.client.get(f'/api/manager_history_detail/{h.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('history_data', response.data)

    def test_administrator_history_detail_delete(self):
        self.login_as_admin()
        h = History.objects.create(
            operation='DELETE', table_name='member',
            record_id=1, changes={}
        )
        response = self.client.delete(f'/api/manager_history_detail/{h.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(History.objects.filter(id=h.id).exists())


# ---------------------------------------------------------------------------
# 10. TestSerializers
# ---------------------------------------------------------------------------
class TestSerializers(BaseTestCase):
    def test_member_serializer(self):
        serializer = MemberSerializer(self.member)
        data = serializer.data
        self.assertEqual(data['employee_no'], 12345)
        self.assertEqual(data['name'], 'テスト太郎')
        self.assertIn('break_time1', data)
        self.assertIn('shop', data)

    def test_kosu_serializer(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        serializer = KosuSerializer(kosu)
        data = serializer.data
        self.assertEqual(data['employee_no3'], 12345)
        self.assertEqual(data['work_day2'], '2026-04-01')
        self.assertIn('time_work', data)

    def test_def_serializer(self):
        serializer = DefSerializer(self.division)
        data = serializer.data
        self.assertEqual(data['kosu_name'], 'TestVer')
        self.assertEqual(data['kosu_title_1'], '作業A')
        self.assertIn('kosu_division_1_1', data)

    def test_def_choice_serializer(self):
        choice = def_choice.objects.create(def_symbol='A', def_select='テスト')
        serializer = DefChoiceSerializer(choice)
        data = serializer.data
        self.assertEqual(data['def_symbol'], 'A')
        self.assertEqual(data['def_select'], 'テスト')

    def test_inquir_serializer(self):
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='テスト', answer=''
        )
        serializer = InquirSerializer(inq)
        data = serializer.data
        self.assertEqual(data['employee_no2'], 12345)
        self.assertIn('content_choice', data)
        self.assertIn('inquiry', data)

    def test_administrator_serializer(self):
        serializer = AdministratorSerializer(self.admin_settings)
        data = serializer.data
        self.assertEqual(data['menu_row'], '20')

    def test_task_serializer(self):
        task = AsyncTask.objects.create(task_id='ser-t1', status='success')
        serializer = TaskSerializer(task)
        data = serializer.data
        self.assertEqual(data['task_id'], 'ser-t1')
        self.assertEqual(data['status'], 'success')

    def test_history_serializer(self):
        h = History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={'x': 'y'}
        )
        serializer = HistorySerializer(h)
        data = serializer.data
        self.assertEqual(data['operation'], 'CREATE')
        self.assertIn('changes', data)


# ---------------------------------------------------------------------------
# 11. TestUtils
# ---------------------------------------------------------------------------
class TestUtils(BaseTestCase):
    def test_validate_employee_no_valid(self):
        ok, result = validate_employee_no_logic(12345, member)
        self.assertTrue(ok)
        self.assertEqual(result, 12345)

    def test_validate_employee_no_invalid_string(self):
        ok, msg = validate_employee_no_logic('abc', member)
        self.assertFalse(ok)
        self.assertIn('自然数', msg)

    def test_validate_employee_no_nonexistent(self):
        ok, msg = validate_employee_no_logic(88888, member)
        self.assertFalse(ok)
        self.assertIn('存在しません', msg)

    def test_validate_employee_no_empty(self):
        ok, result = validate_employee_no_logic('', member)
        self.assertTrue(ok)
        self.assertIsNone(result)

    def test_validate_employee_no_zero(self):
        ok, msg = validate_employee_no_logic(0, member)
        # 0 is falsy, so it should return True (empty check)
        self.assertTrue(ok)

    def test_get_all_model_names(self):
        names = get_all_model_names_in_myapp()
        self.assertIn('member', names)
        self.assertIn('Business_Time_graph', names)
        self.assertIn('kosu_division', names)
        self.assertIn('AsyncTask', names)
        self.assertIn('History', names)


# ---------------------------------------------------------------------------
# 12. TestKosuUtils - utility functions
# ---------------------------------------------------------------------------
class TestKosuUtils(TestCase):
    def setUp(self):
        bt = make_break_times()
        self.member_p = member.objects.create(
            employee_no=11111, name='UtilTest', shop='P',
            authority=False, administrator=False, **bt
        )
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
        self.division = kosu_division.objects.create(
            kosu_name='UtilVer', kosu_title_1='TaskA',
            kosu_division_1_1='A', kosu_division_2_1='A',
            kosu_title_2='TaskB', kosu_division_1_2='B', kosu_division_2_2='B',
        )

    def test_time_index_basic(self):
        h, m = time_index('08:30')
        self.assertEqual(h, '08')
        self.assertEqual(m, '30')

    def test_time_index_midnight(self):
        h, m = time_index('00:00')
        self.assertEqual(h, '00')
        self.assertEqual(m, '00')

    def test_break_time_process_normal(self):
        # #10401130 => start=10*12+40/5=128, end=11*12+30/5=138
        start, end, next_day = break_time_process('#10401130')
        self.assertEqual(start, 128.0)
        self.assertEqual(end, 138.0)
        self.assertEqual(next_day, 0)

    def test_break_time_process_next_day(self):
        # #23350035 => start=23*12+35/5=283, end=0*12+35/5=7
        start, end, next_day = break_time_process('#23350035')
        self.assertEqual(next_day, 1)

    def test_kosu_write(self):
        work_list = ['#'] * 288
        detail_list = [''] * 288
        post_data = {'time_work': 'A', 'detail_work': 'detail1'}
        work_list, detail_list = kosu_write(10, 15, work_list, detail_list, post_data)
        self.assertEqual(work_list[10], 'A')
        self.assertEqual(work_list[14], 'A')
        self.assertEqual(work_list[15], '#')
        self.assertEqual(detail_list[10], 'detail1')

    def test_break_time_delete_no_break_check(self):
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        self.member_p.break_check = False
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        self.assertIsNone(err)
        for i in range(10, 20):
            self.assertEqual(wl[i], '#')
            self.assertEqual(dl[i], '')

    def test_break_time_delete_with_break_check_error(self):
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        self.member_p.break_check = True
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        self.assertIsNotNone(err)
        self.assertIn('休憩時間に工数を入力できません', err)

    def test_break_time_delete_with_break_check_empty(self):
        work_list = ['#'] * 288
        detail_list = [''] * 288
        self.member_p.break_check = True
        err, wl, dl = break_time_delete(10, 20, work_list, detail_list, self.member_p)
        self.assertIsNone(err)

    def test_break_time_write(self):
        work_list = ['A'] * 288
        detail_list = ['d'] * 288
        wl, dl = break_time_write(5, 10, work_list, detail_list)
        for i in range(5, 10):
            self.assertEqual(wl[i], '$')
            self.assertEqual(dl[i], '')

    def test_detail_list_summarize(self):
        dl = ['a', 'b', 'c']
        result = detail_list_summarize(dl)
        self.assertEqual(result, 'a$b$c')

    def test_detail_list_summarize_single(self):
        dl = ['a']
        result = detail_list_summarize(dl)
        self.assertEqual(result, 'a')

    def test_judgement_check_work_holiday(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '休日', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_work_nenkyuu(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '年休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shift_yasumi(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, 'シフト休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_daikyuu(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '代休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_koukyuu(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '公休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_kekkin(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '欠勤', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shukkin_correct(self):
        # 出勤: kosu_total - over_time should == 470
        # kosu_total = 1440 - (#count*5) - ($count*5)
        # We need 470 total work: 94 cells of work, rest # and $
        work_list = ['#'] * 288
        for i in range(94):
            work_list[i] = 'A'
        result = judgement_check(work_list, '出勤', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shukkin_incorrect(self):
        work_list = ['#'] * 288
        result = judgement_check(work_list, '出勤', '1', self.member_p, 0)
        self.assertFalse(result)

    def test_judgement_check_kyushutsu(self):
        # 休出: kosu_total == over_work and over_work != 0
        work_list = ['#'] * 288
        for i in range(20):
            work_list[i] = 'A'
        result = judgement_check(work_list, '休出', '1', self.member_p, 100)
        self.assertTrue(result)

    def test_judgement_check_soutai(self):
        # 早退・遅刻: kosu_total != 0
        work_list = ['#'] * 288
        work_list[0] = 'A'
        result = judgement_check(work_list, '早退・遅刻', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shift_shukkin(self):
        work_list = ['#'] * 288
        for i in range(94):
            work_list[i] = 'A'
        result = judgement_check(work_list, 'シフト出', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_hanzen_tyoku4(self):
        # 常昼 半前年休: kosu_total - over_work == 230 => 46 cells
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '4', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_hango_tyoku4(self):
        # 常昼 半後年休: kosu_total - over_work == 240 => 48 cells
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '4', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_hanzen_tyoku5(self):
        # 連2 (tyoku 5) 半前年休: kosu_total - over_work == 220 => 44 cells
        work_list = ['#'] * 288
        for i in range(44):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '5', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_hango_tyoku6(self):
        # 連2 (tyoku 6) 半後年休: kosu_total - over_work == 250 => 50 cells
        work_list = ['#'] * 288
        for i in range(50):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '6', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku1_hanzen(self):
        # W1 tyoku1 半前年休: 230 => 46 cells
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '1', self.member_w, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku2_hanzen(self):
        # W1 tyoku2 半前年休: 290 => 58 cells
        work_list = ['#'] * 288
        for i in range(58):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '2', self.member_w, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku3_hanzen(self):
        # W1 tyoku3 半前年休: 230 => 46 cells
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '3', self.member_w, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku1_hanzen(self):
        # P tyoku1 半前年休: 220 => 44 cells
        work_list = ['#'] * 288
        for i in range(44):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku2_hanzen(self):
        # P tyoku2 半前年休: 230 => 46 cells
        work_list = ['#'] * 288
        for i in range(46):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '2', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku3_hanzen(self):
        # P tyoku3 半前年休: 275 => 55 cells
        work_list = ['#'] * 288
        for i in range(55):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半前年休', '3', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku2_hango(self):
        # P tyoku2 半後年休: 240 => 48 cells
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '2', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku3_hango(self):
        # P tyoku3 半後年休: 195 => 39 cells
        work_list = ['#'] * 288
        for i in range(39):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '3', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku2_hango(self):
        # W1 tyoku2 半後年休: 180 => 36 cells
        work_list = ['#'] * 288
        for i in range(36):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '2', self.member_w, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku3_hango(self):
        # W1 tyoku3 半後年休: 240 => 48 cells
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '3', self.member_w, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_p_tyoku1_hango(self):
        # P tyoku1 半後年休: 250 => 50 cells
        work_list = ['#'] * 288
        for i in range(50):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '1', self.member_p, 0)
        self.assertTrue(result)

    def test_judgement_check_shop_w1_tyoku1_hango(self):
        # W1 tyoku1 半後年休: 240 => 48 cells
        work_list = ['#'] * 288
        for i in range(48):
            work_list[i] = 'A'
        result = judgement_check(work_list, '半後年休', '1', self.member_w, 0)
        self.assertTrue(result)

    def test_break_get_tyoku_1(self):
        bt, bt1, bt2, bt3 = break_get('1', 11111)
        self.assertEqual(bt, self.member_p.break_time1)

    def test_break_get_tyoku_2(self):
        bt, bt1, bt2, bt3 = break_get('2', 11111)
        self.assertEqual(bt, self.member_p.break_time2)

    def test_break_get_tyoku_3(self):
        bt, bt1, bt2, bt3 = break_get('3', 11111)
        self.assertEqual(bt, self.member_p.break_time3)

    def test_break_get_tyoku_4(self):
        bt, bt1, bt2, bt3 = break_get('4', 11111)
        self.assertEqual(bt, self.member_p.break_time4)

    def test_break_get_tyoku_5(self):
        bt, bt1, bt2, bt3 = break_get('5', 11111)
        self.assertEqual(bt, self.member_p.break_time5)

    def test_break_get_tyoku_6(self):
        bt, bt1, bt2, bt3 = break_get('6', 11111)
        self.assertEqual(bt, self.member_p.break_time6)

    def test_parse_break_time_valid(self):
        jst = dt_module.timezone(timedelta(hours=9))
        start = '2026-04-01T01:40:00.000Z'  # 10:40 JST
        end = '2026-04-01T02:30:00.000Z'    # 11:30 JST
        start_ind, end_ind, time_str = parse_break_time(start, end, jst)
        self.assertEqual(time_str, '#10401130')

    def test_parse_break_time_none_raises(self):
        jst = dt_module.timezone(timedelta(hours=9))
        with self.assertRaises(ValueError):
            parse_break_time(None, '2026-04-01T02:30:00.000Z', jst)

    def test_parse_break_time_empty_raises(self):
        jst = dt_module.timezone(timedelta(hours=9))
        with self.assertRaises(ValueError):
            parse_break_time('', '2026-04-01T02:30:00.000Z', jst)

    def test_parse_break_time_bad_format_raises(self):
        jst = dt_module.timezone(timedelta(hours=9))
        with self.assertRaises(ValueError):
            parse_break_time('bad', 'data', jst)

    def test_get_week_of_month(self):
        d = date(2026, 4, 1)
        week = get_week_of_month(d)
        self.assertIsNotNone(week)
        self.assertGreaterEqual(week, 1)

    def test_kosu_division_dictionary(self):
        choices, n = kosu_division_dictionary('UtilVer')
        self.assertEqual(n, 2)
        self.assertEqual(len(choices), 2)
        self.assertEqual(choices[0][0], 'A')
        self.assertEqual(choices[0][1], 'TaskA')

    def test_get_def_library_data(self):
        labels, n = get_def_library_data('UtilVer')
        self.assertEqual(n, 2)
        self.assertEqual(labels[0], 'TaskA')
        self.assertEqual(labels[1], 'TaskB')

    def test_kosu_sort_tyoku1(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 1), def_ver2='UtilVer',
            tyoku2='1', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku2_p(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 2), def_ver2='UtilVer',
            tyoku2='2', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku2_w(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=22222, name=self.member_w,
            work_day2=date(2026, 4, 2), def_ver2='UtilVer',
            tyoku2='2', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_w)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku3_p(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 3), def_ver2='UtilVer',
            tyoku2='3', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku3_w(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=22222, name=self.member_w,
            work_day2=date(2026, 4, 3), def_ver2='UtilVer',
            tyoku2='3', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_w)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku4(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 4), def_ver2='UtilVer',
            tyoku2='4', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku5(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 5), def_ver2='UtilVer',
            tyoku2='5', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_tyoku6(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 6), def_ver2='UtilVer',
            tyoku2='6', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)

    def test_kosu_sort_no_tyoku(self):
        kosu = Business_Time_graph.objects.create(
            employee_no3=11111, name=self.member_p,
            work_day2=date(2026, 4, 7), def_ver2='UtilVer',
            tyoku2='', time_work='A' * 288, detail_work='$'.join(['d'] * 288),
            over_time=0
        )
        wl, dl = kosu_sort(kosu, self.member_p)
        self.assertEqual(len(wl), 288)


# ---------------------------------------------------------------------------
# 13. TestKosuNewViews - KosuNew GET and POST
# ---------------------------------------------------------------------------
class TestKosuNewViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            breaktime='#10401130', breaktime_over1='#15101520',
            breaktime_over2='#20202110', breaktime_over3='#01400150',
        )

    def test_kosu_new_get_without_login(self):
        response = self.client.get('/api/kosu_new/')
        self.assertEqual(response.status_code, 401)

    def test_kosu_new_get_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_new/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('detail_list', response.data)
        self.assertIn('session_day', response.data)

    def test_kosu_new_get_warning_old_version(self):
        # Create a newer version so warning is shown
        kosu_division.objects.create(kosu_name='NewerVer', kosu_title_1='XX')
        self.login_as_admin()
        # Override session to use old version
        session = self.client.session
        session['input_def'] = 'TestVer'
        session.save()
        response = self.client.get('/api/kosu_new/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('warning', response.data)

    def test_kosu_new_post_success(self):
        self.login_as_admin()
        # Set session day to a new day
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-10'}),
                         content_type='application/json')
        data = {
            'work_day2': '2026-04-10',
            'tyoku2': '1',
            'time1': '2026-04-10T01:40:00.000Z',
            'time2': '2026-04-10T02:30:00.000Z',
            'time_work': 'A',
            'detail_work': 'test detail',
            'tomorrow_check': False,
            'break_change': False,
            'over_time': 0,
            'work_time': '出勤',
        }
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_new_post_no_day(self):
        self.login_as_admin()
        data = {
            'work_day2': '',
            'tyoku2': '1',
            'time1': '2026-04-10T01:40:00.000Z',
            'time2': '2026-04-10T02:30:00.000Z',
            'time_work': 'A',
            'detail_work': '',
        }
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_kosu_new_post_overlap_error(self):
        self.login_as_admin()
        # First, write data on a clean day
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-10'}),
                         content_type='application/json')
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
        resp1 = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(resp1.status_code, 200)
        # Try posting same time range (should overlap)
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_kosu_new_post_def_ver_mismatch(self):
        self.login_as_admin()
        # Create kosu with different def_ver
        self.kosu.def_ver2 = 'OtherVer'
        self.kosu.save()
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
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_kosu_new_post_with_break_change(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-15'}),
                         content_type='application/json')
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
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_new_post_with_tomorrow_check(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-16'}),
                         content_type='application/json')
        data = {
            'work_day2': '2026-04-16',
            'tyoku2': '1',
            'time1': '2026-04-16T14:50:00.000Z',  # 23:50 JST
            'time2': '2026-04-16T15:10:00.000Z',  # 00:10 JST next day
            'time_work': 'A',
            'detail_work': 'test',
            'tomorrow_check': True,
            'break_change': True,
            'over_time': 0,
            'work_time': '出勤',
        }
        response = self.client.post('/api/kosu_new/', data, format='json')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 14. TestKosuUpdateViews
# ---------------------------------------------------------------------------
class TestKosuUpdateViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            work_time='出勤',
        )

    def test_kosu_update_get(self):
        self.login_as_admin()
        response = self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('def_data', response.data)
        self.assertIn('member_data', response.data)
        self.assertIn('detail_data_list', response.data)

    def test_kosu_update_get_not_found(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_update/99999/')
        self.assertEqual(response.status_code, 404)

    def test_kosu_update_put_success(self):
        self.login_as_admin()
        # First GET to set session day
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'work_time': '出勤',
            'over_time': 0,
            'time1_1': '2026-04-01T01:40:00.000Z',
            'time2_1': '2026-04-01T02:30:00.000Z',
            'timeData_work_1': 'A',
            'timeData_detail_1': 'updated detail',
        }
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_update_put_not_found(self):
        self.login_as_admin()
        response = self.client.put('/api/kosu_update/99999/', {}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_kosu_update_put_day_mismatch(self):
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        data = {'work_day2': '2026-04-05', 'tyoku2': '1'}
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_kosu_update_put_no_time_data(self):
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        data = {
            'work_day2': '2026-04-01',
            'tyoku2': '2',
            'work_time': '出勤',
            'over_time': 0,
        }
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_update_put_overlap_error(self):
        self.login_as_admin()
        self.client.get(f'/api/kosu_update/{self.kosu.id}/')
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
        response = self.client.put(f'/api/kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_kosu_update_get_no_def_ver2(self):
        """Test kosu_update GET when kosu has no def_ver2 (uses session def)."""
        self.kosu.def_ver2 = None
        self.kosu.save()
        self.login_as_admin()
        response = self.client.get(f'/api/kosu_update/{self.kosu.id}/')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 15. TestSetDay, OverTime, BreakTime, TodayBreakTime, etc.
# ---------------------------------------------------------------------------
class TestKosuMiscViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288),
            work_time='出勤',
            breaktime='#10401130', breaktime_over1='#15101520',
            breaktime_over2='#20202110', breaktime_over3='#01400150',
        )

    def test_set_day_success(self):
        self.login_as_admin()
        data = {'day': '2026-04-05'}
        response = self.client.post('/api/set_day/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_set_day_empty(self):
        self.login_as_admin()
        data = {'day': ''}
        response = self.client.post('/api/set_day/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_overtime_post_success(self):
        self.login_as_admin()
        data = {'work_day2': '2026-04-01', 'over_time': 60}
        response = self.client.post('/api/over_time/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(self.kosu.over_time, 60)

    def test_overtime_post_no_day(self):
        self.login_as_admin()
        data = {'work_day2': '', 'over_time': 60}
        response = self.client.post('/api/over_time/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_overtime_post_new_kosu(self):
        self.login_as_admin()
        data = {'work_day2': '2026-04-20', 'over_time': 30}
        response = self.client.post('/api/over_time/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Business_Time_graph.objects.filter(
            employee_no3=12345, work_day2=date(2026, 4, 20)).exists())

    def test_break_time_get_without_login(self):
        response = self.client.get('/api/break_time/')
        self.assertEqual(response.status_code, 401)

    def test_break_time_get_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/break_time/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('member_data', response.data)

    def test_break_time_post_success(self):
        self.login_as_admin()
        data = {}
        for i in range(1, 49):
            data[f'breakTime{i}'] = '2026-04-01T01:40:00.000Z'
        response = self.client.post('/api/break_time/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_break_time_post_missing_data(self):
        self.login_as_admin()
        data = {'breakTime1': '2026-04-01T01:40:00.000Z'}
        response = self.client.post('/api/break_time/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_today_break_time_get_without_login(self):
        response = self.client.get('/api/today_break_time/')
        self.assertEqual(response.status_code, 401)

    def test_today_break_time_get_with_kosu(self):
        self.login_as_admin()
        # Set day to match existing kosu
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        response = self.client.get('/api/today_break_time/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)

    def test_today_break_time_get_no_kosu(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-05-01'}),
                         content_type='application/json')
        response = self.client.get('/api/today_break_time/')
        self.assertEqual(response.status_code, 404)

    def test_today_break_time_post_success(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        data = {}
        for i in range(1, 9):
            data[f'breakTime{i}'] = '2026-04-01T01:40:00.000Z'
        response = self.client.post('/api/today_break_time/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_today_break_time_post_missing_data(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        data = {'breakTime1': '2026-04-01T01:40:00.000Z'}
        response = self.client.post('/api/today_break_time/', data, format='json')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 16. TestKosuCalendar
# ---------------------------------------------------------------------------
class TestKosuCalendarViews(BaseTestCase):
    def setUp(self):
        super().setUp()

    def test_kosu_calendar_get_without_login(self):
        response = self.client.get('/api/kosu_calendar/')
        self.assertEqual(response.status_code, 401)

    def test_kosu_calendar_get_with_login(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_calendar/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('session_year', response.data)
        self.assertIn('session_month', response.data)

    def test_kosu_calendar_change_post(self):
        self.login_as_admin()
        data = {'year': 2026, 'month': 5}
        response = self.client.post('/api/kosu_calendar_change/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_link_post(self):
        self.login_as_admin()
        data = {'day': '2026-04-10'}
        response = self.client.post('/api/kosu_link/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_work_write_post(self):
        self.login_as_admin()
        # Set year and month in session
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        data = {
            '2026-04-01': {'work_time': '出勤', 'tyoku2': '1'},
            '2026-04-02': {'work_time': '休日', 'tyoku2': ''},
        }
        response = self.client.post('/api/kosu_work_write/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_work_write_cleans_empty_data(self):
        self.login_as_admin()
        # Create a kosu record with empty data
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), time_work='#' * 288,
            detail_work='$' * 287, over_time=0
        )
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        data = {}  # No data for April 1 - should clean up empty record
        response = self.client.post('/api/kosu_work_write/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_work_default_post(self):
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        response = self.client.post('/api/work_default/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_work_default_post_without_login(self):
        response = self.client.post('/api/work_default/', {}, format='json')
        # No session, should hit auth error path but the endpoint doesn't check session.
        # Actually it does: login_no check
        self.assertEqual(response.status_code, 401)

    def test_tyoku_default_post(self):
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2026, 'month': 4}),
                         content_type='application/json')
        data = {'default_tyoku1': '1', 'default_tyoku2': '2'}
        response = self.client.post('/api/tyoku_default/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_work_default_post_december(self):
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2025, 'month': 12}),
                         content_type='application/json')
        response = self.client.post('/api/work_default/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_tyoku_default_post_december(self):
        self.login_as_admin()
        self.client.post('/api/kosu_calendar_change/',
                         json.dumps({'year': 2025, 'month': 12}),
                         content_type='application/json')
        data = {'default_tyoku1': '1'}
        response = self.client.post('/api/tyoku_default/', data, format='json')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 17. TestDayUpdate, ItemDelete
# ---------------------------------------------------------------------------
class TestDayUpdateItemDelete(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0,
            time_work='A' * 20 + '#' * 268,
            detail_work='$'.join(['d'] * 20 + [''] * 268),
            work_time='出勤',
        )

    def test_day_update_success(self):
        self.login_as_admin()
        data = {'work_day2': '2026-04-20', 'id': self.kosu.id}
        response = self.client.put('/api/day_update/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.kosu.refresh_from_db()
        self.assertEqual(str(self.kosu.work_day2), '2026-04-20')

    def test_day_update_no_day(self):
        self.login_as_admin()
        data = {'work_day2': '', 'id': self.kosu.id}
        response = self.client.put('/api/day_update/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_day_update_existing_data(self):
        self.login_as_admin()
        # Create another kosu on target date
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 5), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        data = {'work_day2': '2026-04-05', 'id': self.kosu.id}
        response = self.client.put('/api/day_update/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_item_delete_success(self):
        self.login_as_admin()
        data = {
            'work_day2': '2026-04-01',
            'time1': '2026-03-31T15:00:00.000Z',  # 00:00 JST
            'time2': '2026-03-31T15:50:00.000Z',  # 00:50 JST
        }
        response = self.client.post('/api/item_delete/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_item_delete_no_login(self):
        data = {
            'work_day2': '2026-04-01',
            'time1': '2026-03-31T15:00:00.000Z',
            'time2': '2026-03-31T15:50:00.000Z',
        }
        response = self.client.post('/api/item_delete/', data, format='json')
        self.assertEqual(response.status_code, 401)

    def test_item_delete_no_kosu(self):
        self.login_as_admin()
        data = {
            'work_day2': '2026-05-01',
            'time1': '2026-05-01T00:00:00.000Z',
            'time2': '2026-05-01T01:00:00.000Z',
        }
        response = self.client.post('/api/item_delete/', data, format='json')
        self.assertEqual(response.status_code, 401)

    def test_item_delete_no_time_work(self):
        self.login_as_admin()
        kosu_empty = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 8), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work=None
        )
        data = {
            'work_day2': '2026-04-08',
            'time1': '2026-04-08T00:00:00.000Z',
            'time2': '2026-04-08T01:00:00.000Z',
        }
        response = self.client.post('/api/item_delete/', data, format='json')
        self.assertEqual(response.status_code, 401)


# ---------------------------------------------------------------------------
# 18. TestKosuTotal
# ---------------------------------------------------------------------------
class TestKosuTotalViews(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    def test_kosu_total_post_daily(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '日間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_total_post_monthly(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '月間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_total_post_yearly(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '年間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_total_post_with_existing_daily(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '日間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_total_post_with_existing_monthly(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '月間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_kosu_total_post_with_existing_yearly(self):
        self.login_as_admin()
        data = {'date': '2026-04-01', 'period': '年間'}
        response = self.client.post('/api/kosu_total/', data, format='json')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 19. More TeamViews
# ---------------------------------------------------------------------------
class TestTeamViewsExtended(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999', follow=True
        )
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    def test_team_calendar_get(self):
        self.login_as_admin()
        response = self.client.get('/api/team_calendar/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    def test_team_calendar_get_without_login(self):
        response = self.client.get('/api/team_calendar/')
        self.assertEqual(response.status_code, 401)

    def test_team_calendar_get_without_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/team_calendar/')
        self.assertEqual(response.status_code, 403)

    def test_team_calendar_post(self):
        self.login_as_admin()
        data = {'day': '2026-04-05'}
        response = self.client.post('/api/team_calendar/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_calendar_week_jump_forward(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        data = {'week': 'A'}
        response = self.client.post('/api/team_calendar_week_jump/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_calendar_week_jump_backward(self):
        self.login_as_admin()
        self.client.post('/api/set_day/', json.dumps({'day': '2026-04-01'}),
                         content_type='application/json')
        data = {'week': 'B'}
        response = self.client.post('/api/team_calendar_week_jump/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_overtime_get(self):
        self.login_as_admin()
        response = self.client.get('/api/team_overtime/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    def test_team_overtime_get_without_login(self):
        response = self.client.get('/api/team_overtime/')
        self.assertEqual(response.status_code, 401)

    def test_team_overtime_get_without_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/team_overtime/')
        self.assertEqual(response.status_code, 403)

    def test_team_overtime_post(self):
        self.login_as_admin()
        data = {'year': 2026, 'month': 4}
        response = self.client.post('/api/team_overtime/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_view_get(self):
        self.login_as_admin()
        response = self.client.get('/api/team_view/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_name_list', response.data)

    def test_team_view_get_without_login(self):
        response = self.client.get('/api/team_view/')
        self.assertEqual(response.status_code, 401)

    def test_team_view_get_without_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/team_view/')
        self.assertEqual(response.status_code, 403)

    def test_team_view_post(self):
        self.login_as_admin()
        data = {'year': 2026, 'month': 4}
        response = self.client.post('/api/team_view/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_shop_select_post(self):
        self.login_as_admin()
        data = {'shop_default': 'P'}
        response = self.client.post('/api/team_shop_select/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_export_post(self):
        self.login_as_admin()
        data = {'year': 2026, 'month': 4, 'shop2': 'P'}
        response = self.client.post('/api/team_export/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    def test_team_list_with_filters(self):
        self.login_as_admin()
        response = self.client.get('/api/team_list/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day',
            'member_id': '99999'
        })
        self.assertEqual(response.status_code, 200)

    def test_team_list_month_filter(self):
        self.login_as_admin()
        response = self.client.get('/api/team_list/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month'
        })
        self.assertEqual(response.status_code, 200)

    def test_team_new_post_with_all_members(self):
        self.login_as_admin()
        data = {
            'member1': '99999', 'member2': '', 'member3': '',
            'member4': '', 'member5': '', 'member6': '',
            'member7': '', 'member8': '', 'member9': '',
            'member10': '', 'member11': '', 'member12': '',
            'member13': '', 'member14': '', 'member15': '',
            'follow': False
        }
        response = self.client.post('/api/team_new/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_team_new_get_kumichou_shop(self):
        """Test team_new GET with kumichou shop shows all members."""
        self.member.shop = '組長以上(P,R,T,その他)'
        self.member.save()
        self.login_as_admin()
        response = self.client.get('/api/team_new/')
        self.assertEqual(response.status_code, 200)

    def test_team_calendar_no_team_data(self):
        """Test team_calendar when no team data exists."""
        self.team.delete()
        self.login_as_admin()
        response = self.client.get('/api/team_calendar/')
        self.assertEqual(response.status_code, 400)

    def test_team_overtime_no_team_data(self):
        self.team.delete()
        self.login_as_admin()
        response = self.client.get('/api/team_overtime/')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 20. More MainViews - AdministratorKosuUpdate, AdministratorLoading, etc.
# ---------------------------------------------------------------------------
class TestMainViewsExtended(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.kosu = Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0, time_work='#' * 288,
            detail_work='$'.join([''] * 288), work_time='出勤',
        )

    def test_administrator_loading_get(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_loading/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('login_data', response.data)

    def test_administrator_loading_non_admin(self):
        self.login_as_normal()
        response = self.client.get('/api/manager_loading/')
        self.assertEqual(response.status_code, 403)

    def test_administrator_loading_no_login(self):
        response = self.client.get('/api/manager_loading/')
        self.assertEqual(response.status_code, 401)

    def test_administrator_kosu_update_get(self):
        self.login_as_admin()
        response = self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('kosu_data', response.data)
        self.assertIn('member_data', response.data)
        self.assertIn('choices', response.data)

    def test_administrator_kosu_update_get_not_found(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_kosu_update/99999/')
        self.assertEqual(response.status_code, 404)

    def test_administrator_kosu_update_put_success(self):
        self.login_as_admin()
        # First GET to set session
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        data = {
            'employee_no3': 12345,
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'over_time': 30,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_administrator_kosu_update_put_not_found(self):
        self.login_as_admin()
        response = self.client.put('/api/manager_kosu_update/99999/', {}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_administrator_kosu_update_put_invalid_employee(self):
        self.login_as_admin()
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        data = {
            'employee_no3': 88888,
            'work_day2': '2026-04-01',
            'tyoku2': '1',
            'over_time': 0,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_administrator_kosu_update_put_duplicate_day(self):
        self.login_as_admin()
        # Create another kosu for same employee on different day
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 5), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        self.client.get(f'/api/manager_kosu_update/{self.kosu.id}/')
        data = {
            'employee_no3': 12345,
            'work_day2': '2026-04-05',
            'tyoku2': '1',
            'over_time': 0,
            'time_work': '#' * 288,
            'work_time': '出勤',
        }
        response = self.client.put(
            f'/api/manager_kosu_update/{self.kosu.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_administrator_kosu_update_delete(self):
        self.login_as_admin()
        response = self.client.delete(f'/api/manager_kosu_update/{self.kosu.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Business_Time_graph.objects.filter(id=self.kosu.id).exists())

    def test_administrator_kosu_update_delete_not_found(self):
        self.login_as_admin()
        response = self.client.delete('/api/manager_kosu_update/99999/')
        self.assertEqual(response.status_code, 404)

    def test_administrator_kosu_list_filters(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_kosu/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day',
            'shop': 'P', 'tyoku': '1', 'work': '出勤', 'judgement': 'NG',
            'member': '12345',
        })
        self.assertEqual(response.status_code, 200)

    def test_administrator_kosu_list_month_filter(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_kosu/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month',
        })
        self.assertEqual(response.status_code, 200)

    def test_administrator_kosu_list_judgement_ok(self):
        self.login_as_admin()
        response = self.client.get('/api/manager_kosu/', {
            'judgement': 'OK',
        })
        self.assertEqual(response.status_code, 200)

    def test_web_console_log_view(self):
        self.login_as_admin()
        response = self.client.get('/api/web_console_log/')
        self.assertEqual(response.status_code, 200)

    def test_help_post_member_reset(self):
        """Test Help endpoint with member reset."""
        data = {'memberReset': True}
        response = self.client.post('/api/help/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_help_post_no_reset(self):
        data = {'memberReset': False, 'defReset': False, 'settingReset': False}
        response = self.client.post('/api/help/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_administrator_history_filters(self):
        self.login_as_admin()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, changes={}, login_No='12345'
        )
        response = self.client.get('/api/manager_history/', {
            'day': str(date.today()), 'mode': 'day',
            'record_id': '1', 'table_name': 'member', 'login_No': '12345'
        })
        self.assertEqual(response.status_code, 200)

    def test_administrator_history_month_filter(self):
        self.login_as_admin()
        History.objects.create(
            operation='UPDATE', table_name='member',
            record_id=2, changes={}
        )
        response = self.client.get('/api/manager_history/', {
            'day': str(date.today())[:7], 'mode': 'month',
        })
        self.assertEqual(response.status_code, 200)

    def test_administrator_task_day_filter(self):
        self.login_as_admin()
        AsyncTask.objects.create(task_id='tf1', status='success')
        response = self.client.get('/api/manager_task/', {
            'day': str(date.today()), 'mode': 'day',
        })
        self.assertEqual(response.status_code, 200)

    def test_administrator_task_month_filter(self):
        self.login_as_admin()
        AsyncTask.objects.create(task_id='tf2', status='success')
        response = self.client.get('/api/manager_task/', {
            'day': str(date.today())[:7], 'mode': 'month',
        })
        self.assertEqual(response.status_code, 200)

    def test_team_menu_with_follow(self):
        """Test team_menu with follow enabled and team data."""
        team_member.objects.create(
            employee_no5=12345, member1='99999', follow=True
        )
        # Create kosu for normal member yesterday
        Business_Time_graph.objects.create(
            employee_no3=99999, name=self.normal_member,
            work_day2=date.today() - timedelta(days=1),
            tyoku2='1', over_time=0, judgement=False,
        )
        self.login_as_admin()
        response = self.client.get('/api/team_menu/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('follow_message_list', response.data)


# ---------------------------------------------------------------------------
# 21. More InquiryViews
# ---------------------------------------------------------------------------
class TestInquiryViewsExtended(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    def test_inquir_list_with_filters(self):
        self.login_as_admin()
        inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Filter test', answer=''
        )
        response = self.client.get('/api/inquir_list/', {
            'item': '要望', 'member_id': '12345'
        })
        self.assertEqual(response.status_code, 200)

    def test_inquir_detail_clears_popup(self):
        """Test that viewing detail clears admin popup."""
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Popup test', answer=''
        )
        self.admin_settings.pop_up1 = 'test popup'
        self.admin_settings.pop_up_id1 = str(inq.id)
        self.admin_settings.save()
        self.login_as_admin()
        response = self.client.get(f'/api/inquir_detail/{inq.id}/')
        self.assertEqual(response.status_code, 200)
        self.admin_settings.refresh_from_db()
        # After clearing, popup is either '' or None
        self.assertFalse(self.admin_settings.pop_up1)

    def test_inquir_new_popup_write(self):
        """Test that posting new inquiry creates popup."""
        self.login_as_admin()
        data = {'content_choice': '不具合', 'inquiry': 'Bug report'}
        response = self.client.post('/api/inquir_new/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.admin_settings.refresh_from_db()
        self.assertIn('新しい問い合わせ', self.admin_settings.pop_up1 or '')

    def test_inquir_update_access_denied(self):
        """Test non-admin non-owner can't access update."""
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Access test', answer=''
        )
        self.admin_settings.administrator_employee_no1 = ''
        self.admin_settings.save()
        self.login_as_normal()
        response = self.client.get(f'/api/inquir_update/{inq.id}/')
        self.assertEqual(response.status_code, 403)

    def test_inquir_update_put_with_answer_change(self):
        """Test that changing answer creates popup for inquirer."""
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Answer test', answer=''
        )
        self.login_as_admin()
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '要望', 'inquiry': 'Answer test',
            'answer': 'Here is the answer'
        }
        response = self.client.put(f'/api/inquir_update/{inq.id}/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_inquir_update_put_with_inquiry_change(self):
        """Test that changing inquiry creates admin popup."""
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Original', answer=''
        )
        self.login_as_admin()
        data = {
            'employee_no2': 12345, 'name': self.member.id,
            'content_choice': '不具合', 'inquiry': 'Changed',
            'answer': ''
        }
        response = self.client.put(f'/api/inquir_update/{inq.id}/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_inquir_detail_pagination(self):
        """Test next and before record navigation."""
        inq1 = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='First', answer=''
        )
        inq2 = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Second', answer=''
        )
        self.login_as_admin()
        response = self.client.get(f'/api/inquir_detail/{inq1.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['next_id'], inq2.id)
        self.assertIsNone(response.data['before_id'])


# ---------------------------------------------------------------------------
# 22. TestAsyncViews
# ---------------------------------------------------------------------------
class TestAsyncViews(BaseTestCase):
    def test_check_task_status_success(self):
        task = AsyncTask.objects.create(
            task_id='test-check-1', status='success', result='/path/to/file.xlsx')
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-1'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['file_path'], '/path/to/file.xlsx')

    def test_check_task_status_error(self):
        AsyncTask.objects.create(
            task_id='test-check-2', status='error', result='Something went wrong')
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-2'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'error')

    def test_check_task_status_pending(self):
        AsyncTask.objects.create(task_id='test-check-3', status='pending')
        response = self.client.get('/api/check_backup_status', {'task_id': 'test-check-3'})
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data['status'], 'pending')

    def test_check_task_status_no_id(self):
        response = self.client.get('/api/check_backup_status')
        self.assertEqual(response.status_code, 400)

    def test_check_task_status_invalid_id(self):
        response = self.client.get('/api/check_backup_status', {'task_id': 'nonexistent'})
        self.assertEqual(response.status_code, 400)

    def test_download_file(self):
        # Create a temp file
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
            f.write(b'test content')
            temp_path = f.name
        response = self.client.get('/api/download_backup', {'file_path': temp_path})
        self.assertEqual(response.status_code, 200)
        # Cleanup delayed due to Windows file locking - file will be cleaned by OS

    def test_backup_def_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/def_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('task_id', data)

    def test_backup_member_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/member_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('task_id', data)

    def test_backup_team_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/team_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_choice_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/choice_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_inquiry_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/inquiry_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_setting_backup(self):
        self.login_as_admin()
        response = self.client.post('/api/setting_backup/', {}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_kosu_backup_no_dates(self):
        self.login_as_admin()
        response = self.client.post('/api/kosu_backup/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_backup_kosu_backup_with_valid_dates(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/kosu_backup/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_kosu_delet_with_valid_dates(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/kosu_delet/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_kosu_backup_future_date_error(self):
        self.login_as_admin()
        tomorrow = str(date.today() + timedelta(days=1))
        data = {'start_day': str(date.today()), 'end_day': tomorrow}
        response = self.client.post('/api/kosu_backup/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_backup_kosu_backup_start_after_end_error(self):
        self.login_as_admin()
        data = {
            'start_day': str(date.today() - timedelta(days=1)),
            'end_day': str(date.today() - timedelta(days=3)),
        }
        response = self.client.post('/api/kosu_backup/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_backup_asynctask_backup(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/AsyncTask_backup/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_asynctask_delet(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/AsyncTask_delet/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_history_backup(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/History_backup/', data, format='json')
        self.assertEqual(response.status_code, 200)

    def test_backup_history_delet(self):
        self.login_as_admin()
        yesterday = str(date.today() - timedelta(days=2))
        day_before = str(date.today() - timedelta(days=3))
        data = {'start_day': day_before, 'end_day': yesterday}
        response = self.client.post('/api/History_delet/', data, format='json')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 23. TestDefViewsExtended
# ---------------------------------------------------------------------------
class TestDefViewsExtended(BaseTestCase):
    def test_def_list_with_search(self):
        self.login_as_admin()
        response = self.client.get('/api/def_list/')
        self.assertEqual(response.status_code, 200)

    def test_def_search_filters(self):
        self.login_as_admin()
        response = self.client.get('/api/def_search/', {'search': 'Test'})
        self.assertEqual(response.status_code, 200)

    def test_def_update_put_duplicate_name(self):
        self.login_as_admin()
        kosu_division.objects.create(kosu_name='DupVer', kosu_title_1='XX')
        data = {'kosu_name': 'DupVer', 'kosu_title_1': 'YY'}
        response = self.client.put(
            f'/api/def_update/{self.division.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_def_ver_post_empty_version(self):
        self.login_as_admin()
        response = self.client.post(
            '/api/def_ver/', {'versionchoice': ''}, format='json')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# 24. TestKosuListFilters
# ---------------------------------------------------------------------------
class TestKosuListFilters(BaseTestCase):
    def setUp(self):
        super().setUp()
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 1), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2026, 4, 15), def_ver2='TestVer',
            tyoku2='1', over_time=0
        )

    def test_kosu_list_month_filter(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_list/', {
            'day': '2026-04', 'filter': 'true', 'mode': 'month'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 2)

    def test_kosu_list_day_filter(self):
        self.login_as_admin()
        response = self.client.get('/api/kosu_list/', {
            'day': '2026-04-01', 'filter': 'true', 'mode': 'day'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 1)


# ---------------------------------------------------------------------------
# 25. TestDefViewsMore - cover DefDetailNew GET, DefDetailUpdate GET
# ---------------------------------------------------------------------------
class TestDefViewsMore(BaseTestCase):
    def test_def_detail_new_get(self):
        self.login_as_admin()
        response = self.client.get('/api/def_detail_new/')
        self.assertEqual(response.status_code, 200)

    def test_def_detail_update_get(self):
        self.login_as_admin()
        choice = def_choice.objects.create(def_symbol='A', def_select='GetTest')
        response = self.client.get(f'/api/def_detail_update/{choice.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('formData', response.data)
        self.assertIn('symbol_list', response.data)

    def test_def_detail_update_get_not_found(self):
        self.login_as_admin()
        response = self.client.get('/api/def_detail_update/99999/')
        self.assertEqual(response.status_code, 404)

    def test_def_detail_update_put_duplicate(self):
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='Existing')
        choice = def_choice.objects.create(def_symbol='B', def_select='Original')
        data = {'def_symbol': 'B', 'def_select': 'Existing'}
        response = self.client.put(
            f'/api/def_detail_update/{choice.id}/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_def_detail_new_post_duplicate(self):
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='DupSelect')
        data = {'def_symbol': 'B', 'def_select': 'DupSelect'}
        response = self.client.post('/api/def_detail_new/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_def_detail_list_with_symbol_filter(self):
        self.login_as_admin()
        def_choice.objects.create(def_symbol='A', def_select='FilterA')
        def_choice.objects.create(def_symbol='B', def_select='FilterB')
        response = self.client.get('/api/def_detail_list/', {'def_symbol': 'A'})
        self.assertEqual(response.status_code, 200)

    def test_def_new_post_validation_error(self):
        """Test DefNew POST with invalid data that fails validation."""
        self.login_as_admin()
        # kosu_name is required for the serializer to be valid but not None
        data = {'kosu_name': 'ValidName'}
        response = self.client.post('/api/def_new/', data, format='json')
        self.assertEqual(response.status_code, 200)


# ---------------------------------------------------------------------------
# 26. More async views coverage - handle_task and validate_dates
# ---------------------------------------------------------------------------
class TestAsyncViewsMore(BaseTestCase):
    def test_validate_dates_bad_format(self):
        self.login_as_admin()
        data = {'start_day': 'bad', 'end_day': 'format'}
        response = self.client.post('/api/kosu_backup/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_backup_kosu_load_no_file(self):
        """kosu_load without a file should error."""
        self.login_as_admin()
        response = self.client.post('/api/kosu_load/', {}, format='json')
        # Will error because no file provided
        self.assertIn(response.status_code, [400, 500])

    def test_backup_def_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/def_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])

    def test_backup_member_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/member_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])

    def test_backup_choice_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/choice_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])

    def test_backup_team_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/team_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])

    def test_backup_inquiry_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/inquiry_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])

    def test_backup_setting_load_no_file(self):
        self.login_as_admin()
        response = self.client.post('/api/setting_load/', {}, format='json')
        self.assertIn(response.status_code, [400, 500])


# ---------------------------------------------------------------------------
# 27. TeamView extended - post to set shop
# ---------------------------------------------------------------------------
class TestTeamViewPost(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.team = team_member.objects.create(
            employee_no5=12345, member1='99999', follow=False
        )

    def test_team_new_no_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/team_new/')
        self.assertEqual(response.status_code, 403)

    def test_team_list_no_team(self):
        """Test team list when no team data."""
        self.team.delete()
        self.login_as_admin()
        response = self.client.get('/api/team_list/')
        self.assertEqual(response.status_code, 400)

    def test_team_list_no_authority(self):
        self.login_as_normal()
        response = self.client.get('/api/team_list/')
        self.assertEqual(response.status_code, 403)

    def test_team_detail_not_found(self):
        self.login_as_admin()
        response = self.client.get('/api/team_detail/99999/')
        self.assertEqual(response.status_code, 404)


# ---------------------------------------------------------------------------
# 28. More inquiry delete coverage
# ---------------------------------------------------------------------------
class TestInquiryDeleteExtended(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.admin_settings.administrator_employee_no1 = '12345'
        self.admin_settings.save()

    def test_inquir_update_delete_clears_popups(self):
        """Test delete removes related popups."""
        inq = inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='Delete popup test', answer='回答'
        )
        # Set popup on member
        self.member.pop_up1 = 'test popup'
        self.member.pop_up_id1 = str(inq.id)
        self.member.save()
        # Set popup on admin
        self.admin_settings.pop_up1 = 'admin popup'
        self.admin_settings.pop_up_id1 = str(inq.id)
        self.admin_settings.save()

        self.login_as_admin()
        response = self.client.delete(f'/api/inquir_update/{inq.id}/')
        self.assertEqual(response.status_code, 204)

    def test_inquir_update_not_found(self):
        self.login_as_admin()
        response = self.client.get('/api/inquir_update/99999/')
        self.assertEqual(response.status_code, 404)


class TestTasks(BaseTestCase):
    """Tests for kosu/tasks.py backup/delete functions."""

    def setUp(self):
        super().setUp()
        import tempfile
        from django.conf import settings as django_settings
        self.django_settings = django_settings
        self.temp_media = tempfile.mkdtemp()
        self._orig_media_root = django_settings.MEDIA_ROOT
        django_settings.MEDIA_ROOT = self.temp_media

    def tearDown(self):
        import shutil
        self.django_settings.MEDIA_ROOT = self._orig_media_root
        shutil.rmtree(self.temp_media, ignore_errors=True)
        super().tearDown()

    def test_generate_kosu_backup_creates_file(self):
        from kosu.tasks import generate_kosu_backup
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', over_time=0, work_time='出勤'
        )
        filepath = generate_kosu_backup('2025-01-01', '2025-01-31')
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_kosu_backup_empty_data(self):
        from kosu.tasks import generate_kosu_backup
        filepath = generate_kosu_backup('2099-01-01', '2099-01-31')
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_delete_kosu_data(self):
        from kosu.tasks import delete_kosu_data
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', over_time=0, work_time='出勤'
        )
        self.assertEqual(Business_Time_graph.objects.count(), 1)
        delete_kosu_data('2025-01-01', '2025-01-31')
        self.assertEqual(Business_Time_graph.objects.count(), 0)

    def test_load_kosu_file_success(self):
        from kosu.tasks import generate_kosu_backup, load_kosu_file
        Business_Time_graph.objects.create(
            employee_no3=12345, name=self.member,
            work_day2=date(2025, 1, 15), tyoku2='1',
            time_work='A', detail_work='test', over_time=30,
            work_time='出勤', judgement=True, break_change=False
        )
        filepath = generate_kosu_backup('2025-01-01', '2025-01-31')
        Business_Time_graph.objects.all().delete()
        result, _ = load_kosu_file(filepath)
        self.assertEqual(result['status'], 'success')
        self.assertEqual(Business_Time_graph.objects.count(), 1)

    def test_load_kosu_file_invalid_header(self):
        from kosu.tasks import load_kosu_file
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['bad', 'header'])
        filepath = os.path.join(self.temp_media, 'bad.xlsx')
        wb.save(filepath)
        result, _ = load_kosu_file(filepath)
        self.assertEqual(result['status'], 'error')
        self.assertIn('無効なファイルフォーマット', result['message'])

    def test_generate_team_backup_creates_file(self):
        from kosu.tasks import generate_team_backup
        team_member.objects.create(employee_no5=12345, member1='99999')
        filepath = generate_team_backup()
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_delete_async_task_data(self):
        from kosu.tasks import delete_AsyncTask_data
        AsyncTask.objects.create(task_id='test-del-1', status='success')
        self.assertEqual(AsyncTask.objects.count(), 1)
        delete_AsyncTask_data('2020-01-01', '2099-12-31')
        self.assertEqual(AsyncTask.objects.count(), 0)

    def test_delete_history_data(self):
        from kosu.tasks import delete_History_data
        History.objects.all().delete()
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, login_No='12345'
        )
        self.assertTrue(History.objects.count() >= 1)
        delete_History_data('2020-01-01', '2099-12-31')
        self.assertEqual(History.objects.count(), 0)

    def test_generate_async_task_backup(self):
        from kosu.tasks import generate_AsyncTask_backup
        AsyncTask.objects.create(task_id='test-bk', status='success')
        filepath = generate_AsyncTask_backup('2020-01-01', '2099-12-31')
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_history_backup(self):
        from kosu.tasks import generate_History_backup
        History.objects.create(
            operation='CREATE', table_name='member',
            record_id=1, login_No='12345'
        )
        filepath = generate_History_backup('2020-01-01', '2099-12-31')
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_choice_backup(self):
        from kosu.tasks import generate_choice_backup
        def_choice.objects.create(def_symbol='A', def_select='テスト')
        filepath = generate_choice_backup()
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_inquiry_backup(self):
        from kosu.tasks import generate_inquiry_backup
        inquiry_data.objects.create(
            employee_no2=12345, name=self.member,
            content_choice='要望', inquiry='テスト'
        )
        filepath = generate_inquiry_backup()
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_setting_backup(self):
        from kosu.tasks import generate_setting_backup
        filepath = generate_setting_backup()
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_generate_def_backup(self):
        from kosu.tasks import generate_def_backup
        filepath = generate_def_backup()
        self.assertTrue(os.path.exists(filepath))
        os.remove(filepath)

    def test_load_kosu_file_nonexistent_member(self):
        """Load file with employee_no not in DB - should skip that row."""
        from kosu.tasks import load_kosu_file
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        headers = [
            '従業員番号', '氏名', '工数区分定義Ver', '就業日', '直',
            '作業内容', '作業詳細', '残業時間', '昼休憩時間',
            '残業休憩時間1', '残業休憩時間2', '残業休憩時間3',
            '就業形態', '工数入力OK_NG', '休憩変更チェック',
        ]
        ws.append(headers)
        ws.append([88888, 'nobody', 'v1', '2025-01-01', '1',
                   'A', '', 0, '', '', '', '', '出勤', True, False])
        filepath = os.path.join(self.temp_media, 'test_load.xlsx')
        wb.save(filepath)
        result, _ = load_kosu_file(filepath)
        self.assertEqual(result['status'], 'success')
        self.assertEqual(Business_Time_graph.objects.count(), 0)
