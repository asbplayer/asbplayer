import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import project from '../project.json' with { type: 'json' };
import { createFfmpegBuildConfig } from '@project/client/ffmpeg-build';

export default defineConfig(async ({ mode, isPreview }) => {
    const env = loadEnv(mode, process.cwd());
    const appUrl = new URL(project.urls.app);
    if (env.VITE_APP_DOMAIN) appUrl.host = env.VITE_APP_DOMAIN;
    const domain = appUrl.host;
    const base = env.VITE_APP_BASE_PATH || '/';
    const candidate = ['1', 'true'].includes(env.VITE_FFMPEG_CANDIDATE?.toLowerCase());
    const ffmpeg = await createFfmpegBuildConfig({ candidate, base, prepare: !isPreview });
    return {
        base,
        define: ffmpeg.define,
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
                    ...ffmpeg.copyTargets,
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
                    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
