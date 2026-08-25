import type { VideoData, VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { BaseGenericPageDiscovery } from '@project/extension/src/pages/base-generic-page';
import type {
    ExtensionlessSubtitleTrack,
    JsonDiscovery,
    VideoDataProvider,
} from '@project/extension/src/pages/subtitle-discovery';
import {
    absoluteSubtitleUrl,
    bindVideoDataDiscovery,
    deduplicateTracks,
    isJsonContentType,
    normalizedContentType,
    responseTextWithinLimit,
    subtitleExtensionForUrl,
    subtitleExtensionsByContentType,
    tracksFromJson,
} from '@project/extension/src/pages/subtitle-discovery';
import { parseM3U8, subtitleTrackSegmentsFromM3U8Manifest } from '@project/extension/src/pages/m3u8-util';
import type { MpdTrackMetadata, Playlist } from '@project/extension/src/pages/mpd-util';
import { subtitleTracksFromMpdManifest } from '@project/extension/src/pages/mpd-util';
import { extractExtension, trackFromDef } from '@project/extension/src/pages/util';

type ResourceKind = 'hls' | 'dash' | 'subtitle' | 'json';

interface ResourceRecord {
    url: string;
    page: string;
    observedAt: number;
    kind?: ResourceKind;
    contentType?: string;
    body?: Promise<string | undefined>;
}

const maximumCapturedBodyLength = 5_000_000;
const maximumRecords = 100;
const maximumJsonObjects = 500;
const maximumJsonDepth = 12;
const maximumMetadataBodyLength = 1_000_000;
const maximumMetadataReferences = 4;
const responseObservationTimeoutMs = 500;
const resourceFetchTimeoutMs = 3_000;
const recentResourceWindowMs = 30_000;
const aggressiveJsonDiscoveryOptions = {
    contextual: true,
    maximumDepth: maximumJsonDepth,
    maximumObjects: maximumJsonObjects,
} as const;

function pageIdentity() {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function likelySubtitleUrl(url: string) {
    try {
        const parsed = new URL(url, document.baseURI);
        return /(?:caption|subtit|timedtext|texttrack|transcript|\bsubs?\b)/i.test(
            `${parsed.pathname} ${parsed.searchParams.toString()}`
        );
    } catch {
        return false;
    }
}

function jsonDiscoveryOptions(url: string) {
    return { ...aggressiveJsonDiscoveryOptions, rootSubtitleContext: likelySubtitleUrl(url) } as const;
}

function subtitleExtensionFromText(text: string) {
    const sample = text
        .slice(0, 16_384)
        .replace(/^\uFEFF/, '')
        .trimStart();
    if (/^WEBVTT(?:\s|$)/i.test(sample)) return 'vtt';
    if (/^\[Script Info\][\s\S]*^\[Events\]/im.test(sample)) return 'ass';
    if (/^(?:\d+\s*\r?\n)?\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{1,2}:\d{2}:\d{2}[,.]\d{3}/m.test(sample)) {
        return 'srt';
    }
    if (/<(?:[\w.-]+:)?tt\b[^>]*\bxmlns(?::[\w.-]+)?=["'][^"']*(?:ttml|ttaf)[^"']*["']/i.test(sample)) {
        return 'ttml2';
    }
    return;
}

function kindFromResource(url: string, contentType?: string | null, text?: string): ResourceKind | undefined {
    const normalizedType = normalizedContentType(contentType);
    const extension = extractExtension(url, '').toLowerCase();
    if (isJsonContentType(normalizedType)) return 'json';
    if (
        extension === 'm3u8' ||
        normalizedType === 'application/vnd.apple.mpegurl' ||
        normalizedType === 'application/x-mpegurl' ||
        text?.trimStart().startsWith('#EXTM3U')
    ) {
        return 'hls';
    }
    if (
        extension === 'mpd' ||
        normalizedType === 'application/dash+xml' ||
        (text !== undefined && /<MPD\b[^>]*xmlns=["']urn:mpeg:dash:schema:mpd:/i.test(text.slice(0, 16_384)))
    ) {
        return 'dash';
    }
    if (
        subtitleExtensionsByContentType[normalizedType ?? ''] !== undefined ||
        subtitleExtensionForUrl(url) !== undefined
    ) {
        return 'subtitle';
    }
    return text !== undefined && subtitleExtensionFromText(text) !== undefined ? 'subtitle' : undefined;
}

function requestUrl(input: RequestInfo | URL) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return;
}

function dashTrack(
    playlist: Playlist,
    language: string,
    metadata?: MpdTrackMetadata
): VideoDataSubtitleTrackDef | undefined {
    const urls = playlist.segments
        ?.map((segment) => segment.resolvedUri)
        .filter((url): url is string => typeof url === 'string');
    const fallbackUrl = typeof playlist.resolvedUri === 'string' ? playlist.resolvedUri : undefined;
    const url = urls?.length ? urls : fallbackUrl;
    if (url === undefined) return;
    const firstUrl = Array.isArray(url) ? url[0] : url;
    const extension =
        subtitleExtensionForUrl(firstUrl) ??
        (metadata?.mimeType?.includes('ttml') === true ? 'ttml2' : undefined) ??
        (metadata?.mimeType?.includes('vtt') === true ? 'vtt' : undefined);
    if (extension === undefined) return;
    return { label: language || 'Detected subtitle', language: language || undefined, url, extension };
}

function standaloneHlsTrack(manifestUrl: string, manifest: any): VideoDataSubtitleTrack | undefined {
    if (!Array.isArray(manifest?.segments) || manifest.segments.length === 0) return;
    const urls: string[] = (manifest.segments as any[])
        .flatMap((segment: any) =>
            typeof segment?.uri === 'string' ? [absoluteSubtitleUrl(segment.uri, manifestUrl)] : []
        )
        .filter((url: string | undefined): url is string => url !== undefined);
    if (urls.length === 0) return;
    const extensions = new Set<string>(
        urls.map(subtitleExtensionForUrl).filter((value): value is string => value !== undefined)
    );
    if (extensions.size !== 1) return;
    const extension: string | undefined = extensions.values().next().value;
    return extension === undefined ? undefined : trackFromDef({ label: 'Detected subtitle', url: urls, extension });
}

export class AggressiveGenericPageDiscovery implements VideoDataProvider {
    private readonly baseDiscovery = new BaseGenericPageDiscovery();
    private readonly records: ResourceRecord[] = [];
    private readonly parsedJson: Array<{
        tracks: VideoDataSubtitleTrack[];
        metadataUrls: string[];
        extensionlessTracks: ExtensionlessSubtitleTrack[];
        page: string;
        observedAt: number;
    }> = [];
    private readonly pending = new Set<Promise<unknown>>();
    private originalFetch?: typeof window.fetch;

    install(): () => void {
        const cleanup: Array<() => void> = [];
        let active = true;
        const originalFetch = window.fetch;
        this.originalFetch = originalFetch;
        const interceptedFetch: typeof window.fetch = (...args) => {
            const requestedUrl = requestUrl(args[0]);
            const requestPage = pageIdentity();
            const responsePromise = originalFetch.apply(window, args);
            if (requestedUrl !== undefined) {
                this.rememberPending(
                    responsePromise.then((response) =>
                        this.observeResponse(response.clone(), absoluteSubtitleUrl(requestedUrl), requestPage)
                    )
                );
            }
            return responsePromise;
        };
        window.fetch = interceptedFetch;
        cleanup.push(() => {
            if (window.fetch === interceptedFetch) window.fetch = originalFetch;
        });

        const requestUrls = new WeakMap<XMLHttpRequest, { url: string; page: string }>();
        const originalOpen = window.XMLHttpRequest.prototype.open;
        const observe = this.observe.bind(this);
        const rememberPending = this.rememberPending.bind(this);
        const interceptedOpen = function (this: XMLHttpRequest, ...args: unknown[]) {
            const url = typeof args[1] === 'string' ? absoluteSubtitleUrl(args[1]) : undefined;
            if (url !== undefined) {
                requestUrls.set(this, { url, page: pageIdentity() });
                this.addEventListener(
                    'loadend',
                    () => {
                        if (!active) return;
                        const request = requestUrls.get(this);
                        if (
                            request === undefined ||
                            !((this.status >= 200 && this.status < 300) || this.status === 304)
                        ) {
                            return;
                        }
                        const contentType = this.getResponseHeader('Content-Type');
                        if (
                            kindFromResource(request.url, contentType) === undefined &&
                            !likelySubtitleUrl(request.url)
                        ) {
                            return;
                        }
                        let text: string | undefined;
                        try {
                            if (this.responseType === '' || this.responseType === 'text') text = this.responseText;
                            else if (this.responseType === 'json') text = JSON.stringify(this.response);
                            else if (
                                this.responseType === 'arraybuffer' &&
                                this.response?.byteLength <= maximumCapturedBodyLength
                            ) {
                                text = new TextDecoder().decode(this.response);
                            } else if (
                                this.responseType === 'blob' &&
                                this.response?.size <= maximumCapturedBodyLength
                            ) {
                                rememberPending(
                                    this.response.text().then((blobText: string) => {
                                        observe(request.url, request.page, contentType ?? undefined, blobText);
                                    })
                                );
                            }
                        } catch {
                            return;
                        }
                        if (text !== undefined && text.length <= maximumCapturedBodyLength) {
                            observe(request.url, request.page, contentType ?? undefined, text);
                        }
                    },
                    { once: true }
                );
            }
            // @ts-expect-error Forward the browser's overloaded XHR arguments.
            return originalOpen.apply(this, args);
        };
        window.XMLHttpRequest.prototype.open = interceptedOpen;
        cleanup.push(() => {
            if (window.XMLHttpRequest.prototype.open === interceptedOpen) {
                window.XMLHttpRequest.prototype.open = originalOpen;
            }
        });

        const originalParse = JSON.parse;
        const interceptedParse: typeof JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
            const value = originalParse(...args);
            if (active && value !== null && typeof value === 'object') {
                this.rememberJson(value, pageIdentity(), document.baseURI);
            }
            return value;
        };
        JSON.parse = interceptedParse;
        cleanup.push(() => {
            if (JSON.parse === interceptedParse) JSON.parse = originalParse;
        });

        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType !== 'resource') continue;
                        const url = absoluteSubtitleUrl(entry.name);
                        if (url !== undefined) this.observe(url, pageIdentity());
                    }
                });
                observer.observe({ type: 'resource', buffered: true });
                cleanup.push(() => observer.disconnect());
            } catch {
                // PerformanceObserver resource buffering is not supported in every browser.
            }
        }

        if (typeof performance.getEntriesByType === 'function') {
            for (const entry of performance.getEntriesByType('resource')) {
                const url = absoluteSubtitleUrl(entry.name);
                if (url !== undefined) this.observe(url, pageIdentity());
            }
        }

        return () => {
            if (!active) return;
            active = false;
            for (const uninstall of cleanup.reverse()) uninstall();
        };
    }

    async videoData(video: HTMLVideoElement): Promise<VideoData> {
        await this.settlePending();
        const base = await this.baseDiscovery.videoData(video);
        const page = pageIdentity();
        const tracks = [...(base.subtitles ?? [])];
        const metadataUrls = new Set<string>();
        const extensionlessTracks = new Map<string, ExtensionlessSubtitleTrack>();

        for (const snapshot of this.parsedJson.filter((snapshot) => snapshot.page === page)) {
            tracks.push(...snapshot.tracks);
            for (const url of snapshot.metadataUrls) metadataUrls.add(url);
            for (const track of snapshot.extensionlessTracks) extensionlessTracks.set(track.url, track);
        }

        const pageRecords = this.records.filter((record) => record.page === page);
        const newest = Math.max(...pageRecords.map((record) => record.observedAt), 0);
        const directRecords: Array<{ record: ResourceRecord; text?: string }> = [];
        const hlsSegmentUrls = new Set<string>();
        for (const record of pageRecords.filter((record) => newest - record.observedAt <= recentResourceWindowMs)) {
            let text: string | undefined;
            try {
                if (record.body !== undefined || record.kind !== 'subtitle') {
                    text = await this.resourceText(record);
                }
            } catch {
                continue;
            }
            const kind = kindFromResource(record.url, record.contentType, text) ?? record.kind;
            if (kind === 'json' && text !== undefined) {
                try {
                    const value = JSON.parse(text);
                    const discovery = tracksFromJson(value, record.url, jsonDiscoveryOptions(record.url));
                    tracks.push(...discovery.tracks);
                    for (const url of discovery.metadataUrls) metadataUrls.add(url);
                    for (const track of discovery.extensionlessTracks) extensionlessTracks.set(track.url, track);
                } catch {
                    // Ignore malformed JSON metadata.
                }
            } else if (kind === 'hls' && text !== undefined) {
                try {
                    const manifest = parseM3U8(text);
                    const manifestTracks = await subtitleTrackSegmentsFromM3U8Manifest(
                        record.url,
                        manifest,
                        async (url) => {
                            const matching = pageRecords.find((candidate) => candidate.url === url);
                            const subtitleText =
                                matching === undefined ? await this.fetchText(url) : await this.resourceText(matching);
                            if (subtitleText === undefined) throw new Error('Unable to load HLS subtitle manifest');
                            const subtitleManifest = parseM3U8(subtitleText);
                            for (const segment of subtitleManifest.segments ?? []) {
                                if (typeof segment?.uri !== 'string') continue;
                                const segmentUrl = absoluteSubtitleUrl(segment.uri, url);
                                if (segmentUrl !== undefined) hlsSegmentUrls.add(segmentUrl);
                            }
                            return { manifest: subtitleManifest, url };
                        }
                    );
                    tracks.push(...manifestTracks);
                    if (manifestTracks.length === 0) {
                        const standaloneTrack = standaloneHlsTrack(record.url, manifest);
                        if (standaloneTrack !== undefined) {
                            tracks.push(standaloneTrack);
                            const urls = Array.isArray(standaloneTrack.url)
                                ? standaloneTrack.url
                                : [standaloneTrack.url];
                            for (const url of urls) if (url !== undefined) hlsSegmentUrls.add(url);
                        }
                    }
                } catch {
                    // A speculative manifest should not prevent other candidates from being tried.
                }
            } else if (kind === 'dash' && text !== undefined) {
                try {
                    tracks.push(...subtitleTracksFromMpdManifest(record.url, text, dashTrack));
                } catch {
                    // Ignore malformed or unsupported DASH manifests.
                }
            } else if (kind === 'subtitle') {
                directRecords.push({ record, text });
            }
        }

        let speculativeRequests = 0;
        for (const url of Array.from(metadataUrls).slice(0, maximumMetadataReferences)) {
            speculativeRequests++;
            try {
                const matching = pageRecords.find((record) => record.url === url);
                const text =
                    matching === undefined
                        ? await this.fetchText(url, maximumMetadataBodyLength)
                        : await this.resourceText(matching);
                if (text === undefined) continue;
                const value = JSON.parse(text);
                if (matching === undefined) this.observe(url, page, 'application/json', text);
                const discovery = tracksFromJson(value, url, jsonDiscoveryOptions(url));
                tracks.push(...discovery.tracks);
            } catch {
                // Ignore unavailable or malformed speculative subtitle metadata.
            }
        }

        for (const candidate of Array.from(extensionlessTracks.values()).slice(
            0,
            maximumMetadataReferences - speculativeRequests
        )) {
            try {
                const matching = pageRecords.find((record) => record.url === candidate.url);
                const text =
                    matching === undefined
                        ? await this.fetchText(candidate.url, maximumMetadataBodyLength)
                        : await this.resourceText(matching);
                if (text === undefined) continue;
                const extension =
                    subtitleExtensionsByContentType[normalizedContentType(matching?.contentType) ?? ''] ??
                    subtitleExtensionFromText(text);
                if (extension !== undefined) {
                    if (matching === undefined) this.observe(candidate.url, page, undefined, text);
                    tracks.push(trackFromDef({ ...candidate, extension }));
                }
            } catch {
                // Ignore unavailable or unsupported speculative subtitle resources.
            }
        }

        for (const { record, text } of directRecords) {
            if (hlsSegmentUrls.has(record.url)) continue;
            const extension =
                subtitleExtensionsByContentType[normalizedContentType(record.contentType) ?? ''] ??
                subtitleExtensionForUrl(record.url) ??
                (text === undefined ? undefined : subtitleExtensionFromText(text));
            if (extension !== undefined) {
                tracks.push(trackFromDef({ label: 'Detected subtitle', url: record.url, extension }));
            }
        }

        return { error: '', basename: base.basename, subtitles: deduplicateTracks(tracks) };
    }

    private observeResponse(response: Response, requestedUrl: string | undefined, page: string) {
        const url = response.url || requestedUrl;
        if (url === undefined || (!response.ok && response.status !== 304)) return;
        const contentType = response.headers.get('Content-Type') ?? undefined;
        if (kindFromResource(url, contentType) === undefined && !likelySubtitleUrl(url)) return;
        const body = responseTextWithinLimit(response, maximumCapturedBodyLength, responseObservationTimeoutMs).catch(
            () => undefined
        );
        this.observe(url, page, contentType, undefined, body);
        return body.then((text) => {
            if (text !== undefined && isJsonContentType(contentType)) {
                try {
                    this.rememberJson(JSON.parse(text), page, url);
                } catch {
                    // Ignore malformed JSON responses.
                }
            }
        });
    }

    private observe(
        url: string,
        page: string,
        contentType?: string,
        text?: string,
        body?: Promise<string | undefined>
    ) {
        const kind = kindFromResource(url, contentType, text);
        if (kind === undefined && body === undefined) return;
        const existing = this.records.find((record) => record.url === url && record.page === page);
        if (existing !== undefined) {
            existing.observedAt = Date.now();
            existing.kind = kind ?? existing.kind;
            existing.contentType = contentType ?? existing.contentType;
            existing.body = body ?? (text === undefined ? existing.body : Promise.resolve(text));
            return;
        }
        this.records.push({
            url,
            page,
            observedAt: Date.now(),
            kind,
            contentType,
            body: body ?? (text === undefined ? undefined : Promise.resolve(text)),
        });
        if (this.records.length > maximumRecords) this.records.splice(0, this.records.length - maximumRecords);
    }

    private rememberJson(value: unknown, page: string, baseUrl: string) {
        const discovery: JsonDiscovery = tracksFromJson(value, baseUrl, jsonDiscoveryOptions(baseUrl));
        const tracks = deduplicateTracks(discovery.tracks);
        const metadataUrls = Array.from(discovery.metadataUrls);
        const extensionlessTracks = discovery.extensionlessTracks;
        if (tracks.length === 0 && metadataUrls.length === 0 && extensionlessTracks.length === 0) return;
        this.parsedJson.push({ tracks, metadataUrls, extensionlessTracks, page, observedAt: Date.now() });
        if (this.parsedJson.length > 20) this.parsedJson.shift();
    }

    private rememberPending(promise: Promise<unknown>) {
        const pending = Promise.race([
            promise,
            new Promise<void>((resolve) => setTimeout(resolve, responseObservationTimeoutMs)),
        ])
            .catch(() => undefined)
            .finally(() => this.pending.delete(pending));
        this.pending.add(pending);
    }

    private async settlePending() {
        await Promise.allSettled(Array.from(this.pending));
    }

    private async resourceText(record: ResourceRecord) {
        return record.body === undefined ? this.fetchText(record.url) : record.body;
    }

    private async fetchText(url: string, maximumLength = maximumCapturedBodyLength) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), resourceFetchTimeoutMs);
        try {
            const response = await (this.originalFetch ?? window.fetch)(url, {
                cache: 'no-store',
                signal: controller.signal,
            });
            if (!response.ok && response.status !== 304) return;
            return await responseTextWithinLimit(response, maximumLength);
        } finally {
            clearTimeout(timeout);
        }
    }
}

export function installAggressiveGenericPageDiscovery(eventTarget: Document = document): () => void {
    const discovery = new AggressiveGenericPageDiscovery();
    const uninstallDiscovery = discovery.install();
    const unbind = bindVideoDataDiscovery(discovery, eventTarget);
    return () => {
        unbind();
        uninstallDiscovery();
    };
}
