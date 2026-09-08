export default defineUnlistedScript(() => {
    setTimeout(() => {
        let baseName: string | undefined;

        const originalParse = JSON.parse;
        JSON.parse = function (...args: unknown[]) {
            // @ts-expect-error: forwarding original parse arguments
            const value = originalParse.apply(this, args);

            if (typeof value?.data?.webfront_title_stage?.titleName === 'string') {
                baseName = value.data.webfront_title_stage.titleName;

                if (typeof value.data.webfront_title_stage.episode?.id === 'string') {
                    const episodeId = value.data.webfront_title_stage.episode.id;

                    if (
                        typeof value.data.webfront_title_titleEpisodes?.episodes === 'object' &&
                        Array.isArray(value.data.webfront_title_titleEpisodes.episodes)
                    ) {
                        for (const obj of value.data.webfront_title_titleEpisodes.episodes) {
                            if (obj.id === episodeId) {
                                if (typeof obj.displayNo === 'string') {
                                    baseName = `${baseName} ${obj.displayNo}`;
                                }

                                if (typeof obj.episodeName === 'string') {
                                    baseName = `${baseName} ${obj.episodeName}`;
                                }

                                break;
                            }
                        }
                    }
                }
            }

            return value;
        };

        document.addEventListener(
            'asbplayer-get-synced-data',
            () => {
                if (!baseName) {
                    document.dispatchEvent(
                        new CustomEvent('asbplayer-synced-data', {
                            detail: {
                                error: '',
                                basename: '',
                                subtitles: [],
                            },
                        })
                    );
                    return;
                }

                document.dispatchEvent(
                    new CustomEvent('asbplayer-synced-data', {
                        detail: {
                            error: '',
                            basename: baseName,
                            subtitles: [],
                        },
                    })
                );
                baseName = undefined;
            },
            false
        );
    }, 0);
});
