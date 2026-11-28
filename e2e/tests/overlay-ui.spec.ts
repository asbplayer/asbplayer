import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';
import { expect, test, type Ext } from '../fixtures/extension';
import { loadAndShowOverlay } from '../scenarios/mine-subtitle';
import { cropVideo } from '../fixtures/video';
import { DOCS_VIDEO_DIR } from '../fixtures/paths';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const controls = (overlay: FrameLocator) => overlay.getByTestId('overlay-controls');

/** The carousel only advances on touchpad-like (fractional) wheel deltas. */
async function scrollToOffsetControls(overlay: FrameLocator) {
    const carousel = controls(overlay);
    let top = await carousel.evaluate((element) => element.scrollTop);

    for (let attempt = 0; attempt < 3 && top !== 40; attempt++) {
        await carousel.evaluate((element, deltaY) => {
            element.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
        }, top < 40 ? 100.5 : -100.5);
        await sleep(900);
        top = await carousel.evaluate((element) => element.scrollTop);
    }
}

/**
 * The overlay only exists while the video is paused, and the arrow buttons are only labelled
 * for the active control section, so both must be re-established between interactions.
 */
/** The carousel starts on the timestamp section; the demo scrolls down from there. */
async function scrollToTimestampControls(overlay: FrameLocator) {
    const carousel = controls(overlay);
    let top = await carousel.evaluate((element) => element.scrollTop);

    for (let attempt = 0; attempt < 3 && top !== 0; attempt++) {
        await carousel.evaluate((element) => {
            element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100.5, bubbles: true, cancelable: true }));
        });
        await sleep(900);
        top = await carousel.evaluate((element) => element.scrollTop);
    }
}

async function ensureOffsetControls(ext: Ext, video: Page, overlay: FrameLocator) {
    await ext.pauseVideo(video);
    await controls(overlay).waitFor({ state: 'visible', timeout: 10_000 });
    await scrollToOffsetControls(overlay);
}

test.setTimeout(120_000);

/**
 * Demonstrates docs/guides/subtitle-timing#overlay-ui: scroll to the offset section, align a
 * subtitle, then hold to nudge in 100 ms steps. In demo mode, the recording is cropped and
 * trimmed to the overlay for the docs video.
 */
test('demonstrates the overlay UI subtitle timing controls', async ({ ext }) => {
    const { video, overlay } = await loadAndShowOverlay(ext);
    const pageStart = await video.evaluate(() => performance.timeOrigin);

    // A cue with neighbours on both sides keeps both align buttons enabled.
    await ext.seekToSubtitle(video, 8);
    await ext.pauseVideo(video);
    await sleep(600);

    let overlayVisibleAt = 0;
    const tooltipBoxes: ({ x: number; y: number; width: number; height: number } | null)[] = [];

    await ext.step('show the timestamp control', async () => {
        await ext.pauseVideo(video);
        await controls(overlay).waitFor({ state: 'visible', timeout: 10_000 });
        await sleep(1200);
        await scrollToTimestampControls(overlay);
        overlayVisibleAt = Date.now();
    });

    await ext.step('scroll to the subtitle offset controls', async () => {
        await ensureOffsetControls(ext, video, overlay);
    });

    await ext.step('align the previous subtitle to the current timestamp', async () => {
        await ensureOffsetControls(ext, video, overlay);
        const button = overlay.locator('button[aria-label^="Increase offset"]');
        await button.hover();
        await sleep(400);
        tooltipBoxes.push(await overlay.getByRole('tooltip').first().boundingBox().catch(() => null));
        await button.click();
        await sleep(600);
    });

    await ext.step('press and hold to nudge the offset in 100 ms steps', async () => {
        await ensureOffsetControls(ext, video, overlay);

        const button = overlay.locator('button[aria-label^="Decrease offset"]');
        await button.waitFor({ state: 'visible', timeout: 10_000 });
        // Click through the element, so a stray glide cannot hit the video and resume it.
        await button.hover();
        await sleep(400);
        tooltipBoxes.push(await overlay.getByRole('tooltip').first().boundingBox().catch(() => null));
        await video.mouse.down();
        await sleep(1_500);
        await video.mouse.up();
    });

    if (!ext.demoMode) return;

    const endedAt = Date.now();
    const box = await overlay.getByTestId('overlay-container').boundingBox();
    const recording = video.video();
    if (box === null || !recording) return;

    const padding = 20;
    const viewport = video.viewportSize() ?? { width: 1280, height: 720 };
    const boxes = [box, ...tooltipBoxes].filter(
        (candidate): candidate is { x: number; y: number; width: number; height: number } => candidate !== null
    );
    const left = Math.min(...boxes.map((candidate) => candidate.x));
    const top = Math.min(...boxes.map((candidate) => candidate.y));
    const right = Math.max(...boxes.map((candidate) => candidate.x + candidate.width));
    const bottom = Math.max(...boxes.map((candidate) => candidate.y + candidate.height));
    const x = Math.max(0, left - padding);
    const y = Math.max(0, top - padding);
    const width = Math.min(viewport.width - x, right - left + padding * 2);
    const height = Math.min(viewport.height - y, bottom - top + padding * 2);

    fs.mkdirSync(DOCS_VIDEO_DIR, { recursive: true });

    const fullRecording = path.join(os.tmpdir(), `overlay-ui-${Date.now()}.webm`);

    // Videos are flushed when their page closes; saveAs otherwise waits forever.
    await video.close();
    await recording.saveAs(fullRecording);

    await cropVideo({
        input: fullRecording,
        output: path.join(DOCS_VIDEO_DIR, 'overlay-ui.mp4'),
        x,
        y,
        width,
        height,
        start: Math.max(0, (overlayVisibleAt - pageStart) / 1000 - 0.3),
        duration: (endedAt - overlayVisibleAt) / 1000 + 0.6,
    });

    fs.rmSync(fullRecording, { force: true });
});
