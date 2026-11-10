import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { ProgressiveSubtitleReader } from '@project/common/subtitle-reader/progressive-subtitle-reader';
import { SubtitleHtml } from '@project/common';

// These tests use the real ASS parser; this unused SRT dependency ships as ESM.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

const createReader = (options: Partial<ConstructorParameters<typeof SubtitleReader>[0]> = {}) =>
    new SubtitleReader({
        regexFilter: '',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: () => Promise.reject(new Error('PGS worker is not used in these tests')),
        ...options,
    });

describe('ProgressiveSubtitleReader', () => {
    const fileText = Object.getOwnPropertyDescriptor(File.prototype, 'text');
    const header = `[Script Info]
ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const dialogue = (text: string, start = '0:00:01.00') => `Dialogue: 0,${start},0:00:04.00,Default,,0,0,0,,${text}`;

    beforeEach(() => {
        Object.defineProperty(File.prototype, 'text', {
            configurable: true,
            value: function (this: File) {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsText(this);
                });
            },
        });
    });

    afterEach(() => {
        if (fileText) Object.defineProperty(File.prototype, 'text', fileText);
        else Reflect.deleteProperty(File.prototype, 'text');
    });

    it('retains fragmented headers and events, flushes EOF, and preserves filtering and cue IDs', async () => {
        const reader = new ProgressiveSubtitleReader(createReader({ regexFilter: 'speaker: ' }), 'ass');
        const parts = header.split('[Events]');
        expect(await reader.read(parts[0] + '[Eve')).toEqual([]);
        expect(await reader.read('nts]' + parts[1] + dialogue('speaker: first') + '\r')).toEqual([
            expect.objectContaining({ cueId: 0, text: 'first', start: 1000, end: 4000 }),
        ]);
        expect(await reader.read('\n' + dialogue('speaker: first') + '\n')).toEqual([]);
        expect(await reader.read(dialogue('speaker: second', '0:00:03.00'))).toEqual([]);
        expect(await reader.read('', true)).toEqual([
            expect.objectContaining({ cueId: 1, text: 'second', start: 3000, end: 4000 }),
        ]);
    });

    it('accepts an empty ASS file with its events header', async () => {
        const reader = new ProgressiveSubtitleReader(createReader(), 'ass');
        expect(await reader.read(header.trimEnd(), true)).toEqual([]);
    });

    it('rejects dialogue before the events header', async () => {
        const reader = new ProgressiveSubtitleReader(createReader(), 'ass');
        await expect(reader.read(dialogue('first') + '\n')).rejects.toThrow('before the events header');
    });

    it('propagates parser errors', async () => {
        const error = new Error('Could not parse subtitles');
        const reader = createReader();
        jest.spyOn(reader, 'subtitles').mockRejectedValueOnce(error);
        const progressive = new ProgressiveSubtitleReader(reader, 'ass');
        await expect(progressive.read(header + dialogue('first') + '\n')).rejects.toBe(error);
    });
});
