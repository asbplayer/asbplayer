# The Qt names below are imported in a try/except and then used under a
# WEBSOCKETS_AVAILABLE guard, and the two AsbplayerWebSocketServer definitions are
# mutually exclusive. The type checker can't correlate either with the import result,
# so both rules are disabled for this file only.
#
# pyright: reportPossiblyUnboundVariable=false, reportRedeclaration=false

from __future__ import annotations

import json
from pathlib import Path

from .json_rpc import (
    METHOD_NOT_FOUND,
    JsonRpcNegotiation,
    classify_message,
    error_response,
)

ADDON_PACKAGE = json.loads(
    (Path(__file__).resolve().parents[1] / "manifest.json").read_text(encoding="utf-8")
)["package"]


def _log(msg: str) -> None:
    """Print debug message."""
    print(f"[{ADDON_PACKAGE}] {msg}")


try:
    from aqt.qt import QObject, QTimer, pyqtSlot
    from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
    from PyQt6.QtNetwork import QHostAddress

    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False


if WEBSOCKETS_AVAILABLE:

    class AsbplayerWebSocketServer(QObject):
        """WebSocket server for asbplayer communication."""

        PROBE_TIMEOUT_MS = 2000

        def __init__(self, port: int, parent: QObject | None = None):
            super().__init__(parent)
            self._port = port
            self._server: QWebSocketServer | None = None
            self._client: QWebSocket | None = None
            self._negotiation = JsonRpcNegotiation()
            self._probe_client: QWebSocket | None = None
            self._probe_timer: QTimer | None = None

        def start(self) -> bool:
            """Start the WebSocket server. Returns True on success."""
            if self._server is not None:
                return True

            self._server = QWebSocketServer(
                ADDON_PACKAGE, QWebSocketServer.SslMode.NonSecureMode, self
            )

            if not self._server.listen(QHostAddress.SpecialAddress.Any, self._port):
                _log(
                    f"Failed to listen on port {self._port}: {self._server.errorString()}"
                )
                self._server = None
                return False

            self._server.newConnection.connect(self._on_new_connection)
            _log(f"WebSocket server started on port {self._port}")
            return True

        def stop(self) -> None:
            """Stop the WebSocket server and disconnect the client."""
            if self._server is None:
                return

            self._reset_negotiation()

            if self._client is not None:
                self._client.close()
                self._client = None

            self._server.close()
            self._server = None
            _log("WebSocket server stopped")

        def has_clients(self) -> bool:
            """Return True if there is a connected client."""
            return self._client is not None

        @property
        def supports_json_rpc(self) -> bool:
            """Return True once the connected client has proven JSON-RPC support."""
            return self._negotiation.supported

        def send_message(self, message: dict) -> None:
            """Send a JSON message to the connected client."""
            self._send_to(self._client, message)

        def _send_to(self, client: QWebSocket | None, message: dict) -> None:
            if client is None or not client.isValid():
                return

            client.sendTextMessage(json.dumps(message))

        def _start_json_rpc_probe(self, client: QWebSocket) -> None:
            self._cancel_probe()
            self._negotiation.reset()

            probe = self._negotiation.start_probe()

            if probe is None:
                return

            probe_id = self._negotiation.probe_id
            self._probe_client = client
            timer = QTimer(self)
            self._probe_timer = timer
            timer.setSingleShot(True)
            timer.timeout.connect(
                lambda: self._on_probe_timeout(timer, client, probe_id)
            )
            timer.start(self.PROBE_TIMEOUT_MS)
            self._send_to(client, probe)

        def _on_probe_timeout(
            self,
            timer: QTimer,
            client: QWebSocket,
            probe_id: str | None,
        ) -> None:
            timer.deleteLater()

            if self._probe_client is not client:
                return

            if self._negotiation.probe_id != probe_id:
                return

            self._negotiation.handle_timeout()
            self._probe_client = None

            if self._probe_timer is timer:
                self._probe_timer = None

            _log("JSON-RPC probe timed out - using legacy protocol")

        def _cancel_probe(self) -> None:
            if self._probe_timer is not None:
                self._probe_timer.stop()
                self._probe_timer.deleteLater()
                self._probe_timer = None

            self._probe_client = None

        def _reset_negotiation(self) -> None:
            self._cancel_probe()
            self._negotiation.reset()

        @pyqtSlot()
        def _on_new_connection(self) -> None:
            """Handle new client connection, replacing any existing one."""
            if self._server is None:
                return

            client = self._server.nextPendingConnection()
            if client is None:
                return

            if self._client is not None:
                _log("Replacing existing client connection")
                self._client.close()

            self._client = client

            client.textMessageReceived.connect(self._on_text_message)
            client.disconnected.connect(
                lambda: self._on_client_disconnected(client)
            )

            _log(f"Client connected: {client.peerAddress().toString()}")
            self._start_json_rpc_probe(client)

        def _on_text_message(self, message: str) -> None:
            """Handle incoming text message from client."""
            if self._client is None:
                return

            if message == "PING":
                self._client.sendTextMessage("PONG")
                return

            frame = classify_message(message)

            if frame.kind == "json-rpc-request":
                request_id = frame.payload.get("id")
                self._send_to(
                    self._client,
                    error_response(
                        request_id,
                        METHOD_NOT_FOUND,
                        "Method not found",
                    ),
                )
            elif frame.kind == "json-rpc-response":
                if self._negotiation.handle_frame(frame):
                    self._cancel_probe()
                    _log("JSON-RPC supported by connected asbplayer")
                else:
                    _log(
                        f"Received JSON-RPC response: id={frame.payload.get('id')}"
                    )
            elif frame.kind == "legacy-response":
                _log(f"Received response: messageId={frame.payload.get('messageId')}")
            elif frame.kind == "invalid":
                _log(f"Invalid JSON received: {message[:100]}")

        def _on_client_disconnected(self, client: QWebSocket | None = None) -> None:
            """Handle client disconnection."""
            if client is not None and client is not self._client:
                client.deleteLater()
                return

            self._reset_negotiation()

            if self._client is not None:
                self._client.deleteLater()
                self._client = None

            _log("Client disconnected")

else:

    class AsbplayerWebSocketServer:
        """Fallback stub when QtWebSockets is not available."""

        def __init__(self, port: int, parent=None):
            self._port = port
            _log("QtWebSockets not available - WebSocket server disabled")

        def start(self) -> bool:
            return False

        def stop(self) -> None:
            pass

        def has_clients(self) -> bool:
            return False

        @property
        def supports_json_rpc(self) -> bool:
            return False

        def send_message(self, message: dict) -> None:
            pass
