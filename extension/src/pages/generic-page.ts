import type { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { parseM3U8, subtitleTrackSegmentsFromM3U8Manifest } from '@project/extension/src/pages/m3u8-util';
import {
    absoluteHttpUrl,
    absoluteSubtitleUrl,
    basenameForVideo,
    bindVideoDataDiscovery,
    deduplicateTracks,
    isJsonContentType,
    nonEmptyString,
    normalizedContentType,
    responseTextWithinLimit,
    subtitleExtensionForUrl,
    tracksFromJson,
} from '@project/extension/src/pages/subtitle-discovery';
import type { JsonDiscovery, VideoDataProvider } from '@project/extension/src/pages/subtitle-discovery';
import { trackFromDef } from '@project/extension/src/pages/util';

const maximumInlineJsonScripts = 5;
const maximumInlineJsonLength = 128_000;
const maximumInlineJsonTotalLength = 256_000;
const maximumSerializedCues = 10_000;
const maximumSerializedCueLength = 1_000_000;
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

    return { tracks, manifestUrls };
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
                    label: language ?? 'Detected subtitle',
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

function boundedM3U8Manifest(manifest: any) {
    if (Array.isArray(manifest?.segments)) {
        return { ...manifest, segments: manifest.segments.slice(0, maximumManifestSegments) };
    }
    return manifest;
}

function boundedSubtitleManifest(manifest: any) {
    const subtitleGroups = manifest?.mediaGroups?.SUBTITLES;
    if (subtitleGroups === null || typeof subtitleGroups !== 'object') return manifest;

    let remaining = maximumManifestSubtitleRenditions;
    const groups: Record<string, Record<string, unknown>> = {};
    for (const [groupId, group] of Object.entries(subtitleGroups)) {
        if (remaining === 0 || group === null || typeof group !== 'object') break;
        const entries = Object.entries(group).slice(0, remaining);
        if (entries.length === 0) continue;
        groups[groupId] = Object.fromEntries(entries);
        remaining -= entries.length;
    }

    return {
        ...manifest,
        mediaGroups: { ...manifest.mediaGroups, SUBTITLES: groups },
    };
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
                boundedSubtitleManifest(loadedManifest.manifest),
                async (subtitleManifestUrl) => fetchBoundedM3U8(subtitleManifestUrl)
            );
        })
    );
    for (const result of results) {
        if (result.status === 'fulfilled') tracks.push(...result.value);
    }
    return tracks;
}

function webVttTimestamp(seconds: number) {
    const totalMilliseconds = Math.round(seconds * 1000);
    const milliseconds = totalMilliseconds % 1000;
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const displaySeconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${displaySeconds
        .toString()
        .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function webVttFromTextTrack(track: TextTrack): string | undefined {
    try {
        if (track.cues === null || track.cues.length === 0 || track.cues.length > maximumSerializedCues) return;

        let text = 'WEBVTT\n\n';
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

            const block = `${webVttTimestamp(cue.startTime)} --> ${webVttTimestamp(cue.endTime)}\n${cueText}\n\n`;
            if (text.length + block.length > maximumSerializedCueLength) return;
            text += block;
        }
        return text === 'WEBVTT\n\n' ? undefined : `${text.trimEnd()}\n`;
    } catch {
        return;
    }
}

export function nativeSubtitleTracks(video: HTMLVideoElement): VideoDataSubtitleTrack[] {
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

            const text = webVttFromTextTrack(textTrack);
            if (text === undefined) continue;
            const language = textTrack.language.trim().toLowerCase() || undefined;
            tracks.push(
                trackFromDef({
                    label: textTrack.label.trim() || language || `Subtitle ${trackElements.length + index + 1}`,
                    language,
                    url: `data:text/vtt;charset=utf-8,${encodeURIComponent(text)}`,
                    extension: 'vtt',
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

export class GenericPageDiscovery implements VideoDataProvider {
    async videoData(video: HTMLVideoElement): Promise<VideoData> {
        const tracks = nativeSubtitleTracks(video);
        const videos = Array.from(document.querySelectorAll('video'));

        // Inline metadata is page-scoped. Use it only when its association with the requested video is unambiguous.
        if (videos.length === 1 && videos[0] === video) {
            tracks.push(...directSubtitleTracksFromPerformance());
            const inlineJson = tracksFromInlineJson();
            tracks.push(...inlineJson.tracks, ...(await tracksFromInlineManifests(inlineJson.manifestUrls)));
        }

        return {
            error: '',
            basename: basenameForVideo(video),
            subtitles: deduplicateTracks(tracks),
        };
    }
}

export function installGenericPageDiscovery(eventTarget: Document = document): () => void {
    const discovery = new GenericPageDiscovery();
    return bindVideoDataDiscovery(discovery, eventTarget);
}
