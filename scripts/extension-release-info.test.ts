import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extensionReleaseInfo } from './extension-release-info.ts';

test('keeps workflow filenames consistent with the WXT templates for every extension target', () => {
    const info = extensionReleaseInfo({
        version: '2.3.4',
        artifacts: {
            extension: { prefix: 'example-player', tagPrefix: 'extension-v' },
            ankiAddon: { version: '1.0.0', package: 'example-addon', tagPrefix: 'addon-v' },
            webSocketServer: 'example-ws',
        },
    });
    for (const [browser, filename] of [
        ['chrome', info.chrome],
        ['firefox', info.firefox],
        ['firefox-android', info.firefoxAndroid],
    ]) {
        assert.equal(filename, `example-player-2.3.4-${browser}.zip`);
        assert.equal(
            info.artifactTemplate.replaceAll('{{version}}', '2.3.4').replaceAll('{{browser}}', browser),
            filename
        );
    }
    assert.equal(info.sources, 'example-player-2.3.4-sources.zip');
    assert.equal(info.sourcesTemplate.replaceAll('{{version}}', '2.3.4'), info.sources);
    assert.equal(info.title, 'example-player-extension-v2.3.4');
    assert.equal(info.tag, 'extension-v2.3.4');
});

test('CLI reads its project configuration and honors the draft workflow version override', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-extension-release-'));
    try {
        mkdirSync(join(root, 'scripts'));
        const script = join(root, 'scripts/extension-release-info.ts');
        copyFileSync(new URL('./extension-release-info.ts', import.meta.url), script);
        writeFileSync(
            join(root, 'project.json'),
            JSON.stringify({
                version: '2.3.4',
                artifacts: { extension: { prefix: 'example-player', tagPrefix: 'extension-v' } },
            })
        );
        const run = (...args: string[]) =>
            execFileSync(process.execPath, ['--experimental-strip-types', script, ...args], {
                cwd: tmpdir(),
                encoding: 'utf8',
                stdio: 'pipe',
            });
        const outputs = Object.fromEntries(
            run()
                .trim()
                .split('\n')
                .map((line) => line.split('='))
        );
        assert.equal(outputs.version, '2.3.4');
        assert.equal(outputs.tag, 'extension-v2.3.4');
        assert.equal(outputs.chrome, 'example-player-2.3.4-chrome.zip');
        assert.equal(outputs.firefox, 'example-player-2.3.4-firefox.zip');
        assert.equal(outputs.firefoxAndroid, 'example-player-2.3.4-firefox-android.zip');
        assert.equal(run('title', '2.3.3'), 'example-player-extension-v2.3.3\n');
        assert.equal(run('title'), 'example-player-extension-v2.3.4\n');
        assert.equal(run('tag', '2.3.3'), 'extension-v2.3.3\n');
        assert.equal(run('tag'), 'extension-v2.3.4\n');
        assert.equal(run('sources'), 'example-player-2.3.4-sources.zip\n');
        assert.throws(() => run('missing'), /Unknown extension release field: missing/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('milestone collection uses the configured tag prefix for both default and requested versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-extension-milestone-'));
    try {
        mkdirSync(join(root, 'scripts/release-notes'), { recursive: true });
        mkdirSync(join(root, 'bin'));
        const script = join(root, 'scripts/release-notes/collect-milestone-items.sh');
        copyFileSync(new URL('./release-notes/collect-milestone-items.sh', import.meta.url), script);
        copyFileSync(
            new URL('./extension-release-info.ts', import.meta.url),
            join(root, 'scripts/extension-release-info.ts')
        );
        writeFileSync(
            join(root, 'project.json'),
            JSON.stringify({
                version: '2.3.4',
                artifacts: { extension: { prefix: 'example-player', tagPrefix: 'extension-v' } },
            })
        );
        const calls = join(root, 'gh-calls.jsonl');
        writeFileSync(
            join(root, 'bin/gh'),
            [
                `#!${process.execPath}`,
                "const { appendFileSync } = require('node:fs');",
                'const args = process.argv.slice(2);',
                "appendFileSync(process.env.GH_CALLS, JSON.stringify(args) + '\\n');",
                "if (args[0] !== 'api') process.exit(1);",
                "if (args.some((arg) => arg.includes('/milestones?'))) process.stdout.write('42\\n');",
                "else if (args.some((arg) => arg.includes('/issues?'))) process.exit(0);",
                "else if (args.some((arg) => arg.endsWith('/releases/generate-notes'))) {",
                "    const tag = args.find((arg) => arg.startsWith('tag_name=')).slice('tag_name='.length);",
                "    process.stdout.write('**Full Changelog**: https://github.com/example/player/compare/extension-v2.3.2...' + tag + '\\n');",
                '} else process.exit(1);',
                '',
            ].join('\n'),
            { mode: 0o755 }
        );
        for (const [args, version] of [
            [[], '2.3.4'],
            [['2.3.3'], '2.3.3'],
        ] as const) {
            writeFileSync(calls, '');
            execFileSync('bash', [script, ...args], {
                cwd: root,
                env: {
                    ...process.env,
                    PATH: `${join(root, 'bin')}:${process.env.PATH}`,
                    GH_CALLS: calls,
                    GITHUB_REPOSITORY: 'example/player',
                    RELEASE_TARGET: 'example-branch',
                },
                stdio: 'pipe',
            });
            const metadata = JSON.parse(readFileSync(join(root, 'release-meta.json'), 'utf8'));
            assert.equal(metadata.version, version);
            assert.equal(metadata.milestone, `Extension v${version}`);
            assert.equal(
                metadata.compare_url,
                `https://github.com/example/player/compare/extension-v2.3.2...extension-v${version}`
            );
            const requests = readFileSync(calls, 'utf8')
                .trim()
                .split('\n')
                .map((line) => JSON.parse(line) as string[]);
            const generateNotes = requests.find((args) =>
                args.includes('repos/example/player/releases/generate-notes')
            )!;
            assert.ok(generateNotes.includes(`tag_name=extension-v${version}`));
            assert.ok(generateNotes.includes('target_commitish=example-branch'));
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
