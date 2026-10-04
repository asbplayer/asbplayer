package main

import "sync"

type pendingRequest struct {
	result  chan clientResponse
	settled sync.Once
}

func (request *pendingRequest) resolve(response clientResponse) {
	request.settled.Do(func() {
		request.result <- response
		close(request.result)
	})
}

func (request *pendingRequest) abandon() {
	request.settled.Do(func() {
		close(request.result)
	})
}

type requestBroker struct {
	mutex   sync.Mutex
	pending map[string]*pendingRequest
}

func newRequestBroker() *requestBroker {
	return &requestBroker{pending: make(map[string]*pendingRequest)}
}

func (broker *requestBroker) register(messageId string) *pendingRequest {
	request := &pendingRequest{result: make(chan clientResponse, 1)}
	broker.mutex.Lock()
	defer broker.mutex.Unlock()
	broker.pending[messageId] = request
	return request
}

// Settle under the lock so concurrent cancellation cannot close the channel before delivery.
func (broker *requestBroker) deliver(response clientResponse) {
	broker.mutex.Lock()
	defer broker.mutex.Unlock()
	request, expected := broker.pending[response.MessageId]

	if !expected {
		return
	}

	delete(broker.pending, response.MessageId)
	request.resolve(response)
}

func (broker *requestBroker) cancel(messageId string, request *pendingRequest) {
	broker.mutex.Lock()
	defer broker.mutex.Unlock()

	if broker.pending[messageId] == request {
		delete(broker.pending, messageId)
	}

	request.abandon()
}

func (broker *requestBroker) pendingCount() int {
	broker.mutex.Lock()
	defer broker.mutex.Unlock()
	return len(broker.pending)
}
