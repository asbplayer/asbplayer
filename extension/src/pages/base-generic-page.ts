import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { subtitlesToSrt } from '@project/common/subtitle-reader/subtitles-to-srt';
import { asbWarn } from '@project/common/util/log';
import { genericSubtitleDisplayLabel } from '@project/common/util/subtitle-language';
import {
    limitM3U8SubtitleRenditions,
    parseM3U8,
    subtitleTrackSegmentsFromM3U8Manifest,
} from '@project/extension/src/pages/m3u8-util';
import {
    absoluteHttpUrl,
    absoluteSubtitleUrl,
    basenameForVideo,
    bindVideoDataDiscovery,
    deduplicateTracks,
    detectedSubtitleLabel,
    isJsonContentType,
    nonEmptyString,
    normalizedContentType,
    responseTextWithinLimit,
    subtitleExtensionForUrl,
    tracksFromJson,
} from '@project/extension/src/pages/subtitle-discovery';
import type { JsonDiscovery, VideoDataProvider } from '@project/extension/src/pages/subtitle-discovery';
import { nextFlightText, subtitleArraysFromScript } from '@project/extension/src/pages/script-literal';
import { trackFromDef } from '@project/extension/src/pages/util';

export const maximumInlineJsonScripts = 5;
export const maximumInlineJsonLength = 128_000;
const maximumInlineJsonTotalLength = 256_000;
const maximumInlineScripts = 50;
const maximumInlineScriptLength = 512_000;
const maximumInlineScriptTotalLength = 2_000_000;
const inlineScriptSubtitleHint = /caption|subtit|texttrack|tracks|\bcc\b|cc_/i;
export const maximumTextTrackCues = 10_000;
export const maximumTextTrackTextLength = 1_000_000;
export const capturedDuringPlaybackLabelSuffix = ' (captured during playback)';
const maximumInlineManifestUrls = 3;
const maximumManifestSubtitleRenditions = 10;
const maximumManifestSegments = 200;
const maximumManifestLength = 1_000_000;
const manifestFetchTimeoutMs = 3_000;
const maximumPerformanceResourcesToScan = 2_000;
const maximumPerformanceSubtitleTracks = 50;

function tracksFromInlineJson(): JsonDiscovery {
    const tracks: VideoDataSubtitleTrack[] = [];
    const manifestUrls = new Set<string>();
    let totalLength = 0;
    let parsedScripts = 0;

    for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type]'))) {
        const contentType = normalizedContentType(script.type);
        if (contentType === undefined || contentType === 'application/ld+json' || !isJsonContentType(contentType)) {
            continue;
        }

        const text = script.textContent?.trim();
        if (!text || text.length > maximumInlineJsonLength) continue;
        if (parsedScripts >= maximumInlineJsonScripts || totalLength + text.length > maximumInlineJsonTotalLength) {
            break;
        }

        parsedScripts++;
        totalLength += text.length;
        try {
            const discovered = tracksFromJson(JSON.parse(text), document.baseURI);
            tracks.push(...discovered.tracks);
            for (const manifestUrl of discovered.manifestUrls) manifestUrls.add(manifestUrl);
        } catch {
            // Ignore malformed or incomplete embedded JSON.
        }
    }

    return { tracks, manifestUrls, metadataUrls: new Set(), extensionlessTracks: [] };
}

// Inline scripts can still describe the initial video after a client-side navigation.
// Query changes can select a different video; fragment changes usually stay within the same page.
function navigatedAwayFromLoadedPage() {
    try {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation === undefined) return false;
        const loaded = new URL(navigation.name);
        const current = new URL(window.location.href);
        loaded.hash = current.hash = '';
        return loaded.href !== current.href;
    } catch {
        return false;
    }
}

function tracksFromInlineScriptLiterals(): VideoDataSubtitleTrack[] {
    if (navigatedAwayFromLoadedPage()) return [];
    const sources: string[] = [];
    let flight = '';
    let scannedScripts = 0;
    let totalLength = 0;
    for (const script of document.querySelectorAll<HTMLScriptElement>('script:not([src])')) {
        if (scannedScripts++ >= maximumInlineScripts) break;
        const type = normalizedContentType(script.type);
        if (type && type !== 'module' && !type.endsWith('javascript') && !type.endsWith('ecmascript')) continue;

        const text = script.textContent;
        if (!text) continue;
        totalLength += text.length;
        if (totalLength > maximumInlineScriptTotalLength) break;
        if (text.length > maximumInlineScriptLength) {
            // Don't join Flight data across a script whose contents we skipped.
            if (inlineScriptSubtitleHint.test(flight)) sources.push(flight);
            flight = '';
            continue;
        }

        const decoded = text.includes('self.__next_f') ? nextFlightText(text) : undefined;
        if (decoded !== undefined) flight += decoded;
        else if (inlineScriptSubtitleHint.test(text)) sources.push(text);
    }
    // A Flight flush can split the subtitle key itself, not just its array.
    if (inlineScriptSubtitleHint.test(flight)) sources.push(flight);

    const tracks: VideoDataSubtitleTrack[] = [];
    for (const source of sources) {
        for (const value of subtitleArraysFromScript(source)) {
            // The array was found under a subtitle-like key, so its entries are read as subtitle metadata.
            const discovered = tracksFromJson(value, document.baseURI, { contextual: true, rootSubtitleContext: true });
            tracks.push(...discovered.tracks);
        }
    }
    return deduplicateTracks(tracks, enrichTrack);
}

function enrichTrack(
    preferred: VideoDataSubtitleTrack,
    metadata: VideoDataSubtitleTrack,
    source: 'performance' | 'unlabeled-native' | 'other' = 'other'
) {
    const inferred = source === 'performance';
    const language = inferred ? (metadata.language ?? preferred.language) : (preferred.language ?? metadata.language);
    let label = preferred.label;
    const canReplaceNativeLabel =
        source === 'unlabeled-native' &&
        (preferred.language === undefined ||
            metadata.language === undefined ||
            preferred.language === metadata.language);
    if (
        metadata.label !== detectedSubtitleLabel &&
        (inferred || canReplaceNativeLabel || label === detectedSubtitleLabel)
    ) {
        label = metadata.label;
    }
    return label === preferred.label && language === preferred.language
        ? preferred
        : trackFromDef({ ...preferred, label, language });
}

function directSubtitleTracksFromPerformance(): VideoDataSubtitleTrack[] {
    try {
        const entries = performance.getEntriesByType('resource');
        const tracks: VideoDataSubtitleTrack[] = [];
        const start = Math.max(0, entries.length - maximumPerformanceResourcesToScan);
        for (
            let index = entries.length - 1;
            index >= start && tracks.length < maximumPerformanceSubtitleTracks;
            index--
        ) {
            const entry = entries[index] as PerformanceResourceTiming;
            if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') continue;

            const url = absoluteHttpUrl(entry.name, document.baseURI);
            const extension = url === undefined ? undefined : subtitleExtensionForUrl(url);
            if (url === undefined || extension === undefined) continue;
            const language = subtitleLanguageFromUrl(url);

            tracks.push(
                trackFromDef({
                    label: genericSubtitleDisplayLabel(undefined, language, detectedSubtitleLabel),
                    language,
                    url,
                    extension,
                })
            );
        }
        return tracks;
    } catch {
        return [];
    }
}

interface LoadedM3U8Manifest {
    manifest: any;
    url: string;
}

export interface SerializableCue {
    startTime: number;
    endTime: number;
    text: string;
    source?: object;
}

export interface AccumulatedTextTrackCues {
    cues: readonly SerializableCue[];
    capturedOverTime: boolean;
}

export interface TextTrackCueProvider {
    cuesFor(video: HTMLVideoElement, track: TextTrack): AccumulatedTextTrackCues;
}

function boundedM3U8Manifest(manifest: any) {
    if (Array.isArray(manifest?.segments)) {
        return { ...manifest, segments: manifest.segments.slice(0, maximumManifestSegments) };
    }
    return manifest;
}

async function fetchBoundedM3U8(url: string): Promise<LoadedM3U8Manifest> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), manifestFetchTimeoutMs);
    try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HLS manifest request failed with status ${response.status}`);

        const contentLength = Number(response.headers.get('Content-Length'));
        if (Number.isFinite(contentLength) && contentLength > maximumManifestLength) {
            throw new Error('HLS manifest exceeds the capture limit');
        }

        const text = await responseTextWithinLimit(response, maximumManifestLength);
        if (text === undefined) throw new Error('HLS manifest exceeds the capture limit');
        if (!text.trimStart().startsWith('#EXTM3U')) {
            throw new Error('Invalid HLS manifest');
        }

        return {
            manifest: boundedM3U8Manifest(parseM3U8(text)),
            url: response.url || url,
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function tracksFromInlineManifests(manifestUrls: ReadonlySet<string>) {
    const tracks: VideoDataSubtitleTrack[] = [];
    const urls = Array.from(manifestUrls).slice(0, maximumInlineManifestUrls);
    const results = await Promise.allSettled(
        urls.map(async (url) => {
            const loadedManifest = await fetchBoundedM3U8(url);
            return subtitleTrackSegmentsFromM3U8Manifest(
                loadedManifest.url,
                limitM3U8SubtitleRenditions(loadedManifest.manifest, maximumManifestSubtitleRenditions),
                async (subtitleManifestUrl) => fetchBoundedM3U8(subtitleManifestUrl)
            );
        })
    );
    for (const result of results) {
        if (result.status === 'fulfilled') tracks.push(...result.value);
    }
    return tracks;
}

export function cuesFromTextTrack(track: TextTrack): SerializableCue[] {
    try {
        if (track.cues === null || track.cues.length === 0 || track.cues.length > maximumTextTrackCues) return [];

        const cues: SerializableCue[] = [];
        for (const cue of Array.from(track.cues)) {
            const cueText = (cue as VTTCue).text;
            if (
                typeof cueText !== 'string' ||
                !Number.isFinite(cue.startTime) ||
                !Number.isFinite(cue.endTime) ||
                cue.startTime < 0 ||
                cue.endTime < cue.startTime
            ) {
                continue;
            }

            cues.push({ startTime: cue.startTime, endTime: cue.endTime, text: cueText, source: cue });
        }
        return cues;
    } catch {
        return [];
    }
}

function srtFromCues(cues: readonly SerializableCue[]): string | undefined {
    try {
        if (cues.length === 0 || cues.length > maximumTextTrackCues) return;
        let cueTextLength = 0;
        const subtitles = cues.map((cue) => {
            cueTextLength += cue.text.length;
            return { start: cue.startTime * 1000, end: cue.endTime * 1000, text: cue.text };
        });
        if (cueTextLength > maximumTextTrackTextLength) return;
        const text = subtitlesToSrt(subtitles);
        return text.length > maximumTextTrackTextLength ? undefined : text;
    } catch {
        return;
    }
}

export function nativeSubtitleTracks(
    video: HTMLVideoElement,
    cueProvider?: TextTrackCueProvider
): VideoDataSubtitleTrack[] {
    return collectNativeSubtitleTracks(video, cueProvider).tracks;
}

function collectNativeSubtitleTracks(video: HTMLVideoElement, cueProvider?: TextTrackCueProvider) {
    const tracks: VideoDataSubtitleTrack[] = [];
    const unlabeledTracks = new Set<VideoDataSubtitleTrack>();
    const elementTextTracks = new Set<TextTrack>();
    const trackElements = Array.from(video.querySelectorAll('track'));

    for (const [index, element] of trackElements.entries()) {
        const kind = (element.getAttribute('kind') ?? element.kind).toLowerCase();
        if (kind !== 'subtitles' && kind !== 'captions') continue;

        const source = nonEmptyString(element.getAttribute('src'));
        const url = source === undefined ? undefined : absoluteSubtitleUrl(source, document.baseURI);
        if (url === undefined) continue;

        const language = element.getAttribute('srclang')?.trim().toLowerCase() || undefined;
        const label = nonEmptyString(element.getAttribute('label'));
        const track = trackFromDef({
            label: genericSubtitleDisplayLabel(label, language, `Subtitle ${index + 1}`),
            language,
            url,
            // HTML track resources are WebVTT even when served by an extensionless endpoint.
            extension: subtitleExtensionForUrl(url) ?? 'vtt',
        });
        tracks.push(track);
        if (label === undefined) unlabeledTracks.add(track);
        elementTextTracks.add(element.track);
    }

    try {
        for (const [index, textTrack] of Array.from(video.textTracks).entries()) {
            if (elementTextTracks.has(textTrack)) continue;
            const kind = textTrack.kind.toLowerCase();
            if (kind !== 'subtitles' && kind !== 'captions') continue;

            const accumulated = cueProvider?.cuesFor(video, textTrack) ?? {
                cues: cuesFromTextTrack(textTrack),
                capturedOverTime: false,
            };
            const text = srtFromCues(accumulated.cues);
            if (text === undefined) continue;
            const language = textTrack.language.trim().toLowerCase() || undefined;
            tracks.push(
                trackFromDef({
                    label: `${genericSubtitleDisplayLabel(
                        textTrack.label,
                        language,
                        `Subtitle ${trackElements.length + index + 1}`
                    )}${accumulated.capturedOverTime ? capturedDuringPlaybackLabelSuffix : ''}`,
                    language,
                    url: `data:application/x-subrip;charset=utf-8,${encodeURIComponent(text)}`,
                    extension: 'srt',
                    capturedDuringPlayback: accumulated.capturedOverTime || undefined,
                })
            );
        }
    } catch {
        // Some player implementations expose TextTrack objects whose cue lists are not readable.
    }

    return { tracks, unlabeledTracks };
}

function subtitleLanguageFromUrl(url: string) {
    try {
        const pathSegments = new URL(url, document.baseURI).pathname.split('/').filter(Boolean);
        const subtitleDirectoryIndex = pathSegments.findIndex((segment) => /^(?:subtitles?|captions?)$/i.test(segment));
        if (subtitleDirectoryIndex < 0) return;

        const pathName = pathSegments[subtitleDirectoryIndex + 1];
        if (pathName === undefined) return;

        const candidate = decodeURIComponent(pathName)
            .replace(/\.[^.]+$/, '')
            .toLowerCase();
        return /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/.test(candidate) ? candidate : undefined;
    } catch {
        return;
    }
}

export class BaseGenericPageDiscovery implements VideoDataProvider {
    constructor(private readonly cueProvider?: TextTrackCueProvider) {}

    async videoData(video: HTMLVideoElement): Promise<VideoData> {
        const { tracks, unlabeledTracks } = collectNativeSubtitleTracks(video, this.cueProvider);
        const performanceTracks = new Set(directSubtitleTracksFromPerformance());
        tracks.push(...performanceTracks);
        const inlineJson = tracksFromInlineJson();
        tracks.push(...inlineJson.tracks, ...(await tracksFromInlineManifests(inlineJson.manifestUrls)));
        let subtitles = deduplicateTracks(tracks);
        try {
            // Keep the existing resource and position. Use the source to distinguish a generated label
            // from an explicit native label: either can look like "English".
            subtitles = deduplicateTracks(
                [...subtitles, ...tracksFromInlineScriptLiterals()],
                (preferred, metadata) => {
                    if (performanceTracks.has(preferred)) return enrichTrack(preferred, metadata, 'performance');
                    if (unlabeledTracks.has(preferred)) return enrichTrack(preferred, metadata, 'unlabeled-native');
                    return enrichTrack(preferred, metadata);
                }
            );
        } catch (error) {
            asbWarn('subtitle/source', 'Unable to scan inline subtitle metadata', error);
        }

        return {
            error: '',
            basename: basenameForVideo(video),
            subtitles,
        };
    }
}

export function installBaseGenericPageDiscovery(eventTarget: Document = document): () => void {
    const discovery = new BaseGenericPageDiscovery();
    return bindVideoDataDiscovery(discovery, eventTarget);
}
