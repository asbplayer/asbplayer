import { describe, expect, it, jest } from '@jest/globals';
// These tests use the real WebVTT reader, not its unrelated ESM-only SRT dependency.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

import type { MediaSourceFile } from '@project/common/app/services/media-sources';
import type { SerializedSubtitleFile } from '@project/common';
import { MediaSources, decodeSubtitleSourceFiles } from '@project/common/app/services/media-sources';
import { embeddedDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import { LocalizedError } from '@project/common/app/components/localized-error';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleHtml } from '@project/common';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';

const source = (name: string, track?: number): MediaSourceFile => ({
    id: name,
    file: new File([], name),
    ...(track === undefined ? {} : { track }),
});

const trackNames = (sources: MediaSources) =>
    sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ file }) => file.name));

describe('MediaSources', () => {
    it('represents an empty selection without subtitle tracks or a video', () => {
        const sources = MediaSources.fromFiles([], { pendingEmbedded: false });
        expect(sources.subtitleTracks).toEqual([]);
        expect(sources.allSourceFiles).toEqual([]);
        expect(sources.videoFile).toBeUndefined();
    });

    it('assigns independent subtitle tracks without counting the selected video', () => {
        const video = source('video.MP4');
        const sources = MediaSources.fromFiles([source('English.vtt'), video, source('Spanish.srt')], {
            pendingEmbedded: false,
        });

        expect(trackNames(sources)).toEqual([['English.vtt'], ['Spanish.srt']]);
        expect(sources.subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1]);
        expect(sources.videoFile).toBe(video);
        expect(sources.allSourceFiles.map(({ file }) => file.name)).toEqual([
            'English.vtt',
            'Spanish.srt',
            'video.MP4',
        ]);
    });

    it('groups interleaved fragments in track order and uses their first filenames as track names', () => {
        const sources = MediaSources.fromFiles(
            [
                source('Spanish1.vtt', 1),
                source('English1.vtt', 0),
                source('Spanish2.vtt', 1),
                source('English2.vtt', 0),
            ],
            { pendingEmbedded: false }
        );

        expect(trackNames(sources)).toEqual([
            ['English1.vtt', 'English2.vtt'],
            ['Spanish1.vtt', 'Spanish2.vtt'],
        ]);
        expect(sources.subtitleFileNames).toEqual(['English1.vtt', 'Spanish1.vtt']);
        expect(sources.firstSubtitleSourceFiles.map((source) => source?.file.name)).toEqual([
            'English1.vtt',
            'Spanish1.vtt',
        ]);
        expect(sources.hasSubtitleFile('English1.vtt')).toBe(true);
        expect(sources.hasSubtitleFile('English2.vtt')).toBe(false);
        expect(sources.hasSubtitleFile('missing.vtt')).toBe(false);
    });

    it('preserves an unfilled slot and a trailing empty SRT placeholder', () => {
        const sources = MediaSources.fromFiles(
            [source('English1.vtt', 1), source('English2.vtt', 1), source('.srt', 2)],
            { pendingEmbedded: false }
        );

        expect(trackNames(sources)).toEqual([[], ['English1.vtt', 'English2.vtt'], ['.srt']]);
        expect(sources.subtitleFileNames).toEqual(['', 'English1.vtt', '.srt']);
        expect(sources.firstSubtitleSourceFiles.map((source) => source?.file.name)).toEqual([
            undefined,
            'English1.vtt',
            '.srt',
        ]);
        expect(sources.hasSubtitleFile('')).toBe(false);
    });

    it('retains every fragment when an existing track is selected in another slot', () => {
        const english = source('English1.vtt', 0);
        const loaded = MediaSources.fromFiles([english, source('English2.vtt', 0), source('Spanish.vtt', 1)], {
            pendingEmbedded: false,
        });
        const track = loaded.findSubtitleTrack(english)!;
        const reselected = MediaSources.fromFiles(
            [source('.srt', 0), ...track.fileParts.map((filePart) => ({ ...filePart, track: 1 }))],
            { pendingEmbedded: false }
        );

        expect(trackNames(reselected)).toEqual([['.srt'], ['English1.vtt', 'English2.vtt']]);
        expect(reselected.subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 1]);
        expect(trackNames(loaded)).toEqual([['English1.vtt', 'English2.vtt'], ['Spanish.vtt']]);
    });

    it('requires the same first file and ID to recover an existing track', () => {
        const first = source('first.vtt');
        const second = source('second.vtt', 0);
        const sources = MediaSources.fromFiles([first, second], { pendingEmbedded: false });

        expect(sources.findSubtitleTrack(source('first.vtt'))).toBeUndefined();
        expect(sources.findSubtitleTrack({ ...first, id: 'different' })).toBeUndefined();
        expect(sources.findSubtitleTrack(second)).toBeUndefined();
    });

    it('keeps the subtitle track reference when the video is unloaded', () => {
        const original = MediaSources.fromFiles([source('English.vtt'), source('video.mp4')], {
            pendingEmbedded: false,
        });
        const unloaded = original.withoutVideo(new Set());

        expect(unloaded.subtitleTracks).toBe(original.subtitleTracks);
        expect(unloaded.subtitleFileNames).toEqual(['English.vtt']);
        expect(unloaded.videoFile).toBeUndefined();
    });

    it('keeps completed embedded files as standalone subtitles and drops unfinished files on unload', () => {
        const video = source('video.mkv');
        const completed = {
            ...source('empty-but-complete.srt', 0),
            embedded: embeddedDescriptor(video, { trackIndex: 0, codec: 'subrip' }),
        };
        const pending = {
            ...source('pending.srt', 1),
            embedded: embeddedDescriptor(video, { trackIndex: 1, codec: 'subrip' }),
        };
        const external = { id: 'English.vtt', file: new File(['WEBVTT'], 'English.vtt'), track: 2 };
        const loaded = MediaSources.fromFiles([video, completed, pending, external], { pendingEmbedded: true });
        const unloaded = loaded.withoutVideo(new Set([1]));

        expect(unloaded.videoFile).toBeUndefined();
        expect(trackNames(unloaded)).toEqual([['empty-but-complete.srt'], [], ['English.vtt']]);
        expect(unloaded.subtitleSourceFiles).toEqual([{ id: completed.id, file: completed.file, track: 0 }, external]);
        expect(unloaded.canDownloadSubtitles).toBe(true);
        expect(loaded.subtitleSourceFiles[0].embedded).toBe(completed.embedded);

        const pendingOnly = MediaSources.fromFiles([video, { ...pending, track: 0 }], {
            pendingEmbedded: true,
        }).withoutVideo(new Set([1]));
        expect(pendingOnly.subtitleTracks).toEqual([]);
        expect(pendingOnly.subtitleFileNames).toEqual([]);
    });

    it.each([-1, 0.5, NaN, Infinity, 1])('rejects an invalid track index of %s', (track) => {
        expect(() => MediaSources.fromFiles([source('English.vtt', track)], { pendingEmbedded: false })).toThrow(
            'Invalid subtitle track index'
        );
    });

    it.each([
        [['video.mp4', 'another.mkv'], 'error.onlyOneVideoFile'],
        [['audio.mp3', 'another.wav'], 'error.onlyOneAudioFile'],
        [['video.mp4', 'audio.mp3'], 'error.onlyOneAudioFile'],
        [['no-extension'], 'error.unknownExtension'],
        [['unsupported.txt'], 'error.unsupportedExtension'],
    ])('rejects unsupported file selections %s', (names, key) => {
        try {
            MediaSources.fromFiles(
                names.map((name) => source(name)),
                { pendingEmbedded: false }
            );
            throw new Error('Expected invalid selection to be rejected');
        } catch (error) {
            expect(error).toBeInstanceOf(LocalizedError);
            expect((error as LocalizedError).locKey).toBe(key);
        }
    });
});

const serializedSourceFile = (name: string, track?: number): SerializedSubtitleFile => ({
    name,
    base64: btoa('Subtitle text'),
    ...(track === undefined ? {} : { track }),
});

const decodedTrackNames = (serializedSourceFiles: SerializedSubtitleFile[], flatten?: boolean) =>
    trackNames(
        MediaSources.fromFiles(decodeSubtitleSourceFiles(serializedSourceFiles, flatten), { pendingEmbedded: false })
    );

describe('subtitle downloads', () => {
    const reader = new SubtitleReader({
        regexFilter: 'speaker: ',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.remove,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: () => Promise.reject(new Error('Image tracks must not be exported')),
    });

    it.each(['loading', 'failed'] as const)('withholds every track while a selected track is %s', async (status) => {
        const sources = MediaSources.fromSync({
            command: 'syncv2',
            subtitles: [],
            subtitleSource: {
                tracks: [
                    { track: 0, loadId: 'embedded', name: 'embedded.ass', status },
                    { track: 1, loadId: 'companion', name: 'companion.vtt', status: 'complete' },
                ],
            },
        });
        expect(sources.canDownloadSubtitles).toBe(false);
        expect(await sources.subtitleTracksForExport(reader, [makeSubtitle()])).toEqual([]);
    });

    it('exports completed remote text tracks in their slots with original text and timing', async () => {
        const sources = new MediaSources({
            kind: 'remote',
            names: ['embedded.ass', '', 'companion.vtt', 'image.SUP'],
            status: 'complete',
        });
        const cues = [
            makeSubtitle({
                text: '<b>annotated</b>',
                originalText: 'original',
                start: 1500,
                end: 2500,
                originalStart: 1000,
                originalEnd: 2000,
            }),
            makeSubtitle({
                text: 'companion',
                track: 2,
                start: 3500,
                end: 4500,
                originalStart: 3000,
                originalEnd: 4000,
            }),
            makeSubtitle({ text: 'image', track: 3 }),
        ];
        expect(sources.canDownloadSubtitles).toBe(true);
        const exported = await sources.subtitleTracksForExport(reader, cues);
        expect(exported).toMatchObject([
            { track: 0, name: 'embedded.ass', subtitles: [{ text: 'original', start: 1000, end: 2000 }] },
            { track: 2, name: 'companion.vtt', subtitles: [{ text: 'companion', start: 3000, end: 4000 }] },
        ]);
        expect(cues[0]).toMatchObject({ text: '<b>annotated</b>', start: 1500 });
    });

    it.each([{ names: [] }, { names: ['image.sup'] }, { names: ['image.SUP'] }])(
        'hides downloads for an empty or image-only selection $names',
        ({ names }) => {
            expect(new MediaSources({ kind: 'remote', names, status: 'complete' }).canDownloadSubtitles).toBe(false);
            expect(
                MediaSources.fromFiles(
                    names.map((name) => source(name)),
                    { pendingEmbedded: false }
                ).canDownloadSubtitles
            ).toBe(false);
        }
    );

    it('reparses complete file fragments with current settings and excludes image and empty tracks', async () => {
        const vtt = (name: string, text: string, second: number, track: number): MediaSourceFile => {
            const content = `WEBVTT\n\n00:00:0${second}.000 --> 00:00:0${second + 1}.000\nspeaker: ${text}\n\n`;
            const file = new File([content], name);
            Object.defineProperty(file, 'text', { value: async () => content });
            return { id: name, file, track };
        };
        const sources = MediaSources.fromFiles(
            [
                vtt('part1.vtt', 'First', 1, 0),
                vtt('part2.vtt', 'Second', 3, 0),
                source('.srt', 1),
                vtt('companion.vtt', 'Companion', 1, 2),
                { id: 'image', file: new File(['image data'], 'image.SUP'), track: 3 },
            ],
            { pendingEmbedded: false }
        );
        expect(sources.canDownloadSubtitles).toBe(true);
        expect(await sources.subtitleTracksForExport(reader, [])).toMatchObject([
            {
                track: 0,
                name: 'part1.vtt',
                subtitles: [
                    { text: 'First', start: 1000, end: 2000 },
                    { text: 'Second', start: 3000, end: 4000 },
                ],
            },
            { track: 2, name: 'companion.vtt', subtitles: [{ text: 'Companion', start: 1000, end: 2000 }] },
        ]);
    });
});

describe('subtitle source messages', () => {
    it('keeps tab-owned track names available to history jumps and rewind without creating local files', () => {
        const sources = MediaSources.fromSync({
            command: 'syncv2',
            subtitles: [],
            subtitleSource: {
                tracks: [
                    { track: 2, loadId: 'external', name: 'companion.vtt', status: 'complete' },
                    { track: 0, loadId: 'embedded', name: 'embedded.ass', status: 'loading' },
                ],
            },
        });

        expect(sources.subtitleSource.kind).toBe('remote');
        expect(sources.subtitleFileNames).toEqual(['embedded.ass', '', 'companion.vtt']);
        expect(sources.hasSubtitleFile('embedded.ass')).toBe(true);
        expect(sources.hasSubtitleFile('companion.vtt')).toBe(true);
        expect(sources.hasSubtitleFile('')).toBe(false);
        expect(sources.hasSubtitleFile('missing.vtt')).toBe(false);
        expect(sources.subtitleTracks).toEqual([]);
        expect(sources.allSourceFiles).toEqual([]);
    });

    it('preserves remote ownership for an empty subtitle selection', () => {
        const sources = MediaSources.fromSync({ command: 'syncv2', subtitles: [], subtitleSource: { tracks: [] } });
        expect(sources.subtitleSource.kind).toBe('remote');
        expect(sources.subtitleFileNames).toEqual([]);
        expect(sources.hasSubtitleFile('previous.ass')).toBe(false);
    });

    it('loads serialized syncv2 files as local tracks', () => {
        const sources = MediaSources.fromSync({
            command: 'syncv2',
            subtitles: [serializedSourceFile('part1.vtt', 0), serializedSourceFile('part2.vtt', 0)],
        });
        expect(sources.subtitleSource.kind).toBe('files');
        expect(trackNames(sources)).toEqual([['part1.vtt', 'part2.vtt']]);
        expect(sources.hasSubtitleFile('part1.vtt')).toBe(true);
    });

    it('loads subtitle files from older extension sync messages', () => {
        const sources = MediaSources.fromSync({
            command: 'sync',
            subtitles: serializedSourceFile('older-extension.vtt'),
        });
        expect(sources.subtitleSource.kind).toBe('files');
        expect(trackNames(sources)).toEqual([['older-extension.vtt']]);
    });

    it('decodes the original filename and subtitle contents', async () => {
        const [{ file: subtitleSourceFile }] = decodeSubtitleSourceFiles([serializedSourceFile('original.vtt')]);
        const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(subtitleSourceFile);
        });

        expect(subtitleSourceFile.name).toBe('original.vtt');
        expect(text).toBe('Subtitle text');
    });

    it.each([undefined, false])('keeps legacy independent files separate with flatten=%s', (flatten) => {
        expect(
            decodedTrackNames([serializedSourceFile('English.vtt'), serializedSourceFile('Spanish.vtt')], flatten)
        ).toEqual([['English.vtt'], ['Spanish.vtt']]);
    });

    it('groups legacy fragments when flatten is true', () => {
        expect(decodedTrackNames([serializedSourceFile('part1.vtt'), serializedSourceFile('part2.vtt')], true)).toEqual(
            [['part1.vtt', 'part2.vtt']]
        );
    });

    it('prioritizes explicit track indexes over the legacy flatten fallback', () => {
        expect(
            decodedTrackNames(
                [
                    serializedSourceFile('English1.vtt', 0),
                    serializedSourceFile('English2.vtt', 0),
                    serializedSourceFile('Spanish1.vtt', 2),
                    serializedSourceFile('Spanish2.vtt', 2),
                ],
                true
            )
        ).toEqual([['English1.vtt', 'English2.vtt'], [], ['Spanish1.vtt', 'Spanish2.vtt']]);
    });

    it('decodes an explicit clear as no tracks', () => {
        expect(decodeSubtitleSourceFiles([])).toEqual([]);
    });

    it.each([-1, 0.5, NaN, Infinity, 1])('rejects an invalid track index of %s', (track) => {
        expect(() => decodeSubtitleSourceFiles([serializedSourceFile('subtitle.vtt', track)])).toThrow(
            'Invalid subtitle track index'
        );
    });
});

describe('merge', () => {
    it('retains external subtitles and drops embedded tracks when a new video is loaded alone', () => {
        let nextUrl = 0;
        const createUrl = () => `blob:video-${++nextUrl}`;
        const video1 = source('first.mkv');
        const video2 = source('second.mkv');
        const external = source('external.srt', 0);
        const embedded: MediaSourceFile = {
            ...source('first.track-1.srt', 1),
            embedded: {
                videoId: video1.id,
                fileName: video1.file.name,
                fileSize: 0,
                lastModified: 0,
                trackIndex: 0,
                codec: 'subrip',
                format: 'srt',
            },
        };
        const initial = new MediaSources(
            MediaSources.fromFiles([external, embedded], { pendingEmbedded: false }).subtitleSource,
            video1,
            'blob:initial'
        );

        const replaced = initial.merge(new MediaSources(undefined, video2), createUrl, new Set());
        expect(replaced.newVideo).toBe(true);
        expect(replaced.revokedVideoUrl).toBe('blob:initial');
        expect(replaced.sources.videoFile).toBe(video2);
        expect(replaced.sources.videoFileUrl).toBe('blob:video-1');
        expect(trackNames(replaced.sources)).toEqual([['external.srt'], []]);
        expect(replaced.loadingSources).toEqual([video2]);
        expect(replaced.resetJumpToSubtitle).toBe(true);

        const sameVideo = initial.merge(new MediaSources(undefined, video1), createUrl, new Set());
        expect(sameVideo.newVideo).toBe(false);
        expect(sameVideo.revokedVideoUrl).toBeUndefined();
        expect(sameVideo.sources.videoFileUrl).toBe('blob:initial');
        expect(trackNames(sameVideo.sources)).toEqual([['external.srt'], ['first.track-1.srt']]);
        expect(sameVideo.loadingSources).toEqual([]);

        const pendingInitial = new MediaSources(
            MediaSources.fromFiles([{ ...embedded, track: 0 }], { pendingEmbedded: true }).subtitleSource,
            video1,
            'blob:initial'
        );
        const reloadedSameVideo = pendingInitial.merge(new MediaSources(undefined, video1), createUrl, new Set([0]));
        expect(reloadedSameVideo.sources.subtitleTracks).toEqual([]);
        expect(reloadedSameVideo.sources.subtitleSource).toMatchObject({ kind: 'files', pendingEmbedded: false });
    });

    it('preserves the active video for local subtitle updates and revokes it for remote subtitles', () => {
        const video = source('episode.mkv');
        const initial = new MediaSources(undefined, video, 'blob:episode');
        const sub = source('en.srt');

        const withSub = initial.merge(
            MediaSources.fromFiles([sub], { pendingEmbedded: false }),
            () => 'blob:unused',
            new Set()
        );
        expect(withSub.newVideo).toBe(false);
        expect(withSub.revokedVideoUrl).toBeUndefined();
        expect(withSub.sources.videoFile).toBe(video);
        expect(withSub.sources.videoFileUrl).toBe('blob:episode');
        expect(withSub.loadingSources).toEqual([{ ...sub, track: 0 }]);

        const remote = initial.merge(
            new MediaSources({ kind: 'remote', names: ['remote.vtt'], status: 'complete' }),
            () => 'blob:unused',
            new Set()
        );
        expect(remote.revokedVideoUrl).toBe('blob:episode');
        expect(remote.sources.videoFile).toBeUndefined();
        expect(remote.sources.videoFileUrl).toBeUndefined();
        expect(remote.resetJumpToSubtitle).toBe(true);
    });
});
