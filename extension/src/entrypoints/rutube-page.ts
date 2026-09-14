import { extractExtension, inferTracks } from '@/pages/util';

// Rutube's own frontend fetches subtitle info from
// https://rutube.ru/api/play/options/{id}/?format=json, whose `captions` array holds
// { code, file, langTitle, format } where `file` is a direct URL to a real subtitle file
// (observed as .srt; auto-generated tracks are common on the site).
//
// Note: unlike most other integrations here, we can't rely on intercepting the page's own
// JSON.parse call to observe this response — Rutube's fetch pipeline resolves the response
// body without ever going through the page's global JSON.parse, so the usual `onJson` hook
// never fires for it (confirmed against a live page). Instead we make our own same-origin
// request for the options payload, which carries the viewer's session cookies same as the
// page's own request would.
function extractVideoId(pathname: string): string | undefined {
    return pathname.match(/\/video\/([\da-z]{32})/)?.[1];
}

export default defineUnlistedScript(() => {
    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const videoId = extractVideoId(window.location.pathname);

            if (videoId === undefined) {
                return;
            }

            const response = await fetch(`https://rutube.ru/api/play/options/${videoId}/?format=json`, {
                credentials: 'include',
            });

            if (!response.ok) {
                return;
            }

            const data = await response.json();

            if (data?.captions instanceof Array) {
                for (const caption of data.captions) {
                    if (typeof caption?.file === 'string' && typeof caption?.code === 'string') {
                        const label =
                            typeof caption.langTitle === 'string' && caption.langTitle.length > 0
                                ? caption.langTitle
                                : caption.code;

                        addTrack({
                            label,
                            language: caption.code.toLowerCase(),
                            url: caption.file,
                            extension: extractExtension(
                                caption.file,
                                typeof caption.format === 'string' ? caption.format : 'srt'
                            ),
                        });
                    }
                }
            }

            if (typeof data?.title === 'string' && data.title.length > 0) {
                setBasename(data.title);
            }
        },
        waitForBasename: true,
    });
});
