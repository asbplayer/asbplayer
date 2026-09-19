export class FakeWebSocket {
    static instances: FakeWebSocket[] = [];

    static reset() {
        FakeWebSocket.instances = [];
    }

    static get last() {
        return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    }

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    readonly url: string;
    readyState = 0;
    sent: string[] = [];
    onmessage?: (event: { data: string }) => void | Promise<void>;
    onclose?: (event: { reason: string }) => void;
    onerror?: () => void;
    onopen?: () => void;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    send(data: string) {
        this.sent.push(data);
    }

    close() {
        this.readyState = this.CLOSED;
        this.onclose?.({ reason: 'closed by test' });
    }

    open() {
        this.readyState = this.OPEN;
        this.onopen?.();
    }

    error() {
        this.onerror?.();
    }

    receive(data: string) {
        return Promise.resolve(this.onmessage?.({ data }));
    }

    get sentCommands(): any[] {
        return this.sent.filter((message) => message !== 'PING').map((message) => JSON.parse(message));
    }
}
