import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AutoPausePreference, PlayMode, type IndexedSubtitleModel } from '@project/common';
import type { SubtitleSlice } from '@project/common/subtitle-collection';

jest.mock('@project/common/subtitle-reader', () => ({
    SubtitleReader: class SubtitleReader {},
}));

jest.mock('../controllers/anki-ui-controller', () => ({
    __esModule: true,
    default: class AnkiUiController {},
}));

jest.mock('../controllers/controls-controller', () => ({
    __esModule: true,
    default: class ControlsController {},
}));

jest.mock('../controllers/drag-controller', () => ({
    __esModule: true,
    default: class DragController {},
}));

jest.mock('../controllers/mobile-gesture-controller', () => ({
    MobileGestureController: class MobileGestureController {},
}));

jest.mock('../controllers/mobile-video-overlay-controller', () => ({
    MobileVideoOverlayController: class MobileVideoOverlayController {
        updateModel = jest.fn();
    },
}));

jest.mock('../controllers/notification-controller', () => ({
    __esModule: true,
    default: class NotificationController {},
}));

jest.mock('../controllers/subtitle-controller', () => ({
    __esModule: true,
    default: class SubtitleController {
        autoPauseContext = {
            onStartedShowing: undefined,
            onWillStopShowing: undefined,
            clear: jest.fn(),
        };
        onNextSeekableToShow = undefined;
        onSeekableSlice = undefined;
        notification = jest.fn();
    },
}));

jest.mock('../controllers/bulk-export-controller', () => ({
    __esModule: true,
    default: class BulkExportController {},
}));

jest.mock('../controllers/video-data-sync-controller', () => ({
    __esModule: true,
    default: class VideoDataSyncController {},
}));

jest.mock('./audio-recorder', () => ({
    __esModule: true,
    default: class AudioRecorder {},
    TimedRecordingInProgressError: class TimedRecordingInProgressError extends Error {},
}));

jest.mock('./key-bindings', () => ({
    __esModule: true,
    default: class KeyBindings {},
}));

jest.mock('./i18n', () => ({
    i18nInit: jest.fn(),
}));

jest.mock('./pgs-parser-worker-factory', () => ({
    pgsParserWorkerFactory: jest.fn(),
}));

import Binding from './binding';
import { MockStorageArea } from './mock-storage-area';

type BindingHarness = ReturnType<typeof createBindingHarness>;
type BindingTestInternals = {
    autoPausePreference: AutoPausePreference;
    recordingState: number;
    _pendingAutoRepeatTargetTimestamp: number;
    _subscribe: () => void;
    playListener: (event: Event) => void;
    seekedListener: (event: Event) => void;
};

type MutableVideoStub = {
    paused: boolean;
    currentTime: number;
    playbackRate: number;
    readyState: number;
    duration: number;
    src: string;
    addEventListener: ReturnType<typeof jest.fn>;
    removeEventListener: ReturnType<typeof jest.fn>;
    play: ReturnType<typeof jest.fn>;
    pause: ReturnType<typeof jest.fn>;
    getBoundingClientRect: ReturnType<typeof jest.fn>;
};

const sortedModes = (modes: Set<PlayMode>) => [...modes].sort((left, right) => left - right);

const makeSubtitle = (overrides: Partial<IndexedSubtitleModel> = {}): IndexedSubtitleModel => ({
    text: 'subtitle',
    start: 0,
    end: 1000,
    originalStart: 0,
    originalEnd: 1000,
    track: 0,
    index: 0,
    ...overrides,
});

const allowedModeCombinations: readonly PlayMode[][] = [
    [PlayMode.autoPause],
    [PlayMode.condensed],
    [PlayMode.fastForward],
    [PlayMode.repeat],
    [PlayMode.autoPause, PlayMode.condensed],
    [PlayMode.autoPause, PlayMode.fastForward],
    [PlayMode.autoPause, PlayMode.repeat],
    [PlayMode.condensed, PlayMode.repeat],
    [PlayMode.fastForward, PlayMode.repeat],
    [PlayMode.autoPause, PlayMode.condensed, PlayMode.repeat],
    [PlayMode.autoPause, PlayMode.fastForward, PlayMode.repeat],
];

function createVideoStub() {
    return {
        paused: false,
        currentTime: 0,
        playbackRate: 1,
        readyState: 4,
        duration: 120,
        src: 'https://example.com/video.mp4',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        play: jest.fn(async () => undefined),
        pause: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 100, height: 100 })),
    } as MutableVideoStub;
}

function createBindingHarness() {
    const video = createVideoStub();
    const binding = new Binding(video as unknown as HTMLMediaElement, false) as Binding & Record<string, any>;
    const bindingInternals = binding as unknown as BindingTestInternals;
    const updateModel = jest.fn();
    const notification = jest.fn();
    const clearAutoPauseContext = jest.fn();
    const pause = jest.fn();
    const seek = jest.fn();
    const play = jest.fn(async () => undefined);

    const subtitleController = {
        autoPauseContext: {
            onStartedShowing: undefined as undefined | ((subtitle: IndexedSubtitleModel) => void),
            onWillStopShowing: undefined as undefined | ((subtitle: IndexedSubtitleModel) => void),
            clear: clearAutoPauseContext,
        },
        onNextSeekableToShow: undefined as undefined | ((subtitle: IndexedSubtitleModel) => Promise<void> | void),
        onSeekableSlice: undefined as
            | undefined
            | ((slice: SubtitleSlice<IndexedSubtitleModel>) => Promise<void> | void),
        subtitleAtIndex: jest.fn(() => [null, null]),
        notification,
    };

    Object.assign(binding, {
        video,
        subtitleController,
        mobileVideoOverlayController: { updateModel },
        dictionary: {
            onRequestStatisticsSeek: jest.fn(() => jest.fn()),
            onRequestStatisticsMineSentences: jest.fn(() => jest.fn()),
        },
        autoPausePreference: AutoPausePreference.atEnd,
        condensedPlaybackMinimumSkipIntervalMs: 1000,
        fastForwardPlaybackMinimumGapMs: 600,
        fastForwardModePlaybackRate: 2.7,
        seekableTracks: 1,
        recordingState: 2,
        recordingPostMineAction: undefined,
        _playModes: new Set([PlayMode.normal]),
        _pendingAutoRepeatTargetTimestamp: 0,
        _synced: false,
        pausedDueToHover: false,
        pause,
        seek,
        play,
    });

    return {
        binding,
        bindingInternals,
        updateModel,
        notification,
        clearAutoPauseContext,
        pause,
        seek,
        play,
        subtitleController,
        video,
    };
}

function enableModes(binding: Binding, modes: readonly PlayMode[]) {
    for (const mode of modes) {
        binding.togglePlayMode(mode);
    }
}

async function assertCombinationBehavior(harness: BindingHarness, modes: readonly PlayMode[]) {
    const { binding, bindingInternals, pause, seek, play, subtitleController, video, updateModel } = harness;
    const hasAutoPause = modes.includes(PlayMode.autoPause);
    const hasCondensed = modes.includes(PlayMode.condensed);
    const hasFastForward = modes.includes(PlayMode.fastForward);
    const hasRepeat = modes.includes(PlayMode.repeat);

    enableModes(binding, modes);

    expect(sortedModes(binding.playModes)).toEqual(sortedModes(new Set(modes)));
    expect(updateModel).toHaveBeenCalledTimes(modes.length);
    expect(typeof subtitleController.autoPauseContext.onStartedShowing === 'function').toBe(hasAutoPause);
    expect(typeof subtitleController.autoPauseContext.onWillStopShowing === 'function').toBe(hasAutoPause || hasRepeat);
    expect(typeof subtitleController.onNextSeekableToShow === 'function').toBe(hasCondensed);
    expect(typeof subtitleController.onSeekableSlice === 'function').toBe(hasFastForward);

    pause.mockClear();
    seek.mockClear();
    play.mockClear();

    if (hasAutoPause) {
        bindingInternals.autoPausePreference = AutoPausePreference.atStart;
        subtitleController.autoPauseContext.onStartedShowing?.(makeSubtitle());
        expect(pause).toHaveBeenCalledTimes(1);
        pause.mockClear();
    }

    if (hasAutoPause || hasRepeat) {
        bindingInternals.autoPausePreference = AutoPausePreference.atEnd;
        const subtitle = makeSubtitle({ start: 2000, end: 2600 });

        subtitleController.autoPauseContext.onWillStopShowing?.(subtitle);

        if (hasAutoPause && hasRepeat) {
            expect(pause).toHaveBeenCalledTimes(1);
            expect(seek).not.toHaveBeenCalled();
            expect(bindingInternals._pendingAutoRepeatTargetTimestamp).toBe(2);
        } else if (hasAutoPause) {
            expect(pause).toHaveBeenCalledTimes(1);
            expect(seek).not.toHaveBeenCalled();
            expect(bindingInternals._pendingAutoRepeatTargetTimestamp).toBe(0);
        } else {
            expect(seek).toHaveBeenCalledTimes(1);
            expect(seek).toHaveBeenCalledWith(2);
            expect(pause).not.toHaveBeenCalled();
        }

        pause.mockClear();
        seek.mockClear();

        if (hasAutoPause && hasRepeat) {
            bindingInternals.autoPausePreference = AutoPausePreference.atStart;

            subtitleController.autoPauseContext.onWillStopShowing?.(subtitle);

            expect(seek).toHaveBeenCalledTimes(1);
            expect(seek).toHaveBeenCalledWith(2);
            expect(pause).not.toHaveBeenCalled();
            expect(bindingInternals._pendingAutoRepeatTargetTimestamp).toBe(0);

            seek.mockClear();
        }
    }

    if (hasCondensed) {
        video.paused = false;
        video.currentTime = 0;

        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 3000, end: 3500 }));

        if (hasRepeat) {
            expect(seek).not.toHaveBeenCalled();
            expect(play).not.toHaveBeenCalled();
        } else {
            expect(seek).toHaveBeenCalledTimes(1);
            expect(seek).toHaveBeenCalledWith(3);
            expect(play).toHaveBeenCalledTimes(1);
        }

        seek.mockClear();
        play.mockClear();
    }

    if (hasFastForward) {
        video.currentTime = 1;
        video.playbackRate = 1;

        await subtitleController.onSeekableSlice?.({
            showing: [],
            lastShown: [makeSubtitle({ start: 0, end: 200, index: 0 })],
            nextToShow: [makeSubtitle({ start: 2000, end: 2500, index: 1 })],
            startedShowing: undefined,
            willStopShowing: undefined,
        });
        expect(video.playbackRate).toBe(2.7);

        await subtitleController.onSeekableSlice?.({
            showing: [makeSubtitle({ start: 1000, end: 1400, index: 0 })],
            lastShown: undefined,
            nextToShow: undefined,
            startedShowing: undefined,
            willStopShowing: undefined,
        });
        expect(video.playbackRate).toBe(1);
    }
}

describe('Binding playback modes', () => {
    beforeEach(() => {
        (globalThis as any).browser = {
            storage: {
                local: new MockStorageArea(),
            },
            runtime: {
                sendMessage: jest.fn(),
                onMessage: {
                    addListener: jest.fn(),
                },
            },
        };
    });

    afterEach(() => {
        delete (globalThis as any).browser;
        jest.restoreAllMocks();
    });

    it('constructs a real binding and applies playback modes through its real methods', async () => {
        const video = createVideoStub();
        const binding = new Binding(video as unknown as HTMLMediaElement, false);

        expect(binding.video).toBe(video);
        expect(binding.registeredVideoSrc).toBe(video.src);
        expect(binding.synced).toBe(false);
        expect(binding.recordingMedia).toBe(false);
        expect(sortedModes(binding.playModes)).toEqual([PlayMode.normal]);

        binding.togglePlayMode(PlayMode.autoPause);
        await binding.subtitleController.autoPauseContext.onWillStopShowing?.(makeSubtitle({ start: 2000, end: 2600 }));

        expect(video.pause).toHaveBeenCalledTimes(1);

        binding.togglePlayMode(PlayMode.repeat);
        binding.togglePlayMode(PlayMode.condensed);
        await binding.subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 5000, end: 5500 }));

        expect(video.play).not.toHaveBeenCalled();
        expect(video.currentTime).toBe(0);
    });

    it.each(allowedModeCombinations.map((modes) => [modes]))(
        'supports the allowed mode combination %j',
        async (modes) => {
            const harness = createBindingHarness();

            await assertCombinationBehavior(harness, modes);
        }
    );

    it('consumes the pending repeat target on play after auto-pause plus repeat schedules it', () => {
        const harness = createBindingHarness();
        const { binding, bindingInternals, seek, subtitleController } = harness;

        enableModes(binding, [PlayMode.autoPause, PlayMode.repeat]);
        bindingInternals.autoPausePreference = AutoPausePreference.atEnd;
        subtitleController.autoPauseContext.onWillStopShowing?.(makeSubtitle({ start: 4500, end: 5000 }));

        bindingInternals._subscribe();
        bindingInternals.playListener(new Event('play'));

        expect(seek).toHaveBeenLastCalledWith(4.5);
        expect(bindingInternals._pendingAutoRepeatTargetTimestamp).toBe(0);
    });

    it('clears pending repeat state and the auto-pause context on seeked', () => {
        const harness = createBindingHarness();
        const { bindingInternals, clearAutoPauseContext, video } = harness;

        bindingInternals._pendingAutoRepeatTargetTimestamp = 9;
        video.currentTime = 12;
        video.readyState = 3;
        bindingInternals._subscribe();

        bindingInternals.seekedListener(new Event('seeked'));

        expect(bindingInternals._pendingAutoRepeatTargetTimestamp).toBe(0);
        expect(clearAutoPauseContext).toHaveBeenCalledTimes(1);
    });

    it('does not seek during condensed playback when the gap is too small or the video is paused', async () => {
        const harness = createBindingHarness();
        const { binding, seek, play, subtitleController, video } = harness;

        enableModes(binding, [PlayMode.condensed]);

        video.currentTime = 2.2;
        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 3000, end: 3500 }));
        video.paused = true;
        video.currentTime = 0;
        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 4000, end: 4500 }));

        expect(seek).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
    });

    it('does not auto-pause at subtitle start while recording or when configured to pause at the end', () => {
        const harness = createBindingHarness();
        const { binding, bindingInternals, pause, subtitleController } = harness;

        enableModes(binding, [PlayMode.autoPause]);
        bindingInternals.autoPausePreference = AutoPausePreference.atStart;
        bindingInternals.recordingState = 1;
        subtitleController.autoPauseContext.onStartedShowing?.(makeSubtitle());

        expect(pause).not.toHaveBeenCalled();

        bindingInternals.recordingState = 2;
        bindingInternals.autoPausePreference = AutoPausePreference.atEnd;
        subtitleController.autoPauseContext.onStartedShowing?.(makeSubtitle());

        expect(pause).not.toHaveBeenCalled();
    });

    it('does not seek during condensed playback while recording', async () => {
        const harness = createBindingHarness();
        const { binding, bindingInternals, seek, play, subtitleController, video } = harness;

        enableModes(binding, [PlayMode.condensed]);
        bindingInternals.recordingState = 1;
        video.paused = false;
        video.currentTime = 0;

        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 3000, end: 3500 }));

        expect(seek).not.toHaveBeenCalled();
        expect(play).not.toHaveBeenCalled();
    });

    it('ignores concurrent condensed playback callbacks while a seek is in progress', async () => {
        const harness = createBindingHarness();
        const { binding, seek, play, subtitleController, video } = harness;
        let finishPlay: (() => void) | undefined;
        play.mockImplementationOnce(() => new Promise<undefined>((resolve) => (finishPlay = () => resolve(undefined))));

        enableModes(binding, [PlayMode.condensed]);
        video.paused = false;
        video.currentTime = 0;

        const firstSeek = subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 3000, end: 3500 }));
        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 5000, end: 5500 }));

        expect(seek).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledWith(3);
        expect(play).toHaveBeenCalledTimes(1);

        finishPlay?.();
        await firstSeek;
    });

    it('lets repeat take precedence over condensed playback on the same subtitle transition', async () => {
        const harness = createBindingHarness();
        const { binding, seek, play, subtitleController, video } = harness;

        enableModes(binding, [PlayMode.repeat, PlayMode.condensed]);
        video.paused = false;
        video.currentTime = 2.6;

        subtitleController.autoPauseContext.onWillStopShowing?.(makeSubtitle({ start: 2000, end: 2600 }));
        await subtitleController.onNextSeekableToShow?.(makeSubtitle({ start: 5000, end: 5500 }));

        expect(seek).toHaveBeenCalledTimes(1);
        expect(seek).toHaveBeenCalledWith(2);
        expect(play).not.toHaveBeenCalled();
    });

    it('keeps fast forward at normal speed when subtitle edges are too close to the current time', async () => {
        const harness = createBindingHarness();
        const { binding, subtitleController, video } = harness;

        enableModes(binding, [PlayMode.fastForward]);
        video.currentTime = 1;
        video.playbackRate = 1;

        await subtitleController.onSeekableSlice?.({
            showing: [],
            lastShown: [makeSubtitle({ start: 0, end: 700, index: 0 })],
            nextToShow: [makeSubtitle({ start: 1500, end: 1800, index: 1 })],
            startedShowing: undefined,
            willStopShowing: undefined,
        });

        expect(video.playbackRate).toBe(1);
    });

    it('fast-forwards before the first subtitle and after the last subtitle when one edge is absent', async () => {
        const harness = createBindingHarness();
        const { binding, subtitleController, video } = harness;

        enableModes(binding, [PlayMode.fastForward]);
        video.currentTime = 1;

        await subtitleController.onSeekableSlice?.({
            showing: [],
            lastShown: undefined,
            nextToShow: [makeSubtitle({ start: 3000, end: 3500 })],
            startedShowing: undefined,
            willStopShowing: undefined,
        });
        expect(video.playbackRate).toBe(2.7);

        await subtitleController.onSeekableSlice?.({
            showing: [],
            lastShown: [makeSubtitle({ start: 0, end: 200 })],
            nextToShow: undefined,
            startedShowing: undefined,
            willStopShowing: undefined,
        });
        expect(video.playbackRate).toBe(2.7);
    });

    it('resets extension fast-forward state when condensed mode replaces it', () => {
        const harness = createBindingHarness();
        const { binding, subtitleController, updateModel, video } = harness;

        binding.togglePlayMode(PlayMode.fastForward);
        video.playbackRate = 2.7;
        binding.togglePlayMode(PlayMode.condensed);

        expect(sortedModes(binding.playModes)).toEqual([PlayMode.condensed]);
        expect(subtitleController.onSeekableSlice).toBeUndefined();
        expect(typeof subtitleController.onNextSeekableToShow).toBe('function');
        expect(video.playbackRate).toBe(1);
        expect(updateModel).toHaveBeenCalledTimes(2);
    });
});
