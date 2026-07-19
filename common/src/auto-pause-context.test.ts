import { describe, expect, it, jest } from '@jest/globals';
import AutoPauseContext from '@project/common/src/auto-pause-context';
import { type SubtitleModel } from '@project/common/src/model';

const makeSubtitle = (overrides: Partial<SubtitleModel> = {}): SubtitleModel => ({
    text: 'subtitle',
    start: 0,
    end: 1000,
    originalStart: 0,
    originalEnd: 1000,
    track: 0,
    ...overrides,
});

describe('AutoPauseContext', () => {
    it('tolerates 0 registered callbacks', async () => {
        const context = new AutoPauseContext();

        expect(() => context.startedShowing(makeSubtitle())).not.toThrow();
        await expect(context.willStopShowing(makeSubtitle())).resolves.toBeUndefined();
        expect(() => context.clear()).not.toThrow();
    });

    it('deduplicates repeated startedShowing events for the same start time', () => {
        const context = new AutoPauseContext();
        const onStartedShowing = jest.fn();
        context.onStartedShowing = onStartedShowing;

        context.startedShowing(makeSubtitle({ start: 0, end: 1000 }));
        context.startedShowing(makeSubtitle({ start: 0, end: 2000 }));

        expect(onStartedShowing).toHaveBeenCalledTimes(1);
    });

    it('fires startedShowing again after clear for the same subtitle', () => {
        const context = new AutoPauseContext();
        const onStartedShowing = jest.fn();
        context.onStartedShowing = onStartedShowing;
        const subtitle = makeSubtitle({ start: 100, end: 500 });

        context.startedShowing(subtitle);
        context.clear();
        context.startedShowing(subtitle);

        expect(onStartedShowing).toHaveBeenCalledTimes(2);
    });

    it('deduplicates repeated willStopShowing events for the same end time', async () => {
        const context = new AutoPauseContext();
        const onWillStopShowing = jest.fn<(subtitle: SubtitleModel) => Promise<void>>().mockResolvedValue(undefined);
        context.onWillStopShowing = onWillStopShowing;

        await context.willStopShowing(makeSubtitle({ start: 0, end: 1000 }));
        await context.willStopShowing(makeSubtitle({ start: 200, end: 1000 }));

        expect(onWillStopShowing).toHaveBeenCalledTimes(1);
    });

    it('passes distinct subtitles through for 2 different end times', async () => {
        const context = new AutoPauseContext();
        const onWillStopShowing = jest.fn<(subtitle: SubtitleModel) => Promise<void>>().mockResolvedValue(undefined);
        context.onWillStopShowing = onWillStopShowing;
        const first = makeSubtitle({ start: 0, end: 1000 });
        const second = makeSubtitle({ start: 1100, end: 2000 });

        await context.willStopShowing(first);
        await context.willStopShowing(second);

        expect(onWillStopShowing).toHaveBeenNthCalledWith(1, first);
        expect(onWillStopShowing).toHaveBeenNthCalledWith(2, second);
    });

    it('tracks startedShowing and willStopShowing independently', async () => {
        const context = new AutoPauseContext();
        const onStartedShowing = jest.fn();
        const onWillStopShowing = jest.fn<(subtitle: SubtitleModel) => Promise<void>>().mockResolvedValue(undefined);
        context.onStartedShowing = onStartedShowing;
        context.onWillStopShowing = onWillStopShowing;

        context.startedShowing(makeSubtitle({ start: 0, end: 1000 }));
        await context.willStopShowing(makeSubtitle({ start: 0, end: 1000 }));
        context.startedShowing(makeSubtitle({ start: 1001, end: 2000 }));
        await context.willStopShowing(makeSubtitle({ start: 1001, end: 2000 }));

        expect(onStartedShowing).toHaveBeenCalledTimes(2);
        expect(onWillStopShowing).toHaveBeenCalledTimes(2);
    });

    it('keeps clear idempotent for later start and stop notifications', async () => {
        const context = new AutoPauseContext();
        const onStartedShowing = jest.fn();
        const onWillStopShowing = jest.fn<(subtitle: SubtitleModel) => Promise<void>>().mockResolvedValue(undefined);
        const subtitle = makeSubtitle({ start: 100, end: 500 });
        context.onStartedShowing = onStartedShowing;
        context.onWillStopShowing = onWillStopShowing;

        context.startedShowing(subtitle);
        await context.willStopShowing(subtitle);
        context.clear();
        context.clear();
        context.startedShowing(subtitle);
        await context.willStopShowing(subtitle);

        expect(onStartedShowing).toHaveBeenCalledTimes(2);
        expect(onWillStopShowing).toHaveBeenCalledTimes(2);
    });
});
