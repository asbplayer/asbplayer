import { v4 as uuid } from 'uuid';
import type { ConfirmedVideoDataSubtitleTrack, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleSourceProducer, SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleProducer } from '@project/common/embedded-subtitles/embedded-subtitle-producer';
import type { useFileSession } from '@project/common/app/hooks/use-file-session';
import type { useLocalSubtitlePicker } from '@project/common/app/hooks/use-local-subtitle-picker';
import type { useSubtitleSelection } from '@project/common/app/hooks/use-subtitle-selection';
import {
    MediaSources,
    getExtension,
    VIDEO_EXT_SET,
    AUDIO_EXT_SET,
    SUBTITLE_EXT_SET,
} from '@project/common/app/services/media-sources';
import type { MediaSourceFile, SubtitleSourceFile } from '@project/common/app/services/media-sources';
import type { FileSystemFileHandleWithId } from '@project/common/file-system-access';
import { requestPermissions, resolveFiles, restoreSessionFiles } from '@project/common/file-system-access';
import { asbError, asbWarn } from '@project/common/util/log';

export interface SubtitleImportState {
    embeddedSelection:
        | {
              video: FileWithId;
              tracks: LoadableSubtitleTrack<FileWithId>[];
              pendingDescriptors: EmbeddedSubtitleDescriptor[];
          }
        | undefined;
    discoveryKey: object | undefined;
}

export interface SubtitleImportOptions {
    sources: MediaSources;
    picker: Pick<
        ReturnType<typeof useLocalSubtitlePicker>,
        | 'subtitleTrackSelectorOpen'
        | 'closeSubtitleTrackSelector'
        | 'openSubtitleTrackSelectorWithFiles'
        | 'onManualFilesImported'
        | 'setSubtitleTrackSelectorTracks'
        | 'setSubtitleTrackSelectorSelectedTrackIds'
    > & { embedded: Pick<ReturnType<typeof useLocalSubtitlePicker>['embedded'], 'service' | 'cancel'> };
    selection: Pick<ReturnType<typeof useSubtitleSelection>, 'confirm' | 'cancel'>;
    session: Pick<
        ReturnType<typeof useFileSession>,
        | 'saveSession'
        | 'fetchSession'
        | 'saveDraftHandlesToSession'
        | 'promoteDraftHandlesInSession'
        | 'clearDraftHandlesInSession'
        | 'saveSubtitleSelection'
        | 'retainSourcesInSession'
    >;
    restoreError: string;
    onSources: (sources: MediaSources, options: { applyAudioSelection: boolean }) => void;
    onAudioTrackChanged: (audioTrackIndex: number | undefined) => void;
    getSubtitleSourceStatus: () => SubtitleSourceStatus;
    onCompleted: (video: FileWithId, tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => void;
    onError: (error: unknown) => void;
}

/** Owns active-source and picker-draft lifetimes. The player runs extraction after confirmation or restore. */
export class SubtitleImportController {
    private state: SubtitleImportState = { embeddedSelection: undefined, discoveryKey: undefined };
    private sourceLifetime = new AbortController();
    private pickerDraft = new AbortController();
    private sessionRestoreController: AbortController | undefined;
    private draftFileInputSignal: AbortSignal | undefined;
    private currentVideo: File | undefined;
    private selectionWrite = Promise.resolve();
    private standaloneSubtitlesNeedSaving = false;

    constructor(
        public options: SubtitleImportOptions,
        private readonly stateChanged: (state: SubtitleImportState) => void
    ) {
        this.currentVideo = options.sources.videoFile?.file;
    }

    dispose(): void {
        this.sourceLifetime.abort();
        this.pickerDraft.abort();
        this.sessionRestoreController?.abort();
    }

    resetPickerDraft(): void {
        this.pickerDraft.abort();
        this.pickerDraft = new AbortController();
    }

    fileRequestSignal({ forDraft }: { forDraft: boolean }): AbortSignal {
        return forDraft ? this.pickerDraft.signal : this.sourceLifetime.signal;
    }

    /** The fallback input reports its files through a separate change event. */
    beginDraftFileInputRequest(): void {
        this.draftFileInputSignal = this.pickerDraft.signal;
    }

    draftFileInputIsCurrent(): boolean {
        return this.draftFileInputSignal === this.pickerDraft.signal && !this.pickerDraft.signal.aborted;
    }

    loadSources(
        sources: MediaSources,
        { keepDraftHandles, applyAudioSelection = false }: { keepDraftHandles: boolean; applyAudioSelection?: boolean }
    ): void {
        this.sourceLifetime.abort();
        this.sourceLifetime = new AbortController();
        this.resetPickerDraft();
        this.cancelSelectionAndRestore();
        this.options.picker.closeSubtitleTrackSelector();
        if (!keepDraftHandles) this.clearDraftHandles();
        this.standaloneSubtitlesNeedSaving = false;
        if (sources.videoFile) this.currentVideo = sources.videoFile.file;
        else if (sources.subtitleSource.kind === 'remote') this.currentVideo = undefined;
        this.state = { embeddedSelection: undefined, discoveryKey: this.sourceLifetime.signal };
        this.stateChanged(this.state);
        this.options.onSources(sources, { applyAudioSelection });
    }

    unloadVideo(): ReadonlySet<number> {
        const pendingTrackIndexes = new Set(
            this.state.embeddedSelection?.pendingDescriptors.map(({ trackIndex }) => trackIndex)
        );
        const { subtitleSource, subtitleSourceFiles } = this.options.sources;
        if (subtitleSource.kind === 'files') {
            this.standaloneSubtitlesNeedSaving ||= subtitleSourceFiles.some(
                ({ embedded }) =>
                    embedded && (!subtitleSource.pendingEmbedded || !pendingTrackIndexes.has(embedded.trackIndex))
            );
        }
        this.currentVideo = undefined;
        this.sourceLifetime.abort();
        this.sourceLifetime = new AbortController();
        this.cancelSelectionAndRestore();
        this.state = { ...this.state, embeddedSelection: undefined };
        this.stateChanged(this.state);
        return pendingTrackIndexes;
    }

    loadSourceFiles(files: MediaSourceFile[]): MediaSources | undefined {
        const sources = this.parseSourceFiles(files);
        if (!sources) return;
        try {
            this.loadSources(sources, { keepDraftHandles: false });
            return sources;
        } catch (error) {
            this.options.onError(error);
        }
    }

    /** Load manually opened files and let the picker decide whether to prompt for track selection. */
    importManualFiles(files: FileWithId[]): boolean {
        if (!files.length) return true;
        const imported = this.loadSourceFiles(files);
        if (!imported) return false;
        this.options.picker.onManualFilesImported(imported.videoFile, imported.subtitleSourceFiles);
        return true;
    }

    validateFiles(files: FileWithId[]): boolean {
        return this.parseSourceFiles(files) !== undefined;
    }

    async acceptFileRequest(
        files: FileWithId[],
        handles: FileSystemFileHandleWithId[],
        { forDraft, signal }: { forDraft: boolean; signal: AbortSignal }
    ): Promise<FileWithId[] | undefined> {
        if (!files.length || signal.aborted) return;
        if (forDraft) {
            if (!this.validateFiles(files)) return;
            await this.options.session.saveDraftHandlesToSession(handles).catch((error) => this.options.onError(error));
            if (!signal.aborted) return files;
        } else if (this.importManualFiles(files)) {
            void this.saveHandles(handles).catch((error) => this.options.onError(error));
            return files;
        }
    }

    async rememberDroppedHandles(
        files: FileWithId[],
        handles: Promise<FileSystemFileHandle[] | undefined>
    ): Promise<void> {
        const { signal } = this.sourceLifetime;
        try {
            const resolved = await handles;
            if (!resolved || signal.aborted) return;
            void this.saveHandles(
                resolved.map((handle) => ({
                    handle,
                    id: files.find(({ file }) => file.name === handle.name)?.id ?? uuid(),
                }))
            ).catch((error) => this.options.onError(error));
        } catch (error) {
            asbWarn('app/files', 'Failed to collect dropped file handles:', error);
        }
    }

    /** Add subtitle choices without applying them. A newly picked video becomes active immediately. */
    stagePickerFiles(files: FileWithId[]): void {
        const incoming = this.parseSourceFiles(files);
        if (!incoming) return;
        if (incoming.videoFile) {
            const video = incoming.videoFile;
            this.loadSources(new MediaSources(undefined, video), { keepDraftHandles: true }); // Keep the draft's handles across the picker reset so confirmation can promote them
            this.options.picker.openSubtitleTrackSelectorWithFiles(incoming.subtitleSourceFiles);
            // The video is already active, so retain its handle if the draft is cancelled.
            const { signal } = this.sourceLifetime;
            void (async () => {
                const session = await this.options.session.fetchSession();
                if (signal.aborted || this.currentVideo !== video.file) return;
                const videoHandle = session?.bufferedSubtitleHandles?.find((handle) => handle.id === video.id);
                if (videoHandle) await this.options.session.saveSession({ videoHandle, subtitleHandles: [] });
            })().catch((error) => this.options.onError(error));
            return;
        }
        this.options.picker.setSubtitleTrackSelectorTracks((previous) => {
            const tracksById = new Map(previous.map((track) => [track.id, track]));
            for (const { id, file, embedded } of files) {
                tracksById.set(id, {
                    id,
                    file,
                    embedded,
                    label: file.name,
                    extension: getExtension(file.name).slice(1),
                });
            }
            return [...tracksById.values()];
        });
        this.options.picker.setSubtitleTrackSelectorSelectedTrackIds([0, 1, 2].map((index) => files[index]?.id ?? '-'));
    }

    closePicker(): void {
        this.resetPickerDraft();
        this.cancelSelectionAndRestore();
        this.options.picker.closeSubtitleTrackSelector();
        this.clearDraftHandles();
    }

    confirm(tracks: readonly ConfirmedVideoDataSubtitleTrack[], audioTrackIndex: number | undefined): void {
        if (!this.options.picker.subtitleTrackSelectorOpen) return;
        const video = this.options.sources.videoFile;
        const preserveSubtitles = () => {
            const { sources } = this.options;
            const retainSources = () =>
                this.options.session.retainSourcesInSession({
                    subtitleTrackIds: sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id)),
                    videoId: sources.videoFile?.id,
                    audioTrackIndex,
                });
            if (audioTrackIndex !== sources.audioTrackIndex) this.options.onAudioTrackChanged(audioTrackIndex);
            if (this.standaloneSubtitlesNeedSaving) {
                // Unloading detaches completed files in memory. Confirmation saves them without their old video.
                this.standaloneSubtitlesNeedSaving = false;
                const { signal } = this.sourceLifetime;
                const write: Promise<void> = this.selectionWrite
                    .then(async () => {
                        if (signal.aborted || this.selectionWrite !== write) return;
                        await retainSources();
                        if (signal.aborted || this.selectionWrite !== write) return;
                        await this.options.session.saveSubtitleSelection(sources.subtitleTracks, new Set());
                    })
                    .catch((error) => {
                        if (!signal.aborted && this.selectionWrite === write) this.standaloneSubtitlesNeedSaving = true;
                        this.options.onError(error);
                    });
                this.selectionWrite = write;
            } else if (audioTrackIndex !== sources.audioTrackIndex) {
                void retainSources().catch((error) => this.options.onError(error));
            }
            this.closePicker();
        };
        this.options.selection.confirm({
            tracks,
            audioTrackIndex,
            subtitleSourceStatus: this.options.getSubtitleSourceStatus(),
            onSubtitlesUnchanged: preserveSubtitles,
            commit: async (preparedTracks, signal) => {
                const session = await this.options.session.fetchSession();
                signal.throwIfAborted();
                const service = this.options.picker.embedded.service;
                const pending: EmbeddedSubtitleDescriptor[] = [];
                const selectedTracks = preparedTracks.map(({ fileParts }) => ({
                    fileParts: fileParts.map((file) => {
                        if (!file.embedded || !video) return file;
                        const completed = service.completedFile(video, file.embedded.trackIndex);
                        if (completed) return completed;
                        pending.push(file.embedded);
                        return file;
                    }),
                }));
                const files = selectedTracks.flatMap(({ fileParts }, track) =>
                    fileParts.map((file) => ({ ...file, track }))
                );
                if (
                    pending.length &&
                    video &&
                    this.options.getSubtitleSourceStatus() !== 'failed' &&
                    this.matchesActiveExtraction(video, files)
                ) {
                    preserveSubtitles();
                    return;
                }
                const accepted = new Set([...files.map((file) => file.id), video?.id]);
                const handles = [
                    ...(session?.subtitleHandles ?? []),
                    ...(session?.bufferedSubtitleHandles ?? []),
                ].filter((handle) => accepted.has(handle.id));
                const pendingIds = new Set(
                    pending.map((descriptor) => embeddedSubtitleId(descriptor.videoId, descriptor.trackIndex))
                );
                // Commit the draft without cancelling the confirmation that owns it.
                this.standaloneSubtitlesNeedSaving = false;
                this.state = { ...this.state, embeddedSelection: undefined };
                this.stateChanged(this.state);
                this.options.onSources(
                    MediaSources.fromFiles(files, { pendingEmbedded: pending.length > 0 }).withAudioTrackIndex(
                        audioTrackIndex
                    ),
                    { applyAudioSelection: true }
                );
                const sourceSignal = this.sourceLifetime.signal;
                void this.saveHandles(handles).catch((error) => this.options.onError(error));
                const promoted = this.options.session
                    .promoteDraftHandlesInSession(files.map((file) => file.id))
                    .catch((error) => this.options.onError(error));
                // A fast extraction waits for this write before saving its finished files.
                // An older selection must not discard handles saved by its replacement.
                const write: Promise<void> = Promise.all([this.selectionWrite, promoted])
                    .then(async () => {
                        if (!sourceSignal.aborted && this.selectionWrite === write) {
                            await this.options.session.saveSubtitleSelection(selectedTracks, pendingIds);
                        }
                    })
                    .catch((error) => this.options.onError(error));
                this.selectionWrite = write;
                if (video && pending.length) this.startEmbedded(video, selectedTracks, pending);
                this.options.picker.closeSubtitleTrackSelector();
            },
        });
    }

    async restoreSession(): Promise<void> {
        this.cancelSelectionAndRestore();
        this.options.picker.embedded.cancel();
        const controller = new AbortController();
        this.sessionRestoreController = controller;
        const { signal } = controller;
        try {
            const record = await this.options.session.fetchSession();
            if (!record || signal.aborted) return;
            const handles = [...(record.videoHandle ? [record.videoHandle] : []), ...record.subtitleHandles];
            const { granted, denied } = await requestPermissions(handles);
            if (signal.aborted) return;
            if (denied.length) throw new Error(this.options.restoreError);
            const { files: resolved, errors } = await resolveFiles(granted);
            if (signal.aborted) return;
            if (errors.length) throw new Error(this.options.restoreError);
            const service = this.options.picker.embedded.service;
            const { files, missingEmbeddedSubtitles } = await restoreSessionFiles(
                record,
                resolved,
                (source, descriptors) => service.prepare(source, descriptors, signal)
            );
            if (signal.aborted) return;
            const restored = MediaSources.fromFiles(files, { pendingEmbedded: missingEmbeddedSubtitles.length > 0 });
            if (restored.videoFile) {
                const pendingIds = new Set(
                    missingEmbeddedSubtitles.map((descriptor) =>
                        embeddedSubtitleId(descriptor.videoId, descriptor.trackIndex)
                    )
                );
                service.restoreCompleted(
                    restored.videoFile,
                    restored.subtitleSourceFiles.filter((file) => !pendingIds.has(file.id))
                );
            }
            this.sessionRestoreController = undefined; // Restoration has finished preparing files, so the restored sources now own any extraction.
            this.loadSources(restored.withAudioTrackIndex(record.audioTrackIndex), {
                keepDraftHandles: false,
                applyAudioSelection: true,
            });
            if (restored.videoFile && missingEmbeddedSubtitles.length) {
                this.startEmbedded(restored.videoFile, restored.subtitleTracks, missingEmbeddedSubtitles);
            }
        } catch (error) {
            if (!signal.aborted) {
                asbError('app/session', 'Failed to restore last session:', error);
                this.options.onError(error);
            }
        } finally {
            if (this.sessionRestoreController === controller) this.sessionRestoreController = undefined;
        }
    }

    createProducer(
        selection: SubtitleImportState['embeddedSelection'],
        options: Pick<Parameters<typeof embeddedSubtitleProducer>[0], 'reader' | 'service' | 'errorMessage'>
    ): SubtitleSourceProducer | undefined {
        if (!selection) return;
        const { video, tracks, pendingDescriptors } = selection;
        const { signal: sourceSignal } = this.sourceLifetime;
        return embeddedSubtitleProducer({
            source: video,
            tracks,
            pendingDescriptors,
            ...options,
            onFinished: async (completed, signal) => {
                signal.throwIfAborted();
                if (sourceSignal.aborted || this.state.embeddedSelection !== selection) return;
                // Persisted output must not replace the active selection or restart its producer.
                this.options.onCompleted(video, completed, signal);
                await this.selectionWrite;
                if (signal.aborted || sourceSignal.aborted || this.state.embeddedSelection !== selection) return;
                await this.options.session.saveSubtitleSelection(completed, new Set());
                signal.throwIfAborted();
            },
        });
    }

    private startEmbedded(
        video: FileWithId,
        tracks: LoadableSubtitleTrack<FileWithId>[],
        pendingDescriptors: EmbeddedSubtitleDescriptor[]
    ): void {
        this.state = { ...this.state, embeddedSelection: { video, tracks, pendingDescriptors } };
        this.stateChanged(this.state);
    }

    private matchesActiveExtraction(video: FileWithId, files: SubtitleSourceFile[]): boolean {
        const { subtitleSource, subtitleSourceFiles } = this.options.sources;
        if (
            this.state.embeddedSelection?.video.file !== video.file ||
            subtitleSource.kind !== 'files' ||
            !subtitleSource.pendingEmbedded
        ) {
            return false;
        }
        const current = subtitleSourceFiles.filter(({ id }) => id !== '-');
        const selected = files.filter(({ id }) => id !== '-');
        return (
            current.length === selected.length &&
            selected.every(({ id, track, file, embedded }, index) => {
                const source = current[index];
                // Pending embedded selections can create fresh placeholder Files for the same ID.
                return (
                    id === source.id && track === source.track && (embedded ? !!source.embedded : file === source.file)
                );
            })
        );
    }

    private parseSourceFiles(files: MediaSourceFile[]): MediaSources | undefined {
        try {
            return MediaSources.fromFiles(files, { pendingEmbedded: false });
        } catch (error) {
            this.options.onError(error);
        }
    }

    private clearDraftHandles(): void {
        void this.options.session.clearDraftHandlesInSession().catch((error) => this.options.onError(error));
    }

    private cancelSelectionAndRestore(): void {
        this.sessionRestoreController?.abort();
        this.sessionRestoreController = undefined;
        this.options.selection.cancel();
    }

    private async saveHandles(handles: FileSystemFileHandleWithId[]): Promise<void> {
        const videoHandle = handles.find(
            ({ handle }) => VIDEO_EXT_SET.has(getExtension(handle.name)) || AUDIO_EXT_SET.has(getExtension(handle.name))
        );
        const subtitleHandles = handles.filter(({ handle }) => SUBTITLE_EXT_SET.has(getExtension(handle.name)));
        if (videoHandle || subtitleHandles.length) {
            await this.options.session.saveSession({ videoHandle, subtitleHandles });
        }
    }
}
