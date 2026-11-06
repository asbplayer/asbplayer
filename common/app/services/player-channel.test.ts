import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { PlayMode, PostMineAction } from '@project/common';
import type { Message, SubtitleModel } from '@project/common';
import PlayerChannel from '@project/common/app/services/player-channel';
import { defaultSettings } from '@project/common/settings';
import type { MiscSettings } from '@project/common/settings';
import VideoChannel from '@project/common/app/services/video-channel';
import type { VideoProtocol } from '@project/common/app/services/video-protocol';
import type { MiningAudioSnapshot } from '@project/common/audio-transcode/mining-audio';

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
    it('receives the latest conversion status before video readiness even when initial messages were missed', () => {
        const player = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const protocol: VideoProtocol = {
            postMessage: (message) => broadcastChannel.onmessage?.(new MessageEvent('message', { data: message })),
            close() {},
        };
        const owner = new VideoChannel(protocol);
        const received: unknown[] = [];
        const audio = new Blob(['converted audio']);

        // Conversion can start and finish before the playback frame attaches its listener.
        owner.transcodedAudio({ active: true, complete: false, required: true, codecName: 'E-AC-3' });
        owner.transcodedAudio({ audio, active: true, complete: true, required: true, codecName: 'E-AC-3' });
        player.onTranscodedAudio((message) => received.push(message));
        player.requestTranscodedAudio();
        protocol.onMessage?.({ data: broadcastChannel.sent[0] });

        expect(received).toEqual([{ required: true, audio, active: true, complete: true, codecName: 'E-AC-3' }]);

        owner.transcodedAudio({ active: false, complete: false, required: false });
        player.requestTranscodedAudio();
        protocol.onMessage?.({ data: broadcastChannel.sent[1] });
        expect(received.slice(1)).toEqual([
            { required: false, active: false, complete: false },
            { required: false, active: false, complete: false },
        ]);
        player.close();
        owner.close();
    });

    it('delivers recipe and playback setting changes until the subscription is removed', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const received: MiscSettings[] = [];
        const unsubscribe = channel.onMiscSettings((settings) => received.push(settings));
        const settings: MiscSettings = {
            ...defaultSettings,
            recipes: [{ name: 'Reading', playbackModes: [PlayMode.autoPause], settings: { playbackRate: 0.8 } }],
            activeRecipeId: 0,
            playbackRate: 1.2,
        };
        const receive = (value: MiscSettings) =>
            broadcastChannel.onmessage?.(new MessageEvent('message', { data: { command: 'miscSettings', value } }));

        receive(settings);
        receive({ ...settings, activeRecipeId: null });
        unsubscribe();
        receive({ ...settings, playbackRate: 1.5 });

        expect(received).toEqual([settings, { ...settings, activeRecipeId: null }]);
        channel.close();
    });

    it('delivers the captured mining snapshot to history through the player channel', () => {
        const player = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const protocol: VideoProtocol = { postMessage() {}, close() {} };
        const video = new VideoChannel(protocol);
        const received: (MiningAudioSnapshot | undefined)[] = [];
        video.onCopy((_subtitle, _surrounding, _fields, _audio, _image, _url, _action, _id, _timestamp, snapshot) => {
            received.push(snapshot);
        });
        const subtitle: SubtitleModel = {
            text: '',
            start: 0,
            end: 1000,
            originalStart: 0,
            originalEnd: 1000,
            track: 0,
        };
        const snapshot = { audio: new Blob(['sealed audio']), durationMs: 1040 };
        player.copy(subtitle, [], {}, 'video.mp4', 1000, PostMineAction.none, snapshot);
        protocol.onMessage?.({ data: broadcastChannel.sent[0] });
        player.copy(subtitle, [], {}, 'video.mp4', 1000, PostMineAction.none);
        protocol.onMessage?.({ data: broadcastChannel.sent[1] });
        expect(received).toEqual([snapshot, undefined]);
        player.close();
        video.close();
    });

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

    it('sends optional invisible subtitle indexes', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;

        channel.playbackState({
            timestampMs: 1234,
            showingSubtitleIndexes: [2],
            invisibleSubtitleIndexes: [5],
            paused: false,
        });

        expect(broadcastChannel.sent).toEqual([
            {
                command: 'playbackState',
                timestampMs: 1234,
                showingSubtitleIndexes: [2],
                invisibleSubtitleIndexes: [5],
                paused: false,
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

    it('receives the encoded prefix, completion state, and supports clearing it', () => {
        const channel = new PlayerChannel('test-channel');
        const broadcastChannel = TestBroadcastChannel.instance!;
        const received: unknown[] = [];
        const audio = new Blob(['audio']);
        channel.onTranscodedAudio((value) => received.push(value));

        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: {
                    command: 'transcodedAudio',
                    required: true,
                    audio,
                    active: true,
                    complete: false,
                    codecName: 'E-AC-3',
                },
            })
        );
        broadcastChannel.onmessage?.(
            new MessageEvent('message', {
                data: {
                    command: 'transcodedAudio',
                    required: false,
                    active: false,
                    complete: false,
                },
            })
        );

        expect(received).toEqual([
            { required: true, audio, active: true, complete: false, codecName: 'E-AC-3' },
            { required: false, active: false, complete: false },
        ]);
        channel.close();
    });
});
