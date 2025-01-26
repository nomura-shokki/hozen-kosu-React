from django.shortcuts import render
from django.shortcuts import redirect
from django.core.paginator import Paginator
from django.contrib import messages
from django.urls import reverse_lazy
from django.views.generic import CreateView
from ..models import member
from ..models import kosu_division
from ..models import administrator_data
from ..forms import inputdayForm
from ..forms import versionchoiceForm
from ..forms import kosu_divisionForm





#--------------------------------------------------------------------------------------------------------





# 工数区分定義確認画面定義
def kosu_def(request):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 



  # POST時の処理
  if (request.method == 'POST'):

    # 検索欄が空欄の場合の処理
    if request.POST['kosu_def_list'] == '':
      # エラーメッセージ出力
      messages.error(request, '確認する定義区分が選択されていません。ERROR031')
      # このページをリダイレクト
      return redirect(to = '/kosu_def')


    # 現在使用している工数区分のオブジェクトを取得
    kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))
    # 工数区分登録カウンターリセット
    n = 0
    # 工数区分登録数カウント
    for kosu_num in range(1, 50):
      if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != '':
        n = kosu_num

    # 工数区分の選択リスト作成
    choices_list = [('','')]
    for i in range(n):
      choices_list.append((eval('kosu_obj.kosu_title_{}'.format(i + 1)),eval('kosu_obj.kosu_title_{}'.format(i + 1))))

    # POST送信後のフォーム状態定義
    form_list = {'kosu_def_list' : request.POST['kosu_def_list']}
    
    # フォームの初期状態定義
    form = inputdayForm(form_list)
    # フォームの選択肢定義
    form.fields['kosu_def_list'].choices = choices_list

    # 現在使用している工数区分定義のオブジェクト取得
    obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))
   
    # オブジェクトからPOST送信した工数区分の定義と作業内容読み出し
    for n in range(50):
      if eval('obj.kosu_title_{}'.format(n + 1)) == request.POST['kosu_def_list']:
        def1 = eval('obj.kosu_division_1_{}'.format(n + 1))
        def2 = eval('obj.kosu_division_2_{}'.format(n + 1))
        break

  # POST送信していないときの処理
  else:
    # 表示データ空にする
    def1 = ''
    def2 = ''

    # 現在使用している工数区分のオブジェクトを取得
    kosu_obj = kosu_division.objects.get(kosu_name = request.session.get('input_def', None))
    # 工数区分登録カウンターリセット
    n = 0
    # 工数区分登録数カウント
    for kosu_num in range(1, 50):
      if eval('kosu_obj.kosu_title_{}'.format(kosu_num)) != '':
        n = kosu_num

    # 工数区分の選択リスト作成
    choices_list = [('','')]
    for i in range(n):
      choices_list.append((eval('kosu_obj.kosu_title_{}'.format(i + 1)),eval('kosu_obj.kosu_title_{}'.format(i + 1))))

    # フォームの初期状態定義
    form = inputdayForm()
    # フォームの選択肢定義
    form.fields['kosu_def_list'].choices = choices_list

  # HTMLに渡す辞書
  context = {
    'title' : '工数区分定義確認',
    'form' : form,
    'def1' : def1,
    'def2' : def2,
    }
  
  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/kosu_def.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数区分定義Ver選択画面定義
def kosu_Ver(request):
  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 

  # 工数区分定義の選択リスト作成(空)
  choices_list = []
  # 工数区分定義の登録されているバージョンを取得
  choice_obj = kosu_division.objects.all()
  # 工数区分定義の選択リストに値を入れる
  for i in choice_obj:
    choices_list.append((i.kosu_name, i.kosu_name))

  # フォームの初期値を設置
  form_init = {'versionchoice' : request.session['input_def']}
  # フォームの初期状態定義
  form = versionchoiceForm(form_init)
  # フォームの選択肢定義
  form.fields['versionchoice'].choices = choices_list
  
  
  # POST送信された時の処理
  if (request.method == 'POST'):
    # POST送信された工数区分定義のVerをセッションに上書きする
    request.session['input_def'] = request.POST['versionchoice']

  # Ver表示用オブジェクト取得
  mes_obj = kosu_division.objects.get(kosu_name = request.session['input_def'])

  # HTMLに渡す辞書
  context = {
    'title' : '工数区分定義切り替え',
    'message' : mes_obj.kosu_name,
    'form' : form,
    }
  
  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/kosu_Ver.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数区分定義Ver一覧画面定義
def def_list(request, num):
  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 

  # ログイン者が管理者でなければメニュー画面に飛ぶ
  if data.administrator != True:
    return redirect(to = '/')

  # 設定データ取得
  page_num = administrator_data.objects.order_by("id").last()

  
  # 工数区分表示用のオブジェクト取得
  obj = kosu_division.objects.all().order_by('kosu_name').reverse()
  page = Paginator(obj, page_num.menu_row)

  # HTMLに渡す辞書
  context = {
    'title' : '工数区分定義一覧',
    'obj' : page.get_page(num),
    'num' : num,
    }
  
  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/def_list.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数区分定義編集画面定義
def def_edit(request, num):
  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 

  # ログイン者が管理者でなければメニュー画面に飛ぶ
  if data.administrator != True:
    return redirect(to = '/')

  # 指定IDの工数区分定義のレコードのオブジェクトを変数に入れる
  obj = kosu_division.objects.get(id = num)
  
  # フォームの初期状態定義(編集前データが入ってる)
  form = kosu_divisionForm(instance = obj)


  # GET時の処理
  if (request.method == 'GET'):
    # 編集前の工数区分定義VerのIDをセッションに記憶
    def_obj = kosu_division.objects.get(id = num)
    request.session['edit_def'] = def_obj.kosu_name


  # POST時の処理
  if (request.method == 'POST'):

    # 人員登録データの内、従業員番号がPOST送信された値と等しいレコードのオブジェクトを取得
    def_data = kosu_division.objects.filter(kosu_name = request.POST['kosu_name'])
    # 編集した工数区分定義名の登録がすでにあるかチェック
    if request.session.get('edit_def', None) != request.POST['kosu_name'] and \
      def_data.count() >= 1:
      # エラーメッセージ出力
      messages.error(request, '入力した工数区分定義名はすでに登録があるので登録できません。ERROR028')
      # このページをリダイレクト
      return redirect(to = '/def_edit/{}'.format(num))

    # 指定IDのレコードにPOST送信された値を上書きする
    kosu_division.objects.update_or_create(id = num, defaults = {\
      'kosu_name' : request.POST['kosu_name'], 'kosu_title_1' : request.POST['kosu_title_1'], \
      'kosu_division_1_1' : request.POST['kosu_division_1_1'], \
      'kosu_division_2_1' : request.POST['kosu_division_2_1'], \
      'kosu_title_2' : request.POST['kosu_title_2'], \
      'kosu_division_1_2' : request.POST['kosu_division_1_2'], \
      'kosu_division_2_2' : request.POST['kosu_division_2_2'], \
      'kosu_title_3' : request.POST['kosu_title_3'], \
      'kosu_division_1_3' : request.POST['kosu_division_1_3'], \
      'kosu_division_2_3' : request.POST['kosu_division_2_3'], \
      'kosu_title_4' : request.POST['kosu_title_4'], \
      'kosu_division_1_4' : request.POST['kosu_division_1_4'], \
      'kosu_division_2_4' : request.POST['kosu_division_2_4'], \
      'kosu_title_5' : request.POST['kosu_title_5'], \
      'kosu_division_1_5' : request.POST['kosu_division_1_5'], \
      'kosu_division_2_5' : request.POST['kosu_division_2_5'], \
      'kosu_title_6' : request.POST['kosu_title_6'], \
      'kosu_division_1_6' : request.POST['kosu_division_1_6'], \
      'kosu_division_2_6' : request.POST['kosu_division_2_6'], \
      'kosu_title_7' : request.POST['kosu_title_7'], \
      'kosu_division_1_7' : request.POST['kosu_division_1_7'], \
      'kosu_division_2_7' : request.POST['kosu_division_2_7'], \
      'kosu_title_8' : request.POST['kosu_title_8'], \
      'kosu_division_1_8' : request.POST['kosu_division_1_8'], \
      'kosu_division_2_8' : request.POST['kosu_division_2_8'], \
      'kosu_title_9' : request.POST['kosu_title_9'], \
      'kosu_division_1_9' : request.POST['kosu_division_1_9'], \
      'kosu_division_2_9' : request.POST['kosu_division_2_9'], \
      'kosu_title_10' : request.POST['kosu_title_10'], \
      'kosu_division_1_10' : request.POST['kosu_division_1_10'], \
      'kosu_division_2_10' : request.POST['kosu_division_2_10'], \
      'kosu_title_11' : request.POST['kosu_title_11'], \
      'kosu_division_1_11' : request.POST['kosu_division_1_11'], \
      'kosu_division_2_11' : request.POST['kosu_division_2_11'], \
      'kosu_title_12' : request.POST['kosu_title_12'], \
      'kosu_division_1_12' : request.POST['kosu_division_1_12'], \
      'kosu_division_2_12' : request.POST['kosu_division_2_12'], \
      'kosu_title_13' : request.POST['kosu_title_13'], \
      'kosu_division_1_13' : request.POST['kosu_division_1_13'], \
      'kosu_division_2_13' : request.POST['kosu_division_2_13'], \
      'kosu_title_14' : request.POST['kosu_title_14'], \
      'kosu_division_1_14' : request.POST['kosu_division_1_14'], \
      'kosu_division_2_14' : request.POST['kosu_division_2_14'], \
      'kosu_title_15' : request.POST['kosu_title_15'], \
      'kosu_division_1_15' : request.POST['kosu_division_1_15'], \
      'kosu_division_2_15' : request.POST['kosu_division_2_15'], \
      'kosu_title_16' : request.POST['kosu_title_16'], \
      'kosu_division_1_16' : request.POST['kosu_division_1_16'], \
      'kosu_division_2_16' : request.POST['kosu_division_2_16'], \
      'kosu_title_17' : request.POST['kosu_title_17'], \
      'kosu_division_1_17' : request.POST['kosu_division_1_17'], \
      'kosu_division_2_17' : request.POST['kosu_division_2_17'], \
      'kosu_title_18' : request.POST['kosu_title_18'], \
      'kosu_division_1_18' : request.POST['kosu_division_1_18'], \
      'kosu_division_2_18' : request.POST['kosu_division_2_18'], \
      'kosu_title_19' : request.POST['kosu_title_19'], \
      'kosu_division_1_19' : request.POST['kosu_division_1_19'], \
      'kosu_division_2_19' : request.POST['kosu_division_2_19'], \
      'kosu_title_20' : request.POST['kosu_title_20'], \
      'kosu_division_1_20' : request.POST['kosu_division_1_20'], \
      'kosu_division_2_20' : request.POST['kosu_division_2_20'], \
      'kosu_title_21' : request.POST['kosu_title_21'], \
      'kosu_division_1_21' : request.POST['kosu_division_1_21'], \
      'kosu_division_2_21' : request.POST['kosu_division_2_21'], \
      'kosu_title_22' : request.POST['kosu_title_22'], \
      'kosu_division_1_22' : request.POST['kosu_division_1_22'], \
      'kosu_division_2_22' : request.POST['kosu_division_2_22'], \
      'kosu_title_23' : request.POST['kosu_title_23'], \
      'kosu_division_1_23' : request.POST['kosu_division_1_23'], \
      'kosu_division_2_23' : request.POST['kosu_division_2_23'], \
      'kosu_title_24' : request.POST['kosu_title_24'], \
      'kosu_division_1_24' : request.POST['kosu_division_1_24'], \
      'kosu_division_2_24' : request.POST['kosu_division_2_24'], \
      'kosu_title_25' : request.POST['kosu_title_25'], \
      'kosu_division_1_25' : request.POST['kosu_division_1_25'], \
      'kosu_division_2_25' : request.POST['kosu_division_2_25'], \
      'kosu_title_26' : request.POST['kosu_title_26'], \
      'kosu_division_1_26' : request.POST['kosu_division_1_26'], \
      'kosu_division_2_26' : request.POST['kosu_division_2_26'], \
      'kosu_title_27' : request.POST['kosu_title_27'], \
      'kosu_division_1_27' : request.POST['kosu_division_1_27'], \
      'kosu_division_2_27' : request.POST['kosu_division_2_27'], \
      'kosu_title_28' : request.POST['kosu_title_28'], \
      'kosu_division_1_28' : request.POST['kosu_division_1_28'], \
      'kosu_division_2_28' : request.POST['kosu_division_2_28'], \
      'kosu_title_29' : request.POST['kosu_title_29'], \
      'kosu_division_1_29' : request.POST['kosu_division_1_29'], \
      'kosu_division_2_29' : request.POST['kosu_division_2_29'], \
      'kosu_title_30' : request.POST['kosu_title_30'], \
      'kosu_division_1_30' : request.POST['kosu_division_1_30'], \
      'kosu_division_2_30' : request.POST['kosu_division_2_30'], \
      'kosu_title_31' : request.POST['kosu_title_31'], \
      'kosu_division_1_31' : request.POST['kosu_division_1_31'], \
      'kosu_division_2_31' : request.POST['kosu_division_2_31'], \
      'kosu_title_32' : request.POST['kosu_title_32'], \
      'kosu_division_1_32' : request.POST['kosu_division_1_32'], \
      'kosu_division_2_32' : request.POST['kosu_division_2_32'], \
      'kosu_title_33' : request.POST['kosu_title_33'], \
      'kosu_division_1_33' : request.POST['kosu_division_1_33'], \
      'kosu_division_2_33' : request.POST['kosu_division_2_33'], \
      'kosu_title_34' : request.POST['kosu_title_34'], \
      'kosu_division_1_34' : request.POST['kosu_division_1_34'], \
      'kosu_division_2_34' : request.POST['kosu_division_2_34'], \
      'kosu_title_35' : request.POST['kosu_title_35'], \
      'kosu_division_1_35' : request.POST['kosu_division_1_35'], \
      'kosu_division_2_35' : request.POST['kosu_division_2_35'], \
      'kosu_title_36' : request.POST['kosu_title_36'], \
      'kosu_division_1_36' : request.POST['kosu_division_1_36'], \
      'kosu_division_2_36' : request.POST['kosu_division_2_36'], \
      'kosu_title_37' : request.POST['kosu_title_37'], \
      'kosu_division_1_37' : request.POST['kosu_division_1_37'], \
      'kosu_division_2_37' : request.POST['kosu_division_2_37'], \
      'kosu_title_38' : request.POST['kosu_title_38'], \
      'kosu_division_1_38' : request.POST['kosu_division_1_38'], \
      'kosu_division_2_38' : request.POST['kosu_division_2_38'], \
      'kosu_title_39' : request.POST['kosu_title_39'], \
      'kosu_division_1_39' : request.POST['kosu_division_1_39'], \
      'kosu_division_2_39' : request.POST['kosu_division_2_39'], \
      'kosu_title_40' : request.POST['kosu_title_40'], \
      'kosu_division_1_40' : request.POST['kosu_division_1_40'], \
      'kosu_division_2_40' : request.POST['kosu_division_2_40'], \
      'kosu_title_41' : request.POST['kosu_title_41'], \
      'kosu_division_1_41' : request.POST['kosu_division_1_41'], \
      'kosu_division_2_41' : request.POST['kosu_division_2_41'], \
      'kosu_title_42' : request.POST['kosu_title_42'], \
      'kosu_division_1_42' : request.POST['kosu_division_1_42'], \
      'kosu_division_2_42' : request.POST['kosu_division_2_42'], \
      'kosu_title_43' : request.POST['kosu_title_43'], \
      'kosu_division_1_43' : request.POST['kosu_division_1_43'], \
      'kosu_division_2_43' : request.POST['kosu_division_2_43'], \
      'kosu_title_44' : request.POST['kosu_title_44'], \
      'kosu_division_1_44' : request.POST['kosu_division_1_44'], \
      'kosu_division_2_44' : request.POST['kosu_division_2_44'], \
      'kosu_title_45' : request.POST['kosu_title_45'], \
      'kosu_division_1_45' : request.POST['kosu_division_1_45'], \
      'kosu_division_2_45' : request.POST['kosu_division_2_45'], \
      'kosu_title_46' : request.POST['kosu_title_46'], \
      'kosu_division_1_46' : request.POST['kosu_division_1_46'], \
      'kosu_division_2_46' : request.POST['kosu_division_2_46'], \
      'kosu_title_47' : request.POST['kosu_title_47'], \
      'kosu_division_1_47' : request.POST['kosu_division_1_47'], \
      'kosu_division_2_47' : request.POST['kosu_division_2_47'], \
      'kosu_title_48' : request.POST['kosu_title_48'], \
      'kosu_division_1_48' : request.POST['kosu_division_1_48'], \
      'kosu_division_2_48' : request.POST['kosu_division_2_48'], \
      'kosu_title_49' : request.POST['kosu_title_49'], \
      'kosu_division_1_49' : request.POST['kosu_division_1_49'], \
      'kosu_division_2_49' : request.POST['kosu_division_2_49'], \
      'kosu_title_50' : request.POST['kosu_title_50'], \
      'kosu_division_1_50' : request.POST['kosu_division_1_50'], \
      'kosu_division_2_50' : request.POST['kosu_division_2_50'], \
        })
    
   # 工数履歴画面をリダイレクトする
    return redirect(to = '/def_list/1')

  # HTMLに渡す辞書
  context = {
    'title' : '工数区分定義編集',
    'id' : num,
    'form' : form,
    }
  
  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/def_edit.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数区分定義削除画面定義
def def_delete(request, num):
  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')
  
  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 

  # ログイン者が管理者でなければメニュー画面に飛ぶ
  if data.administrator != True:
    return redirect(to = '/')

  # 指定従業員番号のレコードのオブジェクトを変数に入れる
  obj = kosu_division.objects.get(id = num)
  # POST時の処理
  if (request.method == 'POST'):
    # 取得していた指定従業員番号のレコードを削除する
    obj.delete()
    # 工数履歴画面をリダイレクトする
    return redirect(to = '/def_list/1')
  
  n = []
  for i in range(1, 51):
    n.append('kosu_title_{}'.format(i))
    n.append('osu_division_1_{}'.format(i))
    n.append('osu_division_2_{}'.format(i))

  # HTMLに渡す辞書
  context = {
    'title' : '工数区分定義削除',
    'id' : num,
    'obj' : obj,
    'n' : n,
    }

  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/def_delete.html', context)





#--------------------------------------------------------------------------------------------------------





# 工数区分定義登録画面定義
class KosuDivisionCreateView(CreateView):
  # モデル,フォーム,テンプレート,飛び先定義
  model = kosu_division
  form_class = kosu_divisionForm
  template_name = 'kosu/def_new.html'
  success_url = reverse_lazy('def_new')


  # リクエストを処理するメソッドをオーバーライド
  def dispatch(self, request, *args, **kwargs):
    # 未ログインならログインページに飛ぶ
    if request.session.get('login_No', None) is None:
      return redirect('/login')

    try:
      # ログイン者の情報取得
      self.data = member.objects.get(employee_no=request.session['login_No'])
    except member.DoesNotExist:
      # ログイン者情報取得できない場合ログイン画面へ
      request.session.clear()
      return redirect('/login')

    # ログイン者が管理者でなければメニュー画面に飛ぶ
    if not self.data.administrator:
      return redirect('/')

    # 親クラスのdispatchメソッドを呼び出し
    return super().dispatch(request, *args, **kwargs)


  # フォームバリデーションが成功した際のメソッドをオーバーライド
  def form_valid(self, form):
    # 工数定義区分バージョン取得
    kosu_name = form.cleaned_data.get('kosu_name')

    # POSTされた工数区分定義名を使用していればエラーメッセージを出す
    if kosu_division.objects.filter(kosu_name=kosu_name).exists():
      messages.error(self.request, '登録しようとした工数区分定義名は既に使用しています。登録できません。ERROR027')
      return redirect(self.success_url)

    # 新しいレコードを作成しセーブする
    return super().form_valid(form)


  # コンテキストデータを取得するメソッドをオーバーライド
  def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context['title'] = '工数区分定義新規登録'
    return context



#--------------------------------------------------------------------------------------------------------

