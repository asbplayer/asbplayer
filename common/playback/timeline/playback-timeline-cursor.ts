import type { IndexedSubtitleModel } from '@project/common';
import type PlaybackTimeline from '@project/common/playback/timeline/playback-timeline';
import {
    advanceTimestampIndex,
    firstTimestampIndex,
    type PlaybackTimelineEventGroup,
} from '@project/common/playback/timeline/playback-timeline';

/** Tracks a monotonic playback position and returns every compiled boundary crossed by each update. */
export default class PlaybackTimelineCursor<T extends IndexedSubtitleModel> {
    private timeline: PlaybackTimeline<T>;
    private nextActionBoundaryIndex = 0;
    private nextStateBoundaryIndex = 0;
    private timestampMs = 0;

    constructor(timeline: PlaybackTimeline<T>, timestampMs: number) {
        this.timeline = timeline;
        this.reset(timestampMs, { includeAtTimestamp: true });
    }

    replaceTimeline(
        timeline: PlaybackTimeline<T>,
        timestampMs: number,
        options: { includeAtTimestamp: boolean }
    ): void {
        this.timeline = timeline;
        this.reset(timestampMs, options);
    }

    reset(timestampMs: number, options: { includeAtTimestamp: boolean }): void {
        this.timestampMs = timestampMs;
        const bound = options.includeAtTimestamp ? 'at-or-after' : 'after';
        this.nextActionBoundaryIndex = firstTimestampIndex(
            this.timeline.actionIndex.actionBoundaries,
            timestampMs,
            (boundary) => boundary.timestampMs,
            bound
        );
        this.nextStateBoundaryIndex = firstTimestampIndex(
            this.timeline.stateBoundaryTimestamps,
            timestampMs,
            (timestamp) => timestamp,
            bound
        );
    }

    advance(timestampMs: number): PlaybackTimelineEventGroup[] {
        if (timestampMs < this.timestampMs) {
            const lowerStateBoundary = this.timeline.stateBoundaryTimestamps[this.nextStateBoundaryIndex - 1];
            const crossedLowerThreshold = lowerStateBoundary !== undefined && timestampMs < lowerStateBoundary;
            this.timestampMs = timestampMs;
            if (!crossedLowerThreshold) return [];

            this.reset(timestampMs, { includeAtTimestamp: false });
            return [{ timestampMs, events: [], direction: 'backward' }];
        }

        const groups: PlaybackTimelineEventGroup[] = [];
        const nextActionBoundaryIndex = advanceTimestampIndex(
            this.timeline.actionIndex.actionBoundaries,
            this.nextActionBoundaryIndex,
            timestampMs,
            (boundary) => boundary.timestampMs
        );
        while (this.nextActionBoundaryIndex < nextActionBoundaryIndex) {
            const boundary = this.timeline.actionIndex.actionBoundaries[this.nextActionBoundaryIndex];
            groups.push(boundary);
            this.nextActionBoundaryIndex++;
        }

        const stateBoundaryIndex = firstTimestampIndex(
            this.timeline.stateBoundaryTimestamps,
            timestampMs,
            (timestamp) => timestamp,
            'after'
        );
        const stateChanged = stateBoundaryIndex > this.nextStateBoundaryIndex;
        this.nextStateBoundaryIndex = stateBoundaryIndex;
        if (stateChanged && !groups.length) groups.push({ timestampMs, events: [] });

        this.timestampMs = timestampMs;
        return groups;
    }
}
