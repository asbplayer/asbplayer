import { defineConfig } from 'wxt';
import type { ResolvedPublicFile, UserManifest, Wxt } from 'wxt';
import fs from 'node:fs';
import path from 'node:path';

const commonAssets = [
    { srcDir: path.resolve(__dirname, '../common/locales'), destDir: 'asbplayer-locales' },
    { srcDir: path.resolve(__dirname, '../common/assets'), destDir: 'assets' },
];

const moveToPublicAssets = (srcPath: string, destPath: string, files: ResolvedPublicFile[]) => {
    const srcFiles = fs.readdirSync(srcPath);
    for (const file of srcFiles) {
        files.push({
            absoluteSrc: path.resolve(srcPath, file) as string,
            relativeDest: `${destPath}/${file}`,
        });
    }
};

const addToPublicPathsType = (srcPath: string, destPath: string, paths: string[]) => {
    const srcFiles = fs.readdirSync(srcPath);
    for (const file of srcFiles) {
        paths.push(`${destPath}/${file}`);
    }
};

const extName = 'asbplayer';

// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/module-react'],
    srcDir: 'src',
    vite: () => ({
        plugins: [
            {
                name: 'watch-common',
                configureServer(server) {
                    server.watcher.add(path.resolve(__dirname, '../common'));
                },
            },
        ],
    }),
    zip: {
        sourcesRoot: '..',
        includeSources: ['.yarn/patches/**'],
        artifactTemplate: `${extName}-{{version}}-{{browser}}.zip`,
        sourcesTemplate: `${extName}-{{version}}-sources.zip`,
    },
    hooks: {
        'build:publicAssets': (wxt: Wxt, files: ResolvedPublicFile[]) => {
            for (const { srcDir, destDir } of commonAssets) {
                moveToPublicAssets(srcDir, destDir, files);
            }
        },
        'prepare:publicPaths': (wxt: Wxt, paths: string[]) => {
            for (const { srcDir, destDir } of commonAssets) {
                addToPublicPathsType(srcDir, destDir, paths);
            }
            paths.push('content-scripts/video.css');
        },
    },
    manifest: ({ browser, mode }) => {
        const version = '1.18.0';
        const isDev = mode === 'development';
        const devLabel = isDev ? ' (Dev)' : '';
        const title = `${extName}${devLabel}`;
        const name = `${title}: Language-learning with subtitles`;

        let manifest: UserManifest = {
            name,
            description: '__MSG_extensionDescription__',
            version,
            action: { default_title: title },
            default_locale: 'en',
            icons: {
                '16': 'icon/icon16.png',
                '48': 'icon/icon48.png',
                '128': 'icon/icon128.png',
            },
            web_accessible_resources: [
                {
                    resources: [
                        'chunks/*',
                        'fonts/*',
                        'asbplayer-locales/*',
                        'icon/image.png',
                        'netflix-page.js',
                        'youtube-page.js',
                        'stremio-page.js',
                        'tver-page.js',
                        'bandai-channel-page.js',
                        'amazon-prime-page.js',
                        'hulu-page.js',
                        'iwanttfc-page.js',
                        'disney-plus-page.js',
                        'apps-disney-plus-page.js',
                        'viki-page.js',
                        'unext-page.js',
                        'emby-jellyfin-page.js',
                        'osnplus-page.js',
                        'bilibili-page.js',
                        'nrk-tv-page.js',
                        'plex-page.js',
                        'areena-yle-page.js',
                        'hbo-max-page.js',
                        'cijapanese-page.js',
                        'svt-play-page.js',
                        'ur-play-page.js',
                        'hulu-jp-page.js',
                        'anki-ui.js',
                        'mp3-encoder-worker.js',
                        'pgs-parser-worker.js',
                        'video-data-sync-ui.js',
                        'video-select-ui.js',
                        'notification-ui.js',
                        'mobile-video-overlay-ui.html',
                        'statistics-overlay-ui.html',
                        'statistics-overlay-one-uncollected-ui.html',
                        'statistics-overlay-one-uncollected-ui.js',
                        'page-favicons/*',
                        'content-scripts/video.css',
                    ],
                    matches: ['<all_urls>'],
                },
            ],
        };

        let commands: Browser.runtime.Manifest['commands'] = {
            'copy-subtitle': {
                description: '__MSG_shortcutMineSubtitleDescription__',
            },
            'copy-subtitle-with-dialog': {
                suggested_key: {
                    default: 'Ctrl+Shift+X',
                    mac: 'MacCtrl+Shift+X',
                },
                description: '__MSG_shortcutMineSubtitleAndOpenDialogDescription__',
            },
            'update-last-card': {
                suggested_key: {
                    default: 'Ctrl+Shift+U',
                    mac: 'MacCtrl+Shift+U',
                },
                description: '__MSG_shortcutUpdateLastCardDescription__',
            },
            'toggle-video-select': {
                suggested_key: {
                    default: 'Ctrl+Shift+F',
                    mac: 'MacCtrl+Shift+F',
                },
                description: '__MSG_shortcutSelectSubtitleTrackDescription__',
            },
            'export-card': {
                description: '__MSG_shortcutExportCardDescription__',
            },
            'take-screenshot': {
                description: '__MSG_shortcutTakeScreenshotDescription__',
            },
            'toggle-recording': {
                description: '__MSG_shortcutToggleRecordingDescription__',
            },
        };

        if (isDev) {
            commands['wxt:reload-extension'] = {
                description: 'Reload the extension during development',
                // Normally there is a suggested key for this, but Chrome only supports up to 4 suggested keys.
                // suggested_key: {
                //     default: 'Alt+R',
                // },
            };
        }

        let permissions = ['tabs', 'storage', 'unlimitedStorage'];

        if (browser === 'chrome') {
            permissions = [...permissions, 'tabCapture', 'activeTab', 'contextMenus', 'sidePanel', 'offscreen'];

            const key = isDev
                ? {}
                : {
                      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxmdAa3ymqAjLms43ympXqtyuJnC2bSYh70+5ZZmtyx/MsnGhTEdfbqtsp3BKxHbv0rPd49+Joacm1Shik5/mCppZ0h4I4ISMm983X01H6p/hfAzQYAcnvw/ZQNHAv1QgY9JiuyTBirCDoYB50Fxol/kI/0EviYXuX83KoYpjB0VGP/ssY9ocT//fQUbRmeLDJnciry8y6MduWXHzseOP99axQIjeVsNTE30L4fRN+ppX3aOkG/RFJNx0eI02qbLul3qw5dUuBK5GgMbYftwjHnDoOegnZYFr1sxRO1zsgmxdp/6du75RiDPRJOkPCz2GTrw4CX2FCywbDZlqaIpwqQIDAQAB',
                  };

            manifest = {
                ...manifest,
                ...key,
                minimum_chrome_version: '116',
                commands,
            };
        }

        if (browser === 'firefox') {
            permissions = [...permissions, 'contextMenus', 'webRequest', 'webRequestBlocking', 'clipboardWrite'];

            commands = {
                _execute_sidebar_action: {
                    description: '__MSG_shortcutOpenSidePanel__',
                },
                ...commands,
            };

            const gecko = isDev
                ? {
                      id: `${extName}-dev-${version}@example.com`,
                  }
                : {
                      id: '{e4b27483-2e73-4762-b2ec-8d988a143a40}',
                  };

            manifest = {
                ...manifest,
                host_permissions: ['<all_urls>'],
                sidebar_action: {
                    default_panel: 'index.html',
                },
                commands,
                browser_specific_settings: {
                    gecko,
                },
            };
        }

        if (browser === 'firefox-android') {
            permissions = [...permissions, 'webRequest', 'webRequestBlocking', 'clipboardWrite'];

            const geckoId = isDev
                ? `${extName}-android-dev-${version}@example.com`
                : '{49de9206-c73e-4829-be4d-bda770d7f4b5}';

            manifest = {
                ...manifest,
                host_permissions: ['<all_urls>'],
                browser_specific_settings: {
                    gecko: {
                        id: geckoId,
                    },
                    gecko_android: {},
                },
            };
        }

        return {
            ...manifest,
            permissions,
        };
    },
});
