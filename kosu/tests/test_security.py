# ============================================================
# ファイル名 : test_security.py
# 種別       : テストコード（Django の TestCase）
# テスト対象 : 安全まわりの直し（直すべき所の S-1・S-3・S-4・S-7・B-8）
#              views/main_views.py（react_view・Login・HelpPass）, views/kosu_views.py（KosuUpdate・DayUpdate）,
#              views/team_views.py（TeamDetail）, views/inquiry_views.py（InquirUpdate）,
#              views/member_views.py（MemberNew・MemberUpdate・MemberDelete）,
#              views/asynchronous_views.py（download_file）, tasks.py（load_choice_file）
# 概要       : 直した所（ログイン・CSRF・他人のデータ・ダウンロード・ヘルプ・ロード）が、
#              また壊れていないかを確かめるテスト。
#              test_backend.py のテストは CSRF の確かめを切った状態で動く（Django のテスト用 Client の既定）ので、
#              ここでは enforce_csrf_checks=True で、ブラウザと同じ流れも確かめる。
#
# 主なクラス:
#   - SecurityTestBase : 共通の準備（工数区分定義・管理者設定・人員4名・他人の工数データ1件）とログイン用ヘルパー
#   - TestCsrfFlow     : CSRF を確かめる状態で、画面 → ログイン → 書き込み → ログアウト ができる（S-1・T-1）
#   - TestOthersData   : 他人のデータを見たり、変えたり、消したりできない（S-3）
#   - TestDownload     : ダウンロードは media フォルダの中のファイルだけ（S-4）
#   - TestHelp         : ヘルプのパスワードの総当たりを止める・パスワード未設定でも 500 にしない（S-7）
#   - TestLoadIsAtomic : ロードが途中で失敗したら、元のデータに戻る（B-8）
#
# モック方針 :
#   - TestHelp だけ、with の中に限って次を差し替える。
#       ScopedRateThrottle.THROTTLE_RATES … 呼び出し回数の上限を「1時間に5回」にする（テスト設定の上限に関係なく確かめるため）
#       環境変数 HELP_PATH              … 空にして「ヘルプ用パスワードが未設定」の状態を作るため
#   - それ以外はモックを使わず、Django のテスト用 Client（疑似ブラウザ）で実際に API を呼ぶ。
#
# 実行       : python manage.py test kosu --settings=hozen_another.test_settings
# 関連ファイル: hozen_another/test_settings.py, kosu/tests/test_backend.py, kosu/permissions.py,
#              frontend/src/api/axios.ts（Cookie の csrftoken の値を X-CSRFToken の見出しに写して送る）
# ============================================================

# ============================================================
# インポート
# ============================================================
# JSON の文字列を作る（API に送る本文）
import json
# 環境変数（os.environ）・ファイルの削除や存在確認
import os
# 一時フォルダ・一時ファイルを作る
import tempfile
# ファイルの場所を扱う（ファイルへの書き込み・存在確認）
from pathlib import Path
# テストの間だけ、属性や辞書の中身を差し替える
from unittest import mock

# Excel ファイルを作る（ロードのテスト用）
import openpyxl
# Django のキャッシュ（呼び出し回数の制限は、回数をここに覚える）
from django.core.cache import cache
# Client: テスト用の疑似ブラウザ / TestCase: テストごとにDBの変更を自動で巻き戻す基底クラス /
# override_settings: テストの間だけ settings.py の値を変える
from django.test import Client, TestCase, override_settings
# 同じ所（IPアドレス）からの呼び出し回数を制限する部品（上限を差し替えるために読み込む）
from rest_framework.throttling import ScopedRateThrottle

# テストで直接作成・確認するモデル（データベースのテーブル定義）
from kosu.models import (Business_Time_graph, administrator_data, def_choice, inquiry_data, kosu_division,
                         member, team_member)
# 作業詳細選択肢の Excel を読み込む関数（ロードのテスト用）
from kosu.tasks import load_choice_file

# ============================================================
# 定数・ヘルパー関数
# ============================================================
# 休憩時間の24項目（人員データを作るのに必要。値は何でもよい）
#   break_time1〜6 と、それぞれの _over1〜_over3 の 6 × 4 = 24 項目。値 '#12001300' は「12:00〜13:00」
BT = {f'break_time{i}{s}': '#12001300' for i in range(1, 7) for s in ('', '_over1', '_over2', '_over3')}

# 画面（index.html）の代わり。frontend/build が無くても react_view のテストができるようにする
#   一時フォルダに最小限の index.html を作り、TEMPLATES の DIRS をそのフォルダに向けた設定を用意する
#   （TestCsrfFlow に @override_settings(TEMPLATES=TEMPLATES_FOR_TEST) で当てる）
TEMPLATE_DIR = tempfile.mkdtemp(prefix='kosu-test-templates-')
Path(TEMPLATE_DIR, 'index.html').write_text('<!doctype html><div id="root"></div>', encoding='utf-8')
TEMPLATES_FOR_TEST = [{
  'BACKEND': 'django.template.backends.django.DjangoTemplates',
  'DIRS': [TEMPLATE_DIR],
  'APP_DIRS': True,
}]


# テスト用の人員データを1件作る。
#
# 引数:
#   no   : 従業員番号
#   admin: 管理者にするか（既定 False）
#   auth : 権限ありにするか（既定 False）
# 戻り値:
#   member: 作った人員データ（氏名は "m<従業員番号>"、ショップは "P"、休憩時間は BT の値）
def make_member(no, admin=False, auth=False):
  return member.objects.create(employee_no=no, name=f'm{no}', shop='P', authority=auth, administrator=admin, **BT)


# Client の post / put に渡す、JSON の本文の引数を作る。
#
# 引数:
#   data: 本文にする辞書
# 戻り値:
#   dict: {'data': JSON文字列, 'content_type': 'application/json'}（c.post(URL, **as_json(...)) のように展開して渡す）
def as_json(data):
  return {'data': json.dumps(data), 'content_type': 'application/json'}


# ---------------------------------------------------------------------------
# SecurityTestBase: このファイルのテスト共通の準備
#   setUp で、工数区分定義 v1・管理者設定・人員4名・人員 2002 の工数データ1件を作る。
#   人員: 1001 = 管理者（権限あり） / 1501 = 権限あり・管理者でない（班長など） / 2001・2002 = 一般
# ---------------------------------------------------------------------------
class SecurityTestBase(TestCase):
  # 各テストの直前に毎回実行される準備処理。共通のテスト用データを作る。
  #
  # 引数: なし
  # 戻り値: なし
  def setUp(self):
    # 工数区分定義 v1（ログインに必要。1件も無いとログインが 400 になる）と、管理者設定（一覧表示項目数 20）
    kosu_division.objects.create(kosu_name='v1', kosu_title_1='A')
    administrator_data.objects.create(menu_row='20')
    # 人員4名（役割は上のクラスの説明のとおり）
    self.admin = make_member(1001, admin=True, auth=True)   # 管理者
    self.leader = make_member(1501, auth=True)              # 権限あり・管理者でない
    self.user_a = make_member(2001)
    self.user_b = make_member(2002)
    # 人員 2002 の工数データ（就業日 2026-01-05。「他人のデータ」のテストで、2001 などから触らせる対象）
    #   time_work は 5分 × 288 枠 = 24時間分（'#' は作業なし）、detail_work は 288 枠を '$' で区切った作業詳細（全部空）
    self.rec_b = Business_Time_graph.objects.create(employee_no3=2002, name=self.user_b, work_day2='2026-01-05',
                                                    time_work='#' * 288, detail_work='$' * 287, def_ver2='v1')

  # 指定した従業員番号でログインしたクライアントを返す（CSRF の確かめは切った状態のクライアント）。
  #
  # 引数:
  #   no: ログインする従業員番号
  # 戻り値:
  #   Client: ログイン済みのテスト用クライアント（ログインが 200 でなければ、その場でテスト失敗）
  def login(self, no):
    # 準備: CSRF の確かめを切った状態（Client の既定）のクライアントでログインAPIを呼ぶ
    c = Client()
    r = c.post('/api/login/', **as_json({'employee_no': no}))
    # 検証: ログインが成功している
    self.assertEqual(r.status_code, 200)
    return c


# ---------------------------------------------------------------------------
# TestCsrfFlow: CSRF を確かめる状態での、ブラウザと同じ流れのテスト（S-1・T-1）
#   対象 : react_view（GET /）, Login（POST /api/login/）, DefVer（POST /api/def_ver/）, Logout（POST /api/logout/）
#   内容 : 画面を開くと csrftoken の Cookie がもらえ、その値を X-CSRFToken の見出しに付ければ
#          ログインした後の書き込みとログアウトが通ること、付けなければ 403 になること、
#          ログインでセッションIDが新しくなることを確認する。
#   ※ index.html は frontend/build の物ではなく、上の TEMPLATES_FOR_TEST の仮の物を使う
# ---------------------------------------------------------------------------
@override_settings(TEMPLATES=TEMPLATES_FOR_TEST)
class TestCsrfFlow(SecurityTestBase):
  """T-1: ブラウザと同じく CSRF を確かめる状態で、画面を開く → ログイン → 書き込み → ログアウト ができる。"""

  # 【テスト】画面を開くと csrftoken がもらえ、ログイン → 書き込み → ログアウトが CSRF を確かめる状態で通ること
  #   前提: 従業員番号 2001 の人員と、工数区分定義 v1 がある
  #   操作: GET / → POST /api/login/ → POST /api/def_ver/ → POST /api/logout/（どれも X-CSRFToken を付ける）
  #   期待: 画面を開いた時点で Cookie に csrftoken があり、ログイン・書き込み・ログアウトがすべて 200
  def test_page_gives_cookie_and_writes_work(self):
    # 準備: ブラウザと同じく CSRF を確かめる状態のクライアント
    c = Client(enforce_csrf_checks=True)
    # 操作・検証: 画面を開き、csrftoken の Cookie を受け取っている
    c.get('/')                                              # 画面を開くと csrftoken の Cookie がもらえる
    self.assertIn('csrftoken', c.cookies)
    # 操作・検証: Cookie の値を X-CSRFToken の見出しに付けてログインし、200 が返る
    r = c.post('/api/login/', HTTP_X_CSRFTOKEN=c.cookies['csrftoken'].value, **as_json({'employee_no': 2001}))
    self.assertEqual(r.status_code, 200)
    # 操作・検証: ログインした後の書き込み（定義Verの切り替え）が 200 で通る
    token = c.cookies['csrftoken'].value                    # ログインでトークンが新しくなるので読み直す
    r = c.post('/api/def_ver/', HTTP_X_CSRFTOKEN=token, **as_json({'versionchoice': 'v1'}))
    self.assertEqual(r.status_code, 200)
    # 操作・検証: ログアウトも 200 で通る
    r = c.post('/api/logout/', HTTP_X_CSRFTOKEN=token, **as_json({}))
    self.assertEqual(r.status_code, 200)

  # 【テスト】ログインした後の書き込みで X-CSRFToken を付けないと 403 になること
  #   前提: 画面を開いて csrftoken を受け取り、2001 でログインしている
  #   操作: X-CSRFToken を付けずに POST /api/def_ver/
  #   期待: 403（CSRF の確かめで止まる）
  def test_write_without_token_is_403(self):
    # 準備: CSRF を確かめる状態で、画面を開いてからログインする
    c = Client(enforce_csrf_checks=True)
    c.get('/')
    c.post('/api/login/', HTTP_X_CSRFTOKEN=c.cookies['csrftoken'].value, **as_json({'employee_no': 2001}))
    # 操作: 見出しを付けずに書き込みAPIを呼ぶ
    r = c.post('/api/def_ver/', **as_json({'versionchoice': 'v1'}))     # X-CSRFToken を付けない
    # 検証: 403
    self.assertEqual(r.status_code, 403)

  # 【テスト】ログインするとセッションID（Cookie の sessionid）が新しくなること
  #   前提: ログイン前のセッション（中身 probe=1）を作り、そのセッションIDを控える
  #   操作: POST /api/login/ に 2001 を送る
  #   期待: ログイン後の Cookie の sessionid が、ログイン前のセッションIDと違う
  def test_login_changes_session_key(self):
    # 準備: ログイン前のセッションを作って保存し、そのセッションIDを控える
    c = Client()
    session = c.session
    session['probe'] = 1
    session.save()
    before = session.session_key
    # 操作: ログインする
    c.post('/api/login/', **as_json({'employee_no': 2001}))
    # 検証: セッションIDが変わっている（ログイン前のIDを知られていても、ログイン後には使えない）
    self.assertNotEqual(c.cookies['sessionid'].value, before)


# ---------------------------------------------------------------------------
# TestOthersData: 他人のデータを扱えないことのテスト（S-3）
#   対象 : KosuUpdate（GET /api/kosu_update/<ID>/）, DayUpdate（PUT /api/day_update/）,
#          TeamDetail（GET /api/team_detail/<ID>/）, InquirUpdate（PUT・DELETE /api/inquir_update/<ID>/）,
#          MemberNew・MemberUpdate・MemberDelete（/api/member_new/・member_update/<番号>/・member_delete/<番号>/）
#   内容 : 他人の工数を開けない・就業日を変えられない、班員でない人の工数を開けない、
#          他人の問い合わせを直せない・消せない、本人は回答を書けない、権限だけの人は管理者を作れないことを確認する。
# ---------------------------------------------------------------------------
class TestOthersData(SecurityTestBase):
  """T-2: 他人のデータを見たり、変えたり、消したりできない（S-3）。"""

  # 【テスト】他人（2002）の工数データの編集画面を開けないこと
  #   前提: 2002 の工数データがある
  #   操作: 2001 でログインし、GET /api/kosu_update/<2002 の工数データのID>/
  #   期待: 404（他人のデータは「見つからない」扱い）
  def test_kosu_update_get_of_others_is_404(self):
    # 準備: 2001 でログイン
    c = self.login(2001)
    # 操作・検証: 他人の工数データを開くと 404
    self.assertEqual(c.get(f'/api/kosu_update/{self.rec_b.id}/').status_code, 404)

  # 【テスト】他人（2002）の工数データの就業日を変えられないこと
  #   前提: 2002 の工数データ（就業日 2026-01-05）がある
  #   操作: 2001 でログインし、PUT /api/day_update/ にそのIDと新しい就業日 2026-02-01 を送る
  #   期待: 404 で、就業日は 2026-01-05 のまま
  def test_day_update_of_others_is_404(self):
    # 準備: 2001 でログイン
    c = self.login(2001)
    # 操作: 他人の工数データの就業日を変えようとする
    r = c.put('/api/day_update/', **as_json({'id': self.rec_b.id, 'work_day2': '2026-02-01'}))
    # 検証: 404 で、データベースの就業日は変わっていない
    self.assertEqual(r.status_code, 404)
    self.rec_b.refresh_from_db()
    self.assertEqual(str(self.rec_b.work_day2), '2026-01-05')

  # 【テスト】班員の工数の詳細は、自分の班員の分だけ開けること
  #   前提: 1501（権限あり）の班員に、最初は 2002 がいない
  #   操作: 1501 でログインし GET /api/team_detail/<2002 の工数データのID>/ → 班員1に 2002 を登録して、もう一度開く
  #   期待: 班員でないうちは 404、班員に登録した後は 200
  def test_team_detail_only_for_my_team(self):
    # 準備: 1501 でログイン
    c = self.login(1501)
    # 操作・検証: 班員でない人の工数は 404
    self.assertEqual(c.get(f'/api/team_detail/{self.rec_b.id}/').status_code, 404)
    # 準備: 1501 の班員1に 2002 を登録する（班員の従業員番号は文字列で持つ）
    team_member.objects.create(employee_no5=1501, member1='2002')
    # 操作・検証: 班員になった人の工数は 200
    self.assertEqual(c.get(f'/api/team_detail/{self.rec_b.id}/').status_code, 200)

  # 【テスト】他人（2002）の問い合わせを書き換えられず、消せないこと
  #   前提: 2002 の問い合わせ（内容 'q'・回答なし）がある
  #   操作: 2001 でログインし、PUT /api/inquir_update/<ID>/ で書き換え、DELETE で消そうとする
  #   期待: どちらも 403 で、問い合わせの内容と回答は変わっていない
  def test_inquiry_of_others_cannot_be_changed_or_deleted(self):
    # 準備: 2002 の問い合わせを作り、2001 でログイン
    inq = inquiry_data.objects.create(employee_no2=2002, name=self.user_b, content_choice='要望', inquiry='q', answer='')
    c = self.login(2001)
    # 操作・検証: 書き換えは 403
    r = c.put(f'/api/inquir_update/{inq.id}/', **as_json({'content_choice': '要望', 'inquiry': 'x', 'answer': 'y'}))
    self.assertEqual(r.status_code, 403)
    # 操作・検証: 削除も 403
    self.assertEqual(c.delete(f'/api/inquir_update/{inq.id}/').status_code, 403)
    # 検証: データベースの問い合わせは元のまま
    inq.refresh_from_db()
    self.assertEqual((inq.inquiry, inq.answer), ('q', ''))

  # 【テスト】問い合わせた本人は、自分の問い合わせに回答を書けないこと
  #   前提: 2001 本人の問い合わせ（回答なし）がある。2001 は問い合わせ担当者ではない
  #   操作: 2001 でログインし、回答を入れて PUT /api/inquir_update/<ID>/
  #   期待: 403（回答は問い合わせ担当者だけが書ける）
  def test_owner_cannot_write_answer(self):
    # 準備: 2001 本人の問い合わせを作り、2001 でログイン
    inq = inquiry_data.objects.create(employee_no2=2001, name=self.user_a, content_choice='要望', inquiry='q', answer='')
    c = self.login(2001)
    # 操作: 回答を入れて更新する
    r = c.put(f'/api/inquir_update/{inq.id}/', **as_json({'content_choice': '要望', 'inquiry': 'q2', 'answer': '自分で回答'}))
    # 検証: 403
    self.assertEqual(r.status_code, 403)

  # 【テスト】権限だけの人（管理者でない）は、管理者を作る・自分を管理者にする・管理者を消す、ができないこと
  #   前提: 1501 は権限あり・管理者でない。1001 は管理者
  #   操作: 1501 でログインし、管理者の人員 3001 の登録・自分（1501）を管理者にする編集・管理者 1001 の削除を行う
  #   期待: 3つとも 403 で、1001 は消えていない
  def test_authority_cannot_make_or_remove_administrators(self):
    # 準備: 1501 でログイン
    c = self.login(1501)
    # 操作・検証: 管理者（administrator=True）の人員を新しく登録しようとすると 403
    new = dict(BT, employee_no=3001, name='n', shop='P', authority=True, administrator=True)
    self.assertEqual(c.post('/api/member_new/', **as_json(new)).status_code, 403)
    # 操作・検証: 自分を管理者に書き換えようとすると 403
    me = dict(BT, employee_no=1501, name='m1501', shop='P', authority=True, administrator=True)
    self.assertEqual(c.put('/api/member_update/1501/', **as_json(me)).status_code, 403)
    # 操作・検証: 管理者 1001 を消そうとすると 403 で、1001 は残っている
    self.assertEqual(c.delete('/api/member_delete/1001/').status_code, 403)
    self.assertTrue(member.objects.filter(employee_no=1001).exists())


# ---------------------------------------------------------------------------
# TestDownload: ダウンロードAPIのテスト（S-4）
#   対象 : download_file（GET /api/download_backup?file_path=...）
#   内容 : media フォルダの外のファイルは 404 で消されないこと、
#          media フォルダの中のファイルはファイル名で返り、送り終わると消えることを確認する。
# ---------------------------------------------------------------------------
class TestDownload(SecurityTestBase):
  """T-2: ダウンロードは media フォルダの中のファイルだけ（S-4）。"""

  # 【テスト】media フォルダの外のファイルはダウンロードできず、消されもしないこと
  #   前提: OS の一時フォルダ（media の外）にファイルがある
  #   操作: 管理者 1001 でログインし、GET /api/download_backup?file_path=<そのファイルの場所>
  #   期待: 404 で、ファイルは残っている
  def test_file_outside_media_is_404_and_kept(self):
    # 準備: media の外に空のファイルを作る（mkstemp が返すファイルの番号は、すぐ閉じる）
    fd, outside = tempfile.mkstemp(suffix='.txt')
    os.close(fd)
    try:
      # 操作・検証: 管理者でダウンロードを頼むと 404 で、ファイルは消えていない
      c = self.login(1001)
      self.assertEqual(c.get('/api/download_backup', {'file_path': outside}).status_code, 404)
      self.assertTrue(os.path.exists(outside))
    finally:
      # 後片付け: テストの成否にかかわらず、作ったファイルを消す
      os.remove(outside)

  # 【テスト】media フォルダの中のファイルは、ファイル名でダウンロードでき、送り終わると消えること
  #   前提: media フォルダ（このテストの間だけ一時フォルダに差し替える）に backup.xlsx（中身 b'data'）がある
  #   操作: 管理者 1001 でログインし、GET /api/download_backup?file_path=backup.xlsx
  #   期待: 200 で中身 b'data' が返り、読み終わるとファイルが消える
  def test_file_in_media_is_sent_then_deleted(self):
    # 準備: 一時フォルダを MEDIA_ROOT にし、その中にファイルを作る（with を出るとフォルダごと消える）
    with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
      p = Path(media, 'backup.xlsx')
      p.write_bytes(b'data')
      # 操作: 管理者でログインし、ファイル名だけを渡してダウンロードする
      c = self.login(1001)
      r = c.get('/api/download_backup', {'file_path': p.name})
      # 検証: 200 で中身が返り、送り終わるとファイルが消えている
      self.assertEqual(r.status_code, 200)
      self.assertEqual(b''.join(r.streaming_content), b'data')   # 読み終わると close() が呼ばれる
      self.assertFalse(p.exists())


# ---------------------------------------------------------------------------
# TestHelp: ヘルプ用パスワードの判定APIのテスト（S-7）
#   対象 : HelpPass（POST /api/help_pass/）
#   内容 : 違うパスワードを続けて送ると、上限を超えた所で 429 になること、
#          ヘルプ用パスワード（環境変数 HELP_PATH）が未設定でも 500 にならず 403 になることを確認する。
# ---------------------------------------------------------------------------
class TestHelp(SecurityTestBase):
  """T-2: ヘルプのパスワード（S-7）。"""

  # 【テスト】違うパスワードを続けて送ると、6回目で 429（呼びすぎ）になること
  #   前提: 呼び出し回数の上限を「1時間に5回」に差し替え、回数を覚えるキャッシュを空にする
  #   操作: POST /api/help_pass/ に違うパスワードを6回送る
  #   期待: 5回目までは 403、6回目は 429
  def test_too_many_tries_are_429(self):
    # 準備: 前のテストの呼び出し回数が残らないように、キャッシュを空にする
    cache.clear()
    # 操作: 上限を 5回/時 にした状態で、違うパスワードを6回送り、ステータスコードを順に控える
    with mock.patch.object(ScopedRateThrottle, 'THROTTLE_RATES', {'help': '5/hour'}):
      c = Client()
      codes = [c.post('/api/help_pass/', **as_json({'password': f'x{i}'})).status_code for i in range(6)]
    # 後片付け: 後のテストに回数を残さないように、もう一度キャッシュを空にする
    cache.clear()
    # 検証: 403 が5回続き、6回目が 429
    self.assertEqual(codes, [403] * 5 + [429])

  # 【テスト】ヘルプ用パスワードが未設定（空）でも、500 にならず 403 になること
  #   前提: 環境変数 HELP_PATH を空にする
  #   操作: POST /api/help_pass/ に空のパスワードを送る
  #   期待: 403（空どうしを「一致」とみなさない）
  def test_no_help_path_is_403_not_500(self):
    # 操作: HELP_PATH を空にした状態で、空のパスワードを送る
    with mock.patch.dict(os.environ, {'HELP_PATH': ''}):
      r = Client().post('/api/help_pass/', **as_json({'password': ''}))
    # 検証: 403
    self.assertEqual(r.status_code, 403)


# ---------------------------------------------------------------------------
# TestLoadIsAtomic: データのロードが「全部入れるか、何も変えないか」になっていることのテスト（B-8）
#   対象 : tasks.py の load_choice_file（作業詳細選択肢のロード）
#   内容 : Excel の途中に保存できない行があってロードが失敗した時、
#          それまでの削除・登録が取り消され、元のデータに戻ることを確認する。
# ---------------------------------------------------------------------------
class TestLoadIsAtomic(TestCase):
  """T-2: ロードが途中で失敗したら、元のデータに戻る（B-8）。"""

  # 【テスト】作業詳細選択肢のロードが途中で失敗したら、元の選択肢に戻ること
  #   前提: 作業詳細の選択肢が2件（前からある1・前からある2）ある
  #   操作: 2行目の作業詳細が空（保存できない行）の Excel を load_choice_file で読み込む
  #   期待: 結果の status が 'error' で、選択肢は元の2件のまま
  def test_choice_load_rolls_back(self):
    # 準備: 元からある作業詳細の選択肢を2件作る
    def_choice.objects.create(def_symbol='A', def_select='前からある1')
    def_choice.objects.create(def_symbol='A', def_select='前からある2')
    # 準備: 一時ファイルの場所を用意する（mkstemp が返すファイルの番号は、すぐ閉じる）
    fd, path = tempfile.mkstemp(suffix='.xlsx')
    os.close(fd)
    # 準備: 見出し行・正しい行・作業詳細が空の行、の Excel を作って保存する
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['定義記号', '作業詳細'])
    ws.append(['A', '新しい1'])
    ws.append(['A', None])            # 作業詳細が空 → 保存できない行
    wb.save(path)
    # 操作: 作業詳細選択肢のロードを実行する
    result = load_choice_file(path)
    # 検証: 結果は error で、選択肢は元の2件のまま（並びの順番に関係なく比べるため並べかえる）
    self.assertEqual(result[0]['status'], 'error')
    self.assertEqual(sorted(def_choice.objects.values_list('def_select', flat=True)), ['前からある1', '前からある2'])
