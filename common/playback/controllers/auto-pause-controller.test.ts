import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AutoPauseResumeMode } from '@project/common/settings';
import { makeSubtitle } from '@project/common/playback/playback-test-utils';
import type { PlaybackPlanAutoPauseResume } from '@project/common/playback/plan/playback-plan';
import AutoPauseController, {
    autoPauseDurationMs,
    formatAutoPauseResumeModeNotification,
    nextAutoPauseResumeMode,
} from '@project/common/playback/controllers/auto-pause-controller';

const manualResume: PlaybackPlanAutoPauseResume = { mode: AutoPauseResumeMode.manual };
const subtitleLengthResume = {
    mode: AutoPauseResumeMode.subtitleLength,
    minimumDurationMs: 500,
    maximumDurationMs: 2000,
    timePerCharacterMs: 100,
    delayMs: 300,
} as const;
const fixedResume = {
    mode: AutoPauseResumeMode.fixed,
    fixedDurationMs: 2000,
    delayMs: 300,
} as const;

const subtitleOfLength = (length: number) => makeSubtitle({ text: 'a'.repeat(length) });

const harness = (resume: PlaybackPlanAutoPauseResume) => {
    const events: string[] = [];
    const controller = new AutoPauseController({
        play: async () => {
            events.push('play');
        },
        readingPeriodEnded: () => events.push('reading-ended'),
        onError: (error) => events.push(`error: ${String(error)}`),
    });
    controller.replacePlan(resume);
    return { controller, events };
};

describe('auto-pause resume mode', () => {
    it('cycles through each mode and formats its notification', () => {
        const fixed = nextAutoPauseResumeMode(AutoPauseResumeMode.manual);
        const subtitleLength = nextAutoPauseResumeMode(fixed);
        const manual = nextAutoPauseResumeMode(subtitleLength);

        expect([fixed, subtitleLength, manual]).toEqual([
            AutoPauseResumeMode.fixed,
            AutoPauseResumeMode.subtitleLength,
            AutoPauseResumeMode.manual,
        ]);
        expect(formatAutoPauseResumeModeNotification(fixed)).toEqual({
            key: 'auto-pause-resume-mode',
            locKey: 'info.autoPauseResumeMode',
            valueLocKey: 'settings.autoPauseResumeModeFixed',
        });
    });
});

describe('autoPauseDurationMs', () => {
    it('uses the fixed duration regardless of subtitle count', () => {
        expect(autoPauseDurationMs(fixedResume, [])).toBe(2000);
        expect(autoPauseDurationMs(fixedResume, [subtitleOfLength(1)])).toBe(2000);
        expect(autoPauseDurationMs(fixedResume, [subtitleOfLength(6), subtitleOfLength(4)])).toBe(2000);
    });

    it('scales with all readable characters and clamps to the configured bounds', () => {
        expect(autoPauseDurationMs(subtitleLengthResume, [])).toBe(500);
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(1)])).toBe(500);
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(6), subtitleOfLength(4)])).toBe(1000);
        expect(autoPauseDurationMs(subtitleLengthResume, [subtitleOfLength(100)])).toBe(2000);
    });

    it('treats a zero maximum as no upper bound', () => {
        const unbounded = { ...subtitleLengthResume, maximumDurationMs: 0 };
        expect(autoPauseDurationMs(unbounded, [subtitleOfLength(100)])).toBe(10_000);
    });
});

describe('AutoPauseController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('ends the reading period and then resumes after the configured delay', () => {
        const { controller, events } = harness(subtitleLengthResume);

        controller.autoPaused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(1000);
        expect(events).toEqual(['reading-ended']);

        jest.advanceTimersByTime(300);
        expect(events).toEqual(['reading-ended', 'play']);
    });

    it('waits indefinitely in manual mode', () => {
        const { controller, events } = harness(manualResume);
        controller.autoPaused([subtitleOfLength(10)]);
        jest.advanceTimersByTime(60_000);
        expect(events).toEqual([]);
    });

    it('preserves a pending resume when an equivalent plan is replaced', () => {
        const { controller, events } = harness(subtitleLengthResume);
        controller.autoPaused([subtitleOfLength(10)]);
        controller.replacePlan({ ...subtitleLengthResume });
        jest.advanceTimersByTime(1300);
        expect(events).toEqual(['reading-ended', 'play']);
    });

    it.each([
        ['playback starts', (controller: AutoPauseController) => controller.playbackStarted()],
        ['the user seeks', (controller: AutoPauseController) => controller.userSeeked()],
        ['the controller is cancelled', (controller: AutoPauseController) => controller.cancel()],
        ['the plan is replaced', (controller: AutoPauseController) => controller.replacePlan(manualResume)],
    ])('drops a pending resume when %s', (_description, interrupt) => {
        const { controller, events } = harness(subtitleLengthResume);
        controller.autoPaused([subtitleOfLength(10)]);
        interrupt(controller);
        jest.advanceTimersByTime(60_000);
        expect(events).toEqual([]);
    });
});
