import { afterAll, afterEach, beforeAll, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';
import { SubtitleHtml } from '@project/common';
import type { LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleStream, subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedSubtitleProducer } from '@project/common/embedded-subtitles/embedded-subtitle-producer';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import type {
    SubtitleHost,
    SubtitleExtractionOptions,
    ExtractedSubtitleFile,
} from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';
import type { SubtitleOutputFormat } from '@project/ffmpeg/protocol';

const encoder = new TextEncoder();
const originalText = Object.getOwnPropertyDescriptor(Blob.prototype, 'text');
const originalBytes = Object.getOwnPropertyDescriptor(Blob.prototype, 'arrayBuffer');

beforeAll(() => {
    Object.assign(globalThis, { TextDecoder });
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
    Object.defineProperty(Blob.prototype, 'text', {
        configurable: true,
        value: function (this: Blob) {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(this);
            });
        },
    });
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
        configurable: true,
        value: function (this: Blob) {
            return new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(this);
            });
        },
    });
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});
// Restore missing jsdom methods after this file's tests.
afterAll(() => {
    if (originalText) Object.defineProperty(Blob.prototype, 'text', originalText);
    else Reflect.deleteProperty(Blob.prototype, 'text');
    if (originalBytes) Object.defineProperty(Blob.prototype, 'arrayBuffer', originalBytes);
    else Reflect.deleteProperty(Blob.prototype, 'arrayBuffer');
});

const createReader = () =>
    new SubtitleReader({
        regexFilter: 'speaker: ',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: async () => {
            throw new Error('Text source');
        },
    });

async function loading(format: SubtitleOutputFormat = ffmpegSubtitleFormats.text.extension) {
    const source = {
        id: 'video',
        file: new File(
            [
                Uint8Array.from(
                    mkv(mkvTrack(1, 'V_VP8'), mkvTrack(17, format === 'srt' ? 'S_TEXT/UTF8' : 'S_HDMV/PGS'))
                ).buffer,
            ],
            'video.mkv'
        ),
    };
    let options!: SubtitleExtractionOptions;
    let complete!: (files: ExtractedSubtitleFile[]) => void;
    let fail!: (error: Error) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
    });
    const extract = jest.fn(
        ({ signal, ...rest }: SubtitleExtractionOptions) =>
            new Promise<ExtractedSubtitleFile[]>((resolve, reject) => {
                options = { signal, ...rest };
                complete = resolve;
                fail = reject;
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
                started();
            })
    );
    const service = new EmbeddedSubtitles({ extractSubtitles: extract });
    const descriptor = embeddedDescriptor(source, {
        trackIndex: 0,
        codec: format === 'srt' ? 'subrip' : 'hdmv_pgs_subtitle',
        outputFormat: format,
    });
    const file = [...(await service.prepare(source, [descriptor], new AbortController().signal)).values()][0];
    const external = {
        id: 'external',
        file: new File(['WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nExternal\n'], 'external.vtt'),
    };
    const tracks = [{ fileParts: [file] }, { fileParts: [external] }, { fileParts: [file] }];
    const reader = createReader();
    const onComplete = jest.fn<(tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>>(
        async () => {}
    );
    const stream = new SubtitleStream();
    let published!: () => void;
    const firstCue = new Promise<void>((resolve) => {
        published = resolve;
    });
    const abort = new AbortController();
    const produce = embeddedSubtitleProducer({
        source,
        tracks,
        pendingDescriptors: [descriptor],
        reader,
        service,
        errorMessage: 'Failed to load embedded subtitles',
        onComplete,
    });
    const updates: SubtitleSourceUpdate[] = [];
    const run = produce((update) => {
        updates.push(update);
        stream.update(update);
        if (update.type === 'cues' && update.track === 0) published();
    }, abort.signal);
    await ready;
    const bytes: ArrayBuffer[] = [];
    const emit = (chunk: Uint8Array) => {
        const buffer = Uint8Array.from(chunk).buffer;
        bytes.push(buffer);
        options.onChunk(0, buffer);
    };
    const finish = () =>
        complete([
            {
                trackIndex: 0,
                format,
                blob: new Blob(bytes, {
                    type: format === 'srt' ? ffmpegSubtitleFormats.text.mimeType : ffmpegSubtitleFormats.image.mimeType,
                }),
            },
        ]);
    return { emit, finish, fail, run, firstCue, stream, onComplete, abort, extract, produce, updates };
}

it('restores completed embedded tracks immediately and extracts only the missing track', async () => {
    const source = {
        id: 'video',
        file: new File(
            [
                Uint8Array.from(mkv(mkvTrack(1, 'V_VP8'), mkvTrack(17, 'S_TEXT/UTF8'), mkvTrack(17, 'S_TEXT/UTF8')))
                    .buffer,
            ],
            'video.mkv'
        ),
    };
    const cachedDescriptor = embeddedDescriptor(source, { trackIndex: 0, codec: 'subrip', outputFormat: 'srt' });
    const pendingDescriptor = embeddedDescriptor(source, { trackIndex: 1, codec: 'subrip', outputFormat: 'srt' });
    const cached: FileWithId = {
        id: embeddedSubtitleId(source.id, 0),
        embedded: cachedDescriptor,
        file: new File(['1\n00:00:01,000 --> 00:00:02,000\nCached\n\n'], 'cached.srt', {
            type: 'application/x-subrip',
        }),
    };
    let options!: SubtitleExtractionOptions;
    let finish!: (files: ExtractedSubtitleFile[]) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
    });
    const extract = jest.fn<SubtitleHost['extractSubtitles']>(
        (request) =>
            new Promise((resolve) => {
                options = request;
                finish = resolve;
                started();
            })
    );
    const service = new EmbeddedSubtitles({ extractSubtitles: extract });
    const signal = new AbortController().signal;
    const pending = (await service.prepare(source, [pendingDescriptor], signal)).get(embeddedSubtitleId(source.id, 1))!;
    const tracks = [{ fileParts: [cached] }, { fileParts: [pending] }, { fileParts: [cached] }];
    const stream = new SubtitleStream();
    const onComplete = jest.fn<(tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>>(
        async () => {}
    );
    const produce = embeddedSubtitleProducer({
        source,
        tracks,
        pendingDescriptors: [pendingDescriptor],
        service,
        reader: createReader(),
        errorMessage: 'Failed to load embedded subtitles',
        onComplete,
    });
    const run = produce((update) => {
        stream.update(update);
    }, signal);
    await ready;
    expect(options.trackIndexes).toEqual([1]);
    expect(stream.sourceStates.map(({ status }) => status)).toEqual(['complete', 'loading', 'complete']);
    expect(stream.snapshot.subtitles.map(({ track, text }) => [track, text])).toEqual([
        [0, 'Cached'],
        [2, 'Cached'],
    ]);
    const cachedCueKeys = stream.snapshot.subtitles.map(subtitleKey);
    expect(onComplete).not.toHaveBeenCalled();

    const srt = '1\n00:00:03,000 --> 00:00:04,000\nMissing\n\n';
    options.onChunk(1, encoder.encode(srt).buffer);
    finish([{ trackIndex: 1, format: 'srt', blob: new Blob([srt], { type: 'application/x-subrip' }) }]);
    await run;

    expect(extract).toHaveBeenCalledTimes(1);
    expect(stream.sourceStates.map(({ status }) => status)).toEqual(['complete', 'complete', 'complete']);
    expect(stream.snapshot.subtitles.filter((cue) => cue.track !== 1).map(subtitleKey)).toEqual(cachedCueKeys);
    const completed = onComplete.mock.calls[0][0];
    expect(completed.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual([
        [cached.id],
        [pending.id],
        [cached.id],
    ]);
    expect(completed[0].fileParts[0]).toBe(cached);
    expect(completed[2].fileParts[0]).toBe(cached);
    expect(await completed[1].fileParts[0].file.text()).toBe(srt);
});

it('publishes complete cues before extraction finishes, fans out duplicate slots, and saves only completed output', async () => {
    const job = await loading();
    expect(job.stream.snapshot.subtitles.map((cue) => cue.text)).toEqual(['External']);
    const text = '1\r\n00:00:01,000 --> 00:00:02,000\r\nspeaker: 日本語\r\n\r\n';
    const bytes = encoder.encode(text);
    const split = encoder.encode(text.slice(0, text.indexOf('語'))).length + 1;
    job.emit(bytes.slice(0, split));
    job.emit(bytes.slice(split));
    await job.firstCue;
    expect(job.stream.snapshot.subtitles.map((cue) => [cue.track, cue.text])).toEqual([
        [1, 'External'],
        [0, '日本語'],
        [2, '日本語'],
    ]);
    expect(job.stream.sourceStates.map(({ status }) => status)).toEqual(['loading', 'complete', 'loading']);
    expect(job.onComplete).not.toHaveBeenCalled();
    job.emit(encoder.encode('2\n00:00:03,000 --> 00:00:04,000\n&lt;b&gt;literal&lt;/b&gt;'));
    job.finish();
    await job.run;
    expect(job.stream.sourceStates.every(({ status }) => status === 'complete')).toBe(true);
    expect(job.stream.snapshot.subtitles.filter((cue) => cue.track === 0).map((cue) => cue.text)).toEqual([
        '日本語',
        '&lt;b&gt;literal&lt;/b&gt;',
    ]);
    const files = job.onComplete.mock.calls[0][0];
    expect(files[0].fileParts[0]).toBe(files[2].fileParts[0]);
    expect(await files[0].fileParts[0].file.text()).toContain('speaker: 日本語');
    // Completed bytes can be replayed through the same progressive API without another worker.
    const replay = new SubtitleStream();
    await job.produce((update) => replay.update(update), new AbortController().signal);
    expect(job.extract).toHaveBeenCalledTimes(1);
    expect(replay.snapshot.subtitles.map((cue) => cue.text)).toEqual(
        job.stream.snapshot.subtitles.map((cue) => cue.text)
    );
});

it.each(['cancel', 'fail'] as const)(
    'handles buffered cues without persisting incomplete extraction on %s',
    async (action) => {
        const job = await loading();
        jest.useFakeTimers();
        job.emit(encoder.encode('1\n00:00:01,000 --> 00:00:02,000\nPartial\n\n'));
        await job.firstCue;
        job.emit(encoder.encode('2\n00:00:03,000 --> 00:00:04,000\nBuffered\n\n'));
        expect(job.stream.snapshot.subtitles.filter((cue) => cue.track === 0).map((cue) => cue.text)).toEqual([
            'Partial',
        ]);
        if (action === 'cancel') {
            job.abort.abort();
            await expect(job.run).rejects.toMatchObject({ name: 'AbortError' });
        } else {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            job.fail(new Error('Native failure'));
            await job.run;
            expect(
                job.stream.sourceStates.filter(({ track }) => track !== 1).every(({ status }) => status === 'failed')
            ).toBe(true);
        }
        expect(job.stream.snapshot.subtitles.filter((cue) => cue.track === 0).map((cue) => cue.text)).toEqual(
            action === 'cancel' ? ['Partial'] : ['Partial', 'Buffered']
        );
        expect(job.onComplete).not.toHaveBeenCalled();
        const count = job.updates.length;
        jest.advanceTimersByTime(200);
        expect(job.updates).toHaveLength(count);
        expect(jest.getTimerCount()).toBe(0);
    }
);

it('parses chunks synchronously and batches publications until 100 ms or extraction completion', async () => {
    const job = await loading();
    jest.useFakeTimers();
    const emit = (cueId: number, text: string) =>
        job.emit(
            encoder.encode(
                `${cueId + 1}\n00:00:${String(cueId * 2 + 1).padStart(2, '0')},000 --> 00:00:${String(cueId * 2 + 2).padStart(2, '0')},000\n${text}\n\n`
            )
        );
    const texts = () => job.stream.snapshot.subtitles.filter(({ track }) => track === 0).map(({ text }) => text);
    emit(0, 'First');
    expect(texts()).toEqual(['First']);
    emit(1, 'Second');
    jest.advanceTimersByTime(99);
    emit(2, 'Third');
    expect(texts()).toEqual(['First']);
    jest.advanceTimersByTime(1);
    expect(texts()).toEqual(['First', 'Second', 'Third']);
    const batches = job.updates.filter((update) => update.type === 'cues' && update.track === 0);
    expect(batches.map((update) => (update.type === 'cues' ? update.cues.map(({ cueId }) => cueId) : []))).toEqual([
        [0],
        [1, 2],
    ]);
    jest.advanceTimersByTime(100);
    emit(3, 'Fourth');
    expect(texts()).toEqual(['First', 'Second', 'Third', 'Fourth']);
    emit(4, 'Last');
    job.finish();
    await job.run;
    expect(texts()).toEqual(['First', 'Second', 'Third', 'Fourth', 'Last']);
    expect(job.stream.sourceStates.every(({ status }) => status === 'complete')).toBe(true);
    expect(job.onComplete).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
});

it('stops extraction when a timed publication fails while waiting for more worker output', async () => {
    const job = await loading();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    job.emit(encoder.encode('1\n00:00:01,000 --> 00:00:02,000\nPartial\n\n'));
    const error = new Error('Consumer failed');
    jest.spyOn(job.stream, 'update').mockImplementationOnce(() => {
        throw error;
    });
    job.emit(encoder.encode('2\n00:00:03,000 --> 00:00:04,000\nBuffered\n\n'));
    jest.advanceTimersByTime(100);
    await job.run;
    expect(job.extract.mock.calls[0][0].signal.aborted).toBe(true);
    expect(job.abort.signal.aborted).toBe(false);
    expect(job.stream.sourceStates.filter(({ track }) => track !== 1).every(({ status }) => status === 'failed')).toBe(
        true
    );
    expect(job.onComplete).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
});

it('progressively loads bitmap cues alongside text, then restores completed images without decoding again', async () => {
    const job = await loading(ffmpegSubtitleFormats.image.extension);
    const image = {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        screen: { width: 1920, height: 1080 },
        image: { width: 300, height: 50 },
    };
    const bytes = encoder.encode(JSON.stringify({ start: 2000, end: 4000, textImage: image }) + '\n');
    job.emit(bytes.slice(0, 20));
    job.emit(bytes.slice(20));
    await job.firstCue;
    expect(job.stream.snapshot.subtitles.map(({ track, text, textImage }) => ({ track, text, textImage }))).toEqual([
        { track: 1, text: 'External', textImage: undefined },
        { track: 0, text: '', textImage: image },
        { track: 2, text: '', textImage: image },
    ]);
    expect(job.onComplete).not.toHaveBeenCalled();
    job.finish();
    await job.run;
    const completed = job.onComplete.mock.calls[0][0];
    expect(completed[0].fileParts[0].file.name).toBe('video.track-1.eng.asbimg');
    const restored = await createReader().subtitles(
        completed.map(({ fileParts }) => ({ fileParts: fileParts.map(({ file }) => file) }))
    );
    expect(restored.filter(({ textImage }) => textImage).map(({ track, textImage }) => [track, textImage])).toEqual([
        [0, image],
        [2, image],
    ]);
    const updates = new SubtitleStream();
    await job.produce((update) => updates.update(update), new AbortController().signal);
    expect(job.extract).toHaveBeenCalledTimes(1);
    expect(updates.snapshot.subtitles.map(({ start, end, textImage }) => ({ start, end, textImage }))).toEqual(
        job.stream.snapshot.subtitles.map(({ start, end, textImage }) => ({ start, end, textImage }))
    );
});
