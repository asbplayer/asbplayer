import { describe, expect, it } from '@jest/globals';
import {
    isRetryableStatus,
    noAccessError,
    notSignedInError,
    statusError,
    videoDataFromResponse,
} from '@project/extension/src/pages/dreaming';

const vtt = 'WEBVTT\nKind: captions\nLanguage: es\n\n1\n00:00:00.000 --> 00:00:08.840\nHola, ¿qué tal?\n';

const response = (video: object | undefined) => ({ video });

describe('videoDataFromResponse', () => {
    it('prefers inline subtitles as a data URL and uses the video title as basename', () => {
        const data = videoDataFromResponse(
            response({
                title: "Alma's Family",
                language: 'es',
                hasAccess: true,
                subtitles: vtt,
                sources: { bunny: 'https://app.dreaming.com/.netlify/functions/bunny/jwt/videoid' },
            }),
            'fallback title'
        );

        expect(data.error).toBe('');
        expect(data.basename).toBe("Alma's Family");
        expect(data.subtitles).toHaveLength(1);
        const track = data.subtitles![0];
        expect(track.language).toBe('es');
        expect(track.label).toBe('Spanish');
        expect(track.extension).toBe('vtt');
        expect(track.url).toMatch(/^data:text\/vtt;base64,/);

        const base64 = (track.url as string).substring('data:text/vtt;base64,'.length);
        expect(Buffer.from(base64, 'base64').toString('utf-8')).toBe(vtt);
    });

    it('falls back to the bunny subtitle URL when inline subtitles are missing', () => {
        const data = videoDataFromResponse(
            response({
                title: 'Un video',
                language: 'es',
                sources: { bunny: 'https://app.dreaming.com/.netlify/functions/bunny/jwt/videoid' },
            }),
            'fallback title'
        );

        expect(data.subtitles).toHaveLength(1);
        expect(data.subtitles![0].url).toBe(
            'https://app.dreaming.com/.netlify/functions/bunny/jwt/videoid/subtitles.webvtt'
        );
    });

    it('ignores inline content that is not WebVTT', () => {
        const data = videoDataFromResponse(
            response({
                title: 'Un video',
                language: 'es',
                subtitles: '   ',
                sources: { bunny: 'https://host/base' },
            }),
            'fallback title'
        );

        expect(data.subtitles![0].url).toBe('https://host/base/subtitles.webvtt');
    });

    it('explains that a video is locked instead of reporting it as having no subtitles', () => {
        const data = videoDataFromResponse(
            response({ title: 'Premium', language: 'es', hasAccess: false, subtitles: vtt }),
            'fallback title'
        );

        expect(data.error).toBe(noAccessError);
        expect(data.basename).toBe('Premium');
        expect(data.subtitles).toHaveLength(0);
    });

    it('returns no tracks without an error when there are no subtitle sources', () => {
        const data = videoDataFromResponse(response({ title: 'Sin subs', language: 'es' }), 'fallback title');
        expect(data.error).toBe('');
        expect(data.subtitles).toHaveLength(0);
    });

    it('uses the fallback basename and produces no tracks for a malformed response', () => {
        expect(videoDataFromResponse(undefined, 'fallback title')).toEqual({
            error: '',
            basename: 'fallback title',
            subtitles: [],
        });
        expect(videoDataFromResponse(response(undefined), 'fallback title').basename).toBe('fallback title');
    });

    it('labels the track with the raw language code when it cannot be localized', () => {
        const data = videoDataFromResponse(
            response({ title: 'T', language: 'not-a-language', subtitles: vtt }),
            'fallback'
        );

        expect(data.subtitles).toHaveLength(1);
        expect(data.subtitles![0].label).toBe('not-a-language');
        expect(data.subtitles![0].language).toBe('not-a-language');
    });
});

describe('isRetryableStatus', () => {
    it('retries auth, rate limit, timeout and server errors', () => {
        for (const status of [401, 408, 429, 500, 502, 503]) {
            expect(isRetryableStatus(status)).toBe(true);
        }
    });

    it('does not retry statuses that will not resolve on their own', () => {
        for (const status of [400, 403, 404, 410]) {
            expect(isRetryableStatus(status)).toBe(false);
        }
    });
});

describe('statusError', () => {
    it('reports an unauthorized response as not being signed in', () => {
        expect(statusError(401)).toBe(notSignedInError);
    });

    it('reports other failures with their status', () => {
        expect(statusError(503)).toBe('Video API returned status 503');
    });
});
