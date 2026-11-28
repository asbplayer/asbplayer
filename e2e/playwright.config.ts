import { defineConfig, type PlaywrightTestOptions } from '@playwright/test';
import type { TestOptions } from './fixtures/extension';
import { APP_URL, DOCS_VIDEO_URL } from './fixtures/paths';

export default defineConfig<PlaywrightTestOptions & TestOptions>({
    testDir: '.',
    testMatch: /(tests|shots)\/.*\.spec\.ts/,
    timeout: 60_000,
    // Every worker launches its own Chromium with the extension loaded; keep this low.
    workers: 2,
    fullyParallel: true,
    reporter: [['list']],
    outputDir: 'test-results',
    globalSetup: './global-setup.ts',
    use: {
        trace: 'retain-on-failure',
        screenshot: 'off',
        video: 'off',
    },
    webServer: [
        {
            command: 'node pages/serve.mjs',
            url: DOCS_VIDEO_URL,
            reuseExistingServer: true,
        },
        {
            // The app build, served from the origin root.
            command: 'node pages/serve.mjs --root ../../client/dist --port 8932 --spa',
            url: APP_URL,
            reuseExistingServer: true,
        },
    ],
    projects: [
        // Fast, headless, assertion-driven; wired into `pnpm verify`.
        { name: 'test', testIgnore: /shots\//, use: { demoMode: false } },
        // Same specs, headless, with an injected cursor and pacing; recordings land in demo-videos/.
        { name: 'demo', testIgnore: /shots\//, use: { demoMode: true } },
        // Generates committed images and image-map data for the docs.
        { name: 'shots', testMatch: /shots\//, use: { demoMode: false } },
    ],
});
