from .settings import *  
TESTING = True  
DATABASES = {  
    'default': {  
        'ENGINE': 'django.db.backends.sqlite3',  
        'NAME': ':memory:',  
    }  
}  
Q_CLUSTER = {  
    'name': 'test',  
    'sync': True,  
    'timeout': 60,  
    'orm': 'default',  
}  
# マイグレーションを無効化する必要がある場合のみ使用  
class DisableMigrations:  
    def __contains__(self, item):  
        return True  
    def __getitem__(self, item):  
        return None  
MIGRATION_MODULES = DisableMigrations()  