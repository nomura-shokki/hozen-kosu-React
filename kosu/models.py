from django.db import models
import jsonfield



class member(models.Model):
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
    ('組長以上(P,R,T,その他)', '組長以上(P,R,T,その他)'),
    ('組長以上(W,A)', '組長以上(W,A)'),
    ('異動・退社', '異動・退社'),
  ]
  
  employee_no = models.IntegerField('従業員番号')
  name = models.CharField('氏名', max_length=100)
  shop = models.CharField('ショップ', choices = shop_list, max_length=15)
  authority = models.BooleanField('権限')
  administrator = models.BooleanField('管理者')
  break_time1 = models.CharField('1直昼休憩時間', max_length=9)
  break_time1_over1 = models.CharField('1直残業休憩時間1', max_length=9)
  break_time1_over2 = models.CharField('1直残業休憩時間2', max_length=9)
  break_time1_over3 = models.CharField('1直残業休憩時間3', max_length=9)
  break_time2 = models.CharField('2直昼休憩時間', max_length=9)
  break_time2_over1 = models.CharField('2直残業休憩時間1', max_length=9)
  break_time2_over2 = models.CharField('2直残業休憩時間2', max_length=9)
  break_time2_over3 = models.CharField('2直残業休憩時間3', max_length=9)
  break_time3 = models.CharField('3直昼休憩時間', max_length=9)
  break_time3_over1 = models.CharField('3直残業休憩時間1', max_length=9)
  break_time3_over2 = models.CharField('3直残業休憩時間2', max_length=9)
  break_time3_over3 = models.CharField('3直残業休憩時間3', max_length=9)
  break_time4 = models.CharField('常昼昼休憩時間', max_length=9)
  break_time4_over1 = models.CharField('常昼残業休憩時間1', max_length=9)
  break_time4_over2 = models.CharField('常昼残業休憩時間2', max_length=9)
  break_time4_over3 = models.CharField('常昼残業休憩時間3', max_length=9)
  break_time5 = models.CharField('連1直昼休憩時間', max_length=9)
  break_time5_over1 = models.CharField('連1直残業休憩時間1', max_length=9)
  break_time5_over2 = models.CharField('連1直残業休憩時間2', max_length=9)
  break_time5_over3 = models.CharField('連1直残業休憩時間3', max_length=9)
  break_time6 = models.CharField('連2直昼休憩時間', max_length=9)
  break_time6_over1 = models.CharField('連2直残業休憩時間1', max_length=9)
  break_time6_over2 = models.CharField('連2直残業休憩時間2', max_length=9)
  break_time6_over3 = models.CharField('連2直残業休憩時間3', max_length=9)
  pop_up1 = models.CharField('ポップアップ1', max_length=255, null=True, blank=True)
  pop_up_id1 =  models.CharField('ポップアップID1', max_length=255, null=True, blank=True)
  pop_up2 = models.CharField('ポップアップ2', max_length=255, null=True, blank=True)
  pop_up_id2 =  models.CharField('ポップアップID2', max_length=255, null=True, blank=True)
  pop_up3 = models.CharField('ポップアップ3', max_length=255, null=True, blank=True)
  pop_up_id3 =  models.CharField('ポップアップID3', max_length=255, null=True, blank=True)
  pop_up4 = models.CharField('ポップアップ4', max_length=255, null=True, blank=True)
  pop_up_id4 =  models.CharField('ポップアップID4', max_length=255, null=True, blank=True)
  pop_up5 = models.CharField('ポップアップ5', max_length=255, null=True, blank=True)
  pop_up_id5 =  models.CharField('ポップアップID5', max_length=255, null=True, blank=True)
  break_check = models.BooleanField('休憩エラー有効チェック', null=True)

  def __str__(self):
    return self.name



class Business_Time_graph(models.Model):
  employee_no3 = models.IntegerField('従業員番号')
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)
  def_ver2 = models.CharField('工数区分定義Ver', max_length=100, blank=True, null=True)
  work_day2 = models.DateField('就業日')
  tyoku2 = models.CharField('直', max_length=2, blank=True, null=True)
  time_work = models.CharField('作業内容', max_length=288, blank=True, null=True)
  detail_work = models.CharField('作業詳細', max_length=32676, blank=True, null=True)
  over_time = models.IntegerField('残業時間', blank=True, null=True)
  breaktime = models.CharField('昼休憩時間', max_length=9, blank=True, null=True)
  breaktime_over1 = models.CharField('残業休憩時間1', max_length=9, blank=True, null=True)
  breaktime_over2 = models.CharField('残業休憩時間2', max_length=9, blank=True, null=True)
  breaktime_over3 = models.CharField('残業休憩時間3', max_length=9, blank=True, null=True)
  work_time = models.CharField('就業形態', max_length=100, blank=True, null=True)
  judgement = models.BooleanField('工数入力OK_NG', null=True)
  break_change = models.BooleanField('休憩変更チェック', null=True)

  def __str__(self):
    return str(self.id) + '__' + str(self.work_day2) + ':' + str(self.employee_no3)



class team_member(models.Model):
  employee_no5 = models.IntegerField('従業員番号')
  member1 = models.CharField('メンバー従業員番号1', max_length=6, blank=True, null=True)
  member2 = models.CharField('メンバー従業員番号2', max_length=6, blank=True, null=True)
  member3 = models.CharField('メンバー従業員番号3', max_length=6, blank=True, null=True)
  member4 = models.CharField('メンバー従業員番号4', max_length=6, blank=True, null=True)
  member5 = models.CharField('メンバー従業員番号5', max_length=6, blank=True, null=True)
  member6 = models.CharField('メンバー従業員番号6', max_length=6, blank=True, null=True)
  member7 = models.CharField('メンバー従業員番号7', max_length=6, blank=True, null=True)
  member8 = models.CharField('メンバー従業員番号8', max_length=6, blank=True, null=True)
  member9 = models.CharField('メンバー従業員番号9', max_length=6, blank=True, null=True)
  member10 = models.CharField('メンバー従業員番号10', max_length=6, blank=True, null=True)
  member11 = models.CharField('メンバー従業員番号11', max_length=6, blank=True, null=True)
  member12 = models.CharField('メンバー従業員番号12', max_length=6, blank=True, null=True)
  member13 = models.CharField('メンバー従業員番号13', max_length=6, blank=True, null=True)
  member14 = models.CharField('メンバー従業員番号14', max_length=6, blank=True, null=True)
  member15 = models.CharField('メンバー従業員番号15', max_length=6, blank=True, null=True)
  follow = models.BooleanField('フォローON/OFF', null=True)

  def __str__(self):
    return str(self.employee_no5)



class kosu_division(models.Model):
  kosu_name = models.CharField('工数区分定義Ver名', blank=True, null=True, max_length=100)
  kosu_title_1 = models.CharField('工数区分名1', blank=True, null=True, max_length=100)
  kosu_division_1_1 = models.TextField('定義1', blank=True, null=True)
  kosu_division_2_1 = models.TextField('作業内容1', blank=True, null=True)
  kosu_division_3_1 = models.BooleanField('変動/固定1', null=True)
  kosu_title_2 = models.CharField('工数区分名2', blank=True, null=True, max_length=100)
  kosu_division_1_2 = models.TextField('定義2', blank=True, null=True)
  kosu_division_2_2 = models.TextField('作業内容2', blank=True, null=True)
  kosu_division_3_2 = models.BooleanField('変動/固定2', null=True)
  kosu_title_3 = models.CharField('工数区分名3', blank=True, null=True, max_length=100)
  kosu_division_1_3 = models.TextField('定義3', blank=True, null=True)
  kosu_division_2_3 = models.TextField('作業内容3', blank=True, null=True)
  kosu_division_3_3 = models.BooleanField('変動/固定3', null=True)
  kosu_title_4 = models.CharField('工数区分名4', blank=True, null=True, max_length=100)
  kosu_division_1_4 = models.TextField('定義4', blank=True, null=True)
  kosu_division_2_4 = models.TextField('作業内容4', blank=True, null=True)
  kosu_division_3_4 = models.BooleanField('変動/固定4', null=True)
  kosu_title_5 = models.CharField('工数区分名5', blank=True, null=True, max_length=100)
  kosu_division_1_5 = models.TextField('定義5', blank=True, null=True)
  kosu_division_2_5 = models.TextField('作業内容5', blank=True, null=True)
  kosu_division_3_5 = models.BooleanField('変動/固定5', null=True)
  kosu_title_6 = models.CharField('工数区分名6', blank=True, null=True, max_length=100)
  kosu_division_1_6 = models.TextField('定義6', blank=True, null=True)
  kosu_division_2_6 = models.TextField('作業内容6', blank=True, null=True)
  kosu_division_3_6 = models.BooleanField('変動/固定6', null=True)
  kosu_title_7 = models.CharField('工数区分名7', blank=True, null=True, max_length=100)
  kosu_division_1_7 = models.TextField('定義7', blank=True, null=True)
  kosu_division_2_7 = models.TextField('作業内容7', blank=True, null=True)
  kosu_division_3_7 = models.BooleanField('変動/固定7', null=True)
  kosu_title_8 = models.CharField('工数区分名8', blank=True, null=True, max_length=100)
  kosu_division_1_8 = models.TextField('定義8', blank=True, null=True)
  kosu_division_2_8 = models.TextField('作業内容8', blank=True, null=True)
  kosu_division_3_8 = models.BooleanField('変動/固定8', null=True)
  kosu_title_9 = models.CharField('工数区分名9', blank=True, null=True, max_length=100)
  kosu_division_1_9 = models.TextField('定義9', blank=True, null=True)
  kosu_division_2_9 = models.TextField('作業内容9', blank=True, null=True)
  kosu_division_3_9 = models.BooleanField('変動/固定9', null=True)
  kosu_title_10 = models.CharField('工数区分名10', blank=True, null=True, max_length=100)
  kosu_division_1_10 = models.TextField('定義10', blank=True, null=True)
  kosu_division_2_10 = models.TextField('作業内容10', blank=True, null=True)
  kosu_division_3_10 = models.BooleanField('変動/固定10', null=True)
  kosu_title_11 = models.CharField('工数区分名11', blank=True, null=True, max_length=100)
  kosu_division_1_11 = models.TextField('定義11', blank=True, null=True)
  kosu_division_2_11 = models.TextField('作業内容11', blank=True, null=True)
  kosu_division_3_11 = models.BooleanField('変動/固定11', null=True)
  kosu_title_12 = models.CharField('工数区分名12', blank=True, null=True, max_length=100)
  kosu_division_1_12 = models.TextField('定義12', blank=True, null=True)
  kosu_division_2_12 = models.TextField('作業内容12', blank=True, null=True)
  kosu_division_3_12 = models.BooleanField('変動/固定12', null=True)
  kosu_title_13 = models.CharField('工数区分名13', blank=True, null=True, max_length=100)
  kosu_division_1_13 = models.TextField('定義13', blank=True, null=True)
  kosu_division_2_13 = models.TextField('作業内容13', blank=True, null=True)
  kosu_division_3_13 = models.BooleanField('変動/固定13', null=True)
  kosu_title_14 = models.CharField('工数区分名14', blank=True, null=True, max_length=100)
  kosu_division_1_14 = models.TextField('定義14', blank=True, null=True)
  kosu_division_2_14 = models.TextField('作業内容14', blank=True, null=True)
  kosu_division_3_14 = models.BooleanField('変動/固定14', null=True)
  kosu_title_15 = models.CharField('工数区分名15', blank=True, null=True, max_length=100)
  kosu_division_1_15 = models.TextField('定義15', blank=True, null=True)
  kosu_division_2_15 = models.TextField('作業内容15', blank=True, null=True)
  kosu_division_3_15 = models.BooleanField('変動/固定15', null=True)
  kosu_title_16 = models.CharField('工数区分名16', blank=True, null=True, max_length=100)
  kosu_division_1_16 = models.TextField('定義16', blank=True, null=True)
  kosu_division_2_16 = models.TextField('作業内容16', blank=True, null=True)
  kosu_division_3_16 = models.BooleanField('変動/固定16', null=True)
  kosu_title_17 = models.CharField('工数区分名17', blank=True, null=True, max_length=100)
  kosu_division_1_17 = models.TextField('定義17', blank=True, null=True)
  kosu_division_2_17 = models.TextField('作業内容17', blank=True, null=True)
  kosu_division_3_17 = models.BooleanField('変動/固定17', null=True)
  kosu_title_18 = models.CharField('工数区分名18', blank=True, null=True, max_length=100)
  kosu_division_1_18 = models.TextField('定義18', blank=True, null=True)
  kosu_division_2_18 = models.TextField('作業内容18', blank=True, null=True)
  kosu_division_3_18 = models.BooleanField('変動/固定18', null=True)
  kosu_title_19 = models.CharField('工数区分名19', blank=True, null=True, max_length=100)
  kosu_division_1_19 = models.TextField('定義19', blank=True, null=True)
  kosu_division_2_19 = models.TextField('作業内容19', blank=True, null=True)
  kosu_division_3_19 = models.BooleanField('変動/固定19', null=True)
  kosu_title_20 = models.CharField('工数区分名20', blank=True, null=True, max_length=100)
  kosu_division_1_20 = models.TextField('定義20', blank=True, null=True)
  kosu_division_2_20 = models.TextField('作業内容20', blank=True, null=True)
  kosu_division_3_20 = models.BooleanField('変動/固定20', null=True)
  kosu_title_21 = models.CharField('工数区分名21', blank=True, null=True, max_length=100)
  kosu_division_1_21 = models.TextField('定義21', blank=True, null=True)
  kosu_division_2_21 = models.TextField('作業内容21', blank=True, null=True)
  kosu_division_3_21 = models.BooleanField('変動/固定21', null=True)
  kosu_title_22 = models.CharField('工数区分名22', blank=True, null=True, max_length=100)
  kosu_division_1_22 = models.TextField('定義22', blank=True, null=True)
  kosu_division_2_22 = models.TextField('作業内容22', blank=True, null=True)
  kosu_division_3_22 = models.BooleanField('変動/固定22', null=True)
  kosu_title_23 = models.CharField('工数区分名23', blank=True, null=True, max_length=100)
  kosu_division_1_23 = models.TextField('定義23', blank=True, null=True)
  kosu_division_2_23 = models.TextField('作業内容23', blank=True, null=True)
  kosu_division_3_23 = models.BooleanField('変動/固定23', null=True)
  kosu_title_24 = models.CharField('工数区分名24', blank=True, null=True, max_length=100)
  kosu_division_1_24 = models.TextField('定義24', blank=True, null=True)
  kosu_division_2_24 = models.TextField('作業内容24', blank=True, null=True)
  kosu_division_3_24 = models.BooleanField('変動/固定24', null=True)
  kosu_title_25 = models.CharField('工数区分名25', blank=True, null=True, max_length=100)
  kosu_division_1_25 = models.TextField('定義25', blank=True, null=True)
  kosu_division_2_25 = models.TextField('作業内容25', blank=True, null=True)
  kosu_division_3_25 = models.BooleanField('変動/固定25', null=True)
  kosu_title_26 = models.CharField('工数区分名26', blank=True, null=True, max_length=100)
  kosu_division_1_26 = models.TextField('定義26', blank=True, null=True)
  kosu_division_2_26 = models.TextField('作業内容26', blank=True, null=True)
  kosu_division_3_26 = models.BooleanField('変動/固定26', null=True)
  kosu_title_27 = models.CharField('工数区分名27', blank=True, null=True, max_length=100)
  kosu_division_1_27 = models.TextField('定義27', blank=True, null=True)
  kosu_division_2_27 = models.TextField('作業内容27', blank=True, null=True)
  kosu_division_3_27 = models.BooleanField('変動/固定27', null=True)
  kosu_title_28 = models.CharField('工数区分名28', blank=True, null=True, max_length=100)
  kosu_division_1_28 = models.TextField('定義28', blank=True, null=True)
  kosu_division_2_28 = models.TextField('作業内容28', blank=True, null=True)
  kosu_division_3_28 = models.BooleanField('変動/固定28', null=True)
  kosu_title_29 = models.CharField('工数区分名29', blank=True, null=True, max_length=100)
  kosu_division_1_29 = models.TextField('定義29', blank=True, null=True)
  kosu_division_2_29 = models.TextField('作業内容29', blank=True, null=True)
  kosu_division_3_29 = models.BooleanField('変動/固定29', null=True)
  kosu_title_30 = models.CharField('工数区分名30', blank=True, null=True, max_length=100)
  kosu_division_1_30 = models.TextField('定義30', blank=True, null=True)
  kosu_division_2_30 = models.TextField('作業内容30', blank=True, null=True)
  kosu_division_3_30 = models.BooleanField('変動/固定30', null=True)
  kosu_title_31 = models.CharField('工数区分名31', blank=True, null=True, max_length=100)
  kosu_division_1_31 = models.TextField('定義31', blank=True, null=True)
  kosu_division_2_31 = models.TextField('作業内容31', blank=True, null=True)
  kosu_division_3_31 = models.BooleanField('変動/固定31', null=True)
  kosu_title_32 = models.CharField('工数区分名32', blank=True, null=True, max_length=100)
  kosu_division_1_32 = models.TextField('定義32', blank=True, null=True)
  kosu_division_2_32 = models.TextField('作業内容32', blank=True, null=True)
  kosu_division_3_32 = models.BooleanField('変動/固定32', null=True)
  kosu_title_33 = models.CharField('工数区分名33', blank=True, null=True, max_length=100)
  kosu_division_1_33 = models.TextField('定義33', blank=True, null=True)
  kosu_division_2_33 = models.TextField('作業内容33', blank=True, null=True)
  kosu_division_3_33 = models.BooleanField('変動/固定33', null=True)
  kosu_title_34 = models.CharField('工数区分名34', blank=True, null=True, max_length=100)
  kosu_division_1_34 = models.TextField('定義34', blank=True, null=True)
  kosu_division_2_34 = models.TextField('作業内容34', blank=True, null=True)
  kosu_division_3_34 = models.BooleanField('変動/固定34', null=True)
  kosu_title_35 = models.CharField('工数区分名35', blank=True, null=True, max_length=100)
  kosu_division_1_35 = models.TextField('定義35', blank=True, null=True)
  kosu_division_2_35 = models.TextField('作業内容35', blank=True, null=True)
  kosu_division_3_35 = models.BooleanField('変動/固定35', null=True)
  kosu_title_36 = models.CharField('工数区分名36', blank=True, null=True, max_length=100)
  kosu_division_1_36 = models.TextField('定義36', blank=True, null=True)
  kosu_division_2_36 = models.TextField('作業内容36', blank=True, null=True)
  kosu_division_3_36 = models.BooleanField('変動/固定36', null=True)
  kosu_title_37 = models.CharField('工数区分名37', blank=True, null=True, max_length=100)
  kosu_division_1_37 = models.TextField('定義37', blank=True, null=True)
  kosu_division_2_37 = models.TextField('作業内容37', blank=True, null=True)
  kosu_division_3_37 = models.BooleanField('変動/固定37', null=True)
  kosu_title_38 = models.CharField('工数区分名38', blank=True, null=True, max_length=100)
  kosu_division_1_38 = models.TextField('定義38', blank=True, null=True)
  kosu_division_2_38 = models.TextField('作業内容38', blank=True, null=True)
  kosu_division_3_38 = models.BooleanField('変動/固定38', null=True)
  kosu_title_39 = models.CharField('工数区分名39', blank=True, null=True, max_length=100)
  kosu_division_1_39 = models.TextField('定義39', blank=True, null=True)
  kosu_division_2_39 = models.TextField('作業内容39', blank=True, null=True)
  kosu_division_3_39 = models.BooleanField('変動/固定39', null=True)
  kosu_title_40 = models.CharField('工数区分名40', blank=True, null=True, max_length=100)
  kosu_division_1_40 = models.TextField('定義40', blank=True, null=True)
  kosu_division_2_40 = models.TextField('作業内容40', blank=True, null=True)
  kosu_division_3_40 = models.BooleanField('変動/固定40', null=True)
  kosu_title_41 = models.CharField('工数区分名41', blank=True, null=True, max_length=100)
  kosu_division_1_41 = models.TextField('定義41', blank=True, null=True)
  kosu_division_2_41 = models.TextField('作業内容41', blank=True, null=True)
  kosu_division_3_41 = models.BooleanField('変動/固定41', null=True)
  kosu_title_42 = models.CharField('工数区分名42', blank=True, null=True, max_length=100)
  kosu_division_1_42 = models.TextField('定義42', blank=True, null=True)
  kosu_division_2_42 = models.TextField('作業内容42', blank=True, null=True)
  kosu_division_3_42 = models.BooleanField('変動/固定42', null=True)
  kosu_title_43 = models.CharField('工数区分名43', blank=True, null=True, max_length=100)
  kosu_division_1_43 = models.TextField('定義43', blank=True, null=True)
  kosu_division_2_43 = models.TextField('作業内容43', blank=True, null=True)
  kosu_division_3_43 = models.BooleanField('変動/固定43', null=True)
  kosu_title_44 = models.CharField('工数区分名44', blank=True, null=True, max_length=100)
  kosu_division_1_44 = models.TextField('定義44', blank=True, null=True)
  kosu_division_2_44 = models.TextField('作業内容44', blank=True, null=True)
  kosu_division_3_44 = models.BooleanField('変動/固定44', null=True)
  kosu_title_45 = models.CharField('工数区分名45', blank=True, null=True, max_length=100)
  kosu_division_1_45 = models.TextField('定義45', blank=True, null=True)
  kosu_division_2_45 = models.TextField('作業内容45', blank=True, null=True)
  kosu_division_3_45 = models.BooleanField('変動/固定45', null=True)
  kosu_title_46 = models.CharField('工数区分名46', blank=True, null=True, max_length=100)
  kosu_division_1_46 = models.TextField('定義46', blank=True, null=True)
  kosu_division_2_46 = models.TextField('作業内容46', blank=True, null=True)
  kosu_division_3_46 = models.BooleanField('変動/固定46', null=True)
  kosu_title_47 = models.CharField('工数区分名47', blank=True, null=True, max_length=100)
  kosu_division_1_47 = models.TextField('定義47', blank=True, null=True)
  kosu_division_2_47 = models.TextField('作業内容47', blank=True, null=True)
  kosu_division_3_47 = models.BooleanField('変動/固定47', null=True)
  kosu_title_48 = models.CharField('工数区分名48', blank=True, null=True, max_length=100)
  kosu_division_1_48 = models.TextField('定義48', blank=True, null=True)
  kosu_division_2_48 = models.TextField('作業内容48', blank=True, null=True)
  kosu_division_3_48 = models.BooleanField('変動/固定48', null=True)
  kosu_title_49 = models.CharField('工数区分名49', blank=True, null=True, max_length=100)
  kosu_division_1_49 = models.TextField('定義49', blank=True, null=True)
  kosu_division_2_49 = models.TextField('作業内容49', blank=True, null=True)
  kosu_division_3_49 = models.BooleanField('変動/固定49', null=True)
  kosu_title_50 = models.CharField('工数区分名50', blank=True, null=True, max_length=100)
  kosu_division_1_50 = models.TextField('定義50', blank=True, null=True)
  kosu_division_2_50 = models.TextField('作業内容50', blank=True, null=True)
  kosu_division_3_50 = models.BooleanField('変動/固定50', null=True)

  def __str__(self):
    return str(self.id) + ' : ' + str(self.kosu_name)



class def_choice(models.Model):
  def_list = [(x, x) for x in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx$"]

  def_symbol = models.CharField('定義記号', choices=def_list, max_length=2)
  def_select = models.CharField('作業詳細', max_length=100)

  def __str__(self):
    return str(self.def_symbol) + str(self.def_select)



class administrator_data(models.Model):
  menu_row = models.CharField('一覧表示項目数', max_length=4)
  administrator_employee_no1 =  models.CharField('問い合わせ担当者従業員番号1', max_length=255, null=True, blank=True)
  administrator_employee_no2 =  models.CharField('問い合わせ担当者従業員番号2', max_length=255, null=True, blank=True)
  administrator_employee_no3 =  models.CharField('問い合わせ担当者従業員番号3', max_length=255, null=True, blank=True)
  pop_up1 = models.CharField('ポップアップ1', max_length=255, null=True, blank=True)
  pop_up_id1 =  models.CharField('ポップアップID1', max_length=255, null=True, blank=True)
  pop_up2 = models.CharField('ポップアップ2', max_length=255, null=True, blank=True)
  pop_up_id2 =  models.CharField('ポップアップID2', max_length=255, null=True, blank=True)
  pop_up3 = models.CharField('ポップアップ3', max_length=255, null=True, blank=True)
  pop_up_id3 =  models.CharField('ポップアップID3', max_length=255, null=True, blank=True)
  pop_up4 = models.CharField('ポップアップ4', max_length=255, null=True, blank=True)
  pop_up_id4 =  models.CharField('ポップアップID4', max_length=255, null=True, blank=True)
  pop_up5 = models.CharField('ポップアップ5', max_length=255, null=True, blank=True)
  pop_up_id5 =  models.CharField('ポップアップID5', max_length=255, null=True, blank=True)

  def __str__(self):
    return '設定' + str(self.id)



class inquiry_data(models.Model):
  content_list = [
    ('要望', '要望'),
    ('不具合', '不具合'),
    ('問い合わせ' ,'問い合わせ'),
  ]

  employee_no2 = models.IntegerField('従業員番号')
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)
  content_choice = models.CharField('内容選択', choices=content_list, max_length=5)
  inquiry = models.TextField('問い合わせ')
  answer = models.TextField('回答', null=True, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)

  def __str__(self):
    return str(self.id) + str(self.name)



class AsyncTask(models.Model):
  MAX_RECORDS = 1000

  task_id = models.CharField(max_length=255, unique=True)
  status = models.CharField(max_length=50, choices=[
    ('pending', 'Pending'),
    ('success', 'Success'),
    ('error', 'Error')
  ])
  result = models.TextField(null=True, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)
  updated_at = models.DateTimeField(auto_now=True)

  def __str__(self):
    return f'{self.created_at} on {self.status} (TaskID: {self.task_id})'

  def save(self, *args, **kwargs):
    super().save(*args, **kwargs)
    current_count = self.__class__.objects.count()

    # レコード数が許容数以上の場合の処理
    if current_count > self.MAX_RECORDS:
      # 超過レコード数分のレコード取得し削除
      excess_count = current_count - self.MAX_RECORDS
      oldest_records = self.__class__.objects.order_by('created_at')[:excess_count]
      for record in oldest_records:
        record.delete()



class Operation_history(models.Model):
  created_at = models.DateTimeField(auto_now_add=True)
  employee_no4 = models.IntegerField('従業員番号')
  name = models.ForeignKey(member, verbose_name='氏名', null=True, on_delete=models.SET_NULL)
  post_page = models.CharField('ページ', max_length=255, null=True, blank=True)
  operation_models = models.CharField('編集したモデル', max_length=255, null=True, blank=True)
  status = models.CharField('結果', max_length=255, null=True, blank=True)
  operation_detail = models.TextField('編集詳細', null=True, blank=True)

  def __str__(self):
    return str(self.id) + str(self.name) + '：' + str(self.created_at)



class History(models.Model):
  MAX_RECORDS = 500000

  operation = models.CharField(max_length=10)
  table_name = models.CharField(max_length=50)
  record_id = models.IntegerField()
  login_No = models.CharField(max_length=255, blank=True, null=True)
  changes = jsonfield.JSONField(blank=True, null=True)
  timestamp = models.DateTimeField(auto_now_add=True)

  def __str__(self):
    return f'{self.operation} on {self.table_name} (ID: {self.record_id})'

  def save(self, *args, **kwargs):
    super().save(*args, **kwargs)
    current_count = self.__class__.objects.count()

    # レコード数が許容数以上の場合の処理
    if current_count > self.MAX_RECORDS:
      # 超過レコード数分のレコード取得し削除
      excess_count = current_count - self.MAX_RECORDS
      oldest_records = self.__class__.objects.order_by('timestamp')[:excess_count]
      for record in oldest_records:
        record.delete()