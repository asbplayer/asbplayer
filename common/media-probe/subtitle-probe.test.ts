/** @jest-environment node */
import { expect, it } from '@jest/globals';
import { probeSubtitleTracks } from '@project/common/media-probe/subtitle-probe';
import { box, concat, element, mkv, mkvTrack, mp4Track, utf8 } from '@project/common/media-probe/test-media';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';

it('reads mixed Matroska track order, UTF-8 metadata and unsupported subtitles', async () => {
    const bytes = mkv(
        mkvTrack(3, 'B_BUTTONS'), // The demuxer skips unsupported track types.
        mkvTrack(1, 'V_MPEG4/ISO/AVC'),
        mkvTrack(2, 'A_EAC3'),
        mkvTrack(17, 'S_VOBSUB'),
        mkvTrack(2, 'A_OPUS'),
        mkvTrack(
            17,
            'S_TEXT/ASS',
            element('22b59c', utf8('jpn')),
            element('22b59d', utf8('ja-JP')),
            element('536e', utf8('日本語'))
        ),
        mkvTrack(17, 'S_HDMV/PGS'),
        mkvTrack(17, 'D_WEBVTT/SUBTITLES'),
        mkvTrack(1, 'V_VP8'),
        mkvTrack(17, 'S_TEXT/SSA'),
        mkvTrack(17, 'S_DVBSUB'),
        mkvTrack(17, 'S_TEXT/UNKNOWN')
    );
    const tracks = await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal);
    expect(tracks.map(({ trackIndex, codec, outputFormat }) => [trackIndex, codec, outputFormat])).toEqual([
        [0, 'dvd_subtitle', ffmpegSubtitleFormats.image.extension],
        [1, 'ass', 'srt'],
        [2, 'hdmv_pgs_subtitle', ffmpegSubtitleFormats.image.extension],
        [3, 'webvtt', 'srt'],
        [4, 'ass', 'srt'],
        [5, 'dvb_subtitle', ffmpegSubtitleFormats.image.extension],
        [6, 'S_TEXT/UNKNOWN', undefined],
    ]);
    expect(tracks[1]).toMatchObject({ language: 'ja-JP', title: '日本語' });
});

it('counts Matroska WebVTT metadata tracks in FFmpeg subtitle order', async () => {
    const bytes = mkv(
        mkvTrack(1, 'V_VP8'),
        mkvTrack(1, 'D_WEBVTT/METADATA'),
        mkvTrack(33, 'S_TEXT/UTF8'),
        mkvTrack(33, 'D_WEBVTT/UNKNOWN'),
        mkvTrack(33, 'D_WEBVTT/METADATA'),
        mkvTrack(17, 'S_TEXT/UTF8')
    );
    expect(await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).toEqual([
        { trackIndex: 0, codec: 'webvtt', language: 'eng', outputFormat: 'srt' },
        { trackIndex: 1, codec: 'subrip', language: 'eng', outputFormat: 'srt' },
    ]);
});

it.each([0, 1])('reads MP4 track indexes and language from version %s media headers', async (version) => {
    const bytes = concat(
        box('ftyp', utf8('isom')),
        box('mdat', Buffer.alloc(32)),
        box(
            'moov',
            mp4Track('vide', 'avc1'),
            mp4Track('subt', 'stpp', version),
            mp4Track('soun', 'mp4a'),
            mp4Track('sbtl', 'tx3g', version)
        )
    );
    expect(await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).toEqual([
        { trackIndex: 0, codec: 'ttml', language: 'jpn', title: '日本語' },
        { trackIndex: 1, codec: 'mov_text', language: 'jpn', title: '日本語', outputFormat: 'srt' },
    ]);
});

it('excludes MP4 chapter text tracks without changing subtitle track indexes', async () => {
    const video = mp4Track('vide', 'avc1');
    const chapterId = Buffer.alloc(4);
    chapterId.writeUInt32BE(7);
    const withChapters = box('trak', video.subarray(8), box('tref', box('chap', chapterId)));
    const bytes = concat(
        box('ftyp'),
        box('moov', withChapters, mp4Track('text', 'text', 0, 7), mp4Track('sbtl', 'tx3g', 0, 9))
    );
    expect(
        (await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).map(({ trackIndex }) => trackIndex)
    ).toEqual([0]);
});

it('distinguishes containers without subtitles from unknown or incomplete metadata', async () => {
    expect(await probeSubtitleTracks(new Blob([mkv(mkvTrack(1, 'V_VP8'))]), new AbortController().signal)).toEqual([]);
    expect(
        await probeSubtitleTracks(
            new Blob([box('ftyp'), box('moov', mp4Track('vide', 'avc1'))]),
            new AbortController().signal
        )
    ).toEqual([]);
    for (const bytes of [
        utf8('not media'),
        element('1a45dfa3'),
        concat(box('ftyp'), box('moov').subarray(0, 5)),
        mkv(mkvTrack(17, '')),
    ]) {
        await expect(probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).rejects.toThrow();
    }
});

it('applies Matroska language defaults and gives IETF tags precedence regardless of field order', async () => {
    const bytes = mkv(
        mkvTrack(17, 'S_TEXT/UTF8'),
        mkvTrack(17, 'S_TEXT/UTF8', element('22b59c', utf8('und'))),
        mkvTrack(17, 'S_TEXT/UTF8', element('22b59d', utf8('ar-001')), element('22b59c', utf8('ara')))
    );
    expect(
        (await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).map(({ language }) => language)
    ).toEqual(['eng', undefined, 'ar-001']);
});

it('rejects oversized track titles instead of reading unbounded metadata', async () => {
    const bytes = concat(
        box('ftyp'),
        box(
            'moov',
            box(
                'trak',
                box(
                    'mdia',
                    box('hdlr', Buffer.alloc(8), utf8('sbtl'), Buffer.alloc(12), utf8('x'.repeat(64 * 1024 + 1)))
                )
            )
        )
    );
    await expect(probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).rejects.toThrow(
        'Media metadata string is too large'
    );
});

it('rejects a nested box extending beyond its parent even when its bytes exist in the file', async () => {
    const bytes = concat(box('ftyp'), box('moov', box('trak')), box('free', Buffer.alloc(16)));
    // Claim bytes from the following top-level box as part of the nested trak.
    bytes.writeUInt32BE(16, 16);
    await expect(probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).rejects.toThrow(
        'Invalid MP4 metadata'
    );
});

it('seeks to MP4 metadata beyond 4 GiB without reading the intervening payload', async () => {
    const size = 5 * 1024 ** 3;
    const ftyp = box('ftyp', utf8('isom'));
    const moov = box('moov', mp4Track('vide', 'avc1'), mp4Track('sbtl', 'tx3g'));
    const free = Buffer.alloc(16);
    free.writeUInt32BE(1);
    free.write('free', 4);
    free.writeBigUInt64BE(BigInt(size - ftyp.length - moov.length), 8);
    let readBytes = 0;
    const regions = [
        [0, ftyp],
        [ftyp.length, free],
        [size - moov.length, moov],
    ] as const;
    const sparse = {
        size,
        slice(start: number, end: number) {
            readBytes += end - start;
            const bytes = Buffer.alloc(end - start);
            for (const [offset, data] of regions) {
                const from = Math.max(start, offset),
                    to = Math.min(end, offset + data.length);
                if (to > from) data.copy(bytes, from - start, from - offset, to - offset);
            }
            return new Blob([bytes]);
        },
    } as Blob;
    expect(
        (await probeSubtitleTracks(sparse, new AbortController().signal)).map(({ trackIndex }) => trackIndex)
    ).toEqual([0]);
    expect(readBytes).toBeLessThan(1024 * 1024);
});

it('honors cancellation after an outstanding file read', async () => {
    const controller = new AbortController();
    let release!: (bytes: ArrayBuffer) => void;
    const file = {
        size: 20,
        slice: () => ({
            arrayBuffer: () =>
                new Promise<ArrayBuffer>((resolve) => {
                    release = resolve;
                }),
        }),
    } as Blob;
    const discovery = probeSubtitleTracks(file, controller.signal);
    controller.abort(new Error('cancelled'));
    release(new ArrayBuffer(20));
    await expect(discovery).rejects.toThrow('cancelled');
});

it.each([0xe0, 0xff])('identifies VobSub inside generic MPEG-4 subtitle descriptors (%i)', async (objectType) => {
    const descriptor = box(
        'esds',
        Buffer.concat([Buffer.alloc(4), Buffer.from([3, 18, 0, 1, 0, 4, 13, objectType]), Buffer.alloc(12)])
    );
    const sample = box('mp4s', Buffer.alloc(8), descriptor);
    const stsd = box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), sample);
    const mdia = box('mdia', box('hdlr', Buffer.alloc(8), utf8('subp')), box('minf', box('stbl', stsd)));
    const bytes = concat(box('ftyp'), box('moov', box('trak', mdia)));
    expect(await probeSubtitleTracks(new Blob([bytes]), new AbortController().signal)).toEqual([
        {
            trackIndex: 0,
            codec: objectType === 0xe0 ? 'dvd_subtitle' : 'mp4s',
            outputFormat: objectType === 0xe0 ? ffmpegSubtitleFormats.image.extension : undefined,
        },
    ]);
});
