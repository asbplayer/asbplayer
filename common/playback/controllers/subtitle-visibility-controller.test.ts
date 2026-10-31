import { describe, expect, it, jest } from '@jest/globals';
import { SubtitleVisibility } from '@project/common/settings';
import SubtitleVisibilityController, {
    formatSubtitleVisibilityNotification,
    nextSubtitleVisibility,
} from '@project/common/playback/controllers/subtitle-visibility-controller';

const harness = (visibility: SubtitleVisibility, options?: { readonly paused: boolean }) => {
    const visibilityChanged = jest.fn();
    const state = { automaticallyPaused: false };
    const controller = new SubtitleVisibilityController({
        automaticallyPaused: () => state.automaticallyPaused,
        visibilityChanged,
    });
    controller.replacePlan(visibility, { paused: options?.paused ?? false });
    visibilityChanged.mockClear();
    return { controller, visibilityChanged, state };
};

describe('subtitle visibility mode', () => {
    it('toggles both values and formats its notification', () => {
        const whilePaused = nextSubtitleVisibility(SubtitleVisibility.whenDue);
        const whileManuallyPaused = nextSubtitleVisibility(whilePaused);
        const whenDue = nextSubtitleVisibility(whileManuallyPaused);

        expect([whilePaused, whileManuallyPaused, whenDue]).toEqual([
            SubtitleVisibility.whilePaused,
            SubtitleVisibility.whileManuallyPaused,
            SubtitleVisibility.whenDue,
        ]);
        expect(formatSubtitleVisibilityNotification(whileManuallyPaused)).toEqual({
            key: 'subtitle-visibility',
            locKey: 'info.subtitleVisibility',
            valueLocKey: 'settings.subtitleVisibilityWhileManuallyPaused',
        });
    });
});

describe('SubtitleVisibilityController', () => {
    it('keeps due subtitles visible in when-due mode', () => {
        const { controller, visibilityChanged, state } = harness(SubtitleVisibility.whenDue);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.autoPauseResumeDelayStarted();
        state.automaticallyPaused = false;
        controller.playbackStarted();
        expect(controller.subtitlesVisible).toBe(true);
        expect(visibilityChanged).not.toHaveBeenCalled();
    });

    it('shows an automatic pause only for its reading period', () => {
        const { controller, visibilityChanged, state } = harness(SubtitleVisibility.whilePaused);
        expect(controller.subtitlesVisible).toBe(false);
        state.automaticallyPaused = true;
        controller.autoPaused();
        expect(controller.subtitlesVisible).toBe(true);
        controller.autoPauseResumeDelayStarted();
        expect(controller.subtitlesVisible).toBe(false);
        expect(visibilityChanged).toHaveBeenCalledTimes(2);
    });

    it('does not reopen the reading period when the automatic media pause is reported', () => {
        const { controller, state } = harness(SubtitleVisibility.whilePaused);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.autoPauseResumeDelayStarted();
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(false);
    });

    it('keeps subtitles hidden through PlaybackEngine auto-pause and reveals them for other pauses', () => {
        const { controller, state } = harness(SubtitleVisibility.whileManuallyPaused);
        expect(controller.subtitlesVisible).toBe(false);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(false);
        controller.autoPauseResumeDelayStarted();
        expect(controller.subtitlesVisible).toBe(false);
        state.automaticallyPaused = false;
        controller.playbackStarted();
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(true);
        controller.playbackStarted();
        expect(controller.subtitlesVisible).toBe(false);
    });

    it('keeps an active automatic pause hidden when the visibility setting changes', () => {
        const { controller, state } = harness(SubtitleVisibility.whilePaused);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.replacePlan(SubtitleVisibility.whileManuallyPaused, { paused: true });
        controller.playbackPaused();
        expect(controller.subtitlesVisible).toBe(false);
        state.automaticallyPaused = false;
        controller.userSeeked({ paused: true });
        expect(controller.subtitlesVisible).toBe(true);
    });

    it('preserves an automatic reading phase when an equivalent plan is replaced', () => {
        const { controller, state } = harness(SubtitleVisibility.whilePaused);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.autoPauseResumeDelayStarted();
        controller.replacePlan(SubtitleVisibility.whilePaused, { paused: true });
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

    it('reconciles visibility after a user seek ends an automatic pause', () => {
        const pausedHarness = harness(SubtitleVisibility.whilePaused);
        pausedHarness.state.automaticallyPaused = true;
        pausedHarness.controller.autoPaused();
        pausedHarness.state.automaticallyPaused = false;
        pausedHarness.controller.userSeeked({ paused: true });
        expect(pausedHarness.controller.subtitlesVisible).toBe(true);

        const playingHarness = harness(SubtitleVisibility.whilePaused);
        playingHarness.state.automaticallyPaused = true;
        playingHarness.controller.autoPaused();
        playingHarness.state.automaticallyPaused = false;
        playingHarness.controller.userSeeked({ paused: false });
        expect(playingHarness.controller.subtitlesVisible).toBe(false);
    });

    it('reconciles paused visibility after an automatic pause is cancelled', () => {
        const { controller, state } = harness(SubtitleVisibility.whilePaused);
        state.automaticallyPaused = true;
        controller.autoPaused();
        controller.autoPauseResumeDelayStarted();

        state.automaticallyPaused = false;
        controller.autoPauseCancelled({ paused: true });

        expect(controller.subtitlesVisible).toBe(true);
    });

    it('reconciles visibility from current playback state when its plan is replaced', () => {
        const playingHarness = harness(SubtitleVisibility.whenDue);
        playingHarness.controller.replacePlan(SubtitleVisibility.whilePaused, { paused: false });
        expect(playingHarness.controller.subtitlesVisible).toBe(false);

        const pausedHarness = harness(SubtitleVisibility.whenDue);
        pausedHarness.controller.replacePlan(SubtitleVisibility.whilePaused, { paused: true });
        expect(pausedHarness.controller.subtitlesVisible).toBe(true);
    });
});
