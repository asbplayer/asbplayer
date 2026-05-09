import { inferTracks } from '@/pages/util';

export default defineUnlistedScript(() => {
    const originalFetch = window.fetch.bind(window);
    let latestBuildId: string | undefined;
    let latestProductData: any = undefined;
    let latestProductDataPath: string = '';
    let latestProductDataSlug: string = '';

    // Intercept /_next/data/.../program/... fetches made by Next.js's own SPA router so
    // that navigating between episodes is fast (cache hit on the next request).
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

        const nextDataMatch = url.match(/\/_next\/data\/([^/]+)\/program\/([^/]+)\.json/);
        if (nextDataMatch) {
            // Capture buildId and pathname now, since window.location may change before the promise resolves.
            latestBuildId = nextDataMatch[1];
            const requestPathname = window.location.pathname;
            const slug = nextDataMatch[2];
            const promise = originalFetch(...args);
            promise.then(async (response) => {
                try {
                    const json = await response.clone().json();
                    if (json?.pageProps?.productData) {
                        latestProductData = json.pageProps.productData;
                        latestProductDataPath = requestPathname;
                        latestProductDataSlug = slug;
                    }
                } catch {}
            });
            return promise;
        }

        return originalFetch(...args);
    };

    // uses originalFetch directly to avoid re-triggering the interceptor
    const fetchJson = async (url: string): Promise<any> => {
        try {
            const r = await originalFetch(url);
            if (!r.ok) return undefined;
            return await r.json();
        } catch {
            return undefined;
        }
    };

    const fetchProgramData = async (buildId: string, programSlug: string, pathname: string): Promise<any> => {
        // Cache hit: same page and same program slug (guards against Next.js prefetch
        // of other episodes polluting the cache with the wrong episode's data).
        if (latestProductData && latestProductDataPath === pathname && latestProductDataSlug === programSlug) {
            return latestProductData;
        }

        const data = (await fetchJson(`/_next/data/${buildId}/program/${programSlug}.json`))?.pageProps?.productData;

        if (data) {
            latestProductData = data;
            latestProductDataPath = pathname;
            latestProductDataSlug = programSlug;
        }

        return data;
    };

    const getProductData = async (): Promise<any> => {
        try {
            const el = document.getElementById('__NEXT_DATA__');
            const nextData = el ? JSON.parse(el.textContent || '') : null;

            // Prefer buildId from __NEXT_DATA__, but fall back to one captured from
            // an intercepted /_next/data/ fetch when __NEXT_DATA__ is absent.
            const buildId = nextData?.buildId ?? latestBuildId;
            if (!buildId) return undefined;

            const pathname = window.location.pathname;

            // __NEXT_DATA__.query reflects the route parameters at initial page load and
            // does NOT update during Next.js SPA navigation. Reconstructing the path from
            // it and comparing against the current pathname detects stale DOM data.
            const nextDataPath =
                nextData?.query?.productType && nextData?.query?.id
                    ? `/${nextData.query.productType}/${nextData.query.id}`
                    : null;
            const isNextDataFresh = nextDataPath === pathname;
            const productData = isNextDataFresh ? nextData?.props?.pageProps?.productData : undefined;

            if (productData?.productType === 'program') {
                return productData;
            }

            let programSlug: string | undefined;

            if (productData?.productType === 'series') {
                programSlug = productData?.mainProgram?.slug;
            } else if (pathname.startsWith('/serie/')) {
                // Stale __NEXT_DATA__ after SPA navigation, or missing productData due to ISR caching.
                // Fetch the serie data to discover the featured episode slug.
                const serieSlug = pathname.split('/serie/')[1]?.split('?')[0];
                if (serieSlug) {
                    const serieJson = await fetchJson(`/_next/data/${buildId}/serie/${serieSlug}.json`);
                    programSlug = serieJson?.pageProps?.productData?.mainProgram?.slug;
                }
            } else if (pathname.startsWith('/program/')) {
                // Stale __NEXT_DATA__ after SPA navigation to a program page.
                programSlug = pathname.split('/program/')[1]?.split('?')[0];
            }

            if (programSlug) {
                return await fetchProgramData(buildId, programSlug, pathname);
            }
        } catch (e) {
            console.error('[urplay] Failed to get product data', e);
        }

        return undefined;
    };

    inferTracks({
        onRequest: async (addTrack, setBasename) => {
            const productData = await getProductData();
            if (!productData) {
                return;
            }

            const seriesTitle = typeof productData.seriesTitle === 'string' ? productData.seriesTitle.trim() : '';
            const episodeTitle = typeof productData.title === 'string' ? productData.title.trim() : '';

            if (seriesTitle && episodeTitle && seriesTitle !== episodeTitle) {
                setBasename(`${seriesTitle} ${episodeTitle}`);
            } else {
                setBasename(seriesTitle || episodeTitle);
            }

            const streamingInfo = productData.streamingInfo;
            if (typeof streamingInfo !== 'object' || !streamingInfo) {
                return;
            }

            for (const [key, value] of Object.entries(streamingInfo)) {
                if (key === 'raw') continue; // 'raw' contains video stream URLs, not subtitle data
                if (typeof value !== 'object' || !value) continue;
                const track = value as any;
                if (typeof track.vtt?.location === 'string') {
                    addTrack({
                        label: (typeof track.label === 'string' && track.label.trim()) || key,
                        language:
                            (typeof track.vtt.language === 'string' && track.vtt.language.trim()) ||
                            (typeof track.tt?.language === 'string' && track.tt.language.trim()) ||
                            'swe',
                        url: track.vtt.location,
                        extension: 'vtt',
                    });
                }
            }
        },

        waitForBasename: true,
    });
});
