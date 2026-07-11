import { VideoDataSubtitleTrack } from '@project/common';
import { VideoData } from '@project/common';
import { trackFromDef } from '@/pages/util';
import { v4 as uuidv4 } from 'uuid';

const SUBTITLE_IMAGE_CODECS = ['pgs', 'vobsub']; // Plex will only burn in these subtitles

function generateAlphaNumId(length: number): string {
    const chars = 'abcdefhijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function buildPlexLabel(stream: Element, codec: string | null, isExternal: boolean): string {
    let label = '';
    const title = stream.getAttribute('title');
    if (title) {
        const language = stream.getAttribute('language');
        if (language) {
            if (title.includes(language)) {
                label = title.replace(language, `${language} ·`).replace('(', '').replace(')', ''); // e.g. title=Spanish (Latin America)
            } else {
                label = `${language} · ${title}`; // e.g. title=Canadian, language=French -> French · Canadian
            }
        } else {
            label = (stream.getAttribute('displayTitle') ?? title ?? 'Unknown').replace('SDH', ' · SDH');
        }
    } else {
        label = (stream.getAttribute('displayTitle') ?? 'Unknown').replace('SDH', ' · SDH');
    }
    const location = isExternal ? 'External' : 'Internal';
    label += codec ? ` (${codec.toUpperCase()} ${location})` : ` (${location})`;
    return label;
}

export default defineUnlistedScript(() => {
    let serverUrl: string | undefined;
    let plexToken: string | undefined;
    let ratingKey: string | undefined; // Unique identifier for the video
    let decisionUrl: string | undefined; // URL to get transcoding decision as it's sent too early to hijack (used for internal subs)
    let selectedSubUrl: string | undefined; // URL to transcode selected subtitle (used for internal subs)

    const originalFetch = window.fetch;
    window.fetch = (...args) => {
        for (const arg of args) {
            const url = typeof arg === 'string' ? arg : arg instanceof Request ? arg.url : null;
            if (!url) {
                continue;
            }
            if (!plexToken) {
                const tokenMatch = url.match(/X-Plex-Token=([^&]+)/i);
                if (tokenMatch) {
                    serverUrl = new URL(url).origin;
                    plexToken = tokenMatch[1];
                }
            }
            let ratingKeyMatch = url.match(/library%2Fmetadata%2F(\d+)/i);
            if (ratingKeyMatch) {
                ratingKey = ratingKeyMatch[1];
            }
            ratingKeyMatch = url.match(/ratingKey=(\d+)/i);
            if (ratingKeyMatch) {
                ratingKey = ratingKeyMatch[1];
            }

            // These endpoints are called with the same args. But /decision is sent before we can hijack, even in global scope.
            const selectedSubUrlMatch = url.match(/\/video\/:\/transcode\/universal\/(?:start|subtitles).*?\?/i);
            if (selectedSubUrlMatch) {
                decisionUrl = url.replace(selectedSubUrlMatch[0], '/video/:/transcode/universal/decision?');
                selectedSubUrl = url.replace(selectedSubUrlMatch[0], '/video/:/transcode/universal/subtitles?');
                const subtitlesMatch = selectedSubUrl.match(/&subtitles=(?:[^&]+)/i);
                if (subtitlesMatch) {
                    selectedSubUrl = selectedSubUrl.replace(subtitlesMatch[0], '&subtitles=sidecar');
                } else {
                    selectedSubUrl += '&subtitles=sidecar';
                }
                const advancedSubtitlesMatch = selectedSubUrl.match(/&advancedSubtitles=(?:[^&]+)/i);
                if (advancedSubtitlesMatch) {
                    selectedSubUrl = selectedSubUrl.replace(advancedSubtitlesMatch[0], '&advancedSubtitles=text');
                } else {
                    selectedSubUrl += '&advancedSubtitles=text';
                }
                const directStreamMatch = selectedSubUrl.match(/&directStream=(?:[^&]+)/i);
                if (directStreamMatch) {
                    selectedSubUrl = selectedSubUrl.replace(directStreamMatch[0], '&directStream=1');
                } else {
                    selectedSubUrl += '&directStream=1';
                }
                const protocolMatch = selectedSubUrl.match(/&protocol=(?:[^&]+)/i);
                if (protocolMatch) {
                    selectedSubUrl = selectedSubUrl.replace(protocolMatch[0], '&protocol=http');
                } else {
                    selectedSubUrl += '&protocol=http';
                }
                const session = generateAlphaNumId(24);
                const sessionMatch = selectedSubUrl.match(/&session=(?:[^&]+)/i);
                if (sessionMatch) {
                    selectedSubUrl = selectedSubUrl.replace(sessionMatch[0], `&session=${session}`);
                    decisionUrl = decisionUrl.replace(sessionMatch[0], `&session=${session}`);
                } else {
                    selectedSubUrl += `&session=${session}`;
                    decisionUrl += `&session=${session}`;
                }
                const plexSessionIdentifier = generateAlphaNumId(24);
                const plexSessionIdentifierMatch = url.match(/&X-Plex-Session-Identifier=(?:[^&]+)/i);
                if (plexSessionIdentifierMatch) {
                    selectedSubUrl = selectedSubUrl.replace(
                        plexSessionIdentifierMatch[0],
                        `&X-Plex-Session-Identifier=${plexSessionIdentifier}`
                    );
                    decisionUrl = decisionUrl.replace(
                        plexSessionIdentifierMatch[0],
                        `&X-Plex-Session-Identifier=${plexSessionIdentifier}`
                    );
                } else {
                    selectedSubUrl += `&X-Plex-Session-Identifier=${plexSessionIdentifier}`;
                    decisionUrl += `&X-Plex-Session-Identifier=${plexSessionIdentifier}`;
                }
                const plexSessionId = uuidv4();
                const plexSessionIdMatch = url.match(/&X-Plex-Session-Id=(?:[^&]+)/i);
                if (plexSessionIdMatch) {
                    selectedSubUrl = selectedSubUrl.replace(
                        plexSessionIdMatch[0],
                        `&X-Plex-Session-Id=${plexSessionId}`
                    );
                    decisionUrl = decisionUrl.replace(plexSessionIdMatch[0], `&X-Plex-Session-Id=${plexSessionId}`);
                } else {
                    selectedSubUrl += `&X-Plex-Session-Id=${plexSessionId}`;
                    decisionUrl += `&X-Plex-Session-Id=${plexSessionId}`;
                }
                const plexPlaybackSessionId = uuidv4();
                const plexPlaybackSessionIdMatch = url.match(/&X-Plex-Playback-Session-Id=(?:[^&]+)/i);
                if (plexPlaybackSessionIdMatch) {
                    selectedSubUrl = selectedSubUrl.replace(
                        plexPlaybackSessionIdMatch[0],
                        `&X-Plex-Playback-Session-Id=${plexPlaybackSessionId}`
                    );
                    decisionUrl = decisionUrl.replace(
                        plexPlaybackSessionIdMatch[0],
                        `&X-Plex-Playback-Session-Id=${plexPlaybackSessionId}`
                    );
                } else {
                    selectedSubUrl += `&X-Plex-Playback-Session-Id=${plexPlaybackSessionId}`;
                    decisionUrl += `&X-Plex-Playback-Session-Id=${plexPlaybackSessionId}`;
                }
                const plexPlaybackId = uuidv4();
                const plexPlaybackIdMatch = url.match(/&X-Plex-Playback-Id=(?:[^&]+)/i);
                if (plexPlaybackIdMatch) {
                    selectedSubUrl = selectedSubUrl.replace(
                        plexPlaybackIdMatch[0],
                        `&X-Plex-Playback-Id=${plexPlaybackId}`
                    );
                    decisionUrl = decisionUrl.replace(plexPlaybackIdMatch[0], `&X-Plex-Playback-Id=${plexPlaybackId}`);
                } else {
                    selectedSubUrl += `&X-Plex-Playback-Id=${plexPlaybackId}`;
                    decisionUrl += `&X-Plex-Playback-Id=${plexPlaybackId}`;
                }
            }
        }
        return originalFetch(...args);
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            void (async () => {
                const response: VideoData = { error: '', basename: '', subtitles: [] };
                const miniPlayerWarn =
                    'Automatic detection does not work for Plex if you resume playing your previous session from the mini player. Try stopping the video and hitting play on the media directly.';
                const internalSubWarn =
                    'To use an internal subtitle, it must be selected on Plex. You can unselect it once asbplayer has it loaded after Plex transcodes it in the background which may take a few minutes. Set Plex to the lowest video quality before choosing internal here for a quicker load, 4K or HDR videos will take longer. If an error appears, try stopping the video and waiting a few minutes before refreshing the page.';
                const parser = new DOMParser();

                if (!serverUrl || !plexToken) {
                    response.error = `Could not get the Plex server URL or token. ${miniPlayerWarn}`;
                    return document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: response,
                        })
                    );
                }
                if (!ratingKey) {
                    response.error = `Could not get the ratingKey for the Plex media. ${miniPlayerWarn}`;
                    return document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: response,
                        })
                    );
                }

                const xmlText = await (
                    await fetch(`${serverUrl}/library/metadata/${ratingKey}?X-Plex-Token=${plexToken}`)
                ).text();
                const metadata = parser.parseFromString(xmlText, 'application/xml').querySelector('Video');
                if (!metadata) {
                    response.error = `No metadata found for Plex video. ${miniPlayerWarn}: ${xmlText}`;
                    return document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: response,
                        })
                    );
                }
                const seriesTitle = metadata.getAttribute('grandparentTitle');
                if (seriesTitle) {
                    const seasonNum = metadata.getAttribute('parentIndex');
                    if (seasonNum) {
                        const episodeNum = metadata.getAttribute('index');
                        if (episodeNum) {
                            response.basename = `${seriesTitle} · S${seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}`;
                        }
                    }
                }
                const title = metadata.getAttribute('title');
                if (title) {
                    response.basename = response.basename.length ? `${response.basename} · ${title}` : title;
                    if (metadata.getAttribute('type') === 'movie') {
                        const year = metadata.getAttribute('year');
                        if (year) {
                            response.basename += ` · ${year}`;
                        }
                    }
                } else if (!response.basename.length) {
                    response.basename = 'Unknown';
                }

                let selectedSubId: string | null = null;
                let isBurn = false;
                if (decisionUrl) {
                    const decisionText = await (await fetch(decisionUrl)).text();
                    const decision = parser.parseFromString(decisionText, 'application/xml');
                    const stream = decision.querySelector('Stream[streamType="3"][selected="1"]');
                    if (stream) {
                        selectedSubId = stream.getAttribute('id');
                        isBurn = stream.getAttribute('burn') === '1';
                    }
                }

                const subtitles: VideoDataSubtitleTrack[] = [];
                const parts = metadata.querySelectorAll('Part');
                parts.forEach((part) => {
                    const streams = part.querySelectorAll('Stream[streamType="3"]');
                    streams.forEach((stream) => {
                        const streamKey = stream.getAttribute('key');
                        if (streamKey) {
                            const codec = stream.getAttribute('codec');
                            subtitles.push(
                                trackFromDef({
                                    label: buildPlexLabel(stream, codec, true),
                                    language: stream.getAttribute('languageCode') ?? undefined,
                                    url: `${serverUrl}${streamKey}?X-Plex-Token=${plexToken}`, // Only external can be downloaded directly
                                    extension: codec ?? '',
                                })
                            );
                            return;
                        }
                        if (!response.error) {
                            response.error = internalSubWarn; // Always display if internal subs are present
                        }
                        if (stream.getAttribute('selected') !== '1') return; // Internal subtitles must be selected in Plex

                        if (selectedSubId && stream.getAttribute('id') !== selectedSubId) {
                            return; // Multiple versions of the media, each has its own selected audio/subtitle
                        }
                        if (!selectedSubUrl) {
                            response.error = `Could not get transcoding url for internal subtitle. ${internalSubWarn}`;
                            return;
                        }
                        const codec = stream.getAttribute('codec');
                        if (codec && SUBTITLE_IMAGE_CODECS.includes(codec)) {
                            response.error = `${codec.toUpperCase()} subtitles are not supported, Plex always burns in image formats. ${internalSubWarn}`;
                            return;
                        }
                        if (isBurn) {
                            response.error = `Plex is burning in the selected subtitle, set "Only image formats" for Plex Settings > Player > Burn Subtitles. ${internalSubWarn}`;
                            return;
                        }
                        subtitles.push(
                            trackFromDef({
                                label: buildPlexLabel(stream, codec, false),
                                language: stream.getAttribute('languageCode') ?? undefined,
                                url: selectedSubUrl,
                                extension: 'ass', // Plex always transcode to ass it seems
                            })
                        );
                    });
                });
                subtitles.sort((a, b) => a.label.localeCompare(b.label));
                response.subtitles = subtitles;

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response,
                    })
                );
            })().catch((e) => {
                const error = e instanceof Error ? e.message : String(e);
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: { error },
                    })
                );
            });
        },
        false
    );
});
