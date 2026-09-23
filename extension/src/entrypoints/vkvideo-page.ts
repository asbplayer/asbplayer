import { extractExtension, inferTracks, poll } from '@/pages/util';

// VK Video's player data is fetched through an internal, undocumented AJAX endpoint:
//   POST https://{host}/al_video.php   body: act=show&video={ownerId}_{videoId}&al=1
//
// The JSON response has the shape { payload: [code, [title, errorHtml, ..., opts]] }, where
// opts.player.params[0] carries `subs` (real, directly downloadable subtitle files -- observed
// as auto-generated .vtt tracks served from the same okcdn.ru CDN that backs ok.ru).
//
// Note: the response's own title fields (`opts.mvData.title`, `params.md_title`, and the
// top-level title string) come back with mangled encoding -- confirmed against a live page, and
// specific to those fields: `subs[].manifest_name` in the very same response decodes correctly.
// By the time it reaches JSON, the original bytes are already unrecoverable, so instead of
// trusting the API's title we read `document.title`, which the page itself renders correctly.
function extractVideoId(pathname: string): string | undefined {
    return pathname.match(/(?:video|clip)(-?\d+_\d+)/)?.[1];
}

const genericTitles = new Set(['VK Видео — смотреть онлайн бесплатно', 'VK Видео', 'VK Video']);

function basenameFromDocumentTitle(): string | undefined {
    const title = document.title.trim();
    return title.length > 0 && !genericTitles.has(title) ? title : undefined;
}

export default defineUnlistedScript(() => {
    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const videoId = extractVideoId(window.location.pathname);

            if (videoId === undefined) {
                return;
            }

            const body = new URLSearchParams({ act: 'show', video: videoId, al: '1' });
            const response = await fetch('/al_video.php', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
                credentials: 'include',
            });

            if (!response.ok) {
                return;
            }

            const json = await response.json();
            const params = json?.payload?.[1]?.[4]?.player?.params?.[0];

            if (params === undefined) {
                return;
            }

            if (params.subs instanceof Array) {
                for (const sub of params.subs) {
                    if (typeof sub?.url === 'string' && typeof sub?.lang === 'string') {
                        const label =
                            typeof sub.manifest_name === 'string' && sub.manifest_name.length > 0
                                ? sub.manifest_name
                                : sub.lang;

                        addTrack({
                            label,
                            language: sub.lang.toLowerCase(),
                            url: sub.url,
                            extension: extractExtension(sub.url, 'vtt'),
                        });
                    }
                }
            }

            const succeeded = await poll(() => {
                const basename = basenameFromDocumentTitle();

                if (basename !== undefined) {
                    setBasename(basename);
                    return true;
                }

                return false;
            });

            if (!succeeded) {
                setBasename(document.title.trim());
            }
        },
        waitForBasename: true,
    });
});
