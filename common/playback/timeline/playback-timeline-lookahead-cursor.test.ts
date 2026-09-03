import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, PlayMode } from '@project/common';
import { makePlaybackPlanInput, makeSubtitle } from '@project/common/playback/playback-test-utils';
import { buildPlaybackPlan } from '@project/common/playback/plan/playback-plan';
import PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import PlaybackTimelineLookaheadCursor from '@project/common/playback/timeline/playback-timeline-lookahead-cursor';

describe('PlaybackTimelineLookaheadCursor', () => {
    it('advances compiled action and state indexes without replaying earlier timestamps', () => {
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([makeSubtitle(1000, 2000, 0), makeSubtitle(3000, 4000, 1)], {
                playModes: new Set([PlayMode.autoPause]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
            })
        );
        const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        const cursor = new PlaybackTimelineLookaheadCursor(timeline, 500);

        expect(cursor.advance(500, { lookaheadTimestampMs: 1500, includeStateChanges: true })).toEqual({
            actionTimestamp: 1000,
            stateChangeTimestamp: 999,
        });
        expect(cursor.advance(1100, { lookaheadTimestampMs: 2500, includeStateChanges: true })).toEqual({
            actionTimestamp: 1999,
            stateChangeTimestamp: 2000,
        });
        expect(cursor.advance(1200, { lookaheadTimestampMs: 1300, includeStateChanges: true })).toEqual({});
    });

    it('reconciles state without replaying actions when playback moves backward', () => {
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([makeSubtitle(1000, 2000, 0)], {
                playModes: new Set([PlayMode.autoPause]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
            })
        );
        const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        const cursor = new PlaybackTimelineLookaheadCursor(timeline, 1500);

        expect(cursor.advance(1500, { lookaheadTimestampMs: 2500, includeStateChanges: true })).toEqual({
            actionTimestamp: 1999,
            stateChangeTimestamp: 2000,
        });
        expect(cursor.advance(500, { lookaheadTimestampMs: 1500, includeStateChanges: true })).toEqual({
            stateChangeTimestamp: 999,
        });
    });
});
