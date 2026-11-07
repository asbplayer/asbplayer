/** @jest-environment node */
import { afterAll, afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import AudioClip from '@project/common/audio-clip/audio-clip';
import type { CardModel, FileModel } from '@project/common';
import { AudioErrorCode } from '@project/common';
import { createBlobUrl, isActiveBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { webmHeader } from '@project/common/audio-transcode/test-host';
import { finalizeWebmAudio } from '@project/common/audio-transcode/webm-audio';

// Metadata is real WebM; only browser recording APIs are replaced in these Node tests.
const cluster = (timestamp: number) => {
    const bytes = new Uint8Array([
        0x1f, 0x43, 0xb6, 0x75, 0x8f, 0xe7, 0x84, 0, 0, 0, 0, 0xa3, 0x87, 0x81, 0, 40, 0x80, 1, 2, 3,
    ]);
    new DataView(bytes.buffer).setUint32(7, timestamp);
    return bytes;
};
const prefix = (timestamp = 1000) => new Blob([webmHeader, cluster(timestamp)], { type: 'audio/webm' });
const sources: string[] = [];
const fileFor = (audio?: Blob, complete = false): FileModel => {
    const transcodedAudio = AudioClip.createTranscodedAudioSource({ audio, complete, required: true });
    if (transcodedAudio?.blobUrl) sources.push(transcodedAudio.blobUrl);
    return { name: 'video.mkv', blobUrl: 'blob:original-dolby', transcodedAudio };
};
const cardFor = (file: FileModel): CardModel => ({
    file,
    subtitle: { text: 'line', start: 500, end: 1000, originalStart: 500, originalEnd: 1000, track: 0 },
    surroundingSubtitles: [],
    subtitleFileName: 'video.srt',
    mediaTimestamp: 500,
});

const originalGlobals = Object.getOwnPropertyDescriptors(globalThis);
afterAll(() => {
    for (const name of ['Audio', 'HTMLMediaElement', 'MediaStream', 'MediaRecorder']) {
        const original = originalGlobals[name];
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
    }
});

let createdAudio: Promise<TestAudio>;
let audioCreated: (audio: TestAudio) => void;
class TestAudio {
    src = '';
    currentTime = 0;
    playbackRate = 1;
    audioTracks = [
        { id: 'default', enabled: true },
        { id: 'selected', enabled: false },
    ];
    seeking = false;
    readyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
    duration = 10;
    seekable = { length: 1, end: () => this.duration };
    onended: (() => void) | null = null;
    play = jest.fn(async () => {});
    pause() {}
    load() {}
    removeAttribute(name: string) {
        if (name === 'src') this.src = '';
    }
    captureStream() {
        return new TestStream();
    }
    constructor() {
        audioCreated(this);
    }
}
class TestStream {
    addTrack() {}
    getAudioTracks() {
        return [{ enabled: true, stop() {} }];
    }
    getVideoTracks() {
        return [];
    }
}
class TestRecorder {
    static isTypeSupported() {
        return true;
    }
    state = 'inactive';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
        this.state = 'recording';
    }
    stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['recorded audio']) });
        this.onstop?.();
    }
}

beforeEach(() => {
    jest.useFakeTimers();
    createdAudio = new Promise((resolve) => (audioCreated = resolve));
    Object.assign(globalThis, {
        Audio: TestAudio,
        HTMLMediaElement: { HAVE_FUTURE_DATA: 3, HAVE_ENOUGH_DATA: 4 },
        MediaStream: TestStream,
        MediaRecorder: TestRecorder,
    });
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    for (const source of sources.splice(0)) revokeBlobUrl(source);
});

it('constructs, names and slices synchronously without reading converted audio', () => {
    const fetchSource = jest.spyOn(globalThis, 'fetch');
    const file = fileFor(prefix());
    const clip = AudioClip.fromCard(cardFor(file), 1000, 1000, true)!;
    expect(clip.start).toBe(0);
    expect(clip.name).toBe('video.mkv_0.ogg');
    expect(clip.error).toBeUndefined();
    expect(clip.slice(700, 2000).start).toBe(700);
    expect(fetchSource).not.toHaveBeenCalled();
});

it('shares the frozen source duration across slices and encoders without starting a recording', async () => {
    const fetchSource = jest.spyOn(globalThis, 'fetch');
    const clip = AudioClip.fromFile(fileFor(prefix()), 0, 500, 1, false);
    const encoder = jest.fn(async (audio: Blob) => audio);
    await expect(clip.sourceDurationMs()).resolves.toBe(1040);
    await expect(clip.slice(100, 200).sourceDurationMs()).resolves.toBe(1040);
    await expect(clip.toEncoded(encoder, 'mp3').sourceDurationMs()).resolves.toBe(1040);
    await expect(
        clip
            .toMp3(() => {
                throw new Error('No recording or encoding needed');
            })
            .sourceDurationMs()
    ).resolves.toBe(1040);
    expect(fetchSource).toHaveBeenCalledTimes(1);
    expect(encoder).not.toHaveBeenCalled();
});

it('reads the completed snapshot boundary and returns no limit for ordinary file audio', async () => {
    const audio = await finalizeWebmAudio([prefix()], 3.002);
    await expect(AudioClip.fromFile(fileFor(audio, true), 0, 500, 1, false).sourceDurationMs()).resolves.toBeCloseTo(
        3002
    );
    await expect(
        AudioClip.fromFile({ name: 'ordinary.mp4', blobUrl: 'blob:ordinary' }, 0, 500, 1, false).sourceDurationMs()
    ).resolves.toBeUndefined();
});

it('keeps mining without audio usable and never records from the original Dolby track', async () => {
    expect(AudioClip.createTranscodedAudioSource({ required: false, complete: false })).toBeUndefined();
    const file = fileFor();
    expect(AudioClip.fromCard(cardFor(file), 0, 0, false)).toBeUndefined();
    const clip = AudioClip.fromFile(file, 0, 1000, 1, false);
    expect(clip.error).toBe(AudioErrorCode.captureFailed);
    await expect(clip.blob()).rejects.toThrow('outside the converted portion');
    await expect(clip.play()).rejects.toThrow('outside the converted portion');
});

it.each([new Blob([webmHeader]), prefix()])('rejects requests beyond the captured audio', async (audio) => {
    const clip = AudioClip.fromFile(fileFor(audio), 2000, 5000, 1, false);
    await expect(clip.blob()).rejects.toThrow('outside the converted portion');
    await expect(clip.play()).rejects.toThrow('outside the converted portion');
    await expect(clip.slice(3000, 6000).blob()).rejects.toThrow('outside the converted portion');
});

it('omits unavailable audio from exports, including encoded clips, while preserving actual failures', async () => {
    const clip = AudioClip.fromFile(fileFor(new Blob([webmHeader])), 0, 1000, 1, false);
    const encoder = jest.fn(async (blob: Blob) => blob);
    await expect(clip.toEncoded(encoder, 'mp3').base64()).resolves.toBe('');
    await expect(
        clip
            .toMp3(() => {
                throw new Error('No worker needed');
            })
            .base64()
    ).resolves.toBe('');
    expect(clip.error).toBe(AudioErrorCode.captureFailed);
    expect(encoder).not.toHaveBeenCalled();
    const file = fileFor(prefix());
    revokeBlobUrl(file.transcodedAudio!.blobUrl!);
    await expect(AudioClip.fromFile(file, 0, 1000, 1, false).base64()).rejects.toThrow();
});

it.each(['original', 'encoded', 'mp3'])(
    'reports lazy availability errors through %s clips and supports unsubscribe',
    async (kind) => {
        const original = AudioClip.fromFile(fileFor(new Blob([webmHeader])), 0, 1000, 1, false);
        const clip =
            kind === 'encoded'
                ? original.toEncoded(async (blob) => blob, 'mp3')
                : kind === 'mp3'
                  ? original.toMp3(() => {
                        throw new Error('No worker needed');
                    })
                  : original;
        const errors: (AudioErrorCode | undefined)[] = [];
        const removed = jest.fn();
        const remove = clip.onEvent('error', removed);
        clip.onEvent('error', () => errors.push(clip.error));
        remove();
        await expect(clip.base64()).resolves.toBe('');
        await expect(clip.base64()).resolves.toBe('');
        expect(errors).toEqual([AudioErrorCode.captureFailed]);
        expect(removed).not.toHaveBeenCalled();
    }
);

it('reports source read failures without treating them as absent audio', async () => {
    const clip = AudioClip.fromFile(fileFor(prefix()), 0, 1000, 1, false);
    const failure = new Error('Could not read captured source');
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(failure);
    const errors: (AudioErrorCode | undefined)[] = [];
    clip.onEvent('error', () => errors.push(clip.error));
    await expect(clip.base64()).rejects.toBe(failure);
    expect(errors).toEqual([AudioErrorCode.captureFailed]);
});

it.each([false, true])('resolves track selection before recording (converted: %s)', async (converted) => {
    const file = converted
        ? fileFor(prefix())
        : {
              name: 'video.mkv',
              blobUrl: createBlobUrl(prefix()),
          };
    if (!converted) sources.push(file.blobUrl);
    const clip = AudioClip.fromFile(file, 0, 1000, 1, true, 'selected').slice(100, 900);
    await clip.play();
    const media = await createdAudio;
    await jest.advanceTimersByTimeAsync(100);
    expect(media.audioTracks.map((track) => track.enabled)).toEqual(converted ? [true, false] : [false, true]);
    clip.stop();
    const source = converted ? file.transcodedAudio!.blobUrl! : file.blobUrl;
    expect(isActiveBlobUrl(source)).toBe(true);
    await expect(fetch(source)).resolves.toMatchObject({ ok: true });
});

it.each([false, true])('bounds recording and revokes temporary URLs (complete: %s)', async (complete) => {
    const audio = complete ? await finalizeWebmAudio([prefix()], 3.002) : prefix();
    const file = fileFor(audio, complete);
    const clip = AudioClip.fromCard(cardFor(file), 1000, 5000, true)!;
    const recorded = clip.blob();
    const media = await createdAudio;
    const source = media.src;
    const sourceBytes = await (await fetch(source)).arrayBuffer();
    expect(new DataView(sourceBytes).getFloat64(25)).toBeCloseTo(complete ? 3002 : 1040);
    await jest.advanceTimersByTimeAsync(100);
    expect(media.currentTime).toBe(0);
    expect(media.play).toHaveBeenCalled();
    let finished = false;
    void recorded.then(() => (finished = true));
    const duration = complete ? 3002 : 1040;
    await jest.advanceTimersByTimeAsync(duration + 99);
    expect(finished).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await (await recorded).text()).toBe('recorded audio');
    await expect(fetch(source)).rejects.toThrow();
    expect(isActiveBlobUrl(file.transcodedAudio!.blobUrl!)).toBe(true);
});

it('shares lazy preparation with slices and forwards playback events registered before preparation', async () => {
    const fetchSource = jest.spyOn(globalThis, 'fetch');
    const file = fileFor(prefix());
    const clip = AudioClip.fromFile(file, 2000, 5000, 1, true);
    await expect(clip.blob()).rejects.toThrow('outside the converted portion');
    const slice = clip.slice(700, 5000);
    const events: string[] = [];
    const removePlay = slice.onEvent('play', () => events.push('play'));
    slice.onEvent('pause', () => events.push('pause'));
    await slice.play();
    const media = await createdAudio;
    await jest.advanceTimersByTimeAsync(100);
    expect(media.currentTime).toBe(0.7);
    expect(events).toContain('play');
    removePlay();
    slice.stop();
    expect(slice.playing).toBe(false);
    expect(events.at(-1)).toBe('pause');
    expect(fetchSource).toHaveBeenCalledTimes(1);
});

it('stopping during lazy preparation prevents playback from starting later', async () => {
    const clip = AudioClip.fromFile(fileFor(prefix()), 0, 1000, 1, true);
    const play = clip.play();
    clip.stop();
    await play;
    expect(clip.playing).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});

it('freezes the same source across documents while later conversion advances independently', async () => {
    const captured = { audio: prefix(), required: true, complete: false };
    const dialog = AudioClip.createTranscodedAudioSource(captured)!;
    const history = AudioClip.createTranscodedAudioSource(structuredClone(captured))!;
    sources.push(dialog.blobUrl!, history.blobUrl!);
    const newerFile = fileFor(prefix(2000));
    expect(dialog.blobUrl).not.toBe(history.blobUrl);
    const oldClip = AudioClip.fromFile({ name: 'video', blobUrl: '', transcodedAudio: history }, 1500, 1800, 1, true);
    await expect(oldClip.blob()).rejects.toThrow('outside the converted portion');
    revokeBlobUrl(dialog.blobUrl!);
    expect(isActiveBlobUrl(history.blobUrl!)).toBe(true);
    const newClip = AudioClip.fromFile(newerFile, 1500, 1800, 1, true);
    const recorded = newClip.blob();
    await createdAudio;
    await jest.advanceTimersByTimeAsync(500);
    await expect(recorded).resolves.toBeInstanceOf(Blob);
});
