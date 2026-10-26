/** @jest-environment node */
import { createGithubReleaseFetcher } from '@project/client/src/services/ffmpeg-release';

const releaseUrl = 'https://api.github.com/repos/example/player/releases/tags/ffmpeg-v1.0.0';
const downloadUrl = 'https://github.com/example/player/releases/download/ffmpeg-v1.0.0/';

it('looks up the release once and downloads concurrent assets through the public binary API', async () => {
    const requests: Request[] = [];
    const files = ['ffmpeg-worker.js', 'ffmpeg-core.js', 'ffmpeg-core.wasm'];
    const fetcher: typeof fetch = async (input) => {
        const request = input as Request;
        requests.push(request);
        if (request.url === releaseUrl) {
            return Response.json({
                assets: files.map((name, index) => ({
                    name,
                    url: `https://api.github.com/repos/example/player/releases/assets/${index}`,
                })),
            });
        }
        return new Response(request.url);
    };
    const releaseFetch = createGithubReleaseFetcher(releaseUrl, fetcher);
    const controller = new AbortController();
    const responses = await Promise.all(
        files.map((file) => releaseFetch(new Request(downloadUrl + file, { signal: controller.signal })))
    );
    expect(requests.filter((request) => request.url === releaseUrl)).toHaveLength(1);
    expect(requests.slice(1).map((request) => request.headers.get('Accept'))).toEqual(
        files.map(() => 'application/octet-stream')
    );
    expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
        files.map((_, index) => `https://api.github.com/repos/example/player/releases/assets/${index}`)
    );
    controller.abort();
    expect(requests.every((request) => request.signal.aborted)).toBe(true);
});

it.each([
    [new Response('Missing', { status: 404 }), 'HTTP 404'],
    [Response.json({}), 'Invalid FFmpeg release'],
    [Response.json({ assets: [] }), 'missing ffmpeg-core.wasm'],
])('rejects an unavailable or incomplete release', async (response, message) => {
    const fetcher = jest.fn(async () => response);
    await expect(createGithubReleaseFetcher(releaseUrl, fetcher)(downloadUrl + 'ffmpeg-core.wasm')).rejects.toThrow(
        message
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
});

it('returns asset failures to the runtime downloader for verification and error handling', async () => {
    const releaseFetch = createGithubReleaseFetcher(releaseUrl, async (input) =>
        (input as Request).url === releaseUrl
            ? Response.json({
                  assets: [
                      {
                          name: 'ffmpeg-core.wasm',
                          url: 'https://api.github.com/repos/example/player/releases/assets/42',
                      },
                  ],
              })
            : new Response('Unavailable', { status: 503 })
    );
    expect((await releaseFetch(downloadUrl + 'ffmpeg-core.wasm')).status).toBe(503);
});
