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
    const errorEvent = 'subtitle-html-error';
    const image = `<img src="data:image/png;base64,AA==" onerror="window.dispatchEvent(new Event('${errorEvent}'))">`;
    const escapedImage = image.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const vtt = (text: string) => file('attack.vtt', `WEBVTT\n\n00:00.000 --> 00:01.000\nsafe${text}\n\n`);
    const dfxp = (text: string) =>
        file('attack.dfxp', `<tt><body><div><p begin="0s" end="1s">safe${text}</p></div></body></tt>`);

    it.each([
        { scenario: 'raw SRT text', input: srt(image), options: { subtitleHtml: SubtitleHtml.remove } },
        { scenario: 'raw VTT text', input: vtt(image), options: { subtitleHtml: SubtitleHtml.remove } },
        {
            scenario: 'VTT markup formed by timestamp removal',
            input: vtt(image.replace('<img', '<im<00:00.500>g')),
            options: { subtitleHtml: SubtitleHtml.remove },
        },
        {
            scenario: 'regex replacement',
            input: srt('REPLACE'),
            options: { subtitleHtml: SubtitleHtml.remove, regexFilter: 'REPLACE', replacement: image },
        },
        {
            scenario: 'YouTube XML entity decoding',
            input: file(
                'attack.ytxml',
                `<transcript><text start="0" dur="1">safe${escapedImage}</text><text start="1" dur="1">safe${escapedImage}</text></transcript>`
            ),
            options: { subtitleHtml: SubtitleHtml.render },
        },
        {
            scenario: 'DFXP markup',
            input: dfxp(image.replace('>', '/>')),
            options: { subtitleHtml: SubtitleHtml.render },
        },
        {
            scenario: 'DFXP entity decoding followed by HTML removal',
            input: dfxp(escapedImage),
            options: { subtitleHtml: SubtitleHtml.remove },
        },
    ])('prevents event-handler execution while parsing $scenario', async ({ input, options }) => {
        const onError = jest.fn();
        const activeImages: HTMLImageElement[] = [];
        window.addEventListener(errorEvent, onError);
        const setHtml = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.set!;
        const htmlSetter = jest.spyOn(Element.prototype, 'innerHTML', 'set').mockImplementation(function (
            this: Element,
            value: string
        ) {
            setHtml.call(this, value);
            // jsdom does not load images. Dispatch their error event at the active DOM
            // boundary to exercise handlers before inspecting the returned subtitle.
            if (this.ownerDocument === document) {
                for (const image of this.querySelectorAll('img')) {
                    activeImages.push(image);
                    image.dispatchEvent(new Event('error'));
                }
            }
        });

        try {
            const subtitles = await reader(options).subtitles([input]);

            expect(activeImages).toEqual([]);
            expect(onError).not.toHaveBeenCalled();
            expect(subtitles.length).toBeGreaterThan(0);
            for (const subtitle of subtitles) expect(assertSafeSink(subtitle.text).textContent).toBe('safe');
        } finally {
            htmlSetter.mockRestore();
            window.removeEventListener(errorEvent, onError);
        }
    });

    it('preserves line breaks, entities, and ruby base text when safely removing HTML', async () => {
        const [subtitle] = await reader({ subtitleHtml: SubtitleHtml.remove }).subtitles([
            file(
                'formatting.vtt',
                'WEBVTT\n\n00:00.000 --> 00:01.000\n<b>Hello</b><br> &amp; <ruby>語<rt>ご</rt><rp>(ご)</rp></ruby>\n\n'
            ),
        ]);

        expect(subtitle).toEqual({ start: 0, end: 1000, text: 'Hello\n & 語', track: 0 });
    });

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

    it('strips invisible bidi control characters so the regex filter can match (#669)', async () => {
        // A left-to-right mark (U+200E) hidden in a bracketed sound-effect line would
        // otherwise defeat the anchored pattern, leaving the line unfiltered.
        const removed = await reader({ regexFilter: '^\\[.+\\]$', replacement: '' }).subtitles([
            file('bidi.srt', '1\n00:00:00,000 --> 00:00:01,000\n[THUNDER]\u200e'),
        ]);
        expect(removed).toHaveLength(0);
    });

    it('strips bidi control characters from text the regex filter keeps (#669)', async () => {
        // Filter is active but its pattern does not match; the invisible marks (LRM,
        // RLM and an isolate) should still be removed from the surviving text.
        const [subtitle] = await reader({ regexFilter: 'NOMATCH', replacement: '' }).subtitles([
            file('bidi-keep.srt', '1\n00:00:00,000 --> 00:00:01,000\nab\u200ec\u200fd\u2066e'),
        ]);
        expect(subtitle.text).toBe('abcde');
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
