import { VideoData, VideoDataSubtitleTrack } from '@project/common';
import { extractExtension, poll, trackFromDef } from '@/pages/util';

export default defineUnlistedScript(() => {
    setTimeout(() => {
        const dataByVideoId: Map<string, VideoData> = new Map();
        let lastVideoId: string | undefined;

        const extractExtensionFromMimeType = (val: any) => {
            if (typeof val !== 'string') {
                return undefined;
            }
            // For subtitle files the last part of the mime type should usually be the extension
            // e.g. text/vtt maps to vtt
            const parts = val.split('/');
            return parts[parts.length - 1];
        };

        const tryExtractMetadata = async (value: any) => {
            try {
                if (typeof value?.ref_id !== 'string' || !(value?.tracks instanceof Array)) {
                    return;
                }

                const videoDataSubtitleTracks: VideoDataSubtitleTrack[] = [];
                const videoId = value.ref_id;

                for (const track of value.tracks) {
                    if (typeof track !== 'object') {
                        continue;
                    }

                    if (
                        track.kind === 'subtitles' &&
                        typeof track.src === 'string' &&
                        typeof track.srclang === 'string'
                    ) {
                        const inferredExtensionFromMimeType = extractExtensionFromMimeType(track.type) || 'vtt';
                        videoDataSubtitleTracks.push(
                            trackFromDef({
                                label: track.label || track.srclang || track.src,
                                url: track.src,
                                language: track.srclang,
                                extension: extractExtension(track.src, inferredExtensionFromMimeType),
                            })
                        );
                    }
                }

                const videoName = new RegExp(`(${videoId}:){0,1}(.+)`).exec(value.name)?.[2];
                if (videoDataSubtitleTracks.length > 0) {
                    dataByVideoId.set(videoId, {
                        basename: videoName || document.title,
                        subtitles: videoDataSubtitleTracks,
                    });
                }

                lastVideoId = value?.ref_id;
            } catch (e) {
                // ignore
            }
        };

        const originalXhrSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
                tryExtractMetadata(this.response);
            });

            // @ts-ignore
            originalXhrSend.apply(this, arguments);
        };

        const videoIdFromUrl = () => {
            return /watch\/(.+)(\/){0,1}/.exec(new URL(window.location.href).pathname)?.[1];
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            async () => {
                let response: VideoData | undefined;
                const pollPromise = poll(() => {
                    const videoId = videoIdFromUrl() ?? lastVideoId;
                    if (!videoId) {
                        return false;
                    }
                    response = dataByVideoId.get(videoId);
                    if (response === undefined) {
                        return false;
                    }
                    return true;
                });
                await pollPromise;
                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: response ?? { basename: '', error: 'Timed out' },
                    })
                );
            },
            false
        );
    }, 0);
});
