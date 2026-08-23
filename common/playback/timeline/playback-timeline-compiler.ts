import type { IndexedSubtitleModel } from '@project/common';
import { advanceTimestampIndex, firstTimestampIndex } from '@project/common/playback/timeline/playback-timeline';
import type {
    PlaybackTimelineBlock,
    PlaybackTimelineEdge,
    PlaybackTimelineEvent,
    PlaybackTimelineEventGroup,
    PlaybackTimelineSegment,
    PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import { clamp, normalizeFinite, normalizeNonNegative, normalizeNonPositive } from '@project/common/util';

export interface PlaybackTimelineSubtitles<T extends IndexedSubtitleModel> {
    readonly durationMs: number;
    readonly blocks: readonly PlaybackTimelineBlock[];
    readonly displaySubtitles: readonly T[];
}

export interface PlaybackTimelineActionIndex {
    readonly actionBoundaries: readonly PlaybackTimelineEventGroup[];
    readonly actionTimestamps: readonly number[];
    readonly startActionTimestamps: readonly number[];
    readonly startActionsByTimestamp: ReadonlyMap<number, readonly PlaybackTimelineBlock[]>;
}

export interface CondensedGap {
    readonly startMs: number;
    readonly targetMs: number;
}

export interface PlaybackTimelineOptions<T extends IndexedSubtitleModel> {
    /** Subtitles that are eligible to influence playback modes. */
    readonly subtitles: readonly T[];
    /** All subtitles that may be rendered. Defaults to subtitles. */
    readonly displaySubtitles?: readonly T[];
    readonly durationMs: number;
    readonly subtitleTriggerStartOffset: number;
    readonly subtitleTriggerEndOffset: number;
    readonly subtitleTriggerGapStartOffset: number;
    readonly subtitleTriggerGapEndOffset: number;
}

type MutableBlock<T extends IndexedSubtitleModel> = {
    startMs: number;
    endMs: number;
    subtitles: T[];
};

const blockId = <T extends IndexedSubtitleModel>(block: MutableBlock<T>): string =>
    JSON.stringify(block.subtitles.map(({ index }) => index).sort((left, right) => left - right));

const blocksFromSubtitles = <T extends IndexedSubtitleModel>(
    subtitles: readonly T[],
    durationMs: number,
    subtitleTriggerStartOffsetMs: number,
    subtitleTriggerEndOffsetMs: number,
    subtitleTriggerGapStartOffsetMs: number,
    subtitleTriggerGapEndOffsetMs: number
): readonly PlaybackTimelineBlock[] => {
    const mutableBlocks: MutableBlock<T>[] = [];
    for (const subtitle of subtitles) {
        const startMs = clamp(subtitle.start, 0, durationMs);
        const endMs = clamp(subtitle.end, 0, durationMs);
        if (endMs <= startMs) continue;

        const previous = mutableBlocks[mutableBlocks.length - 1];
        if (previous !== undefined && startMs < previous.endMs) {
            previous.subtitles.push(subtitle);
            if (endMs > previous.endMs) previous.endMs = endMs;
            continue;
        }

        mutableBlocks.push({
            startMs,
            endMs,
            subtitles: [subtitle],
        });
    }

    const subtitleTriggerStartOffset = normalizeFinite(subtitleTriggerStartOffsetMs);
    const subtitleTriggerEndOffset = normalizeFinite(subtitleTriggerEndOffsetMs);
    const subtitleTriggerGapStartOffset = normalizeNonNegative(subtitleTriggerGapStartOffsetMs);
    const subtitleTriggerGapEndOffset = normalizeNonPositive(subtitleTriggerGapEndOffsetMs);
    return mutableBlocks.map((block, index) => {
        const previousEndMs = mutableBlocks[index - 1]?.endMs ?? 0;
        const nextStartMs = mutableBlocks[index + 1]?.startMs ?? durationMs;
        const latestLegalTriggerMs = Math.max(previousEndMs, nextStartMs - 1);
        const shiftedStartMs = clamp(block.startMs + subtitleTriggerStartOffset, previousEndMs, latestLegalTriggerMs);
        const shiftedEndMs = clamp(block.endMs - 1 + subtitleTriggerEndOffset, previousEndMs, latestLegalTriggerMs);
        // Offsets are legal independently, so a sufficiently late start and early end may pass each other.
        // In that case their chronological roles swap: playback-mode effects still start at the earlier
        // boundary and end at the later boundary.
        const playbackModeStartMs = Math.min(shiftedStartMs, shiftedEndMs);
        const playbackModeEndMs = Math.max(shiftedStartMs, shiftedEndMs);
        // Persistent playback state changes on the millisecond after the final included end-action timestamp.
        const playbackModeEndExclusiveMs = Math.min(durationMs, playbackModeEndMs + 1);
        // The gap starts immediately after the subtitle and ends immediately before the next subtitle.
        const subtitleTriggerGapStartOffsetBoundaryMs = clamp(
            block.endMs + subtitleTriggerGapStartOffset,
            block.endMs,
            nextStartMs
        );
        const subtitleTriggerGapEndOffsetBoundaryMs = clamp(
            block.startMs - 1 + subtitleTriggerGapEndOffset,
            previousEndMs,
            block.startMs
        );

        return {
            id: blockId(block),
            playbackModeStartMs,
            playbackModeEndMs,
            playbackModeEndExclusiveMs,
            subtitleTriggerGapStartOffsetMs: subtitleTriggerGapStartOffsetBoundaryMs,
            subtitleTriggerGapEndOffsetMs: subtitleTriggerGapEndOffsetBoundaryMs,
        };
    });
};

export const compilePlaybackTimelineSubtitles = <T extends IndexedSubtitleModel>(
    options: PlaybackTimelineOptions<T>
): PlaybackTimelineSubtitles<T> => {
    const displaySubtitles = options.displaySubtitles ?? options.subtitles;
    const subtitles = options.subtitles
        .filter(
            (subtitle) =>
                Number.isFinite(subtitle.start) && Number.isFinite(subtitle.end) && subtitle.end > subtitle.start
        )
        .slice()
        .sort((left, right) => left.start - right.start || left.end - right.end || left.track - right.track);
    const inferredDurationMs = [...subtitles, ...displaySubtitles].reduce(
        (latest, subtitle) => (Number.isFinite(subtitle.end) ? Math.max(latest, subtitle.end) : latest),
        0
    );
    const durationMs = Number.isFinite(options.durationMs)
        ? Math.max(0, options.durationMs)
        : Math.max(0, inferredDurationMs);
    return {
        durationMs,
        blocks: blocksFromSubtitles(
            subtitles,
            durationMs,
            options.subtitleTriggerStartOffset,
            options.subtitleTriggerEndOffset,
            options.subtitleTriggerGapStartOffset,
            options.subtitleTriggerGapEndOffset
        ),
        displaySubtitles: [...displaySubtitles],
    };
};

export interface PlaybackTimelineCompilation<T extends IndexedSubtitleModel> {
    readonly durationMs: number;
    readonly blocks: readonly PlaybackTimelineBlock[];
    readonly boundaries: readonly PlaybackTimelineEventGroup[];
    readonly actionIndex: PlaybackTimelineActionIndex;
    readonly segments: readonly PlaybackTimelineSegment<T>[];
    readonly stateBoundaryTimestamps: readonly number[];
    readonly stateChangeTimestamps: readonly number[];
    readonly condensedGaps: readonly CondensedGap[];
    readonly states: readonly PlaybackTimelineState[];
}

type DisplayEdge<T extends IndexedSubtitleModel> = {
    readonly timestampMs: number;
    readonly edge: PlaybackTimelineEdge;
    readonly subtitle: T;
    readonly order: number;
};

const eventsFromBlocks = (blocks: readonly PlaybackTimelineBlock[]): readonly PlaybackTimelineEvent[] => {
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
    events.sort(
        (left, right) =>
            left.timestampMs - right.timestampMs || (left.edge === right.edge ? 0 : left.edge === 'start' ? -1 : 1)
    );
    return events;
};

const actionIndexFromBoundaries = (boundaries: readonly PlaybackTimelineEventGroup[]): PlaybackTimelineActionIndex => {
    const actionBoundaries = boundaries
        .map((group) => ({
            ...group,
            events: group.events.filter(
                (event) =>
                    (event.edge === 'start' && event.block.startAction !== undefined) ||
                    (event.edge === 'end' && event.block.endAction !== undefined)
            ),
        }))
        .filter((group) => group.events.length > 0);
    const startActionsByTimestamp = new Map<number, readonly PlaybackTimelineBlock[]>();
    for (const group of actionBoundaries) {
        const startActions = group.events.filter((event) => event.edge === 'start').map((event) => event.block);
        if (startActions.length > 0) startActionsByTimestamp.set(group.timestampMs, startActions);
    }
    return {
        actionBoundaries,
        actionTimestamps: actionBoundaries.map(({ timestampMs }) => timestampMs),
        startActionTimestamps: [...startActionsByTimestamp.keys()],
        startActionsByTimestamp,
    };
};

const compileSegments = <T extends IndexedSubtitleModel>(
    durationMs: number,
    blocks: readonly PlaybackTimelineBlock[],
    displaySubtitles: readonly T[],
    events: readonly PlaybackTimelineEvent[]
): {
    boundaries: readonly PlaybackTimelineEventGroup[];
    segments: readonly PlaybackTimelineSegment<T>[];
    states: readonly PlaybackTimelineState[];
} => {
    const displayEdges: DisplayEdge<T>[] = [];
    const subtitleOrder = new Map<T, number>();
    for (const [order, subtitle] of displaySubtitles.entries()) {
        if (!Number.isFinite(subtitle.start) || !Number.isFinite(subtitle.end) || subtitle.end <= subtitle.start) {
            continue;
        }
        const startMs = clamp(subtitle.start, 0, durationMs);
        const endMs = clamp(subtitle.end, 0, durationMs);
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

    const timestamps = new Set<number>([0, durationMs]);
    for (const edge of displayEdges) timestamps.add(edge.timestampMs);
    for (const event of events) timestamps.add(event.timestampMs);
    for (const block of blocks) {
        timestamps.add(block.subtitleTriggerGapEndOffsetMs);
        timestamps.add(block.subtitleTriggerGapStartOffsetMs);
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
        return { startMs, showingSubtitles };
    });

    let blockIndex = 0;
    const states = sortedTimestamps.map<PlaybackTimelineState>((timestampMs) => {
        blockIndex = advanceTimestampIndex(
            blocks,
            blockIndex,
            timestampMs,
            (block) => block.subtitleTriggerGapStartOffsetMs
        );
        const candidate = blocks[blockIndex];
        if (candidate !== undefined && candidate.subtitleTriggerGapEndOffsetMs <= timestampMs) {
            return {
                current: candidate,
                previous: blocks[blockIndex - 1],
                next: blocks[blockIndex + 1],
            };
        }
        return {
            previous: blocks[blockIndex - 1],
            next: candidate,
        };
    });

    const boundaries = sortedTimestamps.map<PlaybackTimelineEventGroup>((timestampMs) => ({
        timestampMs,
        events: eventsByTimestamp.get(timestampMs) ?? [],
    }));
    return { boundaries, segments, states };
};

export const compilePlaybackTimeline = <T extends IndexedSubtitleModel>(
    subtitles: PlaybackTimelineSubtitles<T>
): PlaybackTimelineCompilation<T> => {
    const events = eventsFromBlocks(subtitles.blocks);
    const compiledSegments = compileSegments(
        subtitles.durationMs,
        subtitles.blocks,
        subtitles.displaySubtitles,
        events
    );
    const actionIndex = actionIndexFromBoundaries(compiledSegments.boundaries);
    const stateBoundaryTimestamps = compiledSegments.segments.slice(1).map(({ startMs }) => startMs);
    const stateChangeTimestamps = [
        ...new Set(
            subtitles.blocks.flatMap((block) => [
                block.subtitleTriggerGapEndOffsetMs,
                block.subtitleTriggerGapStartOffsetMs,
            ])
        ),
    ].sort((left, right) => left - right);

    const condensedGaps: CondensedGap[] = [];
    for (const [index, block] of subtitles.blocks.entries()) {
        const gapStartMs = subtitles.blocks[index - 1]?.subtitleTriggerGapStartOffsetMs ?? 0;
        if (gapStartMs < block.subtitleTriggerGapEndOffsetMs) {
            condensedGaps.push({ startMs: gapStartMs, targetMs: block.subtitleTriggerGapEndOffsetMs });
        }
    }

    let nextStartActionIndex = 0;
    const segments = compiledSegments.segments.map((segment) => {
        nextStartActionIndex = advanceTimestampIndex(
            actionIndex.startActionTimestamps,
            nextStartActionIndex,
            segment.startMs,
            (timestamp) => timestamp
        );
        const gapIndex = firstTimestampIndex(condensedGaps, segment.startMs, (gap) => gap.startMs, 'after') - 1;
        const condensedTarget =
            gapIndex >= 0 && segment.startMs < condensedGaps[gapIndex].targetMs
                ? condensedGaps[gapIndex].targetMs
                : undefined;
        const nextStartActionTimestamp = actionIndex.startActionTimestamps[nextStartActionIndex];
        return {
            ...segment,
            ...(condensedTarget === undefined ? {} : { condensedTarget }),
            ...(nextStartActionTimestamp === undefined ? {} : { nextStartActionTimestamp }),
        };
    });

    return {
        durationMs: subtitles.durationMs,
        blocks: subtitles.blocks,
        boundaries: compiledSegments.boundaries,
        actionIndex,
        segments,
        stateBoundaryTimestamps,
        stateChangeTimestamps,
        condensedGaps,
        states: compiledSegments.states,
    };
};
