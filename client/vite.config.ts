import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import project from '../project.json' with { type: 'json' };
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import artifactLock from '@project/ffmpeg/artifact-lock.json';
import ffmpegBuildConfig from '@project/ffmpeg/build-config.json';
import { releaseNames } from '@project/ffmpeg/release-names';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    const appUrl = new URL(project.urls.app);
    if (env.VITE_APP_DOMAIN) appUrl.host = env.VITE_APP_DOMAIN;
    const domain = appUrl.host;
    const base = env.VITE_APP_BASE_PATH || '/';
    const candidate = ['1', 'true'].includes(env.VITE_FFMPEG_CANDIDATE?.toLowerCase());
    const runtimeVersion = candidate ? project.artifacts.ffmpeg.version : artifactLock.runtimeVersion;
    const ffmpegVersion = candidate ? ffmpegBuildConfig.ffmpeg.version : artifactLock.ffmpegVersion;
    const runtimeArchiveFilename = releaseNames(runtimeVersion).runtimeArchive;
    const candidateArchivePath = path.resolve(__dirname, `../ffmpeg/release/${runtimeArchiveFilename}`);
    // Vite's static server labels stored *.gz files as Content-Encoding: gzip, so the browser would
    // decode the archive before it can be verified. GitHub serves release assets as plain bytes.
    const candidateArchiveServedName = runtimeArchiveFilename.replace(/\.tar\.gz$/, '.tgz');
    let runtimeArchive = {
        url: `${artifactLock.releaseBaseDownloadUrl}/${artifactLock.runtimeArchive.filename}`,
        sha256: artifactLock.runtimeArchive.sha256,
        bytes: artifactLock.runtimeArchive.bytes,
    };
    if (candidate) {
        execFileSync(
            process.execPath,
            [path.resolve(__dirname, '../ffmpeg/scripts/verify-artifacts.mjs'), '--candidate'],
            { stdio: 'inherit' }
        );
        const bytes = readFileSync(candidateArchivePath);
        runtimeArchive = {
            url: `${base.replace(/\/?$/, '/')}ffmpeg/${candidateArchiveServedName}`,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            bytes: bytes.byteLength,
        };
    }
    const releaseApiUrl = candidate
        ? null
        : artifactLock.releaseUrl
              .replace('https://github.com/', 'https://api.github.com/repos/')
              .replace('/releases/tag/', '/releases/tags/');
    return {
        base,
        define: {
            __ASB_FFMPEG_RUNTIME_ARCHIVE__: JSON.stringify(runtimeArchive),
            __ASB_FFMPEG_RELEASE_API_URL__: JSON.stringify(releaseApiUrl),
            __ASB_FFMPEG_RUNTIME_VERSION__: JSON.stringify(runtimeVersion),
            __ASB_FFMPEG_VERSION__: JSON.stringify(ffmpegVersion),
        },
        resolve: {
            tsconfigPaths: true,
        },
        build: {
            sourcemap: true,
        },
        plugins: [
            react(),
            createHtmlPlugin({
                inject: {
                    data: {
                        projectName: project.names.short,
                        defaultLanguage: project.defaultLanguage,
                        plausible:
                            mode === 'production'
                                ? `<script defer data-domain="${domain}" src="https://plausible.io/js/script.js"></script>`
                                : '',
                        url: new URL(base, appUrl).href,
                    },
                },
            }),
            viteStaticCopy({
                targets: [
                    {
                        src: '../common/locales',
                        dest: '',
                    },
                    {
                        src: '../common/assets',
                        dest: '',
                    },
                    {
                        src: '../common/extension.json',
                        dest: '',
                    },
                    ...(candidate
                        ? [{ src: candidateArchivePath, dest: 'ffmpeg', rename: candidateArchiveServedName }]
                        : []),
                ],
            }),
            VitePWA({
                strategies: 'generateSW',
                registerType: 'prompt',
                includeAssets: ['locales/*.json', 'background-colored.png'],
                manifest: {
                    short_name: project.names.short,
                    name: project.names.long,
                    description: 'A browser-based media player for mining sentences from subtitles',
                    icons: [
                        {
                            src: 'favicon.ico',
                            sizes: '48x48 32x32 16x16',
                            type: 'image/x-icon',
                        },
                        {
                            src: 'logo192.png',
                            type: 'image/png',
                            sizes: '192x192',
                        },
                        {
                            src: 'logo512.png',
                            type: 'image/png',
                            sizes: '512x512',
                        },
                    ],
                    start_url: '.',
                    display: 'standalone',
                    theme_color: '#000000',
                    background_color: '#ffffff',
                    orientation: 'any',
                },
                devOptions: {
                    enabled: false,
                },
                workbox: {
                    clientsClaim: true,
                    cleanupOutdatedCaches: true,
                    navigateFallback: 'index.html',
                    navigateFallbackDenylist: [/\/ffmpeg\//],
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,txt}'],
                    globIgnores: ['**/ffmpeg/**'],
                    sourcemap: true,
                },
            }),
        ],
        server: {
            open: true,
            host: project.development.host,
            port: project.development.port,
        },
    };
});
