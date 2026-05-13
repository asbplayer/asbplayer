import Dexie from 'dexie';

export interface FileSessionRecord {
    id: number;
    videoHandle?: FileSystemFileHandle;
    subtitleHandles: FileSystemFileHandle[];
    timestamp: number;
}

class FileSessionDatabase extends Dexie {
    sessions!: Dexie.Table<FileSessionRecord, number>;

    constructor() {
        super('FileSessionDatabase');
        this.version(1).stores({
            sessions: '++id,timestamp',
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

    async fetch(): Promise<FileSessionRecord | undefined> {
        const records = await this._db.sessions.orderBy('timestamp').reverse().limit(1).toArray();
        return records.length > 0 ? records[0] : undefined;
    }

    async merge(incoming: Omit<FileSessionRecord, 'id' | 'timestamp'>): Promise<void> {
        const existing = await this.fetch();
        // Keep previous handles when user picks only one side (e.g. subtitles without re-selecting video),
        // so the saved session still represents the latest complete set.
        const merged: Omit<FileSessionRecord, 'id' | 'timestamp'> = {
            videoHandle: incoming.videoHandle ?? existing?.videoHandle,
            subtitleHandles:
                incoming.subtitleHandles.length > 0 ? incoming.subtitleHandles : (existing?.subtitleHandles ?? []),
        };
        await this._db.sessions.clear();
        await this._db.sessions.add({ ...merged, id: 1, timestamp: Date.now() });
    }

    async clear(): Promise<void> {
        await this._db.sessions.clear();
    }
}
