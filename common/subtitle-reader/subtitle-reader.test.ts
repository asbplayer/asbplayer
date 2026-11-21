import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';
import { strFromU8, unzipSync } from 'fflate';

import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleHtml } from '@project/common';
import { defaultSettings } from '@project/common/settings';
import { renderRichTextOntoSubtitles } from '@project/common/annotations/render-annotations';

const createReader = (options: Partial<ConstructorParameters<typeof SubtitleReader>[0]> = {}) =>
    new SubtitleReader({
        regexFilter: '',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: () => Promise.reject(new Error('PGS worker is not used in these tests')),
        ...options,
    });

const vttFile = (text: string, extension = 'vtt', timings = '00:00:00.000 --> 999:59:59.999') =>
    ({ name: `test.${extension}`, text: async () => `WEBVTT\n\n${timings}\n${text}\n\n` }) as unknown as File;

describe('SubtitleReader ASS parsing', () => {
    const header = `[Script Info]
ScriptType: v4.00+
[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const dialogue = (text: string, start = '0:00:01.00', end = '0:00:04.00') =>
        `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;

    it('retains fragmented sections, formats, and events, deduplicates across batches, and flushes EOF', () => {
        const progressive = createReader({ regexFilter: 'speaker: ' }).createProgressiveReader('ass');
        for (let index = 0; index < header.length; index += 3) {
            expect(progressive.read(header.slice(index, index + 3))).toEqual([]);
        }
        expect(progressive.read(dialogue('speaker: first') + '\r')).toEqual([
            expect.objectContaining({ cueId: 0, text: 'first', start: 1000, end: 4000 }),
        ]);
        expect(progressive.read('\n' + dialogue('speaker: first') + '\n')).toEqual([]);
        expect(progressive.read(dialogue('speaker: second', '0:00:03.00'))).toEqual([]);
        expect(progressive.read('', true)).toEqual([
            expect.objectContaining({ cueId: 1, text: 'second', start: 3000, end: 4000 }),
        ]);
    });

    it('uses the captured events format to interpret later batches', () => {
        const progressive = createReader().createProgressiveReader('ass');
        expect(progressive.read('[Events]\r\nFormat: End, Start, Text\r\n')).toEqual([]);
        expect(progressive.read('Dialogue: 0:00:02.00,0:00:01.00,first,with comma\r\n')).toMatchObject([
            { cueId: 0, start: 1000, end: 2000, text: 'first,with comma' },
        ]);
        expect(progressive.read('Dialogue: 0:00:04.00,0:00:03.00,second', true)).toMatchObject([
            { cueId: 1, start: 3000, end: 4000, text: 'second' },
        ]);
    });

    it.each([SubtitleHtml.render, SubtitleHtml.remove])(
        'shares sorting, duration filtering, sanitization, ruby conversion, and deduplication with file parsing (%s)',
        async (subtitleHtml) => {
            const reader = createReader({ regexFilter: 'speaker: *', convertNetflixRuby: true, subtitleHtml });
            const text =
                header +
                [
                    dialogue('speaker: second', '0:00:03.00', '0:00:04.00'),
                    dialogue('speaker: zero duration', '0:00:02.00', '0:00:02.00'),
                    dialogue('speaker: reversed', '0:00:02.00', '0:00:01.00'),
                    dialogue('speaker: {\\i1}漢字(かんじ){\\i0}\\N<img src=x onerror=alert(1)><b>word</b>'),
                    dialogue('speaker: {\\i1}漢字(かんじ){\\i0}\\N<img src=x onerror=alert(1)><b>word</b>'),
                    dialogue('{\\p1}m 0 0 l 1 1{\\p0}'),
                    dialogue('speaker: '),
                ].join('\n');
            const nodes = await reader.subtitles([
                { fileParts: [{ name: 'subtitles.ass', text: async () => text } as File] },
            ]);
            const cues = reader.createProgressiveReader('ass').read(text, true);
            expect(cues.map((cue) => ({ ...cue, track: 0 }))).toEqual(nodes.map((node, cueId) => ({ ...node, cueId })));
            expect(cues.map((cue) => cue.text)).toEqual([
                subtitleHtml === SubtitleHtml.render ? '漢字\n<b>word</b>' : '漢字\nword',
                'second',
            ]);
            expect(cues[0].tokenization?.tokens[0]).toMatchObject({
                pos: [0, 2],
                readings: [{ pos: [0, 2], reading: 'かんじ' }],
            });
        }
    );

    it('keeps each progressive reader independent', () => {
        const reader = createReader();
        const first = reader.createProgressiveReader('ass');
        const second = reader.createProgressiveReader('ass');
        first.read(header);
        second.read(header);
        expect(first.read(dialogue('first') + '\n')).toMatchObject([{ cueId: 0, text: 'first' }]);
        expect(second.read(dialogue('second') + '\n')).toMatchObject([{ cueId: 0, text: 'second' }]);
    });

    it('accepts an empty ASS track with an events format', () => {
        expect(createReader().createProgressiveReader('ass').read(header.trimEnd(), true)).toEqual([]);
    });

    it('rejects dialogue before the events format', () => {
        expect(() =>
            createReader()
                .createProgressiveReader('ass')
                .read('[Events]\n' + dialogue('first') + '\n')
        ).toThrow('before the events format');
    });

    it.each(['<html>Error</html>', '[Events]\n'])(
        'rejects a completed response without an events format: %s',
        (text) => {
            expect(() => createReader().createProgressiveReader('ass').read(text, true)).toThrow(
                'ASS events header and format'
            );
        }
    );

    it('rejects unsupported progressive formats', () => {
        expect(() => createReader().createProgressiveReader('vtt')).toThrow(
            'Unsupported progressive subtitle format: vtt'
        );
    });
});

describe('SubtitleReader progressive SRT parsing', () => {
    it('buffers fragmented SRT cues and flushes the final cue without a trailing separator', () => {
        const progressive = createReader().createProgressiveReader('srt');
        expect(progressive.read('1\r\n00:00:01,000 --> 00:00:02,000\r\nfirst')).toEqual([]);
        expect(progressive.read('\r\nsecond line\r\n\r')).toEqual([]);
        expect(progressive.read('\n2\n00:00:03,000 --> 00:00:04,000\nlast')).toEqual([
            expect.objectContaining({ cueId: 0, text: 'first\nsecond line', start: 1000, end: 2000 }),
        ]);
        expect(progressive.read('', true)).toEqual([
            expect.objectContaining({ cueId: 1, text: 'last', start: 3000, end: 4000 }),
        ]);
    });
});

describe('SubtitleReader progressive bitmap parsing', () => {
    const originalTextDecoder = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder');
    const record = {
        start: 2000,
        end: 4000,
        textImage: {
            dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
            screen: { width: 1920, height: 1080 },
            image: { width: 300, height: 50 },
        },
    };
    const encode = (value: string) => Uint8Array.from(new TextEncoder().encode(value)).buffer;

    beforeAll(() => {
        Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder });
    });

    afterAll(() => {
        if (originalTextDecoder) Object.defineProperty(globalThis, 'TextDecoder', originalTextDecoder);
        else Reflect.deleteProperty(globalThis, 'TextDecoder');
    });

    it('buffers arbitrary chunks, publishes complete cues, and restores the same file', async () => {
        const reader = createReader();
        const parser = reader.createProgressiveImageReader();
        const first = JSON.stringify(record) + '\n';
        expect(parser.read(encode(''), false)).toEqual([]);
        expect(parser.read(encode(first.slice(0, 17)), false)).toEqual([]);
        expect(parser.read(encode(first.slice(17) + first.slice(0, 30)), false)).toEqual([
            { ...record, text: '', cueId: 0 },
        ]);
        expect(parser.read(encode(first.slice(30)), true)).toEqual([{ ...record, text: '', cueId: 1 }]);
        const file = { name: 'embedded.asbimg', arrayBuffer: async () => encode(first) } as File;
        expect(await reader.subtitles([{ fileParts: [file] }])).toEqual([{ ...record, text: '', track: 0 }]);
    });

    it('accepts an empty track and rejects a truncated final record', () => {
        expect(createReader().createProgressiveImageReader().read(encode(''), true)).toEqual([]);
        expect(() =>
            createReader()
                .createProgressiveImageReader()
                .read(encode(JSON.stringify(record)), true)
        ).toThrow('Incomplete');
    });

    it.each([
        { ...record, start: -1 },
        { ...record, end: 2000 },
        { ...record, textImage: { ...record.textImage, screen: { width: 100000, height: 1080 } } },
        { ...record, textImage: { ...record.textImage, image: { width: 1921, height: 50 } } },
        { ...record, textImage: { ...record.textImage, image: { width: 300, height: 1081 } } },
        { ...record, textImage: { ...record.textImage, dataUrl: 'https://example.com/image.png' } },
        { ...record, textImage: { ...record.textImage, dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' } },
        { ...record, textImage: { ...record.textImage, dataUrl: 'data:image/png;base64,foo" onerror="alert(1)' } },
    ])('rejects malformed timing, dimensions, and non-PNG image sources %#', (value) => {
        expect(() =>
            createReader()
                .createProgressiveImageReader()
                .read(encode(JSON.stringify(value) + '\n'), true)
        ).toThrow('Invalid');
    });
});

describe('SubtitleReader SRT downloads', () => {
    const srtText = (bytes: Uint8Array) => strFromU8(bytes).replaceAll('\r\n', '\n');
    const readBytes = (blob: Blob) =>
        new Promise<Uint8Array>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(blob);
        });
    const cue = (text: string, track: number, start = 1000) => ({ text, track, start, end: start + 1000 });

    it('exports tracks in slot order without mixing cues or changing playback timing', async () => {
        const result = createReader().createSrtDownload(
            [
                { track: 2, name: 'episode.vtt', subtitles: [cue('English 1', 2, 1200), cue('English 2', 2, 2500)] },
                { track: 0, name: 'episode.vtt', subtitles: [cue('日本語', 0, 1800)] },
            ],
            'episode.vtt'
        );

        expect(result?.name).toBe('episode.zip');
        expect(result?.blob.type).toBe('application/zip');
        const files = unzipSync(await readBytes(result!.blob));
        expect(Object.keys(files)).toEqual(['[Track1]episode.srt', '[Track3]episode.srt']);
        expect(srtText(files['[Track1]episode.srt'])).toBe('0\n00:00:01,800 --> 00:00:02,800\n日本語\n\n');
        expect(srtText(files['[Track3]episode.srt'])).toBe(
            '0\n00:00:01,200 --> 00:00:02,200\nEnglish 1\n\n' + '1\n00:00:02,500 --> 00:00:03,500\nEnglish 2\n\n'
        );
    });

    it('parses segmented source tracks and exports one file per track with gaps preserved', async () => {
        const reader = createReader();
        const subtitles = await reader.subtitles([
            {
                fileParts: [
                    vttFile('日本語 1', 'vtt', '00:01.000 --> 00:02.000'),
                    vttFile('日本語 2', 'vtt', '00:03.000 --> 00:04.000'),
                ],
            },
            { fileParts: [] },
            { fileParts: [vttFile('English', 'vtt', '00:02.000 --> 00:03.000')] },
        ]);
        const result = reader.createSrtDownload(
            [
                { track: 0, name: '日本語.vtt', subtitles: subtitles.filter((cue) => cue.track === 0) },
                { track: 2, name: 'English.vtt', subtitles: subtitles.filter((cue) => cue.track === 2) },
            ],
            'episode.mp4'
        );

        expect(result?.name).toBe('episode.zip');
        const files = unzipSync(await readBytes(result!.blob));
        expect(Object.keys(files)).toEqual(['[Track1]日本語.srt', '[Track3]English.srt']);
        expect(srtText(files['[Track1]日本語.srt'])).toBe(
            '0\n00:00:01,000 --> 00:00:02,000\n日本語 1\n\n' + '1\n00:00:03,000 --> 00:00:04,000\n日本語 2\n\n'
        );
        expect(srtText(files['[Track3]English.srt'])).toBe('0\n00:00:02,000 --> 00:00:03,000\nEnglish\n\n');
    });

    it('downloads a single text track directly with its original slot prefix', async () => {
        const result = createReader().createSrtDownload(
            [{ track: 2, name: 'English.vtt', subtitles: [cue('English', 2)] }],
            'episode.mp4'
        );

        expect(result?.name).toBe('[Track3]English.srt');
        expect(result?.blob.type).toBe('text/plain');
        expect(srtText(await readBytes(result!.blob))).toBe('0\n00:00:01,000 --> 00:00:02,000\nEnglish\n\n');
    });

    it('keeps repeated Unicode filenames as separate ZIP entries and sanitizes paths', async () => {
        const result = createReader().createSrtDownload(
            [
                { track: 0, name: '../日本語.vtt', subtitles: [cue('日本語', 0)] },
                { track: 1, name: '../日本語.vtt', subtitles: [cue('日本語', 1)] },
            ],
            '../日本語.vtt'
        );
        const files = unzipSync(await readBytes(result!.blob));

        expect(result?.name).toBe('..日本語.zip');
        expect(Object.keys(files)).toEqual(['[Track1]..日本語.srt', '[Track2]..日本語.srt']);
        expect(strFromU8(files['[Track1]..日本語.srt'])).toBe(strFromU8(files['[Track2]..日本語.srt']));
    });

    it('uses the video filename when a subtitle source has no basename', () => {
        expect(
            createReader().createSrtDownload(
                [{ track: 0, name: '.srt', subtitles: [cue('English', 0)] }],
                'episode.mp4'
            )?.name
        ).toBe('[Track1]episode.srt');
    });

    it('uses a generic fallback when no filename is available', () => {
        expect(
            createReader().createSrtDownload([{ track: 2, name: '', subtitles: [cue('English', 2)] }], '')?.name
        ).toBe('[Track3]subtitles.srt');
    });

    it('preserves an explicitly selected text track with no cues as an empty SRT', () => {
        const result = createReader().createSrtDownload(
            [{ track: 0, name: 'English.vtt', subtitles: [] }],
            'episode.mp4'
        );

        expect(result?.name).toBe('[Track1]English.srt');
        expect(result?.blob.size).toBe(0);
    });

    it('produces no download without selected text tracks', () => {
        expect(createReader().createSrtDownload([], 'episode.mp4')).toBeUndefined();
    });
});

const nfimscFile = (xml: string) => ({ name: 'test.nfimsc', text: async () => xml }) as unknown as File;
const srtFile = (text: string) =>
    ({ name: 'test.srt', text: async () => `1\n00:00:00,000 --> 00:00:01,000\n${text}` }) as unknown as File;

const parse = (xml: string, convertNetflixRuby = false, flatten = false, fileCount = 1) =>
    createReader({ convertNetflixRuby }).subtitles(
        flatten
            ? [{ fileParts: Array.from({ length: fileCount }, () => nfimscFile(xml)) }]
            : Array.from({ length: fileCount }, () => nfimscFile(xml)).map((file) => ({ fileParts: [file] }))
    );

const rubyWithPrecedingKanaXml =
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
    '<head><styling>' +
    '<style xml:id="container" tts:ruby="container"/>' +
    '<style xml:id="base" tts:ruby="base"/>' +
    '<style xml:id="text" tts:ruby="text"/>' +
    '</styling></head>' +
    '<body><div>' +
    '<p begin="10000000t" end="30000000t">ひろ<span style="container"><span style="base">子</span><span style="text">こ</span></span>そんな</p>' +
    '</div></body>' +
    '</tt>';

const nfimscDocument = (text: string, begin = '10000000', end = '30000000') =>
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000">' +
    `<body><div><p begin="${begin}t" end="${end}t">${text}</p></div></body>` +
    '</tt>';

const duplicateNfimscDocument = (count: number) =>
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000">' +
    '<body><div>' +
    Array.from({ length: count }, () => '<p begin="10000000t" end="30000000t">Duplicate cue</p>').join('') +
    '</div></body></tt>';

const srv3File = (xml: string) => ({ name: 'test.ytsrv3', text: async () => xml }) as unknown as File;
const srv3Document = (rows: string, mode = '0') =>
    `<timedtext format="3"><head><ws id="0"/><ws id="1" mh="${mode}"/></head><body>` +
    '<w t="0" id="1" ws="1"/>' +
    rows +
    '</body></timedtext>';

describe('SubtitleReader grouped tracks', () => {
    it.each([
        { name: 'adjacent tracks', secondTrack: 1 },
        { name: 'an empty slot between tracks', secondTrack: 2 },
    ])('preserves two segmented tracks with $name', async ({ secondTrack }) => {
        const firstTrack = {
            fileParts: [
                vttFile('Shared text', 'vtt', '00:01.000 --> 00:02.000'),
                vttFile('First language', 'vtt', '00:03.000 --> 00:04.000'),
            ],
        };
        const otherTrack = {
            fileParts: [
                vttFile('Shared text', 'vtt', '00:01.000 --> 00:02.000'),
                vttFile('Second language', 'vtt', '00:02.000 --> 00:03.000'),
            ],
        };
        const tracks = secondTrack === 1 ? [firstTrack, otherTrack] : [firstTrack, { fileParts: [] }, otherTrack];

        await expect(createReader().subtitles(tracks)).resolves.toEqual([
            { start: 1000, end: 2000, text: 'Shared text', track: 0 },
            { start: 1000, end: 2000, text: 'Shared text', track: secondTrack },
            { start: 2000, end: 3000, text: 'Second language', track: secondTrack },
            { start: 3000, end: 4000, text: 'First language', track: 0 },
        ]);
    });

    it('keeps a complete file separate from a segmented track', async () => {
        await expect(
            createReader().subtitles([
                { fileParts: [vttFile('Complete track', 'vtt', '00:02.000 --> 00:03.000')] },
                {
                    fileParts: [
                        vttFile('First part', 'vtt', '00:01.000 --> 00:02.000'),
                        vttFile('Second part', 'vtt', '00:03.000 --> 00:04.000'),
                    ],
                },
            ])
        ).resolves.toEqual([
            { start: 1000, end: 2000, text: 'First part', track: 1 },
            { start: 2000, end: 3000, text: 'Complete track', track: 0 },
            { start: 3000, end: 4000, text: 'Second part', track: 1 },
        ]);
    });
});

describe('SubtitleReader YouTube pop-on captions', () => {
    it('caps overlapping two-line cues at the next start', async () => {
        const rows =
            '<p t="0" d="6880" w="1">Walk into supermarkets in London, Delhi,\nor Johannesburg, and you&#39;ll find many of</p>' +
            '<p t="4760" d="7640" w="1">the same global [music] food brands. Kit\nKats, Maggi, Cerelac, Fanta. The</p>' +
            '<p t="9880" d="6920" w="1">packaging may look nearly identical, but\nturn it around to check the ingredients.</p>';

        await expect(createReader().subtitles([{ fileParts: [srv3File(srv3Document(rows))] }])).resolves.toEqual([
            {
                start: 0,
                end: 4760,
                text: "Walk into supermarkets in London, Delhi,\nor Johannesburg, and you'll find many of",
                track: 0,
            },
            {
                start: 4760,
                end: 9880,
                text: 'the same global [music] food brands. Kit\nKats, Maggi, Cerelac, Fanta. The',
                track: 0,
            },
            {
                start: 9880,
                end: 16800,
                text: 'packaging may look nearly identical, but\nturn it around to check the ingredients.',
                track: 0,
            },
        ]);
    });

    it('keeps newline-based shortening for the working roll-up response', async () => {
        const rows =
            '<p t="0" d="4760" w="1"><s>Walk</s><s t="400"> into supermarkets in London, Delhi,</s></p>' +
            '<p t="2590" d="2170" w="1" a="1">\n</p>' +
            '<p t="2600" d="4280" w="1"><s>or</s><s t="160"> Johannesburg, and you&#39;ll find many of</s></p>' +
            '<p t="4750" d="2130" w="1" a="1">\n</p>';

        await expect(createReader().subtitles([{ fileParts: [srv3File(srv3Document(rows, '2'))] }])).resolves.toEqual([
            { start: 0, end: 2590, text: 'Walk into supermarkets in London, Delhi,', track: 0 },
            { start: 2600, end: 4750, text: "or Johannesburg, and you'll find many of", track: 0 },
        ]);
    });

    it.each([
        { scenario: 'roll-up mode', mode: '2', nextWindow: '1', append: '0' },
        { scenario: 'a different window', mode: '0', nextWindow: '2', append: '0' },
        { scenario: 'an append event', mode: '0', nextWindow: '1', append: '1' },
    ])('preserves overlaps for $scenario', async ({ mode, nextWindow, append }) => {
        const rows =
            '<p t="0" d="6000" w="1">First</p>' + `<p t="3000" d="6000" w="${nextWindow}" a="${append}">Second</p>`;

        await expect(createReader().subtitles([{ fileParts: [srv3File(srv3Document(rows, mode))] }])).resolves.toEqual([
            { start: 0, end: 6000, text: 'First', track: 0 },
            { start: 3000, end: 9000, text: 'Second', track: 0 },
        ]);
    });

    it('preserves gaps between non-overlapping pop-on cues', async () => {
        const rows = '<p t="0" d="1000" w="1">First</p><p t="2000" d="1000" w="1">Second</p>';

        await expect(createReader().subtitles([{ fileParts: [srv3File(srv3Document(rows))] }])).resolves.toEqual([
            { start: 0, end: 1000, text: 'First', track: 0 },
            { start: 2000, end: 3000, text: 'Second', track: 0 },
        ]);
    });
});

describe('SubtitleReader text content', () => {
    it('drops subtitles left with only invisible or whitespace characters (#669)', async () => {
        // A cue whose only content is a left-to-right mark (U+200E) has no meaningful
        // text, so it is dropped instead of rendered as a blank line.
        const removed = await createReader().subtitles([{ fileParts: [srtFile('\u200e')] }]);
        expect(removed).toHaveLength(0);
    });

    it('keeps subtitles that have real text alongside bidi marks (#669)', async () => {
        // Bidi marks are preserved within meaningful text; only empty cues are dropped.
        const [subtitle] = await createReader().subtitles([{ fileParts: [srtFile('ab\u200ecd')] }]);
        expect(subtitle.text).toBe('ab\u200ecd');
    });

    it.each([
        ['empty formatting tags', '<b><i></i></b>'],
        ['line breaks', '<br><br>'],
        ['encoded whitespace', '<span>&nbsp;&#32;&#9;</span>'],
        ['encoded bidi marks', '<b>&lrm;&#x200f;</b>'],
        ['ruby readings without base text', '<ruby>\u200e<rp>(</rp><rt>ご</rt><rp>)</rp></ruby>'],
    ])('drops cues containing only %s', async (_scenario, text) => {
        const subtitles = await createReader().subtitles([{ fileParts: [srtFile(text)] }]);

        expect(subtitles).toEqual([]);
    });

    it.each([
        ['formatted text', '<b>Hello</b>'],
        ['ruby base text', '<ruby>語<rp>(</rp><rt>ご</rt><rp>)</rp></ruby>'],
        ['encoded punctuation', '&amp;'],
    ])('keeps %s without changing its markup or entities', async (_scenario, text) => {
        const subtitles = await createReader().subtitles([{ fileParts: [srtFile(text)] }]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text, track: 0 }]);
    });

    it('drops markup and invisible leftovers after regex filtering while keeping meaningful cues', async () => {
        const subtitles = await createReader({
            regexFilter: '\\[.+\\]',
            regexFilterTextReplacement: '',
        }).subtitles([
            { fileParts: [srtFile('<b>[THUNDER]</b>\u200e')] },
            { fileParts: [srtFile('<b>Hello</b>\u200e')] },
        ]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text: '<b>Hello</b>\u200e', track: 1 }]);
    });

    it('drops a normally matched replacement containing only non-content HTML', async () => {
        const subtitles = await createReader({
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: '<b>&nbsp;\u200f</b><br>',
        }).subtitles([{ fileParts: [srtFile('[THUNDER]')] }]);

        expect(subtitles).toEqual([]);
    });
});

describe('SubtitleReader regex filter fallback', () => {
    it.each([
        ['trailing bidi marks', '[THUNDER]\u200e'],
        ['leading bidi marks', '\u200f[THUNDER]'],
        ['both boundary marks', '\u2066[THUNDER]\u2069'],
        ['whitespace, controls, and default-ignorable characters', ' \t\u0001\u200b[THUNDER]\u0007\ufe0f\n '],
    ])('drops cues when %s prevent an anchored regex from matching', async (_scenario, text) => {
        const subtitles = await createReader({
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: '',
        }).subtitles([{ fileParts: [srtFile(text)] }]);

        expect(subtitles).toEqual([]);
    });

    it.each([
        ['whitespace', ' \t\n'],
        ['invisible characters', '\u200e\u2066'],
        ['empty HTML', '<b>&nbsp;\u200f</b><br>'],
    ])('drops cues when the fallback produces only %s', async (_scenario, replacement) => {
        const subtitles = await createReader({
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: replacement,
        }).subtitles([{ fileParts: [srtFile('[THUNDER]\u200e')] }]);

        expect(subtitles).toEqual([]);
    });

    it.each([
        {
            scenario: 'the regex still does not match',
            text: '\u200fHello\u200e',
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: '',
        },
        {
            scenario: 'matching would require removing an internal bidi mark',
            text: '[THUN\u200eDER]\u200f',
            regexFilter: '^\\[THUNDER\\]$',
            regexFilterTextReplacement: '',
        },
        {
            scenario: 'the fallback replacement contains meaningful text',
            text: '[THUNDER]\u200e',
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: 'sound effect',
        },
        {
            scenario: 'no regex filter is configured',
            text: '[THUNDER]\u200e',
            regexFilter: '',
            regexFilterTextReplacement: '',
        },
    ])('preserves the original text when $scenario', async ({ text, regexFilter, regexFilterTextReplacement }) => {
        const subtitles = await createReader({ regexFilter, regexFilterTextReplacement }).subtitles([
            { fileParts: [srtFile(text)] },
        ]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text, track: 0 }]);
    });

    it('uses normal replacement when the regex matches, across multiple cues', async () => {
        const subtitles = await createReader({
            regexFilter: '\u200e$|^\\[.+\\]$',
            regexFilterTextReplacement: '',
        }).subtitles([{ fileParts: [srtFile('[THUNDER]\u200e')] }, { fileParts: [srtFile('[RAIN]\u200e')] }]);

        expect(subtitles).toEqual([
            { start: 0, end: 1000, text: '[THUNDER]', track: 0 },
            { start: 0, end: 1000, text: '[RAIN]', track: 1 },
        ]);
    });
});

describe('SubtitleReader Netflix IMSC parsing', () => {
    it('parses Netflix IMSC cues', async () => {
        // Prefixed elements, namespaced ttp:tickRate, a dur-only cue, a second
        // <div>, and a nested <span> all in one document.
        const xml =
            '<tt:tt xmlns:tt="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000">' +
            '<tt:body>' +
            '<tt:div>' +
            '<tt:p begin="10000000t" end="30000000t"><tt:span>Hello</tt:span> world</tt:p>' +
            '<tt:p begin="40000000t" dur="20000000t">Second line</tt:p>' +
            '</tt:div>' +
            '<tt:div>' +
            '<tt:p begin="70000000t" end="90000000t">Third line</tt:p>' +
            '</tt:div>' +
            '</tt:body>' +
            '</tt:tt>';

        const subtitles = await parse(xml);

        expect(subtitles).toHaveLength(3);
        expect(subtitles[0]).toMatchObject({ start: 1000, end: 3000, text: 'Hello world' });
        expect(subtitles[1]).toMatchObject({ start: 4000, end: 6000, text: 'Second line' });
        expect(subtitles[2]).toMatchObject({ start: 7000, end: 9000, text: 'Third line' });
    });

    it('orders simultaneous Netflix IMSC cues by their vertical region position', async () => {
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
            '<head><layout>' +
            '<region xml:id="bottom" tts:origin="17.5% 84.62%"/>' +
            '<region xml:id="top" tts:origin="30% 79.29%"/>' +
            '</layout></head>' +
            '<body><div>' +
            '<p begin="385807505t" end="411245000t" region="bottom">I couldn\'t close it, so...</p>' +
            '<p begin="385807505t" end="411245000t" region="top">Oh, I told you.</p>' +
            '</div></body>' +
            '</tt>';

        const subtitles = await parse(xml);

        expect(subtitles.map(({ text }) => text)).toEqual(['Oh, I told you.', "I couldn't close it, so..."]);
    });

    it('retains source order when a simultaneous Netflix IMSC cue has no usable region position', async () => {
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
            '<head><layout><region xml:id="top" tts:origin="30% 79.29%"/></layout></head>' +
            '<body><div>' +
            '<p begin="10000000t" end="30000000t">First in source</p>' +
            '<p begin="10000000t" end="30000000t" region="top">Second in source</p>' +
            '</div></body>' +
            '</tt>';

        const subtitles = await parse(xml);

        expect(subtitles.map(({ text }) => text)).toEqual(['First in source', 'Second in source']);
    });

    it('converts IMSC ruby styles through the Netflix ruby tokenization', async () => {
        // The ruby container references two styles ("plain container") to exercise
        // multi-id style resolution.
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
            '<head><styling>' +
            '<style xml:id="plain" tts:fontStyle="normal"/>' +
            '<style xml:id="container" tts:ruby="container"/>' +
            '<style xml:id="base" tts:ruby="base"/>' +
            '<style xml:id="text" tts:ruby="text"/>' +
            '</styling></head>' +
            '<body><div>' +
            '<p begin="10000000t" end="30000000t"><span style="plain container"><span style="base">日本</span><span style="text">にほん</span></span></p>' +
            '</div></body>' +
            '</tt>';

        const withRuby = await parse(xml, true);
        expect(withRuby).toHaveLength(1);
        expect(withRuby[0].text).toBe('日本');
        expect(withRuby[0].tokenization).toEqual({
            tokens: [{ pos: [0, 2], readings: [{ pos: [0, 2], reading: 'にほん' }], states: [] }],
        });

        const withoutRuby = await parse(xml, false);
        expect(withoutRuby).toHaveLength(1);
        expect(withoutRuby[0].text).toBe('日本(にほん)');
        expect(withoutRuby[0].tokenization).toBeUndefined();
    });

    it('binds a ruby reading to its own base when preceded by kanji or kana', async () => {
        // The base 子 is preceded by the kana ひろ. The reading must bind to 子 alone,
        // not to the whole ひろ子 run.
        const xml = rubyWithPrecedingKanaXml;

        const withRuby = await parse(xml, true);
        expect(withRuby).toHaveLength(1);
        expect(withRuby[0].text).toBe('ひろ子そんな');
        expect(withRuby[0].text).not.toContain('\u2063');
        expect(withRuby[0].tokenization).toEqual({
            tokens: [{ pos: [2, 3], readings: [{ pos: [0, 1], reading: 'こ' }], states: [] }],
        });

        const withoutRuby = await parse(xml, false);
        expect(withoutRuby).toHaveLength(1);
        expect(withoutRuby[0].text).toBe('ひろ子(こ)そんな');
        expect(withoutRuby[0].text).not.toContain('\u2063');
        expect(withoutRuby[0].tokenization).toBeUndefined();
    });

    it.each([
        ['3月', 'さんがつ'],
        ['第3', 'だいさん'],
    ])('preserves the authored mixed-script base %s and later ruby positions', async (base, reading) => {
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
            '<head><styling>' +
            '<style xml:id="container" tts:ruby="container"/>' +
            '<style xml:id="base" tts:ruby="base"/>' +
            '<style xml:id="text" tts:ruby="text"/>' +
            '</styling></head>' +
            '<body><div><p begin="10000000t" end="30000000t">予定は' +
            `<span style="container"><span style="base">${base}</span><span style="text">${reading}</span></span>` +
            'と<span style="container"><span style="base">子</span><span style="text">こ</span></span>' +
            '</p></div></body></tt>';

        const subtitles = await parse(xml, true);

        expect(subtitles).toEqual([
            {
                start: 1000,
                end: 3000,
                text: `予定は${base}と子`,
                track: 0,
                tokenization: {
                    tokens: [
                        { pos: [3, 5], readings: [{ pos: [0, 2], reading }], states: [] },
                        { pos: [6, 7], readings: [{ pos: [0, 1], reading: 'こ' }], states: [] },
                    ],
                },
            },
        ]);
    });

    it('keeps ruby conversion while flattening and deduplicates identical files', async () => {
        const subtitles = await parse(rubyWithPrecedingKanaXml, true, true, 2);

        expect(subtitles).toHaveLength(1);
        expect(subtitles[0]).toMatchObject({
            start: 1000,
            end: 3000,
            track: 0,
            text: 'ひろ子そんな',
            tokenization: {
                tokens: [{ pos: [2, 3], readings: [{ pos: [0, 1], reading: 'こ' }], states: [] }],
            },
        });
    });

    it('deduplicates cues that become equal after sanitization', async () => {
        const subtitles = await createReader().subtitles([
            {
                fileParts: [
                    nfimscFile(nfimscDocument('safe&lt;img src=x onerror=alert(1)&gt;')),
                    nfimscFile(nfimscDocument('safe')),
                ],
            },
        ]);

        expect(subtitles).toHaveLength(1);
        expect(subtitles[0]).toMatchObject({
            start: 1000,
            end: 3000,
            track: 0,
            text: 'safe',
        });
    });

    it('deduplicates duplicate cues within a track without flattening', async () => {
        const subtitles = await parse(duplicateNfimscDocument(3));

        expect(subtitles).toHaveLength(1);
        expect(subtitles[0]).toMatchObject({ start: 1000, end: 3000, text: 'Duplicate cue', track: 0 });
    });

    it('deduplicates duplicate cues after flattening files into one track', async () => {
        const subtitles = await parse(duplicateNfimscDocument(3), false, true, 3);

        expect(subtitles).toHaveLength(1);
        expect(subtitles[0]).toMatchObject({ start: 1000, end: 3000, text: 'Duplicate cue', track: 0 });
    });

    it.each([
        {
            difference: 'start',
            first: nfimscDocument('Same text', '10000000'),
            second: nfimscDocument('Same text', '20000000'),
            expected: [
                { start: 1000, end: 3000, text: 'Same text' },
                { start: 2000, end: 3000, text: 'Same text' },
            ],
        },
        {
            difference: 'end',
            first: nfimscDocument('Same text', '10000000', '30000000'),
            second: nfimscDocument('Same text', '10000000', '40000000'),
            expected: [
                { start: 1000, end: 3000, text: 'Same text' },
                { start: 1000, end: 4000, text: 'Same text' },
            ],
        },
        {
            difference: 'text',
            first: nfimscDocument('First text'),
            second: nfimscDocument('Second text'),
            expected: [
                { start: 1000, end: 3000, text: 'First text' },
                { start: 1000, end: 3000, text: 'Second text' },
            ],
        },
    ])('preserves flattened cues when only the $difference differs', async ({ first, second, expected }) => {
        const subtitles = await createReader().subtitles([{ fileParts: [nfimscFile(first), nfimscFile(second)] }]);

        expect(subtitles).toHaveLength(2);
        expect(subtitles).toMatchObject(expected.map((cue) => ({ ...cue, track: 0 })));
    });

    it('preserves equal cues from separate tracks without flattening', async () => {
        const subtitles = await parse(nfimscDocument('Same text'), false, false, 2);

        expect(subtitles).toHaveLength(2);
        expect(subtitles.map((subtitle) => subtitle.track)).toEqual([0, 1]);
    });

    it('does not fence a reading containing a closing paren', async () => {
        // The reading )こ cannot be matched by netflixRubyRegex, so no marker is inserted
        // and the cue passes through as literal text with no tokenization.
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:tickRate="10000000">' +
            '<head><styling>' +
            '<style xml:id="container" tts:ruby="container"/>' +
            '<style xml:id="base" tts:ruby="base"/>' +
            '<style xml:id="text" tts:ruby="text"/>' +
            '</styling></head>' +
            '<body><div>' +
            '<p begin="10000000t" end="30000000t">ひろ<span style="container"><span style="base">子</span><span style="text">)こ</span></span>そんな</p>' +
            '</div></body>' +
            '</tt>';

        const withRuby = await parse(xml, true);
        expect(withRuby).toHaveLength(1);
        expect(withRuby[0].text).toBe('ひろ子()こ)そんな');
        expect(withRuby[0].text).not.toContain('\u2063');
        expect(withRuby[0].tokenization).toBeUndefined();
    });

    it('drops tick cues when the tick rate is missing', async () => {
        const xml =
            '<tt xmlns="http://www.w3.org/ns/ttml">' +
            '<body><div><p begin="100t" end="200t">Should be dropped</p></div></body>' +
            '</tt>';

        const subtitles = await parse(xml);

        expect(subtitles).toHaveLength(0);
    });
});

describe('SubtitleReader dfxp timestamp handling', () => {
    it('drops cues whose timestamps are not finite', async () => {
        const xml = '<tt><body><div><p begin="100t" end="200t">Dropped</p></div></body></tt>';
        const file = { name: 'test.dfxp', text: async () => xml } as unknown as File;
        const subtitles = await createReader().subtitles([{ fileParts: [file] }]);

        expect(subtitles).toHaveLength(0);
    });
});

describe('SubtitleReader WebVTT timestamp stripping', () => {
    // https://www.w3.org/TR/webvtt1/#webvtt-timestamp
    it.each([
        '00:00.001',
        '59:59.999',
        '00:00:00.001',
        '01:02:03.004',
        '60:00:00.000',
        '123:45:56.789',
        '000:00:00.001',
    ])('strips a valid timestamp <%s> without changing cue timing or surrounding text', async (timestamp) => {
        const subtitles = await createReader().subtitles([{ fileParts: [vttFile(`before<${timestamp}>after`)] }]);

        expect(subtitles).toEqual([{ start: 0, end: 3599999999, text: 'beforeafter', track: 0 }]);
    });

    it.each([
        '60:00.000',
        '00:60.000',
        '99:59.999',
        '59:99.999',
        '00:60:00.000',
        '00:00:60.000',
        '01:99:99.999',
        '1:02:03.004',
        '1:02.003',
        '01:2.003',
        '01:02:3.004',
        '01:02.00',
        '01:02.0000',
        '01:02',
        '01:02,003',
        '01:02x003',
        '+01:02.003',
        '０１:０２.００３',
    ])('preserves timestamp-like text outside the timestamp grammar (%s)', async (timestamp) => {
        const subtitles = await createReader().subtitles([
            { fileParts: [vttFile(`before<${timestamp}>after`)] },
            { fileParts: [vttFile(`before&lt;${timestamp}&gt;after`)] },
        ]);

        expect(subtitles.map((subtitle) => subtitle.text)).toEqual([
            `before&lt;${timestamp}&gt;after`,
            `before&lt;${timestamp}&gt;after`,
        ]);
    });

    it.each([
        '&lt;00:01.001&gt;',
        '&#60;00:01.001&#62;',
        '&#00060;00:01.001&#00062;',
        '&#x3c;00:01.001&#x3e;',
        '&#X0003C;00:01.001&#X0003E;',
        '<00:01.001&gt;',
        '&lt;00:01.001>',
    ])('strips supported escaped timestamp delimiters (%s)', async (timestampTag) => {
        const subtitles = await createReader().subtitles([{ fileParts: [vttFile(`before${timestampTag}after`)] }]);

        expect(subtitles).toEqual([{ start: 0, end: 3599999999, text: 'beforeafter', track: 0 }]);
    });

    it.each([
        ['vtt', SubtitleHtml.render, '<b>Hello</b> <i>world</i>\nagain'],
        ['vtt', SubtitleHtml.remove, 'Hello world\nagain'],
        ['nfvtt', SubtitleHtml.render, '<b>Hello</b> <i>world</i>\nagain'],
        ['nfvtt', SubtitleHtml.remove, 'Hello world\nagain'],
    ])('strips multiple timestamps from %s with HTML mode %s', async (extension, subtitleHtml, expectedText) => {
        const subtitles = await createReader({ subtitleHtml }).subtitles([
            {
                fileParts: [
                    vttFile(
                        '<c.yellow><b>Hello</b></c> <00:01.001><i>world</i>\n&lt;00:02.002&gt;again',
                        extension,
                        '00:00.000 --> 00:03.000'
                    ),
                ],
            },
        ]);

        expect(subtitles).toEqual([{ start: 0, end: 3000, text: expectedText, track: 0 }]);
    });

    it('preserves ordinary text, formatting, entities, and untagged timestamps', async () => {
        const text = '<c.yellow><b>Meet</b></c> at 00:01.000 &amp; <ruby>語<rt>ご</rt></ruby>.';
        const subtitles = await createReader().subtitles([
            { fileParts: [vttFile(text, 'vtt', '00:00.000 --> 00:03.000')] },
        ]);

        expect(subtitles).toEqual([
            { start: 0, end: 3000, text: '<b>Meet</b> at 00:01.000 &amp; <ruby>語<rt>ご</rt></ruby>.', track: 0 },
        ]);
    });

    it('removes timestamps before applying the configured text filter', async () => {
        const subtitles = await createReader({
            regexFilter: 'Hello world',
            regexFilterTextReplacement: 'replaced',
        }).subtitles([{ fileParts: [vttFile('Hello<00:01.001> world', 'vtt', '00:00.000 --> 00:03.000')] }]);

        expect(subtitles).toEqual([{ start: 0, end: 3000, text: 'replaced', track: 0 }]);
    });

    it('drops cues containing only timestamp tags', async () => {
        const subtitles = await createReader().subtitles([
            { fileParts: [vttFile('<00:01.001>&lt;00:02.002&gt;', 'vtt', '00:00.000 --> 00:03.000')] },
        ]);

        expect(subtitles).toEqual([]);
    });
});

describe('SubtitleReader Netflix ruby text conversion', () => {
    it.each(['srt', 'vtt', 'nfvtt'])('renders imported ASCII and numeric readings from %s', async (extension) => {
        const text = 'MIU(ミウ)、007(ゼロゼロセブン)、さっきTwitter(ツイッター)と5G通信(つうしん)';
        const [subtitle] = await createReader({ convertNetflixRuby: true }).subtitles([
            { fileParts: [extension === 'srt' ? srtFile(text) : vttFile(text, extension)] },
        ]);
        const rendered = renderRichTextOntoSubtitles(
            [{ ...subtitle, index: 0 }],
            'video',
            defaultSettings.dictionaryTracks,
            { adaptiveWordVisibilityEnabled: true }
        ).get(0);
        const sink = document.createElement('div');
        sink.innerHTML = rendered?.richText ?? '';

        expect(subtitle.text).toBe('MIU、007、さっきTwitterと5G通信');
        expect(Array.from(sink.querySelectorAll('ruby'), (ruby) => ruby.firstChild?.textContent)).toEqual([
            'MIU',
            '007',
            'Twitter',
            '通信',
        ]);
        expect(Array.from(sink.querySelectorAll('rt'), (reading) => reading.textContent)).toEqual([
            'ミウ',
            'ゼロゼロセブン',
            'ツイッター',
            'つうしん',
        ]);
    });

    it('attaches readings to the final script run and adjusts later SRT token offsets', async () => {
        const [subtitle] = await createReader({ convertNetflixRuby: true }).subtitles([
            { fileParts: [srtFile('さっきTwitter(ツイッター)のトレンドに…と5G通信(つうしん)')] },
        ]);
        const tokens = subtitle.tokenization?.tokens ?? [];

        expect(subtitle.text).toBe('さっきTwitterのトレンドに…と5G通信');
        expect(tokens.map(({ pos }) => subtitle.text.substring(pos[0], pos[1]))).toEqual(['Twitter', '通信']);
        expect(tokens.map(({ readings }) => readings[0].reading)).toEqual(['ツイッター', 'つうしん']);
    });

    it('keeps homogeneous ASCII and Japanese bases whole', async () => {
        const [subtitle] = await createReader({ convertNetflixRuby: true }).subtitles([
            { fileParts: [srtFile('MIU(ミウ)、捏造(ねつぞう)')] },
        ]);
        const tokens = subtitle.tokenization?.tokens ?? [];

        expect(subtitle.text).toBe('MIU、捏造');
        expect(tokens.map(({ pos }) => subtitle.text.substring(pos[0], pos[1]))).toEqual(['MIU', '捏造']);
        expect(tokens.map(({ readings }) => readings[0].reading)).toEqual(['ミウ', 'ねつぞう']);
    });
});

describe('SubtitleReader SRT override tag handling', () => {
    it.each([
        '\\an1',
        '\\an2',
        '\\an3',
        '\\an4',
        '\\an5',
        '\\an6',
        '\\an7',
        '\\an8',
        '\\an9',
        '\\i0',
        '\\i1',
        '\\u0',
        '\\u1',
        '\\s0',
        '\\s1',
        '\\b0',
        '\\b1',
        '\\b100',
        '\\b200',
        '\\b300',
        '\\b400',
        '\\b500',
        '\\b600',
        '\\b700',
        '\\b800',
        '\\b900',
    ])('strips whitelisted ASS-style tag %s from SRT cue text (#471)', async (tag) => {
        const [cue] = await createReader().subtitles([{ fileParts: [srtFile(`{${tag}}Hello`)] }]);
        expect(cue.text).toBe('Hello');
    });

    it('strips multiple whitelisted tags in one block', async () => {
        const [cue] = await createReader().subtitles([
            { fileParts: [srtFile('{\\an8\\i1\\b700}Hello{\\i0\\b0} world')] },
        ]);
        expect(cue.text).toBe('Hello world');
    });

    it('strips multiple override tags and keeps the surrounding text', async () => {
        const [cue] = await createReader().subtitles([{ fileParts: [srtFile('{\\an8}{\\i1}Hello{\\i0} world')] }]);
        expect(cue.text).toBe('Hello world');
    });

    it.each([
        '{}',
        '{text}',
        '{\\}',
        '{\\unknown}',
        '{\\pos(10,20)}',
        '{\\an0}',
        '{\\an10}',
        '{\\i2}',
        '{\\u2}',
        '{\\s2}',
        '{\\b-1}',
        '{\\b00}',
        '{\\b70}',
        '{\\b1000}',
        '{\\an8 text}',
        '{\\an8\\pos(10,20)}',
        '{\\pos(10,20)\\an8}',
        '{\\an8',
    ])('preserves non-whitelisted or malformed block %s', async (block) => {
        const [cue] = await createReader().subtitles([{ fileParts: [srtFile(`Hello${block} world`)] }]);
        expect(cue.text).toBe(`Hello${block} world`);
    });

    it('preserves unsupported blocks alongside whitelisted blocks', async () => {
        const [cue] = await createReader().subtitles([
            { fileParts: [srtFile('{\\an8}Hello{\\unknown}{\\i1} world{\\i0}')] },
        ]);
        expect(cue.text).toBe('Hello{\\unknown} world');
    });
});

describe('SubtitleReader Bilibili JSON parsing', () => {
    it('parses Bilibili JSON cues', async () => {
        const file = {
            name: 'test.bbjson',
            text: async () =>
                JSON.stringify({
                    body: [
                        { from: 1.25, to: 3.5, content: 'First subtitle' },
                        { from: 4, to: 6.75, content: 'Second subtitle' },
                    ],
                }),
        } as unknown as File;

        const subtitles = await createReader().subtitles([{ fileParts: [file] }]);

        expect(subtitles).toHaveLength(2);
        expect(subtitles[0]).toMatchObject({ start: 1250, end: 3500, text: 'First subtitle' });
        expect(subtitles[1]).toMatchObject({ start: 4000, end: 6750, text: 'Second subtitle' });
    });
});

describe('SubtitleReader SRT parsing', () => {
    const file = (text: string) =>
        ({
            name: 'episode.srt',
            type: 'text/plain',
            text: async () => text,
        }) as File;

    it.each([SubtitleHtml.render, SubtitleHtml.remove])(
        'retains literal plain text and overlapping cues with HTML setting %s',
        async (setting) => {
            const nodes = await createReader({ subtitleHtml: setting }).subtitles([
                {
                    fileParts: [
                        file(
                            '1\n00:00:02,000 --> 00:00:04,500\n日本語 {\\an8}&lt;b&gt;literal&lt;/b&gt; &amp;amp;\nline two\n\n' +
                                '2\n00:00:03,000 --> 00:00:05,000\nOverlap\n\n' +
                                '3\n00:00:06,000 --> 00:00:07,000\nFinal cue\n\n' +
                                '4\n00:00:08,000 --> 00:00:09,000\n&lt;laughing&gt;\n\n'
                        ),
                    ],
                },
            ]);
            expect(nodes.map(({ start, end, text }) => ({ start, end, text }))).toEqual([
                { start: 2000, end: 4500, text: '日本語 &lt;b&gt;literal&lt;/b&gt; &amp;amp;\nline two' },
                { start: 3000, end: 5000, text: 'Overlap' },
                { start: 6000, end: 7000, text: 'Final cue' },
                { start: 8000, end: 9000, text: '&lt;laughing&gt;' },
            ]);
        }
    );
    it('preserves ordinary SRT markup handling and accepts empty tracks', async () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,000\n{\\an8}<b>normal</b> &amp;\n\n';
        expect(
            (await createReader({ subtitleHtml: SubtitleHtml.remove }).subtitles([{ fileParts: [file(srt)] }]))[0].text
        ).toBe('normal &amp;');
        expect(
            await createReader({ subtitleHtml: SubtitleHtml.render }).subtitles([{ fileParts: [file('')] }])
        ).toEqual([]);
    });
});

it('loads shared subtitle readers and session restoration without FFmpeg build definitions', async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const definitions = Object.fromEntries(
        Object.keys(globals)
            .filter((key) => key.startsWith('__ASB_FFMPEG_'))
            .map((key) => [key, globals[key]])
    );
    for (const key of Object.keys(definitions)) delete globals[key];
    try {
        await jest.isolateModulesAsync(async () => {
            const { SubtitleReader } = await import('@project/common/subtitle-reader');
            const { SubtitleHtml } = await import('@project/common');
            const { restoreSessionFiles } = await import('@project/common/file-system-access');
            const { embeddedSubtitleId } = await import('@project/common/embedded-subtitles/subtitle-source');
            const reader = new SubtitleReader({
                regexFilter: '',
                regexFilterTextReplacement: '',
                subtitleHtml: SubtitleHtml.render,
                convertNetflixRuby: false,
                pgsParserWorkerFactory: async () => {
                    throw new Error('Text subtitles do not need an image worker');
                },
            });
            const file = new File([], 'embedded.srt', { type: 'application/x-subrip' });
            file.text = async () => '1\n00:00:01,000 --> 00:00:02,000\n&lt;b&gt;literal&lt;/b&gt;\n\n';
            const subtitle = { id: embeddedSubtitleId('video', 1), file };
            expect(await reader.subtitles([{ fileParts: [file] }])).toMatchObject([
                { start: 1000, end: 2000, text: '&lt;b&gt;literal&lt;/b&gt;' },
            ]);
            expect(
                await restoreSessionFiles(
                    { id: 1, timestamp: 0, subtitleHandles: [], cachedSubtitleFiles: [subtitle] },
                    [],
                    async () => {
                        throw new Error('Unexpected embedded subtitle preparation');
                    }
                )
            ).toEqual({ files: [{ ...subtitle, track: 0 }], missingEmbeddedSubtitles: [] });
        });
    } finally {
        Object.assign(globals, definitions);
    }
});
