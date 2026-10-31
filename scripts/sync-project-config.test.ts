import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generatedProjectFiles, syncProjectConfig } from './sync-project-config.ts';

const project = { ...JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8')), languages: [] };
const ankiPyproject = readFileSync(new URL('../plugins/anki/pyproject.toml', import.meta.url), 'utf8');

for (const codes of [[], ['zz'], ['zz', 'xy']]) {
    test(`initializes ${codes.length} configured languages from English without overwriting translations`, (t) => {
        const root = mkdtempSync(join(tmpdir(), 'asbplayer-language-'));
        t.after(() => rmSync(root, { recursive: true, force: true }));
        const write = (path: string, value: unknown) => {
            mkdirSync(join(root, path, '..'), { recursive: true });
            writeFileSync(join(root, path), JSON.stringify(value));
        };
        const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
        const common = { settings: { language: 'Language', label_one: 'One', label_other: 'Many' } };
        const extension = { extensionDescription: { message: 'Description' } };
        const external = { listingDescription: 'Listing' };
        const tracking = {
            common: { 'settings.language': 'Language', 'settings.label_one': 'One', 'settings.label_other': 'Many' },
            extension: { 'extensionDescription.message': 'Description' },
            external: { listingDescription: 'Listing' },
        };
        const config = {
            ...project,
            defaultLanguage: 'ja',
            languages: codes.map((code) => ({ code, version: 1 })),
        };
        write('project.json', config);
        write('common/locales/en.json', common);
        write('common/locales/unconfigured.json', { unused: true });
        write('extension/public/_locales/en/messages.json', extension);
        write('loc/external/en.json', external);
        mkdirSync(join(root, 'plugins/anki'), { recursive: true });
        writeFileSync(join(root, 'plugins/anki/pyproject.toml'), ankiPyproject);

        const stale = syncProjectConfig(root, true);
        assert.ok(stale.includes('common/extension.json'));
        assert.equal(existsSync(join(root, 'common/extension.json')), false);
        for (const code of codes) {
            assert.ok(stale.includes(`common/locales/${code}.json`));
            assert.equal(existsSync(join(root, `common/locales/${code}.json`)), false);
        }
        syncProjectConfig(root);
        assert.deepEqual(
            read('common/extension.json').languages.map(({ code }: { code: string }) => code),
            codes
        );
        assert.equal(existsSync(join(root, 'loc/untranslated/unconfigured.json')), false);
        for (const code of codes) {
            assert.deepEqual(read(`common/locales/${code}.json`), common);
            assert.deepEqual(read(`extension/public/_locales/${code}/messages.json`), extension);
            assert.deepEqual(read(`loc/external/${code}.json`), external);
            assert.deepEqual(read(`loc/untranslated/${code}.json`), tracking);
            write(`common/locales/${code}.json`, { translated: code });
            write(`loc/untranslated/${code}.json`, { common: {}, extension: {}, external: {} });
        }
        assert.deepEqual(syncProjectConfig(root, true), []);
        assert.deepEqual(syncProjectConfig(root), []);
        for (const code of codes) {
            assert.deepEqual(read(`common/locales/${code}.json`), { translated: code });
            assert.deepEqual(read(`loc/untranslated/${code}.json`), { common: {}, extension: {}, external: {} });
        }
        if (codes.length > 0) {
            const code = codes[0];
            rmSync(join(root, `loc/external/${code}.json`));
            assert.deepEqual(syncProjectConfig(root, true), [
                `loc/external/${code}.json`,
                `loc/untranslated/${code}.json`,
            ]);
            syncProjectConfig(root);
            assert.deepEqual(read(`loc/untranslated/${code}.json`), {
                common: {},
                extension: {},
                external: tracking.external,
            });
            rmSync(join(root, `loc/untranslated/${code}.json`));
            syncProjectConfig(root);
            assert.deepEqual(read(`loc/untranslated/${code}.json`), {
                common: {},
                extension: tracking.extension,
                external: tracking.external,
            });
            assert.deepEqual(read(`common/locales/${code}.json`), { translated: code });
        }
    });
}

test('publishes the released version without changing localization revisions or build version', () => {
    const config = { ...project, version: '4.0.0' };
    config.releases = {
        ...project.releases,
        extension: {
            publishedVersion: '3.2.1',
            releaseTitle: 'example-player-extension-v{{version}}',
            releaseTag: 'extension/{{version}}',
            sources: 'example-player-{{version}}-sources',
        },
    };
    const languages = [
        { code: 'en', version: 29 },
        { code: 'ja', version: 34 },
    ];
    config.languages = languages;
    config.languageUrl = 'https://translations.example/{{language}}/strings-{{language}}.json';
    const files = generatedProjectFiles(config);
    const feed = JSON.parse(files['common/extension.json']);
    assert.deepEqual(feed.latest, {
        version: '3.2.1',
        url: `${config.urls.repo}/releases/tag/extension%2F3.2.1`,
    });
    assert.deepEqual(feed.languages, [
        { code: 'en', version: 29, url: 'https://translations.example/en/strings-en.json' },
        { code: 'ja', version: 34, url: 'https://translations.example/ja/strings-ja.json' },
    ]);
    assert.deepEqual(config.languages, languages);
    assert.equal(config.version, '4.0.0');
});

test('converts readable Anki minimum versions to manifest integers, including optional patches', () => {
    for (const [version, expected] of [
        ['25.02', 250200],
        ['25.02.0', 250200],
        ['25.02.1', 250201],
        ['26.08.12', 260812],
    ] as const) {
        const config = structuredClone(project);
        config.releases.ankiAddon.minPointVersion = version;
        const files = generatedProjectFiles(config);
        assert.equal(JSON.parse(files['plugins/anki/asbplayer-addon/manifest.json']).min_point_version, expected);
    }
});

test('rejects malformed Anki minimum versions rather than generating an invalid compatibility limit', () => {
    for (const version of ['', '250200', '25', '25.00', '25.13', '25.02.100', '25.02rc1', '25.02.1.2']) {
        const config = structuredClone(project);
        config.releases.ankiAddon.minPointVersion = version;
        assert.throws(() => generatedProjectFiles(config), /minPointVersion must use YY\.MM/);
    }
});

test('packages changed service defaults and names for Python, Go, and the example environment', () => {
    const config = structuredClone(project);
    config.names.short = 'Example player';
    config.releases.ankiAddon = {
        package: 'example-addon',
        releaseTitle: 'example-ankiaddon-v{{version}}',
        artifact: 'example-player-{{version}}.ankiaddon',
        version: '2.3.4',
        minPointVersion: '26.08',
        releaseTag: 'example-addon-v{{version}}',
    };
    config.urls.repo = 'https://code.example/player';
    config.services.webSocket.host = 'socket.example.com';
    config.services.webSocket.port = 9876;
    config.services.webSocket.path = '/socket';
    config.services.webSocket.postMineAction = 1;
    config.services.ankiConnect.host = 'localhost';
    config.services.ankiConnect.port = 9875;
    const files = generatedProjectFiles(config);
    assert.deepEqual(JSON.parse(files['plugins/anki/asbplayer-addon/config.json']), {
        enabled: true,
        port: 9876,
        postMineAction: 1,
    });
    assert.deepEqual(JSON.parse(files['plugins/anki/asbplayer-addon/manifest.json']), {
        package: 'example-addon',
        name: 'Example player',
        human_version: '2.3.4',
        min_point_version: 260800,
        homepage: 'https://code.example/player',
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
        config.releases.ankiAddon.package = 'example-addon';
        config.releases.ankiAddon.version = '2.3.4';
        writeFileSync(join(root, 'project.json'), JSON.stringify(config));
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

        config.releases.ankiAddon.version = '2.3.5';
        writeFileSync(join(root, 'project.json'), JSON.stringify(config));
        assert.deepEqual(syncProjectConfig(root, true), [
            'plugins/anki/asbplayer-addon/manifest.json',
            'plugins/anki/pyproject.toml',
        ]);
        syncProjectConfig(root);
        config.releases.ankiAddon.package = 'renamed-example-addon';
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
