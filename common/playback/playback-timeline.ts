import type { SubtitleModel } from '@project/common';

export type PlaybackTimelineEdge = 'start' | 'end';

export interface PlaybackTimelineSnapshot<
    T extends SubtitleModel,
    Block extends PlaybackTimelineBlock = PlaybackTimelineBlock,
> {
    readonly durationMs: number;
    readonly blocks: readonly Block[];
    readonly displaySubtitles: readonly T[];
}

export interface PlaybackTimelineEvent {
    readonly timestampMs: number;
    readonly edge: PlaybackTimelineEdge;
    readonly block: PlaybackTimelineBlock;
}

export interface PlaybackTimelineBoundary {
    readonly timestampMs: number;
    readonly events: readonly PlaybackTimelineEvent[];
}

export interface PlaybackTimelineEventGroup extends PlaybackTimelineBoundary {
    readonly direction?: 'forward' | 'backward';
}

export interface PlaybackTimelineBlock {
    readonly id: string;
    readonly playbackModeStartMs: number;
    /** Final included timestamp for end actions such as auto-pause and repeat. */
    readonly playbackModeEndMs: number;
    /** First timestamp after the offset playback-action interval. */
    readonly playbackModeEndExclusiveMs: number;
    /** First protected timestamp before the subtitle, after which gap behavior stops. */
    readonly playbackModesStartGapMs: number;
    /** First gap-behavior timestamp after the subtitle and its configured end gap. */
    readonly playbackModesEndGapMs: number;
}

/** A half-open, non-overlapping interval of fully compiled persistent media state. */
export interface PlaybackTimelineSegment<T extends SubtitleModel> {
    readonly startMs: number;
    readonly showingSubtitles: readonly T[];
}

export interface PlaybackTimelineState {
    readonly current?: PlaybackTimelineBlock;
    readonly previous?: PlaybackTimelineBlock;
    readonly next?: PlaybackTimelineBlock;
}

type DisplayEdge<T extends SubtitleModel> = {
    readonly timestampMs: number;
    readonly edge: PlaybackTimelineEdge;
    readonly subtitle: T;
    readonly order: number;
};

type ActionTimelineBlock = PlaybackTimelineBlock & {
    readonly startAction?: true;
    readonly endAction?: unknown;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const firstBlockEndingAfter = (blocks: readonly PlaybackTimelineBlock[], timestampMs: number): number => {
    let low = 0;
    let high = blocks.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (blocks[middle].playbackModesEndGapMs <= timestampMs) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
};

const firstTimestampAfter = (timestamps: readonly number[], timestampMs: number): number => {
    let low = 0;
    let high = timestamps.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (timestamps[middle] <= timestampMs) low = middle + 1;
        else high = middle;
    }
    return low;
};

/**
 * An immutable, precomputed view of every timestamp at which visible subtitle state or playback policy can change.
 * Runtime traversal uses an array cursor; overlapping raw subtitles are resolved only while this object is built.
 */
export default class PlaybackTimeline<T extends SubtitleModel> {
    readonly durationMs: number;
    readonly blocks: readonly PlaybackTimelineBlock[];
    readonly boundaries: readonly PlaybackTimelineBoundary[];
    readonly segments: readonly PlaybackTimelineSegment<T>[];
    readonly actionTimestamps: readonly number[];
    readonly condensedGapStarts: readonly number[];
    readonly condensedGapTargets: readonly number[];
    private offsetMs = 0;

    private constructor(snapshot: PlaybackTimelineSnapshot<T>) {
        this.durationMs = snapshot.durationMs;
        this.blocks = snapshot.blocks;
        const events = this.eventsFromBlocks(this.blocks);
        const compiled = this.compileSegments(snapshot.displaySubtitles, events);
        this.boundaries = compiled.boundaries;
        this.segments = compiled.segments;
        this.actionTimestamps = [
            ...new Set(
                (this.blocks as readonly ActionTimelineBlock[]).flatMap((block) => [
                    ...(block.startAction !== undefined ? [block.playbackModeStartMs] : []),
                    ...(block.endAction !== undefined ? [block.playbackModeEndMs] : []),
                ])
            ),
        ].sort((left, right) => left - right);

        const condensedGapStarts: number[] = [];
        const condensedGapTargets: number[] = [];
        for (const [index, block] of this.blocks.entries()) {
            const gapStartMs = this.blocks[index - 1]?.playbackModesEndGapMs ?? 0;
            if (gapStartMs < block.playbackModesStartGapMs) {
                condensedGapStarts.push(gapStartMs);
                condensedGapTargets.push(block.playbackModesStartGapMs);
            }
        }
        this.condensedGapStarts = condensedGapStarts;
        this.condensedGapTargets = condensedGapTargets;
    }

    static fromSnapshot<T extends SubtitleModel>(snapshot: PlaybackTimelineSnapshot<T>): PlaybackTimeline<T> {
        return new PlaybackTimeline(snapshot);
    }

    private eventsFromBlocks(blocks: readonly PlaybackTimelineBlock[]): readonly PlaybackTimelineEvent[] {
        const events = blocks.flatMap<PlaybackTimelineEvent>((block) => [
            {
                timestampMs: block.playbackModeStartMs,
                edge: 'start',
                block,
            },
            {
                timestampMs: block.playbackModeEndMs,
                edge: 'end',
                block,
            },
        ]);
        events.sort((left, right) => left.timestampMs - right.timestampMs || (left.edge === 'start' ? -1 : 1));
        return events;
    }

    private compileSegments(
        displaySubtitles: readonly T[],
        events: readonly PlaybackTimelineEvent[]
    ): {
        boundaries: readonly PlaybackTimelineBoundary[];
        segments: readonly PlaybackTimelineSegment<T>[];
    } {
        const displayEdges: DisplayEdge<T>[] = [];
        const subtitleOrder = new Map<T, number>();
        for (const [order, subtitle] of displaySubtitles.entries()) {
            if (!Number.isFinite(subtitle.start) || !Number.isFinite(subtitle.end) || subtitle.end <= subtitle.start) {
                continue;
            }
            const startMs = clamp(subtitle.start, 0, this.durationMs);
            const endMs = clamp(subtitle.end, 0, this.durationMs);
            if (endMs <= startMs) continue;
            subtitleOrder.set(subtitle, order);
            displayEdges.push({ timestampMs: startMs, edge: 'start', subtitle, order });
            displayEdges.push({ timestampMs: endMs, edge: 'end', subtitle, order });
        }
        displayEdges.sort(
            (left, right) =>
                left.timestampMs - right.timestampMs ||
                (left.edge === right.edge ? left.order - right.order : left.edge === 'end' ? -1 : 1)
        );

        const timestamps = new Set<number>([0, this.durationMs]);
        for (const edge of displayEdges) timestamps.add(edge.timestampMs);
        for (const event of events) timestamps.add(event.timestampMs);
        for (const block of this.blocks) {
            timestamps.add(block.playbackModesStartGapMs);
            timestamps.add(block.playbackModesEndGapMs);
            timestamps.add(block.playbackModeEndExclusiveMs);
        }
        const sortedTimestamps = [...timestamps].sort((left, right) => left - right);

        const eventsByTimestamp = new Map<number, PlaybackTimelineEvent[]>();
        for (const event of events) {
            const values = eventsByTimestamp.get(event.timestampMs) ?? [];
            values.push(event);
            eventsByTimestamp.set(event.timestampMs, values);
        }
        const displayEdgesByTimestamp = new Map<number, DisplayEdge<T>[]>();
        for (const edge of displayEdges) {
            const values = displayEdgesByTimestamp.get(edge.timestampMs) ?? [];
            values.push(edge);
            displayEdgesByTimestamp.set(edge.timestampMs, values);
        }

        const active = new Set<T>();
        const segments = sortedTimestamps.map<PlaybackTimelineSegment<T>>((startMs) => {
            for (const edge of displayEdgesByTimestamp.get(startMs) ?? []) {
                if (edge.edge === 'end') active.delete(edge.subtitle);
                else active.add(edge.subtitle);
            }

            const showingSubtitles = [...active].sort(
                (left, right) => (subtitleOrder.get(left) ?? 0) - (subtitleOrder.get(right) ?? 0)
            );
            return {
                startMs,
                showingSubtitles,
            };
        });

        const boundaries = sortedTimestamps.map<PlaybackTimelineBoundary>((timestampMs) => ({
            timestampMs,
            events: eventsByTimestamp.get(timestampMs) ?? [],
        }));
        return { boundaries, segments };
    }

    stateAt(timestampMs: number): PlaybackTimelineState {
        const localTimestampMs = this.toLocalTimestamp(timestampMs);
        const index = firstBlockEndingAfter(this.blocks, localTimestampMs);
        const candidate = this.blocks[index];
        if (candidate !== undefined && candidate.playbackModesStartGapMs <= localTimestampMs) {
            return {
                current: candidate,
                previous: this.blocks[index - 1],
                next: this.blocks[index + 1],
            };
        }

        return {
            previous: this.blocks[index - 1],
            next: candidate,
        };
    }

    segmentAt(timestampMs: number): PlaybackTimelineSegment<T> {
        const localTimestampMs = this.toLocalTimestamp(timestampMs);
        let low = 0;
        let high = this.segments.length;
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            if (this.segments[middle].startMs <= localTimestampMs) low = middle + 1;
            else high = middle;
        }
        const segment = this.segments[Math.max(0, Math.min(this.segments.length - 1, low - 1))];
        if (this.offsetMs === 0) return segment;
        return {
            ...segment,
            startMs: this.toMediaTimestamp(segment.startMs),
        };
    }

    nextCondensedTarget(timestampMs: number): number | undefined {
        const localTimestampMs = this.toLocalTimestamp(timestampMs);
        const gapIndex = firstTimestampAfter(this.condensedGapStarts, localTimestampMs) - 1;
        if (gapIndex < 0 || localTimestampMs >= this.condensedGapTargets[gapIndex]) return;
        return this.toMediaTimestamp(this.condensedGapTargets[gapIndex]);
    }

    nextActionTimestamp(timestampMs: number, lookaheadTimestampMs: number): number | undefined {
        const localTimestampMs = this.toLocalTimestamp(timestampMs);
        const index = firstTimestampAfter(this.actionTimestamps, localTimestampMs);
        const timestamp = this.actionTimestamps[index];
        if (timestamp === undefined || timestamp > this.toLocalTimestamp(lookaheadTimestampMs)) return;
        return this.toMediaTimestamp(timestamp);
    }

    shift(deltaMs: number): void {
        if (Number.isFinite(deltaMs)) this.offsetMs += deltaMs;
    }

    toLocalTimestamp(timestampMs: number): number {
        return timestampMs - this.offsetMs;
    }

    toMediaTimestamp(timestampMs: number): number {
        return timestampMs + this.offsetMs;
    }
}
