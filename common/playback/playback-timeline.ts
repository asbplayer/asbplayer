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

export interface PlaybackTimelineEvent<Block extends PlaybackTimelineBlock = PlaybackTimelineBlock> {
    readonly timestampMs: number;
    readonly edge: PlaybackTimelineEdge;
    readonly block: Block;
}

export interface PlaybackTimelineBoundary<Block extends PlaybackTimelineBlock = PlaybackTimelineBlock> {
    readonly timestampMs: number;
    readonly events: readonly PlaybackTimelineEvent<Block>[];
}

export interface PlaybackTimelineEventGroup<Block extends PlaybackTimelineBlock = PlaybackTimelineBlock>
    extends PlaybackTimelineBoundary<Block> {
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
    readonly subtitleTriggerGapEndOffsetMs: number;
    /** First gap-behavior timestamp after the subtitle and its configured start offset. */
    readonly subtitleTriggerGapStartOffsetMs: number;
}

/** A half-open, non-overlapping interval of fully compiled persistent media state. */
export interface PlaybackTimelineSegment<T extends SubtitleModel> {
    readonly startMs: number;
    readonly showingSubtitles: readonly T[];
}

export interface PlaybackTimelineState<Block extends PlaybackTimelineBlock = PlaybackTimelineBlock> {
    readonly current?: Block;
    readonly previous?: Block;
    readonly next?: Block;
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
        if (blocks[middle].subtitleTriggerGapStartOffsetMs <= timestampMs) {
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
export default class PlaybackTimeline<
    T extends SubtitleModel,
    Block extends PlaybackTimelineBlock = PlaybackTimelineBlock,
> {
    readonly durationMs: number;
    readonly blocks: readonly Block[];
    readonly blocksById: ReadonlyMap<string, Block>;
    readonly boundaries: readonly PlaybackTimelineBoundary<Block>[];
    readonly segments: readonly PlaybackTimelineSegment<T>[];
    readonly actionTimestamps: readonly number[];
    readonly stateChangeTimestamps: readonly number[];
    readonly condensedGapStarts: readonly number[];
    readonly condensedGapTargets: readonly number[];
    private readonly states: readonly PlaybackTimelineState<Block>[];

    private constructor(snapshot: PlaybackTimelineSnapshot<T, Block>) {
        this.durationMs = snapshot.durationMs;
        this.blocks = snapshot.blocks;
        const blocksById = new Map<string, Block>();
        for (const block of this.blocks) blocksById.set(block.id, block);
        this.blocksById = blocksById;
        const events = this.eventsFromBlocks(this.blocks);
        const compiled = this.compileSegments(snapshot.displaySubtitles, events);
        this.boundaries = compiled.boundaries;
        this.segments = compiled.segments;
        this.states = compiled.states;
        this.actionTimestamps = [
            ...new Set(
                (this.blocks as readonly ActionTimelineBlock[]).flatMap((block) => [
                    ...(block.startAction !== undefined ? [block.playbackModeStartMs] : []),
                    ...(block.endAction !== undefined ? [block.playbackModeEndMs] : []),
                ])
            ),
        ].sort((left, right) => left - right);
        this.stateChangeTimestamps = [
            ...new Set(
                this.blocks.flatMap((block) => [
                    block.subtitleTriggerGapEndOffsetMs,
                    block.subtitleTriggerGapStartOffsetMs,
                ])
            ),
        ].sort((left, right) => left - right);

        const condensedGapStarts: number[] = [];
        const condensedGapTargets: number[] = [];
        for (const [index, block] of this.blocks.entries()) {
            const gapStartMs = this.blocks[index - 1]?.subtitleTriggerGapStartOffsetMs ?? 0;
            if (gapStartMs < block.subtitleTriggerGapEndOffsetMs) {
                condensedGapStarts.push(gapStartMs);
                condensedGapTargets.push(block.subtitleTriggerGapEndOffsetMs);
            }
        }
        this.condensedGapStarts = condensedGapStarts;
        this.condensedGapTargets = condensedGapTargets;
    }

    static fromSnapshot<T extends SubtitleModel, Block extends PlaybackTimelineBlock = PlaybackTimelineBlock>(
        snapshot: PlaybackTimelineSnapshot<T, Block>
    ): PlaybackTimeline<T, Block> {
        return new PlaybackTimeline(snapshot);
    }

    private eventsFromBlocks(blocks: readonly Block[]): readonly PlaybackTimelineEvent<Block>[] {
        const events = blocks.flatMap<PlaybackTimelineEvent<Block>>((block) => [
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
        events: readonly PlaybackTimelineEvent<Block>[]
    ): {
        boundaries: readonly PlaybackTimelineBoundary<Block>[];
        segments: readonly PlaybackTimelineSegment<T>[];
        states: readonly PlaybackTimelineState<Block>[];
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
            timestamps.add(block.subtitleTriggerGapEndOffsetMs);
            timestamps.add(block.subtitleTriggerGapStartOffsetMs);
            timestamps.add(block.playbackModeEndExclusiveMs);
        }
        const sortedTimestamps = [...timestamps].sort((left, right) => left - right);

        const eventsByTimestamp = new Map<number, PlaybackTimelineEvent<Block>[]>();
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

        let blockIndex = 0;
        const states = sortedTimestamps.map<PlaybackTimelineState<Block>>((timestampMs) => {
            while (
                blockIndex < this.blocks.length &&
                this.blocks[blockIndex].subtitleTriggerGapStartOffsetMs <= timestampMs
            ) {
                blockIndex++;
            }
            const candidate = this.blocks[blockIndex];
            if (candidate !== undefined && candidate.subtitleTriggerGapEndOffsetMs <= timestampMs) {
                return {
                    current: candidate,
                    previous: this.blocks[blockIndex - 1],
                    next: this.blocks[blockIndex + 1],
                };
            }
            return {
                previous: this.blocks[blockIndex - 1],
                next: candidate,
            };
        });

        const boundaries = sortedTimestamps.map<PlaybackTimelineBoundary<Block>>((timestampMs) => ({
            timestampMs,
            events: eventsByTimestamp.get(timestampMs) ?? [],
        }));
        return { boundaries, segments, states };
    }

    stateAt(timestampMs: number): PlaybackTimelineState<Block> {
        const index = firstBlockEndingAfter(this.blocks, timestampMs);
        const candidate = this.blocks[index];
        if (candidate !== undefined && candidate.subtitleTriggerGapEndOffsetMs <= timestampMs) {
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
        return this.segments[this.indexAt(timestampMs)];
    }

    lookupAt(timestampMs: number): {
        readonly state: PlaybackTimelineState<Block>;
        readonly segment: PlaybackTimelineSegment<T>;
    } {
        const index = this.indexAt(timestampMs);
        const segment = this.segments[index];
        return {
            state: this.states[index],
            segment,
        };
    }

    private indexAt(timestampMs: number): number {
        let low = 0;
        let high = this.segments.length;
        while (low < high) {
            const middle = low + Math.floor((high - low) / 2);
            if (this.segments[middle].startMs <= timestampMs) low = middle + 1;
            else high = middle;
        }
        return Math.max(0, Math.min(this.segments.length - 1, low - 1));
    }

    nextCondensedTarget(timestampMs: number): number | undefined {
        const gapIndex = firstTimestampAfter(this.condensedGapStarts, timestampMs) - 1;
        if (gapIndex < 0 || timestampMs >= this.condensedGapTargets[gapIndex]) return;
        return this.condensedGapTargets[gapIndex];
    }

    nextActionTimestamp(timestampMs: number, lookaheadTimestampMs: number): number | undefined {
        const index = firstTimestampAfter(this.actionTimestamps, timestampMs);
        const timestamp = this.actionTimestamps[index];
        if (timestamp === undefined || timestamp > lookaheadTimestampMs) return;
        return timestamp;
    }

    nextStateChangeTimestamp(timestampMs: number, lookaheadTimestampMs: number): number | undefined {
        const index = firstTimestampAfter(this.stateChangeTimestamps, timestampMs);
        const timestamp = this.stateChangeTimestamps[index];
        if (timestamp === undefined || timestamp > lookaheadTimestampMs) return;
        return timestamp;
    }
}
