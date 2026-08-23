import { describe, expect, it, jest } from '@jest/globals';
jest.mock('@qgustavor/srt-parser', () => ({
    __esModule: true,
    default: class {
        fromSrt(value: string) {
            const text = value.split(/\r?\n/).slice(2).join('\n');
            return [{ startTime: 0, endTime: 1, text }];
        }
    },
}));
jest.mock('ass-compiler', () => ({
    compile: (value: string) => {
        const dialogue = value.split(/\r?\n/).find((line) => line.startsWith('Dialogue:'));
        const text = dialogue?.split(',').slice(9).join(',') ?? '';
        return {
            dialogues: [{ start: 0, end: 1, slices: [{ fragments: [{ text }] }] }],
        };
    },
}));
jest.mock('videojs-vtt.js', () => ({ WebVTT: {} }));
import SubtitleReader, { sanitizeSubtitleHtml } from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleHtml } from '@project/common';

const file = (name: string, text: string) => ({ name, text: async () => text }) as unknown as File;

const reader = (
    options: Partial<{
        subtitleHtml: SubtitleHtml;
        regexFilter: string;
        replacement: string;
        convertNetflixRuby: boolean;
    }> = {}
) =>
    new SubtitleReader({
        regexFilter: options.regexFilter ?? '',
        regexFilterTextReplacement: options.replacement ?? '',
        subtitleHtml: options.subtitleHtml ?? SubtitleHtml.render,
        convertNetflixRuby: options.convertNetflixRuby ?? false,
        pgsParserWorkerFactory: () => Promise.reject(new Error('PGS worker is not used in these tests')),
    });

const allowedTags = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'BR', 'RUBY', 'RT', 'RP', 'SPAN'];

const assertSafeSink = (text: string) => {
    const sink = document.createElement('div');
    sink.innerHTML = `<span>${text}</span>`;
    for (const element of sink.querySelectorAll('*')) {
        expect(allowedTags).toContain(element.tagName);
        expect(Array.from(element.attributes).map((attribute) => attribute.name)).toEqual([]);
    }
    return sink;
};

const srt = (text: string) => file('attack.srt', `1\n00:00:00,000 --> 00:00:01,000\nsafe${text}`);

describe('subtitle reader security', () => {
    it.each([
        '<img src=x onerror=alert(1)>',
        '&lt;img src=x onerror=alert(1)&gt;',
        '<svg onload=alert(1)>x</svg>',
        '&lt;svg onload=alert(1)&gt;x&lt;/svg&gt;',
        '<a href="javascript:alert(1)">x</a>',
        '<span style="background-image:url(https://attacker.invalid/x)">x</span>',
        '<img src="https://attacker.invalid/x">',
        '<b><i>malformed',
    ])('sanitizes dangerous markup in parsed SRT cue text (%s)', async (payload) => {
        const subtitles = await reader().subtitles([srt(payload)]);

        expect(subtitles).toHaveLength(1);
        expect(assertSafeSink(subtitles[0].text).textContent).toContain('safe');
    });

    it('sanitizes SRT after regex replacement and XML decoding', async () => {
        const [subtitle] = await reader({
            regexFilter: 'SAFE',
            replacement: '<img src=x onerror=alert(1)>safe',
        }).subtitles([file('replace.srt', '1\n00:00:00,000 --> 00:00:01,000\nSAFE')]);
        expect(assertSafeSink(subtitle.text).textContent).toBe('safe');

        const [plain] = await reader({ subtitleHtml: SubtitleHtml.remove }).subtitles([
            file('encoded.srt', '1\n00:00:00,000 --> 00:00:01,000\n&lt;img src=x onerror=alert(1)&gt;safe'),
        ]);
        expect(assertSafeSink(plain.text).textContent).toBe('safe');
    });

    it('preserves allowed subtitle formatting, strips every attribute, and is idempotent', () => {
        const input =
            '<b id="x" data-reading="bold" aria-label="bold">bold</b><br><ruby class="reading">語<rt style="color:red">ご</rt><rp>(</rp></ruby>';
        const sanitized = sanitizeSubtitleHtml(input);

        expect(sanitized).toBe('<b>bold</b><br><ruby>語<rt>ご</rt><rp>(</rp></ruby>');
        expect(sanitizeSubtitleHtml(sanitized)).toBe(sanitized);
    });

    it('sanitizes dialogue text parsed from ASS files', async () => {
        const ass = `[Script Info]\nScriptType: v4.00+\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\b1}safe{\\b0} <img src=https://attacker.invalid/x onerror=alert(1)>`;
        const [subtitle] = await reader().subtitles([file('attack.ass', ass)]);
        const sink = assertSafeSink(subtitle.text);
        expect(sink.textContent).toContain('safe');
    });

    it.each([
        '<img src=x onerror=alert(1)>',
        '&lt;img src=x onerror=alert(1)&gt;',
        '<a href="javascript:alert(1)">x</a>',
        '<span style="background:url(https://attacker.invalid/x)">x</span>',
        '<ruby>語<rt>ご</rt></ruby>',
    ])('keeps ASS output formatting-only for %s', async (payload) => {
        const ass = `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,REPLACE`;
        const subtitles = await reader({ regexFilter: 'REPLACE', replacement: `safe${payload}` }).subtitles([
            file('attack.ass', ass),
        ]);
        expect(subtitles).toHaveLength(1);
        expect(assertSafeSink(subtitles[0].text).textContent).toContain('safe');
    });

    it.each([
        '&lt;img src=x onerror=alert(1)&gt;',
        '&lt;svg onload=alert(1)&gt;x&lt;/svg&gt;',
        '&lt;a href="javascript:alert(1)"&gt;x&lt;/a&gt;',
    ])('sanitizes TTML/DFXP text revived by entity decoding (%s)', async (payload) => {
        const dfxp =
            '<tt xmlns="http://www.w3.org/ns/ttml"><body><div>' +
            `<p begin="0s" end="1s">safe${payload}</p>` +
            '</div></body></tt>';
        const [subtitle] = await reader().subtitles([file('attack.dfxp', dfxp)]);

        expect(assertSafeSink(subtitle.text).textContent).toContain('safe');
    });

    it('sanitizes YouTube XML text revived by entity decoding', async () => {
        const ytxml =
            '<transcript>' +
            '<text start="0" dur="1">safe&lt;img src=x onerror=alert(1)&gt;</text>' +
            '<text start="1" dur="1">safe&lt;svg onload=alert(1)&gt;x&lt;/svg&gt;</text>' +
            '</transcript>';
        const subtitles = await reader().subtitles([file('attack.ytxml', ytxml)]);

        expect(subtitles).toHaveLength(2);
        for (const subtitle of subtitles) {
            expect(assertSafeSink(subtitle.text).textContent).toContain('safe');
        }
    });

    it('sanitizes bbjson content', async () => {
        const bbjson = JSON.stringify({
            body: [{ from: 0, to: 1, content: 'safe<img src=x onerror=alert(1)><span style="color:red">x</span>' }],
        });
        const [subtitle] = await reader().subtitles([file('attack.bbjson', bbjson)]);

        expect(assertSafeSink(subtitle.text).textContent).toContain('safe');
    });

    it('keeps text and extracted readings formatting-only through Netflix ruby conversion', async () => {
        const [subtitle] = await reader({ convertNetflixRuby: true }).subtitles([srt('語(ご<b>x)')]);

        expect(assertSafeSink(subtitle.text).textContent).toContain('safe');
        expect(subtitle.tokenization?.tokens).toHaveLength(1);

        const [token] = subtitle.tokenization!.tokens;
        expect(subtitle.text.substring(token.pos[0], token.pos[1])).toBe('語');
        assertSafeSink(token.readings[0].reading);
    });
});
