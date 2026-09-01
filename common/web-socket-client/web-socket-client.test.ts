import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { WebSocketClient } from '@project/common/web-socket-client';
import type { SeekTimestampCommand } from '@project/common/web-socket-client';
import { FakeWebSocket } from '@project/common/web-socket-client/fake-web-socket';

const url = 'ws://localhost:8766/ws';

const command = (name: string, messageId: string, body: any = {}) => JSON.stringify({ command: name, messageId, body });

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: any) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = () => res();
        reject = rej;
    });
    return { promise, resolve, reject };
};

let client: WebSocketClient;

const connect = async () => {
    client = new WebSocketClient();
    const bound = client.bind(url);
    const socket = FakeWebSocket.last;
    socket.open();
    await bound;
    return socket;
};

// Keep the spies suite-scoped because unbind rejections log on a later microtask.
beforeAll(() => {
    for (const method of ['log', 'info'] as const) {
        jest.spyOn(console, method).mockImplementation(() => undefined);
    }
});

afterAll(() => {
    jest.restoreAllMocks();
});

beforeEach(() => {
    FakeWebSocket.reset();
    (globalThis as any).WebSocket = FakeWebSocket;
});

afterEach(() => {
    client?.unbind();
    jest.useRealTimers();
});

describe('connection', () => {
    it('connects to the configured URL and pings on open', async () => {
        const socket = await connect();

        expect(socket.url).toEqual(url);
        expect(socket.sent).toEqual(['PING']);
    });

    it('resolves pending pings when a PONG is received', async () => {
        const socket = await connect();
        const pinged = client.ping();

        await socket.receive('PONG');

        await expect(pinged).resolves.toBeUndefined();
    });

    it('rejects a ping when the socket is not open', async () => {
        const socket = await connect();
        socket.readyState = socket.CLOSED;

        await expect(client.ping()).rejects.toEqual('Not connected');
    });
});

describe('command dispatch', () => {
    it('dispatches mine-subtitle and responds with the handler result', async () => {
        const socket = await connect();
        const onMineSubtitle = jest.fn(async () => true);
        client.onMineSubtitle = onMineSubtitle;

        await socket.receive(command('mine-subtitle', 'm1', { fields: { Word: 'ねこ' }, postMineAction: 1 }));

        expect(onMineSubtitle).toHaveBeenCalledWith({
            command: 'mine-subtitle',
            messageId: 'm1',
            body: { fields: { Word: 'ねこ' }, postMineAction: 1 },
        });
        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'm1', body: { published: true } }]);
    });

    it('responds with published false when mine-subtitle is not handled', async () => {
        const socket = await connect();

        await socket.receive(command('mine-subtitle', 'm2', { fields: {}, postMineAction: 0 }));

        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'm2', body: { published: false } }]);
    });

    it('responds with published false when the mine-subtitle handler returns false', async () => {
        const socket = await connect();
        client.onMineSubtitle = async () => false;

        await socket.receive(command('mine-subtitle', 'm3', { fields: {}, postMineAction: 0 }));

        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'm3', body: { published: false } }]);
    });

    it('dispatches load-subtitles and responds with an empty body', async () => {
        const socket = await connect();
        const onLoadSubtitles = jest.fn(async () => {});
        client.onLoadSubtitles = onLoadSubtitles;
        const files = [{ base64: 'AAA', name: 'a.srt' }];

        await socket.receive(command('load-subtitles', 'l1', { files }));

        expect(onLoadSubtitles).toHaveBeenCalledWith({
            command: 'load-subtitles',
            messageId: 'l1',
            body: { files },
        });
        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'l1', body: {} }]);
    });

    it('responds to load-subtitles even when it is not handled', async () => {
        const socket = await connect();

        await socket.receive(command('load-subtitles', 'l2', {}));

        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'l2', body: {} }]);
    });

    it('dispatches seek-timestamp and responds with an empty body', async () => {
        const socket = await connect();
        const onSeekTimestamp = jest.fn(async () => {});
        client.onSeekTimestamp = onSeekTimestamp;

        await socket.receive(command('seek-timestamp', 's1', { timestamp: 12.5, mediaId: 'abc' }));

        expect(onSeekTimestamp).toHaveBeenCalledWith({
            command: 'seek-timestamp',
            messageId: 's1',
            body: { timestamp: 12.5, mediaId: 'abc' },
        });
        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 's1', body: {} }]);
    });

    it('responds to seek-timestamp even when it is not handled', async () => {
        const socket = await connect();

        await socket.receive(command('seek-timestamp', 's2', { timestamp: 1 }));

        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 's2', body: {} }]);
    });

    it('dispatches get-bound-media and responds with the returned media', async () => {
        const socket = await connect();
        const media = [{ id: 'a', type: 'streaming' as const, loadedSubtitles: [], active: true }];
        client.onGetBoundMedia = async () => media;

        await socket.receive(command('get-bound-media', 'b1'));

        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'b1', body: { media } }]);
    });

    it('does not respond to get-bound-media when it is not handled', async () => {
        const socket = await connect();

        await socket.receive(command('get-bound-media', 'b2'));

        expect(socket.sentCommands).toEqual([]);
    });

    it('dispatches get-subtitles with the requested media and tracks', async () => {
        const socket = await connect();
        const subtitles = [{ text: 'ねこ', start: 0, end: 100, track: 1 }];
        const onGetSubtitles = jest.fn(async () => subtitles);
        client.onGetSubtitles = onGetSubtitles;

        await socket.receive(command('get-subtitles', 'g1', { mediaId: 'abc', trackNumbers: [1] }));

        expect(onGetSubtitles).toHaveBeenCalledWith('abc', [1]);
        expect(socket.sentCommands).toEqual([{ command: 'response', messageId: 'g1', body: { subtitles } }]);
    });

    it('dispatches get-subtitles with undefined arguments when the body is empty', async () => {
        const socket = await connect();
        const onGetSubtitles = jest.fn(async () => []);
        client.onGetSubtitles = onGetSubtitles;

        await socket.receive(command('get-subtitles', 'g2'));

        expect(onGetSubtitles).toHaveBeenCalledWith(undefined, undefined);
    });

    it('does not respond to get-subtitles when it is not handled', async () => {
        const socket = await connect();

        await socket.receive(command('get-subtitles', 'g3'));

        expect(socket.sentCommands).toEqual([]);
    });

    it('ignores unknown commands', async () => {
        const socket = await connect();

        await socket.receive(command('not-a-command', 'u1'));

        expect(socket.sentCommands).toEqual([]);
    });

    it('preserves the message ID exactly', async () => {
        const socket = await connect();
        const messageId = 'aBc-123_ねこ/#?';
        client.onSeekTimestamp = async () => {};

        await socket.receive(command('seek-timestamp', messageId, { timestamp: 0 }));

        expect(socket.sentCommands[0].messageId).toEqual(messageId);
    });

    it('does not respond when a handler rejects', async () => {
        const socket = await connect();
        client.onSeekTimestamp = async () => {
            throw new Error('handler failed');
        };

        await expect(socket.receive(command('seek-timestamp', 's3', { timestamp: 0 }))).rejects.toThrow(
            'handler failed'
        );
        expect(socket.sentCommands).toEqual([]);
    });

    it('does not respond when the payload is not valid JSON', async () => {
        const socket = await connect();

        await expect(socket.receive('not json')).rejects.toBeDefined();
        expect(socket.sentCommands).toEqual([]);
    });

    it('completes concurrent commands independently and out of order', async () => {
        const socket = await connect();
        const slow = deferred();
        const fast = deferred();
        client.onSeekTimestamp = async ({ messageId }: SeekTimestampCommand) => {
            await (messageId === 'slow' ? slow : fast).promise;
        };

        const slowDispatch = socket.receive(command('seek-timestamp', 'slow', { timestamp: 1 }));
        const fastDispatch = socket.receive(command('seek-timestamp', 'fast', { timestamp: 2 }));

        fast.resolve();
        await fastDispatch;
        expect(socket.sentCommands.map((response) => response.messageId)).toEqual(['fast']);

        slow.resolve();
        await slowDispatch;
        expect(socket.sentCommands.map((response) => response.messageId)).toEqual(['fast', 'slow']);
    });
});

describe('reconnect and unbind', () => {
    it('reconnects and rejects pending pings when no PONG arrives', async () => {
        jest.useFakeTimers();
        const socket = await connect();
        const pinged = client.ping();

        jest.advanceTimersByTime(10000);

        await expect(pinged).rejects.toEqual('Timed out');
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(socket.readyState).toEqual(socket.CLOSED);

        // Let the replacement connection finish so unbind has nothing left pending.
        FakeWebSocket.last.open();
    });

    it('pings on the interval while PONGs keep arriving', async () => {
        jest.useFakeTimers();
        const socket = await connect();

        await socket.receive('PONG');
        jest.advanceTimersByTime(10000);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(socket.sent).toEqual(['PING', 'PING']);
    });

    it('closes the socket, rejects pending pings, and detaches handlers on unbind', async () => {
        const socket = await connect();
        client.onMineSubtitle = async () => true;
        client.onLoadSubtitles = async () => {};
        client.onSeekTimestamp = async () => {};
        client.onGetBoundMedia = async () => [];
        client.onGetSubtitles = async () => [];
        const pinged = client.ping();

        client.unbind();

        await expect(pinged).rejects.toEqual('Disconnecting');
        expect(socket.readyState).toEqual(socket.CLOSED);
        expect(client.socket).toBeUndefined();
        expect(client.onMineSubtitle).toBeUndefined();
        expect(client.onLoadSubtitles).toBeUndefined();
        expect(client.onSeekTimestamp).toBeUndefined();
        expect(client.onGetBoundMedia).toBeUndefined();
        expect(client.onGetSubtitles).toBeUndefined();
    });

    it('does not log an error during expected teardown', async () => {
        const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await connect();

        client.unbind();
        await Promise.resolve();
        await Promise.resolve();

        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('stops the ping interval on unbind', async () => {
        jest.useFakeTimers();
        const socket = await connect();

        client.unbind();
        jest.advanceTimersByTime(30000);

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(socket.sent).toEqual(['PING']);
    });
});
