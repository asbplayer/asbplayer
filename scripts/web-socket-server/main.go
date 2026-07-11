package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	_ "github.com/joho/godotenv/autoload"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// gorilla/websocket allows only one concurrent writer per connection, so each client
// serializes its writes (PONG replies and published commands) behind a mutex.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type (
	wsClient struct {
		conn     *websocket.Conn
		writeMux sync.Mutex
	}
	forwarder struct {
		WebsocketClients map[*wsClient]bool
		ResponseChannel  chan clientResponse
		Mutex            *sync.Mutex
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
		Files []subtitleFile `json:"files"`
	}
	asbplayerSeekRequest struct {
		Timestamp float64 `json:"timestamp"`
	}
	clientCommand struct {
		Command   string                 `json:"command"`
		MessageId string                 `json:"messageId"`
		Body      map[string]interface{} `json:"body"`
	}
	clientResponse struct {
		Command   string          `json:"command"`
		MessageId string          `json:"messageId"`
		Body      json.RawMessage `json:"body"`
	}
	mineSubtitleResponseBody struct {
		Published bool `json:"published"`
	}
)

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

	for {
		_, msg, err := conn.ReadMessage()

		if err != nil {
			c.Logger().Error(err)
			break
		}

		if string(msg) == "PING" {
			client.send(websocket.TextMessage, []byte("PONG"))
		} else {
			response := clientResponse{}
			if err := json.Unmarshal(msg, &response); err == nil {
				forwarder.ResponseChannel <- response
			}
		}
	}

	return nil
}

func (forwarder forwarder) publishMessage(command clientCommand) error {
	forwarder.Mutex.Lock()
	defer forwarder.Mutex.Unlock()
	bytes, err := json.Marshal(command)

	if err != nil {
		return err
	}

	for client := range forwarder.WebsocketClients {
		client.send(websocket.TextMessage, bytes)
	}

	return nil
}

func (forwarder forwarder) publishMessageAndAwaitResponse(command clientCommand, c chan clientResponse) {
	err := forwarder.publishMessage(command)

	if err != nil {
		close(c)
		return
	}

	for {
		select {
		case response := <-forwarder.ResponseChannel:
			if response.MessageId == command.MessageId {
				c <- response
				close(c)
				return
			}
		case <-time.After(5 * time.Second):
			close(c)
			return
		}
	}
}

func (forwarder forwarder) forwardToAnkiConnect(buf *bytes.Buffer, c echo.Context, method string) error {
	ankiConnectRequest, err := http.NewRequest(method, forwarder.AnkiConnectUrl, buf)

	for key, values := range c.Request().Header {
		ankiConnectRequest.Header[key] = values
	}

	if err != nil {
		return err
	}

	ankiConnectResponse, err := http.DefaultClient.Do(ankiConnectRequest)

	if err != nil {
		return err
	}

	ankiConnectResponseBuf := new(bytes.Buffer)
	ankiConnectResponseBuf.ReadFrom(ankiConnectResponse.Body)

	for header, values := range ankiConnectResponse.Header {
		for _, value := range values {
			c.Response().Header().Add(header, value)
		}
	}

	c.Blob(ankiConnectResponse.StatusCode, ankiConnectResponse.Header["Content-Type"][0], ankiConnectResponseBuf.Bytes())
	return nil
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

	if request.Action != "addNote" || len(forwarder.WebsocketClients) == 0 || !shouldInterceptAddNote(request, forwarder.InterceptField, forwarder.InterceptValue) {
		return forwarder.forwardToAnkiConnect(buf, c, "POST")
	}

	command := clientCommand{Command: "mine-subtitle", MessageId: uuid.NewString(), Body: map[string]interface{}{
		"fields":         request.Params["note"].(map[string]interface{})["fields"],
		"postMineAction": forwarder.PostMineAction,
	}}

	if forwarder.PostMineAction == 2 {
		response := forwarder.forwardToAnkiConnect(buf, c, "POST")
		err := forwarder.publishMessage(command)

		if err != nil {
			fmt.Printf("Failed to publish command to asbplayer: %v", err)
		}

		return response
	}

	responseChannel := make(chan clientResponse)

	go forwarder.publishMessageAndAwaitResponse(command, responseChannel)
	response, ok := <-responseChannel
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, nil)
	}

	mineSubtitleResponseBody := mineSubtitleResponseBody{}
	err = json.Unmarshal(response.Body, &mineSubtitleResponseBody)

	if err != nil || !mineSubtitleResponseBody.Published {
		return forwarder.forwardToAnkiConnect(buf, c, "POST")
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
	return forwarder.forwardToAnkiConnect(new(bytes.Buffer), c, "OPTIONS")
}

func (forwarder forwarder) handleAsbplayerLoadSubtitlesRequest(c echo.Context) error {
	buf := new(bytes.Buffer)
	buf.ReadFrom(c.Request().Body)
	request := asbplayerLoadSubtitlesRequest{}
	err := json.Unmarshal(buf.Bytes(), &request)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err)
	}

	command := clientCommand{Command: "load-subtitles", MessageId: uuid.NewString(), Body: map[string]interface{}{
		"files": request.Files,
	}}
	responseChannel := make(chan clientResponse)

	go forwarder.publishMessageAndAwaitResponse(command, responseChannel)
	_, ok := <-responseChannel
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, nil)
	}

	c.String(http.StatusOK, "")
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

	command := clientCommand{Command: "seek-timestamp", MessageId: uuid.NewString(), Body: map[string]interface{}{
		"timestamp": request.Timestamp,
	}}
	responseChannel := make(chan clientResponse)

	go forwarder.publishMessageAndAwaitResponse(command, responseChannel)
	_, ok := <-responseChannel
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, nil)
	}

	c.String(http.StatusOK, "")
	return nil
}

func (forwarder forwarder) handleAsbplayerBoundMediaRequest(c echo.Context) error {
	command := clientCommand{Command: "get-bound-media", MessageId: uuid.NewString(), Body: map[string]interface{}{}}
	responseChannel := make(chan clientResponse)

	go forwarder.publishMessageAndAwaitResponse(command, responseChannel)
	response, ok := <-responseChannel
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, nil)
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
	responseChannel := make(chan clientResponse)

	go forwarder.publishMessageAndAwaitResponse(command, responseChannel)
	response, ok := <-responseChannel
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, nil)
	}

	return c.JSONBlob(http.StatusOK, response.Body)
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
	port := getenv("PORT", "8766")
	ankiConnectUrl := getenv("ANKI_CONNECT_URL", "http://127.0.0.1:8765")
	postMineAction, _ := strconv.Atoi(getenv("POST_MINE_ACTION", "2"))
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
		ResponseChannel:  make(chan clientResponse),
		AnkiConnectUrl:   ankiConnectUrl,
		PostMineAction:   postMineAction,
		InterceptField:   interceptField,
		InterceptValue:   interceptValue}
	e.GET("/ws", forwarder.handleWebsocketClient)
	e.POST("/disconnect-ws-clients", forwarder.disconnectWebsocketClients)
	e.GET("/", forwarder.handleGetRequest)
	e.POST("/", forwarder.handlePostRequest)
	e.POST("/asbplayer/load-subtitles", forwarder.handleAsbplayerLoadSubtitlesRequest)
	e.POST("/asbplayer/seek", forwarder.handleAsbplayerSeekRequest)
	e.GET("/asbplayer/bound-media", forwarder.handleAsbplayerBoundMediaRequest)
	e.GET("/asbplayer/subtitles", forwarder.handleAsbplayerSubtitlesRequest)
	e.OPTIONS("/", forwarder.handleOptionsRequest)
	e.Logger.Fatal(e.Start(":" + port))
}
