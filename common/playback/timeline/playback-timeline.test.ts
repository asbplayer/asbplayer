import { describe, expect, it } from '@jest/globals';
import { makeSubtitle, makeTimeline as timeline } from '@project/common/playback/playback-test-utils';
import PlaybackTimeline, { firstTimestampIndex } from '@project/common/playback/timeline/playback-timeline';

describe('PlaybackTimeline', () => {
    it('has no state for zero subtitles', () => {
        const result = timeline([]);

        expect(result.lookupAt(1000).state).toEqual({ previous: undefined, next: undefined });
    });

    it('describes active and gap regions without querying a subtitle collection', () => {
        const first = makeSubtitle(1000, 2000, 0);
        const second = makeSubtitle(3000, 4000, 1);
        const result = timeline([first, second], { subtitleTriggerStartOffset: -250 });
        const [firstBlock, secondBlock] = result.blocks;

        expect(result.lookupAt(1500).state.current).toBe(firstBlock);
        expect(result.lookupAt(2500).state.previous).toBe(firstBlock);
        expect(result.lookupAt(2500).state.next).toBe(secondBlock);
    });

    it('uses visible boundaries rather than playback action offsets for active and gap regions', () => {
        const result = timeline([makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)], {
            subtitleTriggerStartOffset: 250,
            subtitleTriggerEndOffset: -250,
        });

        expect(result.lookupAt(1100).state.current).toBe(result.blocks[0]);
        expect(result.lookupAt(1500).state.current).toBe(result.blocks[0]);
        expect(result.lookupAt(1800).state.current).toBe(result.blocks[0]);
    });

    it('finds the next start action from the encoded action timestamps', () => {
        const subtitles = [makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)];
        const base = timeline(subtitles, {
            subtitleTriggerStartOffset: -250,
        });
        const result = PlaybackTimeline.fromSubtitles({
            durationMs: base.durationMs,
            blocks: base.blocks.map((block) => ({ ...block, startAction: true as const })),
            displaySubtitles: subtitles,
        });

        expect(result.startActionsAt(3750)).toEqual([result.blocks[1]]);
        expect(result.startActionsAt(3751)).toEqual([]);
    });

    it('provides intent-level lookups for subtitles, blocks, and start actions', () => {
        const subtitles = [makeSubtitle(1000, 2000, 0)];
        const result = timeline(subtitles);
        const block = result.blocks[0];

        expect(result.showingSubtitlesAt(1500)).toEqual(subtitles);
        expect(result.blockById(block.id)).toBe(block);
        expect(result.blockById('missing')).toBeUndefined();
        expect(result.hasStartActionAt(block.playbackModeStartMs)).toBe(false);
    });

    it('retains all start actions that share a timestamp', () => {
        const subtitles = [makeSubtitle(1000, 2000, 0), makeSubtitle(4000, 5000, 1)];
        const base = timeline(subtitles);
        const result = PlaybackTimeline.fromSubtitles({
            durationMs: base.durationMs,
            blocks: base.blocks.map((block) => ({ ...block, playbackModeStartMs: 1000, startAction: true as const })),
            displaySubtitles: subtitles,
        });

        expect(result.actionIndex.startActionTimestamps).toEqual([1000]);
        expect(
            result
                .startActionsAt(1000)
                .map(({ id }) => id)
                .sort()
        ).toEqual(result.blocks.map(({ id }) => id).sort());
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

    it('provides the inactive members of a fixed connected group as invisible placeholders', () => {
        const primary = makeSubtitle(1000, 10000, 0, { track: 0 });
        const firstSecondary = makeSubtitle(2000, 4000, 1, { track: 1 });
        const secondSecondary = makeSubtitle(6000, 8000, 2, { track: 1 });
        const result = timeline([], { displaySubtitles: [primary, firstSecondary, secondSecondary] });

        expect(result.invisibleSubtitlesAt(500)).toEqual([]);
        expect(result.invisibleSubtitlesAt(1000)).toEqual([firstSecondary, secondSecondary]);
        expect(result.showingSubtitlesAt(1000)).toEqual([primary]);
        expect(result.invisibleSubtitlesAt(2500)).toEqual([secondSecondary]);
        expect(result.showingSubtitlesAt(2500)).toEqual([primary, firstSecondary]);
        expect(result.invisibleSubtitlesAt(4500)).toEqual([firstSecondary, secondSecondary]);
        expect(result.showingSubtitlesAt(4500)).toEqual([primary]);
        expect(result.invisibleSubtitlesAt(6500)).toEqual([firstSecondary]);
        expect(result.showingSubtitlesAt(6500)).toEqual([primary, secondSecondary]);
        expect(result.invisibleSubtitlesAt(8500)).toEqual([firstSecondary, secondSecondary]);
        expect(result.showingSubtitlesAt(8500)).toEqual([primary]);
        expect(result.invisibleSubtitlesAt(10000)).toEqual([]);
    });

    it('does not create placeholders for temporally disjoint subtitles', () => {
        const firstTrack = makeSubtitle(1000, 3000, 0, { track: 0 });
        const secondTrack = makeSubtitle(5000, 7000, 1, { track: 1 });
        const result = timeline([], { displaySubtitles: [firstTrack, secondTrack] });

        expect(result.showingSubtitlesAt(2000)).toEqual([firstTrack]);
        expect(result.invisibleSubtitlesAt(2000)).toEqual([]);
        expect(result.invisibleSubtitlesAt(4000)).toEqual([]);
        expect(result.showingSubtitlesAt(6000)).toEqual([secondTrack]);
        expect(result.invisibleSubtitlesAt(6000)).toEqual([]);
    });

    it('uses the same fixed-group rule for overlapping subtitles on one track', () => {
        const first = makeSubtitle(2000, 4000, 0, { text: 'ONE', track: 0 });
        const second = makeSubtitle(3000, 5000, 1, { text: 'HALF', track: 0 });
        const result = timeline([], { displaySubtitles: [first, second] });

        expect(result.invisibleSubtitlesAt(2500)).toEqual([second]);
        expect(result.showingSubtitlesAt(2500)).toEqual([first]);
        expect(result.invisibleSubtitlesAt(3500)).toEqual([]);
        expect(result.showingSubtitlesAt(3500)).toEqual([first, second]);
        expect(result.invisibleSubtitlesAt(4500)).toEqual([first]);
        expect(result.showingSubtitlesAt(4500)).toEqual([second]);
    });

    it('forms one fixed group through transitive overlaps across multiple tracks', () => {
        const first = makeSubtitle(1000, 4000, 0, { track: 0 });
        const second = makeSubtitle(3000, 6000, 1, { track: 1 });
        const third = makeSubtitle(5000, 8000, 2, { track: 2 });
        const result = timeline([], { displaySubtitles: [first, second, third] });
        expect(result.invisibleSubtitlesAt(1500)).toEqual([second, third]);
        expect(result.showingSubtitlesAt(1500)).toEqual([first]);
        expect(result.invisibleSubtitlesAt(4500)).toEqual([first, third]);
        expect(result.showingSubtitlesAt(4500)).toEqual([second]);
        expect(result.invisibleSubtitlesAt(6500)).toEqual([first, second]);
        expect(result.showingSubtitlesAt(6500)).toEqual([third]);
    });

    it('does not form a fixed group through transitive 1 ms overlaps', () => {
        const subtitles = Array.from({ length: 20 }, (_, index) =>
            makeSubtitle(index * 999, index * 999 + 1000, index)
        );
        const result = timeline([], { durationMs: 20_000, displaySubtitles: subtitles });

        expect(result.invisibleSubtitlesAt(500)).toEqual([]);
        expect(result.showingSubtitlesAt(999)).toEqual(subtitles.slice(0, 2));
        expect(result.invisibleSubtitlesAt(1500)).toEqual([]);
        expect(result.invisibleSubtitlesAt(19_000)).toEqual([]);
    });

    it('starts a canonically ordered layout epoch when a fifth transitive subtitle enters', () => {
        const subtitles = Array.from({ length: 5 }, (_, index) =>
            makeSubtitle(1000 + index * 1000, 3000 + index * 1000, index, { track: index % 2 })
        );
        const result = timeline([], { displaySubtitles: subtitles });

        expect(result.invisibleSubtitlesAt(4500)).toEqual(subtitles.slice(0, 2));
        expect(result.showingSubtitlesAt(4500)).toEqual(subtitles.slice(2, 4));
        expect(result.invisibleSubtitlesAt(5000)).toEqual([]);
        expect(result.showingSubtitlesAt(5000)).toEqual(subtitles.slice(3, 5));
    });

    it('renders every subtitle when more than four are genuinely visible simultaneously', () => {
        const subtitles = Array.from({ length: 5 }, (_, index) =>
            makeSubtitle(1000, 3000, index, { track: index % 2 })
        );
        const result = timeline([], { displaySubtitles: subtitles });

        expect(result.invisibleSubtitlesAt(1500)).toEqual([]);
        expect(result.showingSubtitlesAt(1500)).toEqual(subtitles);
    });

    it('bounds future placeholders when four persistent subtitles remain active', () => {
        const persistent = Array.from({ length: 4 }, (_, index) => makeSubtitle(0, 60000, index));
        const sequential = Array.from({ length: 100 }, (_, index) =>
            makeSubtitle(1000 + index * 500, 1400 + index * 500, persistent.length + index)
        );
        const result = timeline([], { displaySubtitles: [...persistent, ...sequential] });

        expect(result.showingSubtitlesAt(10)).toEqual(persistent);
        expect(result.invisibleSubtitlesAt(10)).toEqual([]);
        expect(Math.max(...result.segments.map(({ invisibleSubtitles }) => invisibleSubtitles.length))).toBe(1);
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

describe('firstTimestampIndex', () => {
    const timestamp = (value: number) => value;

    it.each([
        { values: [], target: 1000, bound: 'after' as const, expected: 0 },
        { values: [1000], target: 500, bound: 'after' as const, expected: 0 },
        { values: [1000], target: 1000, bound: 'after' as const, expected: 1 },
        { values: [1000], target: 1000, bound: 'at-or-after' as const, expected: 0 },
        { values: [1000], target: 1500, bound: 'at-or-after' as const, expected: 1 },
        { values: [1000, 2000, 3000], target: 2000, bound: 'after' as const, expected: 2 },
        { values: [1000, 2000, 3000], target: 2000, bound: 'at-or-after' as const, expected: 1 },
        { values: [1000, 1000, 2000], target: 1000, bound: 'after' as const, expected: 2 },
        { values: [1000, 1000, 2000], target: 1000, bound: 'at-or-after' as const, expected: 0 },
        { values: [1000, 2000, 3000], target: 4000, bound: 'after' as const, expected: 3 },
    ])('returns the first $bound timestamp index for $target', ({ values, target, bound, expected }) => {
        expect(firstTimestampIndex(values, target, timestamp, bound)).toBe(expected);
    });

    it('uses the timestamp accessor for timestamped objects', () => {
        const values = [{ timestampMs: 1000 }, { timestampMs: 2000 }, { timestampMs: 3000 }];

        expect(firstTimestampIndex(values, 1500, (value) => value.timestampMs, 'after')).toBe(1);
    });
});
