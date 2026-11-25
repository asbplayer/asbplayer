import { expect, type Ext, videoDataSyncFrame } from '../fixtures/extension';
import { FIRST_SUBTITLE, SUBTITLE_FILE } from '../fixtures/paths';
import type { Page } from '@playwright/test';

/** Opens the video and panel, then waits for the content script to enable Load Subtitles. */
export type PanelOptions = { panelViewport?: { width: number; height: number } };

export async function openVideoAndPanel(ext: Ext, options: PanelOptions = {}) {
    const video = await ext.openVideoPage();

    const panel = await ext.openSidePanel(options.panelViewport);
    const loadButton = panel.getByRole('button', { name: 'Load Subtitles', exact: true });

    // The side panel targets the active tab, so the video tab must stay in front
    // even though the panel page is driven in the background.
    await ext.step('open video page', async () => {
        await video.bringToFront();
    });

    await ext.step('wait for the video to be detected', async () => {
        await expect(loadButton).toBeEnabled({ timeout: 20_000 });
    });

    return { video, panel, loadButton };
}

/** Picks the subtitle file; a single file confirms automatically and closes the dialog. */
export async function loadViaDialog(ext: Ext, video: Page) {
    await ext.step('select the subtitle file', async () => {
        await videoDataSyncFrame(video).locator('input[type="file"]').setInputFiles(SUBTITLE_FILE);
    });
}

/** The full loading-subtitles flow: load via the panel, then seek into the first cue. */
export async function loadSubtitlesOntoVideo(ext: Ext, options: PanelOptions = {}) {
    const { video, panel, loadButton } = await openVideoAndPanel(ext, options);

    await ext.step('click Load Subtitles in the side panel', async () => {
        await ext.click(loadButton);
    });

    await loadViaDialog(ext, video);

    await ext.step('seek into the first subtitle', async () => {
        await ext.seekToSubtitle(video, 2);
    });

    return { video, panel };
}

/** Asserts the flow worked end to end: overlay over the video, synced subtitle in the panel. */
export async function expectSubtitlesVisible(video: Page, panel: Page) {
    await expect(video.getByText(FIRST_SUBTITLE)).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(FIRST_SUBTITLE)).toBeVisible({ timeout: 10_000 });
}
