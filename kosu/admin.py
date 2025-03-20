from django.contrib import admin
from .models import member
from .models import Business_Time_graph
from .models import team_member
from .models import kosu_division
from .models import administrator_data
from .models import inquiry_data
from .models import AsyncTask



admin.site.register(member)
admin.site.register(Business_Time_graph)
admin.site.register(team_member)
admin.site.register(kosu_division)
admin.site.register(administrator_data)
admin.site.register(inquiry_data)
admin.site.register(AsyncTask)