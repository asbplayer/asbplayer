import type { VideoData, VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import {
    BaseGenericPageDiscovery,
    cuesFromTextTrack,
    maximumInlineJsonLength,
    maximumInlineJsonScripts,
    maximumTextTrackCues,
    maximumTextTrackTextLength,
} from '@project/extension/src/pages/base-generic-page';
import type {
    AccumulatedTextTrackCues,
    SerializableCue,
    TextTrackCueProvider,
} from '@project/extension/src/pages/base-generic-page';
import type {
    ExtensionlessSubtitleTrack,
    JsonDiscovery,
    VideoDataProvider,
} from '@project/extension/src/pages/subtitle-discovery';
import {
    absoluteSubtitleUrl,
    bindVideoDataDiscovery,
    deduplicateTracks,
    detectedSubtitleLabel,
    hasSubtitleMetadataHint,
    isJsonContentType,
    normalizedContentType,
    responseTextWithinLimit,
    subtitleExtensionForUrl,
    subtitleExtensionsByContentType,
    tracksFromJson,
} from '@project/extension/src/pages/subtitle-discovery';
import {
    limitM3U8SubtitleRenditions,
    parseM3U8,
    subtitleTrackSegmentsFromM3U8Manifest,
} from '@project/extension/src/pages/m3u8-util';
import type { MpdTrackMetadata, Playlist } from '@project/extension/src/pages/mpd-util';
import { subtitleTracksFromMpdManifest } from '@project/extension/src/pages/mpd-util';
import { extractExtension, trackFromDef } from '@project/extension/src/pages/util';

const maximumTrackedVideos = 20;
const maximumTrackedTextTracks = 50;
const cueCaptureIntervalMs = 1_000;

interface AccumulatedCue {
    cue: SerializableCue;
    globalKey: string;
}

interface TextTrackState {
    id: number;
    track: TextTrack;
    cues: Map<string, AccumulatedCue>;
    cueKeys: WeakMap<object, string>;
    capturedOverTime: boolean;
    initialized: boolean;
    uninstall: () => void;
}

interface VideoTrackState {
    tracks: Set<TextTrack>;
    uninstall: () => void;
    lastCaptureAt: number;
}

class AggressiveTextTrackCueAccumulator implements TextTrackCueProvider {
    private readonly videos = new Map<HTMLVideoElement, VideoTrackState>();
    private readonly tracks = new Map<TextTrack, TextTrackState>();
    private readonly cueOrder = new Map<string, { state: TextTrackState; cueKey: string }>();
    private page = window.location.href;
    private nextTrackId = 0;
    private totalCueTextLength = 0;
    private installed = false;

    install(eventTarget: Document = document) {
        if (this.installed) return () => undefined;
        this.installed = true;
        const mediaListener = (event: Event) => {
            if (!(event.target instanceof HTMLVideoElement)) return;
            this.observeVideo(event.target);
            this.captureVideo(event.target, event.type !== 'timeupdate');
        };
        for (const eventName of ['loadedmetadata', 'play', 'timeupdate']) {
            eventTarget.addEventListener(eventName, mediaListener, true);
        }
        for (const video of Array.from(eventTarget.querySelectorAll('video'))) this.observeVideo(video);

        return () => {
            if (!this.installed) return;
            this.installed = false;
            for (const eventName of ['loadedmetadata', 'play', 'timeupdate']) {
                eventTarget.removeEventListener(eventName, mediaListener, true);
            }
            for (const video of Array.from(this.videos.keys())) this.removeVideo(video);
            this.clearCues();
        };
    }

    cuesFor(video: HTMLVideoElement, track: TextTrack): AccumulatedTextTrackCues {
        this.ensurePage();
        if (this.installed) this.observeVideo(video);
        const state = this.tracks.get(track);
        if (state === undefined) {
            return { cues: cuesFromTextTrack(track), capturedOverTime: false };
        }
        this.captureTrack(state);
        return {
            cues: Array.from(state.cues.values(), ({ cue }) => cue).sort(
                (left, right) => left.startTime - right.startTime || left.endTime - right.endTime
            ),
            capturedOverTime: state.capturedOverTime,
        };
    }

    private ensurePage() {
        if (this.page === window.location.href) return;
        this.page = window.location.href;
        this.clearCues();
    }

    private observeVideo(video: HTMLVideoElement) {
        this.ensurePage();
        if (this.videos.has(video)) return;
        while (this.videos.size >= maximumTrackedVideos) {
            const oldest = this.videos.keys().next().value;
            if (oldest === undefined) break;
            this.removeVideo(oldest);
        }

        let textTracks: TextTrackList;
        try {
            textTracks = video.textTracks;
        } catch {
            return;
        }
        const state: VideoTrackState = {
            tracks: new Set(),
            lastCaptureAt: 0,
            uninstall: () => undefined,
        };
        const addTrackListener = (event: Event) => {
            const track = (event as TrackEvent).track;
            if (track !== null) this.observeTrack(state, track);
        };
        if (typeof textTracks.addEventListener === 'function') {
            textTracks.addEventListener('addtrack', addTrackListener);
            state.uninstall = () => textTracks.removeEventListener('addtrack', addTrackListener);
        }
        this.videos.set(video, state);
        try {
            for (const track of Array.from(textTracks)) this.observeTrack(state, track);
        } catch {
            // Some player implementations expose non-iterable or unreadable track lists.
        }
    }

    private observeTrack(videoState: VideoTrackState, track: TextTrack) {
        if (videoState.tracks.has(track) || this.tracks.has(track)) return;
        const kind = track.kind.toLowerCase();
        if (kind !== 'subtitles' && kind !== 'captions') return;
        if (this.tracks.size >= maximumTrackedTextTracks) return;

        const state: TextTrackState = {
            id: this.nextTrackId++,
            track,
            cues: new Map(),
            cueKeys: new WeakMap(),
            capturedOverTime: false,
            initialized: false,
            uninstall: () => undefined,
        };
        const cueListener = () => this.captureTrack(state);
        if (typeof track.addEventListener === 'function') {
            track.addEventListener('cuechange', cueListener);
            state.uninstall = () => track.removeEventListener('cuechange', cueListener);
        }
        videoState.tracks.add(track);
        this.tracks.set(track, state);
        this.captureTrack(state);
    }

    private captureVideo(video: HTMLVideoElement, force: boolean) {
        this.ensurePage();
        const state = this.videos.get(video);
        if (state === undefined) return;
        const now = Date.now();
        if (!force && now - state.lastCaptureAt < cueCaptureIntervalMs) return;
        state.lastCaptureAt = now;
        for (const track of state.tracks) {
            const trackState = this.tracks.get(track);
            if (trackState !== undefined) this.captureTrack(trackState);
        }
    }

    private captureTrack(state: TextTrackState) {
        const cues = cuesFromTextTrack(state.track);
        let added = false;
        for (const cue of cues) {
            const cueKey = `${cue.startTime}\u0000${cue.endTime}\u0000${cue.text}`;
            const cueObject = cue.source;
            const previousKey = cueObject === undefined ? undefined : state.cueKeys.get(cueObject);
            if (previousKey !== undefined && previousKey !== cueKey) this.removeCue(state, previousKey);
            if (cueObject !== undefined) state.cueKeys.set(cueObject, cueKey);
            if (state.cues.has(cueKey) || cue.text.length > maximumTextTrackTextLength) continue;

            const globalKey = `${state.id}:${cueKey}`;
            state.cues.set(cueKey, { cue, globalKey });
            this.cueOrder.set(globalKey, { state, cueKey });
            this.totalCueTextLength += cue.text.length;
            added = true;
            this.enforceBounds();
        }
        if (state.initialized && added) state.capturedOverTime = true;
        state.initialized = true;
    }

    private enforceBounds() {
        while (this.cueOrder.size > maximumTextTrackCues || this.totalCueTextLength > maximumTextTrackTextLength) {
            const oldest = this.cueOrder.entries().next().value;
            if (oldest === undefined) return;
            const [globalKey, { state, cueKey }] = oldest;
            this.cueOrder.delete(globalKey);
            const accumulated = state.cues.get(cueKey);
            if (accumulated === undefined) continue;
            state.cues.delete(cueKey);
            this.totalCueTextLength -= accumulated.cue.text.length;
        }
    }

    private removeCue(state: TextTrackState, cueKey: string) {
        const accumulated = state.cues.get(cueKey);
        if (accumulated === undefined) return;
        state.cues.delete(cueKey);
        this.cueOrder.delete(accumulated.globalKey);
        this.totalCueTextLength -= accumulated.cue.text.length;
    }

    private removeVideo(video: HTMLVideoElement) {
        const videoState = this.videos.get(video);
        if (videoState === undefined) return;
        videoState.uninstall();
        for (const track of videoState.tracks) {
            const trackState = this.tracks.get(track);
            if (trackState === undefined) continue;
            trackState.uninstall();
            for (const cueKey of Array.from(trackState.cues.keys())) this.removeCue(trackState, cueKey);
            this.tracks.delete(track);
        }
        this.videos.delete(video);
    }

    private clearCues() {
        this.cueOrder.clear();
        this.totalCueTextLength = 0;
        for (const state of this.tracks.values()) {
            state.cues.clear();
            state.cueKeys = new WeakMap();
            state.capturedOverTime = false;
            state.initialized = false;
        }
    }
}

type ResourceKind = 'hls' | 'dash' | 'subtitle' | 'json';

interface ResourceRecord {
    url: string;
    page: string;
    observedAt: number;
    kind?: ResourceKind;
    contentType?: string;
    body?: Promise<string | undefined>;
}

interface TrackCandidate {
    track: VideoDataSubtitleTrack;
    score: number;
    order: number;
}

const maximumCapturedBodyLength = 5_000_000;
const maximumRecords = 100;
const maximumJsonObjects = 500;
const maximumJsonDepth = 12;
const maximumHintedJsonLength = 512_000;
const maximumHintedJsonObjects = 2_000;
const maximumMetadataBodyLength = 1_000_000;
const maximumMetadataReferences = 4;
const maximumRuntimeJsonManifestUrls = 3;
const maximumManifestSubtitleRenditions = 10;
const maximumManifestChildUrls = 2_000;
const responseObservationTimeoutMs = 500;
const resourceFetchTimeoutMs = 3_000;
const recentResourceWindowMs = 30_000;
const trackCandidateScore = {
    accumulatedTextTrack: 100,
    unverifiedResource: 150,
    inspectedResource: 200,
    segmentedTrack: 300,
    currentTextTrack: 325,
    detectedResource: 340,
    nativeTrack: 350,
    metadataTrack: 400,
    verifiedExtensionlessTrack: 500,
} as const;
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
            `${parsed.hostname} ${parsed.pathname} ${parsed.searchParams.toString()}`
        );
    } catch {
        return false;
    }
}

function jsonDiscoveryOptions(url: string) {
    return { ...aggressiveJsonDiscoveryOptions, rootSubtitleContext: likelySubtitleUrl(url) } as const;
}

function hintedInlineJson() {
    let candidate: { text: string; priority: number } | undefined;
    let jsonScriptIndex = 0;
    for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type]'))) {
        const contentType = normalizedContentType(script.type);
        if (contentType === undefined || contentType === 'application/ld+json' || !isJsonContentType(contentType)) {
            continue;
        }

        const text = script.textContent?.trim();
        if (!text) continue;
        const priority = text.length > maximumInlineJsonLength || jsonScriptIndex >= maximumInlineJsonScripts ? 1 : 0;
        jsonScriptIndex++;
        if (
            text.length > maximumHintedJsonLength ||
            !hasSubtitleMetadataHint(text) ||
            (candidate !== undefined &&
                (candidate.priority > priority ||
                    (candidate.priority === priority && candidate.text.length >= text.length)))
        ) {
            continue;
        }
        candidate = { text, priority };
    }
    return candidate?.text;
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

function isStoryboardVtt(text: string) {
    const sample = text
        .slice(0, 65_536)
        .replace(/^\uFEFF/, '')
        .trimStart();
    if (!/^WEBVTT(?:\s|$)/i.test(sample)) return false;

    const cueBlocks = sample.split(/\r?\n\s*\r?\n/).slice(1, 65);
    let cues = 0;
    let imageCues = 0;
    for (const block of cueBlocks) {
        const lines = block
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const timingLine = lines.findIndex((line) => line.includes('-->'));
        if (timingLine < 0) continue;
        const payload = lines.slice(timingLine + 1).join(' ');
        if (!payload) continue;
        cues++;
        if (/(?:^|\s)(?:https?:\/\/|\.{0,2}\/)?\S+\.(?:avif|gif|jpe?g|png|webp)(?:\?\S*)?#xywh=/i.test(payload)) {
            imageCues++;
        }
    }

    return cues >= 2 && imageCues / cues >= 0.8;
}

function looksLikeJson(text: string) {
    const sample = text.trimStart();
    return sample.startsWith('{') || /^\[\s*(?:\]|[{"\d\-tfn])/.test(sample);
}

function looksLikeHtml(text: string) {
    return /^(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(text.trimStart().slice(0, 16_384));
}

function looksLikeEncodedPayload(text: string) {
    const compact = text.trim().replace(/\s+/g, '');
    return compact.length >= 64 && /^[a-z\d+/]+={0,2}$/i.test(compact);
}

function kindFromResource(url: string, contentType?: string | null, text?: string): ResourceKind | undefined {
    const normalizedType = normalizedContentType(contentType);
    const extension = extractExtension(url, '').toLowerCase();
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
    if (text !== undefined) {
        if (subtitleExtensionFromText(text) !== undefined) return 'subtitle';
        if (looksLikeJson(text)) return 'json';
    }
    if (isJsonContentType(normalizedType)) return 'json';
    if (
        subtitleExtensionsByContentType[normalizedType ?? ''] !== undefined ||
        subtitleExtensionForUrl(url) !== undefined
    ) {
        return 'subtitle';
    }
    return;
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
    return { label: language || detectedSubtitleLabel, language: language || undefined, url, extension };
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
    return extension === undefined ? undefined : trackFromDef({ label: detectedSubtitleLabel, url: urls, extension });
}

function baseTrackScore(track: VideoDataSubtitleTrack) {
    if (Array.isArray(track.url)) return trackCandidateScore.segmentedTrack;
    if (track.capturedDuringPlayback === true) return trackCandidateScore.accumulatedTextTrack;
    if (track.url?.startsWith('data:') === true) return trackCandidateScore.currentTextTrack;
    return trackCandidateScore.nativeTrack;
}

function directResourceTrackScore(detectedExtension: string | undefined, text: string | undefined) {
    if (detectedExtension !== undefined) return trackCandidateScore.detectedResource;
    return text === undefined ? trackCandidateScore.unverifiedResource : trackCandidateScore.inspectedResource;
}

export class AggressiveGenericPageDiscovery implements VideoDataProvider {
    private readonly cueAccumulator = new AggressiveTextTrackCueAccumulator();
    private readonly baseDiscovery = new BaseGenericPageDiscovery(this.cueAccumulator);
    private readonly records: ResourceRecord[] = [];
    private readonly parsedJson: Array<{
        tracks: VideoDataSubtitleTrack[];
        manifestUrls: string[];
        metadataUrls: string[];
        extensionlessTracks: ExtensionlessSubtitleTrack[];
        page: string;
        observedAt: number;
    }> = [];
    private readonly pending = new Set<Promise<unknown>>();
    private readonly manifestChildUrls = new Set<string>();
    private readonly rejectedResourceUrls = new Set<string>();
    private statePage?: string;
    private originalFetch?: typeof window.fetch;
    private originalJsonParse?: typeof JSON.parse;
    private hintedInlineJson?: { page: string; discovery: JsonDiscovery };

    install(): () => void {
        const cleanup: Array<() => void> = [];
        let active = true;
        cleanup.push(this.cueAccumulator.install());
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
        const shouldObserveResource = this.shouldObserveResource.bind(this);
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
                        if (!shouldObserveResource(request.url, contentType, request.page)) return;
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
        this.originalJsonParse = originalParse;
        const interceptedParse: typeof JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
            const value = originalParse(...args);
            if (active && value !== null && typeof value === 'object') {
                const text = args[0];
                const hinted = text.length <= maximumHintedJsonLength && hasSubtitleMetadataHint(text);
                this.rememberJson(value, pageIdentity(), document.baseURI, hinted);
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
        this.preparePageState(page);
        const candidates: TrackCandidate[] = [];
        const addTracks = (tracks: readonly VideoDataSubtitleTrack[], score: number) => {
            for (const track of tracks) candidates.push({ track, score, order: candidates.length });
        };
        for (const track of base.subtitles ?? []) {
            candidates.push({ track, score: baseTrackScore(track), order: candidates.length });
        }
        const metadataUrls = new Set<string>();
        const runtimeJsonManifestUrls = new Set<string>();
        const extensionlessTracks = new Map<string, ExtensionlessSubtitleTrack>();

        const inlineJson = this.discoveryFromHintedInlineJson(page);
        if (inlineJson !== undefined) {
            addTracks(inlineJson.tracks, trackCandidateScore.metadataTrack);
            for (const url of inlineJson.manifestUrls) this.observe(url, page);
            for (const url of inlineJson.metadataUrls) metadataUrls.add(url);
            for (const track of inlineJson.extensionlessTracks) extensionlessTracks.set(track.url, track);
        }

        const pageJsonSnapshots = this.parsedJson.filter((snapshot) => snapshot.page === page);
        for (const snapshot of pageJsonSnapshots) {
            addTracks(snapshot.tracks, trackCandidateScore.metadataTrack);
            for (const url of snapshot.metadataUrls) metadataUrls.add(url);
            for (const track of snapshot.extensionlessTracks) extensionlessTracks.set(track.url, track);
        }
        for (let index = pageJsonSnapshots.length - 1; index >= 0; index--) {
            for (const url of pageJsonSnapshots[index].manifestUrls) runtimeJsonManifestUrls.add(url);
        }

        const pageRecords = this.records.filter((record) => record.page === page);
        const newest = Math.max(...pageRecords.map((record) => record.observedAt), 0);
        const directRecords: Array<{ record: ResourceRecord; text?: string }> = [];
        const processedHlsManifestUrls = new Set<string>();
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
                if (record.kind === 'subtitle') this.rememberRejectedResource(record.url);
                try {
                    const value = (this.originalJsonParse ?? JSON.parse)(text);
                    const discovery = tracksFromJson(value, record.url, jsonDiscoveryOptions(record.url));
                    addTracks(discovery.tracks, trackCandidateScore.metadataTrack);
                    for (const url of discovery.manifestUrls) runtimeJsonManifestUrls.add(url);
                    for (const url of discovery.metadataUrls) metadataUrls.add(url);
                    for (const track of discovery.extensionlessTracks) extensionlessTracks.set(track.url, track);
                } catch {
                    // Ignore malformed JSON metadata.
                }
            } else if (kind === 'hls' && text !== undefined) {
                try {
                    processedHlsManifestUrls.add(record.url);
                    addTracks(
                        await this.tracksFromHlsManifest(record.url, text, pageRecords),
                        trackCandidateScore.segmentedTrack
                    );
                } catch {
                    // A speculative manifest should not prevent other candidates from being tried.
                }
            } else if (kind === 'dash' && text !== undefined) {
                try {
                    addTracks(
                        subtitleTracksFromMpdManifest(record.url, text, (playlist, language, metadata) => {
                            for (const segment of playlist.segments ?? []) {
                                if (typeof segment.resolvedUri === 'string') {
                                    this.rememberManifestChild(segment.resolvedUri);
                                }
                            }
                            return dashTrack(playlist, language, metadata);
                        }),
                        trackCandidateScore.segmentedTrack
                    );
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
                const value = (this.originalJsonParse ?? JSON.parse)(text);
                if (matching === undefined) this.observe(url, page, 'application/json', text);
                const discovery = tracksFromJson(value, url, jsonDiscoveryOptions(url));
                addTracks(discovery.tracks, trackCandidateScore.metadataTrack);
                for (const manifestUrl of discovery.manifestUrls) runtimeJsonManifestUrls.add(manifestUrl);
            } catch {
                // Ignore unavailable or malformed speculative subtitle metadata.
            }
        }

        for (const url of Array.from(runtimeJsonManifestUrls).slice(0, maximumRuntimeJsonManifestUrls)) {
            if (processedHlsManifestUrls.has(url)) continue;
            try {
                const matching = pageRecords.find((record) => record.url === url);
                const resource =
                    matching === undefined
                        ? await this.fetchTextResource(url)
                        : { text: await this.resourceText(matching), url: matching.url };
                if (resource?.text !== undefined) {
                    addTracks(
                        await this.tracksFromHlsManifest(resource.url, resource.text, pageRecords),
                        trackCandidateScore.segmentedTrack
                    );
                }
            } catch {
                // Ignore unavailable speculative manifests.
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
                if (!text.trim() || looksLikeHtml(text) || looksLikeEncodedPayload(text)) continue;
                const extension =
                    subtitleExtensionFromText(text) ??
                    subtitleExtensionsByContentType[normalizedContentType(matching?.contentType) ?? ''];
                if (extension !== undefined && !(extension === 'vtt' && isStoryboardVtt(text))) {
                    this.rejectedResourceUrls.delete(candidate.url);
                    if (matching === undefined) this.observe(candidate.url, page, undefined, text);
                    addTracks(
                        [trackFromDef({ ...candidate, extension })],
                        trackCandidateScore.verifiedExtensionlessTrack
                    );
                } else if (extension === 'vtt') {
                    this.rememberRejectedResource(candidate.url);
                }
            } catch {
                // Ignore unavailable or unsupported speculative subtitle resources.
            }
        }

        for (const { record, text } of directRecords) {
            if (this.manifestChildUrls.has(record.url)) continue;
            if (text !== undefined) {
                if (!text.trim() || looksLikeHtml(text) || looksLikeEncodedPayload(text)) {
                    this.rememberRejectedResource(record.url);
                    continue;
                }
            }
            const detectedExtension = text === undefined ? undefined : subtitleExtensionFromText(text);
            if (detectedExtension === 'vtt' && text !== undefined && isStoryboardVtt(text)) {
                this.rememberRejectedResource(record.url);
                continue;
            }
            const extension =
                detectedExtension ??
                subtitleExtensionsByContentType[normalizedContentType(record.contentType) ?? ''] ??
                subtitleExtensionForUrl(record.url) ??
                undefined;
            if (extension !== undefined) {
                this.rejectedResourceUrls.delete(record.url);
                addTracks(
                    [trackFromDef({ label: detectedSubtitleLabel, url: record.url, extension })],
                    directResourceTrackScore(detectedExtension, text)
                );
            }
        }

        const rankedTracks = candidates
            .filter(({ track }) => {
                if (Array.isArray(track.url)) return true;
                return (
                    track.url !== undefined &&
                    !this.rejectedResourceUrls.has(track.url) &&
                    !this.manifestChildUrls.has(track.url)
                );
            })
            .sort((left, right) => right.score - left.score || left.order - right.order)
            .map(({ track }) => track);
        return { error: '', basename: base.basename, subtitles: deduplicateTracks(rankedTracks) };
    }

    private async tracksFromHlsManifest(
        manifestUrl: string,
        text: string,
        pageRecords: readonly ResourceRecord[]
    ): Promise<VideoDataSubtitleTrack[]> {
        const manifest = limitM3U8SubtitleRenditions(parseM3U8(text), maximumManifestSubtitleRenditions);
        const tracks = await subtitleTrackSegmentsFromM3U8Manifest(
            manifestUrl,
            manifest,
            async (subtitleManifestUrl) => {
                const matching = pageRecords.find((candidate) => candidate.url === subtitleManifestUrl);
                const resource =
                    matching === undefined
                        ? await this.fetchTextResource(subtitleManifestUrl)
                        : { text: await this.resourceText(matching), url: matching.url };
                if (resource?.text === undefined) throw new Error('Unable to load HLS subtitle manifest');
                const subtitleManifest = parseM3U8(resource.text);
                for (const segment of subtitleManifest.segments ?? []) {
                    if (typeof segment?.uri !== 'string') continue;
                    const segmentUrl = absoluteSubtitleUrl(segment.uri, resource.url);
                    if (segmentUrl !== undefined) this.rememberManifestChild(segmentUrl);
                }
                return { manifest: subtitleManifest, url: resource.url };
            }
        );
        if (tracks.length > 0) return tracks;

        const standaloneTrack = standaloneHlsTrack(manifestUrl, manifest);
        if (standaloneTrack === undefined) return [];
        const urls = Array.isArray(standaloneTrack.url) ? standaloneTrack.url : [standaloneTrack.url];
        for (const url of urls) if (url !== undefined) this.rememberManifestChild(url);
        return [standaloneTrack];
    }

    private observeResponse(response: Response, requestedUrl: string | undefined, page: string) {
        const url = response.url || requestedUrl;
        if (url === undefined || (!response.ok && response.status !== 304)) return;
        const contentType = response.headers.get('Content-Type') ?? undefined;
        if (!this.shouldObserveResource(url, contentType, page)) return;
        const body = responseTextWithinLimit(response, maximumCapturedBodyLength, responseObservationTimeoutMs).catch(
            () => undefined
        );
        this.observe(url, page, contentType, undefined, body);
        return body.then((text) => {
            if (text !== undefined && isJsonContentType(contentType)) {
                try {
                    this.rememberJson((this.originalJsonParse ?? JSON.parse)(text), page, url);
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

    private rememberJson(value: unknown, page: string, baseUrl: string, hinted = false) {
        const discovery: JsonDiscovery = tracksFromJson(value, baseUrl, {
            ...jsonDiscoveryOptions(baseUrl),
            maximumObjects: hinted ? maximumHintedJsonObjects : maximumJsonObjects,
        });
        const tracks = deduplicateTracks(discovery.tracks);
        const manifestUrls = Array.from(discovery.manifestUrls);
        const metadataUrls = Array.from(discovery.metadataUrls);
        const extensionlessTracks = discovery.extensionlessTracks;
        if (
            tracks.length === 0 &&
            manifestUrls.length === 0 &&
            metadataUrls.length === 0 &&
            extensionlessTracks.length === 0
        ) {
            return;
        }
        this.parsedJson.push({ tracks, manifestUrls, metadataUrls, extensionlessTracks, page, observedAt: Date.now() });
        if (this.parsedJson.length > 20) this.parsedJson.shift();
    }

    private discoveryFromHintedInlineJson(page: string) {
        if (this.hintedInlineJson?.page === page) return this.hintedInlineJson.discovery;
        const text = hintedInlineJson();
        if (text === undefined) return;
        try {
            const discovery = tracksFromJson((this.originalJsonParse ?? JSON.parse)(text), document.baseURI, {
                ...jsonDiscoveryOptions(document.baseURI),
                maximumObjects: maximumHintedJsonObjects,
            });
            this.hintedInlineJson = { page, discovery };
            return discovery;
        } catch {
            return;
        }
    }

    private shouldObserveResource(url: string, contentType: string | null | undefined, page: string) {
        if (kindFromResource(url, contentType) !== undefined || likelySubtitleUrl(url)) return true;
        return this.parsedJson.some(
            (snapshot) =>
                snapshot.page === page &&
                (snapshot.metadataUrls.includes(url) ||
                    snapshot.extensionlessTracks.some((track) => track.url === url) ||
                    snapshot.tracks.some((track) =>
                        Array.isArray(track.url) ? track.url.includes(url) : track.url === url
                    ))
        );
    }

    private preparePageState(page: string) {
        if (this.statePage === page) return;
        this.statePage = page;
        this.manifestChildUrls.clear();
        this.rejectedResourceUrls.clear();
    }

    private rememberManifestChild(url: string) {
        if (this.manifestChildUrls.has(url)) return;
        this.manifestChildUrls.add(url);
        if (this.manifestChildUrls.size <= maximumManifestChildUrls) return;
        const oldest = this.manifestChildUrls.values().next().value;
        if (oldest !== undefined) this.manifestChildUrls.delete(oldest);
    }

    private rememberRejectedResource(url: string) {
        if (this.rejectedResourceUrls.has(url)) return;
        this.rejectedResourceUrls.add(url);
        if (this.rejectedResourceUrls.size <= maximumRecords) return;
        const oldest = this.rejectedResourceUrls.values().next().value;
        if (oldest !== undefined) this.rejectedResourceUrls.delete(oldest);
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
        return (await this.fetchTextResource(url, maximumLength))?.text;
    }

    private async fetchTextResource(url: string, maximumLength = maximumCapturedBodyLength) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), resourceFetchTimeoutMs);
        try {
            const response = await (this.originalFetch ?? window.fetch)(url, {
                cache: 'no-store',
                signal: controller.signal,
            });
            if (!response.ok && response.status !== 304) return;
            const text = await responseTextWithinLimit(response, maximumLength);
            return text === undefined ? undefined : { text, url: response.url || url };
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
