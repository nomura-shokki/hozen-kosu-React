# ============================================================
# ファイル名 : models.py
# 種別       : データベースモデル定義（Django）
# 概要       : 工数管理システムで使うデータベースのテーブル構造を定義する。
#              1つのクラスが1つのテーブル、クラスの中の各フィールド（〜Field）が1つの列に対応する。
#              ここを変更したら python manage.py makemigrations → migrate でデータベースに反映する。
#
# 主なクラス（テーブル）:
#   - member              : 人員（ショップ・権限・直ごとの休憩時間の既定値・本人向けお知らせ）
#   - Business_Time_graph : 工数データ（1日1人分の作業時間記録）
#   - team_member         : 班員（ログイン者が管理する班のメンバー。最大15人）
#   - kosu_division       : 工数区分定義（作業カテゴリの定義セット。1Verにつき最大50区分）
#   - def_choice          : 作業詳細選択肢（工数区分ごとの作業詳細の入力候補）
#   - administrator_data  : 管理者設定（一覧表示項目数・問い合わせ担当者・担当者向けお知らせ）
#   - inquiry_data        : 問い合わせ（要望・不具合・問い合わせの内容と回答）
#   - AsyncTask           : 非同期タスク（バックアップ/復元などのバックグラウンド処理の状態）
#   - Operation_history   : 操作履歴（画面単位の記録用。現在のコードからは使われていない）
#   - History             : 操作履歴（データ変更の監査ログ。signals.py が自動で記録）
#
# 共通の用語:
#   verbose_name : 各フィールドの最初の文字列（'従業員番号' など）。管理サイト等に表示される項目名
#   null=True    : データベースに「値なし（NULL）」を保存できる
#   blank=True   : 入力チェック（シリアライザ等）で空欄を許可する
#   max_length   : 文字列の最大文字数
#   休憩時間の形式: "#HHMMHHMM"（開始時刻と終了時刻。例: "#11401240" は 11:40〜12:40）の9文字
#   直の番号     : 1=1直, 2=2直, 3=3直, 4=常昼, 5=連1直, 6=連2直
#
# 関連ファイル: views/serializers.py（モデル ⇔ JSON の変換）, signals.py（変更時の操作履歴の記録）,
#              admin.py（管理サイトへの登録）, migrations/（データベース構造の変更履歴）
# ============================================================

# ============================================================
# インポート
# ============================================================
from django.db import models
import jsonfield  # JSON 形式のデータを保存できる列（History.changes で使用）を提供する外部ライブラリ



# ============================================================
# 人員・工数データ・班員
# ============================================================

# ------------------------------------------------------------
# member: 人員
#   従業員1人につき1行。ログイン（従業員番号で照合）・権限の判定・休憩時間の既定値などに使う。
#   ログイン中は permissions.py の LoginNoAuthentication により、各APIの request.user にこのデータが入る。
#   休憩時間は直ごとに「昼休憩」＋「残業休憩1〜3」の4つを持つ（break_time{直の番号}〜）。
#   新規登録時は、ショップに応じた休憩時間の初期値が自動で入る（member_views.py の MemberNew）。
# ------------------------------------------------------------
class member(models.Model):
  # ショップ（所属部署）の選択肢
  #   (データベースに保存する値, 画面に表示する名前) の組。このシステムでは両方とも同じ文字列
  #   W1/W2/A1/A2/J/組長以上(W,A) は、人員の新規登録時に設定される休憩時間の初期値が
  #   他のショップと異なる（member_views.py の MemberNew）
  shop_list = [
    ('P', 'P'),
    ('R', 'R'),
    ('W1', 'W1'),
    ('W2', 'W2'),
    ('T1', 'T1'),
    ('T2', 'T2'),
    ('A1', 'A1'),
    ('A2', 'A2'),
    ('J', 'J'),
    ('その他', 'その他'),
    ('組長以上(P,R,T,その他)', '組長以上(P,R,T,その他)'),  # 組長以上の役職（P/R/T/その他 系）
    ('組長以上(W,A)', '組長以上(W,A)'),  # 組長以上の役職（W/A 系）。休憩時間の初期値は W1/W2/A1/A2/J と同じパターン
    ('異動・退社', '異動・退社'),  # 異動・退社した人（人員一覧では末尾に並べる）
  ]
  
  employee_no = models.IntegerField('従業員番号')  # 従業員番号（ログインに使う番号。重複はビュー側で確認しており、DB上の一意制約は無い）
  name = models.CharField('氏名', max_length=100)  # 氏名
  shop = models.CharField('ショップ', choices = shop_list, max_length=15)  # ショップ（上の shop_list のいずれか。最大15文字）
  authority = models.BooleanField('権限')  # 権限（True: 人員・班員の画面を使える。permissions.py の HasAuthority で判定）
  administrator = models.BooleanField('管理者')  # 管理者（True: 管理者MENU・工数区分定義の編集などを使える。IsAdministrator で判定）
  # ---------- 直ごとの休憩時間の既定値（すべて "#HHMMHHMM" 形式の9文字） ----------
  #   break_time{直の番号}       : 昼休憩時間
  #   break_time{直の番号}_over1〜3 : 残業休憩時間1〜3（残業したときに取る休憩）
  #   その日の工数データに休憩時間が未設定のとき、これらが使われる（utils/kosu_utils.py の break_get）
  break_time1 = models.CharField('1直昼休憩時間', max_length=9)  # 1直の昼休憩時間
  break_time1_over1 = models.CharField('1直残業休憩時間1', max_length=9)  # 1直の残業休憩時間1
  break_time1_over2 = models.CharField('1直残業休憩時間2', max_length=9)  # 1直の残業休憩時間2
  break_time1_over3 = models.CharField('1直残業休憩時間3', max_length=9)  # 1直の残業休憩時間3
  break_time2 = models.CharField('2直昼休憩時間', max_length=9)  # 2直の昼休憩時間
  break_time2_over1 = models.CharField('2直残業休憩時間1', max_length=9)  # 2直の残業休憩時間1
  break_time2_over2 = models.CharField('2直残業休憩時間2', max_length=9)  # 2直の残業休憩時間2
  break_time2_over3 = models.CharField('2直残業休憩時間3', max_length=9)  # 2直の残業休憩時間3
  break_time3 = models.CharField('3直昼休憩時間', max_length=9)  # 3直の昼休憩時間
  break_time3_over1 = models.CharField('3直残業休憩時間1', max_length=9)  # 3直の残業休憩時間1
  break_time3_over2 = models.CharField('3直残業休憩時間2', max_length=9)  # 3直の残業休憩時間2
  break_time3_over3 = models.CharField('3直残業休憩時間3', max_length=9)  # 3直の残業休憩時間3
  break_time4 = models.CharField('常昼昼休憩時間', max_length=9)  # 常昼の昼休憩時間
  break_time4_over1 = models.CharField('常昼残業休憩時間1', max_length=9)  # 常昼の残業休憩時間1
  break_time4_over2 = models.CharField('常昼残業休憩時間2', max_length=9)  # 常昼の残業休憩時間2
  break_time4_over3 = models.CharField('常昼残業休憩時間3', max_length=9)  # 常昼の残業休憩時間3
  break_time5 = models.CharField('連1直昼休憩時間', max_length=9)  # 連1直の昼休憩時間
  break_time5_over1 = models.CharField('連1直残業休憩時間1', max_length=9)  # 連1直の残業休憩時間1
  break_time5_over2 = models.CharField('連1直残業休憩時間2', max_length=9)  # 連1直の残業休憩時間2
  break_time5_over3 = models.CharField('連1直残業休憩時間3', max_length=9)  # 連1直の残業休憩時間3
  break_time6 = models.CharField('連2直昼休憩時間', max_length=9)  # 連2直の昼休憩時間
  break_time6_over1 = models.CharField('連2直残業休憩時間1', max_length=9)  # 連2直の残業休憩時間1
  break_time6_over2 = models.CharField('連2直残業休憩時間2', max_length=9)  # 連2直の残業休憩時間2
  break_time6_over3 = models.CharField('連2直残業休憩時間3', max_length=9)  # 連2直の残業休憩時間3
  # ---------- 本人向けお知らせ（最大5件。メインメニュー画面に表示） ----------
  #   自分の問い合わせに回答が来たとき（inquiry_views.py の InquirUpdate）に、空いている枠へ設定される。
  #   pop_up{N}    : お知らせの文言
  #   pop_up_id{N} : お知らせに対応する問い合わせのID（空ならその枠にお知らせは無い）
  pop_up1 = models.CharField('ポップアップ1', max_length=255, null=True, blank=True)  # お知らせ1の文言
  pop_up_id1 =  models.CharField('ポップアップID1', max_length=255, null=True, blank=True)  # お知らせ1に対応する問い合わせのID
  pop_up2 = models.CharField('ポップアップ2', max_length=255, null=True, blank=True)  # お知らせ2の文言
  pop_up_id2 =  models.CharField('ポップアップID2', max_length=255, null=True, blank=True)  # お知らせ2に対応する問い合わせのID
  pop_up3 = models.CharField('ポップアップ3', max_length=255, null=True, blank=True)  # お知らせ3の文言
  pop_up_id3 =  models.CharField('ポップアップID3', max_length=255, null=True, blank=True)  # お知らせ3に対応する問い合わせのID
  pop_up4 = models.CharField('ポップアップ4', max_length=255, null=True, blank=True)  # お知らせ4の文言
  pop_up_id4 =  models.CharField('ポップアップID4', max_length=255, null=True, blank=True)  # お知らせ4に対応する問い合わせのID
  pop_up5 = models.CharField('ポップアップ5', max_length=255, null=True, blank=True)  # お知らせ5の文言
  pop_up_id5 =  models.CharField('ポップアップID5', max_length=255, null=True, blank=True)  # お知らせ5に対応する問い合わせのID
  break_check = models.BooleanField('休憩エラー有効チェック', null=True)  # 休憩エラー有効チェック（True: 休憩時間に工数が入っていたらエラー / それ以外: 休憩時間の工数を消す）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: 氏名
  def __str__(self):
    return self.name

  # ログイン済みかどうかを返す（常に True）。
  #
  # Django / DRF の仕組みは「request.user.is_authenticated」でログイン済みかを確認することがある。
  # Django 標準のユーザーモデルが持つこの属性を真似て用意し、人員データを request.user として扱えるようにする。
  # @property を付けているので、メソッドだが member.is_authenticated のように () なしで値として読める。
  #
  # 戻り値:
  #   bool: 常に True（このデータが request.user に入っている＝ログイン済みのため）
  @property
  def is_authenticated(self):
    return True


# ------------------------------------------------------------
# Business_Time_graph: 工数データ（1日1人分の作業時間記録）
#   従業員番号＋就業日 の組み合わせで1行（DB上の一意制約は無く、ビュー側で1件に保っている）。
#   1日（0:00〜24:00）を5分刻みの288コマに分け、各コマで何の作業をしたかを
#   1文字ずつ並べた文字列（作業内容 time_work）で記録する。
#     コマ番号 = 時 × 12 + 分 ÷ 5（例: time_work[0] = 0:00〜0:05、time_work[102] = 8:30〜8:35）
#     各文字 : '#' = 未入力、'$' = 休憩、'A'〜'Z','a'〜'x' = 工数区分1〜50 の記号
#   作業詳細（detail_work）も同じ288コマ分を '$' でつないだ1つの文字列で保存する。
#   詳しい計算方法は utils/kosu_utils.py のファイルヘッダーを参照。
# ------------------------------------------------------------
class Business_Time_graph(models.Model):
  employee_no3 = models.IntegerField('従業員番号')  # 従業員番号（人員の employee_no と同じ値。工数データの検索に使う）
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)  # 氏名（人員データへの参照＝外部キー）。人員が削除されると NULL になる（SET_NULL）
  def_ver2 = models.CharField('工数区分定義Ver', max_length=100, blank=True, null=True)  # 工数区分定義Ver名（入力時に使っていた工数区分定義の kosu_name）
  work_day2 = models.DateField('就業日')  # 就業日（日付型。"YYYY-MM-DD"）
  tyoku2 = models.CharField('直', max_length=2, blank=True, null=True)  # 直（"1"〜"6" の文字列。番号の意味はファイルヘッダー参照）
  time_work = models.CharField('作業内容', max_length=288, blank=True, null=True)  # 作業内容（288文字。5分1コマごとの工数区分記号を並べた文字列）
  detail_work = models.CharField('作業詳細', max_length=32676, blank=True, null=True)  # 作業詳細（288コマ分を '$' でつないだ文字列。何も無い日は '$' が287個）
  over_time = models.IntegerField('残業時間', blank=True, null=True)  # 残業時間（分単位の整数）
  breaktime = models.CharField('昼休憩時間', max_length=9, blank=True, null=True)  # その日の昼休憩時間（"#HHMMHHMM"。当日休憩時間変更画面で変更できる）
  breaktime_over1 = models.CharField('残業休憩時間1', max_length=9, blank=True, null=True)  # その日の残業休憩時間1（"#HHMMHHMM"）
  breaktime_over2 = models.CharField('残業休憩時間2', max_length=9, blank=True, null=True)  # その日の残業休憩時間2（"#HHMMHHMM"）
  breaktime_over3 = models.CharField('残業休憩時間3', max_length=9, blank=True, null=True)  # その日の残業休憩時間3（"#HHMMHHMM"）
  work_time = models.CharField('就業形態', max_length=100, blank=True, null=True)  # 就業形態（"出勤" "休出" "年休" "半前年休" "休日" など）
  judgement = models.BooleanField('工数入力OK_NG', null=True)  # 工数入力OK/NG判定（True: 就業形態・直・残業時間と工数の合計時間に整合性がある）
  break_change = models.BooleanField('休憩変更チェック', null=True)  # 休憩変更チェック（工数入力時に「休憩変更」にチェックを入れたか。入れた場合は休憩時間を自動で書き込まない）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "ID__就業日:従業員番号" の形式（例: "12__2026-11-09:12345"）
  def __str__(self):
    return str(self.id) + '__' + str(self.work_day2) + ':' + str(self.employee_no3)



# ------------------------------------------------------------
# team_member: 班員（ログイン者が管理する班のメンバー）
#   班を管理する人（employee_no5）1人につき1行。メンバーの従業員番号を最大15人分持つ。
#   班員MENUの各画面（班員工数履歴・班員工数入力状況・班員残業など）は、
#   ここに登録されたメンバーの工数データを表示する。
# ------------------------------------------------------------
class team_member(models.Model):
  employee_no5 = models.IntegerField('従業員番号')  # 班を管理する人（班員登録をしたログイン者）の従業員番号
  # ---------- member1〜member15: 班のメンバー（15人分、すべて同じ構造） ----------
  #   メンバーの従業員番号を文字列（最大6文字）で保存する。空欄・NULL の枠はメンバー無し
  member1 = models.CharField('メンバー従業員番号1', max_length=6, blank=True, null=True)  # メンバー1の従業員番号
  member2 = models.CharField('メンバー従業員番号2', max_length=6, blank=True, null=True)  # メンバー2の従業員番号
  member3 = models.CharField('メンバー従業員番号3', max_length=6, blank=True, null=True)  # メンバー3の従業員番号
  member4 = models.CharField('メンバー従業員番号4', max_length=6, blank=True, null=True)  # メンバー4の従業員番号
  member5 = models.CharField('メンバー従業員番号5', max_length=6, blank=True, null=True)  # メンバー5の従業員番号
  member6 = models.CharField('メンバー従業員番号6', max_length=6, blank=True, null=True)  # メンバー6の従業員番号
  member7 = models.CharField('メンバー従業員番号7', max_length=6, blank=True, null=True)  # メンバー7の従業員番号
  member8 = models.CharField('メンバー従業員番号8', max_length=6, blank=True, null=True)  # メンバー8の従業員番号
  member9 = models.CharField('メンバー従業員番号9', max_length=6, blank=True, null=True)  # メンバー9の従業員番号
  member10 = models.CharField('メンバー従業員番号10', max_length=6, blank=True, null=True)  # メンバー10の従業員番号
  member11 = models.CharField('メンバー従業員番号11', max_length=6, blank=True, null=True)  # メンバー11の従業員番号
  member12 = models.CharField('メンバー従業員番号12', max_length=6, blank=True, null=True)  # メンバー12の従業員番号
  member13 = models.CharField('メンバー従業員番号13', max_length=6, blank=True, null=True)  # メンバー13の従業員番号
  member14 = models.CharField('メンバー従業員番号14', max_length=6, blank=True, null=True)  # メンバー14の従業員番号
  member15 = models.CharField('メンバー従業員番号15', max_length=6, blank=True, null=True)  # メンバー15の従業員番号
  follow = models.BooleanField('フォローON/OFF', null=True)  # 班員フォローON/OFF（True: 班員MENUに、過去7日間で工数未入力のある班員のお知らせを表示）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: 班を管理する人の従業員番号
  def __str__(self):
    return str(self.employee_no5)



# ============================================================
# 工数区分定義・作業詳細選択肢
# ============================================================

# ------------------------------------------------------------
# kosu_division: 工数区分定義（作業カテゴリの定義セット）
#   1行が1つの「工数区分定義Ver」。1つのVerに最大50個の工数区分（作業カテゴリ）を登録できる。
#   ログイン時に最新（IDが最大）のVerが選ばれ、工数区分定義切り替え画面で変更できる
#   （選択中のVer名はセッションの input_def に保存される）。
#   工数区分N（N=1〜50）は、作業内容（time_work）の記号と次のように対応する:
#     N= 1〜26 → 'A'〜'Z'、N=27〜50 → 'a'〜'x'（例: 工数区分1='A'、工数区分27='a'、工数区分50='x'）
# ------------------------------------------------------------
class kosu_division(models.Model):
  kosu_name = models.CharField('工数区分定義Ver名', blank=True, null=True, max_length=100)  # 工数区分定義Ver名（Verを識別する名前。工数データの def_ver2・セッションの input_def と対応）
  # ---------- 工数区分1〜50（以下の4項目1組が、1〜50 まで同じ構造で繰り返される） ----------
  #   kosu_title_N      : 工数区分名（工数入力画面の選択肢に表示する名称。空欄なら未使用の区分）
  #   kosu_division_1_N : 定義（どんな作業がこの区分に当たるかの説明文）
  #   kosu_division_2_N : 作業内容（この区分の具体的な作業の説明文）
  #   kosu_division_3_N : 変動/固定（True=変動 / それ以外=固定。班員の工数入力状況のExcel出力で
  #                       「可動」「固定」別に工数を合計するのに使う）
  #   定義・作業内容は工数区分定義確認画面に表示される
  kosu_title_1 = models.CharField('工数区分名1', blank=True, null=True, max_length=100)  # 工数区分1の名称（作業内容の記号 'A'）
  kosu_division_1_1 = models.TextField('定義1', blank=True, null=True)  # 工数区分1の定義
  kosu_division_2_1 = models.TextField('作業内容1', blank=True, null=True)  # 工数区分1の作業内容
  kosu_division_3_1 = models.BooleanField('変動/固定1', null=True)  # 工数区分1の変動/固定（True=変動）
  kosu_title_2 = models.CharField('工数区分名2', blank=True, null=True, max_length=100)  # 工数区分2の名称（作業内容の記号 'B'）
  kosu_division_1_2 = models.TextField('定義2', blank=True, null=True)  # 工数区分2の定義
  kosu_division_2_2 = models.TextField('作業内容2', blank=True, null=True)  # 工数区分2の作業内容
  kosu_division_3_2 = models.BooleanField('変動/固定2', null=True)  # 工数区分2の変動/固定（True=変動）
  kosu_title_3 = models.CharField('工数区分名3', blank=True, null=True, max_length=100)  # 工数区分3の名称（作業内容の記号 'C'）
  kosu_division_1_3 = models.TextField('定義3', blank=True, null=True)  # 工数区分3の定義
  kosu_division_2_3 = models.TextField('作業内容3', blank=True, null=True)  # 工数区分3の作業内容
  kosu_division_3_3 = models.BooleanField('変動/固定3', null=True)  # 工数区分3の変動/固定（True=変動）
  kosu_title_4 = models.CharField('工数区分名4', blank=True, null=True, max_length=100)  # 工数区分4の名称（作業内容の記号 'D'）
  kosu_division_1_4 = models.TextField('定義4', blank=True, null=True)  # 工数区分4の定義
  kosu_division_2_4 = models.TextField('作業内容4', blank=True, null=True)  # 工数区分4の作業内容
  kosu_division_3_4 = models.BooleanField('変動/固定4', null=True)  # 工数区分4の変動/固定（True=変動）
  kosu_title_5 = models.CharField('工数区分名5', blank=True, null=True, max_length=100)  # 工数区分5の名称（作業内容の記号 'E'）
  kosu_division_1_5 = models.TextField('定義5', blank=True, null=True)  # 工数区分5の定義
  kosu_division_2_5 = models.TextField('作業内容5', blank=True, null=True)  # 工数区分5の作業内容
  kosu_division_3_5 = models.BooleanField('変動/固定5', null=True)  # 工数区分5の変動/固定（True=変動）
  kosu_title_6 = models.CharField('工数区分名6', blank=True, null=True, max_length=100)  # 工数区分6の名称（作業内容の記号 'F'）
  kosu_division_1_6 = models.TextField('定義6', blank=True, null=True)  # 工数区分6の定義
  kosu_division_2_6 = models.TextField('作業内容6', blank=True, null=True)  # 工数区分6の作業内容
  kosu_division_3_6 = models.BooleanField('変動/固定6', null=True)  # 工数区分6の変動/固定（True=変動）
  kosu_title_7 = models.CharField('工数区分名7', blank=True, null=True, max_length=100)  # 工数区分7の名称（作業内容の記号 'G'）
  kosu_division_1_7 = models.TextField('定義7', blank=True, null=True)  # 工数区分7の定義
  kosu_division_2_7 = models.TextField('作業内容7', blank=True, null=True)  # 工数区分7の作業内容
  kosu_division_3_7 = models.BooleanField('変動/固定7', null=True)  # 工数区分7の変動/固定（True=変動）
  kosu_title_8 = models.CharField('工数区分名8', blank=True, null=True, max_length=100)  # 工数区分8の名称（作業内容の記号 'H'）
  kosu_division_1_8 = models.TextField('定義8', blank=True, null=True)  # 工数区分8の定義
  kosu_division_2_8 = models.TextField('作業内容8', blank=True, null=True)  # 工数区分8の作業内容
  kosu_division_3_8 = models.BooleanField('変動/固定8', null=True)  # 工数区分8の変動/固定（True=変動）
  kosu_title_9 = models.CharField('工数区分名9', blank=True, null=True, max_length=100)  # 工数区分9の名称（作業内容の記号 'I'）
  kosu_division_1_9 = models.TextField('定義9', blank=True, null=True)  # 工数区分9の定義
  kosu_division_2_9 = models.TextField('作業内容9', blank=True, null=True)  # 工数区分9の作業内容
  kosu_division_3_9 = models.BooleanField('変動/固定9', null=True)  # 工数区分9の変動/固定（True=変動）
  kosu_title_10 = models.CharField('工数区分名10', blank=True, null=True, max_length=100)  # 工数区分10の名称（作業内容の記号 'J'）
  kosu_division_1_10 = models.TextField('定義10', blank=True, null=True)  # 工数区分10の定義
  kosu_division_2_10 = models.TextField('作業内容10', blank=True, null=True)  # 工数区分10の作業内容
  kosu_division_3_10 = models.BooleanField('変動/固定10', null=True)  # 工数区分10の変動/固定（True=変動）
  kosu_title_11 = models.CharField('工数区分名11', blank=True, null=True, max_length=100)  # 工数区分11の名称（作業内容の記号 'K'）
  kosu_division_1_11 = models.TextField('定義11', blank=True, null=True)  # 工数区分11の定義
  kosu_division_2_11 = models.TextField('作業内容11', blank=True, null=True)  # 工数区分11の作業内容
  kosu_division_3_11 = models.BooleanField('変動/固定11', null=True)  # 工数区分11の変動/固定（True=変動）
  kosu_title_12 = models.CharField('工数区分名12', blank=True, null=True, max_length=100)  # 工数区分12の名称（作業内容の記号 'L'）
  kosu_division_1_12 = models.TextField('定義12', blank=True, null=True)  # 工数区分12の定義
  kosu_division_2_12 = models.TextField('作業内容12', blank=True, null=True)  # 工数区分12の作業内容
  kosu_division_3_12 = models.BooleanField('変動/固定12', null=True)  # 工数区分12の変動/固定（True=変動）
  kosu_title_13 = models.CharField('工数区分名13', blank=True, null=True, max_length=100)  # 工数区分13の名称（作業内容の記号 'M'）
  kosu_division_1_13 = models.TextField('定義13', blank=True, null=True)  # 工数区分13の定義
  kosu_division_2_13 = models.TextField('作業内容13', blank=True, null=True)  # 工数区分13の作業内容
  kosu_division_3_13 = models.BooleanField('変動/固定13', null=True)  # 工数区分13の変動/固定（True=変動）
  kosu_title_14 = models.CharField('工数区分名14', blank=True, null=True, max_length=100)  # 工数区分14の名称（作業内容の記号 'N'）
  kosu_division_1_14 = models.TextField('定義14', blank=True, null=True)  # 工数区分14の定義
  kosu_division_2_14 = models.TextField('作業内容14', blank=True, null=True)  # 工数区分14の作業内容
  kosu_division_3_14 = models.BooleanField('変動/固定14', null=True)  # 工数区分14の変動/固定（True=変動）
  kosu_title_15 = models.CharField('工数区分名15', blank=True, null=True, max_length=100)  # 工数区分15の名称（作業内容の記号 'O'）
  kosu_division_1_15 = models.TextField('定義15', blank=True, null=True)  # 工数区分15の定義
  kosu_division_2_15 = models.TextField('作業内容15', blank=True, null=True)  # 工数区分15の作業内容
  kosu_division_3_15 = models.BooleanField('変動/固定15', null=True)  # 工数区分15の変動/固定（True=変動）
  kosu_title_16 = models.CharField('工数区分名16', blank=True, null=True, max_length=100)  # 工数区分16の名称（作業内容の記号 'P'）
  kosu_division_1_16 = models.TextField('定義16', blank=True, null=True)  # 工数区分16の定義
  kosu_division_2_16 = models.TextField('作業内容16', blank=True, null=True)  # 工数区分16の作業内容
  kosu_division_3_16 = models.BooleanField('変動/固定16', null=True)  # 工数区分16の変動/固定（True=変動）
  kosu_title_17 = models.CharField('工数区分名17', blank=True, null=True, max_length=100)  # 工数区分17の名称（作業内容の記号 'Q'）
  kosu_division_1_17 = models.TextField('定義17', blank=True, null=True)  # 工数区分17の定義
  kosu_division_2_17 = models.TextField('作業内容17', blank=True, null=True)  # 工数区分17の作業内容
  kosu_division_3_17 = models.BooleanField('変動/固定17', null=True)  # 工数区分17の変動/固定（True=変動）
  kosu_title_18 = models.CharField('工数区分名18', blank=True, null=True, max_length=100)  # 工数区分18の名称（作業内容の記号 'R'）
  kosu_division_1_18 = models.TextField('定義18', blank=True, null=True)  # 工数区分18の定義
  kosu_division_2_18 = models.TextField('作業内容18', blank=True, null=True)  # 工数区分18の作業内容
  kosu_division_3_18 = models.BooleanField('変動/固定18', null=True)  # 工数区分18の変動/固定（True=変動）
  kosu_title_19 = models.CharField('工数区分名19', blank=True, null=True, max_length=100)  # 工数区分19の名称（作業内容の記号 'S'）
  kosu_division_1_19 = models.TextField('定義19', blank=True, null=True)  # 工数区分19の定義
  kosu_division_2_19 = models.TextField('作業内容19', blank=True, null=True)  # 工数区分19の作業内容
  kosu_division_3_19 = models.BooleanField('変動/固定19', null=True)  # 工数区分19の変動/固定（True=変動）
  kosu_title_20 = models.CharField('工数区分名20', blank=True, null=True, max_length=100)  # 工数区分20の名称（作業内容の記号 'T'）
  kosu_division_1_20 = models.TextField('定義20', blank=True, null=True)  # 工数区分20の定義
  kosu_division_2_20 = models.TextField('作業内容20', blank=True, null=True)  # 工数区分20の作業内容
  kosu_division_3_20 = models.BooleanField('変動/固定20', null=True)  # 工数区分20の変動/固定（True=変動）
  kosu_title_21 = models.CharField('工数区分名21', blank=True, null=True, max_length=100)  # 工数区分21の名称（作業内容の記号 'U'）
  kosu_division_1_21 = models.TextField('定義21', blank=True, null=True)  # 工数区分21の定義
  kosu_division_2_21 = models.TextField('作業内容21', blank=True, null=True)  # 工数区分21の作業内容
  kosu_division_3_21 = models.BooleanField('変動/固定21', null=True)  # 工数区分21の変動/固定（True=変動）
  kosu_title_22 = models.CharField('工数区分名22', blank=True, null=True, max_length=100)  # 工数区分22の名称（作業内容の記号 'V'）
  kosu_division_1_22 = models.TextField('定義22', blank=True, null=True)  # 工数区分22の定義
  kosu_division_2_22 = models.TextField('作業内容22', blank=True, null=True)  # 工数区分22の作業内容
  kosu_division_3_22 = models.BooleanField('変動/固定22', null=True)  # 工数区分22の変動/固定（True=変動）
  kosu_title_23 = models.CharField('工数区分名23', blank=True, null=True, max_length=100)  # 工数区分23の名称（作業内容の記号 'W'）
  kosu_division_1_23 = models.TextField('定義23', blank=True, null=True)  # 工数区分23の定義
  kosu_division_2_23 = models.TextField('作業内容23', blank=True, null=True)  # 工数区分23の作業内容
  kosu_division_3_23 = models.BooleanField('変動/固定23', null=True)  # 工数区分23の変動/固定（True=変動）
  kosu_title_24 = models.CharField('工数区分名24', blank=True, null=True, max_length=100)  # 工数区分24の名称（作業内容の記号 'X'）
  kosu_division_1_24 = models.TextField('定義24', blank=True, null=True)  # 工数区分24の定義
  kosu_division_2_24 = models.TextField('作業内容24', blank=True, null=True)  # 工数区分24の作業内容
  kosu_division_3_24 = models.BooleanField('変動/固定24', null=True)  # 工数区分24の変動/固定（True=変動）
  kosu_title_25 = models.CharField('工数区分名25', blank=True, null=True, max_length=100)  # 工数区分25の名称（作業内容の記号 'Y'）
  kosu_division_1_25 = models.TextField('定義25', blank=True, null=True)  # 工数区分25の定義
  kosu_division_2_25 = models.TextField('作業内容25', blank=True, null=True)  # 工数区分25の作業内容
  kosu_division_3_25 = models.BooleanField('変動/固定25', null=True)  # 工数区分25の変動/固定（True=変動）
  kosu_title_26 = models.CharField('工数区分名26', blank=True, null=True, max_length=100)  # 工数区分26の名称（作業内容の記号 'Z'）
  kosu_division_1_26 = models.TextField('定義26', blank=True, null=True)  # 工数区分26の定義
  kosu_division_2_26 = models.TextField('作業内容26', blank=True, null=True)  # 工数区分26の作業内容
  kosu_division_3_26 = models.BooleanField('変動/固定26', null=True)  # 工数区分26の変動/固定（True=変動）
  kosu_title_27 = models.CharField('工数区分名27', blank=True, null=True, max_length=100)  # 工数区分27の名称（作業内容の記号 'a'）
  kosu_division_1_27 = models.TextField('定義27', blank=True, null=True)  # 工数区分27の定義
  kosu_division_2_27 = models.TextField('作業内容27', blank=True, null=True)  # 工数区分27の作業内容
  kosu_division_3_27 = models.BooleanField('変動/固定27', null=True)  # 工数区分27の変動/固定（True=変動）
  kosu_title_28 = models.CharField('工数区分名28', blank=True, null=True, max_length=100)  # 工数区分28の名称（作業内容の記号 'b'）
  kosu_division_1_28 = models.TextField('定義28', blank=True, null=True)  # 工数区分28の定義
  kosu_division_2_28 = models.TextField('作業内容28', blank=True, null=True)  # 工数区分28の作業内容
  kosu_division_3_28 = models.BooleanField('変動/固定28', null=True)  # 工数区分28の変動/固定（True=変動）
  kosu_title_29 = models.CharField('工数区分名29', blank=True, null=True, max_length=100)  # 工数区分29の名称（作業内容の記号 'c'）
  kosu_division_1_29 = models.TextField('定義29', blank=True, null=True)  # 工数区分29の定義
  kosu_division_2_29 = models.TextField('作業内容29', blank=True, null=True)  # 工数区分29の作業内容
  kosu_division_3_29 = models.BooleanField('変動/固定29', null=True)  # 工数区分29の変動/固定（True=変動）
  kosu_title_30 = models.CharField('工数区分名30', blank=True, null=True, max_length=100)  # 工数区分30の名称（作業内容の記号 'd'）
  kosu_division_1_30 = models.TextField('定義30', blank=True, null=True)  # 工数区分30の定義
  kosu_division_2_30 = models.TextField('作業内容30', blank=True, null=True)  # 工数区分30の作業内容
  kosu_division_3_30 = models.BooleanField('変動/固定30', null=True)  # 工数区分30の変動/固定（True=変動）
  kosu_title_31 = models.CharField('工数区分名31', blank=True, null=True, max_length=100)  # 工数区分31の名称（作業内容の記号 'e'）
  kosu_division_1_31 = models.TextField('定義31', blank=True, null=True)  # 工数区分31の定義
  kosu_division_2_31 = models.TextField('作業内容31', blank=True, null=True)  # 工数区分31の作業内容
  kosu_division_3_31 = models.BooleanField('変動/固定31', null=True)  # 工数区分31の変動/固定（True=変動）
  kosu_title_32 = models.CharField('工数区分名32', blank=True, null=True, max_length=100)  # 工数区分32の名称（作業内容の記号 'f'）
  kosu_division_1_32 = models.TextField('定義32', blank=True, null=True)  # 工数区分32の定義
  kosu_division_2_32 = models.TextField('作業内容32', blank=True, null=True)  # 工数区分32の作業内容
  kosu_division_3_32 = models.BooleanField('変動/固定32', null=True)  # 工数区分32の変動/固定（True=変動）
  kosu_title_33 = models.CharField('工数区分名33', blank=True, null=True, max_length=100)  # 工数区分33の名称（作業内容の記号 'g'）
  kosu_division_1_33 = models.TextField('定義33', blank=True, null=True)  # 工数区分33の定義
  kosu_division_2_33 = models.TextField('作業内容33', blank=True, null=True)  # 工数区分33の作業内容
  kosu_division_3_33 = models.BooleanField('変動/固定33', null=True)  # 工数区分33の変動/固定（True=変動）
  kosu_title_34 = models.CharField('工数区分名34', blank=True, null=True, max_length=100)  # 工数区分34の名称（作業内容の記号 'h'）
  kosu_division_1_34 = models.TextField('定義34', blank=True, null=True)  # 工数区分34の定義
  kosu_division_2_34 = models.TextField('作業内容34', blank=True, null=True)  # 工数区分34の作業内容
  kosu_division_3_34 = models.BooleanField('変動/固定34', null=True)  # 工数区分34の変動/固定（True=変動）
  kosu_title_35 = models.CharField('工数区分名35', blank=True, null=True, max_length=100)  # 工数区分35の名称（作業内容の記号 'i'）
  kosu_division_1_35 = models.TextField('定義35', blank=True, null=True)  # 工数区分35の定義
  kosu_division_2_35 = models.TextField('作業内容35', blank=True, null=True)  # 工数区分35の作業内容
  kosu_division_3_35 = models.BooleanField('変動/固定35', null=True)  # 工数区分35の変動/固定（True=変動）
  kosu_title_36 = models.CharField('工数区分名36', blank=True, null=True, max_length=100)  # 工数区分36の名称（作業内容の記号 'j'）
  kosu_division_1_36 = models.TextField('定義36', blank=True, null=True)  # 工数区分36の定義
  kosu_division_2_36 = models.TextField('作業内容36', blank=True, null=True)  # 工数区分36の作業内容
  kosu_division_3_36 = models.BooleanField('変動/固定36', null=True)  # 工数区分36の変動/固定（True=変動）
  kosu_title_37 = models.CharField('工数区分名37', blank=True, null=True, max_length=100)  # 工数区分37の名称（作業内容の記号 'k'）
  kosu_division_1_37 = models.TextField('定義37', blank=True, null=True)  # 工数区分37の定義
  kosu_division_2_37 = models.TextField('作業内容37', blank=True, null=True)  # 工数区分37の作業内容
  kosu_division_3_37 = models.BooleanField('変動/固定37', null=True)  # 工数区分37の変動/固定（True=変動）
  kosu_title_38 = models.CharField('工数区分名38', blank=True, null=True, max_length=100)  # 工数区分38の名称（作業内容の記号 'l'）
  kosu_division_1_38 = models.TextField('定義38', blank=True, null=True)  # 工数区分38の定義
  kosu_division_2_38 = models.TextField('作業内容38', blank=True, null=True)  # 工数区分38の作業内容
  kosu_division_3_38 = models.BooleanField('変動/固定38', null=True)  # 工数区分38の変動/固定（True=変動）
  kosu_title_39 = models.CharField('工数区分名39', blank=True, null=True, max_length=100)  # 工数区分39の名称（作業内容の記号 'm'）
  kosu_division_1_39 = models.TextField('定義39', blank=True, null=True)  # 工数区分39の定義
  kosu_division_2_39 = models.TextField('作業内容39', blank=True, null=True)  # 工数区分39の作業内容
  kosu_division_3_39 = models.BooleanField('変動/固定39', null=True)  # 工数区分39の変動/固定（True=変動）
  kosu_title_40 = models.CharField('工数区分名40', blank=True, null=True, max_length=100)  # 工数区分40の名称（作業内容の記号 'n'）
  kosu_division_1_40 = models.TextField('定義40', blank=True, null=True)  # 工数区分40の定義
  kosu_division_2_40 = models.TextField('作業内容40', blank=True, null=True)  # 工数区分40の作業内容
  kosu_division_3_40 = models.BooleanField('変動/固定40', null=True)  # 工数区分40の変動/固定（True=変動）
  kosu_title_41 = models.CharField('工数区分名41', blank=True, null=True, max_length=100)  # 工数区分41の名称（作業内容の記号 'o'）
  kosu_division_1_41 = models.TextField('定義41', blank=True, null=True)  # 工数区分41の定義
  kosu_division_2_41 = models.TextField('作業内容41', blank=True, null=True)  # 工数区分41の作業内容
  kosu_division_3_41 = models.BooleanField('変動/固定41', null=True)  # 工数区分41の変動/固定（True=変動）
  kosu_title_42 = models.CharField('工数区分名42', blank=True, null=True, max_length=100)  # 工数区分42の名称（作業内容の記号 'p'）
  kosu_division_1_42 = models.TextField('定義42', blank=True, null=True)  # 工数区分42の定義
  kosu_division_2_42 = models.TextField('作業内容42', blank=True, null=True)  # 工数区分42の作業内容
  kosu_division_3_42 = models.BooleanField('変動/固定42', null=True)  # 工数区分42の変動/固定（True=変動）
  kosu_title_43 = models.CharField('工数区分名43', blank=True, null=True, max_length=100)  # 工数区分43の名称（作業内容の記号 'q'）
  kosu_division_1_43 = models.TextField('定義43', blank=True, null=True)  # 工数区分43の定義
  kosu_division_2_43 = models.TextField('作業内容43', blank=True, null=True)  # 工数区分43の作業内容
  kosu_division_3_43 = models.BooleanField('変動/固定43', null=True)  # 工数区分43の変動/固定（True=変動）
  kosu_title_44 = models.CharField('工数区分名44', blank=True, null=True, max_length=100)  # 工数区分44の名称（作業内容の記号 'r'）
  kosu_division_1_44 = models.TextField('定義44', blank=True, null=True)  # 工数区分44の定義
  kosu_division_2_44 = models.TextField('作業内容44', blank=True, null=True)  # 工数区分44の作業内容
  kosu_division_3_44 = models.BooleanField('変動/固定44', null=True)  # 工数区分44の変動/固定（True=変動）
  kosu_title_45 = models.CharField('工数区分名45', blank=True, null=True, max_length=100)  # 工数区分45の名称（作業内容の記号 's'）
  kosu_division_1_45 = models.TextField('定義45', blank=True, null=True)  # 工数区分45の定義
  kosu_division_2_45 = models.TextField('作業内容45', blank=True, null=True)  # 工数区分45の作業内容
  kosu_division_3_45 = models.BooleanField('変動/固定45', null=True)  # 工数区分45の変動/固定（True=変動）
  kosu_title_46 = models.CharField('工数区分名46', blank=True, null=True, max_length=100)  # 工数区分46の名称（作業内容の記号 't'）
  kosu_division_1_46 = models.TextField('定義46', blank=True, null=True)  # 工数区分46の定義
  kosu_division_2_46 = models.TextField('作業内容46', blank=True, null=True)  # 工数区分46の作業内容
  kosu_division_3_46 = models.BooleanField('変動/固定46', null=True)  # 工数区分46の変動/固定（True=変動）
  kosu_title_47 = models.CharField('工数区分名47', blank=True, null=True, max_length=100)  # 工数区分47の名称（作業内容の記号 'u'）
  kosu_division_1_47 = models.TextField('定義47', blank=True, null=True)  # 工数区分47の定義
  kosu_division_2_47 = models.TextField('作業内容47', blank=True, null=True)  # 工数区分47の作業内容
  kosu_division_3_47 = models.BooleanField('変動/固定47', null=True)  # 工数区分47の変動/固定（True=変動）
  kosu_title_48 = models.CharField('工数区分名48', blank=True, null=True, max_length=100)  # 工数区分48の名称（作業内容の記号 'v'）
  kosu_division_1_48 = models.TextField('定義48', blank=True, null=True)  # 工数区分48の定義
  kosu_division_2_48 = models.TextField('作業内容48', blank=True, null=True)  # 工数区分48の作業内容
  kosu_division_3_48 = models.BooleanField('変動/固定48', null=True)  # 工数区分48の変動/固定（True=変動）
  kosu_title_49 = models.CharField('工数区分名49', blank=True, null=True, max_length=100)  # 工数区分49の名称（作業内容の記号 'w'）
  kosu_division_1_49 = models.TextField('定義49', blank=True, null=True)  # 工数区分49の定義
  kosu_division_2_49 = models.TextField('作業内容49', blank=True, null=True)  # 工数区分49の作業内容
  kosu_division_3_49 = models.BooleanField('変動/固定49', null=True)  # 工数区分49の変動/固定（True=変動）
  kosu_title_50 = models.CharField('工数区分名50', blank=True, null=True, max_length=100)  # 工数区分50の名称（作業内容の記号 'x'）
  kosu_division_1_50 = models.TextField('定義50', blank=True, null=True)  # 工数区分50の定義
  kosu_division_2_50 = models.TextField('作業内容50', blank=True, null=True)  # 工数区分50の作業内容
  kosu_division_3_50 = models.BooleanField('変動/固定50', null=True)  # 工数区分50の変動/固定（True=変動）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "ID : 工数区分定義Ver名" の形式
  def __str__(self):
    return str(self.id) + ' : ' + str(self.kosu_name)



# ------------------------------------------------------------
# def_choice: 作業詳細選択肢
#   工数入力画面で「作業詳細」を入力するときの候補（よく使う文言）を、工数区分の記号ごとに登録する。
#   工数入力画面では、選んだ工数区分と同じ記号の候補だけが作業詳細の選択肢に表示される。
# ------------------------------------------------------------
class def_choice(models.Model):
  # 定義記号の選択肢: 'A'〜'Z','a'〜'x'（工数区分1〜50）と '$'（休憩）の計51個
  #   文字列を1文字ずつ取り出し、(保存する値, 表示名) が同じ組のリストを作っている
  #   例: [('A', 'A'), ('B', 'B'), ..., ('x', 'x'), ('$', '$')]
  def_list = [(x, x) for x in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx$"]

  def_symbol = models.CharField('定義記号', choices=def_list, max_length=2)  # 定義記号（どの工数区分の候補か。上の def_list のいずれか。'$' は休憩）
  def_select = models.CharField('作業詳細', max_length=100)  # 作業詳細の候補文言（同じ文言の重複登録はビュー側で禁止している）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: 定義記号と作業詳細をつなげた文字列（例: "A点検作業"）
  def __str__(self):
    return str(self.def_symbol) + str(self.def_select)



# ============================================================
# 管理者設定・問い合わせ
# ============================================================

# ------------------------------------------------------------
# administrator_data: 管理者設定
#   システム全体の設定。複数行あっても、各処理は ID が最大の1行（最新の設定）だけを使う。
#   管理者MENUの設定編集画面で変更する。
# ------------------------------------------------------------
class administrator_data(models.Model):
  menu_row = models.CharField('一覧表示項目数', max_length=4)  # 一覧表示項目数（各一覧画面の1ページの件数。文字列で保存。utils/main_utils.py の CustomPagination が使う）
  # 問い合わせ担当者の従業員番号（最大3人。文字列で保存。空欄なら担当者なし）
  #   担当者には担当者向けお知らせが表示され、問い合わせの閲覧・回答ができる
  administrator_employee_no1 =  models.CharField('問い合わせ担当者従業員番号1', max_length=255, null=True, blank=True)  # 問い合わせ担当者1の従業員番号
  administrator_employee_no2 =  models.CharField('問い合わせ担当者従業員番号2', max_length=255, null=True, blank=True)  # 問い合わせ担当者2の従業員番号
  administrator_employee_no3 =  models.CharField('問い合わせ担当者従業員番号3', max_length=255, null=True, blank=True)  # 問い合わせ担当者3の従業員番号
  # ---------- 問い合わせ担当者向けお知らせ（最大5件。メインメニュー画面に表示） ----------
  #   問い合わせが新しく登録・編集されたとき（inquiry_views.py）に、空いている枠へ設定される。
  #   pop_up{N}    : お知らせの文言
  #   pop_up_id{N} : お知らせに対応する問い合わせのID（空ならその枠にお知らせは無い）
  pop_up1 = models.CharField('ポップアップ1', max_length=255, null=True, blank=True)  # 担当者向けお知らせ1の文言
  pop_up_id1 =  models.CharField('ポップアップID1', max_length=255, null=True, blank=True)  # 担当者向けお知らせ1に対応する問い合わせのID
  pop_up2 = models.CharField('ポップアップ2', max_length=255, null=True, blank=True)  # 担当者向けお知らせ2の文言
  pop_up_id2 =  models.CharField('ポップアップID2', max_length=255, null=True, blank=True)  # 担当者向けお知らせ2に対応する問い合わせのID
  pop_up3 = models.CharField('ポップアップ3', max_length=255, null=True, blank=True)  # 担当者向けお知らせ3の文言
  pop_up_id3 =  models.CharField('ポップアップID3', max_length=255, null=True, blank=True)  # 担当者向けお知らせ3に対応する問い合わせのID
  pop_up4 = models.CharField('ポップアップ4', max_length=255, null=True, blank=True)  # 担当者向けお知らせ4の文言
  pop_up_id4 =  models.CharField('ポップアップID4', max_length=255, null=True, blank=True)  # 担当者向けお知らせ4に対応する問い合わせのID
  pop_up5 = models.CharField('ポップアップ5', max_length=255, null=True, blank=True)  # 担当者向けお知らせ5の文言
  pop_up_id5 =  models.CharField('ポップアップID5', max_length=255, null=True, blank=True)  # 担当者向けお知らせ5に対応する問い合わせのID

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "設定" ＋ ID（例: "設定1"）
  def __str__(self):
    return '設定' + str(self.id)



# ------------------------------------------------------------
# inquiry_data: 問い合わせ
#   システムへの要望・不具合報告・問い合わせを1件1行で記録する。
#   問い合わせ担当者（管理者設定）が回答（answer）を入力すると、問い合わせた人にお知らせが届く。
# ------------------------------------------------------------
class inquiry_data(models.Model):
  # 内容の選択肢（保存する値, 表示名）
  content_list = [
    ('要望', '要望'),
    ('不具合', '不具合'),
    ('問い合わせ' ,'問い合わせ'),
  ]

  employee_no2 = models.IntegerField('従業員番号')  # 問い合わせた人の従業員番号
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)  # 問い合わせた人の人員データ（外部キー）。人員が削除されると NULL になる
  content_choice = models.CharField('内容選択', choices=content_list, max_length=5)  # 内容選択（上の content_list のいずれか）
  inquiry = models.TextField('問い合わせ')  # 問い合わせの本文
  answer = models.TextField('回答', null=True, blank=True)  # 回答（問い合わせ担当者が入力。未回答なら空）
  created_at = models.DateTimeField(auto_now_add=True)  # 登録日時（auto_now_add: 新規作成時に自動で記録され、以後は変わらない）
  updated_at = models.DateTimeField(auto_now=True)  # 更新日時（auto_now: 保存するたびに自動で現在日時に更新される）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: ID と氏名をつなげた文字列
  def __str__(self):
    return str(self.id) + str(self.name)



# ============================================================
# 非同期タスク・操作履歴
# ============================================================

# ------------------------------------------------------------
# AsyncTask: 非同期タスク（バックアップ/復元などのバックグラウンド処理）
#   asynchronous_views.py の backup が処理を始めるときに1行作り（status='pending'）、
#   処理が終わると handle_task が status と result を更新する。
#   画面側は check_backup_status API で status を繰り返し確認し、処理の完了を待つ。
#   件数が MAX_RECORDS を超えると古いものから自動で削除する（下の save() 参照）。
# ------------------------------------------------------------
class AsyncTask(models.Model):
  MAX_RECORDS = 1000  # 保持する最大件数（これを超えた分は古い順に削除）

  task_id = models.CharField(max_length=255, unique=True)  # タスクID（uuid4 で作るランダムな文字列。重複不可）
  # 処理の状態（下の3つのいずれか）
  status = models.CharField(max_length=50, choices=[
    ('pending', 'Pending'),  # 処理中
    ('success', 'Success'),  # 成功
    ('error', 'Error')  # エラー
  ])
  result = models.TextField(null=True, blank=True)  # 結果（成功時: タスク関数の戻り値。バックアップなら作成したファイルのパス / エラー時: エラーメッセージ）
  created_at = models.DateTimeField(auto_now_add=True)  # 登録日時（新規作成時に自動で記録）
  updated_at = models.DateTimeField(auto_now=True)  # 更新日時（保存するたびに自動で更新）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "登録日時 on 状態 (TaskID: タスクID)" の形式
  def __str__(self):
    return f'{self.created_at} on {self.status} (TaskID: {self.task_id})'

  # データを保存し、件数が上限を超えていれば古いものから削除する。
  #
  # Django 標準の save()（保存処理）を上書きして、保存後に件数チェックを追加している。
  #
  # 引数:
  #   *args, **kwargs: 標準の save() に渡す引数（そのまま引き渡す）
  # 戻り値:
  #   なし
  def save(self, *args, **kwargs):
    # まず通常どおりデータベースに保存する（super() は親クラス models.Model を指す）
    super().save(*args, **kwargs)
    # 保存後のこのテーブルの全件数を数える
    current_count = self.__class__.objects.count()

    # 件数が上限（MAX_RECORDS）を超えた場合の処理
    if current_count > self.MAX_RECORDS:
      # 超過した件数分を、登録日時の古い順に取得して1件ずつ削除する
      #   例: 上限1000件で1001件になった場合 → 最も古い1件を削除
      excess_count = current_count - self.MAX_RECORDS
      oldest_records = self.__class__.objects.order_by('created_at')[:excess_count]
      for record in oldest_records:
        record.delete()



# ------------------------------------------------------------
# Operation_history: 操作履歴（画面単位の記録用）
#   だれが・どのページで・どのモデルを編集し・結果がどうだったかを記録するためのテーブル。
#   ※現在のコード（views / signals.py / admin.py / tasks.py）からは参照されておらず、
#     データは記録されない。データ変更の記録は下の History が担っている。
# ------------------------------------------------------------
class Operation_history(models.Model):
  created_at = models.DateTimeField(auto_now_add=True)  # 記録日時（新規作成時に自動で記録）
  employee_no4 = models.IntegerField('従業員番号')  # 操作した人の従業員番号
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)  # 操作した人の人員データ（外部キー）。人員が削除されると NULL になる
  post_page = models.CharField('ページ', max_length=255, null=True, blank=True)  # 操作したページ
  operation_models = models.CharField('編集したモデル', max_length=255, null=True, blank=True)  # 編集したモデル
  status = models.CharField('結果', max_length=255, null=True, blank=True)  # 結果
  operation_detail = models.TextField('編集詳細', null=True, blank=True)  # 編集の詳細

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "ID氏名：記録日時" の形式
  def __str__(self):
    return str(self.id) + str(self.name) + '：' + str(self.created_at)



# ------------------------------------------------------------
# History: 操作履歴（データ変更の監査ログ）
#   signals.py が、人員・工数データ・班員・工数区分定義・作業詳細選択肢・管理者設定・問い合わせの
#   作成 / 更新 / 削除のたびに自動で1行記録する。管理者MENUのデータ操作履歴画面で閲覧できる。
#   件数が MAX_RECORDS を超えると古いものから自動で削除する（下の save() 参照）。
# ------------------------------------------------------------
class History(models.Model):
  MAX_RECORDS = 500000  # 保持する最大件数（50万件。これを超えた分は古い順に削除）

  operation = models.CharField(max_length=10)  # 操作の種類（'CREATE'=作成 / 'UPDATE'=更新 / 'DELETE'=削除）
  table_name = models.CharField(max_length=50)  # 対象テーブル（モデル）名（例: 'member', 'Business_Time_graph'）
  record_id = models.IntegerField()  # 対象データのID（主キー）
  login_No = models.CharField(max_length=255, blank=True, null=True)  # 操作した人の従業員番号（セッションの login_No。別スレッドの処理などセッションが無い場合は NULL）
  changes = jsonfield.JSONField(blank=True, null=True)  # 変更内容（作成時: {項目名: 値} / 更新時: {項目名: {'old': 変更前, 'new': 変更後}} / 削除時: NULL）
  timestamp = models.DateTimeField(auto_now_add=True)  # 記録日時（新規作成時に自動で記録）

  # 管理サイトなどでこのデータを文字列として表示するときの表記を返す。
  #
  # 戻り値:
  #   str: "操作の種類 on テーブル名 (ID: 対象データのID)" の形式
  def __str__(self):
    return f'{self.operation} on {self.table_name} (ID: {self.record_id})'

  # データを保存し、件数が上限を超えていれば古いものから削除する。
  #
  # Django 標準の save()（保存処理）を上書きして、保存後に件数チェックを追加している。
  #
  # 引数:
  #   *args, **kwargs: 標準の save() に渡す引数（そのまま引き渡す）
  # 戻り値:
  #   なし
  def save(self, *args, **kwargs):
    # まず通常どおりデータベースに保存する（super() は親クラス models.Model を指す）
    super().save(*args, **kwargs)
    # 保存後のこのテーブルの全件数を数える
    current_count = self.__class__.objects.count()

    # 件数が上限（MAX_RECORDS）を超えた場合の処理
    if current_count > self.MAX_RECORDS:
      # 超過した件数分を、記録日時（timestamp）の古い順に取得して1件ずつ削除する
      excess_count = current_count - self.MAX_RECORDS
      oldest_records = self.__class__.objects.order_by('timestamp')[:excess_count]
      for record in oldest_records:
        record.delete()