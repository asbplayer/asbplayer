"""JSON-RPC framing and capability negotiation for the Anki add-on."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

JSON_RPC_VERSION = "2.0"
PROBE_METHOD = "rpc.discover"
METHOD_NOT_FOUND = -32601
INVALID_REQUEST = -32600
PARSE_ERROR = -32700
INTERNAL_ERROR = -32603

FrameKind = Literal[
    "ping",
    "json-rpc-request",
    "json-rpc-notification",
    "json-rpc-response",
    "legacy-response",
    "invalid",
]


@dataclass(frozen=True)
class IncomingFrame:
    kind: FrameKind
    payload: dict[str, Any] = field(default_factory=dict)


def notification(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    frame: dict[str, Any] = {"jsonrpc": JSON_RPC_VERSION, "method": method}

    if params is not None:
        frame["params"] = params

    return frame


def request(
    method: str,
    params: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    frame = notification(method, params)
    frame["id"] = request_id if request_id is not None else str(uuid.uuid4())
    return frame


def error_response(
    request_id: Any,
    code: int,
    message: str,
    data: Any = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}

    if data is not None:
        error["data"] = data

    return {"jsonrpc": JSON_RPC_VERSION, "id": request_id, "error": error}


def mine_subtitle_notification(
    fields: dict[str, str], post_mine_action: int
) -> dict[str, Any]:
    return notification(
        "mine-subtitle",
        {"fields": fields, "postMineAction": post_mine_action},
    )


def mine_subtitle_command(
    fields: dict[str, str],
    post_mine_action: int,
    message_id: str | None = None,
) -> dict[str, Any]:
    return {
        "command": "mine-subtitle",
        "messageId": message_id if message_id is not None else str(uuid.uuid4()),
        "body": {"fields": fields, "postMineAction": post_mine_action},
    }


def mine_subtitle_frame(
    fields: dict[str, str],
    post_mine_action: int,
    json_rpc_supported: bool,
) -> dict[str, Any]:
    if json_rpc_supported:
        return mine_subtitle_notification(fields, post_mine_action)

    return mine_subtitle_command(fields, post_mine_action)


def classify_message(message: str) -> IncomingFrame:
    if message == "PING":
        return IncomingFrame("ping")

    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        return IncomingFrame("invalid")

    if not isinstance(data, dict):
        return IncomingFrame("invalid")

    if data.get("jsonrpc") == JSON_RPC_VERSION:
        method = data.get("method")

        if isinstance(method, str):
            if "id" in data and data["id"] is not None:
                return IncomingFrame("json-rpc-request", data)

            return IncomingFrame("json-rpc-notification", data)

        if "id" in data and ("result" in data or "error" in data):
            return IncomingFrame("json-rpc-response", data)

        return IncomingFrame("invalid")

    if data.get("command") == "response":
        return IncomingFrame("legacy-response", data)

    return IncomingFrame("invalid")


@dataclass
class JsonRpcNegotiation:
    supported: bool = False
    probe_id: str | None = None

    def start_probe(self) -> dict[str, Any] | None:
        if self.supported:
            return None

        self.probe_id = str(uuid.uuid4())
        return request(PROBE_METHOD, {}, self.probe_id)

    def handle_frame(self, frame: IncomingFrame) -> bool:
        if self.supported or frame.kind != "json-rpc-response":
            return False

        if self.probe_id is None:
            return False

        if str(frame.payload.get("id")) != self.probe_id:
            return False

        self.supported = True
        self.probe_id = None
        return True

    def handle_timeout(self) -> bool:
        if self.supported or self.probe_id is None:
            return False

        self.probe_id = None
        return True

    def reset(self) -> None:
        self.supported = False
        self.probe_id = None
