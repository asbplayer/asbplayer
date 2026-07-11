import { inferTracks } from '@/pages/util';
import { subtitleTrackSegmentsFromM3U8 } from '@/pages/m3u8-util';

export default defineUnlistedScript(() => {
    setTimeout(() => {
        let lastM3U8Url: string | undefined = undefined;
        let lastBasename: string | undefined = undefined;
        const originalParse = JSON.parse;
        JSON.parse = function (...args: unknown[]) {
            // @ts-expect-error: forwarding original parse arguments
            const value = originalParse.apply(this, args);
            if (value?.stream?.sources instanceof Array && value.stream.sources.length > 0) {
                const url = value.stream.sources[0].complete?.url;

                if (url) {
                    lastM3U8Url = url;
                }
            }

            if (value?.data?.playerExperience?.title) {
                lastBasename = value?.data?.playerExperience?.title;
                if (value?.data?.playerExperience?.subtitle) {
                    lastBasename += ` ${value?.data?.playerExperience?.subtitle}`;
                }
            }
            return value;
        };
        inferTracks(
            {
                onRequest: async (addTrack, setBasename) => {
                    if (lastBasename !== undefined) {
                        setBasename(lastBasename);
                    }

                    if (lastM3U8Url !== undefined) {
                        const tracks = await subtitleTrackSegmentsFromM3U8(lastM3U8Url);

                        for (const track of tracks) {
                            addTrack(track);
                        }
                    }
                },
                waitForBasename: false,
            },
            60_000
        );
    }, 0);
});
