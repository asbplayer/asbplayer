import { describe, expect, it } from '@jest/globals';
import { makeSubtitle, makeTimeline as timeline } from '@project/common/playback/playback-engine-test-utils';

describe('PlaybackTimeline', () => {
    it('has no state or condensed target for zero subtitles', () => {
        const result = timeline([]);

        expect(result.stateAt(1000)).toEqual({ previous: undefined, next: undefined });
        expect(result.nextCondensedTarget(1000)).toBeUndefined();
    });

    it('describes active and gap regions without querying a subtitle collection', () => {
        const first = makeSubtitle(1000, 2000, 0);
        const second = makeSubtitle(3000, 4000, 1);
        const result = timeline([first, second], { subtitleTriggerStartOffset: -250 });
        const [firstBlock, secondBlock] = result.blocks;

        expect(result.stateAt(1500).current).toBe(firstBlock);
        expect(result.stateAt(2500).previous).toBe(firstBlock);
        expect(result.stateAt(2500).next).toBe(secondBlock);
        expect(result.nextCondensedTarget(2100)).toBe(2999);
    });

    it('exposes a condensed target throughout the invisible gap despite a positive end offset', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)], {
            subtitleTriggerEndOffset: 500,
        });

        expect(result.nextCondensedTarget(2100)).toBe(2999);
    });

    it('uses visible boundaries rather than playback action offsets for active and gap regions', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)], {
            subtitleTriggerStartOffset: 250,
            subtitleTriggerEndOffset: -250,
        });

        expect(result.stateAt(1100).current).toBe(result.blocks[0]);
        expect(result.nextCondensedTarget(1100)).toBeUndefined();
        expect(result.stateAt(1500).current).toBe(result.blocks[0]);
        expect(result.stateAt(1800).current).toBe(result.blocks[0]);
        expect(result.nextCondensedTarget(2000)).toBe(3999);
    });

    it('uses configurable start and end gaps for condensed playback', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)], {
            subtitleTriggerStartOffset: -100,
            subtitleTriggerEndOffset: 200,
            subtitleTriggerGapEndOffset: -250,
            subtitleTriggerGapStartOffset: 400,
        });

        expect(result.nextCondensedTarget(2399)).toBeUndefined();
        expect(result.nextCondensedTarget(2400)).toBe(3749);
    });

    it('compiles overlapping visible subtitles into half-open persistent-state segments', () => {
        const first = makeSubtitle(1000, 3000, 0);
        const second = makeSubtitle(2000, 4000, 1);
        const result = timeline([], { displaySubtitles: [first, second] });

        expect(result.segmentAt(1500).showingSubtitles).toEqual([first]);
        expect(result.segmentAt(2500).showingSubtitles).toEqual([first, second]);
        expect(result.segmentAt(3000).showingSubtitles).toEqual([second]);
        expect(result.segmentAt(4000).showingSubtitles).toEqual([]);
    });

    it('uses the state after the terminal boundary at the exact media duration', () => {
        const visible = makeSubtitle(9000, 10000, 0);
        const result = timeline([visible]);

        expect(result.segmentAt(9999).showingSubtitles).toEqual([visible]);
        expect(result.segmentAt(10000).showingSubtitles).toEqual([]);
    });

    it('includes display-only subtitles in persistent-state segments', () => {
        const playbackSubtitle = makeSubtitle(1000, 2000, 0, { track: 0 });
        const displayOnlySubtitle = makeSubtitle(1500, 2500, 1, { track: 1 });
        const result = timeline([playbackSubtitle], { displaySubtitles: [playbackSubtitle, displayOnlySubtitle] });

        expect(result.segmentAt(1750).showingSubtitles).toEqual([playbackSubtitle, displayOnlySubtitle]);
    });
});
