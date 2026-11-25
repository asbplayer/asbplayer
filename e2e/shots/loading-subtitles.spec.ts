import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { test, videoDataSyncFrame } from '../fixtures/extension';
import { expectSubtitlesVisible, openVideoAndPanel } from '../scenarios/load-subtitles';
import { DOCS_IMAGE_DIR, SUBTITLE_FILE } from '../fixtures/paths';

const PANEL_VIEWPORT = { width: 400, height: 800 };

const image = (name: string) => path.join(DOCS_IMAGE_DIR, name);

test('generates images for docs/getting-started/loading-subtitles', async ({ ext }) => {
    fs.mkdirSync(DOCS_IMAGE_DIR, { recursive: true });

    const { video, panel, loadButton } = await openVideoAndPanel(ext, { panelViewport: PANEL_VIEWPORT });

    // The docs site defaults to dark mode.
    await panel.emulateMedia({ colorScheme: 'dark' });
    await video.emulateMedia({ colorScheme: 'dark' });

    // 1. Side panel landing view with the Load Subtitles button focused via keyboard,
    //    which shows MUI's own selection halo rather than an injected highlight.
    // Tab through focusable elements until the halo lands on the button.
    let focused = false;
    for (let i = 0; i < 8 && !focused; i++) {
        await panel.keyboard.press('Tab');
        focused = await loadButton.evaluate((el) => el.classList.contains('Mui-focusVisible'));
    }
    expect(focused).toBe(true);
    await panel.screenshot({ path: image('side-panel-load-subtitles.png'), animations: 'disabled' });

    // 2. The subtitle file dialog over the video page (docs step 3). The fixture page serves
    //    a subtitle track like a streaming site does, so the picker preselects a real track.
    await ext.click(loadButton);
    const dialogFrame = videoDataSyncFrame(video);
    await expect(dialogFrame.getByRole('combobox', { name: 'Subtitle Track 1' })).toHaveText('English', {
        timeout: 10_000,
    });
    await video.screenshot({ path: image('subtitle-file-dialog.png'), animations: 'disabled' });

    // Loading the subtitle file confirms automatically and closes the dialog.
    await dialogFrame.locator('input[type="file"]').setInputFiles(SUBTITLE_FILE);

    // Seek into the first cue so the overlay and the synced panel are showing it.
    await ext.seekToSubtitle(video, 2);
    await expectSubtitlesVisible(video, panel);
});
