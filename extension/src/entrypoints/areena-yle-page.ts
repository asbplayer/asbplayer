import { inferTracksFromInterceptedM3u8 } from '@/pages/m3u8-util';

export default defineUnlistedScript(() => {
    inferTracksFromInterceptedM3u8(/https:\/\/.+\.m3u8.+/);
});
