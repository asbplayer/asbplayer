import type { SubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineEvent,
    type PlaybackTimelineSegment,
    type PlaybackTimelineState,
} from '@project/common/playback/playback-timeline';
import PlaybackTimelineCursor from '@project/common/playback/playback-timeline-cursor';

export interface PlaybackTimelineActionResult {
    readonly autoPaused: boolean;
    readonly seeked: boolean;
}

export interface PlaybackTimelineRunnerCallbacks<T extends SubtitleModel> {
    onStart(event: PlaybackTimelineEvent): boolean | Promise<boolean>;
    onEnd(event: PlaybackTimelineEvent): PlaybackTimelineActionResult | Promise<PlaybackTimelineActionResult>;
    correctAutoPause(timestampMs: number): Promise<void>;
    /** Reconciles persistent state only: subtitles, playback rate, and other state that must survive seeks. */
    onState(state: PlaybackTimelineState, segment: PlaybackTimelineSegment<T>): Promise<void>;
    /** Applies non-edge continuous behavior such as condensed playback after persistent state is current. */
    onAfterState(timestampMs: number): boolean | Promise<boolean>;
}

/** Applies precomputed crossed boundaries in time order and stops at the first position-changing action. */
export default class PlaybackTimelineRunner<T extends SubtitleModel> {
    private timeline: PlaybackTimeline<T>;
    private readonly cursor: PlaybackTimelineCursor<T>;
    private readonly callbacks: PlaybackTimelineRunnerCallbacks<T>;
    private initialUpdate = true;

    constructor(timeline: PlaybackTimeline<T>, timestampMs: number, callbacks: PlaybackTimelineRunnerCallbacks<T>) {
        this.timeline = timeline;
        this.cursor = new PlaybackTimelineCursor(timeline, timestampMs);
        this.callbacks = callbacks;
    }

    replaceTimeline(timeline: PlaybackTimeline<T>, timestampMs: number): void {
        this.timeline = timeline;
        this.cursor.replaceTimeline(timeline, timestampMs, { includeAtTimestamp: false });
        this.initialUpdate = true;
    }

    reset(timestampMs: number, options: { includeAtTimestamp: boolean }): void {
        this.cursor.reset(timestampMs, options);
        this.initialUpdate = false;
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
                this.cursor.reset(group.timestampMs, { includeAtTimestamp: false });
                await this.callbacks.correctAutoPause(group.timestampMs);
                return;
            }
            if (seeked) {
                this.cursor.reset(group.timestampMs, { includeAtTimestamp: false });
                return;
            }
        }

        const initialUpdate = this.initialUpdate;
        this.initialUpdate = false;
        if (groups.length === 0 && !initialUpdate) return;
        if (groups.length > 0) await this.applyState(timestampMs);
        if (groups.some((group) => group.direction === 'backward')) return;
        const stateChangedPosition = await this.callbacks.onAfterState(timestampMs);
        if (stateChangedPosition) this.cursor.reset(timestampMs, { includeAtTimestamp: true });
    }

    private async applyState(timestampMs: number): Promise<void> {
        const lookup = this.timeline.lookupAt(timestampMs);
        await this.callbacks.onState(lookup.state, lookup.segment);
    }
}
