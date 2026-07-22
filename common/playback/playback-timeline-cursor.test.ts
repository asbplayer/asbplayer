import { describe, expect, it } from '@jest/globals';
import { makeSubtitle, makeTimeline as timeline } from '@project/common/playback/playback-engine-test-utils';
import PlaybackTimelineCursor from '@project/common/playback/playback-timeline-cursor';

describe('PlaybackTimelineCursor', () => {
    it('coalesces equal targets into one timestamp while retaining both roles', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0)], {
            playbackModeStartOffset: 500,
            playbackModeEndOffset: -499,
        });
        const cursor = new PlaybackTimelineCursor(result, 1400);

        expect(cursor.advance(1600).filter((group) => group.events.length > 0)).toEqual([
            expect.objectContaining({
                timestampMs: 1500,
                events: [
                    expect.objectContaining({ edge: 'start', timestampMs: 1500 }),
                    expect.objectContaining({ edge: 'end', timestampMs: 1500 }),
                ],
            }),
        ]);
    });

    it('detects every boundary crossed by a large playback jump', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)]);
        const cursor = new PlaybackTimelineCursor(result, 500);

        expect(cursor.advance(4500).map((group) => group.timestampMs)).toEqual([
            999, 1000, 1999, 2000, 2999, 3000, 3999, 4000,
        ]);
    });

    it('emits a crossed boundary once during sequential updates', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0)]);
        const cursor = new PlaybackTimelineCursor(result, 900);

        expect(cursor.advance(1100)).toHaveLength(2);
        expect(cursor.advance(1500)).toEqual([]);
        expect(cursor.advance(2100).map((group) => group.timestampMs)).toEqual([1999, 2000]);
        expect(cursor.advance(2200)).toEqual([]);
    });

    it('reports persistent-state movement without replaying actions across a backward threshold', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0)]);
        const cursor = new PlaybackTimelineCursor(result, 0);
        cursor.advance(2100);

        expect(cursor.advance(500)).toEqual([{ timestampMs: 500, events: [], direction: 'backward' }]);
        expect(cursor.advance(900)).toEqual([]);
        expect(cursor.advance(1100).map((group) => group.timestampMs)).toEqual([999, 1000]);
    });

    it('does no work for backward timestamp movement inside the current segment', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0)]);
        const cursor = new PlaybackTimelineCursor(result, 1500);

        expect(cursor.advance(1400)).toEqual([]);
    });

    it('can include an exact seek target but exclude an already-corrected target', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0)]);
        const cursor = new PlaybackTimelineCursor(result, 500);

        cursor.reset(1000, { includeAtTimestamp: true });
        expect(cursor.advance(1000).map((group) => group.timestampMs)).toEqual([1000]);
        cursor.reset(1000, { includeAtTimestamp: false });
        expect(cursor.advance(1000)).toEqual([]);
    });
});
