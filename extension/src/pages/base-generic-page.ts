import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { subtitlesToSrt } from '@project/common/subtitle-reader/subtitles-to-srt';
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
import { trackFromDef } from '@project/extension/src/pages/util';

export const maximumInlineJsonScripts = 5;
export const maximumInlineJsonLength = 128_000;
const maximumInlineJsonTotalLength = 256_000;
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
                    label: language ?? detectedSubtitleLabel,
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
    const tracks: VideoDataSubtitleTrack[] = [];
    const elementTextTracks = new Set<TextTrack>();
    const trackElements = Array.from(video.querySelectorAll('track'));

    for (const [index, element] of trackElements.entries()) {
        const kind = (element.getAttribute('kind') ?? element.kind).toLowerCase();
        if (kind !== 'subtitles' && kind !== 'captions') continue;

        const source = nonEmptyString(element.getAttribute('src'));
        const url = source === undefined ? undefined : absoluteSubtitleUrl(source, document.baseURI);
        if (url === undefined) continue;

        const language = element.getAttribute('srclang')?.trim().toLowerCase() || undefined;
        tracks.push(
            trackFromDef({
                label: element.getAttribute('label')?.trim() || language || `Subtitle ${index + 1}`,
                language,
                url,
                // HTML track resources are WebVTT even when served by an extensionless endpoint.
                extension: subtitleExtensionForUrl(url) ?? 'vtt',
            })
        );
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
                    label: `${textTrack.label.trim() || language || `Subtitle ${trackElements.length + index + 1}`}${
                        accumulated.capturedOverTime ? capturedDuringPlaybackLabelSuffix : ''
                    }`,
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

    return tracks;
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
        const tracks = nativeSubtitleTracks(video, this.cueProvider);
        tracks.push(...directSubtitleTracksFromPerformance());
        const inlineJson = tracksFromInlineJson();
        tracks.push(...inlineJson.tracks, ...(await tracksFromInlineManifests(inlineJson.manifestUrls)));

        return {
            error: '',
            basename: basenameForVideo(video),
            subtitles: deduplicateTracks(tracks),
        };
    }
}

export function installBaseGenericPageDiscovery(eventTarget: Document = document): () => void {
    const discovery = new BaseGenericPageDiscovery();
    return bindVideoDataDiscovery(discovery, eventTarget);
}
