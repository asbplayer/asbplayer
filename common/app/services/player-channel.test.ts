import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';
import type { Message } from '@project/common';
import PlayerChannel from '@project/common/app/services/player-channel';

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
    it('sends the timestamp, showing indexes, and paused state together', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;

        channel.playbackState({
            timestampMs: 1234,
            showingSubtitleIndexes: [2, 5],
            hiddenSubtitleIndexes: [5],
            paused: true,
        });

        expect(broadcastChannel.sent).toEqual([
            {
                command: 'playbackState',
                timestampMs: 1234,
                showingSubtitleIndexes: [2, 5],
                hiddenSubtitleIndexes: [5],
                paused: true,
            },
        ]);

        channel.close();
    });

    it('delivers playback states in transport order', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const received: number[] = [];
        channel.onPlaybackState((state) => received.push(state.timestampMs));

        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: {
                    command: 'playbackState',
                    timestampMs: 1000,
                    showingSubtitleIndexes: [],
                    paused: false,
                },
            })
        );
        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: {
                    command: 'playbackState',
                    timestampMs: 900,
                    showingSubtitleIndexes: [],
                    paused: false,
                },
            })
        );

        expect(received).toEqual([1000, 900]);
        channel.close();
    });

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

    it('sends duration changes from the media owner', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;

        channel.duration(12);

        expect(broadcastChannel.sent).toEqual([{ command: 'duration', value: 12 }]);
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
