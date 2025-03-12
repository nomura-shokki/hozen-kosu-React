from django.utils.deprecation import MiddlewareMixin
from django.contrib.messages import get_messages





class kosuClearMiddleware(MiddlewareMixin):
  def process_request(self, request):
    # '/list/' と '/detail/' と '/delete/'パスを含むURLの場合、セッションをクリアしない
    if not (request.path.startswith('/list/') or request.path.startswith('/detail/') or request.path.startswith('/delete/')):
      if 'kosu_month' in request.session:
        del request.session['kosu_month']
      if 'find_day' in request.session:
        del request.session['find_day']



class memberClearMiddleware(MiddlewareMixin):
  def process_request(self, request):
    # '/member/' と '/member_edit/' と '/member_delete/'パスを含むURLの場合、セッションをクリアしない
    if not (request.path.startswith('/member/') or request.path.startswith('/member_edit/') or request.path.startswith('/member_delete/')):
      if 'find_shop' in request.session:
        del request.session['find_shop']
      if 'find_employee_no' in request.session:
        del request.session['find_employee_no']



class teamClearMiddleware(MiddlewareMixin):
  def process_request(self, request):
    # '/team_kosu/' と '/team_detail/' パスを含むURLの場合、セッションをクリアしない
    if not (request.path.startswith('/team_kosu/') or request.path.startswith('/team_detail/')):
      if 'find_team_day' in request.session:
        del request.session['find_team_day']
      if 'find_employee_no2' in request.session:
        del request.session['find_employee_no2']



class ClearMessagesOnPageChangeMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # セッションに保存された前回のURLを取得
        previous_url = request.session.get('_previous_url')

        # 現在のURLを取得
        current_url = request.path

        # 前回のURLと現在のURLが異なる場合のみ、メッセージを消去
        if previous_url and previous_url != current_url:
            if hasattr(request, '_messages'):
                storage = get_messages(request)
                list(storage)
                storage.used = True

        # 現在のURLをセッションに保存（次回リクエスト時に使用するため）
        request.session['_previous_url'] = current_url