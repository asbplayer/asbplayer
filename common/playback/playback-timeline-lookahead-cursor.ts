import type { SubtitleModel } from '@project/common';
import PlaybackTimeline from '@project/common/playback/playback-timeline';

export interface PlaybackTimelineLookaheadResult {
    readonly actionTimestamp?: number;
    readonly stateChangeTimestamp?: number;
}

/** Advances compiled lookahead indexes for monotonic playback updates. */
export default class PlaybackTimelineLookaheadCursor<T extends SubtitleModel> {
    private timeline: PlaybackTimeline<T>;
    private nextActionIndex = 0;
    private nextStateChangeIndex = 0;
    private timestampMs = 0;

    constructor(timeline: PlaybackTimeline<T>, timestampMs: number) {
        this.timeline = timeline;
        this.reset(timestampMs);
    }

    replaceTimeline(timeline: PlaybackTimeline<T>, timestampMs: number): void {
        this.timeline = timeline;
        this.reset(timestampMs);
    }

    reset(timestampMs: number): void {
        this.timestampMs = timestampMs;
        this.nextActionIndex = this.firstTimestampAfter(this.timeline.actionTimestamps, timestampMs);
        this.nextStateChangeIndex = this.firstTimestampAfter(this.timeline.stateChangeTimestamps, timestampMs);
    }

    advance(
        timestampMs: number,
        lookaheadTimestampMs: number | undefined,
        includeStateChanges = true
    ): PlaybackTimelineLookaheadResult {
        if (timestampMs < this.timestampMs) this.reset(timestampMs);

        while (
            this.nextActionIndex < this.timeline.actionTimestamps.length &&
            this.timeline.actionTimestamps[this.nextActionIndex] <= timestampMs
        ) {
            this.nextActionIndex++;
        }
        if (includeStateChanges) {
            while (
                this.nextStateChangeIndex < this.timeline.stateChangeTimestamps.length &&
                this.timeline.stateChangeTimestamps[this.nextStateChangeIndex] <= timestampMs
            ) {
                this.nextStateChangeIndex++;
            }
        }
        this.timestampMs = timestampMs;

        if (lookaheadTimestampMs === undefined) return {};
        const actionTimestamp = this.timeline.actionTimestamps[this.nextActionIndex];
        const stateChangeTimestamp = includeStateChanges
            ? this.timeline.stateChangeTimestamps[this.nextStateChangeIndex]
            : undefined;
        return {
            ...(actionTimestamp === undefined || actionTimestamp > lookaheadTimestampMs ? {} : { actionTimestamp }),
            ...(stateChangeTimestamp === undefined || stateChangeTimestamp > lookaheadTimestampMs
                ? {}
                : { stateChangeTimestamp }),
        };
    }

    private firstTimestampAfter(timestamps: readonly number[], timestampMs: number): number {
        let low = 0;
        let high = timestamps.length;
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            if (timestamps[middle] <= timestampMs) low = middle + 1;
            else high = middle;
        }
        return low;
    }
}
