import type { SubtitleModel } from '@project/common';
import PlaybackTimeline, { type PlaybackTimelineEventGroup } from '@project/common/playback/playback-timeline';

const boundaryBound = <T extends { timestampMs: number }>(
    values: readonly T[],
    timestampMs: number,
    includeAtTimestamp: boolean
): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (
            values[middle].timestampMs < timestampMs ||
            (!includeAtTimestamp && values[middle].timestampMs === timestampMs)
        ) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
};

/** Tracks a monotonic playback position and returns every compiled boundary crossed by each update. */
export default class PlaybackTimelineCursor<T extends SubtitleModel> {
    private timeline: PlaybackTimeline<T>;
    private nextBoundaryIndex = 0;
    private timestampMs = 0;

    constructor(timeline: PlaybackTimeline<T>, timestampMs = 0) {
        this.timeline = timeline;
        this.reset(timestampMs);
    }

    replaceTimeline(timeline: PlaybackTimeline<T>, timestampMs: number, includeAtTimestamp = true): void {
        this.timeline = timeline;
        this.reset(timestampMs, includeAtTimestamp);
    }

    reset(timestampMs: number, includeAtTimestamp = true): void {
        this.timestampMs = timestampMs;
        this.nextBoundaryIndex = boundaryBound(
            this.timeline.boundaries,
            this.timeline.toLocalTimestamp(timestampMs),
            includeAtTimestamp
        );
    }

    advance(timestampMs: number): PlaybackTimelineEventGroup[] {
        if (timestampMs < this.timestampMs) {
            const lowerBoundary = this.timeline.boundaries[this.nextBoundaryIndex - 1];
            const crossedLowerThreshold =
                lowerBoundary !== undefined && timestampMs < this.timeline.toMediaTimestamp(lowerBoundary.timestampMs);
            this.timestampMs = timestampMs;
            if (!crossedLowerThreshold) return [];

            this.reset(timestampMs, false);
            return [{ timestampMs, events: [], direction: 'backward' }];
        }

        const groups: PlaybackTimelineEventGroup[] = [];
        while (this.nextBoundaryIndex < this.timeline.boundaries.length) {
            const boundary = this.timeline.boundaries[this.nextBoundaryIndex];
            const boundaryTimestampMs = this.timeline.toMediaTimestamp(boundary.timestampMs);
            if (boundaryTimestampMs > timestampMs) break;
            groups.push({
                ...boundary,
                timestampMs: boundaryTimestampMs,
                events: boundary.events.map((event) => ({
                    ...event,
                    timestampMs: this.timeline.toMediaTimestamp(event.timestampMs),
                })),
            });
            this.nextBoundaryIndex++;
        }

        this.timestampMs = timestampMs;
        return groups;
    }
}
