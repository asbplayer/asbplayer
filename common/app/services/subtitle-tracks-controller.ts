import type { DisplaySubtitleModel, LoadableSubtitleTrack, SubtitleSourceMessage } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleReader } from '@project/common/subtitle-reader';
import type VideoChannel from '@project/common/app/services/video-channel';
import {
    displaySubtitleSnapshot,
    SubtitleStream,
    subtitleSourceNames,
} from '@project/common/subtitle-reader/subtitle-stream';
import type {
    SubtitleSourceProducer,
    SubtitleSourceState,
    SubtitleSourceUpdate,
} from '@project/common/subtitle-reader/subtitle-stream';
import { asbTrace } from '@project/common/util/log';

type SubtitleTrackSource = (
    | {
          /** App-owned files parsed in full before publishing their subtitles. */
          kind: 'local';
          tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
          reader: Pick<SubtitleReader, 'subtitles'>;
          /** Releases the initial file-loading UI after parsing finishes. */
          onInitialized: () => void;
      }
    | {
          /** Video-owned subtitles received as snapshots and incremental updates. */
          kind: 'remote';
          supportsProgressiveSubtitles: boolean;
          onOffset: (offset: number) => void;
      }
    | {
          /** App-owned incremental source that emits subtitle updates while loading. */
          kind: 'producer';
          producer: SubtitleSourceProducer;
          supportsProgressiveSubtitles: boolean;
          /** Releases the initial loading UI after startup; progressive track loading may continue. */
          onInitialized: () => void;
      }
) & { onSourcesChanged?: (sources: readonly SubtitleSourceState[]) => void };

type SubtitleTrackChannel = Pick<
    VideoChannel,
    'onReady' | 'subtitles' | 'subtitlesUpdated' | 'onSubtitleSource' | 'subtitleSource' | 'requestSubtitleSource'
>;

export interface SubtitleTracksOptions {
    source: SubtitleTrackSource;
    subtitles: DisplaySubtitleModel[] | undefined;
    channel: SubtitleTrackChannel | undefined;
    getSubtitleOffset: () => number;
    shouldRestoreSubtitles: (subtitleCount: number) => Promise<boolean>;
    onSubtitles: (update: (previous: DisplaySubtitleModel[] | undefined) => DisplaySubtitleModel[]) => void;
    onError: (error: unknown) => void;
}

export interface SubtitleTracksState {
    sources: readonly SubtitleSourceState[];
    loadingFiles: boolean;
}

type Activity =
    | { kind: 'idle' }
    | { kind: 'remote' }
    | { kind: 'loading-files'; tracks: LoadableSubtitleTrack<FileWithId>[] }
    | { kind: 'files' }
    | { kind: 'producer'; controller: AbortController };

/** Owns source transitions and channel synchronization; React only publishes its state. */
export class SubtitleTracksController {
    private readonly stream = new SubtitleStream();
    private activity: Activity = { kind: 'idle' };
    private sources: readonly SubtitleSourceState[] = [];
    private channel?: SubtitleTrackChannel;
    private ready = false;

    constructor(
        public options: SubtitleTracksOptions,
        private readonly stateChanged: (state: SubtitleTracksState) => void
    ) {}

    setSource(source: SubtitleTrackSource): void {
        this.options.source = source;
        this.cancelSource();
        if (source.kind !== 'remote') source.onSourcesChanged?.([]);
        switch (source.kind) {
            case 'remote':
                this.activity = { kind: 'remote' };
                this.sources = [];
                this.notifyTrackStateChanged();
                return;
            case 'producer': {
                const controller = new AbortController();
                this.activity = { kind: 'producer', controller };
                this.notifyTrackStateChanged();
                void this.produce(source, controller.signal);
                source.onInitialized();
                return;
            }
            case 'local':
                if (source.tracks === undefined) {
                    this.sources = [];
                    this.notifyTrackStateChanged();
                    return;
                }
                void this.loadFiles(source, source.tracks).catch((error) => this.options.onError(error));
        }
    }

    cancelSource(): void {
        const previous = this.activity;
        this.activity = { kind: 'idle' };
        if (previous.kind === 'producer') previous.controller.abort();
    }

    connect(channel: SubtitleTrackChannel | undefined): () => void {
        this.channel = channel;
        this.ready = false;
        if (!channel) return () => {};
        let active = true;
        const removeSource = channel.onSubtitleSource((update) => this.receiveRemote(update));
        const removeReady = channel.onReady(() => {
            const firstReady = !this.ready;
            this.ready = true;
            const source = this.options.source;
            if (source.kind === 'remote') {
                if (source.supportsProgressiveSubtitles) channel.requestSubtitleSource();
            } else if (firstReady) {
                this.sendSnapshotToVideo();
            } else {
                void this.options
                    .shouldRestoreSubtitles(this.stream.snapshot().subtitles.length)
                    .then((restore) => {
                        if (active && restore) this.sendSnapshotToVideo();
                    })
                    .catch((error) => {
                        if (active) this.options.onError(error);
                    });
            }
        });
        return () => {
            active = false;
            this.channel = undefined;
            this.ready = false;
            removeSource();
            removeReady();
        };
    }

    private async loadFiles(
        source: Extract<SubtitleTrackSource, { kind: 'local' }>,
        tracks: LoadableSubtitleTrack<FileWithId>[]
    ): Promise<void> {
        const activity = { kind: 'loading-files', tracks } as const;
        this.activity = activity;
        this.notifyTrackStateChanged();
        const names = tracks.map(({ fileParts }) => fileParts[0]?.file.name ?? '');
        asbTrace('playback/player', 'Loading player subtitles', {
            subtitleTrackCount: tracks.length,
            subtitleFileCount: tracks.reduce((count, { fileParts }) => count + fileParts.length, 0),
            subtitleFileNames: names,
        });
        try {
            const nodes = tracks.length
                ? await source.reader.subtitles(
                      tracks.map(({ fileParts }) => ({ fileParts: fileParts.map(({ file }) => file) }))
                  )
                : [];
            if (this.activity !== activity) return;
            this.stream.replace(
                nodes.map((cue) => ({ ...cue, originalStart: cue.start, originalEnd: cue.end })),
                names
            );
            asbTrace('playback/player', 'Loaded player subtitles', {
                subtitleCount: nodes.length,
                subtitleCountsByTrack: tracks.map((_, track) => nodes.filter((cue) => cue.track === track).length),
            });
        } catch (error) {
            if (this.activity !== activity) return;
            asbTrace('playback/player', 'Failed to load player subtitles', { error });
            this.options.onError(error);
            this.stream.replace([], names, error instanceof Error ? error.message : String(error));
        }
        if (this.activity !== activity) return;
        this.activity = { kind: 'files' };
        this.updateDisplayedSubtitles(source);
        this.sendSnapshotToVideo();
        const current = this.options.source;
        if (current.kind === 'local') current.onInitialized();
    }

    private async produce(source: Extract<SubtitleTrackSource, { kind: 'producer' }>, signal: AbortSignal) {
        try {
            await source.producer((update) => {
                if (!signal.aborted) this.receiveProducer(source, update);
            }, signal);
        } catch (error) {
            if (!signal.aborted) this.options.onError(error);
        }
    }

    private receiveRemote(update: SubtitleSourceMessage['update']): void {
        const source = this.options.source;
        if (source.kind !== 'remote' || this.activity.kind !== 'remote') return;
        if (!this.stream.update(update)) return;
        if (update.type === 'snapshot') source.onOffset(update.offset);
        this.updateDisplayedSubtitles(source);
        if (update.type === 'failed') this.options.onError(new Error(update.error));
    }

    private receiveProducer(
        source: Extract<SubtitleTrackSource, { kind: 'producer' }>,
        update: SubtitleSourceUpdate
    ): void {
        if (!this.stream.update(update)) return;
        this.updateDisplayedSubtitles(source);
        if (update.type === 'failed') this.options.onError(new Error(update.error));
        const current = this.options.source;
        if (!this.channel || !this.ready || current.kind !== 'producer') return;
        if (current.supportsProgressiveSubtitles) {
            this.channel.subtitleSource(update);
        } else {
            this.sendSnapshotToVideo();
        }
    }

    private updateDisplayedSubtitles(source: SubtitleTrackSource): void {
        const snapshot = this.stream.snapshot();
        // Publish through the source that produced the snapshot, even if a render has replaced options.source.
        const onSourcesChanged = source.onSourcesChanged;
        const current = this.options.source;
        if (
            current.kind === 'producer' &&
            !current.supportsProgressiveSubtitles &&
            snapshot.tracks.some((track) => track.status === 'loading')
        ) {
            onSourcesChanged?.(snapshot.tracks);
            return; // Older extensions need completed tracks because their messages identify cues by index.
        }
        this.sources = snapshot.tracks;
        this.notifyTrackStateChanged();
        this.options.onSubtitles((previous) =>
            displaySubtitleSnapshot(snapshot, previous ?? [], this.options.getSubtitleOffset())
        );
        onSourcesChanged?.(snapshot.tracks);
    }

    private notifyTrackStateChanged(): void {
        this.stateChanged({
            sources: this.sources,
            loadingFiles: this.activity.kind === 'loading-files' && this.activity.tracks.length > 0,
        });
    }

    private sendSnapshotToVideo(): void {
        const { channel } = this;
        if (!channel || !this.ready) return;
        const source = this.options.source;
        if (source.kind === 'remote') return;
        if (source.kind === 'local' && this.activity.kind !== 'files') return;
        if (source.kind === 'producer' && this.activity.kind !== 'producer') return;
        const snapshot = this.stream.snapshot();
        const displayed = displaySubtitleSnapshot(
            snapshot,
            this.options.subtitles ?? [],
            this.options.getSubtitleOffset()
        );
        if (source.kind === 'producer' && source.supportsProgressiveSubtitles) {
            channel.subtitleSource({
                type: 'snapshot',
                ...this.stream.sourceSnapshot(),
            });
            const annotated = displayed.filter((cue) => cue.tokenization !== undefined);
            if (annotated.length) channel.subtitlesUpdated(annotated);
            return;
        }
        if (snapshot.tracks.some((track) => track.status === 'loading')) return;
        const names = subtitleSourceNames(snapshot.tracks);
        asbTrace('playback/player', 'Sending subtitles to media channel', {
            subtitleCount: snapshot.subtitles.length,
            trackCount: snapshot.tracks.length,
            subtitleFileNames: names,
        });
        channel.subtitles(displayed, names);
    }
}
