from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# Djangoの設定モジュールを指定
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hozen_another.settings')

app = Celery('hozen_another')

# Django settingsから名前空間を取得
app.config_from_object('django.conf:settings', namespace='CELERY')

# タスクを自動的にロード
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
