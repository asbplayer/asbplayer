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

        expect(cursor.advance(500, 1500)).toEqual({ actionTimestamp: 1000, stateChangeTimestamp: 999 });
        expect(cursor.advance(1100, 2500)).toEqual({ actionTimestamp: 1999, stateChangeTimestamp: 2000 });
        expect(cursor.advance(1200, 1300)).toEqual({});
    });

    it('resets its compiled indexes when playback moves backward', () => {
        const plan = buildPlaybackPlan(
            makePlaybackPlanInput([makeSubtitle(1000, 2000, 0)], {
                playModes: new Set([PlayMode.autoPause]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
            })
        );
        const timeline = PlaybackTimeline.fromSubtitles(plan.timelineSubtitles);
        const cursor = new PlaybackTimelineLookaheadCursor(timeline, 1500);

        expect(cursor.advance(1500, 2500)).toEqual({ actionTimestamp: 1999, stateChangeTimestamp: 2000 });
        expect(cursor.advance(500, 1500)).toEqual({ actionTimestamp: 1000, stateChangeTimestamp: 999 });
    });
});
