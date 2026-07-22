import type { SubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineBlock,
    type PlaybackTimelineEvent,
    type PlaybackTimelineSegment,
    type PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import PlaybackTimelineCursor from '@project/common/playback/playback-timeline-cursor';

export type PlaybackTimelineTransitionCause = 'user-seek' | 'internal-seek';

export interface PlaybackTimelineActionResult {
    readonly autoPaused: boolean;
    readonly seeked: boolean;
}

export interface PlaybackTimelineRunnerCallbacks<
    T extends SubtitleModel,
    Block extends PlaybackTimelineBlock = PlaybackTimelineBlock,
> {
    onStart(event: PlaybackTimelineEvent<Block>): boolean | Promise<boolean>;
    onEnd(event: PlaybackTimelineEvent<Block>): PlaybackTimelineActionResult | Promise<PlaybackTimelineActionResult>;
    correctAutoPause(timestampMs: number): Promise<void>;
    /** Reconciles persistent state only: subtitles, playback rate, and other state that must survive seeks. */
    onState(state: PlaybackTimelineState<Block>, segment: PlaybackTimelineSegment<T>): Promise<void>;
    /** Applies non-edge continuous behavior such as condensed playback after persistent state is current. */
    onAfterState(timestampMs: number): boolean | Promise<boolean>;
}

/** Applies precomputed crossed boundaries in time order and stops at the first position-changing action. */
export default class PlaybackTimelineRunner<
    T extends SubtitleModel,
    Block extends PlaybackTimelineBlock = PlaybackTimelineBlock,
> {
    private timeline: PlaybackTimeline<T, Block>;
    private readonly cursor: PlaybackTimelineCursor<T, Block>;
    private readonly callbacks: PlaybackTimelineRunnerCallbacks<T, Block>;
    private applyInitialContinuousState = true;

    constructor(
        timeline: PlaybackTimeline<T, Block>,
        timestampMs: number,
        callbacks: PlaybackTimelineRunnerCallbacks<T, Block>
    ) {
        this.timeline = timeline;
        this.cursor = new PlaybackTimelineCursor(timeline, timestampMs);
        this.callbacks = callbacks;
    }

    replaceTimeline(
        timeline: PlaybackTimeline<T, Block>,
        timestampMs: number,
        options: { applyContinuousState: boolean }
    ): void {
        this.timeline = timeline;
        this.cursor.replaceTimeline(timeline, timestampMs, false);
        this.applyInitialContinuousState = options.applyContinuousState;
    }

    reset(timestampMs: number, includeAtTimestamp = true): void {
        this.cursor.reset(timestampMs, includeAtTimestamp);
        this.applyInitialContinuousState = false;
    }

    async update(timestampMs: number): Promise<void> {
        const groups = this.cursor.advance(timestampMs);
        for (const group of groups) {
            let autoPaused = false;
            let seeked = false;
            for (const event of group.events) {
                if (event.edge === 'start') {
                    autoPaused = (await this.callbacks.onStart(event)) || autoPaused;
                } else {
                    const result = await this.callbacks.onEnd(event);
                    autoPaused = result.autoPaused || autoPaused;
                    seeked = result.seeked || seeked;
                }
            }

            if (autoPaused) {
                await this.applyState(group.timestampMs);
                // advance() may have observed later boundaries in the same frame jump. Restore them so resuming from
                // the corrected position can still process them.
                this.cursor.reset(group.timestampMs, false);
                await this.callbacks.correctAutoPause(group.timestampMs);
                return;
            }
            if (seeked) {
                this.cursor.reset(group.timestampMs, false);
                return;
            }
        }

        if (groups.length === 0 && !this.applyInitialContinuousState) return;
        this.applyInitialContinuousState = false;
        await this.applyState(timestampMs);
        if (groups.some((group) => group.direction === 'backward')) return;
        const stateChangedPosition = await this.callbacks.onAfterState(timestampMs);
        if (stateChangedPosition) this.cursor.reset(timestampMs);
    }

    private async applyState(timestampMs: number): Promise<void> {
        const lookup = this.timeline.lookupAt(timestampMs);
        await this.callbacks.onState(lookup.state, lookup.segment);
    }
}
