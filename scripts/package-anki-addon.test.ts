import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ankiReleaseInfo } from './anki-release-info.ts';

test('rejects release metadata that could escape the output directory or corrupt workflow outputs', () => {
    const artifact = {
        package: 'example-addon',
        releaseTitle: 'example-ankiaddon-v{{version}}',
        artifact: 'example-player-{{version}}.ankiaddon',
        version: '2.3.4',
        minPointVersion: '25.02',
        releaseTag: 'custom-anki-v{{version}}',
    };
    for (const filename of ['../outside', 'nested/addon', 'nested\\addon', 'addon\0', 'addon\nfilename=other']) {
        assert.throws(() => ankiReleaseInfo({ ...artifact, artifact: filename }), /filename|newlines/);
    }
    assert.throws(() => ankiReleaseInfo({ ...artifact, releaseTitle: 'addon\ntitle=other' }), /newlines/);
    assert.throws(() => ankiReleaseInfo({ ...artifact, releaseTag: 'tag\rtitle=other' }), /newlines/);
});

test('packages the configured add-on version while keeping its installed identity stable across bumps', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-anki-package-'));
    try {
        const addonRoot = join(root, 'plugins/anki/asbplayer-addon');
        mkdirSync(addonRoot, { recursive: true });
        mkdirSync(join(root, 'scripts'));
        mkdirSync(join(root, 'common'));
        copyFileSync(new URL('../plugins/anki/package.sh', import.meta.url), join(root, 'plugins/anki/package.sh'));
        copyFileSync(
            new URL('./sync-project-config.ts', import.meta.url),
            join(root, 'scripts/sync-project-config.ts')
        );
        copyFileSync(new URL('./anki-release-info.ts', import.meta.url), join(root, 'scripts/anki-release-info.ts'));
        copyFileSync(
            new URL('../plugins/anki/pyproject.toml', import.meta.url),
            join(root, 'plugins/anki/pyproject.toml')
        );
        writeFileSync(join(addonRoot, '__init__.py'), '# Test add-on payload\n');

        const project = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8'));
        project.languages = [];
        project.version = '9.0.0';
        project.names.short = 'Example player';
        project.urls.repo = 'https://code.example/player';
        project.releases.ankiAddon = {
            package: 'example-addon',
            releaseTitle: 'example-ankiaddon-v{{version}}',
            artifact: 'example-player-{{version}}.ankiaddon',
            version: '2.3.4',
            minPointVersion: '25.02',
            releaseTag: 'custom-anki-v{{version}}',
        };
        const packageAddon = () => {
            writeFileSync(join(root, 'project.json'), JSON.stringify(project));
            execFileSync('bash', [join(root, 'plugins/anki/package.sh')], { stdio: 'pipe' });
        };
        const readManifest = (version: string) => {
            const archive = join(root, `plugins/anki/example-player-${version}.ankiaddon`);
            assert.equal(
                execFileSync('unzip', ['-p', archive, '__init__.py'], { encoding: 'utf8' }),
                '# Test add-on payload\n'
            );
            return JSON.parse(execFileSync('unzip', ['-p', archive, 'manifest.json'], { encoding: 'utf8' }));
        };

        packageAddon();
        assert.equal(
            execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/anki-release-info.ts')], {
                encoding: 'utf8',
                stdio: 'pipe',
            }),
            'version=2.3.4\nfilename=example-player-2.3.4.ankiaddon\ntag=custom-anki-v2.3.4\ntitle=example-ankiaddon-v2.3.4\n'
        );
        assert.match(readFileSync(join(root, 'plugins/anki/pyproject.toml'), 'utf8'), /^version = "2.3.4"$/m);
        assert.match(readFileSync(join(root, 'plugins/anki/pyproject.toml'), 'utf8'), /^name = "example-addon"$/m);
        assert.deepEqual(readManifest('2.3.4'), {
            package: 'example-addon',
            name: 'Example player',
            human_version: '2.3.4',
            min_point_version: 250200,
            homepage: 'https://code.example/player',
        });
        writeFileSync(join(addonRoot, 'obsolete.py'), '# Must not survive a rebuild\n');
        packageAddon();
        rmSync(join(addonRoot, 'obsolete.py'));
        packageAddon();
        const inventory = execFileSync('unzip', ['-Z1', join(root, 'plugins/anki/example-player-2.3.4.ankiaddon')], {
            encoding: 'utf8',
        });
        assert.doesNotMatch(inventory, /obsolete\.py/);
        project.releases.ankiAddon.version = '2.3.5';
        project.releases.ankiAddon.minPointVersion = '26.08';
        packageAddon();
        assert.match(readFileSync(join(root, 'plugins/anki/pyproject.toml'), 'utf8'), /^version = "2.3.5"$/m);
        assert.match(readFileSync(join(root, 'plugins/anki/pyproject.toml'), 'utf8'), /^name = "example-addon"$/m);
        assert.deepEqual(readManifest('2.3.5'), {
            package: 'example-addon',
            name: 'Example player',
            human_version: '2.3.5',
            min_point_version: 260800,
            homepage: 'https://code.example/player',
        });
        assert.equal(readManifest('2.3.4').human_version, '2.3.4');
        assert.equal(readManifest('2.3.4').min_point_version, 250200);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
