import datetime

def round_time(dt=None, round_to=5):
    """指定された分単位で時間を丸める関数"""
    if dt is None:
        dt = datetime.datetime.now().time()
    minute = (dt.minute // round_to) * round_to
    return dt.replace(minute=minute, second=0, microsecond=0)