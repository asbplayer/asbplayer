import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, poll, trackFromDef } from '@/pages/util';

declare const jwplayer: any | undefined;

type JwTrack = { kind?: string; file?: string; label?: string; srclang?: string; default?: boolean };
type JwSubtitleTrack = JwTrack & { file: string };

export default defineUnlistedScript(() => {
    setTimeout(() => {
        let disposed = false;
        const DEBUG = false;

        function log(...args: any[]) {
            if (DEBUG) {
                console.log('[jwplayer-page]', ...args);
            }
        }

        function inferLanguage(track: { label?: string; srclang?: string; file?: string }): string | undefined {
            const text = `${track.label || ''} ${track.srclang || ''} ${track.file || ''}`;

            if (/japanese/i.test(text)) return 'ja';
            if (/\bjpn\b/i.test(text)) return 'ja';
            if (/日本語/.test(text)) return 'ja';

            if (/english/i.test(text)) return 'en';
            if (/chinese/i.test(text)) return 'zh';
            if (/korean/i.test(text)) return 'ko';
            if (/spanish/i.test(text)) return 'es';
            if (/french/i.test(text)) return 'fr';
            if (/german/i.test(text)) return 'de';
            if (/portuguese/i.test(text)) return 'pt';
            if (/italian/i.test(text)) return 'it';
            if (/russian/i.test(text)) return 'ru';
            if (/arabic/i.test(text)) return 'ar';
            if (/hindi/i.test(text)) return 'hi';
            if (/thai/i.test(text)) return 'th';
            if (/indonesian/i.test(text)) return 'id';
            if (/vietnamese/i.test(text)) return 'vi';
            if (/malay/i.test(text)) return 'ms';

            if (track.srclang) {
                return track.srclang.toLowerCase();
            }

            return undefined;
        }

        function scoreTrack(track: {
            label?: string;
            language?: string;
            srclang?: string;
            file?: string;
            url?: string | string[];
        }): number {
            const text = `${track.label || ''} ${track.language || ''} ${track.srclang || ''} ${track.file || ''} ${track.url || ''}`;

            if (/japanese/i.test(text)) return 100;
            if (/日本語/.test(text)) return 100;
            if (/\bjpn\b/i.test(text)) return 90;
            if (/\bja\b/i.test(text) && !/\bjava\b/i.test(text)) return 80;

            if (/english/i.test(text)) return 50;
            if (/chinese/i.test(text)) return 50;
            if (/korean/i.test(text)) return 50;

            return 0;
        }

        function getJwPlayer() {
            if (typeof jwplayer === 'undefined') {
                return undefined;
            }

            return jwplayer;
        }

        function getPlayer() {
            try {
                return getJwPlayer()?.();
            } catch (e) {
                log('JW Player API not ready:', e);
                return undefined;
            }
        }

        function playlistTracks(player: any): JwTrack[] | undefined {
            const playlist = player.getPlaylist?.();
            if (!Array.isArray(playlist)) {
                return undefined;
            }

            const tracks: JwTrack[] = [];
            for (const item of playlist) {
                if (Array.isArray(item?.tracks)) {
                    tracks.push(...item.tracks);
                }
            }

            return tracks;
        }

        function isSubtitleTrack(track: JwTrack): track is JwSubtitleTrack {
            return (
                ['captions', 'subtitles'].includes(track.kind || '') &&
                typeof track.file === 'string' &&
                /\.(vtt|srt|ass|ssa)(\?|#|$)/i.test(track.file)
            );
        }

        function detectTracks(): VideoData {
            const player = getPlayer();
            if (!player) {
                return { error: 'JW Player not found', basename: '' };
            }

            if (typeof player.getPlaylist !== 'function') {
                return { error: 'JW Player not initialized', basename: '' };
            }

            const rawTracks = playlistTracks(player);

            if (!Array.isArray(rawTracks) || !rawTracks.length) {
                return { error: 'No tracks found in JW Player playlist', basename: '' };
            }

            const subtitleTracks = rawTracks.filter(isSubtitleTrack).map((track: JwSubtitleTrack) => {
                const language = inferLanguage(track);
                const label = track.label || language || 'Unknown';

                return trackFromDef({
                    label,
                    language,
                    url: track.file,
                    extension: extractExtension(track.file, 'vtt'),
                });
            });

            if (!subtitleTracks.length) {
                return { error: 'No valid subtitle tracks found', basename: '' };
            }

            subtitleTracks.sort(
                (a: VideoDataSubtitleTrack, b: VideoDataSubtitleTrack) => scoreTrack(b) - scoreTrack(a)
            );

            log(
                'Detected subtitle tracks:',
                subtitleTracks.map((t: VideoDataSubtitleTrack) => ({
                    label: t.label,
                    language: t.language,
                    url: t.url,
                }))
            );

            return {
                error: '',
                basename: '',
                subtitles: subtitleTracks,
            };
        }

        function injectTrackToVideo(
            track: { file: string; label?: string; default?: boolean },
            video: HTMLVideoElement
        ) {
            if (!video) {
                log('No video element found');
                return;
            }

            const existingTrack = Array.from(video.querySelectorAll('track[data-asb-injected="jwplayer"]')).find(
                (trackEl) => trackEl.getAttribute('src') === track.file
            );
            if (existingTrack) {
                log('Track already injected, skipping');
                return;
            }

            const trackEl = document.createElement('track');
            trackEl.kind = 'subtitles';
            trackEl.label = track.label || 'Unknown';
            trackEl.src = track.file;
            trackEl.dataset.asbInjected = 'jwplayer';

            if (track.default) {
                trackEl.default = true;
            }

            const lang = inferLanguage({ label: track.label, file: track.file });
            if (lang) {
                trackEl.srclang = lang;
            }

            video.appendChild(trackEl);
            log('Injected track element:', trackEl.label);

            setTimeout(() => {
                for (const textTrack of video.textTracks) {
                    if (textTrack.label === (track.label || 'Unknown') || textTrack.language === lang) {
                        textTrack.mode = 'showing';
                        log('Enabled text track:', textTrack.label);
                    }
                }
            }, 100);
        }

        function injectBestTrack() {
            const player = getPlayer();
            if (typeof player?.getPlaylist !== 'function') return;

            const rawTracks = playlistTracks(player);
            if (!Array.isArray(rawTracks)) return;

            const bestTrack = rawTracks
                .filter(isSubtitleTrack)
                .sort((a: JwTrack, b: JwTrack) => scoreTrack(b) - scoreTrack(a))[0];

            if (!bestTrack) {
                log('No subtitle track found');
                return;
            }

            const video = document.querySelector('video');
            if (video) {
                injectTrackToVideo(bestTrack, video);
            }
        }

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                if (disposed) return;

                log('Received asbplayer-get-synced-data');

                const data = detectTracks();

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: data,
                    })
                );
            },
            false
        );

        document.addEventListener(
            'asbplayer-query-jwplayer',
            async () => {
                const apiAvailable = await poll(() => getJwPlayer() !== undefined, 5000);
                document.dispatchEvent(
                    new CustomEvent('asbplayer-jwplayer-enabled', {
                        detail: apiAvailable,
                    })
                );
            },
            false
        );

        (async () => {
            const ready = await poll(() => getPlayer()?.getPlaylist !== undefined, 15000);

            if (ready && !disposed) {
                log('JW Player detected, checking for tracks');
                const data = detectTracks();

                if (data.subtitles?.length) {
                    log('Auto-injecting best subtitle track');
                    injectBestTrack();
                }
            } else {
                log('JW Player not detected within timeout');
            }
        })();
    }, 0);
});
