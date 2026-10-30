import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { extensionReleaseInfo } from './extension-release-info.ts';

const releaseProject = () => ({
    version: '2.3.4',
    releases: {
        extension: {
            publishedVersion: '2.3.3',
            releaseTitle: 'example-player-extension-v{{version}}',
            releaseTag: 'extension-v{{version}}',
            sources: 'example-player-{{version}}-sources',
        },
    },
    extension: {
        chrome: { artifact: 'example-player-chrome-{{version}}' },
        firefox: { artifact: 'example-player-firefox-{{version}}' },
        firefoxAndroid: { artifact: 'example-player-firefox-android-{{version}}' },
    },
});

test('keeps workflow filenames consistent with the WXT templates for every extension target', () => {
    const info = extensionReleaseInfo(releaseProject());
    for (const [browser, filename, template] of [
        ['chrome', info.chrome, info.chromeTemplate],
        ['firefox', info.firefox, info.firefoxTemplate],
        ['firefox-android', info.firefoxAndroid, info.firefoxAndroidTemplate],
    ]) {
        assert.equal(filename, `example-player-${browser}-2.3.4`);
        assert.equal(template.replaceAll('{{version}}', '2.3.4'), filename);
    }
    assert.equal(info.sources, 'example-player-2.3.4-sources');
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
        writeFileSync(join(root, 'project.json'), JSON.stringify(releaseProject()));
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
        assert.equal(outputs.chrome, 'example-player-chrome-2.3.4');
        assert.equal(outputs.firefox, 'example-player-firefox-2.3.4');
        assert.equal(outputs.firefoxAndroid, 'example-player-firefox-android-2.3.4');
        assert.equal(run('title', '2.3.3'), 'example-player-extension-v2.3.3\n');
        assert.equal(run('title'), 'example-player-extension-v2.3.4\n');
        assert.equal(run('tag', '2.3.3'), 'extension-v2.3.3\n');
        assert.equal(run('tag'), 'extension-v2.3.4\n');
        assert.equal(run('sources'), 'example-player-2.3.4-sources\n');
        assert.throws(() => run('missing'), /Unknown extension release field: missing/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('milestone collection uses the configured release tag template for both default and requested versions', () => {
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
        writeFileSync(join(root, 'project.json'), JSON.stringify(releaseProject()));
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
