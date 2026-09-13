import type { IndexedSubtitleModel } from '@project/common';
import type PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import { advanceTimestampIndex, firstTimestampIndex } from '@project/common/playback/timeline/playback-timeline';

export interface PlaybackTimelineLookaheadOptions {
    readonly lookaheadTimestampMs?: number;
    readonly includeStateChanges: boolean;
}

export interface PlaybackTimelineLookaheadResult {
    readonly actionTimestamp?: number;
    readonly stateChangeTimestamp?: number;
}

/** Advances compiled lookahead indexes for monotonic playback updates. */
export default class PlaybackTimelineLookaheadCursor<T extends IndexedSubtitleModel> {
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
        this.nextActionIndex = firstTimestampIndex(
            this.timeline.actionIndex.actionTimestamps,
            timestampMs,
            (timestamp) => timestamp,
            'after'
        );
        this.nextStateChangeIndex = firstTimestampIndex(
            this.timeline.stateChangeTimestamps,
            timestampMs,
            (timestamp) => timestamp,
            'after'
        );
    }

    advance(
        timestampMs: number,
        { lookaheadTimestampMs, includeStateChanges }: PlaybackTimelineLookaheadOptions
    ): PlaybackTimelineLookaheadResult {
        if (timestampMs < this.timestampMs) {
            const nextActionIndex = this.nextActionIndex;
            this.reset(timestampMs);
            this.nextActionIndex = Math.max(this.nextActionIndex, nextActionIndex);
        }

        this.nextActionIndex = advanceTimestampIndex(
            this.timeline.actionIndex.actionTimestamps,
            this.nextActionIndex,
            timestampMs,
            (timestamp) => timestamp
        );
        if (includeStateChanges) {
            this.nextStateChangeIndex = advanceTimestampIndex(
                this.timeline.stateChangeTimestamps,
                this.nextStateChangeIndex,
                timestampMs,
                (timestamp) => timestamp
            );
        }
        this.timestampMs = timestampMs;

        if (lookaheadTimestampMs === undefined) return {};
        const actionTimestamp = this.timeline.actionIndex.actionTimestamps[this.nextActionIndex];
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
}
