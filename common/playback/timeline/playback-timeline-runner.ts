import type { IndexedSubtitleModel } from '@project/common';
import PlaybackTimeline, {
    type PlaybackTimelineEvent,
    type PlaybackTimelineState,
} from '@project/common/playback/timeline/playback-timeline';
import PlaybackTimelineCursor from '@project/common/playback/timeline/playback-timeline-cursor';

export interface PlaybackTimelineActionResult {
    readonly autoPaused: boolean;
    readonly seeked: boolean;
}

export interface PlaybackTimelineRunnerCallbacks {
    onStart(event: PlaybackTimelineEvent): Promise<{ readonly autoPaused: boolean }>;
    onEnd(
        event: PlaybackTimelineEvent,
        options: { readonly alreadyAutoPaused: boolean }
    ): Promise<PlaybackTimelineActionResult>;
    correctAutoPause(timestampMs: number): Promise<void>;
    /** Reconciles state that must survive seeks, such as the playback rate. */
    onState(state: PlaybackTimelineState): Promise<void>;
    /** Applies non-edge continuous behavior such as condensed playback after state is current. */
    onAfterState(timestampMs: number): Promise<{ readonly stateChangedTimestampMs?: number }>;
}

/** Applies precomputed crossed actions in time order and stops at the first position-changing action. */
export default class PlaybackTimelineRunner<T extends IndexedSubtitleModel> {
    private timeline: PlaybackTimeline<T>;
    private readonly cursor: PlaybackTimelineCursor<T>;
    private readonly callbacks: PlaybackTimelineRunnerCallbacks;
    private initialUpdate = true;

    constructor(timeline: PlaybackTimeline<T>, timestampMs: number, callbacks: PlaybackTimelineRunnerCallbacks) {
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
                    autoPaused = (await this.callbacks.onStart(event)).autoPaused || autoPaused;
                } else {
                    const result = await this.callbacks.onEnd(event, { alreadyAutoPaused: autoPaused });
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
        const { stateChangedTimestampMs } = await this.callbacks.onAfterState(timestampMs);
        if (stateChangedTimestampMs !== undefined) {
            this.cursor.reset(stateChangedTimestampMs, { includeAtTimestamp: true });
        }
    }

    private async applyState(timestampMs: number): Promise<void> {
        await this.callbacks.onState(this.timeline.lookupAt(timestampMs).state);
    }
}
