import { extractBilibiliTracks } from '@/pages/bilibili';
import { inferTracks } from '@/pages/util';

const getCacheKey = () => {
    if (window.location.hostname !== 'www.bilibili.com') {
        return window.location.pathname;
    }

    const part = new URLSearchParams(window.location.search).get('p') ?? '1';
    return `${window.location.pathname}?p=${part}`;
};

export default defineUnlistedScript(() => {
    inferTracks({
        onJson: (value, addTrack) => {
            for (const track of extractBilibiliTracks(value, window.location.href)) {
                addTrack(track);
            }
        },
        onRequest: async (_addTrack, setBasename) => {
            setBasename(document.title);
        },
        observeResponseJson: true,
        getCacheKey,
        waitForBasename: false,
    });
});
