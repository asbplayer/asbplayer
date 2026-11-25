import { test } from '../fixtures/extension';
import { loadAndShowOverlay } from '../scenarios/mine-subtitle';

test('debug: overlay geometry', async ({ ext }) => {
    const { video, overlay } = await loadAndShowOverlay(ext);
    const controls = overlay.getByTestId('overlay-controls');
    console.log('VIEWPORT:', JSON.stringify(video.viewportSize()));
    console.log('VIDEO ELEMENT:', JSON.stringify(await video.locator('video').boundingBox()));
    console.log('IFRAME:', JSON.stringify(await video.locator('iframe.asbplayer-mobile-video-overlay-frame').boundingBox()));
    console.log('CONTAINER:', JSON.stringify(await overlay.getByTestId('overlay-container').boundingBox()));
    console.log('CONTROLS:', JSON.stringify(await controls.boundingBox()));
    console.log('DPR:', JSON.stringify(await video.evaluate(() => ({ inner: window.innerWidth, devicePixelRatio: window.devicePixelRatio }))));
    console.log('OVERLAY BODY:', JSON.stringify(await overlay.locator('body').evaluate((b) => ({ w: b.clientWidth, sw: b.scrollWidth }))));
});
