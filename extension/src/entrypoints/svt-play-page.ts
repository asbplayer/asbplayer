import { inferTracks } from '@/pages/util';

export default defineUnlistedScript(() => {
    const originalFetch = window.fetch.bind(window);
    let lastVideoApiUrl: string | undefined;

    window.fetch = (...args) => {
        const input = args[0];
        const url =
            typeof input === 'string'
                ? input
                : input instanceof Request
                  ? input.url
                  : input instanceof URL
                    ? input.href
                    : '';

        try {
            if (url) {
                const parsed = new URL(url, location.href);
                if (parsed.hostname === 'video.svt.se' && parsed.pathname.startsWith('/video/')) {
                    // Capture the URL so it can be re-fetched in onRequest to extract subtitle and title data.
                    lastVideoApiUrl = parsed.href;
                }
            }
        } catch {
            // ignore malformed URLs
        }

        return originalFetch(...args);
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            if (lastVideoApiUrl === undefined) {
                return;
            }

            try {
                const value = await (await originalFetch(lastVideoApiUrl)).json();

                if (typeof value?.programTitle === 'string') {
                    const episodeTitle = typeof value.episodeTitle === 'string' ? value.episodeTitle.trim() : '';
                    setBasename(
                        episodeTitle ? `${value.programTitle.trim()} ${episodeTitle}` : value.programTitle.trim()
                    );
                }

                if (Array.isArray(value?.subtitleReferences)) {
                    for (const sub of value.subtitleReferences) {
                        if (
                            typeof sub.url === 'string' &&
                            typeof sub.language === 'string' &&
                            sub.format === 'webvtt'
                        ) {
                            addTrack({
                                label:
                                    (typeof sub.label === 'string' && sub.label.trim()) ||
                                    (typeof sub.languageName === 'string' && sub.languageName.trim()) ||
                                    sub.language,
                                language: sub.language,
                                url: sub.url,
                                extension: 'vtt',
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('[svtplay] Failed to infer tracks from', lastVideoApiUrl, e);
            }
        },

        waitForBasename: true,
    });
});
