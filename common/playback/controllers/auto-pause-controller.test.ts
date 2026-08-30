import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AutoPauseResumeMode } from '@project/common/settings';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';
import type { PlaybackPlanAutoPauseResume } from '@project/common/playback/plan/playback-plan';
import AutoPauseController, { autoPauseDurationMs } from '@project/common/playback/controllers/auto-pause-controller';

const subtitleLengthResume: PlaybackPlanAutoPauseResume = {
    mode: AutoPauseResumeMode.subtitleLength,
    fixedDurationMs: 2000,
    minimumDurationMs: 500,
    maximumDurationMs: 2000,
    timePerCharacterMs: 100,
    delayMs: 300,
};

const fixedResume: PlaybackPlanAutoPauseResume = { ...subtitleLengthResume, mode: AutoPauseResumeMode.fixed };

const subtitleOfLength = (length: number) => makeSubtitle({ text: 'a'.repeat(length) });

const harness = (policy: { resume?: PlaybackPlanAutoPauseResume; subtitlesWhilePausedOnly: boolean }) => {
    const events: string[] = [];
    const controller = new AutoPauseController({
        play: async () => {
            events.push('play');
        },
        showingSubtitlesChanged: () => events.push('subtitles'),
        onError: (error) => events.push(`error: ${String(error)}`),
    });
    controller.setPolicy(policy, false);
    return { controller, events };
};

describe('autoPauseDurationMs', () => {
    it('uses the fixed duration regardless of subtitle length', () => {
        expect(autoPauseDurationMs(fixedResume, [subtitleOfLength(1)])).toBe(2000);
        expect(autoPauseDurationMs(fixedResume, [])).toBe(2000);
    });

    it('scales with the characters being read and clamps to the configured bounds', () => {
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(10)])).toBe(1000);
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(1)])).toBe(500);
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(100)])).toBe(2000);
    });

    it('treats a zero maximum as no upper bound', () => {
        const unbounded = { ...subtitleLengthResume, maximumDurationMs: 0 };

        expect(autoPauseDurationMs(unbounded, [subtitleOfLength(100)])).toBe(10_000);
    });

    it('sums every subtitle it is given', () => {
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(6), subtitleOfLength(4)])).toBe(1000);
    });
});

describe('AutoPauseController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('shows the subtitle for the pause duration, hides it, then resumes after the delay', () => {
        const { controller, events } = harness({
            resume: subtitleLengthResume,
            subtitlesWhilePausedOnly: true,
        });

        controller.autoPaused([subtitleOfLength(10)]);
        expect(controller.subtitlesSuppressed).toBe(false);

        jest.advanceTimersByTime(1000);
        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['subtitles', 'subtitles']);

        jest.advanceTimersByTime(300);
        expect(events).toEqual(['subtitles', 'subtitles', 'play']);
    });

    it('never withholds subtitles when visibility is always', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: false });

        expect(controller.subtitlesSuppressed).toBe(false);
        controller.autoPaused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(1300);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['play']);
    });

    it('stays paused with the subtitle shown when no resume is configured', () => {
        const { controller, events } = harness({ subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['subtitles']);
    });

    it('still resumes when the pause has nothing to read', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([]);
        jest.advanceTimersByTime(500 + 300);

        expect(events).toEqual(['subtitles', 'subtitles', 'play']);
    });

    it('shows subtitles for a pause playback did not ask for, without resuming', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.userPaused();
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['subtitles']);
    });

    it('leaves a running automatic pause alone when the media reports it paused', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        controller.userPaused();
        jest.advanceTimersByTime(1300);

        expect(events).toEqual(['subtitles', 'subtitles', 'play']);
    });

    it('hides subtitles and drops a pending resume once playback starts', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        controller.playbackStarted();
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['subtitles', 'subtitles']);
    });

    it('keeps the subtitle of a paused frame when the viewer seeks while paused', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        controller.userSeeked(true);
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['subtitles']);
    });

    it('hides subtitles when the viewer seeks while playing', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        controller.userSeeked(false);
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(true);
        expect(events).toEqual(['subtitles', 'subtitles']);
    });

    it('drops a pending resume when the policy changes', () => {
        const { controller, events } = harness({ resume: subtitleLengthResume, subtitlesWhilePausedOnly: true });

        controller.autoPaused([subtitleOfLength(10)]);
        controller.setPolicy({ subtitlesWhilePausedOnly: false }, false);
        jest.advanceTimersByTime(60_000);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual(['subtitles']);
    });

    it('keeps subtitles visible when the policy changes while playback is paused', () => {
        const { controller, events } = harness({ subtitlesWhilePausedOnly: false });

        controller.userPaused();
        controller.setPolicy({ subtitlesWhilePausedOnly: true }, true);

        expect(controller.subtitlesSuppressed).toBe(false);
        expect(events).toEqual([]);
    });
});
