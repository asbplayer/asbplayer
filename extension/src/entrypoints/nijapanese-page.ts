import type { VideoData, VideoDataSubtitleTrackDef } from '@project/common';
import { trackId } from '@/pages/util.ts';

export default defineUnlistedScript(() => {
    document.addEventListener('asbplayer-get-synced-data', () => {
        const tracks = Array.from(document.querySelectorAll('video track'));
        const subtitles: VideoData['subtitles'] = [];

        for (const track of tracks) {
            const url = track.getAttribute('src');
            const label = track.getAttribute('label');
            if (url && label) {
                const trackDef: VideoDataSubtitleTrackDef = {
                    label,
                    language: track.getAttribute('srclang') ?? undefined,
                    url,
                    extension: url.split('.').at(-1)!,
                };
                subtitles.push({
                    id: trackId(trackDef),
                    ...trackDef,
                });
            }
        }

        const response: VideoData = {
            error: '',
            basename: document.title.replace(' | Natural Japanese', ''),
            subtitles,
        };
        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: response }));
    });
});
