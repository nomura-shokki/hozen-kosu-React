from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable signals during tests to avoid side effects
TESTING = True

# Disable django-q cluster requirement for tests
Q_CLUSTER = {
    'name': 'test',
    'sync': True,
    'timeout': 60,
    'orm': 'default',
}

# Custom test runner that creates tables from models directly (bypasses migrations)
# This avoids issues with CharField without max_length that PostgreSQL supports but SQLite does not
class DisableMigrations:
    """Fake migration module that tells Django to skip migrations and use syncdb."""
    def __contains__(self, item):
        return True
    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()
