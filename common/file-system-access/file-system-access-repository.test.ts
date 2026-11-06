import 'core-js/stable/structured-clone'; // fake-indexeddb requires structured clone polyfill
import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from '@jest/globals';
import Dexie from 'dexie';
import { MediaSources } from '@project/common/app/services/media-sources';
import type { FileWithId } from '@project/common/file-selector';
import type { FileSystemFileHandleWithId } from '@project/common/file-system-access/file-system-access-repository';
import {
    canRestoreSession,
    resolveFiles,
    restoreSessionFiles,
} from '@project/common/file-system-access/file-system-access';
import { IndexedDBFileSessionRepository } from '@project/common/file-system-access/file-system-access-repository';

beforeEach(async () => {
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) },
    });
    await new IndexedDBFileSessionRepository().clear();
});

const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });

it('caches online subtitle contents for a later session', async () => {
    const repository = new IndexedDBFileSessionRepository();
    const subtitle = new File(['subtitle contents'], 'episode.srt', { type: 'text/plain' });

    await repository.setCachedSubtitleFiles([{ id: 'jimaku-url', file: subtitle }]);

    const record = await repository.fetch();
    expect(canRestoreSession(record)).toBe(true);
    expect(record?.cachedSubtitleFiles).toHaveLength(1);
    expect(record?.cachedSubtitleFiles?.[0].id).toEqual('jimaku-url');
    expect(record?.cachedSubtitleFiles?.[0].file.name).toEqual('episode.srt');
    expect(await readFile(record!.cachedSubtitleFiles![0].file)).toEqual('subtitle contents');
});

it('retains only cached online subtitles that are still loaded', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles([
        { id: 'selected', file: new File(['selected'], 'selected.srt') },
        { id: 'replaced', file: new File(['replaced'], 'replaced.srt') },
    ]);

    await repository.retain({ subtitleTrackIds: [['selected']] });

    const record = await repository.fetch();
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['selected']);
});

it('preserves cached online subtitles while merging local file handles', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles([{ id: 'online', file: new File(['online'], 'online.srt') }]);

    await repository.merge({
        videoHandle: { id: 'video', handle: { kind: 'file', name: 'video.mp4' } as FileSystemFileHandle },
        subtitleHandles: [{ id: 'local', handle: { kind: 'file', name: 'local.srt' } as FileSystemFileHandle }],
    });

    const record = await repository.fetch();
    expect(record?.videoHandle?.handle.name).toEqual('video.mp4');
    expect(record?.subtitleHandles.map((f) => f.handle.name)).toEqual(['local.srt']);
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['online']);
    expect(await readFile(record!.cachedSubtitleFiles![0].file)).toEqual('online');
});

it('preserves cached online subtitles while clearing buffered local subtitle handles', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles([{ id: 'online', file: new File(['online'], 'online.ass') }]);

    await repository.clearBuffered();

    const record = await repository.fetch();
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['online']);
});

const bytes = new Uint8Array([0x50, 0x47, 0x00, 0xff, 0x81, 0x00, 0x7f]);
const local = { id: 'local', file: new File([bytes], 'Japanese.ass') };
const secondLocal = { id: 'second-local', file: new File(['English'], 'English.srt') };
const online = { id: 'online', file: new File([bytes], 'download.sup') };
const video = { id: 'video', file: new File(['video'], 'video.mp4') };

const handleFor = ({ id, file }: FileWithId): FileSystemFileHandleWithId => ({
    id,
    handle: { kind: 'file', name: file.name } as FileSystemFileHandle,
});

const readBytes = (file: File) =>
    new Promise<number[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });

// FileSystemFileHandle is a browser-owned structured-clone type unavailable in jsdom.
// Persist its identity, then supply getFile at that boundary after reloading the record.
async function reload() {
    const record = (await new IndexedDBFileSessionRepository().fetch())!;
    const localFiles = new Map([local, secondLocal, video].map((f) => [f.id, f.file]));
    const handles = [...(record.videoHandle ? [record.videoHandle] : []), ...record.subtitleHandles];
    const { files, errors } = await resolveFiles(
        handles.map(({ id, handle }) => ({
            id,
            handle: { ...handle, getFile: async () => localFiles.get(id)! },
        }))
    );
    expect(errors).toEqual([]);
    return { record, files: restoreSessionFiles(record, files) };
}

it.each([[], ['local'], ['local', 'second-local'], ['-', 'local'], ['-'], ['-', '-']].map((order) => ({ order })))(
    'does not offer restoration without saved files for slots $order',
    async ({ order }) => {
        const repository = new IndexedDBFileSessionRepository();
        // Directory loading retains the playback IDs without saving handles or file contents.
        await repository.retain({ subtitleTrackIds: order.map((id) => [id]) });

        expect(canRestoreSession(await repository.fetch())).toBe(false);
    }
);

it.each(
    [
        ['second-local', 'local'],
        ['online', '-', 'local'],
        ['local', 'local', 'second-local'],
        ['online', 'online', 'local'],
        ['-', 'local', 'second-local'],
        ['local', '-', 'second-local'],
        ['local', 'second-local', '-'],
        ['-', '-', '-'],
    ].map((order) => ({ order }))
)('persists and restores playback slots $order', async ({ order }) => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [local, secondLocal].map(handleFor) });
    await repository.setCachedSubtitleFiles([online]);
    await repository.retain({ videoId: 'video', subtitleTrackIds: order.map((id) => [id]) });

    const { record, files } = await reload();
    expect(canRestoreSession(record)).toBe(true);
    expect(record.subtitleTrackIds).toEqual(order.map((id) => [id]));
    expect(files.map(({ id }) => id)).toEqual(['video', ...order]);
    expect(MediaSources.fromFiles(files).subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual(
        order.map((id) => [id])
    );
    expect(files[0].file).toBe(video.file);
    for (const slot of files.slice(1)) {
        if (slot.id === '-') {
            expect(slot.file.name).toBe('.srt');
            expect(slot.file.size).toBe(0);
        } else if (slot.id === 'local') {
            expect(slot.file).toBe(local.file);
            expect(await readBytes(slot.file)).toEqual(Array.from(bytes));
        } else if (slot.id === 'online') {
            expect(slot.file.name).toBe(online.file.name);
            expect(await readBytes(slot.file)).toEqual(Array.from(bytes));
        }
    }
    expect(record.cachedSubtitleFiles?.some(({ id }) => id === '-')).toBe(false);
    expect(record.cachedSubtitleFiles?.length ?? 0).toBe(order.includes('online') ? 1 : 0);
    if (order[0] === order[1] && order[0] !== '-') {
        expect(files[1].file).toBe(files[2].file);
    }
});

it('restores older sessions in their original handle-then-cache order', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [local, secondLocal].map(handleFor) });
    const cachedSource = { ...online, track: 0 };
    await repository.setCachedSubtitleFiles([cachedSource]);

    const { record, files } = await reload();
    expect(canRestoreSession(record)).toBe(true);
    expect(record.subtitleTrackIds).toBeUndefined();
    expect(files.map(({ id }) => id)).toEqual(['video', 'local', 'second-local', 'online']);
    expect(MediaSources.fromFiles(files).subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 2]);
});

it('reads an existing flat arrangement and preserves its slots through later saves', async () => {
    const database = new Dexie('FileSessionDatabase');
    await database.open();
    try {
        await database.table('sessions').put({
            id: 1,
            timestamp: 1,
            subtitleHandles: [],
            cachedSubtitleFiles: [{ ...online, track: 2 }],
            subtitleTrackIds: ['online', '-', 'online'],
        });
    } finally {
        database.close();
    }

    await new IndexedDBFileSessionRepository().clearBuffered();
    const { record, files } = await reload();
    expect(record.subtitleTrackIds).toEqual([['online'], ['-'], ['online']]);
    const sources = MediaSources.fromFiles(files);
    expect(sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual([
        ['online'],
        ['-'],
        ['online'],
    ]);
    expect(sources.subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 2]);
});

it.each([
    {
        name: 'two segmented tracks',
        savedTracks: [
            ['japanese1', 'japanese2'],
            ['english1', 'english2'],
        ],
        expectedTracks: [
            ['japanese1', 'japanese2'],
            ['english1', 'english2'],
        ],
        expectedIndexes: [0, 0, 1, 1],
    },
    {
        name: 'a repeated segmented track with an empty middle and trailing slot',
        savedTracks: [['japanese1', 'japanese2'], [], ['japanese1', 'japanese2'], []],
        expectedTracks: [['japanese1', 'japanese2'], ['-'], ['japanese1', 'japanese2'], ['-']],
        expectedIndexes: [0, 0, 1, 2, 2, 3],
    },
])(
    'saves and restores $name without changing file contents',
    async ({ savedTracks, expectedTracks, expectedIndexes }) => {
        const repository = new IndexedDBFileSessionRepository();
        // A source's cached track index must not control its position after restoration.
        const parts = ['japanese1', 'japanese2', 'english1', 'english2'].map((id) => ({
            id,
            file: new File([`Original ${id}`], `${id}.vtt`),
            track: 2,
        }));
        await repository.setCachedSubtitleFiles(parts);
        await repository.retain({ subtitleTrackIds: savedTracks });

        const { record, files } = await reload();
        const sources = MediaSources.fromFiles(files);
        expect(record.subtitleTrackIds).toEqual(savedTracks);
        expect(record.cachedSubtitleFiles).toHaveLength(new Set(savedTracks.flat()).size);
        expect(sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual(expectedTracks);
        expect(sources.subtitleSourceFiles.map(({ track }) => track)).toEqual(expectedIndexes);
        for (const { id, file } of sources.subtitleSourceFiles) {
            expect(await readFile(file)).toBe(id === '-' ? '' : `Original ${id}`);
            expect(file.name).toBe(id === '-' ? '.srt' : `${id}.vtt`);
        }
    }
);

it('restores repeated local file groups and preserves their slots when a part is discarded', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ subtitleHandles: [local, secondLocal].map(handleFor) });
    await repository.retain({ subtitleTrackIds: [['local', 'second-local'], [], ['local', 'second-local']] });

    let restored = MediaSources.fromFiles((await reload()).files);
    expect(restored.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual([
        ['local', 'second-local'],
        ['-'],
        ['local', 'second-local'],
    ]);
    expect(restored.subtitleTracks[0].fileParts.map(({ file }) => file)).toEqual([local.file, secondLocal.file]);
    expect(restored.subtitleTracks[2].fileParts.map(({ file }) => file)).toEqual([local.file, secondLocal.file]);

    await repository.merge({ subtitleHandles: [handleFor(local)] });
    restored = MediaSources.fromFiles((await reload()).files);
    expect(restored.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual([
        ['local', '-'],
        ['-'],
        ['local', '-'],
    ]);
});

it.each(['video', 'subtitles'])('restores a session with only %s', async (kind) => {
    const videoOnly = kind === 'video';
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({
        videoHandle: videoOnly ? handleFor(video) : undefined,
        subtitleHandles: videoOnly ? [] : [handleFor(local)],
    });
    await repository.retain({
        videoId: videoOnly ? 'video' : undefined,
        subtitleTrackIds: videoOnly ? [] : [['local']],
    });

    const { record, files } = await reload();
    expect(canRestoreSession(record)).toBe(true);
    expect(files.map(({ id }) => id)).toEqual(videoOnly ? ['video'] : ['local']);
});

it('preserves slot positions when a saved subtitle is unavailable', () => {
    const files = restoreSessionFiles(
        { id: 1, timestamp: 1, subtitleHandles: [], subtitleTrackIds: [['missing'], ['online']] },
        [online]
    );
    expect(files.map(({ id }) => id)).toEqual(['-', 'online']);
    expect(files[0].file.size).toBe(0);
    expect(files[1].file).toBe(online.file);
});

it('saves the first mixed selection before its cache and buffered handles are persisted', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ subtitleHandles: [], bufferedSubtitleHandles: [handleFor(local)] });
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });
    await repository.setCachedSubtitleFiles([online]);
    await repository.promoteBuffered(['online', '-', 'local']);

    const { record, files } = await reload();
    expect(record.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);
    expect(record.bufferedSubtitleHandles).toBeUndefined();
    expect(files.map(({ id }) => id)).toEqual(['online', '-', 'local']);
    expect(files[2].file).toBe(local.file);
});

it.each(['new', 'cleared'])('records slots in a %s session before file contents are saved', async (state) => {
    const repository = new IndexedDBFileSessionRepository();
    if (state === 'cleared') {
        await repository.setCachedSubtitleFiles([online]);
        await repository.clear();
    }
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });
    await repository.setCachedSubtitleFiles([online]);
    await repository.merge({ subtitleHandles: [handleFor(local)] });

    expect((await reload()).files.map(({ id }) => id)).toEqual(['online', '-', 'local']);
});

it('replaces a saved arrangement when new subtitle files are loaded', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [handleFor(local)] });
    await repository.setCachedSubtitleFiles([online]);
    await repository.retain({ videoId: 'video', subtitleTrackIds: [['online'], ['-'], ['local']] });

    // The active configuration is retained before the new handles are saved, as in App.
    await repository.retain({ videoId: 'video', subtitleTrackIds: [['second-local']] });
    await repository.merge({ subtitleHandles: [handleFor(secondLocal)] });

    const { record, files } = await reload();
    expect(record.cachedSubtitleFiles).toEqual([]);
    expect(record.subtitleHandles.map(({ id }) => id)).toEqual(['second-local']);
    expect(files.map(({ id }) => id)).toEqual(['video', 'second-local']);
});

it('preserves slot order across unrelated repository mutations and removes discarded IDs', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ subtitleHandles: [handleFor(local)] });
    await repository.setCachedSubtitleFiles([online]);
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });

    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [] });
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);
    await repository.merge({ subtitleHandles: [], bufferedSubtitleHandles: [handleFor(secondLocal)] });
    await repository.clearBuffered();
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);
    await repository.setCachedSubtitleFiles([online]);
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);

    await repository.setCachedSubtitleFiles([]);
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['-'], ['-'], ['local']]);
    await repository.merge({ subtitleHandles: [handleFor(secondLocal)] });
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['-'], ['-'], ['-']]);
    await repository.retain({ subtitleTrackIds: [['second-local'], ['second-local'], ['-']] });
    await repository.retain({ subtitleTrackIds: [] });
    const record = await repository.fetch();
    expect(record?.subtitleTrackIds).toEqual([]);
    expect(record?.subtitleHandles).toEqual([]);
    expect(canRestoreSession(record)).toBe(false);
});

it('stores downloaded bytes once for repeated slots and never caches empty placeholders', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.retain({ subtitleTrackIds: [['online'], ['online'], ['-']] });
    const cachedSource = { ...online, track: 2 };
    await repository.setCachedSubtitleFiles([cachedSource, cachedSource, { id: '-', file: new File([], '.srt') }]);

    const { record, files } = await reload();
    expect(record.cachedSubtitleFiles).toHaveLength(1);
    expect(files.map(({ id }) => id)).toEqual(['online', 'online', '-']);
    expect(files[0].file).toBe(files[1].file);
    expect(await readBytes(files[0].file)).toEqual(Array.from(bytes));
    expect(MediaSources.fromFiles(files).subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 2]);
});

it('does not offer restoration for all-empty slots or store placeholder files', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.retain({ subtitleTrackIds: [['-'], ['-'], ['-']] });

    const record = (await repository.fetch())!;
    expect(canRestoreSession(record)).toBe(false);
    expect(record.subtitleHandles).toEqual([]);
    expect(record.cachedSubtitleFiles).toBeUndefined();
});

it('keeps local and video slots when the downloaded subtitle cache exceeds its size limit', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [handleFor(local)] });
    await repository.retain({ videoId: 'video', subtitleTrackIds: [['online'], ['-'], ['local']] });
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 2, usage: online.file.size }) },
    });

    expect(await repository.setCachedSubtitleFiles([online])).toBe(false);
    const { record, files } = await reload();
    expect(record.cachedSubtitleFiles).toEqual([]);
    expect(files.map(({ id }) => id)).toEqual(['video', '-', '-', 'local']);
});
