import type { FrameLocator, Locator, Page } from '@playwright/test';
import type { Ext } from '../fixtures/extension';
import { loadSubtitlesOntoVideo, type PanelOptions } from './load-subtitles';

export const mineButton = (overlay: FrameLocator): Locator =>
    overlay.getByLabel('Mine Subtitle', { exact: true });

export const ankiDialogFrame = (video: Page): FrameLocator =>
    video.frameLocator('iframe.asbplayer-anki-frame');

async function waitForOverlay(video: Page): Promise<FrameLocator> {
    const overlay = video.frameLocator('iframe.asbplayer-mobile-video-overlay-frame');
    await mineButton(overlay).waitFor({ state: 'visible', timeout: 10_000 });
    return overlay;
}

/** Loads subtitles, parks on the first cue, and returns the controls overlay. */
export async function loadAndShowOverlay(ext: Ext, options: PanelOptions = {}) {
    const { video, panel } = await loadSubtitlesOntoVideo(ext, options);
    await ext.seekToSubtitle(video, 2);
    await ext.pauseVideo(video);

    // The overlay only shows while paused; closing dialogs can resume playback.
    await video.evaluate(() => document.querySelector('video')?.pause());
    const overlay = await waitForOverlay(video);
    return { video, panel, overlay };
}

export async function mineSubtitle(ext: Ext) {
    const { video, panel, overlay } = await loadAndShowOverlay(ext);
    await ext.click(mineButton(overlay));

    const anki = ankiDialogFrame(video);
    return { video, panel, overlay, anki };
}
