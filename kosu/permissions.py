"""ログイン中の人と、その人の権限を確かめる部品（全部の API で共通に使う）。

settings.py の REST_FRAMEWORK で「最初から全部の API にかける」設定にするので、
ログインが要らない API（ログイン・ログアウト・ヘルプ）だけ AllowAny を付けて外す。
"""
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, CSRFCheck
from rest_framework.permissions import BasePermission

from .models import member


class LoginNoAuthentication(BaseAuthentication):
  """セッションの login_No から、ログイン中の人（member）を探す。"""

  def authenticate(self, request):
    login_no = request._request.session.get('login_No')
    if not login_no:
      return None                      # ログインしていない → request.user は None
    login_member = member.objects.filter(employee_no=login_no).first()
    if login_member is None:
      return None                      # 人員から消された人 → ログインしていない扱い
    self.enforce_csrf(request)         # ログイン中の人の書き込みは、CSRF トークンも確かめる
    return (login_member, None)

  def enforce_csrf(self, request):
    # DRF の SessionAuthentication.enforce_csrf と同じ確かめ方
    def dummy_get_response(request):
      return None
    check = CSRFCheck(dummy_get_response)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
      raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')

  def authenticate_header(self, request):
    # これを返すと、ログインしていない時に 403 ではなく 401 になる（画面はログイン画面へ戻る）
    return 'Session'


class IsLoggedIn(BasePermission):
  """ログインしていること。"""
  def has_permission(self, request, view):
    return isinstance(request.user, member)


class HasAuthority(IsLoggedIn):
  """ログインしていて、「権限」が付いていること（人員・班員の画面）。"""
  def has_permission(self, request, view):
    return super().has_permission(request, view) and bool(request.user.authority)


class IsAdministrator(IsLoggedIn):
  """ログインしていて、「管理者権限」が付いていること（管理者・定義の編集の画面）。"""
  def has_permission(self, request, view):
    return super().has_permission(request, view) and bool(request.user.administrator)