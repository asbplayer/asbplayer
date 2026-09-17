import type { IndexedSubtitleModel } from '@project/common';
import { compilePlaybackTimeline } from '@project/common/playback/timeline/playback-timeline-compiler';
import type {
    PlaybackTimelineActionIndex,
    PlaybackTimelineCompilation,
    PlaybackTimelineSubtitles,
} from '@project/common/playback/timeline/playback-timeline-compiler';

export type PlaybackTimelineEdge = 'start' | 'end';

export interface PlaybackTimelineEvent {
    readonly timestampMs: number;
    readonly edge: PlaybackTimelineEdge;
    readonly block: PlaybackTimelineBlock;
}

export interface PlaybackTimelineEventGroup {
    readonly timestampMs: number;
    readonly events: readonly PlaybackTimelineEvent[];
    readonly direction?: 'backward';
}

export interface PlaybackTimelineRepeatAction {
    /** Zero means repeat indefinitely. */
    readonly count: number;
}

export interface PlaybackTimelineEndAction {
    readonly pause: boolean;
    readonly repeat?: PlaybackTimelineRepeatAction;
}

export interface PlaybackTimelineBlock {
    readonly id: string;
    /** Subtitle indexes that formed this playback-mode block. */
    readonly subtitleIndexes: readonly number[];
    readonly playbackModeStartMs: number;
    /** Final included timestamp for end actions such as auto-pause and repeat. */
    readonly playbackModeEndMs: number;
    /** First timestamp after the offset playback-action interval. */
    readonly playbackModeEndExclusiveMs: number;
    /** First protected timestamp before the subtitle, after which gap behavior stops. */
    readonly subtitleTriggerGapEndOffsetMs: number;
    /** First gap-behavior timestamp after the subtitle and its configured start offset. */
    readonly subtitleTriggerGapStartOffsetMs: number;
    /** Pause when the playback-mode interval starts. */
    readonly startAction?: true;
    readonly endAction?: PlaybackTimelineEndAction;
}

/** A half-open, non-overlapping interval of fully compiled persistent media state. */
export interface PlaybackTimelineSegment<T extends IndexedSubtitleModel> {
    readonly startMs: number;
    readonly showingSubtitles: readonly T[];
    readonly condensedTarget?: number;
    readonly nextStartActionTimestamp?: number;
}

export interface PlaybackTimelineState {
    readonly current?: PlaybackTimelineBlock;
    readonly previous?: PlaybackTimelineBlock;
    readonly next?: PlaybackTimelineBlock;
}

export type TimestampBound = 'after' | 'at-or-after';

export const firstTimestampIndex = <T>(
    values: readonly T[],
    timestampMs: number,
    timestampOf: (value: T) => number,
    bound: TimestampBound
): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        const valueTimestamp = timestampOf(values[middle]);
        if (valueTimestamp < timestampMs || (bound === 'after' && valueTimestamp === timestampMs)) low = middle + 1;
        else high = middle;
    }
    return low;
};

export const advanceTimestampIndex = <T>(
    values: readonly T[],
    index: number,
    timestampMs: number,
    timestampOf: (value: T) => number
): number => {
    while (index < values.length && timestampOf(values[index]) <= timestampMs) index++;
    return index;
};

/**
 * An immutable, precomputed view of every timestamp at which visible subtitle state or playback policy can change.
 * Runtime traversal uses an array cursor; overlapping raw subtitles are resolved only while this object is built.
 */
export default class PlaybackTimeline<T extends IndexedSubtitleModel> {
    readonly durationMs: number;
    readonly blocks: readonly PlaybackTimelineBlock[];
    private readonly blocksById: ReadonlyMap<string, PlaybackTimelineBlock>;
    readonly actionIndex: PlaybackTimelineActionIndex;
    readonly segments: readonly PlaybackTimelineSegment<T>[];
    readonly stateBoundaryTimestamps: readonly number[];
    readonly stateChangeTimestamps: readonly number[];
    private readonly states: readonly PlaybackTimelineState[];

    private constructor(compiled: PlaybackTimelineCompilation<T>) {
        this.durationMs = compiled.durationMs;
        this.blocks = compiled.blocks;
        const blocksById = new Map<string, PlaybackTimelineBlock>();
        for (const block of this.blocks) blocksById.set(block.id, block);
        this.blocksById = blocksById;
        this.actionIndex = compiled.actionIndex;
        this.segments = compiled.segments;
        this.stateBoundaryTimestamps = compiled.stateBoundaryTimestamps;
        this.states = compiled.states;
        this.stateChangeTimestamps = compiled.stateChangeTimestamps;
    }

    static fromSubtitles<T extends IndexedSubtitleModel>(subtitles: PlaybackTimelineSubtitles<T>): PlaybackTimeline<T> {
        return new PlaybackTimeline(compilePlaybackTimeline(subtitles));
    }

    lookupAt(timestampMs: number): {
        readonly state: PlaybackTimelineState;
        readonly segment: PlaybackTimelineSegment<T>;
    } {
        const index = this.indexAt(timestampMs);
        const segment = this.segments[index];
        return {
            state: this.states[index],
            segment,
        };
    }

    showingSubtitlesAt(timestampMs: number): readonly T[] {
        return this.lookupAt(timestampMs).segment.showingSubtitles;
    }

    blockById(blockId: string): PlaybackTimelineBlock | undefined {
        return this.blocksById.get(blockId);
    }

    private indexAt(timestampMs: number): number {
        const firstAfter = firstTimestampIndex(this.segments, timestampMs, (segment) => segment.startMs, 'after');
        return Math.max(0, Math.min(this.segments.length - 1, firstAfter - 1));
    }

    startActionsAt(timestampMs: number): readonly PlaybackTimelineBlock[] {
        return this.actionIndex.startActionsByTimestamp.get(timestampMs) ?? [];
    }

    hasStartActionAt(timestampMs: number): boolean {
        return this.startActionsAt(timestampMs).length > 0;
    }
}
