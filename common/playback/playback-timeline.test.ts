import { describe, expect, it } from '@jest/globals';
import { makeSubtitle, makeTimeline as timeline } from '@project/common/playback/playback-engine-test-utils';

describe('PlaybackTimeline', () => {
    it('has no state or condensed target for zero subtitles', () => {
        const result = timeline([]);

        expect(result.lookupAt(1000).state).toEqual({ previous: undefined, next: undefined });
        expect(result.nextCondensedTarget(1000)).toBeUndefined();
    });

    it('describes active and gap regions without querying a subtitle collection', () => {
        const first = makeSubtitle(1000, 2000, 0);
        const second = makeSubtitle(3000, 4000, 1);
        const result = timeline([first, second], { subtitleTriggerStartOffset: -250 });
        const [firstBlock, secondBlock] = result.blocks;

        expect(result.lookupAt(1500).state.current).toBe(firstBlock);
        expect(result.lookupAt(2500).state.previous).toBe(firstBlock);
        expect(result.lookupAt(2500).state.next).toBe(secondBlock);
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

        expect(result.lookupAt(1100).state.current).toBe(result.blocks[0]);
        expect(result.nextCondensedTarget(1100)).toBeUndefined();
        expect(result.lookupAt(1500).state.current).toBe(result.blocks[0]);
        expect(result.lookupAt(1800).state.current).toBe(result.blocks[0]);
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

        expect(result.lookupAt(1500).segment.showingSubtitles).toEqual([first]);
        expect(result.lookupAt(2500).segment.showingSubtitles).toEqual([first, second]);
        expect(result.lookupAt(3000).segment.showingSubtitles).toEqual([second]);
        expect(result.lookupAt(4000).segment.showingSubtitles).toEqual([]);
    });

    it('uses the state after the terminal boundary at the exact media duration', () => {
        const visible = makeSubtitle(9000, 10000, 0);
        const result = timeline([visible]);

        expect(result.lookupAt(9999).segment.showingSubtitles).toEqual([visible]);
        expect(result.lookupAt(10000).segment.showingSubtitles).toEqual([]);
    });

    it('includes display-only subtitles in persistent-state segments', () => {
        const playbackSubtitle = makeSubtitle(1000, 2000, 0, { track: 0 });
        const displayOnlySubtitle = makeSubtitle(1500, 2500, 1, { track: 1 });
        const result = timeline([playbackSubtitle], { displaySubtitles: [playbackSubtitle, displayOnlySubtitle] });

        expect(result.lookupAt(1750).segment.showingSubtitles).toEqual([playbackSubtitle, displayOnlySubtitle]);
    });
});
