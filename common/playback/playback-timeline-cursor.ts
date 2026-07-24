import type { SubtitleModel } from '@project/common';
import PlaybackTimeline, { type PlaybackTimelineEventGroup } from '@project/common/playback/playback-timeline';

const boundaryBound = <T extends { timestampMs: number }>(
    values: readonly T[],
    timestampMs: number,
    options: { includeAtTimestamp: boolean }
): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (
            values[middle].timestampMs < timestampMs ||
            (!options.includeAtTimestamp && values[middle].timestampMs === timestampMs)
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
        this.nextBoundaryIndex = boundaryBound(this.timeline.boundaries, timestampMs, options);
    }

    advance(timestampMs: number): PlaybackTimelineEventGroup[] {
        if (timestampMs < this.timestampMs) {
            const lowerBoundary = this.timeline.boundaries[this.nextBoundaryIndex - 1];
            const crossedLowerThreshold = lowerBoundary !== undefined && timestampMs < lowerBoundary.timestampMs;
            this.timestampMs = timestampMs;
            if (!crossedLowerThreshold) return [];

            this.reset(timestampMs, { includeAtTimestamp: false });
            return [{ timestampMs, events: [], direction: 'backward' }];
        }

        const groups: PlaybackTimelineEventGroup[] = [];
        while (this.nextBoundaryIndex < this.timeline.boundaries.length) {
            const boundary = this.timeline.boundaries[this.nextBoundaryIndex];
            if (boundary.timestampMs > timestampMs) break;
            groups.push(boundary);
            this.nextBoundaryIndex++;
        }

        this.timestampMs = timestampMs;
        return groups;
    }
}
