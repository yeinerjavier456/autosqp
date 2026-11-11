import unittest
from unittest.mock import MagicMock
from backend.db_work_lock import optional_work_lock


class OptionalWorkLockTests(unittest.TestCase):
    def engine(self, acquired):
        engine = MagicMock()
        engine.dialect.name = 'mysql'
        connection = engine.connect.return_value.__enter__.return_value
        connection.execute.return_value.scalar.return_value = acquired
        return engine, connection

    def test_busy_lock_does_not_block_or_release_another_process_lock(self):
        engine, connection = self.engine(0)
        with optional_work_lock(engine, 'company-1') as acquired:
            self.assertFalse(acquired)
        self.assertEqual(connection.execute.call_count, 1)

    def test_acquired_lock_released_even_after_failure(self):
        engine, connection = self.engine(1)
        with self.assertRaises(ValueError):
            with optional_work_lock(engine, 'company-1') as acquired:
                self.assertTrue(acquired)
                raise ValueError('business failure')
        self.assertEqual(connection.execute.call_count, 2)
        self.assertIn('RELEASE_LOCK', str(connection.execute.call_args.args[0]))

    def test_non_mysql_does_not_request_mysql_lock(self):
        engine = MagicMock()
        engine.dialect.name = 'sqlite'
        with optional_work_lock(engine, 'company-1') as acquired:
            self.assertTrue(acquired)
        engine.connect.assert_not_called()
