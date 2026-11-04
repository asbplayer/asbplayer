import { describe, expect, it } from '@jest/globals';
import type { SerializedSubtitleFile } from '@project/common';
import { decodeSubtitleSourceFiles, decodeSubtitleTracks } from '@project/common/app/services/subtitle-source-files';

const serializedSourceFile = (name: string, track?: number): SerializedSubtitleFile => ({
    name,
    base64: btoa('Subtitle text'),
    ...(track === undefined ? {} : { track }),
});

const trackNames = (serializedSourceFiles: SerializedSubtitleFile[], flatten?: boolean) =>
    decodeSubtitleTracks(serializedSourceFiles, flatten).map(({ fileParts }) => fileParts.map(({ file }) => file.name));

describe('subtitle source messages', () => {
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
        expect(trackNames([serializedSourceFile('English.vtt'), serializedSourceFile('Spanish.vtt')], flatten)).toEqual(
            [['English.vtt'], ['Spanish.vtt']]
        );
    });

    it('groups legacy fragments when flatten is true', () => {
        expect(trackNames([serializedSourceFile('part1.vtt'), serializedSourceFile('part2.vtt')], true)).toEqual([
            ['part1.vtt', 'part2.vtt'],
        ]);
    });

    it('prioritizes explicit track indexes over the legacy flatten fallback', () => {
        expect(
            trackNames(
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
        expect(decodeSubtitleTracks([])).toEqual([]);
    });

    it.each([-1, 0.5, NaN, Infinity, 1])('rejects an invalid track index of %s', (track) => {
        expect(() => decodeSubtitleTracks([serializedSourceFile('subtitle.vtt', track)])).toThrow(
            'Invalid subtitle track index'
        );
    });
});
