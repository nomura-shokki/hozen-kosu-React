from django.contrib import admin
from .models import member
from .models import Business_Time_graph
from .models import team_member
from .models import kosu_division
from .models import administrator_data
from .models import inquiry_data
from .models import AsyncTask
from .models import Operation_history



admin.site.register(member)
admin.site.register(Business_Time_graph)
admin.site.register(team_member)
admin.site.register(kosu_division)
admin.site.register(administrator_data)

class InquiryAdmin(admin.ModelAdmin):
  readonly_fields = ('created_at', 'updated_at')

admin.site.register(inquiry_data, InquiryAdmin)

class AsyncTaskAdmin(admin.ModelAdmin):
  readonly_fields = ('created_at', 'updated_at')

admin.site.register(AsyncTask, AsyncTaskAdmin)

class OperationHistoryAdmin(admin.ModelAdmin):
  readonly_fields = ('created_at',)

admin.site.register(Operation_history, OperationHistoryAdmin)
