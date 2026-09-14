import { extractExtension, inferTracks } from '@/pages/util';

// ok.ru's server-rendered page carries a `data-options="..."` attribute (HTML-entity-escaped
// JSON) with the shape:
//
//   { flashvars: { metadata: { movie: { title, subtitleTracks: [{ url, language, title }] } } } }
//
// `subtitleTracks[].url` is a direct (often protocol-relative) URL to a real subtitle file.
//
// Note: ok.ru's own hydration code parses this via the page's global JSON.parse, so in principle
// the usual `onJson` hook (which patches JSON.parse) should see it. In practice it doesn't
// reliably: that parse happens synchronously very early during initial page parsing, before
// `onJson`'s patch (installed via a deferred setTimeout) is in place, so the call can be missed
// depending on timing (confirmed against a live page). Fetching our own page's HTML directly
// (same-origin, so no CORS concern) and reading the attribute out of it sidesteps the race
// entirely.
function decodeHtmlEntities(value: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function extractVideoId(pathname: string): string | undefined {
    return pathname.match(/\/video(?:embed)?\/(\d+)/)?.[1];
}

export default defineUnlistedScript(() => {
    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const videoId = extractVideoId(window.location.pathname);

            if (videoId === undefined) {
                return;
            }

            const response = await fetch(window.location.href, { credentials: 'include' });

            if (!response.ok) {
                return;
            }

            const html = await response.text();
            const match = html.match(new RegExp(`data-options="([^"]*${videoId}[^"]*)"`));

            if (match === null) {
                return;
            }

            const options = JSON.parse(decodeHtmlEntities(match[1]));
            const movie = options?.flashvars?.metadata?.movie;

            if (movie === undefined) {
                return;
            }

            if (movie.subtitleTracks instanceof Array) {
                for (const track of movie.subtitleTracks) {
                    if (typeof track?.url === 'string' && typeof track?.language === 'string') {
                        const url = track.url.startsWith('//') ? `https:${track.url}` : track.url;
                        const label =
                            typeof track.title === 'string' && track.title.length > 0 ? track.title : track.language;

                        addTrack({
                            label,
                            language: track.language.toLowerCase(),
                            url,
                            extension: extractExtension(url, 'vtt'),
                        });
                    }
                }
            }

            if (typeof movie.title === 'string' && movie.title.length > 0) {
                setBasename(movie.title);
            }
        },
        waitForBasename: true,
    });
});
