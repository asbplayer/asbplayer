import { VideoSubtitleSplitBehavior } from '@project/common/settings';
import { clampSubtitlePlayerWidth, resolveVideoSubtitleSplitLayout } from './video-subtitle-split';

it('uses the saved split width in remember mode', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
            persistedWidth: 420,
            autoWidth: 300,
        })
    ).toBe(420);
});

it('leaves the width unchanged in remember mode when nothing has been saved', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.rememberSplitPosition,
            autoWidth: 300,
        })
    ).toBeUndefined();
});

it('ignores saved width in auto-maximize mode', () => {
    expect(
        resolveVideoSubtitleSplitLayout({
            behavior: VideoSubtitleSplitBehavior.autoMaximizeVideo,
            persistedWidth: 420,
            autoWidth: 300,
        })
    ).toBe(300);
});

it('clamps split width to the current bounds', () => {
    expect(clampSubtitlePlayerWidth(150, 200, 500)).toBe(200);
    expect(clampSubtitlePlayerWidth(600, 200, 500)).toBe(500);
});
