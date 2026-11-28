import { expect } from '@playwright/test';
import { videoDataSyncFrame } from '../fixtures/extension';
import { test } from '../fixtures/extension';
import { expectSubtitlesVisible, loadSubtitlesOntoVideo, openVideoAndPanel } from '../scenarios/load-subtitles';
import { FIRST_SUBTITLE, SECOND_SUBTITLE } from '../fixtures/paths';

test('loads subtitles onto a video via the side panel', async ({ ext }) => {
    const { video, panel } = await loadSubtitlesOntoVideo(ext);

    await expectSubtitlesVisible(video, panel);
});

test('the side panel stays on its landing view until subtitles are loaded', async ({ ext }) => {
    const { panel } = await openVideoAndPanel(ext);

    await expect(panel.getByText('No videos detected.')).toBeHidden();
    await expect(panel.getByText('Load subtitles onto a video to start using asbplayer.')).toBeVisible();
});

test('the second subtitle appears when the video seeks into it', async ({ ext }) => {
    const { video } = await loadSubtitlesOntoVideo(ext);

    await expect(video.getByText(FIRST_SUBTITLE)).toBeVisible({ timeout: 10_000 });
    await ext.seekToSubtitle(video, 4.5);
    await expect(video.getByText(SECOND_SUBTITLE)).toBeVisible({ timeout: 10_000 });
});

test('the subtitle picker lists tracks offered by the page', async ({ ext }) => {
    const { video, panel, loadButton } = await openVideoAndPanel(ext);

    await ext.click(loadButton);

    const frame = videoDataSyncFrame(video);
    await expect(frame.getByRole('combobox', { name: 'Subtitle Track 1' })).toHaveText('English', {
        timeout: 10_000,
    });
    await panel.close();
});
