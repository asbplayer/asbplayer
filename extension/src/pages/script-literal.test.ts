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
});

describe('subtitleArraysFromScript', () => {
    it('finds subtitle-like arrays with quoted and unquoted keys', () => {
        const script = `x={"captions":[{"src":"a.vtt"}]};y({subtitles: [{url: 'b.srt'}], other: [1]});z={notTracks:[1], soundtracks: [{src: "c.vtt"}]}`;
        expect(subtitleArraysFromScript(script)).toEqual([[{ src: 'a.vtt' }], [{ url: 'b.srt' }]]);
    });

    it('skips arrays that are not plain literals', () => {
        expect(subtitleArraysFromScript('player.setup({ tracks: buildTracks(lang) })')).toEqual([]);
        expect(subtitleArraysFromScript('player.setup({ tracks: [makeTrack("en")] })')).toEqual([]);
    });
});
