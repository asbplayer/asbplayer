import { describe, expect, it, jest } from '@jest/globals';

// These deps ship as ESM that the repo's ts-jest setup does not transform, and the
// IMSC path under test never uses them (they back the srt/ass/vtt branches).
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));
jest.mock('ass-compiler', () => ({ compile: () => ({ dialogues: [] }) }));
jest.mock('videojs-vtt.js', () => ({ WebVTT: {} }));

import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleHtml } from '@project/common';

const createReader = (convertNetflixRuby = false) =>
    new SubtitleReader({
        regexFilter: '',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby,
        pgsParserWorkerFactory: () => Promise.reject(new Error('PGS worker is not used in these tests')),
    });

const nfimscFile = (xml: string) => ({ name: 'test.nfimsc', text: async () => xml }) as unknown as File;

const parse = (xml: string, convertNetflixRuby = false, flatten = false, fileCount = 1) =>
    createReader(convertNetflixRuby).subtitles(
        Array.from({ length: fileCount }, () => nfimscFile(xml)),
        flatten
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
        const subtitles = await createReader().subtitles(
            [nfimscFile(nfimscDocument('safe&lt;img src=x onerror=alert(1)&gt;')), nfimscFile(nfimscDocument('safe'))],
            true
        );

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
        const subtitles = await createReader().subtitles([nfimscFile(first), nfimscFile(second)], true);

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
        const subtitles = await createReader().subtitles([file]);

        expect(subtitles).toHaveLength(0);
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

        const subtitles = await createReader().subtitles([file]);

        expect(subtitles).toHaveLength(2);
        expect(subtitles[0]).toMatchObject({ start: 1250, end: 3500, text: 'First subtitle' });
        expect(subtitles[1]).toMatchObject({ start: 4000, end: 6750, text: 'Second subtitle' });
    });
});
