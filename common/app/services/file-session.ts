import { v4 as uuid } from 'uuid';
import type { LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import { LocalizedError } from '@project/common/app/components/localized-error';
import {
    MediaSources,
    getExtension,
    VIDEO_EXT_SET,
    AUDIO_EXT_SET,
    SUBTITLE_EXT_SET,
} from '@project/common/app/services/media-sources';
import type { SubtitleSourceFile } from '@project/common/app/services/media-sources';
import type {
    FileSessionRecord,
    FileSessionSourceIds,
    FileSystemFileHandleWithId,
} from '@project/common/file-system-access';
import {
    IndexedDBFileSessionRepository,
    canRestoreSession,
    requestPermissions,
    resolveFiles,
    restoreSessionFiles,
    supportsFileSystemAccess,
} from '@project/common/file-system-access';
import { asbError, asbWarn } from '@project/common/util/log';

export interface FileSessionStore {
    fetch: () => Promise<FileSessionRecord | undefined>;
    merge: (
        incoming: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles' | 'bufferedSubtitleHandles'>
    ) => Promise<void>;
    retain: (sources: FileSessionSourceIds) => Promise<void>;
    promoteBuffered: (ids: string[]) => Promise<void>;
    clearBuffered: () => Promise<void>;
    setCachedSubtitleFiles: (
        files: FileWithId[],
        selection: {
            subtitleTrackIds: string[][];
            embeddedSubtitles: Record<string, EmbeddedSubtitleDescriptor>;
        }
    ) => Promise<boolean>;
}

let defaultStore: IndexedDBFileSessionRepository | undefined;

export const defaultFileSessionStore = (): FileSessionStore | undefined => {
    if (defaultStore === undefined && supportsFileSystemAccess()) {
        defaultStore = new IndexedDBFileSessionRepository();
    }
    return defaultStore;
};

/** Coordinates File System Access handles, cached subtitle files, write ordering, and session restoration. */
export class FileSession {
    private initController: AbortController | undefined;
    private selectionWrite = Promise.resolve();
    private _canRestore = false;

    constructor(
        private readonly store: FileSessionStore | undefined,
        private readonly callbacks: {
            onCanRestoreChanged: (canRestore: boolean) => void;
            onError: (error: unknown) => void;
        }
    ) {}

    initialize(): void {
        if (!this.store) return;
        this.initController?.abort();
        const controller = new AbortController();
        this.initController = controller;
        const { signal } = controller;
        void this.store.clearBuffered().catch((error) => {
            asbError('app/session', 'Failed to clear draft handles on startup:', error);
        });
        void this.store
            .fetch()
            .then((record) => {
                if (!signal.aborted && canRestoreSession(record)) this.setCanRestore(true);
            })
            .catch((error) => {
                if (!signal.aborted) asbError('app/session', 'Failed to inspect the last file session:', error);
            });
    }

    dispose(): void {
        this.initController?.abort();
        this.initController = undefined;
    }

    fetch(): Promise<FileSessionRecord | undefined> {
        return this.store ? this.store.fetch() : Promise.resolve(undefined);
    }

    retainSources(sources: MediaSources): void {
        void this.store?.retain({
            subtitleTrackIds: sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id)),
            videoId: sources.videoFile?.id,
        });
    }

    async saveDraftHandles(handles: FileSystemFileHandleWithId[]): Promise<void> {
        await this.store?.merge({
            subtitleHandles: [],
            bufferedSubtitleHandles: handles,
        });
    }

    clearDraftHandles(): void {
        void this.store?.clearBuffered().catch((error) => this.callbacks.onError(error));
    }

    async saveHandles(handles: FileSystemFileHandleWithId[]): Promise<void> {
        const videoHandle = handles.find(
            ({ handle }) => VIDEO_EXT_SET.has(getExtension(handle.name)) || AUDIO_EXT_SET.has(getExtension(handle.name))
        );
        const subtitleHandles = handles.filter(({ handle }) => SUBTITLE_EXT_SET.has(getExtension(handle.name)));
        if (videoHandle || subtitleHandles.length) await this.saveSession({ videoHandle, subtitleHandles });
    }

    async rememberDroppedHandles(
        files: FileWithId[],
        handles: Promise<FileSystemFileHandle[] | undefined>,
        signal: AbortSignal
    ): Promise<void> {
        try {
            const resolved = await handles;
            if (!resolved || signal.aborted) return;
            void this.saveHandles(
                resolved.map((handle) => ({
                    handle,
                    id: files.find(({ file }) => file.name === handle.name)?.id ?? uuid(),
                }))
            ).catch((error) => this.callbacks.onError(error));
        } catch (error) {
            asbWarn('app/files', 'Failed to collect dropped file handles:', error);
        }
    }

    /** Promote the active video's handle out of the draft buffer so cancelling the picker keeps it restorable. */
    retainDraftVideoHandle(videoId: string, isStillActive: () => boolean, signal: AbortSignal): void {
        void (async () => {
            const record = await this.store?.fetch();
            if (signal.aborted || !isStillActive()) return;
            const videoHandle = record?.bufferedSubtitleHandles?.find((handle) => handle.id === videoId);
            if (videoHandle) await this.saveSession({ videoHandle, subtitleHandles: [] });
        })().catch((error) => this.callbacks.onError(error));
    }

    /** Save accepted handles, promote drafts, and serialize selection persistence against later extractions. */
    commitSelection(
        record: FileSessionRecord | undefined,
        {
            videoId,
            files,
            selectedTracks,
            pendingIds,
            signal,
        }: {
            videoId: string | undefined;
            files: readonly SubtitleSourceFile[];
            selectedTracks: LoadableSubtitleTrack<FileWithId>[];
            pendingIds: ReadonlySet<string>;
            signal: AbortSignal;
        }
    ): void {
        const accepted = new Set([...files.map((file) => file.id), videoId]);
        const handles = [...(record?.subtitleHandles ?? []), ...(record?.bufferedSubtitleHandles ?? [])].filter(
            (handle) => accepted.has(handle.id)
        );
        void this.saveHandles(handles).catch((error) => this.callbacks.onError(error));
        const promoted = (this.store?.promoteBuffered(files.map((file) => file.id)) ?? Promise.resolve()).catch(
            (error) => this.callbacks.onError(error)
        );
        // A fast extraction waits for this write before saving its finished files.
        // An older selection must not discard handles saved by its replacement.
        const write: Promise<void> = Promise.all([this.selectionWrite, promoted])
            .then(async () => {
                if (!signal.aborted && this.selectionWrite === write) {
                    await this.saveSubtitleSelection(selectedTracks, pendingIds);
                }
            })
            .catch((error) => this.callbacks.onError(error));
        this.selectionWrite = write;
    }

    async saveCompletedSelection(
        completed: LoadableSubtitleTrack<FileWithId>[],
        isStillActive: () => boolean,
        signal: AbortSignal
    ): Promise<void> {
        await this.selectionWrite;
        if (signal.aborted || !isStillActive()) return;
        await this.saveSubtitleSelection(completed, new Set());
        signal.throwIfAborted();
    }

    async restore(
        prepareEmbedded: (
            source: FileWithId,
            descriptors: EmbeddedSubtitleDescriptor[]
        ) => Promise<Map<string, FileWithId>>,
        signal: AbortSignal
    ): Promise<{ sources: MediaSources; missingEmbeddedSubtitles: EmbeddedSubtitleDescriptor[] } | undefined> {
        const record = await this.store?.fetch();
        if (!record || signal.aborted) return;

        const handles = [...(record.videoHandle ? [record.videoHandle] : []), ...record.subtitleHandles];
        const { granted, denied } = await requestPermissions(handles);
        if (signal.aborted) return;

        if (denied.length) throw new LocalizedError('error.restoreSessionFailed');
        const { files: resolved, errors } = await resolveFiles(granted);
        if (signal.aborted) return;

        if (errors.length) throw new LocalizedError('error.restoreSessionFailed');
        const { files, missingEmbeddedSubtitles } = await restoreSessionFiles(record, resolved, prepareEmbedded);
        if (signal.aborted) return;

        return {
            sources: MediaSources.fromFiles(files, { pendingEmbedded: missingEmbeddedSubtitles.length > 0 }),
            missingEmbeddedSubtitles,
        };
    }

    private async saveSession({
        videoHandle,
        subtitleHandles,
    }: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles'>): Promise<void> {
        if (!this.store || (!videoHandle && !subtitleHandles.length)) return;
        await this.store.merge({ videoHandle, subtitleHandles });
        this.setCanRestore(true);
    }

    private async saveSubtitleSelection(
        tracks: LoadableSubtitleTrack<FileWithId>[],
        pendingEmbeddedIds: ReadonlySet<string>
    ): Promise<void> {
        if (!this.store) return;
        const completedTracks = tracks.map(({ fileParts }) => ({
            fileParts: fileParts.filter((file) => !pendingEmbeddedIds.has(file.id)),
        }));
        const files = completedTracks.flatMap(({ fileParts }) => fileParts);
        await this.store.setCachedSubtitleFiles(files, {
            subtitleTrackIds: completedTracks.map(({ fileParts }) => fileParts.map(({ id }) => id)),
            embeddedSubtitles: Object.fromEntries(
                files.flatMap((file) => (file.embedded ? [[file.id, file.embedded] as const] : []))
            ),
        });
        this.setCanRestore(canRestoreSession(await this.store.fetch()));
    }

    private setCanRestore(canRestore: boolean): void {
        if (canRestore === this._canRestore) return;
        this._canRestore = canRestore;
        this.callbacks.onCanRestoreChanged(canRestore);
    }
}
