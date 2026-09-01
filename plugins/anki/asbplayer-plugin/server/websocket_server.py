# The Qt names below are imported in a try/except and then used under a
# WEBSOCKETS_AVAILABLE guard, and the two AsbplayerWebSocketServer definitions are
# mutually exclusive. The type checker can't correlate either with the import result,
# so both rules are disabled for this file only.
#
# pyright: reportPossiblyUnboundVariable=false, reportRedeclaration=false

from __future__ import annotations

import json


def _log(msg: str) -> None:
    """Print debug message."""
    print(f"[asbplayer-plugin] {msg}")


try:
    from aqt.qt import QObject, pyqtSlot
    from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
    from PyQt6.QtNetwork import QHostAddress

    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False


if WEBSOCKETS_AVAILABLE:

    class AsbplayerWebSocketServer(QObject):
        """WebSocket server for asbplayer communication."""

        def __init__(self, port: int, parent: QObject | None = None):
            super().__init__(parent)
            self._port = port
            self._server: QWebSocketServer | None = None
            self._client: QWebSocket | None = None

        def start(self) -> bool:
            """Start the WebSocket server. Returns True on success."""
            if self._server is not None:
                return True

            self._server = QWebSocketServer(
                "asbplayer-plugin", QWebSocketServer.SslMode.NonSecureMode, self
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

            if self._client is not None:
                self._client.close()
                self._client = None

            self._server.close()
            self._server = None
            _log("WebSocket server stopped")

        def has_clients(self) -> bool:
            """Return True if there is a connected client."""
            return self._client is not None

        def send_message(self, message: dict) -> None:
            """Send a JSON message to the connected client."""
            if self._client is None or not self._client.isValid():
                return

            json_str = json.dumps(message)
            self._client.sendTextMessage(json_str)

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
            client.disconnected.connect(self._on_client_disconnected)

            _log(f"Client connected: {client.peerAddress().toString()}")

        def _on_text_message(self, message: str) -> None:
            """Handle incoming text message from client."""
            if self._client is None:
                return

            if message == "PING":
                self._client.sendTextMessage("PONG")
                return

            try:
                data = json.loads(message)
                if data.get("command") == "response":
                    _log(f"Received response: messageId={data.get('messageId')}")
            except json.JSONDecodeError:
                _log(f"Invalid JSON received: {message[:100]}")

        def _on_client_disconnected(self) -> None:
            """Handle client disconnection."""
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

        def send_message(self, message: dict) -> None:
            pass
