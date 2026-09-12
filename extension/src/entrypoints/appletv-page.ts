import { BaseGenericPageDiscovery } from '@/pages/base-generic-page';
import { VideoDataSubtitleTrack } from '@project/common';

export default defineUnlistedScript(() => {
    const trackFilter = (t: VideoDataSubtitleTrack) => {
        const url = t.url;

        if (url === undefined) {
            return true;
        }

        const filter = (u: string) => {
            return !u.includes('VideoPreview');
        };

        if (Array.isArray(url)) {
            for (const u of url) {
                if (!filter(u)) {
                    return false;
                }
            }
            return true;
        }

        return filter(url);
    };

    const discovery = new BaseGenericPageDiscovery({ cueByteCountLabels: true });
    let requestGeneration = 0;
    document.addEventListener(
        'asbplayer-get-synced-data',
        (e: Event) => {
            const { src } = (e as CustomEvent<{ src: string }>).detail;
            const video = videoForSrc(src);

            if (video === undefined) {
                return;
            }

            const requestPage = window.location.href;
            requestGeneration++;
            let currentGeneration = requestGeneration;
            void discovery
                .videoData(video)
                .catch(() => ({ error: '', basename: document.title, subtitles: [] }))
                .then((data) => {
                    if (currentGeneration !== requestGeneration || window.location.href !== requestPage) return;
                    const tracks = data?.subtitles?.filter((t) => trackFilter(t));
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', { detail: { ...data, subtitles: tracks } })
                    );
                });
        },
        true
    );

    const videoForSrc = (src: string) =>
        [...document.getElementsByTagName('video')].find((v) => v.dataset.asbplayerSrc === src);

    document.addEventListener('asbplayer-appletv-play', (e: Event) => {
        const { src } = (e as CustomEvent<{ src: string }>).detail;
        void videoForSrc(src)?.play();
    });
    document.addEventListener('asbplayer-appletv-pause', (e: Event) => {
        const { src } = (e as CustomEvent<{ src: string }>).detail;
        videoForSrc(src)?.pause();
    });
    document.addEventListener('asbplayer-appletv-seek', (e: Event) => {
        const { src, timestampMs } = (e as CustomEvent<{ src: string; timestampMs: number }>).detail;
        const video = videoForSrc(src);
        if (!video) return;
        video.currentTime = timestampMs / 1000;
    });
});
