"""Exercise the dashboard's actual appointment selection without database access."""
import ast
import datetime as dt
from pathlib import Path
from types import SimpleNamespace
import unittest


class AppointmentRangeTests(unittest.TestCase):
    def select(self, items, employee_id=None):
        tree = ast.parse(Path(__file__).with_name('main.py').read_text(encoding='utf-8'))
        dashboard = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'read_advisor_stats')
        selection = next(node.value for node in ast.walk(dashboard) if isinstance(node, ast.Assign)
                         and any(isinstance(target, ast.Name) and target.id == 'appointments' for target in node.targets)
                         and isinstance(node.value, ast.ListComp))
        start = dt.datetime(2026, 11, 11, 5)
        end = dt.datetime(2026, 11, 12, 5)
        return eval(compile(ast.Expression(selection), '<dashboard appointment selection>', 'eval'), {
            'appointments_query': SimpleNamespace(all=lambda: items),
            'is_within_dashboard_range': lambda value: bool(value and start <= value < end),
            'employee_id': employee_id,
        })

    def test_future_meeting_counts_when_created_today(self):
        item = SimpleNamespace(created_at=dt.datetime(2026, 11, 11, 15), appointment_date=dt.datetime(2026, 11, 18), user_id=7)
        self.assertEqual(self.select([item], 7), [item])

    def test_old_creation_does_not_count_even_if_meeting_is_today(self):
        item = SimpleNamespace(created_at=dt.datetime(2026, 11, 10), appointment_date=dt.datetime(2026, 11, 11, 15), user_id=7)
        self.assertEqual(self.select([item], 7), [])

    def test_employee_and_bogota_day_boundaries(self):
        items = [SimpleNamespace(created_at=date, user_id=user) for date, user in [
            (dt.datetime(2026, 11, 11, 4, 59), 7),
            (dt.datetime(2026, 11, 11, 5), 7),
            (dt.datetime(2026, 11, 12, 4, 59), 8),
            (dt.datetime(2026, 11, 12, 5), 7),
        ]]
        self.assertEqual(self.select(items, 7), [items[1]])
        self.assertEqual(self.select(items), items[1:3])


if __name__ == '__main__':
    unittest.main()
