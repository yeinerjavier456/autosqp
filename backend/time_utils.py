import datetime
from zoneinfo import ZoneInfo


BOGOTA_TZ = ZoneInfo("America/Bogota")


def bogota_now() -> datetime.datetime:
    return datetime.datetime.now(BOGOTA_TZ)


def bogota_now_naive() -> datetime.datetime:
    return bogota_now().replace(tzinfo=None)


def bogota_today() -> datetime.date:
    return bogota_now().date()


def bogota_timestamp_label(fmt: str = "%d/%m/%Y %I:%M %p") -> str:
    return bogota_now().strftime(fmt)
