import type { FrameLocator, Page } from '@playwright/test';
import type { Ext } from '../fixtures/extension';
import { APP_URL, DOCS_VIDEO_FILE, SUBTITLE_FILE } from '../fixtures/paths';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Card field values used by the screenshot specs. */
export const CARD_DEFINITION = 'fascinate (verb): to attract and hold the attention of; captivate.';
export const CARD_WORD = 'fascinate';

/**
 * Opens a video file in the web app and switches to theater mode (no app bar).
 *
 * The app mines video files with a canvas frame capture and audio taken from the file, so
 * the Anki dialog shows mined media without the extension's activeTab requirement.
 */
export async function openVideoInApp(ext: Ext) {
    const page = await ext.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(APP_URL);

    // The landing page's hidden picker accepts video and subtitle files together.
    await page.getByTestId('load-files-input').setInputFiles([DOCS_VIDEO_FILE, SUBTITLE_FILE]);

    await waitForLoadedPlayer(page);
    await waitForSubtitle(page);
    // Controls and shortcuts bind shortly after the media loads; earlier clicks are lost.
    await sleep(2500);

    // The player's control bar only appears while the cursor is over the top of the video.
    await revealPlayerControls(page);
    await player(page).getByLabel('Toggle Theater Mode', { exact: true }).click();
    await sleep(800);

    const mineButton = page.getByLabel('Mine Subtitle', { exact: true }).first();
    await mineButton.waitFor({ state: 'visible', timeout: 10_000 });
    return { page, mineButton };
}

export async function mineFirstSubtitleInApp(app: Awaited<ReturnType<typeof openVideoInApp>>) {
    await app.mineButton.click();
    const dialog = player(app.page).getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 30_000 });
    return dialog;
}

export async function mineVideoFileInApp(ext: Ext) {
    const app = await openVideoInApp(ext);
    const dialog = await mineFirstSubtitleInApp(app);
    return { ...app, dialog };
}

/** The copy notification covers the dialog in screenshots until it auto-dismisses. */
export function copySnackbar(page: Page) {
    // App-level notifications carry a stable key; role="alert" is ambiguous because the
    // dialog renders its own hint alert.
    return player(page).locator('[data-alert-key="app-alert"]');
}

/** Waits for the notification to disappear and stay gone; it is forwarded asynchronously. */
export async function waitForCopySnackbarToClear(page: Page, timeout = 20_000) {
    const snackbar = copySnackbar(page);
    const deadline = Date.now() + timeout;
    let clearSince: number | undefined;

    // Give the app a moment to forward the notification to the player.
    await sleep(800);

    while (Date.now() < deadline) {
        if (await snackbar.isVisible().catch(() => false)) {
            clearSince = undefined;
        } else if (clearSince === undefined) {
            clearSince = Date.now();
        } else if (Date.now() - clearSince >= 1_500) {
            return;
        }
        await sleep(150);
    }

    throw new Error('Copy notification did not clear');
}

/** The app hosts the player in an iframe tagged with a stable test id. */
function player(page: Page): FrameLocator {
    return page.frameLocator('[data-testid="video-frame"]');
}

async function waitForLoadedPlayer(page: Page, timeout = 30_000): Promise<void> {
    const video = player(page).locator('video');
    await video.waitFor({ state: 'attached', timeout });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const ready = await video.evaluate((element) => (element as HTMLVideoElement).readyState).catch(() => 0);
        if (ready >= 2) return;
        await sleep(250);
    }
    throw new Error('App player did not load the video');
}

async function waitForSubtitle(page: Page, timeout = 20_000) {
    await player(page)
        .getByText('This toy has fascinated me since childhood.')
        .first()
        .waitFor({ state: 'visible', timeout });
}

async function revealPlayerControls(page: Page) {
    await player(page).locator('body').hover({ position: { x: 640, y: 20 } });
    await sleep(600);
}

