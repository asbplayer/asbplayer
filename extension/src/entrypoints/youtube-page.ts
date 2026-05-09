import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { poll, trackFromDef, trackId } from '@/pages/util';
import { decodePoToken, fetchPlayerContextForPage } from '@/services/youtube';

declare global {
    interface Window {
        ytcfg: any;
    }
}

const inferVideoId = () => {
    const pathname = window.location.pathname;

    if (pathname) {
        const pathVideoId = /\/(shorts|embed)\/(.*)/.exec(pathname)?.[2];

        if (pathVideoId) {
            return pathVideoId;
        }
    }

    const params = new URLSearchParams(window.location.search);
    return params.get('v') ?? undefined;
};

const trackLabel = (track: any) =>
    track.name?.simpleText ||
    track.name?.runs?.[0]?.text ||
    track.displayName ||
    track.languageName ||
    track.languageCode;

const prepareTimedTextUrl = (url: URL) => {
    url.searchParams.set('fmt', 'srv3');
    url.searchParams.set('c', window.ytcfg?.get?.('INNERTUBE_CLIENT_NAME') || 'WEB');
};

const trackToSubtitleTrack = (track: any): VideoDataSubtitleTrack | undefined => {
    const timedTextUrl = track.url || track.baseUrl;
    const language = track.languageCode;

    if (!timedTextUrl || !language) {
        return undefined;
    }

    const url = new URL(timedTextUrl, window.location.href);
    prepareTimedTextUrl(url);

    const def = {
        label: trackLabel(track),
        language,
        url: url.toString(),
        extension: 'ytsrv3',
    };
    return trackFromDef(def);
};

const tracksToSubtitleTracks = (tracks: any[]): VideoDataSubtitleTrack[] =>
    tracks.flatMap((track) => {
        const subtitleTrack = trackToSubtitleTrack(track);
        return subtitleTrack === undefined ? [] : [subtitleTrack];
    });

const tracksFromPlayerAudioTrack = async (videoId: string) => {
    // YouTube's player exposes caption URLs after it has initialized the audio track. These URLs can include
    // runtime-only params such as POT that are not available in ytInitialPlayerResponse or sessionStorage.
    let info: { basename: string; subtitles: VideoDataSubtitleTrack[] } | undefined;
    const ready = await poll(() => {
        const player = document.querySelector('#movie_player') as any;
        const playerVideoId = player?.getVideoData?.()?.video_id;
        const tracks = player?.getAudioTrack?.()?.captionTracks;

        if ((playerVideoId === undefined || playerVideoId === videoId) && Array.isArray(tracks) && tracks.length > 0) {
            const trackWithPotParam = tracks.find((t) => new URL(t?.url)?.searchParams?.get('pot') !== null);
            if (trackWithPotParam === undefined) {
                return false;
            }

            const subtitles = tracksToSubtitleTracks(tracks);

            if (subtitles.length > 0) {
                info = {
                    basename: player?.getVideoData?.()?.title || '',
                    subtitles,
                };
                return true;
            }
        }

        return false;
    }, 5000);

    return ready ? info : undefined;
};

const androidInnerTubeTracks = async (videoId: string) => {
    if (typeof window.ytcfg?.get !== 'function') {
        return undefined;
    }

    const apiKey = window.ytcfg.get('INNERTUBE_API_KEY');

    if (!apiKey) {
        return undefined;
    }

    const response = await fetch(`https://${window.location.host}/youtubei/v1/player?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '20.10.38',
                    hl: window.ytcfg.get('HL') || 'en',
                },
            },
            videoId,
        }),
    });

    if (response.status !== 200) {
        return undefined;
    }

    const payload = await response.json();
    const basename = payload.videoDetails?.title;

    if (typeof payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks !== 'object') {
        return { basename };
    }

    const tracks = payload.captions.playerCaptionsTracklistRenderer.captionTracks;
    const subtitles: VideoDataSubtitleTrack[] = tracksToSubtitleTracks(tracks);
    return { basename, subtitles };
};

const timedTextTracksUsingPot = async (videoId: string) => {
    const pot = decodePoToken(videoId);

    if (!pot) {
        return undefined;
    }

    const playerContext = await fetchPlayerContextForPage();
    const tracks = playerContext?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const tracksWithPot = tracks.map((track: any) => {
        const baseUrl = track.baseUrl as string;
        const baseUrlWithHost = baseUrl.startsWith('/') ? `https://${window.location.host}${baseUrl}` : baseUrl;
        const url = new URL(baseUrlWithHost);
        url.searchParams.set('pot', pot.poToken);
        return { ...track, url: url.toString() };
    });
    const subtitles = tracksToSubtitleTracks(tracksWithPot);
    const basename = playerContext.videoDetails?.title;
    return { basename, subtitles };
};

const includeTranslationsForLanguageCodes = async (tracks: VideoDataSubtitleTrack[], languageCodes: string[]) => {
    const tracksIncludingTranslations: VideoDataSubtitleTrack[] = [];

    for (const track of tracks) {
        tracksIncludingTranslations.push(track);

        for (const languageCode of languageCodes) {
            if (track.language !== languageCode) {
                const translationUrl = `${track.url}&tlang=${encodeURIComponent(languageCode)}`;
                const newTrack = {
                    ...track,
                    language: `${languageCode}_from_${track.language}`,
                    label: `${track.label} >> ${languageCode}`,
                    url: translationUrl,
                };
                tracksIncludingTranslations.push({
                    ...newTrack,
                    id: trackId(newTrack),
                });
            }
        }
    }

    return tracksIncludingTranslations;
};

const publishCurrentTracks = async ({
    targetTranslationLanguageCodes,
}: {
    targetTranslationLanguageCodes: string[];
}) => {
    const response: VideoData = { error: '', basename: '', subtitles: [] };
    let videoId: string | undefined;

    try {
        videoId = inferVideoId();

        if (!videoId) {
            response.error = 'Could not determine video ID';
            return;
        }

        let basename: string = '';
        let subtitles: VideoDataSubtitleTrack[] | undefined;

        // Prefer YouTube's initialized player state because it contains runtime caption URL params that
        // can be absent from static player responses and hardcoded POT caches.
        const playerAudioTrackInfo = await tracksFromPlayerAudioTrack(videoId);

        if (playerAudioTrackInfo) {
            basename = playerAudioTrackInfo.basename;
            subtitles = playerAudioTrackInfo.subtitles;
        }

        const androidInnerTubeInfo = subtitles === undefined ? await androidInnerTubeTracks(videoId) : undefined;

        if (androidInnerTubeInfo) {
            basename = androidInnerTubeInfo.basename;
            subtitles = androidInnerTubeInfo.subtitles;
        }

        if (subtitles === undefined || !basename) {
            const timedTextUsingPotInfo = await timedTextTracksUsingPot(videoId);

            if (timedTextUsingPotInfo) {
                basename = basename || timedTextUsingPotInfo?.basename;
                subtitles = subtitles ?? timedTextUsingPotInfo?.subtitles;
            }
        }

        if (subtitles !== undefined) {
            subtitles = await includeTranslationsForLanguageCodes(subtitles, targetTranslationLanguageCodes);
        }

        response.basename = basename || document.title;
        response.subtitles = subtitles ?? [];
        return videoId;
    } catch (error) {
        console.error(error);
        if (error instanceof Error) {
            response.error = error.message;
        } else {
            response.error = String(error);
        }
    } finally {
        // Do not publish subs if the video ID changed during track extraction - e.g. likely to happen on Shorts
        if (videoId === inferVideoId()) {
            document.dispatchEvent(
                new CustomEvent('asbplayer-synced-data', {
                    detail: response,
                })
            );
        }
    }
};

export default defineUnlistedScript(() => {
    let lastVideoIdDispatched: string | undefined;

    document.addEventListener(
        'asbplayer-get-synced-data',
        async (e) => {
            const targetTranslationLanguageCodes: string[] =
                ((e as CustomEvent).detail?.targetTranslationLanguageCodes as string[] | undefined) ?? [];
            lastVideoIdDispatched = await publishCurrentTracks({ targetTranslationLanguageCodes });
        },
        false
    );

    let publishing = false;

    // Handle YT shorts: Publish subtitle tracks according to current video ID
    setInterval(async () => {
        if (publishing) {
            return;
        }

        try {
            publishing = true;
            const videoId = inferVideoId();
            if (lastVideoIdDispatched && videoId && lastVideoIdDispatched !== videoId) {
                lastVideoIdDispatched = await publishCurrentTracks({ targetTranslationLanguageCodes: [] });
            }
        } finally {
            publishing = false;
        }
    }, 500);
});
