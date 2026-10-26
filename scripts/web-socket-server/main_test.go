package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

type harness struct {
	forwarder forwarder
	server    *httptest.Server
}

func newHarness(t *testing.T, requestTimeout time.Duration, postMineAction int) *harness {
	t.Helper()
	return newHarnessWithAnkiConnect(t, requestTimeout, postMineAction, "")
}

func newHarnessWithAnkiConnect(
	t *testing.T,
	requestTimeout time.Duration,
	postMineAction int,
	ankiConnectURL string,
) *harness {
	t.Helper()
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Logger.SetOutput(io.Discard)
	forwarder := forwarder{
		Mutex:            &sync.Mutex{},
		WebsocketClients: make(map[*wsClient]bool),
		Broker:           newRequestBroker(),
		RequestTimeout:   requestTimeout,
		AnkiConnectUrl:   ankiConnectURL,
		PostMineAction:   postMineAction,
	}
	forwarder.registerRoutes(e)
	server := httptest.NewServer(e)
	t.Cleanup(server.Close)
	return &harness{forwarder: forwarder, server: server}
}

type fakeClient struct {
	conn     *websocket.Conn
	commands chan clientCommand
	jsonRpc  chan json.RawMessage
	pongs    chan struct{}
	writeMux sync.Mutex
}

func (h *harness) connect(t *testing.T) *fakeClient {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(strings.Replace(h.server.URL, "http://", "ws://", 1)+"/ws", nil)

	if err != nil {
		t.Fatalf("could not connect a client: %v", err)
	}

	client := &fakeClient{
		conn:     conn,
		commands: make(chan clientCommand, 64),
		jsonRpc:  make(chan json.RawMessage, 64),
		pongs:    make(chan struct{}, 16),
	}

	go func() {
		for {
			_, message, err := conn.ReadMessage()

			if err != nil {
				close(client.commands)
				close(client.jsonRpc)
				return
			}

			if string(message) == "PONG" {
				client.pongs <- struct{}{}
				continue
			}

			var probe struct {
				Jsonrpc string `json:"jsonrpc"`
			}

			if json.Unmarshal(message, &probe) == nil && probe.Jsonrpc == jsonRpcVersion {
				client.jsonRpc <- append(json.RawMessage(nil), message...)
				continue
			}

			command := clientCommand{}

			if json.Unmarshal(message, &command) == nil {
				client.commands <- command
			}
		}
	}()

	t.Cleanup(func() { conn.Close() })
	return client
}

func (c *fakeClient) nextCommand(t *testing.T) clientCommand {
	t.Helper()

	select {
	case command, ok := <-c.commands:
		if !ok {
			t.Fatal("the connection closed before a command arrived")
		}
		return command
	case <-time.After(3 * time.Second):
		t.Fatal("no command arrived")
		return clientCommand{}
	}
}

func (c *fakeClient) nextJsonRpcRaw(t *testing.T) json.RawMessage {
	t.Helper()

	select {
	case message, ok := <-c.jsonRpc:
		if !ok {
			t.Fatal("the connection closed before a JSON-RPC frame arrived")
		}
		return message
	case <-time.After(3 * time.Second):
		t.Fatal("no JSON-RPC frame arrived")
		return nil
	}
}

func (c *fakeClient) nextJsonRpc(t *testing.T) jsonRpcIncoming {
	t.Helper()
	incoming := jsonRpcIncoming{}

	if err := json.Unmarshal(c.nextJsonRpcRaw(t), &incoming); err != nil {
		t.Fatalf("could not parse the JSON-RPC frame: %v", err)
	}

	return incoming
}

func (c *fakeClient) nextJsonRpcRequest(t *testing.T) jsonRpcOutgoing {
	t.Helper()
	request := jsonRpcOutgoing{}

	if err := json.Unmarshal(c.nextJsonRpcRaw(t), &request); err != nil {
		t.Fatalf("could not parse the JSON-RPC request: %v", err)
	}

	if request.Method == "" {
		t.Fatalf("expected a JSON-RPC request, got %+v", request)
	}

	return request
}

func (c *fakeClient) write(t *testing.T, payload string) {
	t.Helper()
	c.writeMux.Lock()
	defer c.writeMux.Unlock()

	if err := c.conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		t.Fatalf("could not write to the server: %v", err)
	}
}

func (c *fakeClient) respond(t *testing.T, messageId string, body string) {
	t.Helper()
	c.write(t, `{"command":"response","messageId":"`+messageId+`","body":`+body+`}`)
}

func (c *fakeClient) respondJsonRpc(t *testing.T, id string, result string) {
	t.Helper()
	c.write(t, `{"jsonrpc":"2.0","id":"`+id+`","result":`+result+`}`)
}

func (c *fakeClient) respondJsonRpcError(t *testing.T, id string, code int, message string) {
	t.Helper()
	c.write(t, fmt.Sprintf(`{"jsonrpc":"2.0","id":%q,"error":{"code":%d,"message":%q}}`, id, code, message))
}

// announceJsonRpc marks this connection as JSON-RPC-capable without requiring rpc.discover to be
// implemented on the server.
func (c *fakeClient) announceJsonRpc(t *testing.T) {
	t.Helper()
	c.write(t, `{"jsonrpc":"2.0","id":"probe","method":"hello","params":{}}`)

	response := c.nextJsonRpc(t)

	if response.Error == nil || response.Error.Code != jsonRpcMethodNotFound {
		t.Fatalf("expected hello to be rejected with method not found, got %+v", response)
	}
}

func (c *fakeClient) awaitPong(t *testing.T, message string) {
	t.Helper()
	c.write(t, "PING")

	select {
	case <-c.pongs:
	case <-time.After(3 * time.Second):
		t.Fatal(message)
	}
}

func (h *harness) waitForClients(t *testing.T, count int) {
	t.Helper()

	for i := 0; i < 400; i++ {
		if len(h.forwarder.clients()) == count {
			return
		}

		time.Sleep(5 * time.Millisecond)
	}

	t.Fatalf("expected %d connected clients, got %d", count, len(h.forwarder.clients()))
}

type asyncResponse struct {
	status int
	body   string
}

func (h *harness) request(t *testing.T, method string, path string, body string) (int, string) {
	t.Helper()
	request, err := http.NewRequest(method, h.server.URL+path, strings.NewReader(body))

	if err != nil {
		t.Fatalf("could not build the request: %v", err)
	}

	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)

	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	return response.StatusCode, strings.TrimSpace(string(responseBody))
}

func (h *harness) requestAsync(t *testing.T, method string, path string, body string) chan asyncResponse {
	result := make(chan asyncResponse, 1)

	go func() {
		status, responseBody := h.request(t, method, path, body)
		result <- asyncResponse{status: status, body: responseBody}
	}()

	return result
}

func await(t *testing.T, result chan asyncResponse) asyncResponse {
	t.Helper()

	select {
	case response := <-result:
		return response
	case <-time.After(5 * time.Second):
		t.Fatal("the request did not complete")
		return asyncResponse{}
	}
}

func TestConcurrentRequestsAnsweredOutOfOrderEachGetTheirOwnResponse(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	const requestCount = 3
	results := make([]chan asyncResponse, requestCount)

	for i := 0; i < requestCount; i++ {
		results[i] = h.requestAsync(t, http.MethodGet, "/asbplayer/subtitles?mediaId=media-"+strconv.Itoa(i), "")
	}

	commands := make([]clientCommand, requestCount)

	for i := 0; i < requestCount; i++ {
		commands[i] = client.nextCommand(t)
	}

	for i := requestCount - 1; i >= 0; i-- {
		mediaId := commands[i].Body["mediaId"].(string)
		client.respond(t, commands[i].MessageId, `{"subtitles":[{"text":"`+mediaId+`","start":0,"end":1,"track":0}]}`)
	}

	for i := 0; i < requestCount; i++ {
		response := await(t, results[i])
		expected := "media-" + strconv.Itoa(i)

		if response.status != http.StatusOK || !strings.Contains(response.body, `"text":"`+expected+`"`) {
			t.Fatalf("request for %s got %d %s", expected, response.status, response.body)
		}
	}
}

func TestUnmatchedResponseDoesNotStallTheSocketReader(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	client.awaitPong(t, "no PONG before an unmatched response")
	client.respond(t, "never-requested", `{}`)
	client.write(t, `{"not":"a response"}`)
	client.awaitPong(t, "no PONG after an unmatched response")

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	command := client.nextCommand(t)
	client.respond(t, command.MessageId, `{"media":[]}`)

	if response := await(t, result); response.status != http.StatusOK || response.body != `{"media":[]}` {
		t.Fatalf("expected the request to succeed, got %d %s", response.status, response.body)
	}
}

func TestDuplicateAndLateResponsesAreIgnored(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	command := client.nextCommand(t)
	client.respond(t, command.MessageId, `{"media":[{"id":"first"}]}`)
	client.respond(t, command.MessageId, `{"media":[{"id":"duplicate"}]}`)

	if response := await(t, result); response.body != `{"media":[{"id":"first"}]}` {
		t.Fatalf("expected the first response to win, got %s", response.body)
	}

	client.respond(t, command.MessageId, `{"media":[{"id":"late"}]}`)
	next := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	nextCommand := client.nextCommand(t)
	client.respond(t, nextCommand.MessageId, `{"media":[{"id":"second"}]}`)

	if response := await(t, next); response.body != `{"media":[{"id":"second"}]}` {
		t.Fatalf("expected the connection to stay usable, got %s", response.body)
	}

	if h.forwarder.Broker.pendingCount() != 0 {
		t.Fatalf("expected no pending requests, got %d", h.forwarder.Broker.pendingCount())
	}
}

func TestFirstBroadcastResponseWins(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	responding := h.connect(t)
	late := h.connect(t)
	h.waitForClients(t, 2)

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	respondingCommand := responding.nextCommand(t)
	lateCommand := late.nextCommand(t)

	if respondingCommand.MessageId != lateCommand.MessageId {
		t.Fatal("expected both clients to receive the same broadcast")
	}

	responding.respond(t, respondingCommand.MessageId, `{"media":[{"id":"responding"}]}`)
	response := await(t, result)

	if response.status != http.StatusOK || response.body != `{"media":[{"id":"responding"}]}` {
		t.Fatalf("expected the answering client to settle the request, got %d %s", response.status, response.body)
	}

	late.respond(t, lateCommand.MessageId, `{"media":[{"id":"late"}]}`)

	next := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	nextCommand := late.nextCommand(t)
	responding.nextCommand(t)
	late.respond(t, nextCommand.MessageId, `{"media":[{"id":"next"}]}`)

	if response := await(t, next); response.body != `{"media":[{"id":"next"}]}` {
		t.Fatalf("expected the late response to be ignored, got %s", response.body)
	}

	if h.forwarder.Broker.pendingCount() != 0 {
		t.Fatalf("expected no pending requests, got %d", h.forwarder.Broker.pendingCount())
	}
}

func TestTimeoutCleansUpPendingState(t *testing.T) {
	h := newHarness(t, 150*time.Millisecond, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	if status, _ := h.request(t, http.MethodGet, "/asbplayer/bound-media", ""); status != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 on timeout, got %d", status)
	}

	client.nextCommand(t)

	if h.forwarder.Broker.pendingCount() != 0 {
		t.Fatalf("expected no pending requests after a timeout, got %d", h.forwarder.Broker.pendingCount())
	}

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	command := client.nextCommand(t)
	client.respond(t, command.MessageId, `{"media":[]}`)

	if response := await(t, result); response.status != http.StatusOK {
		t.Fatalf("expected the connection to stay usable, got %d", response.status)
	}
}

func TestRequestFailsWithNoConnectedClients(t *testing.T) {
	h := newHarness(t, 30*time.Second, 0)
	response := await(t, h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", ""))

	if response.status != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 with no clients connected, got %d", response.status)
	}
}

func TestConcurrentWritesToOneClientAreSerialized(t *testing.T) {
	h := newHarness(t, 5*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	const requestCount = 25
	results := make([]chan asyncResponse, requestCount)

	for i := 0; i < requestCount; i++ {
		results[i] = h.requestAsync(t, http.MethodPost, "/asbplayer/seek", `{"timestamp":`+strconv.Itoa(i)+`}`)
	}

	seen := map[string]bool{}

	for i := 0; i < requestCount; i++ {
		command := client.nextCommand(t)

		if command.Command != "seek-timestamp" || seen[command.MessageId] {
			t.Fatalf("unexpected command %s with id %s", command.Command, command.MessageId)
		}

		seen[command.MessageId] = true
		client.respond(t, command.MessageId, `{}`)
	}

	for i := 0; i < requestCount; i++ {
		if response := await(t, results[i]); response.status != http.StatusOK {
			t.Fatalf("request %d returned %d", i, response.status)
		}
	}
}

func TestCommandShapesAndResponses(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)

	exchange := func(method string, path string, requestBody string, responseBody string) (clientCommand, asyncResponse) {
		result := h.requestAsync(t, method, path, requestBody)
		command := client.nextCommand(t)
		client.respond(t, command.MessageId, responseBody)
		return command, await(t, result)
	}

	command, response := exchange(http.MethodPost, "/asbplayer/load-subtitles",
		`{"files":[{"name":"a.srt","base64":"AAA"}]}`, `{}`)
	file := command.Body["files"].([]interface{})[0].(map[string]interface{})

	if command.Command != "load-subtitles" || file["name"] != "a.srt" || file["base64"] != "AAA" {
		t.Fatalf("unexpected load-subtitles command: %v", command.Body)
	}

	if response.status != http.StatusOK || response.body != "" {
		t.Fatalf("expected an empty 200, got %d %q", response.status, response.body)
	}

	if _, hasMediaId := command.Body["mediaId"]; hasMediaId {
		t.Fatalf("expected no mediaId when none was given: %v", command.Body)
	}

	command, _ = exchange(http.MethodPost, "/asbplayer/load-subtitles",
		`{"files":[{"name":"a.srt","base64":"AAA"}],"mediaId":"abc"}`, `{}`)

	if command.Command != "load-subtitles" || command.Body["mediaId"] != "abc" {
		t.Fatalf("unexpected targeted load-subtitles command: %v", command.Body)
	}

	command, response = exchange(http.MethodPost, "/asbplayer/seek", `{"timestamp":12.5,"mediaId":"abc"}`, `{}`)

	if command.Command != "seek-timestamp" || command.Body["timestamp"] != 12.5 || command.Body["mediaId"] != "abc" {
		t.Fatalf("unexpected seek-timestamp command: %v", command.Body)
	}

	if response.status != http.StatusOK || response.body != "" {
		t.Fatalf("expected an empty 200, got %d %q", response.status, response.body)
	}

	command, _ = exchange(http.MethodPost, "/asbplayer/seek", `{"timestamp":1}`, `{}`)

	if _, present := command.Body["mediaId"]; present {
		t.Fatalf("expected no mediaId in the body, got %v", command.Body)
	}

	boundMedia := `{"media":[{"id":"abc","type":"streaming","loadedSubtitles":[],"active":true}]}`
	command, response = exchange(http.MethodGet, "/asbplayer/bound-media", "", boundMedia)

	if command.Command != "get-bound-media" || len(command.Body) != 0 {
		t.Fatalf("unexpected get-bound-media command: %v", command.Body)
	}

	if response.status != http.StatusOK || response.body != boundMedia {
		t.Fatalf("expected the client body verbatim, got %d %s", response.status, response.body)
	}

	subtitles := `{"subtitles":[{"text":"ねこ","start":0,"end":1000,"track":1}]}`
	command, response = exchange(http.MethodGet, "/asbplayer/subtitles?mediaId=abc&trackNumbers=1,%202", "", subtitles)
	trackNumbers := command.Body["trackNumbers"].([]interface{})

	if command.Command != "get-subtitles" || command.Body["mediaId"] != "abc" {
		t.Fatalf("unexpected get-subtitles command: %v", command.Body)
	}

	if len(trackNumbers) != 2 || trackNumbers[0] != float64(1) || trackNumbers[1] != float64(2) {
		t.Fatalf("unexpected track numbers: %v", trackNumbers)
	}

	if response.status != http.StatusOK || response.body != subtitles {
		t.Fatalf("expected the client body verbatim, got %d %s", response.status, response.body)
	}

	command, _ = exchange(http.MethodGet, "/asbplayer/subtitles", "", `{"subtitles":[]}`)

	if len(command.Body) != 0 {
		t.Fatalf("expected an empty body, got %v", command.Body)
	}
}

func TestJsonRpcRequestsAndResponses(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)
	client.announceJsonRpc(t)

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	request := client.nextJsonRpcRequest(t)

	if request.Jsonrpc != jsonRpcVersion || request.Method != "get-bound-media" || request.Id == "" {
		t.Fatalf("unexpected JSON-RPC request: %+v", request)
	}

	client.respondJsonRpc(t, request.Id, `{"media":[{"id":"abc"}]}`)

	if response := await(t, result); response.status != http.StatusOK || response.body != `{"media":[{"id":"abc"}]}` {
		t.Fatalf("expected the JSON-RPC result, got %d %s", response.status, response.body)
	}

	if h.forwarder.Broker.pendingCount() != 0 {
		t.Fatalf("expected no pending requests, got %d", h.forwarder.Broker.pendingCount())
	}
}

func TestJsonRpcErrorRoutesToHttpStatus(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	client := h.connect(t)
	h.waitForClients(t, 1)
	client.announceJsonRpc(t)

	result := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	request := client.nextJsonRpcRequest(t)
	client.respondJsonRpcError(t, request.Id, jsonRpcInternalError, "handler failed")

	if response := await(t, result); response.status != http.StatusInternalServerError {
		t.Fatalf("expected 500 for an internal JSON-RPC error, got %d", response.status)
	}
}

func TestMixedLegacyAndJsonRpcClients(t *testing.T) {
	h := newHarness(t, 2*time.Second, 0)
	jsonRpcClient := h.connect(t)
	legacyClient := h.connect(t)
	h.waitForClients(t, 2)
	jsonRpcClient.announceJsonRpc(t)

	first := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	jsonRpcRequest := jsonRpcClient.nextJsonRpcRequest(t)
	legacyCommand := legacyClient.nextCommand(t)

	if jsonRpcRequest.Id != legacyCommand.MessageId {
		t.Fatalf("expected the same correlation id, got %s and %s", jsonRpcRequest.Id, legacyCommand.MessageId)
	}

	jsonRpcClient.respondJsonRpc(t, jsonRpcRequest.Id, `{"media":[{"id":"json-rpc"}]}`)

	if response := await(t, first); response.status != http.StatusOK || !strings.Contains(response.body, "json-rpc") {
		t.Fatalf("expected the JSON-RPC response to settle the request, got %d %s", response.status, response.body)
	}

	second := h.requestAsync(t, http.MethodGet, "/asbplayer/bound-media", "")
	legacyCommand = legacyClient.nextCommand(t)
	jsonRpcClient.nextJsonRpcRequest(t)
	legacyClient.respond(t, legacyCommand.MessageId, `{"media":[{"id":"legacy"}]}`)

	if response := await(t, second); response.status != http.StatusOK || !strings.Contains(response.body, "legacy") {
		t.Fatalf("expected the legacy response to settle the request, got %d %s", response.status, response.body)
	}
}

func TestJsonRpcNotificationHasNoId(t *testing.T) {
	ankiConnect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"result":42}`))
	}))
	t.Cleanup(ankiConnect.Close)

	h := newHarnessWithAnkiConnect(t, 2*time.Second, 2, ankiConnect.URL)
	client := h.connect(t)
	h.waitForClients(t, 1)
	client.announceJsonRpc(t)

	status, _ := h.request(t, http.MethodPost, "/",
		`{"action":"addNote","params":{"note":{"fields":{"Word":"ねこ"}}}}`)

	if status != http.StatusOK {
		t.Fatalf("expected the intercepted addNote to succeed, got %d", status)
	}

	notification := client.nextJsonRpc(t)

	if notification.Jsonrpc != jsonRpcVersion || notification.Method != "mine-subtitle" {
		t.Fatalf("unexpected JSON-RPC notification: %+v", notification)
	}

	if len(notification.Id) != 0 {
		t.Fatalf("expected a notification without an id, got %s", notification.Id)
	}
}

func TestMineSubtitleReportsPublished(t *testing.T) {
	h := newHarness(t, 2*time.Second, 1)
	client := h.connect(t)
	h.waitForClients(t, 1)

	result := h.requestAsync(t, http.MethodPost, "/", `{"action":"addNote","params":{"note":{"fields":{"Word":"ねこ"}}}}`)
	command := client.nextCommand(t)
	fields := command.Body["fields"].(map[string]interface{})

	if command.Command != "mine-subtitle" || fields["Word"] != "ねこ" || command.Body["postMineAction"] != float64(1) {
		t.Fatalf("unexpected mine-subtitle command: %v", command.Body)
	}

	client.respond(t, command.MessageId, `{"published":true}`)

	if response := await(t, result); response.status != http.StatusOK || response.body != "-1" {
		t.Fatalf("expected a 200 with -1, got %d %s", response.status, response.body)
	}
}

func TestCancelDoesNotDiscardADeliveredResponse(t *testing.T) {
	broker := newRequestBroker()
	request := broker.register("m")

	broker.deliver(clientResponse{Command: "response", MessageId: "m", Body: json.RawMessage(`{"n":1}`)})
	broker.cancel("m", request)

	received, ok := <-request.result

	if !ok || string(received.Body) != `{"n":1}` {
		t.Fatalf("expected the delivered response, got %q %v", string(received.Body), ok)
	}

	if broker.pendingCount() != 0 {
		t.Fatalf("expected no pending requests, got %d", broker.pendingCount())
	}
}
