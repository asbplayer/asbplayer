import { extractExtension, trackFromDef, trackId } from '../pages/util';
import { VideoDataSubtitleTrack } from '@project/common';

describe('JW Player subtitle track detection', () => {
    describe('extractExtension', () => {
        it('extracts vtt extension', () => {
            expect(extractExtension('https://example.com/subtitles/jpn.vtt', 'vtt')).toBe('vtt');
        });

        it('extracts srt extension', () => {
            expect(extractExtension('https://example.com/subtitles/eng.srt', 'srt')).toBe('srt');
        });

        it('extracts ass extension with query params', () => {
            expect(extractExtension('https://example.com/subtitles/ja.ass?token=abc', 'ass')).toBe('ass');
        });

        it('extracts extension from url with hash', () => {
            expect(extractExtension('https://example.com/subtitles/en.vtt#t=10', 'vtt')).toBe('vtt');
        });

        it('returns fallback for urls without extension', () => {
            expect(extractExtension('https://example.com/subtitles/noextension', 'vtt')).toBe('vtt');
        });
    });

    describe('trackId', () => {
        it('generates unique id from language, label, and url', () => {
            const def = {
                label: 'Japanese',
                language: 'ja',
                url: 'https://example.com/jpn.vtt',
                extension: 'vtt',
            };
            const id = trackId(def);
            expect(id).toBe('ja:Japanese:https://example.com/jpn.vtt');
        });

        it('generates different ids for different languages', () => {
            const def1 = { label: 'English', language: 'en', url: 'https://example.com/eng.vtt', extension: 'vtt' };
            const def2 = { label: 'Japanese', language: 'ja', url: 'https://example.com/jpn.vtt', extension: 'vtt' };
            expect(trackId(def1)).not.toBe(trackId(def2));
        });
    });

    describe('trackFromDef', () => {
        it('creates track with id and def properties', () => {
            const def = {
                label: 'Japanese',
                language: 'ja',
                url: 'https://example.com/jpn.vtt',
                extension: 'vtt',
            };
            const track = trackFromDef(def);
            expect(track.id).toBe('ja:Japanese:https://example.com/jpn.vtt');
            expect(track.label).toBe('Japanese');
            expect(track.language).toBe('ja');
            expect(track.url).toBe('https://example.com/jpn.vtt');
            expect(track.extension).toBe('vtt');
        });
    });

    describe('inferLanguage logic', () => {
        function inferLanguage(track: { label?: string; srclang?: string; file?: string }): string | undefined {
            const text = `${track.label || ''} ${track.srclang || ''} ${track.file || ''}`;

            if (/japanese/i.test(text)) return 'ja';
            if (/\bjpn\b/i.test(text)) return 'ja';
            if (/日本語/.test(text)) return 'ja';

            if (/english/i.test(text)) return 'en';
            if (/chinese/i.test(text)) return 'zh';
            if (/korean/i.test(text)) return 'ko';

            if (track.srclang) {
                return track.srclang.toLowerCase();
            }

            return undefined;
        }

        it('detects japanese from label', () => {
            expect(inferLanguage({ label: 'Japanese' })).toBe('ja');
            expect(inferLanguage({ label: 'Japanese', srclang: 'en' })).toBe('ja');
        });

        it('detects japanese from file path', () => {
            expect(inferLanguage({ file: '/subtitles/jpn-2.vtt' })).toBe('ja');
            expect(inferLanguage({ file: '/subtitles/japanese.vtt' })).toBe('ja');
        });

        it('detects japanese from srclang', () => {
            expect(inferLanguage({ srclang: 'ja' })).toBe('ja');
        });

        it('detects english', () => {
            expect(inferLanguage({ label: 'English' })).toBe('en');
            expect(inferLanguage({ srclang: 'en' })).toBe('en');
        });

        it('detects chinese', () => {
            expect(inferLanguage({ label: 'Chinese' })).toBe('zh');
        });

        it('detects korean', () => {
            expect(inferLanguage({ label: 'Korean' })).toBe('ko');
        });

        it('falls back to srclang lowercase when no match', () => {
            expect(inferLanguage({ srclang: 'FR' })).toBe('fr');
        });
    });

    describe('scoreTrack logic', () => {
        function scoreTrack(track: { label?: string; srclang?: string; file?: string }): number {
            const text = `${track.label || ''} ${track.srclang || ''} ${track.file || ''}`;

            if (/japanese/i.test(text)) return 100;
            if (/日本語/.test(text)) return 100;
            if (/\bjpn\b/i.test(text)) return 90;
            if (/\bja\b/i.test(text) && !/\bjava\b/i.test(text)) return 80;

            if (/english/i.test(text)) return 50;
            if (/chinese/i.test(text)) return 50;
            if (/korean/i.test(text)) return 50;

            return 0;
        }

        it('scores japanese label highest', () => {
            expect(scoreTrack({ label: 'Japanese' })).toBe(100);
            expect(scoreTrack({ label: 'japanese' })).toBe(100);
        });

        it('scores japanese file path high', () => {
            expect(scoreTrack({ file: '/subtitles/jpn-2.vtt' })).toBe(90);
            expect(scoreTrack({ file: '/subtitles/japanese.vtt' })).toBe(100);
        });

        it('scores ja code lower than jpn', () => {
            expect(scoreTrack({ file: '/subtitles/ja.vtt' })).toBe(80);
        });

        it('scores english lower than japanese', () => {
            expect(scoreTrack({ label: 'Japanese' })).toBe(100);
            expect(scoreTrack({ label: 'English' })).toBe(50);
        });

        it('scores unknown tracks as 0', () => {
            expect(scoreTrack({ label: 'Spanish' })).toBe(0);
        });
    });

    describe('track filtering logic', () => {
        function isValidSubtitleTrack(track: { kind?: string; file?: string }): boolean {
            return (
                ['captions', 'subtitles'].includes(track.kind || '') &&
                typeof track.file === 'string' &&
                /\.(vtt|srt|ass|ssa)(\?|#|$)/i.test(track.file)
            );
        }

        it('accepts tracks with kind captions', () => {
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.vtt' })).toBe(true);
        });

        it('accepts tracks with kind subtitles', () => {
            expect(isValidSubtitleTrack({ kind: 'subtitles', file: 'https://example.com/jpn.vtt' })).toBe(true);
        });

        it('rejects tracks with other kinds', () => {
            expect(isValidSubtitleTrack({ kind: 'metadata', file: 'https://example.com/jpn.vtt' })).toBe(false);
            expect(isValidSubtitleTrack({ kind: 'thumbnails', file: 'https://example.com/jpn.vtt' })).toBe(false);
        });

        it('rejects tracks without file', () => {
            expect(isValidSubtitleTrack({ kind: 'captions' })).toBe(false);
            expect(isValidSubtitleTrack({ kind: 'captions', file: '' })).toBe(false);
        });

        it('rejects tracks with invalid file extensions', () => {
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.mp4' })).toBe(false);
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.json' })).toBe(false);
        });

        it('accepts vtt, srt, ass, ssa extensions', () => {
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.vtt' })).toBe(true);
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/eng.srt' })).toBe(true);
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/ja.ass' })).toBe(true);
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/ja.ssa' })).toBe(true);
        });

        it('accepts files with query params', () => {
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.vtt?token=abc' })).toBe(
                true
            );
        });

        it('accepts files with hash', () => {
            expect(isValidSubtitleTrack({ kind: 'captions', file: 'https://example.com/jpn.vtt#t=10' })).toBe(true);
        });
    });

    describe('JW Player sample data simulation', () => {
        function detectJwPlayerSubtitleTracks(playlist: { tracks?: any[] }[]): VideoDataSubtitleTrack[] {
            const rawTracks = playlist?.[0]?.tracks || [];

            const subtitleTracks = rawTracks
                .filter(
                    (track: any) =>
                        ['captions', 'subtitles'].includes(track.kind) &&
                        typeof track.file === 'string' &&
                        /\.(vtt|srt|ass|ssa)(\?|#|$)/i.test(track.file)
                )
                .map((track: any) => {
                    const text = `${track.label || ''} ${track.srclang || ''} ${track.file || ''}`;
                    let language: string | undefined;
                    if (/japanese/i.test(text)) language = 'ja';
                    else if (/\bjpn\b/i.test(text)) language = 'ja';
                    else if (/日本語/.test(text)) language = 'ja';
                    else if (track.srclang) language = track.srclang.toLowerCase();

                    const label = track.label || language || 'Unknown';

                    return trackFromDef({
                        label,
                        language,
                        url: track.file,
                        extension: extractExtension(track.file, 'vtt'),
                    });
                });

            subtitleTracks.sort((a: VideoDataSubtitleTrack, b: VideoDataSubtitleTrack) => {
                const scoreA = (t: { label?: string; language?: string; url?: string | string[] }) => {
                    const txt = `${t.label || ''} ${t.language || ''} ${t.url || ''}`;
                    if (/japanese/i.test(txt)) return 100;
                    if (/\bjpn\b/i.test(txt)) return 90;
                    if (/english/i.test(txt)) return 50;
                    return 0;
                };
                return scoreA(b) - scoreA(a);
            });

            return subtitleTracks;
        }

        it('detects japanese track from sample data', () => {
            const mockPlaylist = [
                {
                    tracks: [
                        {
                            kind: 'captions',
                            default: false,
                            file: 'https://fxpy7.watching.onl/anime/.../subtitles/jpn-2.vtt',
                            label: 'Japanese',
                            sideloaded: true,
                        },
                        {
                            kind: 'captions',
                            default: false,
                            file: 'https://fxpy7.watching.onl/anime/.../subtitles/eng-1.vtt',
                            label: 'English',
                            sideloaded: true,
                        },
                        {
                            kind: 'captions',
                            default: false,
                            file: 'https://fxpy7.watching.onl/anime/.../subtitles/spa-3.vtt',
                            label: 'Spanish',
                            sideloaded: true,
                        },
                    ],
                },
            ];

            const tracks = detectJwPlayerSubtitleTracks(mockPlaylist);
            expect(tracks.length).toBe(3);
            expect(tracks[0].label).toBe('Japanese');
            expect(tracks[0].language).toBe('ja');
            expect(tracks[0].url).toContain('jpn-2.vtt');
        });

        it('sorts japanese track first', () => {
            const mockPlaylist = [
                {
                    tracks: [
                        { kind: 'captions', file: 'https://example.com/eng.vtt', label: 'English' },
                        { kind: 'captions', file: 'https://example.com/jpn.vtt', label: 'Japanese' },
                        { kind: 'captions', file: 'https://example.com/spa.vtt', label: 'Spanish' },
                    ],
                },
            ];

            const tracks = detectJwPlayerSubtitleTracks(mockPlaylist);
            expect(tracks[0].label).toBe('Japanese');
            expect(tracks[1].label).toBe('English');
            expect(tracks[2].label).toBe('Spanish');
        });

        it('returns empty array when no valid tracks', () => {
            const mockPlaylist = [
                {
                    tracks: [
                        { kind: 'thumbnails', file: 'https://example.com/thumbnails.vtt' },
                        { kind: 'captions', file: 'https://example.com/eng.mp4' },
                    ],
                },
            ];

            const tracks = detectJwPlayerSubtitleTracks(mockPlaylist);
            expect(tracks.length).toBe(0);
        });
    });
});
