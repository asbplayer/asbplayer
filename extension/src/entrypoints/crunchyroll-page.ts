import type { VideoDataSubtitleTrackDef } from '@project/common';

import { inferTracksFromInterceptedMpdViaXMLHTTPRequest } from '@/pages/mpd-util';
import { extractExtension } from '@/pages/util';

export default defineUnlistedScript(() => {
    const playbackUrlRegex = /\/playback\/v3\/.*\/play(?:\?|$)/i;
    const mpdUrlRegex = /manifest\.mpd(?:\?|$)/i;

    function currentBasename(): string {
        return document.title.replace(/\s*-\s*Watch on Crunchyroll\s*$/i, '').trim();
    }

    function languageLabel(language: string): string {
        const normalized = language.toLowerCase();

        if (normalized.startsWith('en')) {
            return 'English';
        }

        if (normalized.startsWith('pt')) {
            return 'Portuguese';
        }

        if (normalized.startsWith('es')) {
            return 'Spanish';
        }

        if (normalized.startsWith('ja')) {
            return 'Japanese';
        }

        return language;
    }

    function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }

        return value as Record<string, unknown>;
    }

    /*
     * Extracts the regular ASS subtitle tracks from the
     * /playback/v3/.../play response.
     */
    function inspectPlaybackJson(
        value: unknown,
        addTrack: (track: VideoDataSubtitleTrackDef) => void,
        setBasename: (basename: string) => void
    ): void {
        const root = recordFromUnknown(value);

        if (root === undefined) {
            return;
        }

        const data = recordFromUnknown(root.data);
        const subtitles = recordFromUnknown(root.subtitles ?? data?.subtitles);

        if (subtitles === undefined) {
            return;
        }

        let foundTrack = false;

        for (const [key, rawTrack] of Object.entries(subtitles)) {
            if (key.toLowerCase() === 'none') {
                continue;
            }

            const track = recordFromUnknown(rawTrack);

            if (track === undefined) {
                continue;
            }

            const url = typeof track.url === 'string' ? track.url : undefined;
            const language = typeof track.language === 'string' ? track.language : key;
            const extension =
                typeof track.format === 'string' ? track.format.toLowerCase().replace(/^\./, '') : undefined;

            if (url === undefined || extension === undefined || language.toLowerCase() === 'none') {
                continue;
            }

            addTrack({
                label: languageLabel(language),
                language,
                url,
                extension,
            });

            foundTrack = true;
        }

        if (foundTrack) {
            setBasename(currentBasename());
        }
    }

    /*
     * Crunchyroll may parse playback responses through Response.json(),
     * which does not necessarily call the page's JSON.parse implementation.
     * Parse a cloned response so the shared inferTracks onJson hook sees it.
     */
    function interceptPlaybackResponses(): void {
        const originalFetch = window.fetch;

        window.fetch = function (...args: Parameters<typeof originalFetch>) {
            const [input] = args;

            let requestUrl = '';

            try {
                requestUrl =
                    typeof input === 'string'
                        ? new URL(input, window.location.href).href
                        : input instanceof URL
                          ? input.href
                          : input.url;
            } catch {
                requestUrl = '';
            }

            const responsePromise = originalFetch.call(this, ...args);

            if (playbackUrlRegex.test(requestUrl)) {
                void responsePromise
                    .then((response) => response.clone().text())
                    .then((text) => {
                        try {
                            JSON.parse(text);
                        } catch {
                            // Ignore non-JSON playback responses.
                        }
                    })
                    .catch(() => {
                        // Subtitle detection must never interfere with playback.
                    });
            }

            return responsePromise;
        };
    }

    inferTracksFromInterceptedMpdViaXMLHTTPRequest(
        mpdUrlRegex,
        (playlist, language) => {
            const segmentUrls = playlist.segments.map((segment) => segment.resolvedUri);
            const url = segmentUrls.length > 0 ? segmentUrls : playlist.resolvedUri;
            const extensionSource = segmentUrls[0] ?? playlist.resolvedUri;
            const baseLabel = languageLabel(language);

            return {
                label: `${baseLabel} [CC]`,
                language,
                url,
                extension: extractExtension(extensionSource, 'vtt'),
            };
        },
        {
            basename: currentBasename,
            onJson: inspectPlaybackJson,
        }
    );

    interceptPlaybackResponses();
});
