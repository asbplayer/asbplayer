import type { VideoData, VideoDataSubtitleTrack, VideoDataSubtitleTrackDef } from '@project/common';
import { extractExtension, normalizeSubtitleExtension, trackFromDef } from '@project/extension/src/pages/util';

export interface VideoDataProvider {
    videoData(video: HTMLVideoElement, reset?: boolean): Promise<VideoData>;
}

type JsonRecord = Record<string, unknown>;

const maximumJsonObjects = 100;
const maximumJsonDepth = 4;
const manifestUrlFields = new Set(['hls', 'hlsurl', 'm3u8', 'm3u8url', 'manifesturl', 'playlisturl']);
const subtitleContainerKeys = new Set([
    'caption',
    'captions',
    'subtitle',
    'subtitles',
    'subtitleset',
    'subtitletracks',
    'texttracks',
    'tracks',
]);

export const subtitleExtensionsByContentType: Readonly<Record<string, string>> = {
    'application/dfxp+xml': 'dfxp',
    'application/subrip': 'srt',
    'application/srt': 'srt',
    'application/ttaf+xml': 'ttml2',
    'application/ttml+xml': 'ttml2',
    'application/vtt': 'vtt',
    'application/webvtt': 'vtt',
    'application/x-ass': 'ass',
    'application/x-ssa': 'ass',
    'application/x-subrip': 'srt',
    'text/ass': 'ass',
    'text/ssa': 'ass',
    'text/subrip': 'srt',
    'text/srt': 'srt',
    'text/vtt': 'vtt',
    'text/webvtt': 'vtt',
    'text/x-ass': 'ass',
    'text/x-srt': 'srt',
    'text/x-ssa': 'ass',
};

export function normalizedContentType(contentType: unknown) {
    return typeof contentType === 'string' ? contentType.split(';', 1)[0].trim().toLowerCase() : undefined;
}

export function isJsonContentType(contentType: unknown) {
    const normalized = normalizedContentType(contentType);
    return normalized === 'application/json' || normalized?.endsWith('+json') === true;
}

export function subtitleExtensionForUrl(url: string) {
    return normalizeSubtitleExtension(extractExtension(url, ''));
}

export function absoluteSubtitleUrl(url: string, baseUrl: string = document.baseURI): string | undefined {
    try {
        const parsed = new URL(url, baseUrl);
        return ['http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol) ? parsed.href : undefined;
    } catch {
        return;
    }
}

export function absoluteHttpUrl(url: string, baseUrl: string): string | undefined {
    try {
        const parsed = new URL(url, baseUrl);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined;
    } catch {
        return;
    }
}

export function nonEmptyString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

interface TrackDefinitionOptions {
    strict: boolean;
    subtitleContext: boolean;
    inheritedContentType?: string;
    inheritedLanguage?: string;
}

function normalizedMetadataKey(key: string) {
    const localName = key.slice(key.lastIndexOf(':') + 1);
    return localName.replace(/^[@#]/, '').toLowerCase();
}

function metadataString(value: JsonRecord, keys: readonly string[]) {
    for (const expectedKey of keys) {
        for (const [key, candidate] of Object.entries(value)) {
            if (normalizedMetadataKey(key) !== expectedKey) continue;
            const stringValue = nonEmptyString(candidate);
            if (stringValue !== undefined) return stringValue;
        }
    }
    return;
}

function subtitleContentType(value: JsonRecord) {
    const contentType = normalizedContentType(metadataString(value, ['mimetype', 'contenttype', 'type']));
    return subtitleExtensionsByContentType[contentType ?? ''] === undefined ? undefined : contentType;
}

function metadataLanguage(value: JsonRecord) {
    return metadataString(value, ['srclang', 'language', 'lang', 'locale'])?.toLowerCase();
}

function subtitleReferenceUrl(key: string, value: string, baseUrl: string) {
    const normalizedKey = normalizedMetadataKey(key);
    if (!/(?:caption|subtit|timedtext|texttrack|transcript)/.test(normalizedKey)) return;
    if (!/(?:endpoint|href|ref|uri|url)$/.test(normalizedKey)) return;
    if (!/^(?:https?:)?\/\/|^\.{0,2}\//i.test(value)) return;
    return absoluteHttpUrl(value, baseUrl);
}

function trackDefinitionFromMetadata(
    value: JsonRecord,
    baseUrl: string,
    { strict, subtitleContext, inheritedContentType, inheritedLanguage }: TrackDefinitionOptions
): VideoDataSubtitleTrackDef | undefined {
    const kind = metadataString(value, ['kind'])?.toLowerCase();
    const semanticType = metadataString(value, ['type'])?.toLowerCase();
    const declaredKind =
        kind ?? (semanticType === 'subtitles' || semanticType === 'captions' ? semanticType : undefined);
    const declaredContentType = normalizedContentType(metadataString(value, ['mimetype', 'contenttype', 'type']));
    const declaredContentTypeExtension = subtitleExtensionsByContentType[declaredContentType ?? ''];
    const contentTypeExtension =
        declaredContentTypeExtension ?? subtitleExtensionsByContentType[inheritedContentType ?? ''];

    // Explicit non-subtitle kinds win over a subtitle-looking URL or MIME type.
    if (declaredKind !== undefined && declaredKind !== 'subtitles' && declaredKind !== 'captions') return;
    if (!subtitleContext && declaredKind === undefined && contentTypeExtension === undefined) return;
    if (strict && declaredContentType?.includes('/') === true && declaredContentTypeExtension === undefined) return;

    const source = metadataString(value, ['src', 'file', 'url', 'source', 'text']);
    if (source === undefined) return;

    const url = absoluteSubtitleUrl(source, baseUrl);
    if (url === undefined) return;

    const format = metadataString(value, ['format']);
    const formatExtension = format === undefined ? undefined : normalizeSubtitleExtension(format.replace(/^\./, ''));
    if (strict && format !== undefined && formatExtension === undefined) return;
    const extension = formatExtension ?? contentTypeExtension ?? subtitleExtensionForUrl(url);
    if (extension === undefined) return;

    const normalizedLanguage = metadataLanguage(value) ?? inheritedLanguage;
    const label = metadataString(value, ['label', 'name']) ?? normalizedLanguage ?? 'Detected subtitle';

    return { label, language: normalizedLanguage, url, extension };
}

export interface JsonDiscovery {
    tracks: VideoDataSubtitleTrack[];
    manifestUrls: Set<string>;
    metadataUrls: Set<string>;
    extensionlessTracks: ExtensionlessSubtitleTrack[];
}

export interface ExtensionlessSubtitleTrack {
    label: string;
    language?: string;
    url: string;
}

export interface JsonDiscoveryOptions {
    contextual?: boolean;
    maximumDepth?: number;
    maximumObjects?: number;
    rootSubtitleContext?: boolean;
}

function manifestUrlFromJson(value: JsonRecord, baseUrl: string): string | undefined {
    for (const [key, source] of Object.entries(value)) {
        if (!manifestUrlFields.has(key.toLowerCase()) || typeof source !== 'string') continue;
        const url = absoluteHttpUrl(source, baseUrl);
        if (url !== undefined && extractExtension(url, '').toLowerCase() === 'm3u8') return url;
    }
    return;
}

export function tracksFromJson(value: unknown, baseUrl: string, options: JsonDiscoveryOptions = {}): JsonDiscovery {
    if (value === null || typeof value !== 'object') {
        return { tracks: [], manifestUrls: new Set(), metadataUrls: new Set(), extensionlessTracks: [] };
    }

    const contextual = options.contextual === true;
    const depthLimit = options.maximumDepth ?? maximumJsonDepth;
    const objectLimit = options.maximumObjects ?? maximumJsonObjects;
    const tracks: VideoDataSubtitleTrack[] = [];
    const manifestUrls = new Set<string>();
    const metadataUrls = new Set<string>();
    const extensionlessTracks: ExtensionlessSubtitleTrack[] = [];
    const queue: Array<{
        value: object;
        depth: number;
        subtitleContext: boolean;
        inheritedContentType?: string;
        inheritedLanguage?: string;
    }> = [{ value, depth: 0, subtitleContext: contextual && options.rootSubtitleContext === true }];
    let next = 0;
    let visited = 0;

    while (next < queue.length && visited < objectLimit) {
        const current = queue[next++];
        visited++;

        try {
            const record = current.value as JsonRecord;
            const inheritedContentType = subtitleContentType(record) ?? current.inheritedContentType;
            const inheritedLanguage = metadataLanguage(record) ?? current.inheritedLanguage;
            const manifestUrl = manifestUrlFromJson(record, baseUrl);
            if (manifestUrl !== undefined) manifestUrls.add(manifestUrl);

            const definition = trackDefinitionFromMetadata(record, baseUrl, {
                strict: !contextual,
                subtitleContext: current.subtitleContext,
                inheritedContentType,
                inheritedLanguage,
            });
            if (definition !== undefined) tracks.push(trackFromDef(definition));
            else if (contextual && current.subtitleContext) {
                const kind = metadataString(record, ['kind'])?.toLowerCase();
                const declaredType = normalizedContentType(metadataString(record, ['mimetype', 'contenttype', 'type']));
                const hasExplicitSubtitleMetadata = Object.keys(record).some((key) => {
                    const normalizedKey = normalizedMetadataKey(key);
                    return (
                        /(?:caption|subtit|timedtext|texttrack|transcript)/.test(normalizedKey) &&
                        /(?:code|format|id|kind|label|lang|language|locale|name|position|source|src|type|uri|url)/.test(
                            normalizedKey
                        )
                    );
                });
                const source = metadataString(record, ['src', 'file', 'url', 'source', 'text']);
                const url = source === undefined ? undefined : absoluteHttpUrl(source, baseUrl);
                if (
                    hasExplicitSubtitleMetadata &&
                    (kind === undefined || kind === 'subtitles' || kind === 'captions') &&
                    (declaredType === undefined ||
                        !declaredType.includes('/') ||
                        subtitleExtensionsByContentType[declaredType] !== undefined) &&
                    url !== undefined &&
                    extractExtension(url, '') === '' &&
                    !extensionlessTracks.some((track) => track.url === url)
                ) {
                    const language = metadataLanguage(record) ?? inheritedLanguage;
                    const label = metadataString(record, ['label', 'name']) ?? language ?? 'Detected subtitle';
                    extensionlessTracks.push({ label, language, url });
                }
            }

            if (current.depth >= depthLimit) continue;
            for (const [key, child] of Object.entries(current.value)) {
                const subtitleContext =
                    current.subtitleContext || (contextual && subtitleContainerKeys.has(normalizedMetadataKey(key)));
                if (child !== null && typeof child === 'object') {
                    queue.push({
                        value: child,
                        depth: current.depth + 1,
                        subtitleContext,
                        inheritedContentType,
                        inheritedLanguage,
                    });
                } else if (contextual && typeof child === 'string') {
                    const referenceUrl = subtitleReferenceUrl(key, child, baseUrl);
                    const referenceExtension =
                        referenceUrl === undefined ? undefined : subtitleExtensionForUrl(referenceUrl);
                    if (referenceUrl !== undefined && referenceExtension === undefined) metadataUrls.add(referenceUrl);
                    else if (referenceUrl !== undefined && referenceExtension !== undefined) {
                        tracks.push(
                            trackFromDef({
                                label: inheritedLanguage ?? normalizedMetadataKey(key),
                                url: referenceUrl,
                                extension: referenceExtension,
                            })
                        );
                    }
                    if (definition !== undefined || !subtitleContext) continue;
                    const url = absoluteSubtitleUrl(child, baseUrl);
                    const extension = url === undefined ? undefined : subtitleExtensionForUrl(url);
                    if (url !== undefined && extension !== undefined) {
                        tracks.push(trackFromDef({ label: key || 'Detected subtitle', url, extension }));
                    }
                }
            }
        } catch {
            // A single malformed metadata object should not prevent other tracks from being found.
        }
    }

    return { tracks, manifestUrls, metadataUrls, extensionlessTracks };
}

export async function responseTextWithinLimit(response: Response, maximumLength: number, timeoutMs?: number) {
    const timeout = Symbol('timeout');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise =
        timeoutMs === undefined
            ? undefined
            : new Promise<typeof timeout>((resolve) => {
                  timeoutId = setTimeout(() => resolve(timeout), timeoutMs);
              });

    if (response.body === null || response.body === undefined) {
        try {
            const result =
                timeoutPromise === undefined
                    ? await response.text()
                    : await Promise.race([response.text(), timeoutPromise]);
            return result !== timeout && result.length <= maximumLength ? result : undefined;
        } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
        }
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const result =
                timeoutPromise === undefined
                    ? await reader.read()
                    : await Promise.race([reader.read(), timeoutPromise]);
            if (result === timeout) {
                await reader.cancel().catch(() => undefined);
                return;
            }
            const { done, value } = result;
            if (done) break;
            if (value === undefined) continue;
            length += value.byteLength;
            if (length > maximumLength) {
                await reader.cancel();
                return;
            }
            chunks.push(value);
        }
    } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        reader.releaseLock();
    }

    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
}

function trackResourceKey(track: VideoDataSubtitleTrack) {
    return Array.isArray(track.url) ? track.url.join('|') : track.url;
}

export function deduplicateTracks(tracks: readonly VideoDataSubtitleTrack[]) {
    const byResource = new Map<string, VideoDataSubtitleTrack>();
    for (const track of tracks) {
        const key = trackResourceKey(track);
        if (key !== undefined && !byResource.has(key)) byResource.set(key, track);
    }
    return Array.from(byResource.values());
}

export function basenameForVideo(video: HTMLVideoElement) {
    const mediaSessionTitle = navigator.mediaSession?.metadata?.title?.trim();
    if (mediaSessionTitle) return mediaSessionTitle;

    const videoTitle = video.getAttribute('title')?.trim() || video.getAttribute('aria-label')?.trim();
    if (videoTitle) return videoTitle;

    const openGraphTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim();
    return openGraphTitle || document.title;
}

export function bindVideoDataDiscovery(discovery: VideoDataProvider, eventTarget: Document = document): () => void {
    const requestGenerations = new WeakMap<HTMLVideoElement, number>();
    const listener = (event: Event) => {
        const video = event.composedPath().find((target) => target instanceof HTMLVideoElement);
        if (video === undefined) return;

        const requestPage = window.location.href;
        const generation = (requestGenerations.get(video) ?? 0) + 1;
        requestGenerations.set(video, generation);
        void discovery
            .videoData(video)
            .catch(() => ({ error: '', basename: document.title, subtitles: [] }))
            .then((data) => {
                if (requestGenerations.get(video) !== generation || window.location.href !== requestPage) return;
                video.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: data }));
            });
    };
    eventTarget.addEventListener('asbplayer-get-synced-data', listener, true);
    return () => eventTarget.removeEventListener('asbplayer-get-synced-data', listener, true);
}
