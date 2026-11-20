import { asbError } from '@project/common/util/log';
import { inferTracks } from '@/pages/util';
import { cleanNpoVtt, npoBasename, npoEpisodeSlug, npoProgramDetailUrl, npoSubtitleUrl } from '@/pages/npo';

export default defineUnlistedScript(() => {
    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const slug = npoEpisodeSlug(window.location.pathname);

            if (slug === undefined) {
                return;
            }

            try {
                const detail = await (await fetch(npoProgramDetailUrl(slug))).json();
                const basename = npoBasename(detail);
                setBasename(basename ?? slug);

                if (typeof detail?.productId !== 'string') {
                    return;
                }

                const url = npoSubtitleUrl(detail.productId);
                let trackUrl = url;

                try {
                    const response = await fetch(url);

                    if (!response.ok) {
                        // No captions published for this episode.
                        return;
                    }

                    trackUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(cleanNpoVtt(await response.text()))}`;
                } catch (e) {
                    asbError('npo-start', 'Failed to clean captions, falling back to raw url', url, e);
                }

                addTrack({ label: 'Nederlands', language: 'nl', url: trackUrl, extension: 'vtt' });
            } catch (e) {
                asbError('npo-start', 'Failed to infer tracks for', slug, e);
            }
        },

        waitForBasename: true,
    });
});
