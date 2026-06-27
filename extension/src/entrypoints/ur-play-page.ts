import { inferTracksFromInterceptedM3u8 } from '@/pages/m3u8-util';

export default defineUnlistedScript(() => {
    inferTracksFromInterceptedM3u8(/https:\/\/.+\/hls-avc\.m3u8/);
});
