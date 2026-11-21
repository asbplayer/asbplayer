import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import Dexie from 'dexie';
import type { FileWithId } from '@project/common/file-selector';
import type { FileSessionRecord } from '@project/common/file-system-access';
import { IndexedDBFileSessionRepository, restoreSessionFiles } from '@project/common/file-system-access';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import { LocalizedError } from '@project/common/app/components/localized-error';
import { FileSession } from '@project/common/app/services/file-session';
import type { FileSessionStore } from '@project/common/app/services/file-session';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeAll(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
});

let store: jest.Mocked<FileSessionStore>;
let canRestore: boolean;
let onCanRestoreChanged: jest.Mock<(value: boolean) => void>;
let onError: jest.Mock<(error: unknown) => void>;

const createSession = (backingStore: FileSessionStore | undefined = store) =>
    new FileSession(backingStore, {
        onCanRestoreChanged: (value) => {
            canRestore = value;
            onCanRestoreChanged(value);
        },
        onError,
    });

beforeEach(() => {
    canRestore = false;
    onCanRestoreChanged = jest.fn();
    onError = jest.fn();
    store = {
        fetch: jest.fn(async () => undefined),
        merge: jest.fn(async () => {}),
        retain: jest.fn(async () => {}),
        promoteBuffered: jest.fn(async () => {}),
        clearBuffered: jest.fn(async () => {}),
        setCachedSubtitleFiles: jest.fn(async () => true),
    };
});

it('clears draft handles on initialize, reports an existing restorable session, and ignores late results after dispose', async () => {
    let resolveFetch!: (record: FileSessionRecord | undefined) => void;
    store.fetch.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveFetch = resolve;
            })
    );
    const session = createSession();
    session.initialize();
    expect(store.clearBuffered).toHaveBeenCalledTimes(1);

    session.dispose();
    resolveFetch({
        id: 1,
        timestamp: 1,
        videoHandle: { id: 'video', handle: { name: 'episode.mkv' } as FileSystemFileHandle },
        subtitleHandles: [],
    });
    await flush();
    expect(canRestore).toBe(false);
    expect(onCanRestoreChanged).not.toHaveBeenCalled();

    store.fetch.mockResolvedValueOnce({
        id: 1,
        timestamp: 1,
        videoHandle: { id: 'video', handle: { name: 'episode.mkv' } as FileSystemFileHandle },
        subtitleHandles: [],
    });
    session.initialize();
    await flush();
    expect(canRestore).toBe(true);
    expect(onCanRestoreChanged).toHaveBeenCalledWith(true);
});

it('throws LocalizedError on denied permissions or unreadable handles during restore, and stops cleanly on abort', async () => {
    const prepare = jest.fn(async () => new Map<string, FileWithId>());
    const deniedHandle = {
        name: 'episode.mkv',
        queryPermission: async () => 'prompt',
        requestPermission: async () => 'denied',
    } as unknown as FileSystemFileHandle;
    store.fetch.mockResolvedValueOnce({
        id: 1,
        timestamp: 1,
        videoHandle: { id: 'video', handle: deniedHandle },
        subtitleHandles: [],
    });
    const session = createSession();
    await expect(session.restore(prepare, new AbortController().signal)).rejects.toMatchObject({
        locKey: 'error.restoreSessionFailed',
    });
    try {
        store.fetch.mockResolvedValueOnce({
            id: 1,
            timestamp: 1,
            videoHandle: {
                id: 'video',
                handle: {
                    name: 'episode.mkv',
                    queryPermission: async () => 'granted',
                    getFile: async () => {
                        throw new Error('Disk error');
                    },
                } as unknown as FileSystemFileHandle,
            },
            subtitleHandles: [],
        });
        await session.restore(prepare, new AbortController().signal);
        throw new Error('Expected restore to throw');
    } catch (error) {
        expect(error).toBeInstanceOf(LocalizedError);
        expect((error as LocalizedError).locKey).toBe('error.restoreSessionFailed');
    }

    let resolvePermission!: (state: string) => void;
    store.fetch.mockResolvedValueOnce({
        id: 1,
        timestamp: 1,
        videoHandle: {
            id: 'video',
            handle: {
                name: 'episode.mkv',
                queryPermission: () =>
                    new Promise((resolve) => {
                        resolvePermission = resolve;
                    }),
            } as unknown as FileSystemFileHandle,
        },
        subtitleHandles: [],
    });
    const controller = new AbortController();
    const pending = session.restore(prepare, controller.signal);
    await flush();
    controller.abort();
    resolvePermission('denied');
    expect(await pending).toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
});

it('maps dropped handles to file IDs by name, filters supported extensions, and ignores aborted or rejected handle reads', async () => {
    const session = createSession();
    const videoFile = { id: 'vid-1', file: new File([], 'episode.mkv') };
    const subFile = { id: 'sub-1', file: new File([], 'en.srt') };
    const videoHandle = { name: 'episode.mkv' } as FileSystemFileHandle;
    const subHandle = { name: 'en.srt' } as FileSystemFileHandle;
    const ignoredHandle = { name: 'readme.txt' } as FileSystemFileHandle;

    await session.rememberDroppedHandles(
        [videoFile, subFile],
        Promise.resolve([videoHandle, subHandle, ignoredHandle]),
        new AbortController().signal
    );
    await flush();
    expect(store.merge).toHaveBeenCalledWith({
        videoHandle: { id: 'vid-1', handle: videoHandle },
        subtitleHandles: [{ id: 'sub-1', handle: subHandle }],
    });
    expect(canRestore).toBe(true);

    store.merge.mockClear();
    const aborted = new AbortController();
    let releaseHandles!: (handles: FileSystemFileHandle[]) => void;
    const pendingDrop = session.rememberDroppedHandles(
        [videoFile],
        new Promise((resolve) => {
            releaseHandles = resolve;
        }),
        aborted.signal
    );
    aborted.abort();
    releaseHandles([videoHandle]);
    await pendingDrop;
    await flush();
    expect(store.merge).not.toHaveBeenCalled();

    await session.rememberDroppedHandles(
        [videoFile],
        Promise.reject(new Error('No access')),
        new AbortController().signal
    );
    await flush();
    expect(store.merge).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});

it('retains a draft video handle only while active and unaborted', async () => {
    const session = createSession();
    const videoHandle = { id: 'video', handle: { name: 'episode.mkv' } as FileSystemFileHandle };
    store.fetch.mockResolvedValue({
        id: 1,
        timestamp: 1,
        subtitleHandles: [],
        bufferedSubtitleHandles: [videoHandle],
    });

    const controller = new AbortController();
    session.retainDraftVideoHandle('video', () => false, controller.signal);
    await flush();
    expect(store.merge).not.toHaveBeenCalled();

    const aborted = new AbortController();
    aborted.abort();
    session.retainDraftVideoHandle('video', () => true, aborted.signal);
    await flush();
    expect(store.merge).not.toHaveBeenCalled();

    session.retainDraftVideoHandle('video', () => true, controller.signal);
    await flush();
    expect(store.merge).toHaveBeenCalledWith({ videoHandle, subtitleHandles: [] });
    expect(canRestore).toBe(true);
});

it('persists completed downloads and valid empty embedded tracks in IndexedDB before pending extraction completes', async () => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) },
    });
    const repository = new IndexedDBFileSessionRepository();
    const video: FileWithId = { id: 'video', file: new File(['video'], 'video.mkv', { lastModified: 1 }) };
    const pendingDescriptor = embeddedDescriptor(video, { trackIndex: 0, codec: 'subrip' });
    const pending: FileWithId = {
        id: embeddedSubtitleId(video.id, 0),
        embedded: pendingDescriptor,
        file: new File([], 'video.track-1.srt'),
    };
    const online: FileWithId = {
        id: 'https://example.test/subtitle.srt',
        file: new File(['Downloaded'], 'online.srt'),
    };
    const empty: FileWithId = {
        id: embeddedSubtitleId(video.id, 1),
        embedded: embeddedDescriptor(video, { trackIndex: 1, codec: 'subrip' }),
        file: new File([], 'video.track-2.srt'),
    };
    const prepare = async () => {
        throw new Error('Completed session files must not need extraction');
    };

    try {
        const session = createSession(repository);
        const signal = new AbortController().signal;

        // Saving only an empty slot keeps canRestore false.
        session.commitSelection(undefined, {
            videoId: undefined,
            files: [{ id: '-', file: new File([], '.srt'), track: 0 }],
            selectedTracks: [{ fileParts: [{ id: '-', file: new File([], '.srt') }] }],
            pendingIds: new Set(),
            signal,
        });
        await session.saveCompletedSelection(
            [{ fileParts: [{ id: '-', file: new File([], '.srt') }] }],
            () => false,
            signal
        );
        expect(canRestore).toBe(false);

        await session.saveHandles([{ id: video.id, handle: { name: video.file.name } as FileSystemFileHandle }]);
        session.commitSelection(await session.fetch(), {
            videoId: video.id,
            files: [
                { ...pending, track: 0 },
                { ...online, track: 1 },
                { ...empty, track: 2 },
            ],
            selectedTracks: [{ fileParts: [pending] }, { fileParts: [online] }, { fileParts: [empty] }],
            pendingIds: new Set([pending.id]),
            signal,
        });
        // Wait for the queued commitSelection write to finish without issuing a second save yet.
        await session.saveCompletedSelection([], () => false, signal);
        expect(canRestore).toBe(true);

        const savedBefore = (await repository.fetch())!;
        expect(savedBefore.subtitleTrackIds).toEqual([[], [online.id], [empty.id]]);
        expect(savedBefore.cachedSubtitleFiles?.map(({ id }) => id)).toEqual([online.id, empty.id]);
        expect(savedBefore.embeddedSubtitles).toEqual({ [empty.id]: empty.embedded });
        const restoredBefore = await restoreSessionFiles(savedBefore, [video], prepare);
        expect(restoredBefore.files.map(({ id }) => id)).toEqual([video.id, '-', online.id, empty.id]);
        expect(restoredBefore.files[2].file.size).toBe(online.file.size);
        expect(restoredBefore.missingEmbeddedSubtitles).toEqual([]);

        const completed = { ...pending, file: new File(['Extracted'], pending.file.name) };
        await session.saveCompletedSelection(
            [{ fileParts: [completed] }, { fileParts: [online] }, { fileParts: [empty] }],
            () => true,
            signal
        );
        const restoredAfter = await restoreSessionFiles((await repository.fetch())!, [video], prepare);
        expect(restoredAfter.files.map(({ id }) => id)).toEqual([video.id, pending.id, online.id, empty.id]);
        expect(restoredAfter.files[1].file.size).toBe(completed.file.size);
        expect(restoredAfter.missingEmbeddedSubtitles).toEqual([]);
        expect(onError).not.toHaveBeenCalled();
    } finally {
        await repository.clear();
        if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
        else Reflect.deleteProperty(navigator, 'storage');
    }
});
