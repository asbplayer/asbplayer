import { describe, expect, it } from '@jest/globals';
import type { SubtitleModel } from '@project/common';
import { makeSubtitle, makeTimelineOptions } from '@project/common/playback/playback-engine-test-utils';
import {
    compilePlaybackTimeline,
    type PlaybackTimelineOptions,
} from '@project/common/playback/playback-timeline-compiler';

const compile = (subtitles: SubtitleModel[], options: Partial<PlaybackTimelineOptions<SubtitleModel>> = {}) =>
    compilePlaybackTimeline(makeTimelineOptions(subtitles, options));

describe('compilePlaybackTimeline', () => {
    it('has no blocks for zero subtitles', () => {
        expect(compile([]).blocks).toEqual([]);
    });

    it('uses the visible and non-visible millisecond edges as the zero-offset trigger points', () => {
        const result = compile([makeSubtitle(1000, 2000, 0)]);

        expect(result.blocks[0]).toEqual(
            expect.objectContaining({
                playbackModeStartMs: 1000,
                playbackModeEndMs: 1999,
                subtitleTriggerGapEndOffsetMs: 999,
                subtitleTriggerGapStartOffsetMs: 2000,
            })
        );
    });

    it('only accepts gap offsets that extend normal playback', () => {
        const result = compile([makeSubtitle(1000, 2000, 0)], {
            subtitleTriggerGapEndOffset: 500,
            subtitleTriggerGapStartOffset: -500,
        });

        expect(result.blocks[0]).toEqual(
            expect.objectContaining({
                subtitleTriggerGapEndOffsetMs: 999,
                subtitleTriggerGapStartOffsetMs: 2000,
            })
        );
    });

    it('clamps shifted targets to media and neighboring subtitle boundaries', () => {
        const result = compile([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)], {
            durationMs: 3500,
            subtitleTriggerStartOffset: -5000,
            subtitleTriggerEndOffset: 5000,
            subtitleTriggerGapEndOffset: -5000,
            subtitleTriggerGapStartOffset: 5000,
        });

        expect(
            result.blocks.map((block) => [
                block.playbackModeStartMs,
                block.playbackModeEndMs,
                block.playbackModeEndExclusiveMs,
                block.subtitleTriggerGapEndOffsetMs,
                block.subtitleTriggerGapStartOffsetMs,
            ])
        ).toEqual([
            [0, 2999, 3000, 0, 3000],
            [2000, 3499, 3500, 2000, 3500],
        ]);
    });

    it('swaps crossed offset roles so playback effects remain chronological', () => {
        const result = compile([makeSubtitle(1000, 2000, 0)], {
            subtitleTriggerStartOffset: 900,
            subtitleTriggerEndOffset: -900,
        });

        expect(result.blocks[0]).toEqual(
            expect.objectContaining({
                playbackModeStartMs: 1099,
                playbackModeEndMs: 1900,
                playbackModeEndExclusiveMs: 1901,
            })
        );
    });

    it('allows crossed triggers into surrounding gaps without entering neighboring events', () => {
        const result = compile([makeSubtitle(1000, 2000, 0), makeSubtitle(5000, 6000, 1)], {
            subtitleTriggerStartOffset: 3000,
            subtitleTriggerEndOffset: -3000,
        });

        expect(
            result.blocks.map((block) => [
                block.playbackModeStartMs,
                block.playbackModeEndMs,
                block.playbackModeEndExclusiveMs,
            ])
        ).toEqual([
            [0, 4000, 4001],
            [2999, 8000, 8001],
        ]);
    });

    it('compiles action offsets independently from configurable start and end gaps', () => {
        const result = compile([makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)], {
            subtitleTriggerStartOffset: -100,
            subtitleTriggerEndOffset: 200,
            subtitleTriggerGapEndOffset: -250,
            subtitleTriggerGapStartOffset: 400,
        });

        expect(result.blocks[0]).toEqual(
            expect.objectContaining({
                playbackModeStartMs: 900,
                playbackModeEndExclusiveMs: 2200,
                subtitleTriggerGapEndOffsetMs: 749,
                subtitleTriggerGapStartOffsetMs: 2400,
            })
        );
    });

    it('merges overlapping subtitles but keeps adjacent subtitles separate', () => {
        const result = compile([makeSubtitle(1000, 2000, 0), makeSubtitle(1500, 2500, 1), makeSubtitle(2500, 3000, 2)]);

        expect(result.blocks.map((block) => [block.playbackModeStartMs, block.playbackModeEndExclusiveMs])).toEqual([
            [1000, 2500],
            [2500, 3000],
        ]);
    });

    it('assigns stable, distinct IDs to compiled blocks independently of playback policy offsets', () => {
        const subtitles = [makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)];
        const first = compile(subtitles);
        const replacement = compile(subtitles, {
            subtitleTriggerStartOffset: -250,
            subtitleTriggerEndOffset: 400,
        });

        expect(first.blocks.map(({ id }) => id)).toEqual(replacement.blocks.map(({ id }) => id));
        expect(new Set(first.blocks.map(({ id }) => id)).size).toBe(2);
    });

    it('keeps a block ID stable when equal-timestamp subtitles are reordered', () => {
        const first = makeSubtitle(1000, 2000, 0);
        const second = makeSubtitle(1000, 2000, 1);

        expect(compile([first, second]).blocks[0].id).toBe(compile([second, first]).blocks[0].id);
    });

    it('keeps display-only subtitles out of playback blocks', () => {
        const playbackSubtitle = makeSubtitle(1000, 2000, 0, { track: 0 });
        const displayOnlySubtitle = makeSubtitle(1500, 2500, 1, { track: 1 });
        const result = compile([playbackSubtitle], {
            displaySubtitles: [playbackSubtitle, displayOnlySubtitle],
        });

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].id).toBe(compile([playbackSubtitle]).blocks[0].id);
        expect(result.displaySubtitles).toEqual([playbackSubtitle, displayOnlySubtitle]);
    });
});
