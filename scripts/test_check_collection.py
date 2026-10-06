import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from check_collection import evaluate, monitor

class CollectionCheckTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 6, tzinfo=timezone.utc)
        self.base = {"configured": True, "freshness": "CURRENT", "latest": {"status": "SUCCESS"}, "nextAttemptAt": (self.now + timedelta(hours=6)).isoformat()}

    def test_current_success_can_finish_but_due_snapshot_waits(self):
        self.assertEqual(evaluate(self.base, self.now, self.now)[0], "healthy")
        self.assertEqual(evaluate({**self.base, "nextAttemptAt": self.now.isoformat()}, self.now, self.now)[0], "wait")

    def test_disabled_stale_and_failed_attempt_are_not_reported_as_success(self):
        self.assertEqual(evaluate({**self.base, "configured": False}, self.now, self.now)[0], "error")
        self.assertEqual(evaluate({**self.base, "freshness": "STALE"}, self.now, self.now)[0], "error")
        failure = {**self.base, "latest": {"status": "FAILED", "finishedAt": self.now.isoformat()}}
        self.assertEqual(evaluate(failure, self.now, self.now)[0], "error")

    def test_running_expired_lease_and_near_term_retry_wait(self):
        self.assertEqual(evaluate({**self.base, "latest": {"status": "RUNNING"}, "stalled": True}, self.now, self.now)[0], "wait")
        retry = {**self.base, "latest": {"status": "FAILED", "finishedAt": (self.now - timedelta(hours=1)).isoformat()}, "nextAttemptAt": (self.now + timedelta(minutes=10)).isoformat()}
        self.assertEqual(evaluate(retry, self.now, self.now)[0], "wait")

    @patch('check_collection.summary')
    @patch('check_collection.fetch_status')
    def test_monitor_recovers_from_cold_start_and_returns_success(self, fetch, summary):
        fetch.side_effect = [OSError("unavailable"), {**self.base, "nextAttemptAt": "2099-01-01T00:00:00Z"}]
        with patch('check_collection.time.sleep'):
            self.assertEqual(monitor(timeout=2, interval=1), 0)
        self.assertTrue(summary.call_args.args[0])

    @patch('check_collection.summary')
    @patch('check_collection.fetch_status', return_value={"configured": False})
    def test_monitor_failure_is_a_nonzero_exit(self, fetch, summary):
        self.assertEqual(monitor(timeout=2), 1)
        self.assertFalse(summary.call_args.args[0])

if __name__ == '__main__':
    unittest.main()
