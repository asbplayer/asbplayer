import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { type Message, PlayMode } from '@project/common';
import PlayerChannel from './player-channel';

class TestBroadcastChannel {
    static instance?: TestBroadcastChannel;

    readonly sent: Message[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    closed = false;

    constructor(readonly name: string) {
        TestBroadcastChannel.instance = this;
    }

    postMessage(message: Message) {
        this.sent.push(message);
    }

    close() {
        this.closed = true;
    }
}

const originalBroadcastChannel = globalThis.BroadcastChannel;

beforeEach(() => {
    TestBroadcastChannel.instance = undefined;
    globalThis.BroadcastChannel = TestBroadcastChannel as unknown as typeof BroadcastChannel;
});

afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
});

describe('PlayerChannel playback state', () => {
    it('sends authoritative mode state from the media owner', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;

        channel.playModes(new Set([PlayMode.autoPause, PlayMode.repeat]));

        expect(broadcastChannel.sent).toEqual([
            { command: 'playModes', playModes: [PlayMode.autoPause, PlayMode.repeat] },
        ]);

        channel.close();
        expect(broadcastChannel.closed).toBe(true);
    });

    it('reports whether current-time synchronization should echo', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;

        channel.currentTime(3);
        channel.currentTime(4, false);

        expect(broadcastChannel.sent).toEqual([
            { command: 'currentTime', value: 3, echo: true },
            { command: 'currentTime', value: 4, echo: false },
        ]);

        channel.close();
    });

    it('receives mode intents without making playback decisions', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const received: PlayMode[] = [];
        channel.onPlayMode((mode) => received.push(mode));

        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: { command: 'playMode', playMode: PlayMode.autoPause },
            })
        );
        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: { command: 'playMode', playMode: PlayMode.repeat },
            })
        );

        expect(received).toEqual([PlayMode.autoPause, PlayMode.repeat]);
        channel.close();
    });

    it('receives mode intents without origin metadata', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const received: PlayMode[] = [];
        channel.onPlayMode((mode) => received.push(mode));

        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: { command: 'playMode', playMode: PlayMode.fastForward },
            })
        );

        expect(received).toEqual([PlayMode.fastForward]);
        channel.close();
    });
});
