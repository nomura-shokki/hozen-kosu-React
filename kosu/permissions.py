# ============================================================
# ファイル名 : permissions.py
# 種別       : 認証・権限クラス（Django REST Framework）
# 概要       : 「だれがログインしているか（認証）」と「その人がAPIを使ってよいか（権限）」を
#              判定する部品をまとめたファイル。全APIで共通に使われる。
#              ※この下にある """ で囲まれた説明文（docstring）は既存のもので、内容は同じ趣旨。
#
# 主なクラス:
#   - LoginNoAuthentication : セッションの login_No（従業員番号）からログイン者の人員データを探す（認証）
#   - IsLoggedIn            : ログイン済みであること（全APIの既定の権限）
#   - HasAuthority          : ログイン済み かつ 人員データの「権限」が ON（人員・班員の画面用）
#   - IsAdministrator       : ログイン済み かつ 人員データの「管理者」が ON（管理者・定義編集の画面用）
#
# 使われ方   : settings.py の REST_FRAMEWORK で
#                DEFAULT_AUTHENTICATION_CLASSES = LoginNoAuthentication
#                DEFAULT_PERMISSION_CLASSES     = IsLoggedIn
#              と指定しているため、何も書かないAPIは「ログイン必須」になる。
#              各ビューで permission_classes = [HasAuthority] のように上書きして権限を強める。
#              ログイン不要のAPI（ログイン・ログアウト・ヘルプ）は AllowAny で上書きして外している。
# 関連ファイル: hozen_another/settings.py（REST_FRAMEWORK）, models.py（member）,
#              views/main_views.py（Login: ログイン時にセッションへ login_No を保存）
# ============================================================
"""ログイン中の人と、その人の権限を確かめる部品（全部の API で共通に使う）。

settings.py の REST_FRAMEWORK で「最初から全部の API にかける」設定にするので、
ログインが要らない API（ログイン・ログアウト・ヘルプ）だけ AllowAny を付けて外す。
"""
# ============================================================
# インポート
# ============================================================
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, CSRFCheck
from rest_framework.permissions import BasePermission

from .models import member


# ------------------------------------------------------------
# LoginNoAuthentication: セッション情報によるログイン者の認証
#   ログイン時にセッションへ保存された login_No（従業員番号）を使い、
#   人員データ（member）からログイン者を特定する。
#   特定できた人員データは、各ビューで request.user として使える。
#   特定できなければ request.user は None（settings.py の UNAUTHENTICATED_USER）。
# ------------------------------------------------------------
class LoginNoAuthentication(BaseAuthentication):
  """セッションの login_No から、ログイン中の人（member）を探す。"""

  # リクエストからログイン者を特定する（APIが呼ばれるたびに DRF が自動で呼ぶ）。
  #
  # ログイン者が見つかった場合は、続けて CSRF トークン（なりすまし送信を防ぐ合言葉）も確認する。
  #
  # 引数:
  #   request: DRF のリクエスト
  # 戻り値:
  #   tuple: (ログイン者の人員データ, None) のタプル。DRF が request.user / request.auth に設定する
  #   None : 未ログイン、またはセッションの従業員番号が人員データに存在しない場合
  # 例外:
  #   PermissionDenied: CSRF トークンの確認に失敗した場合（403 エラーになる）
  def authenticate(self, request):
    # DRF の Request の中にある Django 本来のリクエスト（_request）からセッションを読み、
    # ログイン時に保存した従業員番号（login_No）を取り出す
    login_no = request._request.session.get('login_No')
    if not login_no:
      return None                      # ログインしていない → request.user は None
    # 従業員番号が一致する人員データを1件取得（見つからなければ None）
    login_member = member.objects.filter(employee_no=login_no).first()
    if login_member is None:
      return None                      # 人員から消された人 → ログインしていない扱い
    self.enforce_csrf(request)         # ログイン中の人の書き込みは、CSRF トークンも確かめる
    # (ユーザー, 認証情報) の形で返す。認証情報は使わないので None
    return (login_member, None)

  # CSRF トークンを確認する。
  #
  # CSRF（クロスサイト・リクエスト・フォージェリ）とは、別サイトからログイン中の人になりすまして
  # 書き込みを送らせる攻撃のこと。POST/PUT/DELETE などの書き込み系リクエストでは、
  # 送信元（Origin）が許可されたものか（settings.py の CSRF_TRUSTED_ORIGINS など）と、
  # Cookie の csrftoken とヘッダー X-CSRFToken（api/axios.ts が自動で付ける）が一致するかを確認する。
  # GET などの読み取り系リクエストは確認対象外。
  #
  # 引数:
  #   request: DRF のリクエスト
  # 戻り値:
  #   なし（問題なければ何もせずに終わる）
  # 例外:
  #   PermissionDenied: トークンが無い・一致しない等で確認に失敗した場合
  def enforce_csrf(self, request):
    # DRF の SessionAuthentication.enforce_csrf と同じ確かめ方
    # CSRFCheck は Django の CSRF ミドルウェアを流用した判定用クラス。
    # 生成時に「次の処理」を渡す必要があるが、判定だけに使うので何もしないダミー関数を渡す
    def dummy_get_response(request):
      return None
    check = CSRFCheck(dummy_get_response)
    # リクエストに含まれる CSRF トークン（Cookie）を読み取る準備
    check.process_request(request)
    # 判定を実行。問題なければ None、問題があれば失敗理由の文字列が返る
    reason = check.process_view(request, None, (), {})
    # 失敗理由がある場合は 403（権限なし）エラーにする
    if reason:
      raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')

  # 未ログイン時のレスポンスに付ける WWW-Authenticate ヘッダーの値を返す。
  #
  # 引数:
  #   request: DRF のリクエスト
  # 戻り値:
  #   str: 'Session'（値の中身に意味はなく、何か返すことが重要）
  def authenticate_header(self, request):
    # これを返すと、ログインしていない時に 403 ではなく 401 になる（画面はログイン画面へ戻る）
    return 'Session'


# ------------------------------------------------------------
# IsLoggedIn: ログイン済みかどうかの権限判定
#   settings.py の DEFAULT_PERMISSION_CLASSES に指定されているため、
#   permission_classes を書いていない全APIにこの判定がかかる。
#   判定NGで未ログインの場合は 401（ログイン画面へ）になる。
# ------------------------------------------------------------
class IsLoggedIn(BasePermission):
  """ログインしていること。"""
  # APIを使ってよいかを判定する（DRF がビューの処理前に自動で呼ぶ）。
  #
  # 引数:
  #   request: DRF のリクエスト
  #   view   : 呼び出されたビュー（この判定では未使用）
  # 戻り値:
  #   bool: True ならAPI利用可。request.user が人員データ（member）ならログイン済みとみなす
  def has_permission(self, request, view):
    # 未ログイン時の request.user は None なので False になる
    return isinstance(request.user, member)


# ------------------------------------------------------------
# HasAuthority: 「権限」ありの人員だけが使えるAPI用の権限判定
#   人員管理（member_views.py）・班員管理（team_views.py）などで使う。
#   ログイン済みだが権限が無い場合は 403（フロント側ではメインメニューへ戻される）。
# ------------------------------------------------------------
class HasAuthority(IsLoggedIn):
  """ログインしていて、「権限」が付いていること（人員・班員の画面）。"""
  # ログイン済み かつ 人員データの authority（権限）が ON かを判定する。
  #
  # 引数:
  #   request: DRF のリクエスト
  #   view   : 呼び出されたビュー（この判定では未使用）
  # 戻り値:
  #   bool: 両方満たせば True
  def has_permission(self, request, view):
    # まず親クラス（IsLoggedIn）でログイン済みかを確認し、次に権限フラグを確認する
    #   bool() で囲むのは、値が None の場合も False として扱うため
    return super().has_permission(request, view) and bool(request.user.authority)


# ------------------------------------------------------------
# IsAdministrator: 「管理者」の人員だけが使えるAPI用の権限判定
#   管理者MENU（main_views.py の Administrator〜）・工数区分定義の編集（def_views.py）・
#   バックアップ/復元（asynchronous_views.py）などで使う。
# ------------------------------------------------------------
class IsAdministrator(IsLoggedIn):
  """ログインしていて、「管理者権限」が付いていること（管理者・定義の編集の画面）。"""
  # ログイン済み かつ 人員データの administrator（管理者）が ON かを判定する。
  #
  # 引数:
  #   request: DRF のリクエスト
  #   view   : 呼び出されたビュー（この判定では未使用）
  # 戻り値:
  #   bool: 両方満たせば True
  def has_permission(self, request, view):
    # まず親クラス（IsLoggedIn）でログイン済みかを確認し、次に管理者フラグを確認する
    return super().has_permission(request, view) and bool(request.user.administrator)