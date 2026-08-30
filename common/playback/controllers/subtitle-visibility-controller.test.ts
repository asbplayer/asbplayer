import { describe, expect, it, jest } from '@jest/globals';
import { SubtitleVisibility } from '@project/common/settings';
import SubtitleVisibilityController, {
    formatSubtitleVisibilityNotification,
    nextSubtitleVisibility,
} from '@project/common/playback/controllers/subtitle-visibility-controller';

const harness = (visibility: SubtitleVisibility, paused = false) => {
    const visibilityChanged = jest.fn();
    const controller = new SubtitleVisibilityController({ visibilityChanged });
    controller.replacePlan(visibility, paused);
    visibilityChanged.mockClear();
    return { controller, visibilityChanged };
};

describe('subtitle visibility mode', () => {
    it('toggles both values and formats its notification', () => {
        const whilePaused = nextSubtitleVisibility(SubtitleVisibility.always);
        const always = nextSubtitleVisibility(whilePaused);

        expect([whilePaused, always]).toEqual([SubtitleVisibility.whilePaused, SubtitleVisibility.always]);
        expect(formatSubtitleVisibilityNotification(whilePaused)).toEqual({
            key: 'subtitle-visibility',
            locKey: 'info.subtitleVisibility',
            valueLocKey: 'settings.subtitleVisibilityWhilePaused',
        });
    });
});

describe('SubtitleVisibilityController', () => {
    it('never suppresses subtitles in always mode', () => {
        const { controller, visibilityChanged } = harness(SubtitleVisibility.always);
        controller.autoPaused();
        controller.autoPauseReadingPeriodEnded();
        controller.playbackStarted();
        expect(controller.subtitlesVisible).toBe(true);
        expect(visibilityChanged).not.toHaveBeenCalled();
    });

    it('shows an automatic pause only for its reading period', () => {
        const { controller, visibilityChanged } = harness(SubtitleVisibility.whilePaused);
        expect(controller.subtitlesVisible).toBe(false);
        controller.autoPaused();
        expect(controller.subtitlesVisible).toBe(true);
        controller.autoPauseReadingPeriodEnded();
        expect(controller.subtitlesVisible).toBe(false);
        expect(visibilityChanged).toHaveBeenCalledTimes(2);
    });

    it('does not reopen the reading period when the automatic media pause is reported', () => {
        const { controller } = harness(SubtitleVisibility.whilePaused);
        controller.autoPaused();
        controller.autoPauseReadingPeriodEnded();
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(false);
    });

    it('preserves an automatic reading phase when an equivalent plan is replaced', () => {
        const { controller } = harness(SubtitleVisibility.whilePaused);
        controller.autoPaused();
        controller.autoPauseReadingPeriodEnded();
        controller.replacePlan(SubtitleVisibility.whilePaused, true);
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(false);
    });

    it('shows subtitles for an ordinary pause and hides them once playback starts', () => {
        const { controller } = harness(SubtitleVisibility.whilePaused);
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(true);
        controller.playbackStarted();
        expect(controller.subtitlesVisible).toBe(false);
    });

    it('ends an automatic pause on user seeks while preserving paused-frame visibility', () => {
        const pausedHarness = harness(SubtitleVisibility.whilePaused);
        pausedHarness.controller.autoPaused();
        pausedHarness.controller.userSeeked(true);
        expect(pausedHarness.controller.subtitlesVisible).toBe(true);

        const playingHarness = harness(SubtitleVisibility.whilePaused);
        playingHarness.controller.autoPaused();
        playingHarness.controller.userSeeked(false);
        expect(playingHarness.controller.subtitlesVisible).toBe(false);
    });

    it('reconciles visibility from current playback state when its plan is replaced', () => {
        const playingHarness = harness(SubtitleVisibility.always);
        playingHarness.controller.replacePlan(SubtitleVisibility.whilePaused, false);
        expect(playingHarness.controller.subtitlesVisible).toBe(false);

        const pausedHarness = harness(SubtitleVisibility.always);
        pausedHarness.controller.replacePlan(SubtitleVisibility.whilePaused, true);
        expect(pausedHarness.controller.subtitlesVisible).toBe(true);
    });
});
