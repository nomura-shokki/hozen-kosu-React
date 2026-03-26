from rest_framework import serializers
from ..models import member, Business_Time_graph, kosu_division, def_choice, \
                      team_member, inquiry_data, administrator_data, AsyncTask, History



class MemberSerializer(serializers.ModelSerializer):
  class Meta:
    model = member
    fields = '__all__'



class DefSerializer(serializers.ModelSerializer):
  class Meta:
    model = kosu_division
    fields = '__all__'



class DefChoiceSerializer(serializers.ModelSerializer):
  class Meta:
    model = def_choice
    fields = '__all__'



class KosuSerializer(serializers.ModelSerializer):
  class Meta:
    model = Business_Time_graph
    fields = '__all__'



class TeamSerializer(serializers.ModelSerializer):
  class Meta:
    model = team_member
    fields = '__all__'



class InquirSerializer(serializers.ModelSerializer):
  class Meta:
    model = inquiry_data
    fields = '__all__'



class AdministratorSerializer(serializers.ModelSerializer):
  class Meta:
    model = administrator_data
    fields = '__all__'



class TaskSerializer(serializers.ModelSerializer):
  class Meta:
    model = AsyncTask
    fields = '__all__'



class HistorySerializer(serializers.ModelSerializer):
  class Meta:
    model = History
    fields = '__all__'