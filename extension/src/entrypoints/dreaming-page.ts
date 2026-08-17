import type { VideoData } from '@project/common';
import { videoDataFromResponse } from '@/pages/dreaming';

const inferVideoId = () => new URLSearchParams(window.location.search).get('id') ?? undefined;

const fetchVideoData = async (videoId: string): Promise<VideoData> => {
    // The site keeps its API token (also for auto-created anonymous accounts) in localStorage
    const token = localStorage.getItem('token');
    const response = await fetch(
        `/.netlify/functions/video?id=${encodeURIComponent(videoId)}`,
        token === null ? undefined : { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
        throw new Error(`Video API returned status ${response.status}`);
    }

    return videoDataFromResponse(await response.json(), document.title);
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
