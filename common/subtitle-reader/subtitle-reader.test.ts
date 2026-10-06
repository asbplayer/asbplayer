import { describe, expect, it, jest } from '@jest/globals';

// This dependency ships as ESM that ts-jest does not transform. The narrow fake
// returns cue text for the SRT ruby conversion tests below.
jest.mock('@qgustavor/srt-parser', () => ({
    __esModule: true,
    default: class {
        fromSrt(value: string) {
            const text = value.split(/\r?\n/).slice(2).join('\n');
            return [{ startTime: 0, endTime: 1, text }];
        }
    },
}));
jest.mock('ass-compiler', () => ({ compile: () => ({ dialogues: [] }) }));

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

const nfimscFile = (xml: string) => ({ name: 'test.nfimsc', text: async () => xml }) as unknown as File;
const srtFile = (text: string) =>
    ({ name: 'test.srt', text: async () => `1\n00:00:00,000 --> 00:00:01,000\n${text}` }) as unknown as File;

const parse = (xml: string, convertNetflixRuby = false, flatten = false, fileCount = 1) =>
    createReader({ convertNetflixRuby }).subtitles(
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

const srv3File = (xml: string) => ({ name: 'test.ytsrv3', text: async () => xml }) as unknown as File;
const srv3Document = (rows: string, mode = '0') =>
    `<timedtext format="3"><head><ws id="0"/><ws id="1" mh="${mode}"/></head><body>` +
    '<w t="0" id="1" ws="1"/>' +
    rows +
    '</body></timedtext>';

describe('SubtitleReader YouTube pop-on captions', () => {
    it('caps overlapping two-line cues at the next start', async () => {
        const rows =
            '<p t="0" d="6880" w="1">Walk into supermarkets in London, Delhi,\nor Johannesburg, and you&#39;ll find many of</p>' +
            '<p t="4760" d="7640" w="1">the same global [music] food brands. Kit\nKats, Maggi, Cerelac, Fanta. The</p>' +
            '<p t="9880" d="6920" w="1">packaging may look nearly identical, but\nturn it around to check the ingredients.</p>';

        await expect(createReader().subtitles([srv3File(srv3Document(rows))])).resolves.toEqual([
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

        await expect(createReader().subtitles([srv3File(srv3Document(rows, '2'))])).resolves.toEqual([
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

        await expect(createReader().subtitles([srv3File(srv3Document(rows, mode))])).resolves.toEqual([
            { start: 0, end: 6000, text: 'First', track: 0 },
            { start: 3000, end: 9000, text: 'Second', track: 0 },
        ]);
    });

    it('preserves gaps between non-overlapping pop-on cues', async () => {
        const rows = '<p t="0" d="1000" w="1">First</p><p t="2000" d="1000" w="1">Second</p>';

        await expect(createReader().subtitles([srv3File(srv3Document(rows))])).resolves.toEqual([
            { start: 0, end: 1000, text: 'First', track: 0 },
            { start: 2000, end: 3000, text: 'Second', track: 0 },
        ]);
    });
});

describe('SubtitleReader text content', () => {
    it('drops subtitles left with only invisible or whitespace characters (#669)', async () => {
        // A cue whose only content is a left-to-right mark (U+200E) has no meaningful
        // text, so it is dropped instead of rendered as a blank line.
        const removed = await createReader().subtitles([srtFile('\u200e')]);
        expect(removed).toHaveLength(0);
    });

    it('keeps subtitles that have real text alongside bidi marks (#669)', async () => {
        // Bidi marks are preserved within meaningful text; only empty cues are dropped.
        const [subtitle] = await createReader().subtitles([srtFile('ab\u200ecd')]);
        expect(subtitle.text).toBe('ab\u200ecd');
    });

    it.each([
        ['empty formatting tags', '<b><i></i></b>'],
        ['line breaks', '<br><br>'],
        ['encoded whitespace', '<span>&nbsp;&#32;&#9;</span>'],
        ['encoded bidi marks', '<b>&lrm;&#x200f;</b>'],
        ['ruby readings without base text', '<ruby>\u200e<rp>(</rp><rt>ご</rt><rp>)</rp></ruby>'],
    ])('drops cues containing only %s', async (_scenario, text) => {
        const subtitles = await createReader().subtitles([srtFile(text)]);

        expect(subtitles).toEqual([]);
    });

    it.each([
        ['formatted text', '<b>Hello</b>'],
        ['ruby base text', '<ruby>語<rp>(</rp><rt>ご</rt><rp>)</rp></ruby>'],
        ['encoded punctuation', '&amp;'],
    ])('keeps %s without changing its markup or entities', async (_scenario, text) => {
        const subtitles = await createReader().subtitles([srtFile(text)]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text, track: 0 }]);
    });

    it('drops markup and invisible leftovers after regex filtering while keeping meaningful cues', async () => {
        const subtitles = await createReader({
            regexFilter: '\\[.+\\]',
            regexFilterTextReplacement: '',
        }).subtitles([srtFile('<b>[THUNDER]</b>\u200e'), srtFile('<b>Hello</b>\u200e')]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text: '<b>Hello</b>\u200e', track: 1 }]);
    });

    it('drops a normally matched replacement containing only non-content HTML', async () => {
        const subtitles = await createReader({
            regexFilter: '^\\[.+\\]$',
            regexFilterTextReplacement: '<b>&nbsp;\u200f</b><br>',
        }).subtitles([srtFile('[THUNDER]')]);

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
        }).subtitles([srtFile(text)]);

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
        }).subtitles([srtFile('[THUNDER]\u200e')]);

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
        const subtitles = await createReader({ regexFilter, regexFilterTextReplacement }).subtitles([srtFile(text)]);

        expect(subtitles).toEqual([{ start: 0, end: 1000, text, track: 0 }]);
    });

    it('uses normal replacement when the regex matches, across multiple cues', async () => {
        const subtitles = await createReader({
            regexFilter: '\u200e$|^\\[.+\\]$',
            regexFilterTextReplacement: '',
        }).subtitles([srtFile('[THUNDER]\u200e'), srtFile('[RAIN]\u200e')]);

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
        const subtitles = await createReader().subtitles([vttFile(`before<${timestamp}>after`)]);

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
            vttFile(`before<${timestamp}>after`),
            vttFile(`before&lt;${timestamp}&gt;after`),
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
        const subtitles = await createReader().subtitles([vttFile(`before${timestampTag}after`)]);

        expect(subtitles).toEqual([{ start: 0, end: 3599999999, text: 'beforeafter', track: 0 }]);
    });

    it.each([
        ['vtt', SubtitleHtml.render, '<b>Hello</b> <i>world</i>\nagain'],
        ['vtt', SubtitleHtml.remove, 'Hello world\nagain'],
        ['nfvtt', SubtitleHtml.render, '<b>Hello</b> <i>world</i>\nagain'],
        ['nfvtt', SubtitleHtml.remove, 'Hello world\nagain'],
    ])('strips multiple timestamps from %s with HTML mode %s', async (extension, subtitleHtml, expectedText) => {
        const subtitles = await createReader({ subtitleHtml }).subtitles([
            vttFile(
                '<c.yellow><b>Hello</b></c> <00:01.001><i>world</i>\n&lt;00:02.002&gt;again',
                extension,
                '00:00.000 --> 00:03.000'
            ),
        ]);

        expect(subtitles).toEqual([{ start: 0, end: 3000, text: expectedText, track: 0 }]);
    });

    it('preserves ordinary text, formatting, entities, and untagged timestamps', async () => {
        const text = '<c.yellow><b>Meet</b></c> at 00:01.000 &amp; <ruby>語<rt>ご</rt></ruby>.';
        const subtitles = await createReader().subtitles([vttFile(text, 'vtt', '00:00.000 --> 00:03.000')]);

        expect(subtitles).toEqual([
            { start: 0, end: 3000, text: '<b>Meet</b> at 00:01.000 &amp; <ruby>語<rt>ご</rt></ruby>.', track: 0 },
        ]);
    });

    it('removes timestamps before applying the configured text filter', async () => {
        const subtitles = await createReader({
            regexFilter: 'Hello world',
            regexFilterTextReplacement: 'replaced',
        }).subtitles([vttFile('Hello<00:01.001> world', 'vtt', '00:00.000 --> 00:03.000')]);

        expect(subtitles).toEqual([{ start: 0, end: 3000, text: 'replaced', track: 0 }]);
    });

    it('drops cues containing only timestamp tags', async () => {
        const subtitles = await createReader().subtitles([
            vttFile('<00:01.001>&lt;00:02.002&gt;', 'vtt', '00:00.000 --> 00:03.000'),
        ]);

        expect(subtitles).toEqual([]);
    });
});

describe('SubtitleReader Netflix ruby text conversion', () => {
    it.each(['srt', 'vtt', 'nfvtt'])('renders imported ASCII and numeric readings from %s', async (extension) => {
        const text = 'MIU(ミウ)、007(ゼロゼロセブン)、さっきTwitter(ツイッター)と5G通信(つうしん)';
        const [subtitle] = await createReader({ convertNetflixRuby: true }).subtitles([
            extension === 'srt' ? srtFile(text) : vttFile(text, extension),
        ]);
        const rendered = renderRichTextOntoSubtitles(
            [{ ...subtitle, index: 0 }],
            'video',
            defaultSettings.dictionaryTracks
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
            srtFile('さっきTwitter(ツイッター)のトレンドに…と5G通信(つうしん)'),
        ]);
        const tokens = subtitle.tokenization?.tokens ?? [];

        expect(subtitle.text).toBe('さっきTwitterのトレンドに…と5G通信');
        expect(tokens.map(({ pos }) => subtitle.text.substring(pos[0], pos[1]))).toEqual(['Twitter', '通信']);
        expect(tokens.map(({ readings }) => readings[0].reading)).toEqual(['ツイッター', 'つうしん']);
    });

    it('keeps homogeneous ASCII and Japanese bases whole', async () => {
        const [subtitle] = await createReader({ convertNetflixRuby: true }).subtitles([
            srtFile('MIU(ミウ)、捏造(ねつぞう)'),
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
        const [cue] = await createReader().subtitles([srtFile(`{${tag}}Hello`)]);
        expect(cue.text).toBe('Hello');
    });

    it('strips multiple whitelisted tags in one block', async () => {
        const [cue] = await createReader().subtitles([srtFile('{\\an8\\i1\\b700}Hello{\\i0\\b0} world')]);
        expect(cue.text).toBe('Hello world');
    });

    it('strips multiple override tags and keeps the surrounding text', async () => {
        const [cue] = await createReader().subtitles([srtFile('{\\an8}{\\i1}Hello{\\i0} world')]);
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
        const [cue] = await createReader().subtitles([srtFile(`Hello${block} world`)]);
        expect(cue.text).toBe(`Hello${block} world`);
    });

    it('preserves unsupported blocks alongside whitelisted blocks', async () => {
        const [cue] = await createReader().subtitles([srtFile('{\\an8}Hello{\\unknown}{\\i1} world{\\i0}')]);
        expect(cue.text).toBe('Hello{\\unknown} world');
    });
});
