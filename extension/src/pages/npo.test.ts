import {
    cleanNpoVtt,
    isNpoStreamLinkUrl,
    npoBasename,
    npoCdnSubtitleUrl,
    npoEpisodeSlug,
    npoPomsSubtitleUrl,
    npoStreamLinkSubtitles,
    npoTracks,
    npoVttDataUrl,
} from '@/pages/npo';
import type { NpoSubtitleLoader } from '@/pages/npo';

const vttOf = (...lines: string[]) => ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', ...lines].join('\n');
const cdn = npoCdnSubtitleUrl('AT_1');
const poms = npoPomsSubtitleUrl('AT_1');

// A loader backed by a table: a string resolves, undefined means missing, an Error rejects.
const loaderFor = (table: { [url: string]: string | undefined | Error }) => {
    const calls: string[] = [];
    const load: NpoSubtitleLoader = async (url) => {
        calls.push(url);
        const value = table[url];

        if (value instanceof Error) {
            throw value;
        }

        return value;
    };
    return { load, calls };
};

describe('npo', () => {
    it('extracts the episode slug from a player path', () => {
        expect(npoEpisodeSlug('/start/afspelen/boer-zoekt-vrouw-special_1')).toBe('boer-zoekt-vrouw-special_1');
        expect(npoEpisodeSlug('/start/serie/boer-zoekt-vrouw')).toBeUndefined();
    });

    it('builds the subtitle urls and recognizes stream-link requests', () => {
        expect(npoCdnSubtitleUrl('AT_300024115')).toBe('https://cdn.npoplayer.nl/subtitles/nl/AT_300024115.vtt');
        expect(npoPomsSubtitleUrl('KN_1695321')).toBe(
            'https://rs.poms.omroep.nl/v1/api/subtitles/KN_1695321/nl_NL/CAPTION.vtt'
        );
        expect(isNpoStreamLinkUrl('https://prod.npoplayer.nl/stream-link')).toBe(true);
        expect(isNpoStreamLinkUrl('https://prod.npoplayer.nl/stream-link-other')).toBe(false);
        expect(isNpoStreamLinkUrl('https://evil.example/?u=https://prod.npoplayer.nl/stream-link')).toBe(false);
    });

    it('prefixes the series title only when the episode title lacks it', () => {
        expect(npoBasename({ title: 'Boer zoekt Vrouw special', series: { title: 'Boer zoekt vrouw' } })).toBe(
            'Boer zoekt Vrouw special'
        );
        expect(npoBasename({ title: 'Finale', series: { title: 'Wie is de Mol?' } })).toBe('Wie is de Mol? - Finale');
    });

    it('reads subtitle tracks from a stream-link response', () => {
        expect(
            npoStreamLinkSubtitles({
                metadata: { prid: 'AT_300024115', title: 'Finale' },
                assets: {
                    subtitles: [
                        {
                            iso: 'nl',
                            name: 'Nederlands',
                            location: 'https://cdn.npoplayer.nl/subtitles/nl/AT_300024115.vtt',
                            aiGenerated: false,
                        },
                        { iso: 'en', name: 'English', location: 'https://cdn.example/en.vtt', aiGenerated: true },
                        { iso: 'de' },
                    ],
                },
            })
        ).toEqual({
            productId: 'AT_300024115',
            tracks: [
                {
                    label: 'Nederlands',
                    language: 'nl',
                    url: 'https://cdn.npoplayer.nl/subtitles/nl/AT_300024115.vtt',
                },
                { label: 'English (AI)', language: 'en', url: 'https://cdn.example/en.vtt' },
            ],
        });
        expect(npoStreamLinkSubtitles({ metadata: { prid: 'AT_1' }, assets: { subtitles: [] } })).toEqual({
            productId: 'AT_1',
            tracks: [],
        });
        expect(npoStreamLinkSubtitles({ guid: 'x', title: 'unrelated json' })).toBeUndefined();
    });

    describe('track selection', () => {
        const nl = { label: 'Nederlands', language: 'nl', url: 'https://cdn.example/nl.vtt' };
        const en = { label: 'English (AI)', language: 'en', url: 'https://cdn.example/en.vtt' };

        it('offers every loadable listed track, loaded in parallel', async () => {
            const { load } = loaderFor({ [nl.url]: 'data:nl', [en.url]: 'data:en' });
            expect(await npoTracks('AT_1', [nl, en], load)).toEqual([
                { ...nl, url: 'data:nl' },
                { ...en, url: 'data:en' },
            ]);
        });

        it('drops listed tracks that fail to load but keeps the others', async () => {
            const { load } = loaderFor({ [nl.url]: 'data:nl', [en.url]: new Error('network') });
            expect(await npoTracks('AT_1', [nl, en], load)).toEqual([{ ...nl, url: 'data:nl' }]);
        });

        it('falls back to the CDN file when no listed track loads', async () => {
            const { load, calls } = loaderFor({ [nl.url]: undefined, [cdn]: 'data:cdn' });
            expect(await npoTracks('AT_1', [nl], load)).toEqual([
                { label: 'Nederlands', language: 'nl', url: 'data:cdn' },
            ]);
            expect(calls).toEqual([nl.url, cdn]);
        });

        it('falls back to POMS when the CDN file is missing or unreachable', async () => {
            expect(
                await npoTracks('AT_1', undefined, loaderFor({ [cdn]: undefined, [poms]: 'data:poms' }).load)
            ).toEqual([{ label: 'Nederlands', language: 'nl', url: 'data:poms' }]);
            expect(
                await npoTracks('AT_1', [], loaderFor({ [cdn]: new Error('network'), [poms]: 'data:poms' }).load)
            ).toEqual([{ label: 'Nederlands', language: 'nl', url: 'data:poms' }]);
        });

        it('resolves to no tracks when the episode has no subtitles anywhere', async () => {
            expect(await npoTracks('AT_1', [], loaderFor({}).load)).toEqual([]);
        });
    });

    describe('subtitle files', () => {
        it('only accepts WebVTT files with cues', () => {
            expect(npoVttDataUrl('<!DOCTYPE html><html><body>Not found</body></html>')).toBeUndefined();
            expect(npoVttDataUrl('WEBVTT\n\n')).toBeUndefined();
            expect(npoVttDataUrl(vttOf('<c.white>888</c>'))).toBeUndefined();
            expect(decodeURIComponent(npoVttDataUrl(vttOf('Hallo.'))!)).toBe(
                'data:text/vtt;charset=utf-8,' + 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nHallo.\n'
            );
        });
    });

    describe('cleanup', () => {
        it('drops teletext page cues and speaker labels', () => {
            const vtt = [
                'WEBVTT',
                '',
                '1',
                '00:00:00.010 --> 00:00:01.170',
                '888',
                '',
                '2',
                '00:00:03.180 --> 00:00:07.100',
                'Geen ketchup, maar?',
                'ALLEN: Mayo! Curry!',
                '',
                '3',
                '00:00:07.150 --> 00:00:09.030',
                'Een aap, heel groot...',
            ].join('\r\n');

            expect(cleanNpoVtt(vtt)).toBe(
                [
                    'WEBVTT',
                    '',
                    '1',
                    '00:00:03.180 --> 00:00:07.100',
                    'Geen ketchup, maar?',
                    'Mayo! Curry!',
                    '',
                    '2',
                    '00:00:07.150 --> 00:00:09.030',
                    'Een aap, heel groot...',
                    '',
                ].join('\n')
            );
        });

        it('drops colour tags, entities and boilerplate notes from player subtitles', () => {
            const vtt = [
                'WEBVTT',
                '',
                '00:00:02.520 --> 00:00:04.160 line:90% position:50% align:center',
                '<c.white>888</c>',
                '',
                '00:00:04.240 --> 00:00:05.840 line:90% position:50% align:center',
                '<c.white>LIVEPROGRAMMA,</c>',
                '<c.white>ONDERTITELING KAN ACHTERLOPEN</c>',
                '',
                '00:00:04.880 --> 00:00:07.760 line:90% position:50% align:center',
                '<c.white>MUZIEK</c>',
                '',
                '00:00:05.920 --> 00:00:08.320 line:90% position:50% align:center',
                '<c.yellow>Live bij AVROTROS</c>',
                '<c.yellow>is dit de finale van Wie is de Mol?</c>',
                '',
                '00:00:09.000 --> 00:00:10.000 line:90% position:50% align:center',
                '<c.cyan>3, 2, 1!</c>',
                '<c.white>Tom &amp; Jerry</c>',
            ].join('\n');

            expect(cleanNpoVtt(vtt)).toBe(
                [
                    'WEBVTT',
                    '',
                    '1',
                    '00:00:05.920 --> 00:00:08.320 line:90% position:50% align:center',
                    'Live bij AVROTROS',
                    'is dit de finale van Wie is de Mol?',
                    '',
                    '2',
                    '00:00:09.000 --> 00:00:10.000 line:90% position:50% align:center',
                    '3, 2, 1!',
                    'Tom & Jerry',
                    '',
                ].join('\n')
            );
        });

        it.each([
            ['shouted dialogue', 'NEE!'],
            ['an upper-case phrase before a colon', 'LET OP: de deur gaat dicht.'],
            ['a spoken three-digit number', '112'],
            ['an ordinary sentence with a colon', 'Ik zeg het zo: nee.'],
            ['an upper-case abbreviation', 'NOS, RTL en SBS.'],
        ])('keeps %s', (_, line) => {
            expect(cleanNpoVtt(vttOf(line))).toContain(`\n${line}\n`);
        });
    });
});
