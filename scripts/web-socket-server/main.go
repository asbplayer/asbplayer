package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	_ "github.com/joho/godotenv/autoload"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	jsonRpcVersion        = "2.0"
	jsonRpcProtocol       = "jsonrpc-2.0"
	jsonRpcParseError     = -32700
	jsonRpcInvalidRequest = -32600
	jsonRpcMethodNotFound = -32601
	jsonRpcInvalidParams  = -32602
	jsonRpcInternalError  = -32603
	jsonRpcRequestTimeout = -32000
	jsonRpcNoClients      = -32001
	jsonRpcNotApproved    = -32002
)

// gorilla/websocket allows only one concurrent writer per connection, so each client
// serializes its writes (PONG replies and published commands) behind a mutex.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type (
	wsClient struct {
		conn           *websocket.Conn
		writeMux       sync.Mutex
		jsonRpcCapable atomic.Bool
	}
	forwarder struct {
		WebsocketClients map[*wsClient]bool
		Broker           *requestBroker
		Mutex            *sync.Mutex
		RequestTimeout   time.Duration
		AnkiConnectUrl   string
		PostMineAction   int
		InterceptField   string
		InterceptValue   string
	}
	ankiConnectRequest struct {
		Action string                 `json:"action"`
		Params map[string]interface{} `json:"params"`
	}
	subtitleFile struct {
		Name   string `json:"name"`
		Base64 string `json:"base64"`
	}
	asbplayerLoadSubtitlesRequest struct {
		Files   []subtitleFile `json:"files,omitempty"`
		MediaId string         `json:"mediaId,omitempty"`
	}
	asbplayerMineSubtitleRequest struct {
		Fields          map[string]string `json:"fields"`
		PostMineAction  int               `json:"postMineAction"`
		MediaId         *string           `json:"mediaId,omitempty"`
		NoteId          *int64            `json:"noteId,omitempty"`
		AsbplayerCardId *string           `json:"asbplayerCardId,omitempty"`
	}
	asbplayerSeekRequest struct {
		Timestamp float64 `json:"timestamp"`
		MediaId   string  `json:"mediaId,omitempty"`
	}
	clientCommand struct {
		Command   string `json:"command"`
		MessageId string `json:"messageId"`
		Body      any    `json:"body"`
	}
	clientResponse struct {
		Command   string          `json:"command"`
		MessageId string          `json:"messageId"`
		Body      json.RawMessage `json:"body"`
		Error     *rpcError       `json:"-"`
	}
	rpcError struct {
		Code    int         `json:"code"`
		Message string      `json:"message"`
		Data    interface{} `json:"data,omitempty"`
	}
	jsonRpcOutgoing struct {
		Jsonrpc string `json:"jsonrpc"`
		Method  string `json:"method"`
		Params  any    `json:"params"`
		Id      string `json:"id,omitempty"`
	}
	jsonRpcIncoming struct {
		Jsonrpc string          `json:"jsonrpc"`
		Method  string          `json:"method"`
		Id      json.RawMessage `json:"id"`
		Params  json.RawMessage `json:"params"`
		Result  json.RawMessage `json:"result"`
		Error   *rpcError       `json:"error"`
	}
	jsonRpcErrorResponse struct {
		Jsonrpc string      `json:"jsonrpc"`
		Id      interface{} `json:"id"`
		Error   *rpcError   `json:"error"`
	}
	clientInfoResult struct {
		Protocols []string `json:"protocols"`
	}
	mineSubtitleResponseBody struct {
		Published bool `json:"published"`
	}
)

func (rpcError *rpcError) Error() string {
	return fmt.Sprintf("%s (%d)", rpcError.Message, rpcError.Code)
}

func getenv(key string, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func (client *wsClient) send(messageType int, data []byte) error {
	client.writeMux.Lock()
	defer client.writeMux.Unlock()
	return client.conn.WriteMessage(messageType, data)
}

func (forwarder forwarder) addClient(client *wsClient) {
	forwarder.Mutex.Lock()
	defer forwarder.Mutex.Unlock()
	forwarder.WebsocketClients[client] = true
	fmt.Printf("Client connected: %s\n", client.conn.RemoteAddr())
}

func (forwarder forwarder) removeClient(client *wsClient) {
	forwarder.Mutex.Lock()
	defer forwarder.Mutex.Unlock()
	delete(forwarder.WebsocketClients, client)
	fmt.Printf("Client disconnected: %s\n", client.conn.RemoteAddr())
}

func (forwarder forwarder) clients() []*wsClient {
	forwarder.Mutex.Lock()
	defer forwarder.Mutex.Unlock()
	clients := make([]*wsClient, 0, len(forwarder.WebsocketClients))

	for client := range forwarder.WebsocketClients {
		clients = append(clients, client)
	}

	return clients
}

func (forwarder forwarder) handleWebsocketClient(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		c.Logger().Error(err)
		return err
	}

	client := &wsClient{conn: conn}
	defer conn.Close()
	defer forwarder.removeClient(client)
	forwarder.addClient(client)
	go forwarder.probeJsonRpcSupport(client)

	for {
		_, msg, err := conn.ReadMessage()

		if err != nil {
			c.Logger().Error(err)
			break
		}

		if string(msg) == "PING" {
			client.send(websocket.TextMessage, []byte("PONG"))
			continue
		}

		forwarder.handleFrame(client, msg)
	}

	return nil
}

// Asks the client for its protocol capabilities. A client that ignores the probe keeps receiving
// legacy frames.
func (forwarder forwarder) probeJsonRpcSupport(client *wsClient) {
	probeId := uuid.NewString()
	probe, err := json.Marshal(jsonRpcOutgoing{
		Jsonrpc: jsonRpcVersion,
		Method:  "client-info",
		Params:  map[string]interface{}{},
		Id:      probeId,
	})

	if err != nil {
		return
	}

	request := forwarder.Broker.register(probeId)

	if err := client.send(websocket.TextMessage, probe); err != nil {
		forwarder.Broker.cancel(probeId, request)
		return
	}

	select {
	case response, ok := <-request.result:
		if !ok || response.Error != nil {
			return
		}

		result := clientInfoResult{}

		if json.Unmarshal(response.Body, &result) != nil {
			return
		}

		for _, protocol := range result.Protocols {
			if protocol == jsonRpcProtocol {
				client.jsonRpcCapable.Store(true)
				return
			}
		}
	case <-time.After(forwarder.RequestTimeout):
		forwarder.Broker.cancel(probeId, request)
	}
}

// Routes a frame by its envelope: JSON-RPC frames are validated and dispatched, everything else
// is a legacy response.
func (forwarder forwarder) handleFrame(client *wsClient, msg []byte) {
	if !json.Valid(msg) {
		if client.jsonRpcCapable.Load() {
			forwarder.sendJsonRpcError(client, nil, &rpcError{Code: jsonRpcParseError, Message: "Parse error"})
		}

		return
	}

	var object map[string]json.RawMessage

	if err := json.Unmarshal(msg, &object); err != nil {
		// Valid JSON but not an object: neither a JSON-RPC frame nor a legacy response.
		if client.jsonRpcCapable.Load() {
			forwarder.sendJsonRpcError(client, nil, &rpcError{Code: jsonRpcInvalidRequest, Message: "Invalid request"})
		}

		return
	}

	var version string

	if err := json.Unmarshal(object["jsonrpc"], &version); err == nil && version == jsonRpcVersion {
		forwarder.handleJsonRpcFrame(client, msg)
		return
	}

	response := clientResponse{}
	if err := json.Unmarshal(msg, &response); err == nil {
		forwarder.Broker.deliver(response)
	}
}

func (forwarder forwarder) handleJsonRpcFrame(client *wsClient, msg []byte) {
	incoming := jsonRpcIncoming{}

	if err := json.Unmarshal(msg, &incoming); err != nil || incoming.Jsonrpc != jsonRpcVersion {
		forwarder.sendJsonRpcError(client, nil, &rpcError{Code: jsonRpcInvalidRequest, Message: "Invalid request"})
		return
	}

	if incoming.Method != "" {
		id, ok := stringJsonRpcId(incoming.Id)

		if !ok && len(incoming.Id) > 0 {
			// A non-string id cannot be echoed, so answer -32600 with a null id.
			forwarder.sendJsonRpcError(client, nil, &rpcError{Code: jsonRpcInvalidRequest, Message: "Invalid request"})
			return
		}

		if !ok {
			// No id: a notification, which must never be answered.
			return
		}

		forwarder.sendJsonRpcError(client, id, &rpcError{
			Code:    jsonRpcMethodNotFound,
			Message: "Method not found",
		})
		return
	}

	id, ok := stringJsonRpcId(incoming.Id)

	if !ok {
		return
	}

	var response clientResponse

	switch {
	case incoming.Error != nil:
		response = clientResponse{MessageId: id, Error: incoming.Error}
	case incoming.Result != nil:
		response = clientResponse{MessageId: id, Body: incoming.Result}
	default:
		forwarder.sendJsonRpcError(client, id, &rpcError{Code: jsonRpcInvalidRequest, Message: "Invalid request"})
		return
	}

	forwarder.Broker.deliver(response)
}

func stringJsonRpcId(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}

	id := ""

	if err := json.Unmarshal(raw, &id); err != nil {
		return "", false
	}

	return id, true
}

func (forwarder forwarder) sendJsonRpcError(client *wsClient, id interface{}, rpcError *rpcError) {
	response, err := json.Marshal(jsonRpcErrorResponse{Jsonrpc: jsonRpcVersion, Id: id, Error: rpcError})

	if err != nil {
		return
	}

	client.send(websocket.TextMessage, response)
}

func (forwarder forwarder) encodeCommand(client *wsClient, command clientCommand, notification bool) ([]byte, error) {
	if !client.jsonRpcCapable.Load() {
		return json.Marshal(command)
	}

	params := command.Body

	if params == nil {
		params = map[string]interface{}{}
	}

	frame := jsonRpcOutgoing{
		Jsonrpc: jsonRpcVersion,
		Method:  command.Command,
		Params:  params,
	}

	if !notification {
		frame.Id = command.MessageId
	}

	return json.Marshal(frame)
}

func (forwarder forwarder) publishCommand(command clientCommand, notification bool) (bool, error) {
	var errs []error
	var sentAtLeastOnce bool

	for _, client := range forwarder.clients() {
		bytes, err := forwarder.encodeCommand(client, command, notification)

		if err != nil {
			errs = append(errs, err)
			continue
		}

		err = client.send(websocket.TextMessage, bytes)
		if err == nil {
			sentAtLeastOnce = true
		} else {
			errs = append(errs, err)
		}
	}

	if len(errs) == 0 {
		return sentAtLeastOnce, nil
	}

	return sentAtLeastOnce, errors.Join(errs...)
}

func (forwarder forwarder) publishMessage(command clientCommand) (bool, error) {
	return forwarder.publishCommand(command, false)
}

func (forwarder forwarder) publishNotification(command clientCommand) (bool, error) {
	return forwarder.publishCommand(command, true)
}

func (forwarder forwarder) publishMessageAndAwaitResponse(command clientCommand) (clientResponse, *rpcError) {
	if len(forwarder.clients()) == 0 {
		return clientResponse{}, &rpcError{Code: jsonRpcNoClients, Message: "No connected asbplayers"}
	}

	request := forwarder.Broker.register(command.MessageId)

	if sent, err := forwarder.publishMessage(command); !sent {
		forwarder.Broker.cancel(command.MessageId, request)
		if err != nil {
			return clientResponse{}, &rpcError{Code: jsonRpcInternalError, Message: "Internal error", Data: err.Error()}
		}
		return clientResponse{}, &rpcError{Code: jsonRpcNoClients, Message: "No clients", Data: err.Error()}
	}

	select {
	case response, ok := <-request.result:
		if !ok {
			return clientResponse{}, &rpcError{Code: jsonRpcRequestTimeout, Message: "Request timeout"}
		}

		return response, response.Error
	case <-time.After(forwarder.RequestTimeout):
		forwarder.Broker.cancel(command.MessageId, request)
		// A response may have landed just as the timeout fired.
		response, ok := <-request.result

		if !ok {
			return clientResponse{}, &rpcError{Code: jsonRpcRequestTimeout, Message: "Request timeout"}
		}

		return response, response.Error
	}
}

func httpStatusForRpcError(rpcError *rpcError) int {
	switch rpcError.Code {
	case jsonRpcNoClients, jsonRpcRequestTimeout:
		return http.StatusServiceUnavailable
	case jsonRpcInvalidRequest, jsonRpcParseError, jsonRpcInvalidParams:
		return http.StatusBadRequest
	case jsonRpcMethodNotFound:
		return http.StatusNotImplemented
	case jsonRpcNotApproved:
		return http.StatusForbidden
	default:
		return http.StatusInternalServerError
	}
}

func (forwarder forwarder) forwardToAnkiConnect(buf *bytes.Buffer, c echo.Context, method string) ([]byte, error) {
	ankiConnectRequest, err := http.NewRequest(method, forwarder.AnkiConnectUrl, buf)

	for key, values := range c.Request().Header {
		ankiConnectRequest.Header[key] = values
	}

	if err != nil {
		return nil, err
	}

	ankiConnectResponse, err := http.DefaultClient.Do(ankiConnectRequest)

	if err != nil {
		return nil, err
	}

	ankiConnectResponseBuf := new(bytes.Buffer)
	ankiConnectResponseBuf.ReadFrom(ankiConnectResponse.Body)

	for header, values := range ankiConnectResponse.Header {
		for _, value := range values {
			c.Response().Header().Add(header, value)
		}
	}

	c.Blob(ankiConnectResponse.StatusCode, ankiConnectResponse.Header["Content-Type"][0], ankiConnectResponseBuf.Bytes())
	return ankiConnectResponseBuf.Bytes(), nil
}

func extractNoteIdFromAnkiConnectResponse(response []byte) (int64, bool) {
	parsed := struct {
		Result *int64 `json:"result"`
	}{}

	if err := json.Unmarshal(response, &parsed); err != nil || parsed.Result == nil {
		return 0, false
	}

	return *parsed.Result, true
}

func (forwarder forwarder) handleGetRequest(c echo.Context) error {
	ankiConnectResponse, err := http.Get(fmt.Sprintf("%s/%s", forwarder.AnkiConnectUrl, c.Path()))

	if err != nil {
		c.Logger().Error(err)
		c.JSON(http.StatusInternalServerError, nil)
	} else {
		ankiConnectResponseBuf := new(bytes.Buffer)
		ankiConnectResponseBuf.ReadFrom(ankiConnectResponse.Body)
		c.Blob(ankiConnectResponse.StatusCode, ankiConnectResponse.Header["Content-Type"][0], ankiConnectResponseBuf.Bytes())
	}

	return nil
}

func (forwarder forwarder) handlePostRequest(c echo.Context) error {
	buf := new(bytes.Buffer)
	buf.ReadFrom(c.Request().Body)
	request := ankiConnectRequest{}
	err := json.Unmarshal(buf.Bytes(), &request)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err)
	}

	c.Set("ankiConnectAction", request.Action)

	if request.Action != "addNote" || len(forwarder.clients()) == 0 || !shouldInterceptAddNote(request, forwarder.InterceptField, forwarder.InterceptValue) {
		_, err := forwarder.forwardToAnkiConnect(buf, c, "POST")
		return err
	}

	body := map[string]interface{}{
		"fields":         request.Params["note"].(map[string]interface{})["fields"],
		"postMineAction": forwarder.PostMineAction,
	}
	command := clientCommand{Command: "mine-subtitle", MessageId: uuid.NewString(), Body: body}

	if forwarder.PostMineAction == 2 {
		ankiConnectResponse, responseErr := forwarder.forwardToAnkiConnect(buf, c, "POST")

		if responseErr == nil {
			if noteId, ok := extractNoteIdFromAnkiConnectResponse(ankiConnectResponse); ok {
				body["noteId"] = noteId
			}
		}

		sent, err := forwarder.publishNotification(command)

		if err != nil {
			if sent {
				c.Logger().Warn("Command was published to asbplayer but errors were encountered", err)
			} else {
				c.Logger().Error("Failed to publish command to asbplayer", err)
			}
		}

		return responseErr
	}

	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)

	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), nil)
	}

	mineSubtitleResponseBody := mineSubtitleResponseBody{}
	err = json.Unmarshal(response.Body, &mineSubtitleResponseBody)

	if err != nil || !mineSubtitleResponseBody.Published {
		_, err := forwarder.forwardToAnkiConnect(buf, c, "POST")
		return err
	}

	c.JSON(http.StatusOK, -1)

	return nil
}

func shouldInterceptAddNote(request ankiConnectRequest, fieldName string, fieldValue string) bool {
	if fieldName == "" || fieldValue == "" {
		return true
	}

	params, ok := request.Params["note"].(map[string]interface{})
	if !ok {
		return false
	}

	fields, ok := params["fields"].(map[string]interface{})
	if !ok {
		return false
	}

	miscInfo, ok := fields[fieldName].(string)
	if !ok {
		return false
	}

	return miscInfo == fieldValue
}

func (forwarder forwarder) handleOptionsRequest(c echo.Context) error {
	_, err := forwarder.forwardToAnkiConnect(new(bytes.Buffer), c, "OPTIONS")
	return err
}

func (forwarder forwarder) handleAsbplayerLoadSubtitlesRequest(c echo.Context) error {
	buf := new(bytes.Buffer)
	buf.ReadFrom(c.Request().Body)
	request := asbplayerLoadSubtitlesRequest{}
	err := json.Unmarshal(buf.Bytes(), &request)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err)
	}

	command := clientCommand{Command: "load-subtitles", MessageId: uuid.NewString(), Body: request}
	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)
	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), rpcError.Message)
	}

	c.JSONBlob(http.StatusOK, response.Body)
	return nil
}

func (forwarder forwarder) handleAsbplayerMineSubtitleRequest(c echo.Context) error {
	buf := new(bytes.Buffer)
	buf.ReadFrom(c.Request().Body)
	request := asbplayerMineSubtitleRequest{}
	err := json.Unmarshal(buf.Bytes(), &request)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err)
	}

	command := clientCommand{Command: "mine-subtitle", MessageId: uuid.NewString(), Body: request}
	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)
	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), rpcError.Message)
	}

	c.JSONBlob(http.StatusOK, response.Body)
	return nil
}

func (forwarder forwarder) handleAsbplayerSeekRequest(c echo.Context) error {
	buf := new(bytes.Buffer)
	buf.ReadFrom(c.Request().Body)
	request := asbplayerSeekRequest{}
	err := json.Unmarshal(buf.Bytes(), &request)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err)
	}

	body := map[string]interface{}{
		"timestamp": request.Timestamp,
	}

	if request.MediaId != "" {
		body["mediaId"] = request.MediaId
	}

	command := clientCommand{Command: "seek-timestamp", MessageId: uuid.NewString(), Body: body}
	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)
	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), rpcError.Message)
	}

	c.JSONBlob(http.StatusOK, response.Body)
	return nil
}

func (forwarder forwarder) handleAsbplayerBoundMediaRequest(c echo.Context) error {
	command := clientCommand{Command: "get-bound-media", MessageId: uuid.NewString(), Body: map[string]interface{}{}}
	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)
	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), rpcError.Message)
	}

	return c.JSONBlob(http.StatusOK, response.Body)
}

func (forwarder forwarder) handleAsbplayerSubtitlesRequest(c echo.Context) error {
	body := map[string]interface{}{}
	if mediaId := c.QueryParam("mediaId"); mediaId != "" {
		body["mediaId"] = mediaId
	}
	if trackNumbers := c.QueryParam("trackNumbers"); trackNumbers != "" {
		parsed := []int{}
		for _, trackNumber := range strings.Split(trackNumbers, ",") {
			if n, err := strconv.Atoi(strings.TrimSpace(trackNumber)); err == nil {
				parsed = append(parsed, n)
			}
		}
		if len(parsed) > 0 {
			body["trackNumbers"] = parsed
		}
	}
	command := clientCommand{Command: "get-subtitles", MessageId: uuid.NewString(), Body: body}
	response, rpcError := forwarder.publishMessageAndAwaitResponse(command)
	if rpcError != nil {
		return echo.NewHTTPError(httpStatusForRpcError(rpcError), rpcError.Message)
	}

	return c.JSONBlob(http.StatusOK, response.Body)
}

func (forwarder forwarder) registerRoutes(e *echo.Echo) {
	e.GET(defaultWebSocketPath, forwarder.handleWebsocketClient)
	e.POST("/disconnect-ws-clients", forwarder.disconnectWebsocketClients)
	e.GET("/", forwarder.handleGetRequest)
	e.POST("/", forwarder.handlePostRequest)
	e.POST("/asbplayer/load-subtitles", forwarder.handleAsbplayerLoadSubtitlesRequest)
	e.POST("/asbplayer/mine-subtitle", forwarder.handleAsbplayerMineSubtitleRequest)
	e.POST("/asbplayer/seek", forwarder.handleAsbplayerSeekRequest)
	e.GET("/asbplayer/bound-media", forwarder.handleAsbplayerBoundMediaRequest)
	e.GET("/asbplayer/subtitles", forwarder.handleAsbplayerSubtitlesRequest)
	e.OPTIONS("/", forwarder.handleOptionsRequest)
}

func (forwarder forwarder) disconnectWebsocketClients(c echo.Context) error {
	forwarder.Mutex.Lock()
	defer forwarder.Mutex.Unlock()
	for client := range forwarder.WebsocketClients {
		client.conn.Close()
		delete(forwarder.WebsocketClients, client)
		fmt.Printf("Forcefully disconnected client: %s\n", client.conn.RemoteAddr())
	}
	return nil
}

func main() {
	port := getenv("PORT", defaultWebSocketPort)
	ankiConnectUrl := getenv("ANKI_CONNECT_URL", defaultAnkiConnectURL)
	postMineAction, _ := strconv.Atoi(getenv("POST_MINE_ACTION", defaultPostMineAction))
	interceptField := getenv("INTERCEPT_FIELD", "")
	interceptValue := getenv("INTERCEPT_VALUE", "")
	fmt.Printf("Started with config:\n\n\tPORT=%v\n\tANKI_CONNECT_URL=%v\n\tPOST_MINE_ACTION=%v\n\tINTERCEPT_FIELD=%v\n\tINTERCEPT_VALUE=%v\n",
		port, ankiConnectUrl, postMineAction, interceptField, interceptValue)

	e := echo.New()
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:        true,
		LogMethod:        true,
		LogUserAgent:     true,
		LogContentLength: true,
		LogResponseSize:  true,
		LogURI:           true,
		LogLatency:       true,
		LogRemoteIP:      true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			buf := new(bytes.Buffer)
			buf.ReadFrom(c.Request().Body)
			request := ankiConnectRequest{}
			json.Unmarshal(buf.Bytes(), &request)
			fmt.Printf("REQUEST: ankiConnectAction=%v status=%v method=%v uri=%v content_length=%v response_size=%v latency=%v remote_ip=%v user_agent=\"%v\"\n",
				c.Get("ankiConnectAction"), v.Status, v.Method, v.URI, v.ContentLength, v.ResponseSize, v.Latency, v.RemoteIP, v.UserAgent)
			return nil
		},
	}))
	forwarder := forwarder{
		Mutex:            &sync.Mutex{},
		WebsocketClients: make(map[*wsClient]bool),
		Broker:           newRequestBroker(),
		RequestTimeout:   5 * time.Second,
		AnkiConnectUrl:   ankiConnectUrl,
		PostMineAction:   postMineAction,
		InterceptField:   interceptField,
		InterceptValue:   interceptValue}
	forwarder.registerRoutes(e)
	e.Logger.Fatal(e.Start(":" + port))
}
