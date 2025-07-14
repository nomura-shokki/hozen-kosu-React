from rest_framework import serializers
from ..models import member, Business_Time_graph, kosu_division



class MemberSerializer(serializers.ModelSerializer):
  class Meta:
    model = member
    fields = '__all__'



class DefSerializer(serializers.ModelSerializer):
  class Meta:
    model = kosu_division
    fields = '__all__'



class KosuSerializer(serializers.ModelSerializer):
  class Meta:
    model = Business_Time_graph
    fields = '__all__'