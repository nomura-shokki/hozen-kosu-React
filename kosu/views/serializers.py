from rest_framework import serializers
from ..models import member, kosu_division



class MemberSerializer(serializers.ModelSerializer):
  class Meta:
    model = member
    fields = '__all__'



class DefSerializer(serializers.ModelSerializer):
  class Meta:
    model = kosu_division
    fields = '__all__'