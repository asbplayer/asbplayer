import {
    test as base,
    chromium,
    expect,
    type BrowserContext,
    type FrameLocator,
    type Locator,
    type Page,
    type Worker,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_VIDEO_DIR, DOCS_VIDEO_URL, EXTENSION_DIR } from './paths';
import { injectCursor } from './cursor';

export { expect };

export type Ext = {
    context: BrowserContext;
    extensionId: string;
    demoMode: boolean;
    /** Runs one interaction, pausing after each step in demo mode for watchable recordings. */
    step: (name: string, fn: () => Promise<void>) => Promise<void>;
    /** Glides the cursor before clicking in demo mode; plain click otherwise. */
    click: (locator: Locator) => Promise<void>;
    openVideoPage: () => Promise<Page>;
    /**
     * The real side panel is browser chrome, so its page runs in a tab. A viewport makes it
     * panel-sized, but resizing one page resizes the shared window.
     */
    openSidePanel: (viewport?: { width: number; height: number }) => Promise<Page>;
    seekToSubtitle: (page: Page, seconds: number) => Promise<void>;
    /** Pauses the video and retries until playback actually stops; closing a dialog can resume it. */
    pauseVideo: (page: Page) => Promise<void>;
};

export type TestOptions = {
    demoMode: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The worker is often running before Playwright attaches, so the event never fires. */
async function waitForServiceWorker(context: BrowserContext, timeout = 15_000): Promise<Worker> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const worker = context.serviceWorkers()[0];
        if (worker) return worker;
        await sleep(250);
    }
    throw new Error(`Extension service worker did not start within ${timeout}ms`);
}

/** First-run onboarding opens an active ftue-ui.html tab, which would steal the panel's current tab. */
async function closeFtueTabs(context: BrowserContext) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const ftuePages = context.pages().filter((p) => p.url().includes('ftue-ui.html'));
        if (ftuePages.length > 0) {
            await Promise.all(ftuePages.map((p) => p.close()));
            return;
        }
        await sleep(250);
    }
}

/** The subtitle picker is a UI iframe tagged with a stable class by the extension. */
export function videoDataSyncFrame(page: Page): FrameLocator {
    return page.frameLocator('iframe.asbplayer-video-data-sync-frame');
}

export const test = base.extend<TestOptions & { ext: Ext }>({
    demoMode: [async ({}, use) => use(false), { option: true }],

    ext: async ({ demoMode }, use) => {
        const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asbplayer-e2e-'));

        const context = await chromium.launchPersistentContext(profileDir, {
            // Branded Chrome releases block --load-extension; Playwright's Chromium
            // (Chrome for Testing, new headless) is the supported way to load MV3 extensions.
            channel: 'chromium',
            headless: !process.env.ASB_E2E_HEADED,
            viewport: { width: 1280, height: 720 },
            slowMo: demoMode ? 150 : undefined,
            recordVideo: demoMode ? { dir: DEMO_VIDEO_DIR, size: { width: 1280, height: 720 } } : undefined,
            args: [
                `--disable-extensions-except=${EXTENSION_DIR}`,
                `--load-extension=${EXTENSION_DIR}`,
                '--no-first-run',
                '--no-default-browser-check',
                // Pin the UI language so English assertions hold on any machine.
                '--lang=en-US',
            ],
        });

        const worker = await waitForServiceWorker(context);
        const extensionId = new URL(worker.url()).host;
        await closeFtueTabs(context);

        // Seed first-run state: skip the track-selector tour, enable generic detection for
        // the fixture host, remember English as the preferred track, and disable media
        // capture, which needs an activeTab grant only a browser gesture can provide.
        const fixtureHost = new URL(DOCS_VIDEO_URL).host;
        await worker.evaluate(
            (host) =>
                (globalThis as any).chrome.storage.local.set({
                    ftueHasSeenSubtitleTrackSelector: true,
                    genericSubtitleParser: { pages: { [host]: { parse: 'base' } } },
                    streamingLastLanguagesSynced: { [host]: ['en'] },
                    streamingRecordMedia: false,
                    streamingTakeScreenshot: false,
                }),
            fixtureHost
        );

        // First run pins the app language from the OS locale, and --lang does not override
        // that on macOS. Wait for the write, then force English before pages open.
        const languageDeadline = Date.now() + 8000;
        while (Date.now() < languageDeadline) {
            const stored = await worker.evaluate(() =>
                (globalThis as any).chrome.storage.local.get('language')
            );
            if (stored.language !== undefined) break;
            await sleep(250);
        }
        await worker.evaluate(() => (globalThis as any).chrome.storage.local.set({ language: 'en' }));

        if (demoMode) await context.addInitScript(injectCursor);

        const openVideoPage = async () => {
            const page = await context.newPage();
            await page.goto(DOCS_VIDEO_URL);
            return page;
        };

        const openSidePanel = async (viewport?: { width: number; height: number }) => {
            const page = await context.newPage();
            if (viewport !== undefined) await page.setViewportSize(viewport);
            await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
            return page;
        };

        const step = async (name: string, fn: () => Promise<void>) => {
            await fn();
            if (demoMode) await sleep(800);
        };

        const click = async (locator: Locator) => {
            if (!demoMode) {
                await locator.click();
                return;
            }
            const box = await locator.boundingBox();
            if (!box) {
                await locator.click();
                return;
            }
            const page = locator.page();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
            await sleep(150);
            await page.mouse.down();
            await sleep(80);
            await page.mouse.up();
        };

        // Cues are short; pausing keeps assertions from racing playback.
        const seekToSubtitle = async (page: Page, seconds: number) => {
            await page.evaluate(
                (t) => {
                    const video = document.querySelector('video');
                    if (!video) return;
                    video.currentTime = t;
                    video.pause();
                },
                seconds
            );
        };

        const pauseVideo = async (page: Page) => {
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline) {
                await page.evaluate(() => document.querySelector('video')?.pause());
                await sleep(300);
                if (await page.evaluate(() => document.querySelector('video')?.paused)) return;
            }
            throw new Error('Video did not stay paused');
        };

        try {
            await use({
                context,
                extensionId,
                demoMode,
                step,
                click,
                openVideoPage,
                openSidePanel,
                seekToSubtitle,
                pauseVideo,
            });
        } finally {
            await context.close();
            fs.rmSync(profileDir, { recursive: true, force: true });
        }
    },
});
