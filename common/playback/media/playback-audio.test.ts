import PlaybackAudio from '@project/common/playback/media/playback-audio';
import type { AudioPlaybackEvent } from '@project/common/playback/media/media';

const element = () => {
    const audio = document.createElement('audio');
    let paused = true;
    Object.defineProperties(audio, {
        paused: { get: () => paused },
        readyState: { value: 3 },
        duration: { value: 12 },
        buffered: { value: { length: 1, start: () => 2, end: () => 10 } },
    });
    jest.spyOn(audio, 'play').mockImplementation(async () => {
        paused = false;
    });
    jest.spyOn(audio, 'pause').mockImplementation(() => {
        paused = true;
    });
    return audio;
};
let playbackAudio: PlaybackAudio;
let events: AudioPlaybackEvent[];
let errors: unknown[];
beforeEach(() => {
    events = [];
    errors = [];
    playbackAudio = new PlaybackAudio({
        onEvent: (event) => events.push(event),
        onError: (error) => errors.push(error),
    });
});
afterEach(() => {
    playbackAudio.unbind();
    jest.restoreAllMocks();
});

it('has no playable state without an element or source', async () => {
    playbackAudio.bind();
    expect(playbackAudio.state()).toMatchObject({ attached: false, ready: false, buffered: { start: 0, end: 0 } });
    expect(await playbackAudio.play()).toBe(false);
    const audio = element();
    playbackAudio.sourceChanged({ element: audio, source: undefined });
    expect(playbackAudio.state().attached).toBe(false);
    expect(await playbackAudio.play()).toBe(false);
    playbackAudio.sourceChanged({ element: null, source: 'blob:audio' });
    expect(playbackAudio.state().attached).toBe(false);
});

it('attaches audio, exposes millisecond state and applies media operations', async () => {
    const audio = element();
    playbackAudio.sourceChanged({ element: audio, source: 'blob:audio' });
    playbackAudio.bind();
    playbackAudio.seek(5_000);
    playbackAudio.settingsChanged({ playbackRate: 1.5, preservesPitch: false, volume: 0.4 });
    expect(audio.getAttribute('src')).toBe('blob:audio');
    expect(playbackAudio.state()).toMatchObject({
        attached: true,
        currentTimeMs: 5_000,
        durationMs: 12_000,
        ready: true,
        hasMetadata: true,
        buffered: { start: 2_000, end: 10_000 },
    });
    expect([audio.playbackRate, audio.preservesPitch, audio.volume]).toEqual([1.5, false, 0.4]);
    expect(await playbackAudio.play()).toBe(true);
    expect(playbackAudio.state().paused).toBe(false);
    playbackAudio.pause();
    expect(playbackAudio.state().paused).toBe(true);
});

it('forwards browser events and errors only while bound', () => {
    const audio = element();
    playbackAudio.sourceChanged({ element: audio, source: 'blob:audio' });
    playbackAudio.bind();
    for (const type of ['waiting', 'canplay', 'progress', 'ended']) audio.dispatchEvent(new Event(type));
    audio.dispatchEvent(new Event('error'));
    expect(events).toEqual(['waiting', 'canplay', 'progress', 'ended']);
    expect(errors).toHaveLength(1);
    playbackAudio.unbind();
    audio.dispatchEvent(new Event('progress'));
    audio.dispatchEvent(new Event('error'));
    expect(events).toHaveLength(4);
    expect(errors).toHaveLength(1);
    expect(audio.hasAttribute('src')).toBe(false);
    playbackAudio.bind();
    expect(audio.getAttribute('src')).toBe('blob:audio');
});

it('preserves playback for an unchanged source and releases a replaced element', async () => {
    const first = element(),
        second = element();
    playbackAudio.sourceChanged({ element: first, source: 'blob:first' });
    playbackAudio.bind();
    await playbackAudio.play();
    playbackAudio.sourceChanged({ element: first, source: 'blob:first' });
    expect(first.paused).toBe(false);
    playbackAudio.sourceChanged({ element: second, source: 'blob:second' });
    expect(first.paused).toBe(true);
    expect(first.hasAttribute('src')).toBe(false);
    expect(second.getAttribute('src')).toBe('blob:second');
    first.dispatchEvent(new Event('error'));
    expect(errors).toEqual([]);
});

it.each(['replacement', 'unbind'])('ignores a pending play rejection after %s', async (action) => {
    const audio = element();
    let reject!: (error: Error) => void;
    jest.mocked(audio.play).mockImplementation(
        () =>
            new Promise((_, fail) => {
                reject = fail;
            })
    );
    playbackAudio.sourceChanged({ element: audio, source: 'blob:first' });
    playbackAudio.bind();
    const playing = playbackAudio.play();
    if (action === 'replacement') playbackAudio.sourceChanged({ element: audio, source: 'blob:second' });
    else playbackAudio.unbind();
    reject(new DOMException('Old source failed', 'NotSupportedError'));
    expect(await playing).toBe(false);
});

it('ignores interrupted plays and propagates actual playback failures', async () => {
    const audio = element();
    playbackAudio.sourceChanged({ element: audio, source: 'blob:audio' });
    playbackAudio.bind();
    jest.mocked(audio.play).mockRejectedValue(new DOMException('Interrupted', 'AbortError'));
    expect(await playbackAudio.play()).toBe(false);
    const error = new DOMException('Denied', 'NotAllowedError');
    jest.mocked(audio.play).mockRejectedValue(error);
    await expect(playbackAudio.play()).rejects.toBe(error);
});
