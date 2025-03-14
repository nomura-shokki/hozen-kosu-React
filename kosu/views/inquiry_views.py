from django.shortcuts import render
from django.shortcuts import redirect
from django.core.paginator import Paginator
from django.contrib import messages
from ..models import member
from ..models import administrator_data
from ..models import inquiry_data
from ..forms import inquiryForm
from ..forms import inquiry_findForm





#--------------------------------------------------------------------------------------------------------





# 問い合わせ入力画面定義
def inquiry_new(request):
  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')


  # フォーム定義
  form = inquiryForm()


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
    # 問い合わせ内容が10文字未満の場合の処理
    if len(request.POST['inquiry']) < 10:
      # エラーメッセージ出力
      messages.error(request, '問い合わせ内容は10文字以上でお願いします。ERROR046')
      # このページをリダイレクト
      return redirect(to = '/inquiry_new')

    # 従業員番号に該当するmemberインスタンスを取得
    member_instance = member.objects.get(employee_no = request.session['login_No'])

    # 問い合わせ内容を変数に入れる
    new = inquiry_data(employee_no2 = request.session['login_No'], \
                       name = member_instance, \
                       content_choice = request.POST['content_choice'], \
                       inquiry = request.POST['inquiry'])
    # レコードセーブ
    new.save()


    # 最新の問い合わせデータ取得
    inquiry_data_id = inquiry_data.objects.order_by("id").last()
    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # ポップアップ1空の場合の処理
    if default_data.pop_up1 in ["", None]:
      # ポップアップ書き込み
      administrator_data.objects.update_or_create(id = default_data.id, \
                         defaults = {'pop_up_id1' : inquiry_data_id.id,
                                     'pop_up1' : '{}さんからの新しい問い合わせがあります。'.format(data.name)})
      
    elif default_data.pop_up2 in ["", None]:
      # ポップアップ書き込み
      administrator_data.objects.update_or_create(id = default_data.id, \
                         defaults = {'pop_up_id2' : inquiry_data_id.id,
                                     'pop_up2' : '{}さんからの新しい問い合わせがあります。'.format(data.name)})

    elif default_data.pop_up3 in ["", None]:
      # ポップアップ書き込み
      administrator_data.objects.update_or_create(id = default_data.id, \
                         defaults = {'pop_up_id3' : inquiry_data_id.id,
                                     'pop_up3' : '{}さんからの新しい問い合わせがあります。'.format(data.name)})

    elif default_data.pop_up4 in ["", None]:
      # ポップアップ書き込み
      administrator_data.objects.update_or_create(id = default_data.id, \
                         defaults = {'pop_up_id4' : inquiry_data_id.id,
                                     'pop_up4' : '{}さんからの新しい問い合わせがあります。'.format(data.name)})

    elif default_data.pop_up5 in ["", None]:
      # ポップアップ書き込み
      administrator_data.objects.update_or_create(id = default_data.id, \
                         defaults = {'pop_up_id5' : inquiry_data_id.id,
                                     'pop_up5' : '{}さんからの新しい問い合わせがあります。'.format(data.name)})

    # このページを読み直す
    return redirect(to='/inquiry_new')



  # HTMLに渡す辞書
  context = {
    'title' : '問い合わせ入力',
    'data' : data,
    'form' : form,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/inquiry_new.html', context)





#--------------------------------------------------------------------------------------------------------





# 問い合わせ履歴画面定義
def inquiry_list(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')

  try:
    # ログイン者の情報取得
    member_data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 


  # 問い合わせ履歴のある従業員番号リスト作成
  employee_no_list = inquiry_data.objects.values_list('employee_no2', flat=True)\
                                                      .order_by('employee_no2').distinct()
  
  # 名前リスト定義
  name_list = [['', '']]

  # 従業員番号を名前に変更するループ
  for No in list(employee_no_list):
    try:
      # 指定従業員番号で人員情報取得
      name = member.objects.get(employee_no = No)
      # 名前リスト作成
      name_list.append([No, name])
    # 人員情報取得できない場合の処理
    except member.DoesNotExist:
      #何もしない
      pass

  # 設定データ取得
  last_record = administrator_data.objects.order_by("id").last()
  if last_record is None:
    # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
    default_data = administrator_data(menu_row=20)
  else:
    default_data = last_record

  # ログイン者が問い合わせ担当者である場合の処理
  if default_data.administrator_employee_no1 == str(request.session['login_No']) or \
  default_data.administrator_employee_no2 == str(request.session['login_No']) or \
  default_data.administrator_employee_no3 == str(request.session['login_No']):
    
    # ボタン表示設定
    button_display = True

  # ログイン者が問い合わせ担当者でない場合の処理
  else:

    # ボタン非表示設定
    button_display = False



  # 検索時の処理
  if 'find' in request.POST:

    # 問い合わせデータ取得(氏名とカテゴリーで絞り込み)
    data = inquiry_data.objects.filter(content_choice__contains = request.POST['category'], 
                                       employee_no2__contains = request.POST['name_list']).order_by('id').reverse()

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      page_num = administrator_data(menu_row=20)
    else:
      page_num = last_record

    # 1ページごとのデータ取得
    page = Paginator(data, page_num.menu_row)


    # フォーム定義
    form = inquiry_findForm(request.POST)

    # フォーム選択肢定義
    form.fields['name_list'].choices = name_list


  # 検索時以外の時の処理
  else:
    # 問い合わせデータ取得
    data = inquiry_data.objects.all().order_by('id').reverse()

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      page_num = administrator_data(menu_row=20)
    else:
      page_num = last_record

    # 1ページごとのデータ取得
    page = Paginator(data, page_num.menu_row)

    # フォーム定義
    form = inquiry_findForm()

    # フォーム選択肢定義
    form.fields['name_list'].choices = name_list



  # ポップアップリセット時の処理
  if 'pop_up_reset' in request.POST:

    # ポップアップリセット
    administrator_data.objects.update_or_create(id = default_data.id, \
                       defaults = {'pop_up_id1' : '',
                                   'pop_up1' : '',
                                   'pop_up_id2' : '',
                                   'pop_up2' : '',
                                   'pop_up_id3' : '',
                                   'pop_up3' : '',
                                   'pop_up_id4' : '',
                                   'pop_up4' : '',
                                   'pop_up_id5' : '',
                                   'pop_up5' : '',})

    member.objects.update_or_create(employee_no = request.session['login_No'], \
                       defaults = {'pop_up_id1' : '',
                                   'pop_up1' : '',
                                   'pop_up_id2' : '',
                                   'pop_up2' : '',
                                   'pop_up_id3' : '',
                                   'pop_up3' : '',
                                   'pop_up_id4' : '',
                                   'pop_up4' : '',
                                   'pop_up_id5' : '',
                                   'pop_up5' : '',})
    

    # このページをリダイレクトする
    return redirect(to = '/inquiry_list/1')



  # HTMLに渡す辞書
  context = {
    'title' : '問い合わせ履歴',
    'form' : form,
    'name_list' : name_list,
    'data': page.get_page(num),
    'num' : num,
    'button_display' : button_display,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/inquiry_list.html', context)




#--------------------------------------------------------------------------------------------------------





# 問い合わせ詳細画面定義
def inquiry_display(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:

    return redirect(to = '/login')


  # 指定IDの工数履歴のレコードのオブジェクトを変数に入れる
  obj_get = inquiry_data.objects.get(id = num)

  try:
    # ログイン者の情報取得
    data = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 

  # 本人確認リセット
  himself = False

  # 本人か確認
  if str(obj_get.name) == str(data.name):
    # 本人の場合True
    himself = True


  # 設定データ取得
  last_record = administrator_data.objects.order_by("id").last()
  if last_record is None:
    # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
    default_data = administrator_data(menu_row=20)
  else:
    default_data = last_record

  # ポップアップのデータと一致する場合の処理
  if data.pop_up_id1 == str(num):
    # ポップアップ削除
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'pop_up_id1' : '',
                                                'pop_up1' : ''})
    
  # ポップアップのデータと一致する場合の処理
  elif data.pop_up_id2 == str(num):
    # ポップアップ削除
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'pop_up_id2' : '',
                                                'pop_up2' : ''})
    
  # ポップアップのデータと一致する場合の処理
  elif data.pop_up_id3 == str(num):
    # ポップアップ削除
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'pop_up_id3' : '',
                                                'pop_up3' : ''})
    
  # ポップアップのデータと一致する場合の処理
  elif data.pop_up_id4 == str(num):
    # ポップアップ削除
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'pop_up_id4' : '',
                                                'pop_up4' : ''})
    
  # ポップアップのデータと一致する場合の処理
  elif data.pop_up_id5 == str(num):
    # ポップアップ削除
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                                    defaults = {'pop_up_id5' : '',
                                                'pop_up5' : ''})


  # ログイン者の情報再取得
  data = member.objects.get(employee_no = request.session['login_No'])

  # ポップアップ1が空の場合の処理
  if data.pop_up1 in ['', None]:
    #ポップアップ2の内容をポップアップ1へ移行
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                      defaults = {'pop_up_id1' : data.pop_up_id2,
                                  'pop_up1' : data.pop_up2,
                                  'pop_up_id2' : '',
                                  'pop_up2' : ''})

  # ログイン者の情報再取得
  data = member.objects.get(employee_no = request.session['login_No'])

  # ポップアップ2が空の場合の処理
  if data.pop_up2 in ['', None]:
    #ポップアップ3の内容をポップアップ2へ移行
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                      defaults = {'pop_up_id2' : data.pop_up_id3,
                                  'pop_up2' : data.pop_up3,
                                  'pop_up_id3' : '',
                                  'pop_up3' : ''})

  # ログイン者の情報再取得
  data = member.objects.get(employee_no = request.session['login_No'])

  # ポップアップ3が空の場合の処理
  if data.pop_up3 in ['', None]:
    #ポップアップ4の内容をポップアップ3へ移行
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                      defaults = {'pop_up_id3' : data.pop_up_id4,
                                  'pop_up3' : data.pop_up4,
                                  'pop_up_id4' : '',
                                  'pop_up4' : ''})

  # ログイン者の情報再取得
  data = member.objects.get(employee_no = request.session['login_No'])

  # ポップアップ4が空の場合の処理
  if data.pop_up4 in ['', None]:
    #ポップアップ5の内容をポップアップ4へ移行
    member.objects.update_or_create(employee_no = request.session['login_No'], \
                      defaults = {'pop_up_id4' : data.pop_up_id5,
                                  'pop_up4' : data.pop_up5,
                                  'pop_up_id5' : '',
                                  'pop_up5' : ''})


  # ログイン者が問い合わせ担当者である場合の処理
  if default_data.administrator_employee_no1 == str(request.session['login_No']) or \
     default_data.administrator_employee_no2 == str(request.session['login_No']) or \
     default_data.administrator_employee_no3 == str(request.session['login_No']):
    
    # ポップアップのデータと一致する場合の処理
    if default_data.pop_up_id1 == str(num):
      # ポップアップ削除
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id1' : '',
                                    'pop_up1' : ''})
      
    # ポップアップのデータと一致する場合の処理
    if default_data.pop_up_id2 == str(num):
      # ポップアップ削除
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id2' : '',
                                    'pop_up2' : ''})
      
    # ポップアップのデータと一致する場合の処理
    if default_data.pop_up_id3 == str(num):
      # ポップアップ削除
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id3' : '',
                                    'pop_up3' : ''})
      
    # ポップアップのデータと一致する場合の処理
    if default_data.pop_up_id4 == str(num):
      # ポップアップ削除
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id4' : '',
                                    'pop_up4' : ''})
      
    # ポップアップのデータと一致する場合の処理
    if default_data.pop_up_id5 == str(num):
      # ポップアップ削除
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id5' : '',
                                    'pop_up5' : ''})


    # 設定データ再取得
    default_data = administrator_data.objects.order_by("id").last()

    # ポップアップ1が空の場合の処理
    if default_data.pop_up1 in ['', None]:
      #ポップアップ2の内容をポップアップ1へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id1' : default_data.pop_up_id2,
                                    'pop_up1' : default_data.pop_up2,
                                    'pop_up_id2' : '',
                                    'pop_up2' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ2が空の場合の処理
    if default_data.pop_up2 in ['', None]:
      #ポップアップ3の内容をポップアップ2へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id2' : default_data.pop_up_id3,
                                    'pop_up2' : default_data.pop_up3,
                                    'pop_up_id3' : '',
                                    'pop_up3' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ3が空の場合の処理
    if default_data.pop_up3 in ['', None]:
      #ポップアップ4の内容をポップアップ3へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id3' : default_data.pop_up_id4,
                                    'pop_up3' : default_data.pop_up4,
                                    'pop_up_id4' : '',
                                    'pop_up4' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ4が空の場合の処理
    if default_data.pop_up4 in ['', None]:
      #ポップアップ5の内容をポップアップ4へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id4' : default_data.pop_up_id5,
                                    'pop_up4' : default_data.pop_up5,
                                    'pop_up_id5' : '',
                                    'pop_up5' : ''})

  # 次の問い合わせデータ取得
  next_record = inquiry_data.objects.filter(id__gt = num).order_by('id').first()
  # 次の問い合わせデータあるか確認
  has_next_record = next_record is not None

  # 前の問い合わせデータ取得
  before_record = inquiry_data.objects.filter(id__lt = num).order_by('-id').first()
  # 前の問い合わせデータあるか確認
  has_before_record = before_record is not None



  # 問い合わせ編集処理
  if "Registration" in request.POST:
    # 問い合わせ編集ページへ飛ぶ
    return redirect(to = '/inquiry_edit/{}'.format(num))



  # 前の問い合わせへ
  if "before" in request.POST:
    # 前の問い合わせデータ取得
    obj_before = inquiry_data.objects.filter(id__lt = num).order_by('-id').first()
    # 前の問い合わせ詳細へ飛ぶ
    return redirect(to = '/inquiry_display/{}'.format(obj_before.id))



  # 次の問い合わせへ
  if "after" in request.POST:
    # 次の問い合わせデータ取得
    obj_after = inquiry_data.objects.filter(id__gt=num).order_by('id').first()
    # 次の問い合わせ詳細へ飛ぶ
    return redirect(to = '/inquiry_display/{}'.format(obj_after.id))



  # HTMLに渡す辞書
  context = {
    'title' : '問い合わせ詳細',
    'id' : num,
    'obj' : obj_get,
    'data' : data,
    'himself' : himself,
    'has_next_record' : has_next_record,
    'has_before_record' : has_before_record,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/inquiry_display.html', context)





#--------------------------------------------------------------------------------------------------------





# 問い合わせ編集画面定義
def inquiry_edit(request, num):

  # 未ログインならログインページに飛ぶ
  if request.session.get('login_No', None) == None:
    return redirect(to = '/login')


  # 指定IDの工数履歴のレコードのオブジェクト取得
  obj_get = inquiry_data.objects.get(id = num)

  try:
    # ログイン者の情報取得
    login_obj_get = member.objects.get(employee_no = request.session['login_No'])

  # セッション値から人員情報取得できない場合の処理
  except member.DoesNotExist:
    # セッション削除
    request.session.clear()
    # ログインページに戻る
    return redirect(to = '/login') 


  # フォーム初期値定義
  form_default = {'content_choice' : obj_get.content_choice, 
                  'inquiry' : obj_get.inquiry, 
                  'answer' : obj_get.answer}
  # フォーム定義
  form = inquiryForm(form_default)



  # 問い合わせ編集処理
  if "Registration" in request.POST:
    # 指定IDの工数履歴のレコードのオブジェクト取得
    obj_get = inquiry_data.objects.get(id = num)

    # 問い合わせ者情報取得
    member_obj_get = member.objects.get(employee_no = obj_get.employee_no2)

    # 設定情報取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      administrator_obj_get = administrator_data(menu_row=20)
    else:
      administrator_obj_get = last_record

    # 問い合わせが編集前後で変更がある場合の処理
    if obj_get.inquiry != request.POST['inquiry']:
      # ポップアップ1が空の場合の処理
      if administrator_obj_get.pop_up1 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                                    defaults = {'pop_up1' : 'ID{}の問い合わせが編集されました。'.format(num),
                                                                'pop_up_id1' : num})
        
      # ポップアップ2が空の場合の処理
      elif administrator_obj_get.pop_up2 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up2' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id2' : num})

      # ポップアップ3が空の場合の処理
      elif administrator_obj_get.pop_up3 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up3' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id3' : num})

      # ポップアップ4が空の場合の処理
      elif administrator_obj_get.pop_up4 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up4' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id4' : num})

      # ポップアップ5が空の場合の処理
      elif administrator_obj_get.pop_up5 in ["", None]:
        # ポップアップにコメント書き込み
        administrator_data.objects.update_or_create(id = administrator_obj_get.id, \
                                   defaults = {'pop_up5' : 'ID{}の問い合わせが編集されました。'.format(num),
                                               'pop_up_id5' : num})


    # ログイン者に回答権限がある場合の処理
    if login_obj_get.administrator == True:
      # 回答が編集前後で変更がある場合の処理
      if obj_get.answer != request.POST['answer']:
        # ポップアップ1が空の場合の処理
        if member_obj_get.pop_up1 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up1' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id1' : num})

        # ポップアップ2が空の場合の処理
        elif member_obj_get.pop_up2 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up2' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id2' : num})

        # ポップアップ3が空の場合の処理
        elif member_obj_get.pop_up3 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up3' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id3' : num})
          
        # ポップアップ4が空の場合の処理
        elif member_obj_get.pop_up4 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up4' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id4' : num})

        # ポップアップ5が空の場合の処理
        elif member_obj_get.pop_up5 in ["", None]:
          # ポップアップにコメント書き込み
          member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                          defaults = {'pop_up5' : 'ID{}の問い合わせに回答が来ています。'.format(num), \
                                                      'pop_up_id5' : num})

        # 問い合わせ回答書き込み
        inquiry_data.objects.update_or_create(id = num, \
                                              defaults = {'content_choice' : request.POST['content_choice'], \
                                                          'inquiry' : request.POST['inquiry'], \
                                                          'answer' : request.POST['answer']})
      # 回答が編集前後で変更がない場合の処理
      else:
        # 問い合わせ書き込み
        inquiry_data.objects.update_or_create(id = num, \
                                              defaults = {'content_choice' : request.POST['content_choice'], \
                                                          'inquiry' : request.POST['inquiry']})
  
    # ログイン者に回答権限がない場合の処理
    else:
      # 問い合わせ書き込み
      inquiry_data.objects.update_or_create(id = num, \
                                            defaults = {'content_choice' : request.POST['content_choice'], \
                                                        'inquiry' : request.POST['inquiry']})


    # 問い合わせ一覧ページをリダイレクトする
    return redirect(to = '/inquiry_list/1')



  # 問い合わせ削除処理
  if "delete" in request.POST:

    # 問い合わせ者の情報取得
    data = member.objects.get(employee_no = obj_get.employee_no2)

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id1 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id1' : '',
                                                  'pop_up1' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id2 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id2' : '',
                                                  'pop_up2' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id3 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id3' : '',
                                                  'pop_up3' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id4 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id4' : '',
                                                  'pop_up4' : ''})

    # 削除する問い合わせIDとポップアップのIDが等しいときの処理
    if data.pop_up_id5 == str(num):
      # ポップアップ削除
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                                      defaults = {'pop_up_id5' : '',
                                                  'pop_up5' : ''})
      

    # 問い合わせ者の情報再取得
    data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ1が空の場合の処理
    if data.pop_up1 in ['', None]:
      #ポップアップ2の内容をポップアップ1へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id1' : data.pop_up_id2,
                                    'pop_up1' : data.pop_up2,
                                    'pop_up_id2' : '',
                                    'pop_up2' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ2が空の場合の処理
    if data.pop_up2 in ['', None]:
      #ポップアップ3の内容をポップアップ2へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id2' : data.pop_up_id3,
                                    'pop_up2' : data.pop_up3,
                                    'pop_up_id3' : '',
                                    'pop_up3' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ3が空の場合の処理
    if data.pop_up3 in ['', None]:
      #ポップアップ4の内容をポップアップ3へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id3' : data.pop_up_id4,
                                    'pop_up3' : data.pop_up4,
                                    'pop_up_id4' : '',
                                    'pop_up4' : ''})

      # 問い合わせ者の情報再取得
      data = member.objects.get(employee_no = obj_get.employee_no2)

    # ポップアップ4が空の場合の処理
    if data.pop_up4 in ['', None]:
      #ポップアップ5の内容をポップアップ4へ移行
      member.objects.update_or_create(employee_no = obj_get.employee_no2, \
                        defaults = {'pop_up_id4' : data.pop_up_id5,
                                    'pop_up4' : data.pop_up5,
                                    'pop_up_id5' : '',
                                    'pop_up5' : ''})
    

    # 設定データ取得
    last_record = administrator_data.objects.order_by("id").last()
    if last_record is None:
      # レコードが1件もない場合、menu_rowフィールドだけに値を設定したインスタンスを作成
      default_data = administrator_data(menu_row=20)
    else:
      default_data = last_record

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id1 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id1 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id1' : '',
                                                    'pop_up1' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id2 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id2 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id2' : '',
                                                    'pop_up2' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id3 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id3 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id3' : '',
                                                    'pop_up3' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id4 != '':
      # 削除する問い合わせIDとポップアップのIDが等しいときの処理
      if default_data.pop_up_id4 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id4' : '',
                                                    'pop_up4' : ''})

    # ポップアップのIDが空でない場合の処理
    if default_data.pop_up_id5 != '':
      # 削除する問い合わせIDとポップアッ'プのIDが等しいときの処理
      if default_data.pop_up_id5 == str(num):
        # ポップアップ削除
        administrator_data.objects.update_or_create(id = default_data.id, \
                                        defaults = {'pop_up_id5' : '',
                                                    'pop_up5' : ''})
      

    # 設定データ再取得
    default_data = administrator_data.objects.order_by("id").last()

    # ポップアップ1が空の場合の処理
    if default_data.pop_up1 in ["", None]:
      #ポップアップ2の内容をポップアップ1へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id1' : default_data.pop_up_id2,
                                    'pop_up1' : default_data.pop_up2,
                                    'pop_up_id2' : '',
                                    'pop_up2' : ''})

      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ2が空の場合の処理
    if default_data.pop_up2 in ["", None]:
      #ポップアップ3の内容をポップアップ2へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id2' : default_data.pop_up_id3,
                                    'pop_up2' : default_data.pop_up3,
                                    'pop_up_id3' : '',
                                    'pop_up3' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ3が空の場合の処理
    if default_data.pop_up3 in ["", None]:
      #ポップアップ4の内容をポップアップ3へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id3' : default_data.pop_up_id4,
                                    'pop_up3' : default_data.pop_up4,
                                    'pop_up_id4' : '',
                                    'pop_up4' : ''})
      
      # 設定データ再取得
      default_data = administrator_data.objects.order_by("id").last()


    # ポップアップ4が空の場合の処理
    if default_data.pop_up4 in ["", None]:
      #ポップアップ5の内容をポップアップ4へ移行
      administrator_data.objects.update_or_create(id = default_data.id, \
                        defaults = {'pop_up_id4' : default_data.pop_up_id5,
                                    'pop_up4' : default_data.pop_up5,
                                    'pop_up_id5' : '',
                                    'pop_up5' : ''})


    # 取得したレコード削除
    obj_get.delete()

    # 問い合わせ一覧ページをリダイレクトする
    return redirect(to = '/inquiry_list/1')



  # HTMLに渡す辞書
  context = {
    'title' : '問い合わせ編集',
    'id' : num,
    'obj' : obj_get,
    'form' : form,
    'login_obj_get' : login_obj_get,
    }
  


  # 指定したHTMLに辞書を渡して表示を完成させる
  return render(request, 'kosu/inquiry_edit.html', context)





#--------------------------------------------------------------------------------------------------------





