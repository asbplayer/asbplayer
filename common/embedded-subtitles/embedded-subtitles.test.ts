/** @jest-environment node */
import { beforeAll, expect, it } from '@jest/globals';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import { TextEncoder } from 'util';
import { mkv, mkvTrack, element, utf8 } from '@project/common/media-probe/test-media';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';
import type {
    SubtitleHost,
    SubtitleExtractionOptions,
    ExtractedSubtitleFile,
} from '@project/common/embedded-subtitles/subtitle-source';

beforeAll(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
});

const tracks: EmbeddedSubtitleTrack[] = [
    {
        trackIndex: 0,
        codec: 'subrip',
        language: 'jpn',
        outputFormat: 'srt',
    },
    { trackIndex: 1, codec: 'ass', outputFormat: 'srt' },
    {
        trackIndex: 2,
        codec: 'dvd_subtitle',
        outputFormat: ffmpegSubtitleFormats.image.extension,
    },
    {
        trackIndex: 3,
        codec: 'hdmv_pgs_subtitle',
        outputFormat: ffmpegSubtitleFormats.image.extension,
    },
];

class Host implements SubtitleHost {
    selections: number[][] = [];
    signals: AbortSignal[] = [];

    async extractSubtitles({ trackIndexes, signal }: SubtitleExtractionOptions): Promise<ExtractedSubtitleFile[]> {
        this.signals.push(signal);
        this.selections.push(trackIndexes);
        return trackIndexes.map((trackIndex) => ({
            trackIndex,
            format: 'srt',
            blob: new Blob(
                trackIndex === 0 ? [new TextEncoder().encode('1\n00:00:02,000 --> 00:00:04,000\n日本語')] : [],
                { type: 'application/x-subrip' }
            ),
        }));
    }
}

const source = () => ({
    id: 'video',
    file: new File(
        [
            mkv(
                mkvTrack(1, 'V_VP8'),
                mkvTrack(2, 'A_OPUS'),
                mkvTrack(17, 'S_TEXT/UTF8', element('22b59c', utf8('jpn'))),
                mkvTrack(1, 'V_VP8'),
                mkvTrack(2, 'A_OPUS'),
                mkvTrack(17, 'S_TEXT/ASS', element('22b59c', utf8('und'))),
                mkvTrack(1, 'V_VP8'),
                mkvTrack(2, 'A_OPUS'),
                mkvTrack(17, 'S_VOBSUB', element('22b59c', utf8('und'))),
                mkvTrack(17, 'S_HDMV/PGS', element('22b59c', utf8('und')))
            ),
        ],
        'episode.mkv',
        { lastModified: 10 }
    ),
});

it('discovers and reuses catalogs without starting an FFmpeg session', async () => {
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const signal = new AbortController().signal;
    const catalog = await service.discover(video, signal);
    expect(catalog).toEqual(tracks);
    expect(await service.discover(video, new AbortController().signal)).toBe(catalog);
    expect(host.signals).toHaveLength(0);
});

it('extracts unique tracks together, accepts empty outputs, and reuses completed files', async () => {
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const first = embeddedDescriptor(video, tracks[0]);
    const empty = embeddedDescriptor(video, tracks[1]);
    const files = await service.extract(video, [first, first, empty], new AbortController().signal, () => {});
    expect(host.selections).toEqual([[0, 1]]);
    expect(files.size).toBe(2);
    expect(files.get(embeddedSubtitleId(video.id, 0))?.file.name).toBe('episode.track-1.jpn.srt');
    expect(files.get(embeddedSubtitleId(video.id, 1))?.file.size).toBe(0);
    expect(files.get(embeddedSubtitleId(video.id, 1))?.id).not.toBe('-');
    expect(files.get(embeddedSubtitleId(video.id, 0))?.file.type).toBe('application/x-subrip');
    const reused = await service.extract(video, [first], new AbortController().signal, () => {});
    expect(reused.get(embeddedSubtitleId(video.id, 0))).toBe(files.get(embeddedSubtitleId(video.id, 0)));
    expect(host.selections).toHaveLength(1);
});

it('reuses restored completed files, including empty tracks, without extracting again', async () => {
    const video = source();
    const signal = new AbortController().signal;
    const descriptors = tracks.slice(0, 2).map((track) => embeddedDescriptor(video, track));
    const saved = await new EmbeddedSubtitles(new Host()).extract(video, descriptors, signal, () => {});
    const restoredVideo = {
        ...video,
        file: new File([video.file], video.file.name, { lastModified: video.file.lastModified }),
    };
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    service.restoreCompleted(restoredVideo, [...saved.values()]);

    const prepared = await service.prepare(restoredVideo, descriptors, signal);
    for (const [id, file] of saved) expect(prepared.get(id)).toBe(file);
    const chunks = new Map<number, ArrayBuffer>();
    const files = await service.extract(restoredVideo, descriptors, signal, (index, bytes) => chunks.set(index, bytes));
    expect(files).toEqual(saved);
    expect(new TextDecoder().decode(chunks.get(0))).toContain('日本語');
    expect(chunks.get(1)?.byteLength).toBe(0);
    expect(service.completedFile(restoredVideo, 1)).toBe(saved.get(embeddedSubtitleId(video.id, 1)));
    expect(host.selections).toEqual([]);
});

it('does not reuse restored outputs from changed video contents or a different video ID', async () => {
    const video = source();
    const descriptor = embeddedDescriptor(video, tracks[0]);
    const restored = {
        id: embeddedSubtitleId(video.id, 0),
        embedded: descriptor,
        file: new File(['cached'], 'cached.srt'),
    };
    const service = new EmbeddedSubtitles(new Host());
    for (const changed of [
        { ...video, id: 'different' },
        { ...video, file: new File([video.file], video.file.name, { lastModified: 11 }) },
    ]) {
        service.restoreCompleted(changed, [restored]);
        expect(service.completedFile(changed, 0)).toBeUndefined();
    }
});

it('discards incomplete extraction output so a retry requests every missing track', async () => {
    const host = new Host();
    const extract = host.extractSubtitles.bind(host);
    host.extractSubtitles = async (options) => {
        const files = await extract(options);
        return host.selections.length === 1 ? files.slice(0, 1) : files;
    };
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const descriptors = tracks.slice(0, 2).map((track) => embeddedDescriptor(video, track));
    const signal = new AbortController().signal;
    await expect(service.extract(video, descriptors, signal, () => {})).rejects.toThrow(
        'Incomplete embedded subtitle output'
    );
    expect((await service.extract(video, descriptors, signal, () => {})).size).toBe(2);
    expect(host.selections).toEqual([
        [0, 1],
        [0, 1],
    ]);
});

it('keeps outputs for retained sources and releases them when the source is removed', async () => {
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const descriptors = [embeddedDescriptor(video, tracks[0])];
    const signal = new AbortController().signal;
    const first = await service.extract(video, descriptors, signal, () => {});
    service.retain([video]);
    expect((await service.extract(video, descriptors, signal, () => {})).get('embedded:video:0')).toBe(
        first.get('embedded:video:0')
    );
    service.retain([]);
    expect((await service.extract(video, descriptors, signal, () => {})).get('embedded:video:0')).not.toBe(
        first.get('embedded:video:0')
    );
    expect(host.selections).toEqual([[0], [0]]);
});

it('does no work for empty selections and rejects changed or unsupported sources', async () => {
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    const video = source();
    expect(await service.extract(video, [], new AbortController().signal, () => {})).toEqual(new Map());
    expect(host.signals).toHaveLength(0);
    await expect(
        service.extract(
            { ...video, file: new File(['changed'], 'episode.mkv') },
            [embeddedDescriptor(video, tracks[0])],
            new AbortController().signal,
            () => {}
        )
    ).rejects.toThrow('changed');
    for (const track of [
        { ...tracks[0], codec: 'unsupported' },
        { ...tracks[0], trackIndex: 20 },
    ]) {
        await expect(
            service.extract(video, [embeddedDescriptor(video, track)], new AbortController().signal, () => {})
        ).rejects.toThrow('unavailable');
    }
    expect(host.selections).toHaveLength(0);
});

it('cancels discovery before caching late results and allows retry', async () => {
    const host = new Host();
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const slice = video.file.slice.bind(video.file);
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
        release = resolve;
    });
    video.file.slice = (...args) => {
        const part = slice(...args);
        const read = part.arrayBuffer.bind(part);
        part.arrayBuffer = async () => {
            await wait;
            return read();
        };
        return part;
    };
    const controller = new AbortController();
    const pending = service.discover(video, controller.signal);
    controller.abort();
    release();
    await expect(pending).rejects.toThrow();
    video.file.slice = slice;
    expect(await service.discover(video, new AbortController().signal)).toEqual(tracks);
    expect(host.signals).toHaveLength(0);
});

it('does not cache completed output after extraction is cancelled', async () => {
    const host = new Host();
    const extract = host.extractSubtitles.bind(host);
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
        started = resolve;
    });
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
        release = resolve;
    });
    host.extractSubtitles = async (options) => {
        started();
        await wait;
        return extract(options);
    };
    const service = new EmbeddedSubtitles(host);
    const video = source();
    const descriptors = [embeddedDescriptor(video, tracks[0])];
    const controller = new AbortController();
    const pending = service.extract(video, descriptors, controller.signal, () => {});
    await ready;
    controller.abort();
    release();
    await expect(pending).rejects.toThrow();
    const files = await service.extract(video, descriptors, new AbortController().signal, () => {});
    expect(files.get('embedded:video:0')?.file.name).toBe('episode.track-1.jpn.srt');
    expect(host.selections).toEqual([[0], [0]]);
});
