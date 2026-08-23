import type { VideoData } from '@project/common';

export default defineUnlistedScript(() => {
    document.addEventListener('asbplayer-get-synced-data', () => {
        const response: VideoData = {
            error: '',
            basename: 'asbplayer Tutorial',
            subtitles: [
                {
                    id: '1',
                    label: 'Asbplayer Tutorial',
                    language: 'en',
                    url: '/assets/tutorial.srt',
                    extension: 'srt',
                },
            ],
        };
        document.dispatchEvent(new CustomEvent('asbplayer-synced-data', { detail: response }));
    });
});
