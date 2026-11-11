"""Non-blocking cross-process coordination for optional background checks."""
from contextlib import contextmanager
from sqlalchemy import text


@contextmanager
def optional_work_lock(engine, name):
    # A dedicated connection is required: business code may commit its session.
    if engine.dialect.name != 'mysql':
        yield True
        return
    with engine.connect() as connection:
        acquired = bool(connection.execute(text('SELECT GET_LOCK(:name, 0)'), {'name': name}).scalar())
        try:
            yield acquired
        finally:
            if acquired:
                connection.execute(text('SELECT RELEASE_LOCK(:name)'), {'name': name})
