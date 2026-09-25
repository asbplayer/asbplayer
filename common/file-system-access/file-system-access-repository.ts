import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { FileWithId } from '@project/common/file-selector';
import { AsyncSemaphore } from '@project/common/util';

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
    timestamp: number;
}

export interface FileSystemFileHandleWithId {
    id: string;
    handle: FileSystemFileHandle;
}

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
    }
}

export interface FileSessionRepository {
    fetch: () => Promise<FileSessionRecord | undefined>;
    /** Merge new handles into the existing record, mirroring handleFiles' source-merge logic. */
    merge: (
        incoming: Pick<FileSessionRecord, 'videoHandle' | 'subtitleHandles' | 'bufferedSubtitleHandles'>
    ) => Promise<void>;
    setCachedSubtitleFiles: (files: FileWithId[]) => Promise<void>;
    clear: () => Promise<void>;
}

export class IndexedDBFileSessionRepository implements FileSessionRepository {
    private readonly _db = new FileSessionDatabase();
    private readonly _semaphore = new AsyncSemaphore({ permits: 1 });

    private async _replace(record: FileSessionRecord) {
        await this._db.transaction('rw', this._db.sessions, async () => {
            await this._db.sessions.clear();
            await this._db.sessions.add(record);
        });
    }

    async fetch(): Promise<FileSessionRecord | undefined> {
        const records = await this._db.sessions.orderBy('timestamp').reverse().limit(1).toArray();
        return records.length > 0 ? records[0] : undefined;
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
                videoHandle: incoming.videoHandle ?? existing?.videoHandle,
                subtitleHandles:
                    incoming.subtitleHandles.length > 0 ? incoming.subtitleHandles : (existing?.subtitleHandles ?? []),
                bufferedSubtitleHandles: [
                    ...(existing?.bufferedSubtitleHandles ?? []),
                    ...(incoming?.bufferedSubtitleHandles ?? []),
                ],
                cachedSubtitleFiles: existing?.cachedSubtitleFiles,
            };
            await this._replace({ ...merged, id: 1, timestamp: Date.now() });
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async retain(ids: string[]) {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();

            if (!existing) {
                return;
            }

            const { videoHandle, subtitleHandles, bufferedSubtitleHandles, cachedSubtitleFiles } = existing;
            await this._replace({
                videoHandle: videoHandle !== undefined && ids.includes(videoHandle.id) ? videoHandle : undefined,
                subtitleHandles: subtitleHandles.filter((h) => ids.includes(h.id)),
                bufferedSubtitleHandles: bufferedSubtitleHandles?.filter((h) => ids.includes(h.id)),
                cachedSubtitleFiles: cachedSubtitleFiles?.filter((f) => ids.includes(f.id)),
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
            await this._replace({
                videoHandle: existing.videoHandle,
                subtitleHandles,
                cachedSubtitleFiles: existing.cachedSubtitleFiles,
                id: 1,
                timestamp: Date.now(),
            });
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
            await this._replace({
                videoHandle,
                subtitleHandles,
                cachedSubtitleFiles,
                id: 1,
                timestamp: Date.now(),
            });
        } finally {
            void this._semaphore.release(permit);
        }
    }

    async setCachedSubtitleFiles(cachedSubtitleFiles: FileWithId[]) {
        const permit = await this._semaphore.acquire();

        try {
            const existing = await this.fetch();

            if (!existing && cachedSubtitleFiles.length === 0) {
                return;
            }

            await this._replace({
                videoHandle: existing?.videoHandle,
                subtitleHandles: existing?.subtitleHandles ?? [],
                bufferedSubtitleHandles: existing?.bufferedSubtitleHandles,
                cachedSubtitleFiles,
                id: 1,
                timestamp: Date.now(),
            });
        } finally {
            void this._semaphore.release(permit);
        }
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
