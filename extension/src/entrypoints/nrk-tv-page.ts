import { asbError } from '@project/common/util';
import { inferTracks } from '@/pages/util';

export default defineUnlistedScript(() => {
    const originalFetch = window.fetch;
    let lastMetadataUrl: string | undefined;

    window.fetch = (...args) => {
        let metadataUrl = undefined;

        for (const arg of args) {
            if (typeof arg === 'string' && arg.includes('metadata')) {
                metadataUrl = arg;
            }
            if (arg instanceof Request && arg.url.includes('metadata')) {
                metadataUrl = arg.url;
            }
        }

        if (metadataUrl !== undefined) {
            lastMetadataUrl = metadataUrl;
        }

        return originalFetch(...args);
    };

    const requestTracks = async (url: string) => {
        const tracks = [];

        try {
            const value = await (await fetch(url)).json();

            if (typeof value?.playable?.subtitles === 'object' && Array.isArray(value.playable.subtitles)) {
                for (const track of value.playable.subtitles) {
                    if (
                        typeof track.label === 'string' &&
                        typeof track.language === 'string' &&
                        typeof track.webVtt === 'string'
                    ) {
                        tracks.push({
                            label: track.label as string,
                            language: track.language as string,
                            url: track.webVtt as string,
                            extension: 'vtt',
                        });
                    }
                }
            }
        } catch (e) {
            asbError({ asbLogLabel: 'nrk' }, e);
        }

        return tracks;
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            if (lastMetadataUrl === undefined) {
                return;
            }

            const manifestUrl = new URL(lastMetadataUrl);
            const value = await (await fetch(lastMetadataUrl)).json();

            if (typeof value?.preplay?.titles?.title === 'string') {
                if (typeof value?.preplay?.titles?.subtitle === 'string') {
                    setBasename(`${value.preplay.titles.title} ${value.preplay.titles.subtitle}`);
                } else {
                    setBasename(value.preplay.titles.title);
                }
            }

            if (typeof value?._links?.manifests === 'object' && Array.isArray(value._links.manifests)) {
                for (const manifest of value._links.manifests) {
                    if (typeof manifest.href === 'string') {
                        const tracks = await requestTracks(`${manifestUrl.origin}${manifest.href}`);

                        for (const track of tracks) {
                            addTrack(track);
                        }
                    }
                }
            }
        },

        waitForBasename: true,
    });
});
