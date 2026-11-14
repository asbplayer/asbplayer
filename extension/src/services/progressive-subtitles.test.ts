import { ReadableStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubtitleHtml } from '@project/common';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleStream } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import { streamSubtitles } from '@project/extension/src/services/progressive-subtitles';

// These tests exercise the real ASS parser; SRT is unrelated to this source.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

const originalFetch = globalThis.fetch;
const originalDecoder = globalThis.TextDecoder;
const encoder = new TextEncoder();
const url = 'https://media.example/subtitles?id=track';
const header = `[Script Info]
ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const dialogue = (text: string, start = '0:00:01.00', end = '0:00:02.00') =>
    `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;

const createReader = (regexFilter: string, regexFilterTextReplacement = '') =>
    new SubtitleReader({
        regexFilter,
        regexFilterTextReplacement,
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: async () => {
            throw new Error('Not an image source');
        },
    });

function openResponse(extension = 'ass') {
    let response!: ReadableStreamDefaultController<Uint8Array>;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            response = controller;
        },
        cancel() {
            cancelled = true;
        },
    });
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'text/x-ssa' },
        body,
    } as unknown as Response);
    const source = new SubtitleStream();
    const updates: SubtitleSourceUpdate[] = [];
    let firstBatch!: () => void;
    const firstPublished = new Promise<void>((resolve) => {
        firstBatch = resolve;
    });
    const abort = new AbortController();
    const reader = createReader('speaker: ');
    const identity = { track: 0, loadId: 'source' };
    source.update({ type: 'start', ...identity, name: 'source.ass' });
    const loading = streamSubtitles(url, extension, reader, identity, abort.signal, (update) => {
        updates.push(update);
        source.update(update);
        if (update.type === 'cues') firstBatch();
    });
    return { response, source, updates, abort, firstPublished, loading, cancelled: () => cancelled };
}

beforeEach(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
    Object.assign(globalThis, { TextDecoder });
});
afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
    globalThis.TextDecoder = originalDecoder;
});

describe('progressive subtitle responses', () => {
    it('rejects unsupported progressive formats before downloading the response', async () => {
        const stream = openResponse('vtt');
        await expect(stream.loading).rejects.toThrow('Unsupported progressive subtitle format: vtt');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('publishes complete events before EOF across UTF-8 and line boundaries, preserving filters and cue IDs', async () => {
        const stream = openResponse();
        const first = encoder.encode(`${header}${dialogue('speaker: 日本語')}`);
        stream.response.enqueue(first.slice(0, first.length - 2)); // Split a UTF-8 character and leave the event unterminated.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(stream.updates).toEqual([]);
        stream.response.enqueue(new Uint8Array([...first.slice(first.length - 2), ...encoder.encode('\r\n')]));
        await stream.firstPublished;
        expect(stream.source.snapshot.subtitles).toMatchObject([{ text: '日本語', source: { cueId: 0 } }]);
        expect(stream.source.sourceStates[0].status).toBe('loading');
        stream.response.enqueue(
            encoder.encode(`${dialogue('speaker: 日本語')}\n${dialogue('speaker: Second', '0:00:03.00', '0:00:04.00')}`)
        );
        stream.response.close();
        await stream.loading;
        expect(stream.source.snapshot.subtitles).toMatchObject([
            { text: '日本語', start: 1000, source: { cueId: 0 } },
            { text: 'Second', start: 3000, source: { cueId: 1 } },
        ]);
        expect(stream.source.sourceStates[0].status).toBe('complete');
        expect(stream.updates.filter((update) => update.type === 'cues')).toHaveLength(2);
    });

    it('cancels a pending read without publishing completion or losing received cues', async () => {
        const stream = openResponse();
        stream.response.enqueue(encoder.encode(`${header}${dialogue('First')}\n`));
        await stream.firstPublished;
        stream.abort.abort();
        await expect(stream.loading).rejects.toMatchObject({ name: 'AbortError' });
        expect(stream.cancelled()).toBe(true);
        expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First']);
        expect(stream.updates.some((update) => update.type === 'complete')).toBe(false);
    });

    it('reports read failures while retaining cues that arrived earlier', async () => {
        const stream = openResponse();
        stream.response.enqueue(encoder.encode(`${header}${dialogue('First')}\n`));
        await stream.firstPublished;
        stream.response.error(new Error('Connection lost'));
        await expect(stream.loading).rejects.toThrow('Connection lost');
        expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First']);
    });

    it('cancels a pending read when a timed publication fails', async () => {
        jest.useFakeTimers();
        const stream = openResponse();
        const result = stream.loading.catch((error: Error) => error);
        stream.response.enqueue(encoder.encode(`${header}${dialogue('First')}\n`));
        await jest.advanceTimersByTimeAsync(0);
        const error = new Error('Publication failed');
        const update = jest.spyOn(stream.source, 'update').mockImplementationOnce(() => {
            throw error;
        });
        stream.response.enqueue(encoder.encode(`${dialogue('Buffered', '0:00:03.00', '0:00:04.00')}\n`));
        await jest.advanceTimersByTimeAsync(100);
        expect(await result).toBe(error);
        expect(stream.cancelled()).toBe(true);
        expect(stream.source.sourceStates[0].status).toBe('failed');
        expect(jest.getTimerCount()).toBe(0);
        update.mockRestore();
    });

    it('rejects a response that is not ASS instead of silently completing an empty track', async () => {
        const stream = openResponse();
        stream.response.enqueue(encoder.encode('<html>Error</html>'));
        stream.response.close();
        await expect(stream.loading).rejects.toThrow('ASS events header');
        expect(stream.source.sourceStates[0].status).toBe('failed');
    });

    it('publishes the first batch immediately and coalesces subsequent batches within 100 ms', async () => {
        jest.useFakeTimers();
        const stream = openResponse();
        stream.response.enqueue(encoder.encode(`${header}${dialogue('First')}\n`));
        await jest.advanceTimersByTimeAsync(0);
        expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First']);
        stream.response.enqueue(encoder.encode(`${dialogue('Second', '0:00:03.00', '0:00:04.00')}\n`));
        stream.response.enqueue(encoder.encode(`${dialogue('Third', '0:00:05.00', '0:00:06.00')}\n`));
        await jest.advanceTimersByTimeAsync(99);
        expect(stream.updates.filter((update) => update.type === 'cues')).toHaveLength(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First', 'Second', 'Third']);
        expect(stream.updates.filter((update) => update.type === 'cues')).toHaveLength(2);
        await jest.advanceTimersByTimeAsync(150);
        stream.response.enqueue(encoder.encode(`${dialogue('Fourth', '0:00:07.00', '0:00:08.00')}\n`));
        await jest.advanceTimersByTimeAsync(0);
        expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First', 'Second', 'Third', 'Fourth']);
        stream.response.close();
        await jest.advanceTimersByTimeAsync(0);
        await stream.loading;
    });

    it.each(['complete', 'fail', 'cancel'] as const)(
        'handles buffered cues before %s and clears the publication timer',
        async (action) => {
            jest.useFakeTimers();
            const stream = openResponse();
            const result = stream.loading.catch((error: Error) => error);
            stream.response.enqueue(encoder.encode(`${header}${dialogue('First')}\n`));
            await jest.advanceTimersByTimeAsync(0);
            stream.response.enqueue(encoder.encode(`${dialogue('Buffered', '0:00:03.00', '0:00:04.00')}\n`));
            await jest.advanceTimersByTimeAsync(0);
            expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(['First']);
            if (action === 'complete') stream.response.close();
            else if (action === 'fail') stream.response.error(new Error('Connection lost'));
            else stream.abort.abort();
            await jest.advanceTimersByTimeAsync(0);
            const error = await result;
            if (action === 'complete') expect(error).toBeUndefined();
            else expect(error).toMatchObject({ name: action === 'cancel' ? 'AbortError' : 'Error' });
            expect(stream.source.snapshot.subtitles.map((cue) => cue.text)).toEqual(
                action === 'cancel' ? ['First'] : ['First', 'Buffered']
            );
            const updates = stream.updates.length;
            await jest.advanceTimersByTimeAsync(200);
            expect(stream.updates).toHaveLength(updates);
            if (action !== 'cancel') {
                expect(stream.source.sourceStates[0].status).toBe(action === 'complete' ? 'complete' : 'failed');
            }
        }
    );
});
