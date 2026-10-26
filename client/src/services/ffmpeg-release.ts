type GithubRelease = { assets: Array<{ name: string; url: string }> };

const loadRelease = async (
    releaseApiUrl: string,
    fetcher: typeof fetch,
    signal: AbortSignal
): Promise<GithubRelease> => {
    const response = await fetcher(new Request(releaseApiUrl, { signal, cache: 'no-cache' }));
    if (!response.ok) throw new Error(`Could not find FFmpeg release (HTTP ${response.status}).`);
    const data = (await response.json()) as Partial<GithubRelease>;
    if (!Array.isArray(data.assets)) throw new Error('Invalid FFmpeg release asset inventory.');
    return { assets: data.assets };
};

/** Resolve public release assets through GitHub's CORS-enabled API, then download their bytes. */
export const createGithubReleaseFetcher = (releaseApiUrl: string, fetcher: typeof fetch = fetch): typeof fetch => {
    let release: Promise<GithubRelease> | undefined;
    return async (input, init) => {
        const request = new Request(input, init);
        release ??= loadRelease(releaseApiUrl, fetcher, request.signal);
        const filename = new URL(request.url).pathname.split('/').pop();
        const asset = (await release).assets.find((asset) => asset.name === filename);
        if (!asset) throw new Error(`FFmpeg release is missing ${filename}.`);
        // GitHub release-page redirects do not support browser CORS. The API does.
        return fetcher(
            new Request(asset.url, {
                signal: request.signal,
                cache: 'no-cache',
                headers: { Accept: 'application/octet-stream' },
            })
        );
    };
};
