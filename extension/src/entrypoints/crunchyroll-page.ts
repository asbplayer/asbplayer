import { AggressiveGenericPageDiscovery } from '@project/extension/src/pages/aggressive-generic-page';
import { bindVideoDataDiscovery } from '@project/extension/src/pages/subtitle-discovery';

export default defineUnlistedScript(() => {
    const cmsObjectsUrlRegex = /\/content\/v2\/cms\/objects\//i;
    const episodeBasenames = new Map<string, string>();

    function currentBasename(fallback: string): string {
        const episodeId = /\/watch\/([^/?#]+)/.exec(window.location.pathname)?.[1];
        const episodeBasename = episodeId === undefined ? undefined : episodeBasenames.get(episodeId);
        return episodeBasename ?? fallback.replace(/\s*-\s*Watch on Crunchyroll\s*$/i, '').trim();
    }

    // "<series> SxxEyy - <episode title>" so the Jimaku search gets the series name and episode number
    function captureEpisodeBasenames(value: unknown): void {
        const data = recordFromUnknown(value)?.data;
        if (!Array.isArray(data)) return;
        for (const item of data) {
            const object = recordFromUnknown(item);
            const metadata = recordFromUnknown(object?.episode_metadata);
            if (typeof object?.id !== 'string' || typeof metadata?.series_title !== 'string') continue;
            let basename = metadata.series_title;
            if (typeof metadata.episode_number === 'number') {
                const season = typeof metadata.season_number === 'number' ? metadata.season_number : 1;
                const pad = (n: number) => `${n}`.padStart(2, '0');
                basename += ` S${pad(season)}E${pad(metadata.episode_number)}`;
            }
            if (typeof object.title === 'string' && object.title !== '') basename += ` - ${object.title}`;
            episodeBasenames.set(object.id, basename);
        }
    }

    function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }

        return value as Record<string, unknown>;
    }

    const discovery = new AggressiveGenericPageDiscovery();
    discovery.install();
    bindVideoDataDiscovery({
        async videoData(video) {
            const data = await discovery.videoData(video);
            return { ...data, basename: currentBasename(data.basename) };
        },
    });

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

        if (cmsObjectsUrlRegex.test(requestUrl)) {
            void responsePromise
                .then((response) => response.clone().json())
                .then(captureEpisodeBasenames)
                .catch(() => {
                    // Episode metadata must never interfere with playback.
                });
        }

        return responsePromise;
    };

    // The timeline component's seekTo(seconds) seeks through the player, unlike video.currentTime writes
    function findTimelineSeekTo(): ((timestampSeconds: number) => void) | undefined {
        const roots = new Set<any>();

        for (const element of document.querySelectorAll('*')) {
            const key = Object.keys(element).find((k) => k.startsWith('__reactFiber'));
            if (key === undefined) continue;
            let fiber = (element as any)[key];
            while (fiber?.return) fiber = fiber.return;
            roots.add(fiber);
        }

        for (const root of roots) {
            const stack = [root];

            while (stack.length > 0) {
                const fiber = stack.pop();
                if (!fiber) continue;
                const props = fiber.memoizedProps;

                if (
                    props !== null &&
                    typeof props === 'object' &&
                    typeof props.seekTo === 'function' &&
                    typeof props.duration === 'number'
                ) {
                    return props.seekTo;
                }

                if (fiber.sibling) stack.push(fiber.sibling);
                if (fiber.child) stack.push(fiber.child);
            }
        }

        return undefined;
    }

    document.addEventListener('asbplayer-crunchyroll-seek', (e) => {
        const timestampSeconds = (e as CustomEvent).detail;
        if (typeof timestampSeconds !== 'number') return;

        try {
            const seekTo = findTimelineSeekTo();
            if (seekTo === undefined) return;
            seekTo(timestampSeconds);
            e.preventDefault();
        } catch {
            // Uncancelled event falls back to seeking the video element
        }
    });
});
