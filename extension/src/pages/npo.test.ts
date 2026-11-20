import {
    cleanNpoVtt,
    npoBasename,
    npoCdnSubtitleUrl,
    npoEpisodeSlug,
    npoPomsSubtitleUrl,
    npoStreamLinkSubtitles,
} from '@/pages/npo';

describe('npo', () => {
    it('extracts the episode slug from a player path', () => {
        expect(npoEpisodeSlug('/start/afspelen/boer-zoekt-vrouw-special_1')).toBe('boer-zoekt-vrouw-special_1');
        expect(npoEpisodeSlug('/start/serie/boer-zoekt-vrouw')).toBeUndefined();
    });

    it('builds the subtitle urls', () => {
        expect(npoCdnSubtitleUrl('AT_300024115')).toBe('https://cdn.npoplayer.nl/subtitles/nl/AT_300024115.vtt');
        expect(npoPomsSubtitleUrl('KN_1695321')).toBe(
            'https://rs.poms.omroep.nl/v1/api/subtitles/KN_1695321/nl_NL/CAPTION.vtt'
        );
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
                    extension: 'vtt',
                },
                { label: 'English (AI)', language: 'en', url: 'https://cdn.example/en.vtt', extension: 'vtt' },
            ],
        });
        expect(npoStreamLinkSubtitles({ guid: 'x', title: 'unrelated json' })).toBeUndefined();
    });

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

    it('drops colour tags and upper-case notes from player subtitles', () => {
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

    it('keeps ordinary sentences that contain a colon', () => {
        const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nIk zeg het zo: nee.';
        expect(cleanNpoVtt(vtt)).toContain('Ik zeg het zo: nee.');
    });
});
