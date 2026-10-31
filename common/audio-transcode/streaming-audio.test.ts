/** @jest-environment node */
import {
    audioBufferedRange,
    clampAudioSeekMs,
    createStreamingAudio,
} from '@project/common/audio-transcode/streaming-audio';

const range = (start = 0, end = 0): TimeRanges => ({ length: end > start ? 1 : 0, start: () => start, end: () => end });
class Buffer extends EventTarget {
    updating = false;
    buffered = range();
    bytes: number[] = [];
    quota = false;
    appendBuffer(bytes: ArrayBuffer) {
        if (this.quota) throw new DOMException('Full', 'QuotaExceededError');
        this.bytes.push(...new Uint8Array(bytes));
        this.updating = true;
    }
    update(end: number) {
        this.updating = false;
        this.buffered = range(0, end);
        this.dispatchEvent(new Event('updateend'));
    }
    remove(_start: number, end: number) {
        this.buffered = range(end, this.buffered.end(0));
        this.quota = false;
        this.update(this.buffered.end(0));
    }
    abort() {
        this.updating = false;
    }
}
class Source extends EventTarget {
    static isTypeSupported = () => true;
    static latest: Source;
    readyState = 'closed';
    buffer = new Buffer();
    constructor() {
        super();
        Source.latest = this;
    }
    addSourceBuffer() {
        return this.buffer;
    }
    open() {
        this.readyState = 'open';
        this.dispatchEvent(new Event('sourceopen'));
    }
}
const tick = () => new Promise(setImmediate);
beforeEach(() => {
    Object.defineProperty(globalThis, 'MediaSource', { value: Source, configurable: true });
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stream');
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { MediaSource?: unknown }).MediaSource;
});

it('clamps millisecond seeks to accepted media rather than encoded progress', () => {
    expect(clampAudioSeekMs(20_000, undefined)).toBe(20_000);
    expect(clampAudioSeekMs(-1, undefined)).toBe(0);
    expect(clampAudioSeekMs(20_000, { start: 0, end: 0 })).toBe(0);
    expect(clampAudioSeekMs(20_000, { start: 0, end: 10_000 })).toBe(9_980);
    expect(clampAudioSeekMs(5_000, { start: 0, end: 10_000 })).toBe(5_000);
    expect(clampAudioSeekMs(0, { start: 4_000, end: 10_000 })).toBe(4_000);
    expect(audioBufferedRange(range())).toEqual({ start: 0, end: 0 });
    expect(audioBufferedRange(range(4, 10))).toEqual({ start: 4_000, end: 10_000 });
});

it('appends a growing prefix in order without rereading its prior bytes', async () => {
    const buffered: unknown[] = [],
        errors: unknown[] = [];
    const stream = createStreamingAudio({
        currentTimeMs: () => 0,
        onBuffered: (value) => buffered.push(value),
        onError: (value) => errors.push(value),
    });
    stream.append(new Blob([new Uint8Array([1, 2])]));
    expect(Source.latest.buffer.bytes).toEqual([]);
    Source.latest.open();
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([1, 2]);
    stream.append(new Blob([new Uint8Array([1, 2, 3])]));
    expect(Source.latest.buffer.bytes).toEqual([1, 2]);
    Source.latest.buffer.update(2);
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([1, 2, 3]);
    expect(buffered).toEqual([{ start: 0, end: 2_000 }]);
    expect(errors).toEqual([]);
    stream.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stream');
});

it('bounds browser buffering ahead of playback and retries a full buffer after playback advances', async () => {
    let time = 0;
    const stream = createStreamingAudio({
        currentTimeMs: () => time,
        onBuffered: () => {},
        onError: (error) => {
            throw error;
        },
    });
    Source.latest.open();
    stream.append(new Blob([new Uint8Array([1])]));
    await tick();
    Source.latest.buffer.update(125);
    stream.append(new Blob([new Uint8Array([1, 2])]));
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([1]);
    time = 20_000;
    Source.latest.buffer.quota = true;
    stream.append(new Blob([new Uint8Array([1, 2])]));
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([1]);
    time = 60_000;
    stream.append(new Blob([new Uint8Array([1, 2])]));
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([1, 2]);
    stream.dispose();
});

it('does not append bytes from an outstanding read after disposal', async () => {
    const stream = createStreamingAudio({ currentTimeMs: () => 0, onBuffered: () => {}, onError: () => {} });
    Source.latest.open();
    stream.append(new Blob([new Uint8Array([1])]));
    stream.dispose();
    await tick();
    expect(Source.latest.buffer.bytes).toEqual([]);
});
