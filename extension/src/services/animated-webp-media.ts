import type { SettingsProvider } from '@project/common/settings';
import { isFirefoxBuild } from '@project/extension/src/services/build-flags';
import { tabCaptureStreamId } from '@project/extension/src/services/video-capturer';

// An animated WebP is a recorded clip, so it needs media recording to be on. It also relies on
// chrome.tabCapture, which Firefox doesn't have.
export const shouldUseAnimatedWebp = async (
    settings: SettingsProvider,
    { screenshot, record }: { screenshot: boolean; record: boolean }
) => screenshot && record && !isFirefoxBuild && (await settings.getSingle('mediaFragmentFormat')) === 'webp';

// Everything needed to open a tab-capture stream for an animated WebP: a stream id plus the user's
// fps/quality settings.
export const negotiateAnimatedWebp = async (settings: SettingsProvider, tabId: number) => {
    const [fps, quality, streamId] = await Promise.all([
        settings.getSingle('animatedImageFps'),
        settings.getSingle('animatedImageQuality'),
        tabCaptureStreamId(tabId),
    ]);
    return { streamId, fps, quality };
};
