import type { ConfirmedVideoDataSubtitleTrack, LoadableSubtitleTrack, VideoDataSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleSourceProducer, SubtitleSourceState } from '@project/common/subtitle-reader/subtitle-stream';
import { subtitleSourceNames, subtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { EmbeddedSubtitleDescriptor, SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedSubtitleProducer } from '@project/common/embedded-subtitles/embedded-subtitle-producer';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import { createBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { FileSession } from '@project/common/app/services/file-session';
import type { FileSessionStore } from '@project/common/app/services/file-session';
import { MediaSources, getExtension } from '@project/common/app/services/media-sources';
import type { MediaSourceFile, SubtitleSourceFile } from '@project/common/app/services/media-sources';
import type { FileSystemFileHandleWithId } from '@project/common/file-system-access';
import { asbError } from '@project/common/util/log';

class EmbeddedSelectionError extends Error {}

const initialTrackIds: readonly string[] = ['-', '-', '-'];

export type SubtitlePickerError = { readonly kind: 'embedded' } | { readonly kind: 'selection'; readonly error: Error };

export interface SubtitlePickerState {
    readonly open: boolean;
    /** Non-empty external or online choices, plus any loaded embedded choice before discovery completes. */
    readonly externalTracks: readonly VideoDataSubtitleTrack[];
    readonly embeddedTracks: readonly EmbeddedSubtitleTrack[] | undefined;
    readonly selectedTrackIds: readonly string[];
    readonly discovering: boolean;
    readonly discoveryError: boolean;
    readonly confirming: boolean;
    readonly selectionError: SubtitlePickerError | undefined;
}

export interface EmbeddedSelection {
    readonly video: FileWithId;
    readonly tracks: LoadableSubtitleTrack<FileWithId>[];
    readonly pendingDescriptors: EmbeddedSubtitleDescriptor[];
}

export interface MediaSourcesState {
    readonly sources: MediaSources;
    readonly picker: SubtitlePickerState;
    readonly embeddedSelection: EmbeddedSelection | undefined;
    readonly canRestoreLastSession: boolean;
}

export interface SourcesAppliedEvent {
    readonly sources: MediaSources;
    readonly newVideo: boolean;
    readonly loadingSources: FileWithId[];
    readonly resetJumpToSubtitle: boolean;
}

export interface MediaSourcesControllerConfig {
    subtitleHost: SubtitleHost;
    sessionStore?: FileSessionStore;
    onSourcesApplied?: (event: SourcesAppliedEvent) => void;
    onError: (error: unknown) => void;
}

const initialPickerState: SubtitlePickerState = {
    open: false,
    externalTracks: [],
    embeddedTracks: undefined,
    selectedTrackIds: initialTrackIds,
    discovering: false,
    discoveryError: false,
    confirming: false,
    selectionError: undefined,
};

const buildExternalTracks = (candidates: readonly (FileWithId | undefined)[]): VideoDataSubtitleTrack[] => {
    const tracksById = new Map<string, VideoDataSubtitleTrack>();
    for (const candidate of candidates) {
        if (!candidate || candidate.id === '-') continue;
        const { file, id, embedded } = candidate;
        tracksById.set(id, {
            id,
            embedded,
            label: file.name,
            file,
            extension: file.name.substring(file.name.lastIndexOf('.') + 1),
        });
    }
    return [...tracksById.values()];
};

/** Prepare the selection without extracting embedded tracks. Their completed files arrive from the producer. */
const resolveSubtitleSelection = async (
    tracks: readonly ConfirmedVideoDataSubtitleTrack[],
    source: FileWithId | undefined,
    service: EmbeddedSubtitles,
    signal: AbortSignal
): Promise<FileWithId[]> => {
    signal.throwIfAborted();
    if (tracks.some((track) => track.disabledReason)) throw new Error('Unsupported subtitle selection');
    const descriptors = tracks.flatMap((track) => (track.embedded ? [track.embedded] : []));
    let preparedById: Map<string, FileWithId> | undefined;
    if (descriptors.length) {
        if (!source) throw new EmbeddedSelectionError('Missing embedded subtitle source');
        try {
            preparedById = await service.prepare(source, descriptors, signal);
        } catch (cause) {
            throw new EmbeddedSelectionError('Could not prepare embedded subtitle selection', { cause });
        }
    }
    const downloadedById = new Map<string, FileWithId>();
    const files: FileWithId[] = [];
    for (const track of tracks) {
        signal.throwIfAborted();
        if (track.embedded) {
            const file = preparedById?.get(track.id);
            if (!file) throw new EmbeddedSelectionError('Unresolved embedded subtitle');
            files.push(file);
        } else if (track.id === '-') {
            files.push({ id: '-', file: new File([''], '.srt') });
        } else if (track.file) {
            files.push({ id: track.id, file: track.file });
        } else {
            if (typeof track.url !== 'string') throw new Error('Invalid subtitle URL');
            let file = downloadedById.get(track.id);
            if (!file) {
                const response = await fetch(track.url, { signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                file = { id: track.id, file: new File([await response.blob()], `${track.name}.${track.extension}`) };
                downloadedById.set(track.id, file);
            }
            files.push(file);
        }
    }
    signal.throwIfAborted();
    return files;
};

/** Owns active media sources, subtitle picker state, discovery, confirmation, and extraction handoff. */
export class MediaSourcesController {
    private readonly embeddedSubtitles: EmbeddedSubtitles;
    private readonly session: FileSession;
    private readonly onSourcesApplied: ((event: SourcesAppliedEvent) => void) | undefined;
    private readonly onError: (error: unknown) => void;
    private readonly listeners = new Set<() => void>();

    private state: MediaSourcesState = {
        sources: new MediaSources(),
        picker: initialPickerState,
        embeddedSelection: undefined,
        canRestoreLastSession: false,
    };

    private sourceLifetime = new AbortController();
    private pickerDraft = new AbortController();
    private discovery: { file: File; controller: AbortController; openOnSupported: boolean } | undefined;
    private pendingRequest: { kind: 'confirm' | 'restore'; controller: AbortController } | undefined;
    private draftFileInputSignal: AbortSignal | undefined;
    private settledSelection = new WeakMap<
        EmbeddedSelection,
        { tracks: LoadableSubtitleTrack<FileWithId>[]; pendingDescriptors: EmbeddedSubtitleDescriptor[] }
    >();

    constructor(config: MediaSourcesControllerConfig) {
        this.embeddedSubtitles = new EmbeddedSubtitles(config.subtitleHost);
        this.onSourcesApplied = config.onSourcesApplied;
        this.onError = config.onError;
        this.session = new FileSession(config.sessionStore, {
            onCanRestoreChanged: (canRestoreLastSession) => this.setState({ ...this.state, canRestoreLastSession }),
            onError: config.onError,
        });
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    readonly getState = (): MediaSourcesState => this.state;

    initialize(): void {
        this.session.initialize();
    }

    dispose(): void {
        this.session.dispose();
        this.sourceLifetime.abort();
        this.sourceLifetime = new AbortController();
        this.pickerDraft.abort();
        this.pickerDraft = new AbortController();
        this.cancelDiscovery();
        this.cancelPendingRequest();
        if (this.state.sources.videoFileUrl) revokeBlobUrl(this.state.sources.videoFileUrl);
        this.embeddedSubtitles.retain([]);
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

    openPicker(): void {
        if (this.state.picker.open || this.state.picker.confirming) return;
        this.openPickerWithFiles(this.state.sources.firstSubtitleSourceFiles);
    }

    closePicker(): void {
        this.resetPickerDraft();
        this.cancelDiscovery();
        this.cancelPendingRequest();
        if (this.state.picker.open || this.state.picker.confirming || this.state.picker.discovering) {
            this.updatePicker({
                open: false,
                confirming: false,
                discovering: false,
                selectionError: undefined,
            });
        }
        this.session.clearDraftHandles();
    }

    setPickerSelectedTrackIds(selectedTrackIds: readonly string[]): void {
        this.updatePicker({ selectedTrackIds, selectionError: undefined });
    }

    setPickerTracks(tracks: readonly VideoDataSubtitleTrack[]): void {
        const video = this.state.sources.videoFile;
        const discoveredIds = new Set(
            video && this.state.picker.embeddedTracks
                ? this.state.picker.embeddedTracks.map(({ trackIndex }) => embeddedSubtitleId(video.id, trackIndex))
                : []
        );
        const tracksById = new Map<string, VideoDataSubtitleTrack>();
        for (const track of tracks) {
            if (track.id === '-') continue;
            if (track.embedded && discoveredIds.has(track.id)) continue;
            tracksById.set(track.id, track);
        }
        const externalTracks = [...tracksById.values()];
        const validIds = new Set(['-', ...discoveredIds, ...tracksById.keys()]);
        this.updatePicker({
            externalTracks,
            selectedTrackIds: this.state.picker.selectedTrackIds.map((id) => (validIds.has(id) ? id : '-')),
            selectionError: undefined,
        });
    }

    loadSources(sources: MediaSources, { keepDraftHandles }: { keepDraftHandles: boolean }): void {
        this.sourceLifetime.abort();
        this.sourceLifetime = new AbortController();
        this.resetPickerDraft();
        this.cancelDiscovery();
        this.cancelPendingRequest();
        if (!keepDraftHandles) this.session.clearDraftHandles();
        this.applySources(sources, {
            clearEmbeddedSelection: true,
            closePicker: true,
        });
    }

    unloadVideo(videoFileUrl: string): boolean {
        if (videoFileUrl !== this.state.sources.videoFileUrl) return false;
        const video = this.state.sources.videoFile;
        const pendingTrackIndexes = new Set(
            this.state.embeddedSelection?.pendingDescriptors.map(({ trackIndex }) => trackIndex)
        );
        this.sourceLifetime.abort();
        this.sourceLifetime = new AbortController();
        this.cancelDiscovery();
        this.cancelPendingRequest();
        revokeBlobUrl(videoFileUrl);
        const nextSources = this.state.sources.withoutVideo(pendingTrackIndexes);
        let externalTracks: VideoDataSubtitleTrack[] = [];
        let selectedTrackIds = initialTrackIds;
        if (this.state.picker.open) {
            const tracksById = new Map<string, VideoDataSubtitleTrack>();
            for (const track of this.state.picker.externalTracks) {
                if (!track.embedded) {
                    tracksById.set(track.id, track);
                    continue;
                }
                const completed = video
                    ? this.embeddedSubtitles.completedFile(video, track.embedded.trackIndex)
                    : undefined;
                if (!completed) continue;
                tracksById.set(track.id, { ...track, file: completed.file, embedded: undefined });
            }
            for (const candidate of nextSources.firstSubtitleSourceFiles) {
                if (!candidate || candidate.id === '-' || tracksById.has(candidate.id)) continue;
                tracksById.set(candidate.id, {
                    id: candidate.id,
                    label: candidate.file.name,
                    file: candidate.file,
                    extension: candidate.file.name.substring(candidate.file.name.lastIndexOf('.') + 1),
                });
            }
            externalTracks = [...tracksById.values()];
            const validIds = new Set(['-', ...externalTracks.map(({ id }) => id)]);
            selectedTrackIds = this.state.picker.selectedTrackIds.map((id) => (validIds.has(id) ? id : '-'));
        }
        this.embeddedSubtitles.retain([]);
        this.setState({
            ...this.state,
            sources: nextSources,
            embeddedSelection: undefined,
            picker: {
                ...this.state.picker,
                externalTracks,
                selectedTrackIds,
                embeddedTracks: undefined,
                discovering: false,
                discoveryError: false,
                confirming: false,
                selectionError: undefined,
            },
        });
        return true;
    }

    updateRemoteSubtitleSources(sourceStates: readonly SubtitleSourceState[]): void {
        const current = this.state.sources;
        if (current.subtitleSource.kind !== 'remote') return;
        const names = subtitleSourceNames(sourceStates);
        const status = subtitleSourceStatus(sourceStates);
        if (
            status === current.subtitleSource.status &&
            names.length === current.subtitleFileNames.length &&
            names.every((name, track) => name === current.subtitleFileNames[track])
        ) {
            return;
        }
        this.setState({
            ...this.state,
            sources: new MediaSources({ kind: 'remote', names, status }),
        });
    }

    loadSourceFiles(files: MediaSourceFile[]): MediaSources | undefined {
        const sources = this.parseSourceFiles(files);
        if (!sources) return;
        try {
            this.loadSources(sources, { keepDraftHandles: false });
            return sources;
        } catch (error) {
            this.onError(error);
        }
    }

    /** Load manually opened files and open or probe for track selection when appropriate. */
    importManualFiles(files: FileWithId[]): boolean {
        if (!files.length) return true;
        const imported = this.loadSourceFiles(files);
        if (!imported) return false;
        if (imported.subtitleSourceFiles.length > 1) {
            this.openPickerWithFiles(imported.subtitleSourceFiles);
        } else if (
            imported.videoFile &&
            !imported.subtitleSourceFiles.length &&
            !this.state.sources.subtitleSourceFiles.some((file) => file.id !== '-')
        ) {
            const activeVideo = this.state.sources.videoFile;
            if (activeVideo) void this.discoverEmbedded(activeVideo, { openOnSupported: true });
        }
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
            await this.session.saveDraftHandles(handles).catch((error) => this.onError(error));
            if (!signal.aborted) return files;
        } else if (this.importManualFiles(files)) {
            void this.session.saveHandles(handles).catch((error) => this.onError(error));
            return files;
        }
    }

    rememberDroppedHandles(files: FileWithId[], handles: Promise<FileSystemFileHandle[] | undefined>): Promise<void> {
        return this.session.rememberDroppedHandles(files, handles, this.sourceLifetime.signal);
    }

    /** Add subtitle choices without applying them. A newly picked video becomes active immediately. */
    stagePickerFiles(files: FileWithId[]): void {
        const incoming = this.parseSourceFiles(files);
        if (!incoming) return;
        if (incoming.videoFile) {
            const video = incoming.videoFile;
            this.loadSources(new MediaSources(undefined, video), { keepDraftHandles: true }); // Keep draft handles across the picker reset so confirmation can promote them.
            this.openPickerWithFiles(
                incoming.subtitleSourceFiles.length
                    ? incoming.subtitleSourceFiles
                    : this.state.sources.firstSubtitleSourceFiles
            );
            this.session.retainDraftVideoHandle(
                video.id,
                () => this.state.sources.videoFile?.file === video.file,
                this.sourceLifetime.signal
            );
            return;
        }
        const tracksById = new Map(this.state.picker.externalTracks.map((track) => [track.id, track]));
        for (const { id, file, embedded } of files) {
            tracksById.set(id, {
                id,
                file,
                embedded,
                label: file.name,
                extension: getExtension(file.name).slice(1),
            });
        }
        this.updatePicker({
            externalTracks: [...tracksById.values()],
            selectedTrackIds: initialTrackIds.map((_, index) => files[index]?.id ?? '-'),
            selectionError: undefined,
        });
    }

    confirm(tracks: readonly ConfirmedVideoDataSubtitleTrack[]): void {
        if (!this.state.picker.open || this.pendingRequest?.kind === 'confirm') return;
        this.cancelPendingRequest();
        const controller = new AbortController();
        this.pendingRequest = { kind: 'confirm', controller };
        const { signal } = controller;
        const { sources, picker } = this.state;
        const video = sources.videoFile;
        const selectedTrackIds = picker.selectedTrackIds;
        this.updatePicker({ confirming: true, selectionError: undefined });
        void (async () => {
            try {
                if (
                    tracks.length !== selectedTrackIds.length ||
                    tracks.some((track, index) => track.id !== selectedTrackIds[index])
                ) {
                    throw new Error('Subtitle selection has changed');
                }
                const resolvedFiles = await resolveSubtitleSelection(tracks, video, this.embeddedSubtitles, signal);
                signal.throwIfAborted();
                const preparedTracks = resolvedFiles.map(
                    (file) => sources.findSubtitleTrack(file) ?? { fileParts: [file] }
                );
                const pending: EmbeddedSubtitleDescriptor[] = [];
                const selectedTracks = preparedTracks.map(({ fileParts }) => ({
                    fileParts: fileParts.map((file) => {
                        if (!file.embedded || !video) return file;
                        const completed = this.embeddedSubtitles.completedFile(video, file.embedded.trackIndex);
                        if (completed) return completed;
                        pending.push(file.embedded);
                        return file;
                    }),
                }));
                const files = selectedTracks.flatMap(({ fileParts }, track) =>
                    fileParts.map((file) => ({ ...file, track }))
                );
                if (pending.length && video && this.matchesActiveExtraction(video, files)) {
                    this.session.clearDraftHandles();
                    this.finishConfirmAndClosePicker();
                    return;
                }
                const pendingIds = new Set(
                    pending.map((descriptor) => embeddedSubtitleId(descriptor.videoId, descriptor.trackIndex))
                );
                // Commit the selection without cancelling the confirmation that owns it.
                this.applySources(MediaSources.fromFiles(files, { pendingEmbedded: pending.length > 0 }), {
                    clearEmbeddedSelection: true,
                    closePicker: false,
                });
                this.session.commitSelection({
                    videoId: video?.id,
                    files,
                    selectedTracks,
                    pendingIds,
                    signal: this.sourceLifetime.signal,
                });
                if (video && pending.length) this.startEmbedded(video, selectedTracks, pending);
                this.finishConfirmAndClosePicker();
            } catch (error) {
                if (!signal.aborted) {
                    asbError('app/selector', 'Failed to confirm subtitle selection:', error);
                    this.updatePicker({
                        confirming: false,
                        selectionError:
                            error instanceof EmbeddedSelectionError
                                ? { kind: 'embedded' }
                                : {
                                      kind: 'selection',
                                      error: error instanceof Error ? error : new Error(String(error)),
                                  },
                    });
                }
            } finally {
                if (this.pendingRequest?.controller === controller) this.pendingRequest = undefined;
            }
        })();
    }

    async restoreSession(): Promise<void> {
        this.cancelPendingRequest();
        this.cancelDiscovery();
        const controller = new AbortController();
        this.pendingRequest = { kind: 'restore', controller };
        const { signal } = controller;
        try {
            const restored = await this.session.restore(
                (source, descriptors) => this.embeddedSubtitles.prepare(source, descriptors, signal),
                signal
            );
            if (!restored || signal.aborted) return;
            const { sources, missingEmbeddedSubtitles } = restored;
            if (sources.videoFile) {
                const pendingIds = new Set(
                    missingEmbeddedSubtitles.map((descriptor) =>
                        embeddedSubtitleId(descriptor.videoId, descriptor.trackIndex)
                    )
                );
                this.embeddedSubtitles.restoreCompleted(
                    sources.videoFile,
                    sources.subtitleSourceFiles.filter((file) => !pendingIds.has(file.id))
                );
            }
            this.pendingRequest = undefined; // Restoration has finished preparing files, so the restored sources now own any extraction.
            this.loadSources(sources, { keepDraftHandles: false });
            if (sources.videoFile && missingEmbeddedSubtitles.length) {
                this.startEmbedded(sources.videoFile, sources.subtitleTracks, missingEmbeddedSubtitles);
            }
        } catch (error) {
            if (!signal.aborted) {
                asbError('app/session', 'Failed to restore last session:', error);
                this.onError(error);
            }
        } finally {
            if (this.pendingRequest?.controller === controller) this.pendingRequest = undefined;
        }
    }

    createProducer(
        selection: EmbeddedSelection | undefined,
        options: Pick<Parameters<typeof embeddedSubtitleProducer>[0], 'reader' | 'errorMessage'>
    ): SubtitleSourceProducer | undefined {
        if (!selection) return;
        const active = this.settledSelection.get(selection) ?? selection;
        const { video } = selection;
        const { tracks, pendingDescriptors } = active;
        const { signal: sourceSignal } = this.sourceLifetime;
        return embeddedSubtitleProducer({
            source: video,
            tracks,
            pendingDescriptors,
            service: this.embeddedSubtitles,
            ...options,
            onFinished: async (completed, signal) => {
                signal.throwIfAborted();
                if (sourceSignal.aborted || this.state.embeddedSelection !== selection) return;
                if (this.settledSelection.has(selection)) return;
                this.settledSelection.set(selection, { tracks: completed, pendingDescriptors: [] });
                // Persisted output must not replace the active selection or restart its producer.
                const previous = this.state.sources;
                if (previous.videoFile?.file === video.file) {
                    this.setState({
                        ...this.state,
                        sources: new MediaSources(
                            {
                                kind: 'files',
                                pendingEmbedded: false,
                                tracks: completed.map(({ fileParts }, track) => ({
                                    fileParts: fileParts.map((file) => ({ ...file, track })),
                                })),
                            },
                            previous.videoFile,
                            previous.videoFileUrl
                        ),
                    });
                }
                const pendingIds = new Set(
                    selection.pendingDescriptors.map((descriptor) =>
                        embeddedSubtitleId(descriptor.videoId, descriptor.trackIndex)
                    )
                );
                const failedEmbeddedIds = new Set<string>();
                const persistedTracks = completed.map((track, slotIndex) => {
                    if (track.fileParts.length) return track;
                    const failedEmbedded = selection.tracks[slotIndex]?.fileParts.filter((file) =>
                        pendingIds.has(file.id)
                    );
                    if (!failedEmbedded?.length) return track;
                    for (const file of failedEmbedded) failedEmbeddedIds.add(file.id);
                    return { fileParts: failedEmbedded };
                });
                await this.session.saveCompletedSelection(persistedTracks, {
                    videoId: video.id,
                    selectedTracks: selection.tracks,
                    isStillActive: () => !sourceSignal.aborted && this.state.embeddedSelection === selection,
                    signal: sourceSignal,
                    pendingEmbeddedIds: failedEmbeddedIds,
                });
            },
        });
    }

    private applySources(
        incoming: MediaSources,
        { clearEmbeddedSelection, closePicker }: { clearEmbeddedSelection: boolean; closePicker: boolean }
    ): void {
        const previous = this.state.sources;
        const pendingTrackIndexes = new Set(
            clearEmbeddedSelection
                ? this.state.embeddedSelection?.pendingDescriptors.map(({ trackIndex }) => trackIndex)
                : []
        );
        const {
            sources: nextSources,
            newVideo,
            revokedVideoUrl,
            loadingSources,
            resetJumpToSubtitle,
        } = previous.merge(incoming, createBlobUrl, pendingTrackIndexes);
        if (revokedVideoUrl) revokeBlobUrl(revokedVideoUrl);
        this.embeddedSubtitles.retain(nextSources.videoFile ? [nextSources.videoFile] : []);

        const nextPicker: SubtitlePickerState = closePicker
            ? {
                  ...this.state.picker,
                  open: false,
                  embeddedTracks:
                      nextSources.videoFile?.file === previous.videoFile?.file
                          ? this.state.picker.embeddedTracks
                          : undefined,
                  discovering: false,
                  discoveryError: false,
                  confirming: false,
                  selectionError: undefined,
              }
            : this.state.picker;

        this.setState({
            ...this.state,
            sources: nextSources,
            picker: nextPicker,
            embeddedSelection: clearEmbeddedSelection ? undefined : this.state.embeddedSelection,
        });

        this.session.retainSources(nextSources);
        this.onSourcesApplied?.({
            sources: nextSources,
            newVideo,
            loadingSources,
            resetJumpToSubtitle,
        });
    }

    private async discoverEmbedded(
        video: FileWithId,
        { openOnSupported }: { openOnSupported: boolean }
    ): Promise<void> {
        this.cancelDiscovery();
        const controller = new AbortController();
        const entry = { file: video.file, controller, openOnSupported };
        this.discovery = entry;
        const { signal } = controller;
        this.updatePicker({ discovering: true, discoveryError: false });
        try {
            const tracks = await this.embeddedSubtitles.discover(video, signal);
            if (signal.aborted || this.discovery !== entry) return;
            this.discovery = undefined;
            this.updatePicker({ embeddedTracks: tracks, discovering: false });
            if (
                entry.openOnSupported &&
                tracks.some((track) => track.outputFormat) &&
                !this.state.sources.subtitleSourceFiles.some((file) => file.id !== '-') &&
                !this.state.picker.open
            ) {
                this.openPicker();
            }
        } catch (error) {
            if (signal.aborted || this.discovery !== entry) return;
            this.discovery = undefined;
            asbError('app/subtitles', 'Failed to discover embedded subtitles:', error);
            this.updatePicker({ discovering: false, discoveryError: true });
        }
    }

    private resetPickerDraft(): void {
        this.pickerDraft.abort();
        this.pickerDraft = new AbortController();
    }

    private openPickerWithFiles(candidates: readonly (FileWithId | undefined)[]): void {
        if (!this.state.picker.open) this.resetPickerDraft();
        const video = this.state.sources.videoFile;
        const cachedTracks = video ? this.embeddedSubtitles.discoveredTracks(video) : undefined;
        const activeDiscovery =
            video && this.discovery?.file === video.file && !this.discovery.controller.signal.aborted
                ? this.discovery
                : undefined;
        if (activeDiscovery) activeDiscovery.openOnSupported = false;
        this.updatePicker({
            open: true,
            externalTracks: buildExternalTracks(candidates),
            selectedTrackIds: initialTrackIds.map((_, index) => candidates[index]?.id ?? '-'),
            embeddedTracks: cachedTracks,
            discovering: Boolean(activeDiscovery),
            discoveryError: false,
            selectionError: undefined,
        });
        if (video && !cachedTracks && !activeDiscovery) void this.discoverEmbedded(video, { openOnSupported: false });
    }

    private cancelDiscovery(): void {
        this.discovery?.controller.abort();
        this.discovery = undefined;
    }

    private finishConfirmAndClosePicker(): void {
        this.cancelDiscovery();
        this.resetPickerDraft();
        this.updatePicker({
            open: false,
            confirming: false,
            discovering: false,
            selectionError: undefined,
        });
    }

    private startEmbedded(
        video: FileWithId,
        tracks: LoadableSubtitleTrack<FileWithId>[],
        pendingDescriptors: EmbeddedSubtitleDescriptor[]
    ): void {
        this.setState({ ...this.state, embeddedSelection: { video, tracks, pendingDescriptors } });
    }

    private matchesActiveExtraction(video: FileWithId, files: SubtitleSourceFile[]): boolean {
        const { subtitleSource, subtitleSourceFiles } = this.state.sources;
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
            this.onError(error);
        }
    }

    private cancelPendingRequest(): void {
        this.pendingRequest?.controller.abort();
        this.pendingRequest = undefined;
    }

    private updatePicker(patch: Partial<SubtitlePickerState>): void {
        this.setState({
            ...this.state,
            picker: { ...this.state.picker, ...patch },
        });
    }

    private setState(next: MediaSourcesState): void {
        this.state = next;
        for (const listener of this.listeners) listener();
    }
}
