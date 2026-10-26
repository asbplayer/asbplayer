from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "asbplayer-addon" / "server"),
)

import json_rpc  # noqa: E402


class FrameBuilderTests(unittest.TestCase):
    def test_notification_has_no_id(self) -> None:
        frame = json_rpc.notification("mine-subtitle", {"fields": {}})

        self.assertEqual(frame["jsonrpc"], "2.0")
        self.assertEqual(frame["method"], "mine-subtitle")
        self.assertEqual(frame["params"], {"fields": {}})
        self.assertNotIn("id", frame)

    def test_request_gets_an_id(self) -> None:
        frame = json_rpc.request("rpc.discover", {})

        self.assertEqual(frame["jsonrpc"], "2.0")
        self.assertEqual(frame["method"], "rpc.discover")
        self.assertIsInstance(frame["id"], str)
        self.assertNotEqual(frame["id"], "")

    def test_request_preserves_a_supplied_id(self) -> None:
        frame = json_rpc.request("rpc.discover", {}, "probe-id")

        self.assertEqual(frame["id"], "probe-id")

    def test_error_response_without_data(self) -> None:
        frame = json_rpc.error_response("id", -32601, "Method not found")

        self.assertEqual(
            frame,
            {
                "jsonrpc": "2.0",
                "id": "id",
                "error": {"code": -32601, "message": "Method not found"},
            },
        )

    def test_error_response_with_data(self) -> None:
        frame = json_rpc.error_response("id", -32602, "Invalid params", ["issue"])

        self.assertEqual(frame["error"]["data"], ["issue"])

    def test_mine_subtitle_notification(self) -> None:
        frame = json_rpc.mine_subtitle_notification({"Word": "ねこ"}, 2)

        self.assertEqual(frame["method"], "mine-subtitle")
        self.assertEqual(frame["params"], {"fields": {"Word": "ねこ"}, "postMineAction": 2})
        self.assertNotIn("id", frame)

    def test_mine_subtitle_command_stays_legacy(self) -> None:
        frame = json_rpc.mine_subtitle_command({"Word": "ねこ"}, 2, "legacy-id")

        self.assertEqual(
            frame,
            {
                "command": "mine-subtitle",
                "messageId": "legacy-id",
                "body": {"fields": {"Word": "ねこ"}, "postMineAction": 2},
            },
        )

    def test_mine_subtitle_frame_follows_negotiated_capability(self) -> None:
        modern = json_rpc.mine_subtitle_frame({"Word": "ねこ"}, 1, True)
        legacy = json_rpc.mine_subtitle_frame({"Word": "ねこ"}, 1, False)

        self.assertEqual(modern["method"], "mine-subtitle")
        self.assertNotIn("id", modern)
        self.assertEqual(legacy["command"], "mine-subtitle")
        self.assertIn("messageId", legacy)


class ClassificationTests(unittest.TestCase):
    def test_classifies_ping(self) -> None:
        self.assertEqual(json_rpc.classify_message("PING").kind, "ping")

    def test_classifies_json_rpc_request(self) -> None:
        frame = json_rpc.classify_message(
            json.dumps({"jsonrpc": "2.0", "method": "mine-subtitle", "id": "m1", "params": {}})
        )

        self.assertEqual(frame.kind, "json-rpc-request")
        self.assertEqual(frame.payload["id"], "m1")

    def test_classifies_json_rpc_notification(self) -> None:
        frame = json_rpc.classify_message(
            json.dumps({"jsonrpc": "2.0", "method": "mine-subtitle", "params": {}})
        )

        self.assertEqual(frame.kind, "json-rpc-notification")

    def test_classifies_json_rpc_result_response(self) -> None:
        frame = json_rpc.classify_message(
            json.dumps({"jsonrpc": "2.0", "id": "p1", "result": {}})
        )

        self.assertEqual(frame.kind, "json-rpc-response")

    def test_classifies_json_rpc_error_response(self) -> None:
        frame = json_rpc.classify_message(
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": "p1",
                    "error": {"code": -32601, "message": "Method not found"},
                }
            )
        )

        self.assertEqual(frame.kind, "json-rpc-response")

    def test_classifies_legacy_response(self) -> None:
        frame = json_rpc.classify_message(
            json.dumps({"command": "response", "messageId": "m1", "body": {}})
        )

        self.assertEqual(frame.kind, "legacy-response")

    def test_classifies_invalid_payloads(self) -> None:
        self.assertEqual(json_rpc.classify_message("not json").kind, "invalid")
        self.assertEqual(json_rpc.classify_message("[]").kind, "invalid")
        self.assertEqual(
            json_rpc.classify_message('{"jsonrpc": "2.0", "id": "m1"}').kind,
            "invalid",
        )
        self.assertEqual(json_rpc.classify_message('{"other": 1}').kind, "invalid")


class NegotiationTests(unittest.TestCase):
    def test_probe_success_marks_the_connection_capable(self) -> None:
        negotiation = json_rpc.JsonRpcNegotiation()
        probe = negotiation.start_probe()

        self.assertIsNotNone(probe)
        assert probe is not None
        self.assertEqual(probe["method"], "rpc.discover")
        self.assertEqual(negotiation.probe_id, probe["id"])

        response = json_rpc.classify_message(
            json.dumps({"jsonrpc": "2.0", "id": probe["id"], "result": {}})
        )

        self.assertTrue(negotiation.handle_frame(response))
        self.assertTrue(negotiation.supported)
        self.assertIsNone(negotiation.probe_id)
        self.assertIsNone(negotiation.start_probe())

    def test_error_response_also_marks_the_connection_capable(self) -> None:
        negotiation = json_rpc.JsonRpcNegotiation()
        probe = negotiation.start_probe()

        self.assertIsNotNone(probe)
        assert probe is not None
        response = json_rpc.classify_message(
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": probe["id"],
                    "error": {"code": -32601, "message": "Method not found"},
                }
            )
        )

        self.assertTrue(negotiation.handle_frame(response))
        self.assertTrue(negotiation.supported)

    def test_response_for_another_id_is_ignored(self) -> None:
        negotiation = json_rpc.JsonRpcNegotiation()
        probe = negotiation.start_probe()

        self.assertIsNotNone(probe)
        response = json_rpc.classify_message(
            json.dumps({"jsonrpc": "2.0", "id": "other", "result": {}})
        )

        self.assertFalse(negotiation.handle_frame(response))
        self.assertFalse(negotiation.supported)

    def test_timeout_abandons_the_probe(self) -> None:
        negotiation = json_rpc.JsonRpcNegotiation()
        negotiation.start_probe()

        self.assertTrue(negotiation.handle_timeout())
        self.assertFalse(negotiation.supported)
        self.assertIsNone(negotiation.probe_id)
        self.assertFalse(negotiation.handle_timeout())

    def test_reset_clears_capability_and_probe_state(self) -> None:
        negotiation = json_rpc.JsonRpcNegotiation()
        negotiation.start_probe()
        negotiation.supported = True

        negotiation.reset()

        self.assertFalse(negotiation.supported)
        self.assertIsNone(negotiation.probe_id)


if __name__ == "__main__":
    unittest.main()
