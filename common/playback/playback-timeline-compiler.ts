import type { SubtitleModel } from '@project/common';
import type { PlaybackTimelineBlock, PlaybackTimelineSnapshot } from '@project/common/playback/playback-timeline';

export interface PlaybackTimelineOptions<T extends SubtitleModel> {
    /** Subtitles that are eligible to influence playback modes. */
    readonly subtitles: readonly T[];
    /** All subtitles that may be rendered. Defaults to subtitles. */
    readonly displaySubtitles?: readonly T[];
    readonly durationMs: number;
    readonly playbackModeStartOffset: number;
    readonly playbackModeEndOffset: number;
    readonly playbackModesStartGap: number;
    readonly playbackModesEndGap: number;
}

type MutableBlock<T extends SubtitleModel> = {
    startMs: number;
    endMs: number;
    subtitles: T[];
};

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const blockId = <T extends SubtitleModel>(block: MutableBlock<T>): string =>
    JSON.stringify(
        block.subtitles
            .map((subtitle) => JSON.stringify([subtitle.track, subtitle.index ?? null, subtitle.start, subtitle.end]))
            .sort()
    );

const blocksFromSubtitles = <T extends SubtitleModel>(
    subtitles: readonly T[],
    durationMs: number,
    playbackModeStartOffsetMs: number,
    playbackModeEndOffsetMs: number,
    playbackModesStartGapMs: number,
    playbackModesEndGapMs: number
): readonly PlaybackTimelineBlock[] => {
    const mutableBlocks: MutableBlock<T>[] = [];
    for (const subtitle of subtitles) {
        const startMs = clamp(subtitle.start, 0, durationMs);
        const endMs = clamp(subtitle.end, 0, durationMs);
        if (endMs <= startMs) continue;

        const previous = mutableBlocks[mutableBlocks.length - 1];
        if (previous !== undefined && startMs < previous.endMs) {
            previous.subtitles.push(subtitle);
            if (endMs > previous.endMs) {
                previous.endMs = endMs;
            }
            continue;
        }

        mutableBlocks.push({
            startMs,
            endMs,
            subtitles: [subtitle],
        });
    }

    const playbackModeStartOffset = finiteOrZero(playbackModeStartOffsetMs);
    const playbackModeEndOffset = finiteOrZero(playbackModeEndOffsetMs);
    const playbackModesStartGapOffset = Math.min(0, finiteOrZero(playbackModesStartGapMs));
    const playbackModesEndGap = Math.max(0, finiteOrZero(playbackModesEndGapMs));
    return mutableBlocks.map((block, index) => {
        const previousEndMs = mutableBlocks[index - 1]?.endMs ?? 0;
        const nextStartMs = mutableBlocks[index + 1]?.startMs ?? durationMs;
        const latestLegalTriggerMs = Math.max(previousEndMs, nextStartMs - 1);
        const shiftedStartMs = clamp(block.startMs + playbackModeStartOffset, previousEndMs, latestLegalTriggerMs);
        const shiftedEndMs = clamp(block.endMs - 1 + playbackModeEndOffset, previousEndMs, latestLegalTriggerMs);
        // Offsets are legal independently, so a sufficiently late start and early end may pass each other.
        // In that case their chronological roles swap: playback-mode effects still start at the earlier
        // boundary and end at the later boundary.
        const playbackModeStartMs = Math.min(shiftedStartMs, shiftedEndMs);
        const playbackModeEndMs = Math.max(shiftedStartMs, shiftedEndMs);
        // Persistent playback state changes on the millisecond after the final included end-action timestamp.
        const playbackModeEndExclusiveMs = Math.min(durationMs, playbackModeEndMs + 1);
        const playbackModesStartGapBoundaryMs = clamp(
            block.startMs - 1 + playbackModesStartGapOffset,
            previousEndMs,
            block.startMs
        );
        const playbackModesEndGapBoundaryMs = clamp(block.endMs + playbackModesEndGap, block.endMs, nextStartMs);

        return {
            id: blockId(block),
            playbackModeStartMs,
            playbackModeEndMs,
            playbackModeEndExclusiveMs,
            playbackModesStartGapMs: playbackModesStartGapBoundaryMs,
            playbackModesEndGapMs: playbackModesEndGapBoundaryMs,
        };
    });
};

export const compilePlaybackTimeline = <T extends SubtitleModel>(
    options: PlaybackTimelineOptions<T>
): PlaybackTimelineSnapshot<T> => {
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
            options.playbackModeStartOffset,
            options.playbackModeEndOffset,
            options.playbackModesStartGap,
            options.playbackModesEndGap
        ),
        displaySubtitles: [...displaySubtitles],
    };
};
