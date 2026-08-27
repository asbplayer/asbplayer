import type { VideoData } from '@project/common';
import { isRetryableStatus, statusError, videoDataFromResponse } from '@/pages/dreaming';

const maxAttempts = 3;
const retryDelayMs = 500;

const inferVideoId = () => new URLSearchParams(window.location.search).get('id') ?? undefined;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type VideoDataRequestResult = { data: VideoData } | { error: string; retryable: boolean };

const requestVideoData = async (videoId: string): Promise<VideoDataRequestResult> => {
    // The site keeps its API token (also for auto-created anonymous accounts) in localStorage
    const token = localStorage.getItem('token');
    const response = await fetch(
        `/.netlify/functions/video?id=${encodeURIComponent(videoId)}`,
        token === null ? undefined : { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
        return { error: statusError(response.status), retryable: isRetryableStatus(response.status) };
    }

    return { data: videoDataFromResponse(await response.json(), document.title) };
};

// A single failed request would otherwise leave subtitles unavailable until the user
// reloads, since subtitles are only re-requested when the video changes.
const fetchVideoData = async (videoId: string): Promise<VideoData> => {
    let lastError = 'Failed to load subtitles';

    for (let attempt = 1; attempt <= maxAttempts; ++attempt) {
        try {
            const result = await requestVideoData(videoId);

            if ('data' in result) {
                return result.data;
            }

            lastError = result.error;

            if (!result.retryable) {
                break;
            }
        } catch (error) {
            // Network-level failure - worth another attempt
            lastError = error instanceof Error ? error.message : String(error);
        }

        // Give up early once the user has moved on to another video
        if (attempt === maxAttempts || inferVideoId() !== videoId) {
            break;
        }

        await delay(retryDelayMs * attempt);
    }

    return { error: lastError, basename: document.title, subtitles: [] };
};

export default defineUnlistedScript(() => {
    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            void (async () => {
                let response: VideoData = { error: '', basename: document.title, subtitles: [] };
                const videoId = inferVideoId();

                try {
                    if (videoId === undefined) {
                        response.error = 'Could not determine video ID';
                        return;
                    }

                    response = await fetchVideoData(videoId);
                } catch (error) {
                    response.error = error instanceof Error ? error.message : String(error);
                } finally {
                    // Videos are identified by query parameter and navigation is soft - drop
                    // responses that resolve after the user has moved to another video
                    if (videoId === inferVideoId()) {
                        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: response }));
                    }
                }
            })();
        },
        false
    );
});
