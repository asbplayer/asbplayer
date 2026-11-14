import { describe, expect, it } from '@jest/globals';
import type { MediaSourceFile } from '@project/common/app/services/media-sources';
import type { SerializedSubtitleFile } from '@project/common';
import { MediaSources, decodeSubtitleSourceFiles } from '@project/common/app/services/media-sources';
import { LocalizedError } from '@project/common/app/components/localized-error';

const source = (name: string, track?: number): MediaSourceFile => ({
    id: name,
    file: new File([], name),
    ...(track === undefined ? {} : { track }),
});

const trackNames = (sources: MediaSources) =>
    sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ file }) => file.name));

describe('MediaSources', () => {
    it('represents an empty selection without subtitle tracks or a video', () => {
        const sources = MediaSources.fromFiles([]);
        expect(sources.subtitleTracks).toEqual([]);
        expect(sources.allSourceFiles).toEqual([]);
        expect(sources.videoFile).toBeUndefined();
    });

    it('assigns independent subtitle tracks without counting the selected video', () => {
        const video = source('video.MP4');
        const sources = MediaSources.fromFiles([source('English.vtt'), video, source('Spanish.srt')]);

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
        const sources = MediaSources.fromFiles([
            source('Spanish1.vtt', 1),
            source('English1.vtt', 0),
            source('Spanish2.vtt', 1),
            source('English2.vtt', 0),
        ]);

        expect(trackNames(sources)).toEqual([
            ['English1.vtt', 'English2.vtt'],
            ['Spanish1.vtt', 'Spanish2.vtt'],
        ]);
        expect(sources.subtitleFileNames).toEqual(['English1.vtt', 'Spanish1.vtt']);
        expect(sources.firstSubtitleSourceFiles.map(({ file }) => file.name)).toEqual(['English1.vtt', 'Spanish1.vtt']);
        expect(sources.hasSubtitleFile('English1.vtt')).toBe(true);
        expect(sources.hasSubtitleFile('English2.vtt')).toBe(false);
        expect(sources.hasSubtitleFile('missing.vtt')).toBe(false);
    });

    it('preserves an unfilled slot and a trailing empty SRT placeholder', () => {
        const sources = MediaSources.fromFiles([
            source('English1.vtt', 1),
            source('English2.vtt', 1),
            source('.srt', 2),
        ]);

        expect(trackNames(sources)).toEqual([[], ['English1.vtt', 'English2.vtt'], ['.srt']]);
        expect(sources.subtitleFileNames).toEqual(['', 'English1.vtt', '.srt']);
        expect(sources.hasSubtitleFile('')).toBe(false);
    });

    it('retains every fragment when an existing track is selected in another slot', () => {
        const english = source('English1.vtt', 0);
        const loaded = MediaSources.fromFiles([english, source('English2.vtt', 0), source('Spanish.vtt', 1)]);
        const track = loaded.findSubtitleTrack(english)!;
        const reselected = MediaSources.fromFiles([
            source('.srt', 0),
            ...track.fileParts.map((filePart) => ({ ...filePart, track: 1 })),
        ]);

        expect(trackNames(reselected)).toEqual([['.srt'], ['English1.vtt', 'English2.vtt']]);
        expect(reselected.subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 1]);
        expect(trackNames(loaded)).toEqual([['English1.vtt', 'English2.vtt'], ['Spanish.vtt']]);
    });

    it('requires the same first file and ID to recover an existing track', () => {
        const first = source('first.vtt');
        const second = source('second.vtt', 0);
        const sources = MediaSources.fromFiles([first, second]);

        expect(sources.findSubtitleTrack(source('first.vtt'))).toBeUndefined();
        expect(sources.findSubtitleTrack({ ...first, id: 'different' })).toBeUndefined();
        expect(sources.findSubtitleTrack(second)).toBeUndefined();
    });

    it('keeps the subtitle track reference when the video is unloaded', () => {
        const original = MediaSources.fromFiles([source('English.vtt'), source('video.mp4')]);
        const unloaded = new MediaSources(original.subtitleSource);

        expect(unloaded.subtitleTracks).toBe(original.subtitleTracks);
        expect(unloaded.subtitleFileNames).toEqual(['English.vtt']);
        expect(unloaded.videoFile).toBeUndefined();
    });

    it.each([-1, 0.5, NaN, Infinity, 1])('rejects an invalid track index of %s', (track) => {
        expect(() => MediaSources.fromFiles([source('English.vtt', track)])).toThrow('Invalid subtitle track index');
    });

    it.each([
        [['video.mp4', 'another.mkv'], 'error.onlyOneVideoFile'],
        [['audio.mp3', 'another.wav'], 'error.onlyOneAudioFile'],
        [['video.mp4', 'audio.mp3'], 'error.onlyOneAudioFile'],
        [['no-extension'], 'error.unknownExtension'],
        [['unsupported.txt'], 'error.unsupportedExtension'],
    ])('rejects unsupported file selections %s', (names, key) => {
        try {
            MediaSources.fromFiles(names.map((name) => source(name)));
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
    trackNames(MediaSources.fromFiles(decodeSubtitleSourceFiles(serializedSourceFiles, flatten)));

describe('subtitle source messages', () => {
    it('keeps video-owned track names available to history jumps and rewind without creating local files', () => {
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

        expect(sources.subtitleSource.kind).toBe('video');
        expect(sources.subtitleFileNames).toEqual(['embedded.ass', '', 'companion.vtt']);
        expect(sources.hasSubtitleFile('embedded.ass')).toBe(true);
        expect(sources.hasSubtitleFile('companion.vtt')).toBe(true);
        expect(sources.hasSubtitleFile('')).toBe(false);
        expect(sources.hasSubtitleFile('missing.vtt')).toBe(false);
        expect(sources.subtitleTracks).toEqual([]);
        expect(sources.allSourceFiles).toEqual([]);
    });

    it('preserves remote ownership for an empty video selection', () => {
        const sources = MediaSources.fromSync({ command: 'syncv2', subtitles: [], subtitleSource: { tracks: [] } });
        expect(sources.subtitleSource.kind).toBe('video');
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
