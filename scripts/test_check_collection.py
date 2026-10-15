import unittest
import io
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from check_collection import evaluate, monitor, summary, safe_time

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
        self.assertEqual(evaluate({**self.base, "latest": {"status": "FAILED", "errorCode": "interrupted", "finishedAt": self.now.isoformat()}}, self.now, self.now)[0], "wait")
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

    def test_repeated_failures_alert_even_with_current_old_snapshot_but_allow_live_retry(self):
        retry={**self.base,"latest":{"status":"FAILED"},"consecutiveFailures":3}
        self.assertEqual(evaluate(retry,self.now,self.now)[0],"error")
        self.assertEqual(evaluate({**retry,"latest":{"status":"RUNNING"}},self.now,self.now)[0],"wait")
        self.assertEqual(evaluate({**self.base,"consecutiveFailures":0},self.now,self.now)[0],"healthy")
        self.assertEqual(evaluate({**retry,"attentionReason":"CREDENTIAL_REJECTED"},self.now,self.now)[0],"error")

    @patch('check_collection.os.environ', {})
    def test_summary_redacts_unknown_diagnostics_and_formats_safe_timestamps(self):
        output=io.StringIO()
        with patch('sys.stdout',output):
            summary(False,'Known reason',{**self.base,"attentionReason":"secret-marker","lastSuccessAt":"secret-marker","consecutiveFailures":3})
        self.assertNotIn('secret-marker',output.getvalue())
        self.assertIn('Consecutive incomplete attempts: 3',output.getvalue())
        self.assertEqual(safe_time('2026-01-01T00:00:00'), 'none')

    @patch('check_collection.summary')
    @patch('check_collection.fetch_status', return_value={"configured":True,"freshness":"STALE","latest":{"status":"RUNNING"}})
    def test_timeout_preserves_last_wait_reason(self,fetch,summary):
        with patch('check_collection.time.monotonic',side_effect=[0,0,2,2]):
            self.assertEqual(monitor(timeout=1),1)
        self.assertIn('expired lease recovery',summary.call_args.args[1])

if __name__ == '__main__':
    unittest.main()
