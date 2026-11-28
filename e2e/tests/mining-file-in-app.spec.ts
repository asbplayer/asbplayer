import { expect } from '@playwright/test';
import { test } from '../fixtures/extension';
import { mineVideoFileInApp } from '../scenarios/mine-file-in-app';
import { FIRST_SUBTITLE } from '../fixtures/paths';

// The app needs to load, settle, enter theater mode, and mine.
test.setTimeout(120_000);

test('mining a video file in the app captures media into the Anki dialog', async ({ ext }) => {
    const { dialog } = await mineVideoFileInApp(ext);

    await expect(dialog.getByRole('textbox', { name: 'Sentence' })).toHaveValue(FIRST_SUBTITLE);

    // The app captures a canvas frame and takes audio from the media file.
    const imageSrc = await dialog.locator('img').first().getAttribute('src');
    expect(imageSrc).toMatch(/^data:image\/jpeg;base64,/);
    await expect(dialog.getByRole('textbox', { name: 'Audio' })).toHaveValue(/\.mp3$/);
    await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
});
