/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');

const exec = promisify(execFile);
const body = Buffer.from('pinned release bytes');
const sha256 = createHash('sha256').update(body).digest('hex');
let directory;
let server;
let lock;
let requests;
let responseBody;
let status;

beforeEach(async () => {
    directory = await mkdtemp(resolve(tmpdir(), 'asbplayer-runtime-download-'));
    requests = [];
    responseBody = body;
    status = 200;
    server = createServer((request, response) => {
        requests.push(request.url);
        if (request.url === '/release/runtime.tar.gz') {
            response.writeHead(302, { Location: '/asset' }).end();
        } else {
            response.writeHead(status).end(responseBody);
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    lock = {
        releaseBaseDownloadUrl: `http://127.0.0.1:${server.address().port}/release`,
        runtimeArchive: { filename: 'runtime.tar.gz', sha256, bytes: body.length },
    };
});

afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
});

const prepare = () =>
    exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import { prepareRuntime } from ${JSON.stringify(pathToFileURL(resolve(__dirname, 'prepare-runtime.mjs')).href)};
        console.log(await prepareRuntime(${JSON.stringify(lock)}, ${JSON.stringify(directory)}));`,
    ]);

it('follows release redirects, verifies bytes, and reuses a verified cache without network access', async () => {
    const path = (await prepare()).stdout.trim();
    expect(await readFile(path)).toEqual(body);
    expect(requests).toEqual(['/release/runtime.tar.gz', '/asset']);
    requests.length = 0;
    status = 503;
    expect((await prepare()).stdout.trim()).toBe(path);
    expect(requests).toEqual([]);
});

it('checks cached bytes again and replaces corrupt entries with the pinned release', async () => {
    const path = (await prepare()).stdout.trim();
    await writeFile(path, 'corrupt cache');
    await prepare();
    expect(await readFile(path)).toEqual(body);
    expect(requests).toHaveLength(4);
});

it('rejects changed release bytes and leaves no usable or partial cache file', async () => {
    responseBody = Buffer.from('wrong release bytes');
    await expect(prepare()).rejects.toThrow('SHA-256 mismatch');
    expect(await readdir(directory)).toEqual([]);
});

it('rejects a release with an unexpected size even when its hash matches', async () => {
    lock.runtimeArchive.bytes++;
    await expect(prepare()).rejects.toThrow('size differs');
});

it('fails on an unavailable release instead of building without FFmpeg silently', async () => {
    status = 404;
    await expect(prepare()).rejects.toThrow('HTTP 404');
    expect(await readdir(directory)).toEqual([]);
});

it('rejects an invalid lock before making a request', async () => {
    lock.runtimeArchive.sha256 = '../invalid';
    await expect(prepare()).rejects.toThrow('Invalid FFmpeg runtime');
    expect(requests).toEqual([]);
});
