/** @jest-environment node */
import ExternalAudioController from '@project/common/playback/controllers/external-audio-controller';

const controllers: ExternalAudioController[] = [];
const flush = async () => {
    for (let index = 0; index < 4; index++) await Promise.resolve();
};
const harness = ({ positionMs = 0, streaming = true, active = true } = {}) => {
    const video = {
        currentTimeMs: positionMs,
        paused: false,
        ready: true,
        playbackRate: 1,
        preservesPitch: true,
        volume: 1,
        muted: false,
    };
    const audio = {
        attached: true,
        currentTimeMs: 0,
        durationMs: NaN,
        paused: true,
        ended: false,
        hasMetadata: false,
        ready: false,
        buffered: { start: 0, end: 0 },
    };
    const errors: unknown[] = [];
    const seeks: number[] = [];
    let playbackFailure: Error | undefined;
    const controller = new ExternalAudioController({
        videoState: () => video,
        audioState: () => audio,
        pause: () => {
            video.paused = true;
            controller.videoEvent('pause');
        },
        play: async () => {
            video.paused = false;
            controller.videoEvent('play');
        },
        seek: async (timestampMs) => {
            seeks.push(timestampMs);
            video.currentTimeMs = timestampMs;
        },
        pauseAudio: () => {
            audio.paused = true;
        },
        playAudio: async () => {
            if (playbackFailure) throw playbackFailure;
            audio.paused = false;
            return true;
        },
        seekAudio: (timestampMs) => {
            audio.currentTimeMs = timestampMs;
        },
        audioSettingsChanged: () => {},
        onError: (error) => errors.push(error),
    });
    controller.trackChanged({ active, streaming });
    controller.bind();
    controllers.push(controller);
    const available = (endMs: number) => {
        audio.hasMetadata = true;
        audio.ready = true;
        audio.buffered.end = endMs;
        controller.audioEvent('canplay');
    };
    return {
        controller,
        video,
        audio,
        errors,
        seeks,
        available,
        rejectPlayback: (error: Error) => {
            playbackFailure = error;
        },
    };
};
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
    for (const controller of controllers.splice(0)) controller.unbind();
    jest.useRealTimers();
});

it('holds startup and audio stalls, then resumes both at the same position', () => {
    const h = harness({ positionMs: 5_000 });
    expect(h.video.paused).toBe(true);
    h.available(10_000);
    expect(h.video.paused).toBe(false);
    expect(h.audio.paused).toBe(false);
    expect(h.audio.currentTimeMs).toBe(5_000);
    h.audio.ready = false;
    h.controller.audioEvent('waiting');
    expect(h.video.paused).toBe(true);
    expect(h.audio.paused).toBe(true);
    h.available(20_000);
    expect(h.video.paused).toBe(false);
    expect(h.audio.paused).toBe(false);
});

it('cancels buffering recovery for a deliberate pause even without another pause event', () => {
    const h = harness();
    h.controller.pauseRequested();
    h.available(10_000);
    jest.advanceTimersByTime(1_000);
    expect(h.video.paused).toBe(true);
    expect(h.audio.paused).toBe(true);
});

it('waits for video readiness before recovering from an audio stall', () => {
    const h = harness();
    h.video.ready = false;
    h.controller.videoEvent('waiting');
    h.available(10_000);
    expect(h.video.paused).toBe(true);
    h.video.ready = true;
    h.controller.videoEvent('canplay');
    expect(h.video.paused).toBe(false);
});

it('clamps deliberate seeks but lets a restored position wait for conversion', () => {
    const h = harness();
    h.available(10_000);
    expect(h.controller.clampSeekMs(500_000)).toBe(9_980);
    expect(h.controller.clampSeekMs(60_000, { restorePlaybackPosition: true })).toBe(60_000);
    h.video.currentTimeMs = 60_000;
    h.controller.videoEvent('seeking');
    h.controller.videoEvent('seeked');
    expect(h.seeks).toEqual([]);
    expect(h.video.paused).toBe(true);
    h.available(30_000);
    expect(h.video.paused).toBe(true);
    h.available(70_000);
    expect(h.video.paused).toBe(false);
    expect(h.audio.currentTimeMs).toBe(60_000);
    h.video.currentTimeMs = 500_000;
    h.controller.videoEvent('seeking');
    expect(h.seeks).toEqual([69_980]);
});

it('retains the current position while a reconstructed stream catches up', () => {
    const h = harness({ positionMs: 60_000 });
    h.available(5_000);
    expect(h.video.currentTimeMs).toBe(60_000);
    expect(h.video.paused).toBe(true);
    h.available(70_000);
    expect(h.audio.currentTimeMs).toBe(60_000);
    expect(h.video.paused).toBe(false);
});

it('continues video after completed audio EOF and restarts audio on a backward seek', () => {
    const h = harness({ streaming: false });
    h.audio.durationMs = 3_000;
    h.available(3_000);
    h.video.currentTimeMs = 4_000;
    h.audio.currentTimeMs = 3_000;
    h.audio.ready = false;
    h.controller.audioEvent('waiting');
    h.controller.audioEvent('ended');
    expect(h.video.paused).toBe(false);
    expect(h.audio.paused).toBe(true);
    h.audio.ready = true;
    h.video.currentTimeMs = 1_000;
    h.controller.videoEvent('seeked');
    expect(h.audio.currentTimeMs).toBe(1_000);
    expect(h.audio.paused).toBe(false);
});

it('corrects drift and restarts stopped audio on the explicit polling interval', () => {
    const h = harness();
    h.available(20_000);
    h.video.currentTimeMs = 5_000;
    h.audio.paused = true;
    jest.advanceTimersByTime(249);
    expect(h.audio.currentTimeMs).toBe(0);
    jest.advanceTimersByTime(1);
    expect(h.audio.currentTimeMs).toBe(5_000);
    expect(h.audio.paused).toBe(false);
});

it('reports playback rejection once and does not resume silent video', async () => {
    const h = harness();
    const error = new Error('Playback denied');
    h.rejectPlayback(error);
    h.available(10_000);
    await flush();
    h.available(20_000);
    jest.advanceTimersByTime(1_000);
    await flush();
    expect(h.errors).toEqual([error]);
    expect(h.video.paused).toBe(true);
    expect(h.audio.paused).toBe(true);
});

it('stops recovery on fatal audio errors and unbind', () => {
    const h = harness();
    h.available(10_000);
    const error = new Error('Decode failed');
    h.controller.audioError(error);
    h.available(20_000);
    expect(h.errors).toEqual([error]);
    expect(h.video.paused).toBe(true);
    h.controller.unbind();
    h.available(30_000);
    jest.advanceTimersByTime(1_000);
    expect(h.video.paused).toBe(true);
});

it('does nothing when conversion is inactive', () => {
    const h = harness({ active: false });
    h.available(10_000);
    h.controller.videoEvent('waiting');
    h.controller.audioEvent('waiting');
    expect(h.video.paused).toBe(false);
    expect(h.controller.clampSeekMs(500_000)).toBe(500_000);
});
