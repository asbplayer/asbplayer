import { describe, expect, it } from '@jest/globals';
import { PlayMode } from '@project/common';
import type { Message } from '@project/common';
import { defaultSettings } from '@project/common/settings';
import VideoChannel from '@project/common/app/services/video-channel';
import type { VideoProtocol, VideoProtocolMessage } from '@project/common/app/services/video-protocol';

class TestVideoProtocol implements VideoProtocol {
    readonly sent: Message[] = [];
    onMessage?: (message: VideoProtocolMessage) => void;

    postMessage(message: Message) {
        this.sent.push(message);
    }

    close() {}

    receive<T extends Message>(message: T) {
        this.onMessage?.({ data: message });
    }
}

const authoritativeModeSets: { name: string; modes: PlayMode[] }[] = [
    { name: 'normal', modes: [PlayMode.normal] },
    { name: 'auto-pause', modes: [PlayMode.autoPause] },
    { name: 'repeat', modes: [PlayMode.repeat] },
    { name: 'auto-pause + repeat', modes: [PlayMode.autoPause, PlayMode.repeat] },
    { name: 'condensed', modes: [PlayMode.condensed] },
    { name: 'condensed + auto-pause', modes: [PlayMode.condensed, PlayMode.autoPause] },
    { name: 'condensed + repeat', modes: [PlayMode.condensed, PlayMode.repeat] },
    {
        name: 'condensed + auto-pause + repeat',
        modes: [PlayMode.condensed, PlayMode.autoPause, PlayMode.repeat],
    },
    { name: 'fast-forward', modes: [PlayMode.fastForward] },
    { name: 'fast-forward + auto-pause', modes: [PlayMode.fastForward, PlayMode.autoPause] },
    { name: 'fast-forward + repeat', modes: [PlayMode.fastForward, PlayMode.repeat] },
    {
        name: 'fast-forward + auto-pause + repeat',
        modes: [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat],
    },
];

describe('VideoChannel playback intents', () => {
    it('forwards playback settings used by the video-owned timeline', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);

        channel.miscSettings({
            ...defaultSettings,
            subtitleTriggerStartOffset: -250,
            subtitleTriggerEndOffset: 400,
            subtitleTriggerGapEndOffset: -150,
            subtitleTriggerGapStartOffset: 300,
            streamingCondensedPlaybackMinimumSkipIntervalMs: 750,
        });

        expect(protocol.sent).toEqual([
            expect.objectContaining({
                command: 'miscSettings',
                value: expect.objectContaining({
                    subtitleTriggerStartOffset: -250,
                    subtitleTriggerEndOffset: 400,
                    subtitleTriggerGapEndOffset: -150,
                    subtitleTriggerGapStartOffset: 300,
                    streamingCondensedPlaybackMinimumSkipIntervalMs: 750,
                }),
            }),
        ]);
    });

    it.each(authoritativeModeSets)('reports authoritative $name state from the media owner', ({ modes }) => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        const received: Set<PlayMode>[] = [];
        channel.onPlayModes((playModes) => received.push(playModes));

        protocol.receive({ command: 'playModes', playModes: modes });

        expect(received).toEqual([new Set(modes)]);
    });

    it('sends mode intents without making playback decisions', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);

        channel.playMode(PlayMode.autoPause);
        channel.playMode(PlayMode.repeat);

        expect(protocol.sent).toEqual([
            { command: 'playMode', playMode: PlayMode.autoPause },
            { command: 'playMode', playMode: PlayMode.repeat },
        ]);
    });

    it('delivers only the latest authoritative state when the observer subscribes late', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        protocol.receive({ command: 'playModes', playModes: [PlayMode.repeat] });
        protocol.receive({ command: 'playModes', playModes: [PlayMode.fastForward, PlayMode.repeat] });
        const received: Set<PlayMode>[] = [];

        channel.onPlayModes((modes) => received.push(modes));

        expect(received).toEqual([]);
        expect(channel.playModes).toEqual(new Set([PlayMode.fastForward, PlayMode.repeat]));
    });

    it('replays the latest paused state to late ready subscribers', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        protocol.receive({
            command: 'ready',
            duration: 100,
            currentTime: 0,
            paused: true,
            playbackRate: 1,
        });
        const received: boolean[] = [];

        channel.onReady((paused) => received.push(paused));

        expect(received).toEqual([true]);
    });

    it('updates duration and notifies duration subscribers', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        const received: number[] = [];
        channel.onDuration((duration) => received.push(duration));

        protocol.receive({ command: 'duration', value: 200 });

        expect(channel.duration).toBe(200);
        expect(received).toEqual([200]);
    });

    it('reports whether current-time changes should echo', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        const received: { value: number; echo: boolean }[] = [];
        channel.onCurrentTime((value, echo) => received.push({ value, echo }));

        protocol.receive({ command: 'currentTime', value: 1, echo: true });
        protocol.receive({ command: 'currentTime', value: 2, echo: false });

        expect(received).toEqual([
            { value: 1, echo: true },
            { value: 2, echo: false },
        ]);
    });

    it('replays the latest authoritative playback state to late subscribers', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        const received: unknown[] = [];

        const state = {
            command: 'playbackState' as const,
            timestampMs: 1234,
            showingSubtitleIndexes: [2, 5],
            paused: true,
        };
        protocol.receive(state);

        channel.onPlaybackState((latestState) => received.push(latestState));
        expect(received).toEqual([state]);
        expect(channel.currentTime).toBe(1.234);

        protocol.receive({ ...state, timestampMs: 1500 });
        expect(received).toEqual([state, { ...state, timestampMs: 1500 }]);
    });

    it('applies playback states in transport order', () => {
        const protocol = new TestVideoProtocol();
        const channel = new VideoChannel(protocol);
        const received: number[] = [];
        channel.onPlaybackState((state) => received.push(state.timestampMs));

        protocol.receive({
            command: 'playbackState',
            timestampMs: 1000,
            showingSubtitleIndexes: [],
            paused: false,
        });
        protocol.receive({
            command: 'playbackState',
            timestampMs: 900,
            showingSubtitleIndexes: [],
            paused: false,
        });

        expect(received).toEqual([1000, 900]);
        expect(channel.currentTime).toBe(0.9);
        channel.close();
    });
});
