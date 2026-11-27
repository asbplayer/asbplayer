import type { EmbeddedSubtitleDescriptor } from '@project/common/embedded-subtitles/subtitle-source';
import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { FileWithId } from '@project/common/file-selector';
import { AsyncSemaphore, emptySubtitleSlotId, isEmptySubtitleSlot } from '@project/common/util';
import { asbError, asbWarn } from '@project/common/util/log';

const totalSize = (files: FileWithId[]) => {
    let size = 0;
    for (const f of files) {
        size += f.file.size;
    }
    return size;
};

export interface FileSessionRecord {
    id: number;
    videoHandle?: FileSystemFileHandleWithId;
    subtitleHandles: FileSystemFileHandleWithId[];
    // A list of subtitle handles that can be promoted.
    // E.g. files loaded into the subtitle track selector, but not yet loaded into the player.
    bufferedSubtitleHandles?: FileSystemFileHandleWithId[];
    // Subtitle files downloaded from online sources do not have file-system handles.
    // Cache their contents so they can still be restored without downloading them again.
    cachedSubtitleFiles?: FileWithId[];
    // Source file IDs grouped by playback slot. Groups may be empty or repeat IDs;
    // '-' represents an empty placeholder within a group.
    subtitleTrackIds?: string[][];
    embeddedSubtitles?: Record<string, EmbeddedSubtitleDescriptor>;
    /** Explicit choice among audio tracks. Absent means browser-default playback. */
    audioTrackIndex?: number;
    timestamp: number;
}

export interface FileSystemFileHandleWithId {
    id: string;
    handle: FileSystemFileHandle;
}

export interface FileSessionSourceIds {
    subtitleTrackIds: string[][];
    videoId?: string;
    audioTrackIndex?: number;
}

interface CachedSubtitleSelection {
    subtitleTrackIds: string[][];
    embeddedSubtitles: Record<string, EmbeddedSubtitleDescriptor>;
    /** A background extraction can only update the selection that started it. */
    expectedSelection?: FileSessionSourceIds;
}

const matchesSelection = (record: FileSessionRecord | undefined, expected: FileSessionSourceIds): boolean => {
    const savedTracks = record?.subtitleTrackIds;
    // A video opened without a persistent handle is still identified by its embedded subtitle IDs.
    return (
        (record?.videoHandle === undefined || record.videoHandle.id === expected.videoId) &&
        savedTracks?.length === expected.subtitleTrackIds.length &&
        savedTracks.every(
            (parts, track) =>
                parts.length === expected.subtitleTrackIds[track].length &&
                parts.every((id, part) => id === expected.subtitleTrackIds[track][part])
        )
    );
};

class FileSessionDatabase extends Dexie {
    sessions!: Dexie.Table<FileSessionRecord, number>;

    constructor() {
        super('FileSessionDatabase');
        this.version(1).stores({
            sessions: '++id,timestamp',
        });
        this.version(2)
            .stores({
                sessions: '++id,timestamp',
            })
            .upgrade((trans) => {
                return trans
                    .table('sessions')
                    .toCollection()
                    .modify((item) => {
                        const handleWithId = (handle: FileSystemFileHandle): FileSystemFileHandleWithId => ({
                            id: uuidv4(),
                            handle,
                        });
                        if (item.videoHandle !== undefined) {
                            item.videoHandle = handleWithId(item.videoHandle);
                        }
                        if (item.subtitleHandles !== undefined && item.subtitleHandles.length > 0) {
                            item.subtitleHandles = item.subtitleHandles.map(handleWithId);
                        }
                    });
            });
        this.version(3)
            .stores({
                sessions: '++id,timestamp',
            })
            .upgrade((trans) =>
                trans
                    .table('sessions')
                    .toCollection()
                    .modify((record: { subtitleTrackIds?: string[] | string[][] }) => {
                        record.subtitleTrackIds = record.subtitleTrackIds?.map((ids) =>
                            typeof ids === 'string' ? [ids] : ids
                        );
                    })
            );
    }
}

export interface FileSessionRepository {
    fetch: () => Promise<FileSessionRecord | undefined>;
    /** Merge new handles into the existing record, mirroring handleFiles' source-merge logic. */
    merge: (
        incoming: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles' | 'bufferedSubtitleHandles'>
    ) => Promise<void>;
    setCachedSubtitleFiles: (files: FileWithId[], selection: CachedSubtitleSelection) => Promise<boolean>;
    clear: () => Promise<void>;
}

export class IndexedDBFileSessionRepository implements FileSessionRepository {
    private readonly _db = new FileSessionDatabase();
    private readonly _semaphore = new AsyncSemaphore({ permits: 1 });

    private _clearDiscardedSubtitleSlots(
        previous: FileSessionRecord | undefined,
        next: FileSessionRecord
    ): FileSessionRecord {
        const subtitleIds = (record: FileSessionRecord | undefined) => [
            ...(record?.subtitleHandles ?? []).map(({ id }) => id),
            ...(record?.bufferedSubtitleHandles ?? []).map(({ id }) => id),
            ...(record?.cachedSubtitleFiles ?? []).map(({ id }) => id),
            ...Object.keys(record?.embeddedSubtitles ?? {}),
        ];
        const remaining = new Set(subtitleIds(next));
        const discarded = new Set(subtitleIds(previous).filter((id) => !remaining.has(id)));
        return {
            ...next,
            // Preserve slot positions when stored files are removed. Newly selected IDs
            // may still be awaiting their handle/cache save and must be kept.
            subtitleTrackIds: next.subtitleTrackIds?.map((ids) =>
                ids.map((id) => (discarded.has(id) ? emptySubtitleSlotId : id))
            ),
        };
    }

    private async _replace(record: FileSessionRecord) {
        await this._db.transaction('rw', this._db.sessions, async () => {
            await this._db.sessions.clear();
            await this._db.sessions.add(record);
        });
    }

    async fetch(): Promise<FileSessionRecord | undefined> {
        const records = await this._db.sessions.orderBy('timestamp').reverse().limit(1).toArray();
        return records[0];
    }

    async merge(
        incoming: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles' | 'bufferedSubtitleHandles'>
    ): Promise<void> {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();
            // Keep previous handles when user picks only one side (e.g. subtitles without re-selecting video),
            // so the saved session still represents the latest complete set.
            const merged: Omit<FileSessionRecord, 'id' | 'timestamp'> = {
                ...existing,
                videoHandle: incoming.videoHandle ?? existing?.videoHandle,
                audioTrackIndex:
                    incoming.videoHandle && incoming.videoHandle.id !== existing?.videoHandle?.id
                        ? undefined
                        : existing?.audioTrackIndex,
                subtitleHandles:
                    incoming.subtitleHandles.length > 0 ? incoming.subtitleHandles : (existing?.subtitleHandles ?? []),
                bufferedSubtitleHandles: [
                    ...(existing?.bufferedSubtitleHandles ?? []),
                    ...(incoming?.bufferedSubtitleHandles ?? []),
                ],
                cachedSubtitleFiles: existing?.cachedSubtitleFiles,
                subtitleTrackIds: existing?.subtitleTrackIds,
            };
            await this._replace(
                this._clearDiscardedSubtitleSlots(existing, { ...merged, id: 1, timestamp: Date.now() })
            );
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async retain({ subtitleTrackIds, videoId, audioTrackIndex }: FileSessionSourceIds) {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();

            if (!existing && !subtitleTrackIds.length) {
                return;
            }

            // The selected slots may arrive before their first handle/cache save.
            const { videoHandle, subtitleHandles = [], bufferedSubtitleHandles, cachedSubtitleFiles } = existing ?? {};
            const retainedSubtitleIds = new Set(subtitleTrackIds.flat());
            await this._replace({
                videoHandle: videoHandle?.id === videoId ? videoHandle : undefined,
                subtitleHandles: subtitleHandles.filter((h) => retainedSubtitleIds.has(h.id)),
                bufferedSubtitleHandles,
                cachedSubtitleFiles: cachedSubtitleFiles?.filter((f) => retainedSubtitleIds.has(f.id)),
                subtitleTrackIds,
                audioTrackIndex,
                embeddedSubtitles:
                    existing?.embeddedSubtitles &&
                    Object.fromEntries(
                        Object.entries(existing.embeddedSubtitles).filter(([id]) => retainedSubtitleIds.has(id))
                    ),
                id: 1,
                timestamp: Date.now(),
            });
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async promoteBuffered(ids: string[]) {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();

            if (!existing) {
                return;
            }

            const { bufferedSubtitleHandles } = existing;

            if (!bufferedSubtitleHandles) {
                return;
            }

            const subtitleHandles = [
                ...existing.subtitleHandles,
                ...bufferedSubtitleHandles.filter((h) => ids.includes(h.id)),
            ];
            await this._replace(
                this._clearDiscardedSubtitleSlots(existing, {
                    ...existing,
                    bufferedSubtitleHandles: undefined,
                    videoHandle: existing.videoHandle,
                    subtitleHandles: [...new Map(subtitleHandles.map((handle) => [handle.id, handle])).values()],
                    cachedSubtitleFiles: existing.cachedSubtitleFiles,
                    subtitleTrackIds: existing.subtitleTrackIds,
                    id: 1,
                    timestamp: Date.now(),
                })
            );
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async promoteBufferedVideo(videoId: string): Promise<boolean> {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();
            const videoHandle = existing?.bufferedSubtitleHandles?.find((handle) => handle.id === videoId);
            if (!existing || !videoHandle) return false;

            await this._replace(
                this._clearDiscardedSubtitleSlots(existing, {
                    ...existing,
                    videoHandle,
                    id: 1,
                    timestamp: Date.now(),
                })
            );
            return true;
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async clearBuffered() {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();

            if (!existing) {
                return;
            }

            const { videoHandle, subtitleHandles, cachedSubtitleFiles } = existing;
            await this._replace(
                this._clearDiscardedSubtitleSlots(existing, {
                    ...existing,
                    bufferedSubtitleHandles: undefined,
                    videoHandle,
                    subtitleHandles,
                    cachedSubtitleFiles,
                    subtitleTrackIds: existing.subtitleTrackIds,
                    id: 1,
                    timestamp: Date.now(),
                })
            );
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async setCachedSubtitleFiles(
        files: FileWithId[],
        { subtitleTrackIds, embeddedSubtitles, expectedSelection }: CachedSubtitleSelection
    ) {
        const permit = await this._semaphore.acquire();
        const save = (candidates: FileWithId[], estimate: StorageEstimate) =>
            this._db.transaction('rw', this._db.sessions, async () => {
                const existing = await this.fetch();
                // A repository semaphore only orders calls in one tab. Check ownership in the write transaction.
                if (expectedSelection && !matchesSelection(existing, expectedSelection)) return false;

                const selectedIds = new Set(subtitleTrackIds.flat());
                const subtitleHandles = (existing?.subtitleHandles ?? []).filter(({ id }) => selectedIds.has(id));
                const handleIds = new Set(subtitleHandles.map(({ id }) => id));
                const cachedSubtitleFiles = [
                    ...new Map(
                        candidates.filter(({ id }) => !handleIds.has(id)).map((file) => [file.id, file])
                    ).values(),
                ];
                const fileSizeLimit = this._fileSizeLimit(estimate, totalSize(existing?.cachedSubtitleFiles ?? []));
                const newTotalFileSize = totalSize(cachedSubtitleFiles);
                const exceedsLimit = cachedSubtitleFiles.length > 0 && newTotalFileSize >= fileSizeLimit;
                let keptCachedSubtitleFiles = cachedSubtitleFiles;
                if (exceedsLimit) {
                    asbWarn('file-session/repository', 'Did not cache file because it exceeds the size limit', {
                        newTotalFileSize,
                        fileSizeLimit,
                    });
                    // Keep non-embedded tracks first since embedded tracks can be re-extracted from the video on restore.
                    const isEmbedded = (id: string) => Boolean(embeddedSubtitles?.[id]);
                    const prioritized = [...cachedSubtitleFiles].sort((a, b) => {
                        const embeddedOrder = Number(isEmbedded(a.id)) - Number(isEmbedded(b.id));
                        return embeddedOrder !== 0 ? embeddedOrder : a.file.size - b.file.size;
                    });
                    const keptIds = new Set<string>();
                    let keptSize = 0;
                    for (const file of prioritized) {
                        if (keptSize + file.file.size < fileSizeLimit) {
                            keptIds.add(file.id);
                            keptSize += file.file.size;
                        }
                    }
                    keptCachedSubtitleFiles = cachedSubtitleFiles.filter(({ id }) => keptIds.has(id));
                }

                await this._replace(
                    this._clearDiscardedSubtitleSlots(existing, {
                        ...existing,
                        subtitleHandles,
                        cachedSubtitleFiles: keptCachedSubtitleFiles,
                        subtitleTrackIds,
                        embeddedSubtitles,
                        id: 1,
                        timestamp: Date.now(),
                    })
                );
                return !exceedsLimit;
            });

        try {
            const candidates = files.filter((file) => !isEmptySubtitleSlot(file));
            const estimate = candidates.length ? await this._storageEstimate() : {};
            return await save(candidates, estimate);
        } catch (e) {
            // Best effort
            asbError('file-session/repository', 'failed to save subtitle files:', e);
            try {
                await save([], {});
            } catch (error) {
                asbError('file-session/repository', 'failed to update subtitle selection without cached files:', error);
            }
            return false;
        } finally {
            void this._semaphore.release(permit);
        }
    }

    private async _storageEstimate(): Promise<StorageEstimate> {
        try {
            return (await navigator.storage?.estimate()) ?? {};
        } catch (e) {
            asbWarn('file-session/repository', 'failed to call navigator.storage.estimate:', e);
            return {};
        }
    }

    private _fileSizeLimit({ quota, usage }: StorageEstimate, usedBytesAboutToBeReplaced: number) {
        const paddedRemainingQuotaRatio = 0.5;
        const defaultLimit = 200 * 1024 * 1024;
        if (quota === undefined) return defaultLimit;
        const remaining = usage === undefined ? quota : Math.max(0, quota - usage + usedBytesAboutToBeReplaced);
        return Math.min(defaultLimit, remaining * paddedRemainingQuotaRatio);
    }

    async clear(): Promise<void> {
        const permit = await this._semaphore.acquire();

        try {
            await this._db.sessions.clear();
        } finally {
            void this._semaphore.release(permit);
        }
    }
}
