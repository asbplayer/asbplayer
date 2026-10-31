/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const repository = 'example/repo';
const tag = 'ffmpeg-v0.2.0';
const body = 'verified draft runtime';
const hash = createHash('sha256').update(body).digest('hex');
const target = 'b'.repeat(40);
let root;
let directory;
let options;
let lock;

beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'asbplayer-release-workflow-'));
    directory = resolve(root, 'ffmpeg');
    await mkdir(resolve(directory, 'scripts'), { recursive: true });
    await mkdir(resolve(directory, 'release'));
    await mkdir(resolve(root, 'bin'));
    for (const name of [
        'lib.mjs',
        'github-release.mjs',
        'runtime-version.mjs',
        'release-names.mjs',
        'release-info.mjs',
        'publish-release.mjs',
        'prepare-runtime.mjs',
    ]) {
        await copyFile(resolve(__dirname, name), resolve(directory, 'scripts', name));
    }
    await writeFile(
        resolve(root, 'project.json'),
        JSON.stringify({
            releases: {
                ffmpeg: {
                    releaseTag: 'ffmpeg-v{{version}}',
                    releaseTitle: 'FFmpeg {{version}}',
                    artifact: 'runtime-{{version}}',
                    sources: 'sources-{{version}}',
                },
            },
        })
    );
    await writeFile(resolve(directory, 'release/runtime-0.2.0.tar.gz'), 'runtime archive');
    await writeFile(resolve(directory, 'release/sources-0.2.0.tar.gz'), 'sources archive');
    lock = {
        runtimeVersion: '0.2.0',
        releaseBaseDownloadUrl: `https://github.com/${repository}/releases/download/${tag}`,
        runtimeArchive: { filename: 'runtime-0.2.0.tar.gz', sha256: hash, bytes: Buffer.byteLength(body) },
    };
    options = {
        releases: [
            {
                id: 42,
                tag_name: tag,
                draft: true,
                body: 'Maintainer release notes',
                assets: [
                    { id: 7, name: 'runtime-0.2.0.tar.gz', digest: `sha256:${hash}`, size: Buffer.byteLength(body) },
                ],
            },
        ],
    };
    // GitHub HTTP and gh mutations are the only fake boundaries. Run real scripts and cache writes.
    await writeFile(
        resolve(root, 'http.mjs'),
        `
        import { appendFile, readFile } from 'node:fs/promises';
        const root = ${JSON.stringify(root)};
        globalThis.fetch = async (url, init = {}) => {
            const options = JSON.parse(await readFile(root + '/options.json', 'utf8'));
            await appendFile(root + '/requests', JSON.stringify({ url, headers: Object.fromEntries(new Headers(init.headers)) }) + '\\n');
            const parsed = new URL(url);
            if (parsed.hostname !== 'api.github.com') {
                return new Response(${JSON.stringify(body)}, { status: options.publicStatus ?? 404 });
            }
            if (options.apiStatus) return new Response('', { status: options.apiStatus });
            if (parsed.pathname.includes('/git/ref/tags/')) return new Response('{}', { status: options.tagStatus ?? 404 });
            if (parsed.pathname.endsWith('/assets/7')) return new Response(options.body ?? ${JSON.stringify(body)});
            if (parsed.pathname.includes('/releases/tags/')) {
                const release = options.releases.find(r => !r.draft && r.tag_name === decodeURIComponent(parsed.pathname.split('/').pop()));
                return release ? Response.json(release) : new Response('', { status: 404 });
            }
            if (parsed.pathname.endsWith('/releases')) {
                if (Number(parsed.searchParams.get('page')) <= (options.pagesBeforeMatch ?? 0)) {
                    return Response.json(Array.from({ length: 100 }, (_, i) => ({ id: i, tag_name: 'unrelated-' + i, draft: true })));
                }
                return Response.json(options.releases);
            }
            const release = options.releases.find(r => r.id === Number(parsed.pathname.split('/').pop()));
            return release ? Response.json({ ...release, ...(options.publishBeforeUpload ? { draft: false } : {}) }) : new Response('', { status: 404 });
        };
    `
    );
    const gh = resolve(root, 'bin/gh');
    await writeFile(
        gh,
        `#!${process.execPath}
        const fs = require('node:fs');
        const root = ${JSON.stringify(root)};
        const args = process.argv.slice(2);
        const options = JSON.parse(fs.readFileSync(root + '/options.json', 'utf8'));
        fs.appendFileSync(root + '/gh-commands', JSON.stringify(args) + '\\n');
        if (args[0] === 'auth') {
            if (options.noAuth) process.exit(1);
            process.stdout.write('test-token');
        } else if (args[1] === 'upload' && options.publishAfterUpload) {
            options.releases[0].draft = false;
            fs.writeFileSync(root + '/options.json', JSON.stringify(options));
        }
    `
    );
    await chmod(gh, 0o755);
});
afterEach(async () => rm(root, { recursive: true, force: true }));

const save = async () => {
    await writeFile(resolve(root, 'options.json'), JSON.stringify(options));
    await writeFile(resolve(directory, 'artifact-lock.json'), JSON.stringify(lock));
};
const env = (overrides = {}) => ({
    ...process.env,
    ASB_FFMPEG_RUNTIME_VERSION: undefined,
    GH_TOKEN: 'test-token',
    GITHUB_TOKEN: '',
    GH_REPO: repository,
    GITHUB_REPOSITORY: repository,
    RELEASE_TAG: tag,
    RELEASE_TITLE: 'FFmpeg 0.2.0',
    RELEASE_ID: '42',
    GITHUB_SHA: target,
    FFMPEG_VERSION_BUMP: 'current',
    PATH: `${resolve(root, 'bin')}:${process.env.PATH}`,
    ...overrides,
});
const run = async (script, args = [], overrides = {}) => {
    await save();
    return exec(
        process.execPath,
        ['--import', resolve(root, 'http.mjs'), resolve(directory, 'scripts', script), ...args],
        { env: env(overrides) }
    );
};
const prepare = async (overrides = {}) => {
    await save();
    return exec(
        process.execPath,
        [
            '--import',
            resolve(root, 'http.mjs'),
            '--input-type=module',
            '-e',
            `
        import { prepareRuntime } from ${JSON.stringify(resolve(directory, 'scripts/prepare-runtime.mjs'))};
        console.log(await prepareRuntime(${JSON.stringify(lock)}, ${JSON.stringify(resolve(directory, '.cache/runtimes'))}));
    `,
        ],
        { env: env(overrides) }
    );
};
const lines = async (name) => {
    try {
        return (await readFile(resolve(root, name), 'utf8')).trim().split('\n').map(JSON.parse);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};
const mutations = async () => (await lines('gh-commands')).filter((args) => args[0] === 'release');

it('resolves the pending draft independently of the selected runtime and build override, including later pages', async () => {
    lock.runtimeVersion = '0.1.5';
    options.pagesBeforeMatch = 1;
    options.releases.push({ id: 43, tag_name: 'extension-v0.9.0', draft: true });
    const result = await run('release-info.mjs', ['--bump', 'current'], { ASB_FFMPEG_RUNTIME_VERSION: '0.9.0' });
    expect(result.stdout).toContain('version=0.2.0\n');
    expect(result.stdout).toContain('releaseId=42\n');
    expect(await readFile(resolve(directory, 'artifact-lock.json'), 'utf8')).toBe(JSON.stringify(lock));
    expect(await mutations()).toEqual([]);
});

it.each(
    [
        [],
        [{ id: 42, tag_name: tag, draft: false }],
        [
            { id: 42, tag_name: tag, draft: true },
            { id: 43, tag_name: 'ffmpeg-v0.2.1', draft: true },
        ],
        [{ id: 42, tag_name: 'ffmpeg-v0.02.0', draft: true }],
    ].map((releases) => [releases])
)('refuses current without exactly one canonical FFmpeg draft (%j)', async (releases) => {
    options.releases = releases;
    await expect(run('release-info.mjs', ['--bump', 'current'])).rejects.toThrow(
        'requires exactly one existing FFmpeg draft'
    );
    expect(await mutations()).toEqual([]);
});

it('replaces draft assets and updates their exact source commit without replacing release notes', async () => {
    await run('publish-release.mjs');
    const commands = await mutations();
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual([
        'release',
        'upload',
        tag,
        resolve(directory, 'release/runtime-0.2.0.tar.gz'),
        resolve(directory, 'release/sources-0.2.0.tar.gz'),
        '--repo',
        repository,
        '--clobber',
    ]);
    expect(commands[1]).toEqual(['release', 'edit', tag, '--repo', repository, '--target', target]);
});

it.each(['published', 'missing', 'replaced', 'published before upload'])(
    'refuses to mutate a draft that is %s after version resolution',
    async (state) => {
        if (state === 'published') options.releases[0].draft = false;
        if (state === 'missing') options.releases = [];
        if (state === 'replaced') options.releases[0].id = 43;
        if (state === 'published before upload') options.publishBeforeUpload = true;
        await expect(run('publish-release.mjs')).rejects.toThrow('draft only');
        expect(await mutations()).toEqual([]);
    }
);

it('rechecks draft state before updating the target commit', async () => {
    options.publishAfterUpload = true;
    await expect(run('publish-release.mjs')).rejects.toThrow('draft only');
    expect((await mutations()).map((args) => args[1])).toEqual(['upload']);
});

it.each(['patch', 'minor'])('creates a new draft for %s with the built commit as its source', async (bump) => {
    options.releases = [];
    await run('publish-release.mjs', [], { FFMPEG_VERSION_BUMP: bump, RELEASE_ID: '' });
    const [command] = await mutations();
    expect(command.slice(0, 3)).toEqual(['release', 'create', tag]);
    expect(command).toContain('--draft');
    expect(command[command.indexOf('--target') + 1]).toBe(target);
    expect(command).toContain('--latest=false');
});

it.each([true, false])('does not replace an existing release using a bump (draft=%s)', async (draft) => {
    options.releases[0].draft = draft;
    await expect(run('publish-release.mjs', [], { FFMPEG_VERSION_BUMP: 'minor' })).rejects.toThrow('already exists');
    expect(await mutations()).toEqual([]);
});

it.each([200, 403])('fails closed if the tag exists or cannot be checked (HTTP %s)', async (status) => {
    options.tagStatus = status;
    await expect(run('publish-release.mjs')).rejects.toThrow(
        status === 200 ? 'tag ffmpeg-v0.2.0 already exists' : 'Could not check'
    );
    expect(await mutations()).toEqual([]);
});

it('downloads a selected draft using the gh login, verifies it, and reuses the cache without authentication', async () => {
    const result = await prepare({ GH_TOKEN: '', GITHUB_TOKEN: '' });
    const path = result.stdout.trim();
    expect(await readFile(path, 'utf8')).toBe(body);
    const requests = await lines('requests');
    expect(requests[0].headers.authorization).toBeUndefined();
    expect(
        requests
            .filter(({ url }) => url.startsWith('https://api.github.com/'))
            .every(({ headers }) => headers.authorization === 'Bearer test-token')
    ).toBe(true);
    options.noAuth = true;
    options.apiStatus = 503;
    options.publicStatus = 503;
    await writeFile(resolve(root, 'requests'), '');
    expect((await prepare({ GH_TOKEN: '', GITHUB_TOKEN: '' })).stdout.trim()).toBe(path);
    expect(await readFile(resolve(root, 'requests'), 'utf8')).toBe('');
});

it.each(['metadata hash', 'metadata size', 'bytes'])(
    'rejects draft %s that differ from the lock without leaving a cached archive',
    async (change) => {
        if (change === 'metadata hash') options.releases[0].assets[0].digest = `sha256:${'0'.repeat(64)}`;
        if (change === 'metadata size') options.releases[0].assets[0].size++;
        if (change === 'bytes') options.body = 'corrupt bytes';
        await expect(prepare()).rejects.toThrow(
            change === 'bytes' ? 'SHA-256 or size mismatch' : 'differs from artifact-lock'
        );
        expect(await readdir(resolve(directory, '.cache/runtimes'))).toEqual([]);
    }
);

it('keeps an unavailable draft unavailable without credentials', async () => {
    options.noAuth = true;
    await expect(prepare({ GH_TOKEN: '', GITHUB_TOKEN: '' })).rejects.toThrow('HTTP 404');
    expect((await lines('requests')).some(({ url }) => url.startsWith('https://api.github.com/'))).toBe(false);
});

it('does not use credentials on a non-GitHub download location', async () => {
    lock.releaseBaseDownloadUrl = 'https://evil.example/releases/download/ffmpeg-v0.2.0';
    await expect(prepare()).rejects.toThrow('HTTP 404');
    expect((await lines('requests')).every(({ headers }) => !headers.authorization)).toBe(true);
    expect(await lines('gh-commands')).toEqual([]);
});

it('keeps successful public downloads anonymous even with an existing token', async () => {
    options.publicStatus = 200;
    const path = (await prepare()).stdout.trim();
    expect(await readFile(path, 'utf8')).toBe(body);
    expect((await lines('requests')).every(({ headers }) => !headers.authorization)).toBe(true);
    expect(await lines('gh-commands')).toEqual([]);
});
