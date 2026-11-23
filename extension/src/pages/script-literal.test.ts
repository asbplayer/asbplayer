import { describe, expect, it } from '@jest/globals';
import { jsLiteralToJson, nextFlightText, subtitleArraysFromScript } from '@project/extension/src/pages/script-literal';

describe('jsLiteralToJson', () => {
    it('converts plain JS literals to JSON', () => {
        const source = `[{a:1, 'b': 'it\\'s', "c": [true, !0, !1, null, undefined, void 0, -2.5e1],}, ]`;
        expect(JSON.parse(jsLiteralToJson(source, 0)!)).toEqual([
            { a: 1, b: "it's", c: [true, true, false, null, null, null, -25] },
        ]);
    });

    it('decodes escapes in strings', () => {
        expect(JSON.parse(jsLiteralToJson(String.raw`["&\x41\"\n"]`, 0)!)).toEqual(['&A"\n']);
    });

    it('rejects anything that would need evaluation', () => {
        expect(jsLiteralToJson('[{ file: base + "/en.vtt" }]', 0)).toBeUndefined();
        expect(jsLiteralToJson('[{ file: getUrl() }]', 0)).toBeUndefined();
        expect(jsLiteralToJson('[{ file: `/en.vtt` }]', 0)).toBeUndefined();
        expect(jsLiteralToJson('[{ file: "/en.vtt" }', 0)).toBeUndefined();
    });
});

describe('nextFlightText', () => {
    it('decodes and joins the string chunks pushed to self.__next_f', () => {
        const script = String.raw`self.__next_f.push([0]);self.__next_f.push([1,"a:{\"captions\":"]);self.__next_f.push([1,"[]}\n"])`;
        expect(nextFlightText(script)).toBe('a:{"captions":[]}\n');
    });

    it('returns undefined for other scripts', () => {
        expect(nextFlightText('window.x = [1, "a"]')).toBeUndefined();
    });

    it('ignores quoted or commented-out pushes and expressions in the chunk value', () => {
        const script = `
            const example = 'self.__next_f.push([1,"fake text"])';
            // self.__next_f.push([1,"comment"])
            self.__next_f.push([1,"not plain" + suffix]);
            self.__next_f.push([1, "real chunk"]);
        `;
        expect(nextFlightText(script)).toBe('real chunk');
    });
});

describe('subtitleArraysFromScript', () => {
    it('finds subtitle-like arrays with quoted and unquoted keys', () => {
        const script = `x={"captions":[{"src":"a.vtt"}]};y({subtitles: [{url: 'b.srt'}], other: [1]});z={notTracks:[1], soundtracks: [{src: "c.vtt"}]}`;
        expect(subtitleArraysFromScript(script)).toEqual([[{ src: 'a.vtt' }], [{ url: 'b.srt' }]]);
    });

    it('accepts the closed-caption abbreviation only at the start of a key', () => {
        const script = `x={"cc_multiple_languages": [{"url": "a.vtt"}], cc: [{src: "b.vtt"}], account: [1], ccTracks: [2], acc_list: [3]}`;
        expect(subtitleArraysFromScript(script)).toEqual([[{ url: 'a.vtt' }], [{ src: 'b.vtt' }]]);
    });

    it('skips arrays that are not plain literals', () => {
        expect(subtitleArraysFromScript('player.setup({ tracks: buildTracks(lang) })')).toEqual([]);
        expect(subtitleArraysFromScript('player.setup({ tracks: [makeTrack("en")] })')).toEqual([]);
    });

    it('rejects arithmetic in metadata but retains signed and exponential numbers', () => {
        const script = `
            player.setup({ tracks: [{file: "not-a-literal.vtt", offset: 1+2}] });
            player.setup({ tracks: [{file: "literal.vtt", offset: -2.5e+1}] });
        `;
        expect(subtitleArraysFromScript(script)).toEqual([[{ file: 'literal.vtt', offset: -25 }]]);
    });

    it('rejects arrays used as part of a larger expression, even after a comment', () => {
        const script = `
            player.setup({ tracks: [{file: "mapped.vtt"}].map(rewrite) });
            player.setup({ tracks: [{file: "computed.vtt"}] /* note */ + suffix });
            player.setup({ tracks: [{file: "literal.vtt"}] /* note */, enabled: true });
        `;
        expect(subtitleArraysFromScript(script)).toEqual([[{ file: 'literal.vtt' }]]);
    });

    it('skips regex literals without treating division as a regex', () => {
        const script = `
            const pattern = /{tracks:[{file:"regex.vtt"}]}/;
            if ((enabled)) /{tracks:[{file:"condition.vtt"}]}/.test(text);
            const ratio = duration / player.setup({ tracks: [{file: "literal.vtt"}] }) / scale;
        `;
        expect(subtitleArraysFromScript(script)).toEqual([[{ file: 'literal.vtt' }]]);
    });

    it('decodes Unicode code-point escapes and skips malformed ones', () => {
        const script = String.raw`
            player.setup({ tracks: [{file: '/caps/\u{1F600}.vtt', label: "Fran\u{E7}ais"}] });
            player.setup({ tracks: [{file: '/caps/\u{110000}.vtt'}] });
        `;
        expect(subtitleArraysFromScript(script)).toEqual([[{ file: '/caps/😀.vtt', label: 'Français' }]]);
    });

    it('ignores examples in comments and strings and unrelated property names', () => {
        const script = `
            // tracks: [{file: "/comment.vtt"}]
            /* {"subtitles": [{"url": "/block-comment.vtt"}]} */
            const example = 'player.setup({ tracks: [{file: "/example.vtt"}] })';
            const template = \`{captions: [{file: "/template.vtt"}]}\`;
            player.setup({
                previewCaptionSettings: [{file: "/preview.vtt"}],
                tracks: [{file: "/real.vtt"}]
            });
        `;
        expect(subtitleArraysFromScript(script)).toEqual([[{ file: '/real.vtt' }]]);
    });
});
