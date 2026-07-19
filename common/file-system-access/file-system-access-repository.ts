import Dexie from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { AsyncSemaphore } from '../util';

export interface FileSessionRecord {
    id: number;
    videoHandle?: FileSystemFileHandleWithId;
    subtitleHandles: FileSystemFileHandleWithId[];
    // A list of subtitle handles that can be promoted.
    // E.g. files loaded into the subtitle track selector, but not yet loaded into the player.
    bufferedSubtitleHandles?: FileSystemFileHandleWithId[];
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
    merge: (incoming: Omit<FileSessionRecord, 'id' | 'timestamp'>) => Promise<void>;
    clear: () => Promise<void>;
}

export class IndexedDBFileSessionRepository implements FileSessionRepository {
    private readonly _db = new FileSessionDatabase();
    private readonly _semaphore = new AsyncSemaphore({ permits: 1 });

    async fetch(): Promise<FileSessionRecord | undefined> {
        const records = await this._db.sessions.orderBy('timestamp').reverse().limit(1).toArray();
        return records.length > 0 ? records[0] : undefined;
    }

    async merge(incoming: Omit<FileSessionRecord, 'id' | 'timestamp'>): Promise<void> {
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
            };
            await this._db.sessions.clear();
            await this._db.sessions.add({ ...merged, id: 1, timestamp: Date.now() });
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

            const { videoHandle, subtitleHandles, bufferedSubtitleHandles } = existing;
            await this._db.sessions.clear();
            await this._db.sessions.add({
                videoHandle: videoHandle !== undefined && ids.includes(videoHandle.id) ? videoHandle : undefined,
                subtitleHandles: subtitleHandles.filter((h) => ids.includes(h.id)),
                bufferedSubtitleHandles: bufferedSubtitleHandles?.filter((h) => ids.includes(h.id)),
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
            await this._db.sessions.clear();
            await this._db.sessions.add({
                videoHandle: existing.videoHandle,
                subtitleHandles,
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

            const { videoHandle, subtitleHandles } = existing;
            await this._db.sessions.clear();
            await this._db.sessions.add({ videoHandle, subtitleHandles, id: 1, timestamp: Date.now() });
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
