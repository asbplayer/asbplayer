import { VideoDataSubtitleTrack } from '@project/common';
import { trackFromDef } from '@/pages/util';

export default defineUnlistedScript(() => {
    const discoveredSubtitles = new Map<string, VideoDataSubtitleTrack>();
    let trackIndex = 1;

    const dispatchSubtitles = () => {
        const response = {
            error: '',
            basename: document.title,
            subtitles: Array.from(discoveredSubtitles.values()),
        };

        document.dispatchEvent(
            new CustomEvent('asbplayer-synced-data', {
                detail: response,
            })
        );
    };

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : null;

        if (url) {
            const stremioSubtitleMatch = url.match(/https:\/\/subs\d+\.strem\.io\/.+\/file\/\d+/);
            const opensubtitlesMatch = url.match(/https:\/\/opensubtitles\.stremio\.homes\/sub\.vtt/);
            //const babyBeamupMatch = url.match(/https:\/\/.*baby-beamup\.club\/subtitle\/sub\.vtt/);

            let extension = null;
            if (stremioSubtitleMatch) {
                extension = 'srt';
            } else if (opensubtitlesMatch) {
                extension = 'vtt';
            }

            if (extension) {
                if (!discoveredSubtitles.has(url)) {
                    const track = trackFromDef({
                        label: `Stremio ${trackIndex++}`,
                        language: '',
                        url: url,
                        extension: extension,
                    });
                    discoveredSubtitles.set(url, track);

                    dispatchSubtitles();
                }
            }
        }

        return originalFetch(...args);
    };

    document.addEventListener(
        'asbplayer-get-synced-data',
        () => {
            dispatchSubtitles();
        },
        false
    );
});
