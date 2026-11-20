import { cleanNpoVtt, npoBasename, npoEpisodeSlug, npoSubtitleUrl } from '@/pages/npo';

describe('npo', () => {
    it('extracts the episode slug from a player path', () => {
        expect(npoEpisodeSlug('/start/afspelen/boer-zoekt-vrouw-special_1')).toBe('boer-zoekt-vrouw-special_1');
        expect(npoEpisodeSlug('/start/serie/boer-zoekt-vrouw')).toBeUndefined();
    });

    it('builds the POMS caption url', () => {
        expect(npoSubtitleUrl('KN_1695321')).toBe(
            'https://rs.poms.omroep.nl/v1/api/subtitles/KN_1695321/nl_NL/CAPTION.vtt'
        );
    });

    it('prefixes the series title only when the episode title lacks it', () => {
        expect(npoBasename({ title: 'Boer zoekt Vrouw special', series: { title: 'Boer zoekt vrouw' } })).toBe(
            'Boer zoekt Vrouw special'
        );
        expect(npoBasename({ title: 'Aflevering 3', series: { title: 'Zondag met Lubach' } })).toBe(
            'Zondag met Lubach - Aflevering 3'
        );
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

    it('keeps ordinary sentences that contain a colon', () => {
        const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nIk zeg het zo: nee.';
        expect(cleanNpoVtt(vtt)).toContain('Ik zeg het zo: nee.');
    });
});
