import {
    ExtensionToExtensionYomitanFetcher,
    YOMITAN_PORT_NAME,
} from '@project/extension/src/services/extension-to-extension-yomitan-fetcher';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

interface MockPortEvent {
    addListener: jest.Mock<(callback: (message?: unknown) => void) => void>;
    removeListener: jest.Mock;
}

interface MockPort {
    onMessage: MockPortEvent;
    onDisconnect: MockPortEvent;
    postMessage: jest.Mock<(message: unknown) => void>;
    disconnect: jest.Mock;
    emitMessage: (message: unknown) => void;
    emitDisconnect: () => void;
}

const makePort = (): MockPort => {
    const messageListeners: ((message?: unknown) => void)[] = [];
    const disconnectListeners: (() => void)[] = [];
    const port: MockPort = {
        onMessage: {
            addListener: jest.fn((callback: (message?: unknown) => void) => messageListeners.push(callback)),
            removeListener: jest.fn(),
        },
        onDisconnect: {
            addListener: jest.fn((callback: () => void) => disconnectListeners.push(callback)),
            removeListener: jest.fn(),
        },
        postMessage: jest.fn(),
        disconnect: jest.fn(),
        emitMessage: (message: unknown) => messageListeners.forEach((l) => l(message)),
        emitDisconnect: () => disconnectListeners.forEach((l) => l()),
    };
    return port;
};

const makeRuntime = (port: MockPort) => {
    const connect = jest.fn(() => port);
    (globalThis as any).browser = { runtime: { connect, lastError: undefined } };
    return (globalThis as any).browser.runtime;
};

const YOMITAN_ID = 'testyomitanid';
const lastPostedRequestId = (port: MockPort, callIndex: number): string => {
    const call = (port.postMessage as jest.Mock).mock.calls[callIndex] as [{ requestId: string }];
    return call[0].requestId;
};

describe('ExtensionToExtensionYomitanFetcher', () => {
    afterEach(() => {
        delete (globalThis as any).browser;
    });

    it('connects with the Yomitan port name and sends the port envelope', async () => {
        const port = makePort();
        const runtime = makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);
        const body = { term: 'テスト' };

        const promise = fetcher.fetch('termEntries', body);
        expect(runtime.connect).toHaveBeenCalledWith(YOMITAN_ID, { name: YOMITAN_PORT_NAME });
        expect(port.postMessage).toHaveBeenCalledWith({
            action: 'termEntries',
            params: {},
            body: JSON.stringify(body),
            requestId: expect.any(String),
        });
        const requestId = lastPostedRequestId(port, 0);
        port.emitMessage({ action: 'termEntries', requestId, data: { result: 42 }, responseStatusCode: 200 });

        await expect(promise).resolves.toEqual({ result: 42 });
    });

    it('reuses the connected port across requests', async () => {
        const port = makePort();
        const runtime = makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        const first = fetcher.fetch('termEntries', { term: 'a' });
        const firstRequestId = lastPostedRequestId(port, 0);
        port.emitMessage({ action: 'termEntries', requestId: firstRequestId, data: 1, responseStatusCode: 200 });
        await first;

        const second = fetcher.fetch('tokenize', { text: 'b' });
        const secondRequestId = lastPostedRequestId(port, 1);
        port.emitMessage({ action: 'tokenize', requestId: secondRequestId, data: 2, responseStatusCode: 200 });
        await second;

        expect(runtime.connect).toHaveBeenCalledTimes(1);
    });

    it('correlates responses by requestId when requests overlap', async () => {
        const port = makePort();
        makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        const first = fetcher.fetch('termEntries', { term: 'a' });
        const second = fetcher.fetch('termEntries', { term: 'b' });
        const firstRequestId = lastPostedRequestId(port, 0);
        const secondRequestId = lastPostedRequestId(port, 1);
        port.emitMessage({
            action: 'termEntries',
            requestId: secondRequestId,
            data: 'second',
            responseStatusCode: 200,
        });
        port.emitMessage({ action: 'termEntries', requestId: firstRequestId, data: 'first', responseStatusCode: 200 });

        await expect(first).resolves.toBe('first');
        await expect(second).resolves.toBe('second');
    });

    it('resolves with error payloads so batch-size failures can be detected by the Yomitan client', async () => {
        const port = makePort();
        makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        const promise = fetcher.fetch('tokenize', { text: 'a' });
        const requestId = lastPostedRequestId(port, 0);
        port.emitMessage({
            action: 'tokenize',
            requestId,
            data: '{"message":"Message exceeded maximum allowed size of 64MiB."}',
            responseStatusCode: 500,
        });

        await expect(promise).resolves.toBe('{"message":"Message exceeded maximum allowed size of 64MiB."}');
    });

    it('rejects pending requests when the port disconnects', async () => {
        const port = makePort();
        makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        const promise = fetcher.fetch('tokenize', { text: 'a' });
        port.emitDisconnect();

        await expect(promise).rejects.toThrow('Yomitan port disconnected');
    });

    it('includes the runtime error in the rejection when the port disconnects with one', async () => {
        const port = makePort();
        const runtime = makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        const promise = fetcher.fetch('tokenize', { text: 'a' });
        runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
        port.emitDisconnect();

        await expect(promise).rejects.toThrow(
            'Yomitan port disconnected: Could not establish connection. Receiving end does not exist.'
        );
    });

    it('rejects when posting to a dead port throws', async () => {
        const port = makePort();
        makeRuntime(port);
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);
        port.postMessage.mockImplementation(() => {
            throw new Error('Attempting to use a disconnected port');
        });

        await expect(fetcher.fetch('tokenize', { text: 'a' })).rejects.toThrow('Attempting to use a disconnected port');
    });

    it('rejects when no response arrives within the request timeout', async () => {
        jest.useFakeTimers();
        try {
            const port = makePort();
            makeRuntime(port);
            const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

            const promise = fetcher.fetch('tokenize', { text: 'a' });

            jest.advanceTimersByTime(28_000);

            await expect(promise).rejects.toThrow('Yomitan request timed out');
        } finally {
            jest.useRealTimers();
        }
    });

    it('does not reject a resolved request when its timeout elapses', async () => {
        jest.useFakeTimers();
        try {
            const port = makePort();
            makeRuntime(port);
            const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

            const promise = fetcher.fetch('tokenize', { text: 'a' });
            const requestId = lastPostedRequestId(port, 0);
            port.emitMessage({ action: 'tokenize', requestId, data: 'ok', responseStatusCode: 200 });
            await promise;

            jest.advanceTimersByTime(28_000);

            await expect(promise).resolves.toBe('ok');
        } finally {
            jest.useRealTimers();
        }
    });

    it('reconnects from scratch for a subsequent request after a disconnect', async () => {
        const firstPort = makePort();
        const secondPort = makePort();
        const runtime = makeRuntime(firstPort);
        runtime.connect.mockImplementation(() => (runtime.connect.mock.calls.length === 1 ? firstPort : secondPort));
        const fetcher = new ExtensionToExtensionYomitanFetcher(YOMITAN_ID);

        Date.now = jest.fn(() => 0);

        const failed = fetcher.fetch('tokenize', { text: 'a' });
        firstPort.emitDisconnect();
        await expect(failed).rejects.toThrow('Yomitan port disconnected');

        // Advance past reconnect cooldown
        Date.now = jest.fn(() => 5001);

        // Disconnects are not retried; the next request reconnects from scratch.
        const retried = fetcher.fetch('tokenize', { text: 'b' });
        const retriedRequestId = lastPostedRequestId(secondPort, 0);
        secondPort.emitMessage({
            action: 'tokenize',
            requestId: retriedRequestId,
            data: 'ok',
            responseStatusCode: 200,
        });

        await expect(retried).resolves.toBe('ok');
        expect(runtime.connect).toHaveBeenCalledTimes(2);
    });
});
