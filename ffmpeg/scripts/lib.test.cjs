/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdir, mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const lib = pathToFileURL(resolve(__dirname, 'lib.mjs')).href;
const body = 'verified runtime archive';
const hash = createHash('sha256').update(body).digest('hex');
let root;
beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'asbplayer-download-test-'));
});
afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});
const run = (source) => exec(process.execPath, ['--input-type=module', '-e', source], { timeout: 10_000 });
// Only HTTP and the backoff clock are faked; hashing and filesystem operations are real.
const runScenario = (source) =>
    run(`import assert from 'node:assert/strict';
        import { download } from ${JSON.stringify(lib)};
        const destination = ${JSON.stringify(resolve(root, 'runtime.tar.gz'))};
        const body = ${JSON.stringify(body)};
        const hash = ${JSON.stringify(hash)};
        const delays = [];
        globalThis.setTimeout = (callback, delay) => { delays.push(delay); queueMicrotask(callback); };
        ${source}`);

it('reuses verified cached bytes without requesting the network', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    await writeFile(destination, body);
    await runScenario(`
        globalThis.fetch = async () => { throw new Error('Unexpected download'); };
        await download('https://example.test/runtime', destination, hash);
        assert.deepEqual(delays, []);
    `);
    expect(await readFile(destination, 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('downloads a missing archive with a 120-second request timeout and no backoff', async () => {
    await runScenario(`
        const timeout = AbortSignal.timeout;
        const timeouts = [];
        AbortSignal.timeout = (milliseconds) => { timeouts.push(milliseconds); return timeout(milliseconds); };
        globalThis.fetch = async (_url, { redirect, signal }) => {
            assert.equal(redirect, 'follow');
            assert.ok(signal instanceof AbortSignal);
            return new Response(body);
        };
        await download('https://example.test/runtime', destination, hash);
        assert.deepEqual(timeouts, [120_000]);
        assert.deepEqual(delays, []);
    `);
    expect(await readFile(resolve(root, 'runtime.tar.gz'), 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it.each([429, 500, 503, 599])(
    'retries HTTP %i with exponential backoff and replaces invalid cached bytes',
    async (status) => {
        const destination = resolve(root, 'runtime.tar.gz');
        await writeFile(destination, 'invalid cache');
        const result = await runScenario(`
        const signals = [];
        globalThis.fetch = async (_url, { signal }) => {
            signals.push(signal);
            return new Response(body, { status: signals.length < 3 ? ${status} : 200 });
        };
        await download('https://example.test/runtime', destination, hash);
        assert.equal(signals.length, 3);
        assert.equal(new Set(signals).size, 3);
        assert.deepEqual(delays, [1000, 2000]);
    `);
        expect(result.stderr).toContain(`HTTP ${status}`);
        expect(await readFile(destination, 'utf8')).toBe(body);
        expect(await readdir(root)).toEqual(['runtime.tar.gz']);
    }
);

it('recovers from a network connection failure', async () => {
    await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => {
            if (++requests === 1) throw new TypeError('fetch failed', { cause: new Error('ECONNRESET') });
            return new Response(body);
        };
        await download('https://example.test/runtime', destination, hash);
        assert.equal(requests, 2);
        assert.deepEqual(delays, [1000]);
    `);
    expect(await readFile(resolve(root, 'runtime.tar.gz'), 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it.each(['request', 'body'])('retries a timed-out %s using a fresh timeout', async (phase) => {
    await runScenario(`
        const signals = [];
        AbortSignal.timeout = (milliseconds) => {
            assert.equal(milliseconds, 120_000);
            const controller = new AbortController();
            signals.push(controller.signal);
            if (signals.length === 1) {
                setImmediate(() => controller.abort(new DOMException('Download timed out', 'TimeoutError')));
            }
            return controller.signal;
        };
        let requests = 0;
        globalThis.fetch = async (_url, { signal }) => {
            if (++requests > 1) return new Response(body);
            if (${JSON.stringify(phase)} === 'request') {
                return new Promise((_resolve, reject) =>
                    signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
            }
            return new Response(new ReadableStream({
                start(controller) { controller.enqueue(new TextEncoder().encode('partial download')); }
            }));
        };
        await download('https://example.test/runtime', destination, hash);
        assert.equal(requests, 2);
        assert.equal(signals.length, 2);
        assert.notEqual(signals[0], signals[1]);
        assert.deepEqual(delays, [1000]);
    `);
    expect(await readFile(resolve(root, 'runtime.tar.gz'), 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it.each([400, 401, 403, 404])('does not retry HTTP %i and preserves its status for callers', async (status) => {
    await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => { requests++; return new Response('unavailable', { status: ${status} }); };
        await assert.rejects(download('https://example.test/runtime', destination, hash), { status: ${status} });
        assert.equal(requests, 1);
        assert.deepEqual(delays, []);
    `);
    expect(await readdir(root)).toEqual([]);
});

it('rejects a successful response with no body without retrying', async () => {
    await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => { requests++; return new Response(null); };
        await assert.rejects(download('https://example.test/runtime', destination, hash), { status: 200 });
        assert.equal(requests, 1);
        assert.deepEqual(delays, []);
    `);
    expect(await readdir(root)).toEqual([]);
});

it.each(['http', 'network'])(
    'stops after four %s failures, preserving existing bytes and the final error',
    async (kind) => {
        const destination = resolve(root, 'runtime.tar.gz');
        await writeFile(destination, 'existing runtime');
        await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => {
            requests++;
            if (${JSON.stringify(kind)} === 'network') throw new TypeError('fetch failed ' + requests);
            return new Response('unavailable', { status: requests === 4 ? 503 : 429 });
        };
        await assert.rejects(download('https://example.test/runtime', destination, hash),
            ${kind === 'network' ? "{ name: 'TypeError', message: 'fetch failed 4' }" : '{ status: 503 }'});
        assert.equal(requests, 4);
        assert.deepEqual(delays, [1000, 2000, 4000]);
    `);
        expect(await readFile(destination, 'utf8')).toBe('existing runtime');
        expect(await readdir(root)).toEqual(['runtime.tar.gz']);
    }
);

it('does not retry a local filesystem failure', async () => {
    await mkdir(resolve(root, 'runtime.tar.gz'));
    await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => { requests++; return new Response(body); };
        await assert.rejects(download('https://example.test/runtime', destination, hash), { code: 'EISDIR' });
        assert.equal(requests, 1);
        assert.deepEqual(delays, []);
    `);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('restarts an interrupted HTTP body with a clean partial file', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    await run(`import assert from 'node:assert/strict';
        import { createServer } from 'node:http';
        import { download } from ${JSON.stringify(lib)};
        let requests = 0;
        const server = createServer((_request, response) => {
            if (++requests === 1) {
                response.writeHead(200, { 'Content-Length': 1000 });
                response.write('partial download');
                setTimeout(() => response.destroy(), 30);
            } else {
                response.end(${JSON.stringify(body)});
            }
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            await download('http://127.0.0.1:' + server.address().port,
                ${JSON.stringify(destination)}, ${JSON.stringify(hash)});
            assert.equal(requests, 2);
        } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }`);
    expect(await readFile(destination, 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('times out a stalled HTTP body and retries the complete download', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    await run(`import assert from 'node:assert/strict';
        import { createServer } from 'node:http';
        import { download } from ${JSON.stringify(lib)};
        const timeout = AbortSignal.timeout;
        let timeouts = 0;
        AbortSignal.timeout = (milliseconds) => {
            assert.equal(milliseconds, 120_000);
            return timeout(++timeouts === 1 ? 250 : milliseconds);
        };
        let requests = 0;
        const server = createServer((_request, response) => {
            if (++requests === 1) {
                response.writeHead(200, { 'Content-Length': 1000 });
                response.write('partial download');
            } else {
                response.end(${JSON.stringify(body)});
            }
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            await download('http://127.0.0.1:' + server.address().port,
                ${JSON.stringify(destination)}, ${JSON.stringify(hash)});
            assert.equal(requests, 2);
            assert.equal(timeouts, 2);
        } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }`);
    expect(await readFile(destination, 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('allows overlapping downloads to the same destination and leaves only verified bytes', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    const source = `import { download } from ${JSON.stringify(lib)};
        globalThis.fetch = async () => { await new Promise(resolve => setTimeout(resolve, 30)); return new Response(${JSON.stringify(body)}); };
        await download('https://example.test/runtime', ${JSON.stringify(destination)}, ${JSON.stringify(hash)});`;
    await Promise.all(Array.from({ length: 4 }, () => run(source)));
    expect(await readFile(destination, 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('preserves an existing file and removes partial downloads on integrity failure', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    await writeFile(destination, 'existing runtime');
    await runScenario(`
        let requests = 0;
        globalThis.fetch = async () => { requests++; return new Response('corrupt'); };
        await assert.rejects(download('https://example.test/runtime', destination, hash), /SHA-256 mismatch/);
        assert.equal(requests, 1);
        assert.deepEqual(delays, []);
    `);
    expect(await readFile(destination, 'utf8')).toBe('existing runtime');
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});
