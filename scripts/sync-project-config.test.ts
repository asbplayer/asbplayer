import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generatedProjectFiles, syncProjectConfig } from './sync-project-config.ts';

const project = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8'));
const ankiPyproject = readFileSync(new URL('../plugins/anki/pyproject.toml', import.meta.url), 'utf8');

test('publishes the released version without changing localization revisions or build version', () => {
    const config = { ...project, version: '4.0.0', publishedVersion: '3.2.1' };
    config.artifacts = { ...project.artifacts, extension: { prefix: 'example-player', tagPrefix: 'extension/' } };
    const languages = [
        { code: 'en', version: 29, url: '/locales/en.json' },
        { code: 'ja', version: 34, url: '/locales/ja.json' },
    ];
    const files = generatedProjectFiles(config, { latest: { version: '1.0.0' }, languages });
    const feed = JSON.parse(files['common/extension.json']);
    assert.deepEqual(feed.latest, {
        version: '3.2.1',
        url: `${config.urls.repo}/releases/tag/extension%2F3.2.1`,
    });
    assert.deepEqual(feed.languages, languages);
    assert.equal(config.version, '4.0.0');
});

test('packages changed service defaults and names for Python, Go, and the example environment', () => {
    const config = structuredClone(project);
    config.names.short = 'Example player';
    config.artifacts.ankiAddon = {
        package: 'example-addon',
        version: '2.3.4',
        tagPrefix: 'example-addon-v',
    };
    config.services.webSocket.host = 'socket.example.com';
    config.services.webSocket.port = 9876;
    config.services.webSocket.path = '/socket';
    config.services.webSocket.postMineAction = 1;
    config.services.ankiConnect.host = 'localhost';
    config.services.ankiConnect.port = 9875;
    const files = generatedProjectFiles(config, { languages: [] });
    assert.deepEqual(JSON.parse(files['plugins/anki/asbplayer-addon/config.json']), {
        enabled: true,
        port: 9876,
        postMineAction: 1,
    });
    assert.deepEqual(JSON.parse(files['plugins/anki/asbplayer-addon/manifest.json']), {
        package: 'example-addon',
        name: 'Example player',
        human_version: '2.3.4',
    });
    const go = files['scripts/web-socket-server/project_config.go'];
    assert.match(go, /defaultWebSocketPort = "9876"/);
    assert.match(go, /defaultWebSocketPath = "\/socket"/);
    assert.match(go, /defaultAnkiConnectURL = "http:\/\/localhost:9875"/);
    assert.match(go, /defaultPostMineAction = "1"/);
    const environment = files['scripts/web-socket-server/.env.example'];
    assert.match(environment, /^PORT=9876$/m);
    assert.match(environment, /^ANKI_CONNECT_URL=http:\/\/localhost:9875$/m);
    assert.match(environment, /^POST_MINE_ACTION=1$/m);
    const addonHelp = files['plugins/anki/asbplayer-addon/config.md'];
    assert.match(addonHelp, /# Example player Add-on Configuration/);
    assert.match(addonHelp, /port \(default: `9876`\)/);
    assert.match(addonHelp, /ws:\/\/socket\.example\.com:9876\/socket/);
    assert.match(addonHelp, /after mining a word \(default: `1`\)/);
});

test('check mode reports missing or stale outputs without writing and synchronization is repeatable', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-project-'));
    try {
        mkdirSync(join(root, 'common'));
        mkdirSync(join(root, 'plugins/anki'), { recursive: true });
        writeFileSync(join(root, 'project.json'), JSON.stringify(project));
        writeFileSync(join(root, 'common/extension.json'), JSON.stringify({ languages: [] }));
        writeFileSync(join(root, 'plugins/anki/pyproject.toml'), ankiPyproject);
        assert.equal(syncProjectConfig(root, true).length, 6);
        assert.equal(syncProjectConfig(root).length, 6);
        assert.deepEqual(syncProjectConfig(root, true), []);
        assert.deepEqual(syncProjectConfig(root), []);
        const path = join(root, 'plugins/anki/asbplayer-addon/config.json');
        writeFileSync(path, '{}\n');
        assert.deepEqual(syncProjectConfig(root, true), ['plugins/anki/asbplayer-addon/config.json']);
        assert.equal(readFileSync(path, 'utf8'), '{}\n');
        syncProjectConfig(root);
        assert.deepEqual(syncProjectConfig(root, true), []);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('syncs the Python project name and version and checks drift without changing other tooling settings', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-anki-version-'));
    try {
        mkdirSync(join(root, 'common'));
        mkdirSync(join(root, 'plugins/anki'), { recursive: true });
        const config = structuredClone(project);
        config.artifacts.ankiAddon.package = 'example-addon';
        config.artifacts.ankiAddon.version = '2.3.4';
        writeFileSync(join(root, 'project.json'), JSON.stringify(config));
        writeFileSync(join(root, 'common/extension.json'), JSON.stringify({ languages: [] }));
        const path = join(root, 'plugins/anki/pyproject.toml');
        const original = [
            '# Local development environment',
            '[project] # Metadata',
            'name = "dev-environment" # Synced package name',
            "version = '1.0.0' # Synced release version",
            'requires-python = ">=3.13"',
            '',
            '[tool.example]',
            'name = "independent"',
            'version = "independent"',
            '',
        ].join('\n');
        writeFileSync(path, original);
        assert.ok(syncProjectConfig(root, true).includes('plugins/anki/pyproject.toml'));
        assert.equal(readFileSync(path, 'utf8'), original);
        syncProjectConfig(root);
        assert.equal(
            readFileSync(path, 'utf8'),
            original.replace('"dev-environment"', '"example-addon"').replace("'1.0.0'", '"2.3.4"')
        );
        assert.deepEqual(syncProjectConfig(root, true), []);

        config.artifacts.ankiAddon.version = '2.3.5';
        writeFileSync(join(root, 'project.json'), JSON.stringify(config));
        assert.deepEqual(syncProjectConfig(root, true), [
            'plugins/anki/asbplayer-addon/manifest.json',
            'plugins/anki/pyproject.toml',
        ]);
        syncProjectConfig(root);
        config.artifacts.ankiAddon.package = 'renamed-example-addon';
        writeFileSync(join(root, 'project.json'), JSON.stringify(config));
        assert.deepEqual(syncProjectConfig(root, true), [
            'plugins/anki/asbplayer-addon/manifest.json',
            'plugins/anki/pyproject.toml',
        ]);
        syncProjectConfig(root);
        assert.equal(
            readFileSync(path, 'utf8'),
            original.replace('"dev-environment"', '"renamed-example-addon"').replace("'1.0.0'", '"2.3.5"')
        );
        assert.deepEqual(syncProjectConfig(root, true), []);

        for (const key of ['name', 'version']) {
            const other = key === 'name' ? 'version = "1.0.0"' : 'name = "dev-environment"';
            for (const lines of ['', `${key} = "first"\n${key} = "second"`]) {
                const malformed = `[project]\n${other}\n${lines}\n`;
                writeFileSync(path, malformed);
                assert.throws(() => syncProjectConfig(root), new RegExp(`Expected exactly one \\[project\\] ${key}`));
                assert.equal(readFileSync(path, 'utf8'), malformed);
            }
        }
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
