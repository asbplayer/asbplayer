import { VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension, trackFromDef } from '@/pages/util';

export default defineUnlistedScript(() => {
    // document.title is a constant ("Stremio - Freedom to Stream"); the real
    // title lives in the player's title element (hashed class name, hence prefix).
    const videoName = (): string => {
        const playerTitle = document.querySelector('[class*="player-title"]')?.textContent?.trim();
        return playerTitle || document.title;
    };

    // Stremio subtitle URLs are irregular (trailing slash + query, or no
    // extension), so strip those before reading the extension.
    const subtitleExtension = (url: string): string => {
        const withoutTrailingSlash = url.split(/[?#]/)[0].replace(/\/+$/, '');
        const extension = extractExtension(withoutTrailingSlash, 'srt').toLowerCase();
        return extension === 'vtt' ? 'vtt' : 'srt';
    };

    // Canonical form for deduplicating the same subtitle across detection paths.
    const normalizeUrl = (url: string): string => {
        try {
            const parsed = new URL(url);
            parsed.searchParams.sort();
            const path = parsed.pathname.replace(/\/+$/, '');
            const query = parsed.searchParams.toString();
            return `${parsed.protocol}//${parsed.host}${path}${query ? `?${query}` : ''}`;
        } catch {
            return url;
        }
    };

    // Language code from the URL query. Not the path: subs*.strem.io URLs carry an
    // unrelated "/en/" segment that is not the subtitle language.
    const languageCodeFromUrl = (url: string): string => {
        try {
            const params = new URL(url).searchParams;
            return (params.get('lang_code') || params.get('lang') || params.get('language') || '').toLowerCase();
        } catch {
            return '';
        }
    };

    // Resolve to an empty result only after subtitle detection has had time to run.
    const EMPTY_RESULT_TIMEOUT_MS = 10000;
    // Cap each addon query so one slow/hung addon can't hold up the single dispatch.
    const ADDON_QUERY_TIMEOUT_MS = 8000;

    const discoveredSubtitles = new Map<string, VideoDataSubtitleTrack>();
    const seenFallbackUrls = new Set<string>();
    let fallbackIndex = 1;

    // asbplayer replaces its synced data on every event, so always send the full set.
    const dispatchTracks = () => {
        document.dispatchEvent(
            new CustomEvent('asbplayer-synced-data', {
                detail: {
                    error: '',
                    basename: videoName(),
                    subtitles: Array.from(discoveredSubtitles.values()),
                },
            })
        );
    };

    // Returns whether the track set actually changed, so callers control when to
    // dispatch (manifest reconstruction dispatches once after all addons resolve).
    const addTrack = (key: string, def: VideoDataSubtitleTrackDef): boolean => {
        const track = trackFromDef(def);
        const existing = discoveredSubtitles.get(key);

        // Skip identical re-adds, but let a manifest entry upgrade a fallback track.
        if (existing !== undefined && existing.id === track.id) {
            return false;
        }

        discoveredSubtitles.set(key, track);
        return true;
    };

    // Label is "<lang> - <title>" (or just the code), with a counter on collision.
    // Returns whether any track was added or upgraded.
    const ingestSubtitleList = (subtitles: any[]): boolean => {
        // A collision is only two *different* subtitles sharing a label; the same
        // URL seen twice (e.g. served by two addons) must keep one clean label
        // rather than gaining a spurious counter suffix.
        const labelTakenByOther = (candidate: string, key: string) => {
            for (const [otherKey, track] of discoveredSubtitles) {
                if (otherKey !== key && track.label === candidate) {
                    return true;
                }
            }
            return false;
        };

        let changed = false;
        for (const sub of subtitles) {
            if (typeof sub?.url !== 'string') {
                continue;
            }

            let language = '';
            if (typeof sub.lang === 'string' && sub.lang) {
                language = sub.lang;
            } else if (typeof sub.lang_code === 'string' && sub.lang_code) {
                language = sub.lang_code;
            } else {
                language = languageCodeFromUrl(sub.url);
            }
            language = language.toLowerCase();

            const key = normalizeUrl(sub.url);
            const title = typeof sub.title === 'string' ? sub.title.trim() : '';
            let label = title ? (language ? `${language} - ${title}` : title) : language || 'Subtitle';
            if (labelTakenByOther(label, key)) {
                let i = 2;
                while (labelTakenByOther(`${label} ${i}`, key)) {
                    i++;
                }
                label = `${label} ${i}`;
            }

            // addTrack commits synchronously, so the next iteration's collision
            // check sees this label.
            changed =
                addTrack(key, {
                    label,
                    language,
                    url: sub.url,
                    extension: subtitleExtension(sub.url),
                }) || changed;
        }
        return changed;
    };

    // Primary detection. Stremio resolves the subtitle manifest inside its
    // stremio-core Web Worker (not interceptable from the page) and caches it, so
    // we rebuild the request ourselves: <addonBase>/subtitles/<type>/<videoId>.json.

    // Installed subtitle addons' transport URLs, read from stremio-core
    // (window.core, undocumented). Best-effort: makes detection independent of
    // which addon served the stream. On failure we rely on the hash addon + fallback.
    const collectSubtitleAddonBases = async (): Promise<string[]> => {
        const core = (window as any).core;
        if (!core) {
            return [];
        }

        const states: any[] = [core.state, core.model];
        const tryPush = async (factory: () => any) => {
            try {
                const value = factory();
                states.push(value && typeof value.then === 'function' ? await value : value);
            } catch {
                // accessor not present in this build
            }
        };
        await tryPush(() => core.getState?.('ctx'));
        await tryPush(() => core.getState?.());
        await tryPush(() => core.transport?.getState?.('ctx'));

        const bases = new Set<string>();
        // stremio-core state is a large, cyclic object graph; a visited set keeps
        // the traversal from re-walking shared/circular nodes (the depth cap alone
        // still allows exponential revisits).
        const visited = new WeakSet<object>();
        const visit = (node: any, depth: number) => {
            if (!node || typeof node !== 'object' || depth > 7 || visited.has(node)) {
                return;
            }
            visited.add(node);
            if (Array.isArray(node)) {
                for (const child of node) {
                    visit(child, depth + 1);
                }
                return;
            }
            if (Array.isArray(node.addons)) {
                for (const addon of node.addons) {
                    const url = typeof addon?.transportUrl === 'string' ? addon.transportUrl : '';
                    const resources = addon?.manifest?.resources;
                    if (
                        url &&
                        Array.isArray(resources) &&
                        resources.some((r: any) => r === 'subtitles' || r?.name === 'subtitles')
                    ) {
                        bases.add(url.replace(/\/manifest\.json$/i, ''));
                    }
                }
            }
            for (const key of Object.keys(node)) {
                try {
                    visit(node[key], depth + 1);
                } catch {
                    // ignore getters that throw
                }
            }
        };
        for (const state of states) {
            visit(state, 0);
        }
        return Array.from(bases);
    };

    const querySubtitleAddon = async (base: string, type: string, idPath: string): Promise<boolean> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ADDON_QUERY_TIMEOUT_MS);
        try {
            const response = await fetch(`${base}/subtitles/${type}/${idPath}.json`, { signal: controller.signal });
            if (!response.ok) {
                return false;
            }
            const data = await response.json();
            if (Array.isArray(data?.subtitles) && data.subtitles.length > 0) {
                return ingestSubtitleList(data.subtitles);
            }
        } catch {
            // addon unreachable, timed out, or non-JSON
        } finally {
            clearTimeout(timeout);
        }
        return false;
    };

    let currentVideoId = '';
    let reconstructionStarted = false;

    const reconstructFromHash = async () => {
        const hash = location.hash;
        if (!hash.startsWith('#/player/')) {
            return;
        }

        // #/player/<stream>/<subtitleAddonUrl>/<metaAddonUrl>/<type>/<metaId>/<videoId>
        const segments = hash
            .slice('#/player/'.length)
            .split('/')
            .map((s) => {
                try {
                    return decodeURIComponent(s);
                } catch {
                    return s;
                }
            });
        if (segments.length < 6) {
            return;
        }
        const [, addonUrl, , type, , videoId] = segments;
        if (!type || !videoId) {
            return;
        }

        // Reset on a new video (e.g. next episode) so stale tracks don't linger.
        if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            reconstructionStarted = false;
            discoveredSubtitles.clear();
            seenFallbackUrls.clear();
            fallbackIndex = 1;
        }
        if (reconstructionStarted) {
            return;
        }
        reconstructionStarted = true;

        const idPath = encodeURIComponent(videoId);

        // Every installed subtitle addon, plus the stream addon from the hash.
        const bases = new Set<string>(await collectSubtitleAddonBases());
        if (/^https?:\/\/.+\/manifest\.json$/i.test(addonUrl)) {
            bases.add(addonUrl.replace(/\/manifest\.json$/i, ''));
        }

        // Dispatch once, after every addon has resolved, so auto-sync runs against
        // the complete track set rather than whichever addon happened to reply first.
        const results = await Promise.all(Array.from(bases).map((base) => querySubtitleAddon(base, type, idPath)));
        if (results.some(Boolean)) {
            dispatchTracks();
        }
    };

    // Addon-agnostic safety net: observe the actual subtitle download (streaming-
    // server proxy, direct .srt/.vtt, or subs*.strem.io), deduped against
    // reconstructed tracks by normalized source URL.
    const streamingServerProxyPattern = /^https?:\/\/[^/]+\/subtitles\.(srt|vtt)\b/i;
    const directSubtitlePattern = /\.(srt|vtt)\/?(?:[?#].*)?$/i;
    const stremioFilePattern = /^https?:\/\/subs\d+\.strem\.io\/.+\/file\/\d+/i;

    const considerFallbackUrl = (url: string | null | undefined) => {
        if (!url || seenFallbackUrls.has(url)) {
            return;
        }

        const proxyMatch = url.match(streamingServerProxyPattern);
        const directMatch = proxyMatch ? null : url.match(directSubtitlePattern);
        const isStremioFile = !proxyMatch && !directMatch && stremioFilePattern.test(url);
        if (!proxyMatch && !directMatch && !isStremioFile) {
            return;
        }

        seenFallbackUrls.add(url);

        // The proxy wraps the real source in ?from=; dedupe by that, not the proxy URL.
        let sourceUrl = url;
        let extension: string;
        if (proxyMatch) {
            extension = proxyMatch[1].toLowerCase();
            try {
                const from = new URL(url).searchParams.get('from');
                if (from) {
                    sourceUrl = from;
                }
            } catch {
                // treat the proxy URL itself as the source
            }
        } else if (directMatch) {
            extension = directMatch[1].toLowerCase();
        } else {
            extension = 'srt';
        }

        const key = normalizeUrl(sourceUrl);
        if (discoveredSubtitles.has(key)) {
            return;
        }

        const language = languageCodeFromUrl(sourceUrl);
        if (
            addTrack(key, {
                label: language || `Stremio ${fallbackIndex++}`,
                language,
                url,
                extension,
            })
        ) {
            // Live download observed mid-session; surface it immediately.
            dispatchTracks();
        }
    };

    const extractUrl = (input: unknown): string | null => {
        if (typeof input === 'string') {
            return input;
        }
        if (input instanceof URL) {
            return input.href;
        }
        if (input instanceof Request) {
            return input.url;
        }
        return null;
    };

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        considerFallbackUrl(extractUrl(args[0]));
        return originalFetch(...args);
    };

    const originalXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
        considerFallbackUrl(typeof url === 'string' ? url : url instanceof URL ? url.href : null);
        // @ts-expect-error - forwarding original arguments verbatim
        return originalXhrOpen.call(this, method, url, ...rest);
    };

    // Re-resolve on episode navigation; initial run is driven by the request below.
    window.addEventListener('hashchange', () => {
        void reconstructFromHash();
    });

    // Report a loading state as subtitles: undefined (which does NOT consume
    // asbplayer's auto-sync attempt) and resolve to empty only after the timeout.
    let emptyResultTimer: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            void reconstructFromHash();

            if (discoveredSubtitles.size > 0) {
                dispatchTracks();
                return;
            }

            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: {
                        error: '',
                        basename: videoName(),
                        subtitles: undefined,
                    },
                })
            );

            // A single pending timer; repeated requests just reset it.
            if (emptyResultTimer !== undefined) {
                clearTimeout(emptyResultTimer);
            }
            emptyResultTimer = setTimeout(() => {
                emptyResultTimer = undefined;
                if (discoveredSubtitles.size === 0) {
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: videoName(),
                                subtitles: [],
                            },
                        })
                    );
                }
            }, EMPTY_RESULT_TIMEOUT_MS);
        },
        false
    );
});
