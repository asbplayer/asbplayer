import 'core-js/stable/structured-clone'; // fake-indexeddb requires structured clone polyfill
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from '@jest/globals';
import Dexie from 'dexie';
import { MediaSources } from '@project/common/app/services/media-sources';
import type { FileWithId } from '@project/common/file-selector';
import type {
    FileSessionRecord,
    FileSystemFileHandleWithId,
} from '@project/common/file-system-access/file-system-access-repository';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import {
    canRestoreSession,
    resolveFiles,
    restoreSessionFiles,
} from '@project/common/file-system-access/file-system-access';
import { IndexedDBFileSessionRepository } from '@project/common/file-system-access/file-system-access-repository';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';

const unexpectedPreparation = async () => {
    throw new Error('Unexpected embedded subtitle preparation');
};

const externalSelection = (subtitleTrackIds: string[][]) => ({ subtitleTrackIds, embeddedSubtitles: {} });

beforeEach(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) },
    });
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

    await repository.setCachedSubtitleFiles(
        [{ id: 'jimaku-url', file: subtitle }],
        externalSelection([['jimaku-url']])
    );

    const record = await repository.fetch();
    expect(canRestoreSession(record)).toBe(true);
    expect(record?.cachedSubtitleFiles).toHaveLength(1);
    expect(record?.cachedSubtitleFiles?.[0].id).toEqual('jimaku-url');
    expect(record?.cachedSubtitleFiles?.[0].file.name).toEqual('episode.srt');
    expect(await readFile(record!.cachedSubtitleFiles![0].file)).toEqual('subtitle contents');
});

it('retains only cached online subtitles that are still loaded', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles(
        [
            { id: 'selected', file: new File(['selected'], 'selected.srt') },
            { id: 'replaced', file: new File(['replaced'], 'replaced.srt') },
        ],
        externalSelection([['selected'], ['replaced']])
    );

    await repository.retain({ subtitleTrackIds: [['selected']] });

    const record = await repository.fetch();
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['selected']);
});

it('preserves cached online subtitles while merging local file handles', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles(
        [{ id: 'online', file: new File(['online'], 'online.srt') }],
        externalSelection([['online']])
    );

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
    await repository.setCachedSubtitleFiles(
        [{ id: 'online', file: new File(['online'], 'online.ass') }],
        externalSelection([['online']])
    );

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
    const restored = await restoreSessionFiles(record, files, unexpectedPreparation);
    expect(restored.missingEmbeddedSubtitles).toEqual([]);
    return { record, files: restored.files };
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
    await repository.setCachedSubtitleFiles([online], externalSelection([['online']]));
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

it('restores sessions without a saved arrangement in handle-then-cache order', async () => {
    const cachedSource = { ...online, track: 0 };
    const record: FileSessionRecord = {
        id: 1,
        timestamp: 1,
        videoHandle: handleFor(video),
        subtitleHandles: [local, secondLocal].map(handleFor),
        cachedSubtitleFiles: [cachedSource],
    };
    const { files, missingEmbeddedSubtitles } = await restoreSessionFiles(
        record,
        [video, local, secondLocal],
        unexpectedPreparation
    );
    expect(canRestoreSession(record)).toBe(true);
    expect(record.subtitleTrackIds).toBeUndefined();
    expect(missingEmbeddedSubtitles).toEqual([]);
    expect(files.map(({ id }) => id)).toEqual(['video', 'local', 'second-local', 'online']);
    expect(MediaSources.fromFiles(files).subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 2]);
});

it.each([
    {
        name: 'a flat arrangement',
        savedTracks: ['online', '-', 'online'],
        expectedTracks: [['online'], ['-'], ['online']],
        expectedRestoredTracks: [['online'], ['-'], ['online']],
    },
    {
        name: 'an already grouped arrangement with repeated parts and empty slots',
        savedTracks: [['online', 'online'], [], ['online', 'online'], []],
        expectedTracks: [['online', 'online'], [], ['online', 'online'], []],
        expectedRestoredTracks: [['online', 'online'], ['-'], ['online', 'online'], ['-']],
    },
    {
        name: 'an empty arrangement',
        savedTracks: [],
        expectedTracks: [],
        expectedRestoredTracks: [],
    },
    {
        name: 'no saved arrangement',
        savedTracks: undefined,
        expectedTracks: undefined,
        expectedRestoredTracks: [['online']],
    },
])(
    'migrates version 2 with $name and preserves it through later saves',
    async ({ savedTracks, expectedTracks, expectedRestoredTracks }) => {
        const database = new Dexie('FileSessionDatabase');
        database.version(2).stores({ sessions: '++id,timestamp' });
        try {
            await database.table('sessions').put({
                id: 1,
                timestamp: 1,
                subtitleHandles: [],
                cachedSubtitleFiles: [{ ...online, track: 2 }],
                subtitleTrackIds: savedTracks,
            });
        } finally {
            database.close();
        }

        const repository = new IndexedDBFileSessionRepository();
        expect((await repository.fetch())?.subtitleTrackIds).toEqual(expectedTracks);

        // Verify the upgrade persisted the new format before a repository write can normalize it.
        const migratedDatabase = new Dexie('FileSessionDatabase');
        await migratedDatabase.open();
        try {
            expect(migratedDatabase.verno).toBe(3);
            expect((await migratedDatabase.table('sessions').get(1)).subtitleTrackIds).toEqual(expectedTracks);
        } finally {
            migratedDatabase.close();
        }

        await repository.clearBuffered();
        const { record, files } = await reload();
        expect(record.subtitleTrackIds).toEqual(expectedTracks);
        const sources = MediaSources.fromFiles(files);
        expect(sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual(
            expectedRestoredTracks
        );
        expect(sources.subtitleSourceFiles.map(({ track }) => track)).toEqual(
            expectedRestoredTracks.flatMap((ids, track) => ids.map(() => track))
        );
    }
);

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
        await repository.setCachedSubtitleFiles(parts, externalSelection(savedTracks));
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

it('preserves slot positions when a saved subtitle is unavailable', async () => {
    const { files } = await restoreSessionFiles(
        { id: 1, timestamp: 1, subtitleHandles: [], subtitleTrackIds: [['missing'], ['online']] },
        [online],
        unexpectedPreparation
    );
    expect(files.map(({ id }) => id)).toEqual(['-', 'online']);
    expect(files[0].file.size).toBe(0);
    expect(files[1].file).toBe(online.file);
});

it('saves the first mixed selection before its cache and buffered handles are persisted', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ subtitleHandles: [], bufferedSubtitleHandles: [handleFor(local)] });
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });
    await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]));
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
        await repository.setCachedSubtitleFiles([online], externalSelection([['online']]));
        await repository.clear();
    }
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });
    await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]));
    await repository.merge({ subtitleHandles: [handleFor(local)] });

    expect((await reload()).files.map(({ id }) => id)).toEqual(['online', '-', 'local']);
});

it('replaces a saved arrangement when new subtitle files are loaded', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [handleFor(local)] });
    await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]));
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
    await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]));
    await repository.retain({ subtitleTrackIds: [['online'], ['-'], ['local']] });

    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [] });
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);
    await repository.merge({ subtitleHandles: [], bufferedSubtitleHandles: [handleFor(secondLocal)] });
    await repository.clearBuffered();
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);
    await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]));
    expect((await repository.fetch())?.subtitleTrackIds).toEqual([['online'], ['-'], ['local']]);

    await repository.setCachedSubtitleFiles([], externalSelection([['online'], ['-'], ['local']]));
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
    await repository.setCachedSubtitleFiles(
        [cachedSource, cachedSource, { id: '-', file: new File([], '.srt') }],
        externalSelection([['online'], ['online'], ['-']])
    );

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

it('saves an empty subtitle selection and removes its previous contents and descriptors', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles([online], externalSelection([['online']]));
    expect(await repository.setCachedSubtitleFiles([], externalSelection([]))).toBe(true);
    const record = (await repository.fetch())!;
    expect(record.cachedSubtitleFiles).toEqual([]);
    expect(record.subtitleTrackIds).toEqual([]);
    expect(record.embeddedSubtitles).toEqual({});
    expect(canRestoreSession(record)).toBe(false);
});

it('keeps local and video slots when the downloaded subtitle cache exceeds its size limit', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.merge({ videoHandle: handleFor(video), subtitleHandles: [handleFor(local)] });
    await repository.retain({ videoId: 'video', subtitleTrackIds: [['online'], ['-'], ['local']] });
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 2, usage: online.file.size }) },
    });

    expect(await repository.setCachedSubtitleFiles([online], externalSelection([['online'], ['-'], ['local']]))).toBe(
        false
    );
    const { record, files } = await reload();
    expect(record.cachedSubtitleFiles).toEqual([]);
    expect(files.map(({ id }) => id)).toEqual(['video', '-', '-', 'local']);
});

describe('embedded subtitle sessions', () => {
    const video = { id: 'video', file: new File(['movie'], 'episode.mkv', { lastModified: 1 }) };
    const descriptor = embeddedDescriptor(video, {
        trackIndex: 3,
        codec: 'subrip',
        outputFormat: 'srt',
    });
    const id = embeddedSubtitleId(video.id, 3);
    const embedded = {
        id,
        embedded: descriptor,
        file: new File(['subtitle'], 'embedded.srt', { type: 'application/x-subrip' }),
    };
    const external = { id: 'external', file: new File(['external'], 'external.srt') };
    const record = (): FileSessionRecord => ({
        id: 1,
        timestamp: 1,
        videoHandle: { id: video.id, handle: { name: video.file.name } as FileSystemFileHandle },
        subtitleHandles: [],
        subtitleTrackIds: [[id], ['-'], ['external'], [id]],
        embeddedSubtitles: { [id]: descriptor },
        cachedSubtitleFiles: [external, embedded],
    });
    it.each(['cached', 'prepared'])(
        'restores repeated %s embedded subtitles into separate playback slots',
        async (kind) => {
            const repository = new IndexedDBFileSessionRepository();
            const selection = [
                { ...embedded, track: 0 },
                { ...embedded, track: 2 },
            ];
            await repository.merge({ videoHandle: record().videoHandle, subtitleHandles: [] });
            await repository.setCachedSubtitleFiles(selection, {
                subtitleTrackIds: [[id], [], [id]],
                embeddedSubtitles: { [id]: descriptor },
            });
            if (kind === 'prepared') {
                await repository.setCachedSubtitleFiles([], {
                    subtitleTrackIds: [[id], [], [id]],
                    embeddedSubtitles: { [id]: descriptor },
                });
            }
            const saved = (await repository.fetch())!;
            const { files, missingEmbeddedSubtitles } = await restoreSessionFiles(
                saved,
                [video],
                kind === 'cached'
                    ? unexpectedPreparation
                    : async () => new Map([[id, { ...embedded, file: new File([], embedded.file.name) }]])
            );
            expect(missingEmbeddedSubtitles).toEqual(kind === 'cached' ? [] : [descriptor]);
            const sources = MediaSources.fromFiles(files);
            expect(sources.subtitleTracks.map(({ fileParts }) => fileParts.map(({ id }) => id))).toEqual([
                [id],
                ['-'],
                [id],
            ]);
            expect(sources.subtitleSourceFiles.map(({ track }) => track)).toEqual([0, 1, 2]);
            expect(sources.subtitleSourceFiles[0].file).toBe(sources.subtitleSourceFiles[2].file);
            expect(sources.subtitleSourceFiles[2].embedded).toEqual(descriptor);
            expect(saved.cachedSubtitleFiles).toHaveLength(kind === 'cached' ? 1 : 0);
        }
    );

    it('persists and restores completed bitmap files and their format without requesting extraction', async () => {
        const bitmapDescriptor = {
            ...descriptor,
            codec: 'hdmv_pgs_subtitle',
            format: ffmpegSubtitleFormats.image.extension,
        };
        const bitmap = {
            ...embedded,
            embedded: bitmapDescriptor,
            file: new File(['completed images'], 'embedded.asbimg', {
                type: ffmpegSubtitleFormats.image.mimeType,
            }),
        };
        const repository = new IndexedDBFileSessionRepository();
        await repository.merge({ videoHandle: record().videoHandle, subtitleHandles: [] });
        await repository.setCachedSubtitleFiles([bitmap], {
            subtitleTrackIds: [[id]],
            embeddedSubtitles: { [id]: bitmapDescriptor },
        });
        const saved = (await repository.fetch())!;
        const restored = await restoreSessionFiles(saved, [video], unexpectedPreparation);
        expect(restored.missingEmbeddedSubtitles).toEqual([]);
        expect(restored.files[1].embedded).toEqual(bitmapDescriptor);
        expect(restored.files[1].file.name).toBe('embedded.asbimg');
        expect(MediaSources.fromFiles(restored.files).subtitleSourceFiles[0].file.size).toBe(bitmap.file.size);
    });

    it.each(['application/x-subrip', 'text/plain', ''])(
        'restores mixed sources and embedded provenance independently of MIME type %s',
        async (type) => {
            const session = record();
            session.cachedSubtitleFiles = [
                external,
                { ...embedded, file: new File(['subtitle'], 'embedded.srt', { type }) },
            ];
            const { files: restored, missingEmbeddedSubtitles } = await restoreSessionFiles(
                session,
                [video],
                unexpectedPreparation
            );
            expect(missingEmbeddedSubtitles).toEqual([]);
            expect(restored.map((file) => file.id)).toEqual(['video', id, '-', 'external', id]);
            expect(restored[1].embedded).toEqual(descriptor);
            expect(restored[1].file.type).toBe(type);
            expect(restored[4].file).toBe(restored[1].file);
        }
    );

    it('keeps a replacement session when an earlier subtitle save is still awaiting its quota estimate', async () => {
        const repository = new IndexedDBFileSessionRepository();
        await repository.merge({ videoHandle: record().videoHandle, subtitleHandles: [] });
        let releaseEstimate!: (value: StorageEstimate) => void;
        let estimateStarted!: () => void;
        const started = new Promise<void>((resolve) => {
            estimateStarted = resolve;
        });
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: {
                estimate: () => {
                    estimateStarted();
                    return new Promise<StorageEstimate>((resolve) => {
                        releaseEstimate = resolve;
                    });
                },
            },
        });
        const save = repository.setCachedSubtitleFiles([embedded], {
            subtitleTrackIds: [[id]],
            embeddedSubtitles: { [id]: descriptor },
        });
        await started;
        const replacementVideo = { id: 'replacement', handle: { name: 'replacement.mkv' } as FileSystemFileHandle };
        const retain = repository.retain({ videoId: replacementVideo.id, subtitleTrackIds: [] });
        const merge = repository.merge({ videoHandle: replacementVideo, subtitleHandles: [] });
        releaseEstimate({ quota: 1024 ** 3, usage: 0 });
        await Promise.all([save, retain, merge]);
        const saved = await repository.fetch();
        expect(saved?.videoHandle).toEqual(replacementVideo);
        expect(saved?.subtitleTrackIds).toEqual([]);
        expect(saved?.cachedSubtitleFiles).toEqual([]);
        expect(saved?.embeddedSubtitles).toEqual({});
    });
    it('prepares an evicted embedded file before reconstructing duplicate slots', async () => {
        const session = record();
        session.cachedSubtitleFiles = [external];
        const prepared = { ...embedded, file: new File([], embedded.file.name) };
        const { files: restored, missingEmbeddedSubtitles } = await restoreSessionFiles(
            session,
            [video],
            async (source, descriptors) => {
                expect(source).toBe(video);
                expect(descriptors).toEqual([descriptor]);
                return new Map([[id, prepared]]);
            }
        );
        expect(restored.map((file) => file.id)).toEqual(['video', id, '-', 'external', id]);
        expect(restored[1].file).toBe(prepared.file);
        expect(restored[4].file).toBe(prepared.file);
        expect(missingEmbeddedSubtitles).toEqual([descriptor]);
    });
    it.each([1, 2])('restores available tracks when preparing %i missing embedded tracks fails', async (count) => {
        const session = record();
        const missing = Array.from({ length: count }, (_, index) =>
            embeddedDescriptor(video, { trackIndex: 4 + index, codec: 'subrip', outputFormat: 'srt' })
        );
        const missingIds = missing.map(({ trackIndex }) => embeddedSubtitleId(video.id, trackIndex));
        session.embeddedSubtitles = {
            ...session.embeddedSubtitles,
            ...Object.fromEntries(missingIds.map((id, index) => [id, missing[index]])),
        };
        session.subtitleTrackIds!.push(...missingIds.map((id) => [id]));
        const { files, missingEmbeddedSubtitles } = await restoreSessionFiles(session, [video], async () => {
            throw new Error('Could not read embedded metadata');
        });
        expect(files.map(({ id }) => id)).toEqual(['video', id, '-', 'external', id, ...missingIds]);
        expect(files[0].file).toBe(video.file);
        expect(files[3].file).toBe(external.file);
        expect(files[1].embedded).toEqual(descriptor);
        expect(files[1].file).toBe(embedded.file);
        expect(files[4].file).toBe(embedded.file);
        expect(files.slice(5).map(({ file }) => file.size)).toEqual(missing.map(() => 0));
        expect(missingEmbeddedSubtitles).toEqual(missing);
    });
    it.each([true, false])(
        'prefers current disk contents over cached local subtitles (slot metadata: %s)',
        async (slots) => {
            const session = record();
            const updated = {
                ...external,
                file: new File(['corrected subtitles'], 'external.srt', { lastModified: 2 }),
            };
            if (!slots) delete session.subtitleTrackIds;

            const { files: restored } = await restoreSessionFiles(session, [video, updated], unexpectedPreparation);

            expect(restored.find((file) => file.id === external.id)?.file).toBe(updated.file);
            expect(restored.find((file) => file.id === id)?.file).toBe(embedded.file);
            if (slots) expect(restored.map((file) => file.id)).toEqual(['video', id, '-', external.id, id]);
        }
    );
    it('does not reuse cached subtitles from changed video contents and retains unavailable slot positions', async () => {
        const changed = { ...video, file: new File(['different'], 'episode.mkv', { lastModified: 2 }) };
        const { files: restored, missingEmbeddedSubtitles } = await restoreSessionFiles(
            record(),
            [changed],
            async () => {
                throw new Error('must not prepare');
            }
        );
        expect(restored.map((file) => file.file.size)).toEqual([9, 0, 0, 8, 0]);
        expect(missingEmbeddedSubtitles).toEqual([]);
    });
    it('preserves descriptors and selected IDs when quota prevents output caching and repository mutations follow', async () => {
        const repository = new IndexedDBFileSessionRepository();
        await repository.merge({ videoHandle: record().videoHandle, subtitleHandles: [] });
        await repository.setCachedSubtitleFiles([embedded], {
            subtitleTrackIds: [[id], ['-'], [id]],
            embeddedSubtitles: { [id]: descriptor },
        });
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: { estimate: async () => ({ quota: 1, usage: 1 }) },
        });
        try {
            expect(
                await repository.setCachedSubtitleFiles(
                    [embedded, embedded, { id: '-', file: new File([''], '.srt') }],
                    {
                        subtitleTrackIds: [[id], ['-'], [id]],
                        embeddedSubtitles: { [id]: descriptor },
                    }
                )
            ).toBe(false);
            await repository.clearBuffered();
            await repository.retain({ videoId: 'video', subtitleTrackIds: [[id], ['-'], [id]] });
            const saved = await repository.fetch();
            expect(saved?.cachedSubtitleFiles).toEqual([]);
            expect(saved?.subtitleTrackIds).toEqual([[id], ['-'], [id]]);
            expect(saved?.embeddedSubtitles).toEqual({ [id]: descriptor });
        } finally {
            Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
        }
    });
    it('continues to restore records without slot metadata', async () => {
        const session = record();
        delete session.subtitleTrackIds;
        expect(
            (await restoreSessionFiles(session, [video], unexpectedPreparation)).files.map((file) => file.id)
        ).toEqual(['video', 'external', id]);
    });

    it('clears cancelled draft handles while preserving the committed embedded selection', async () => {
        const repository = new IndexedDBFileSessionRepository();
        await repository.setCachedSubtitleFiles([embedded], {
            subtitleTrackIds: [[id], ['-'], [id]],
            embeddedSubtitles: { [id]: descriptor },
        });
        await repository.merge({
            subtitleHandles: [],
            bufferedSubtitleHandles: [{ id: 'draft', handle: { name: 'draft.srt' } as FileSystemFileHandle }],
        });
        await repository.clearBuffered();
        const saved = await repository.fetch();
        expect(saved?.bufferedSubtitleHandles).toBeUndefined();
        expect(saved?.subtitleTrackIds).toEqual([[id], ['-'], [id]]);
        expect(saved?.embeddedSubtitles).toEqual({ [id]: descriptor });
        expect(saved?.cachedSubtitleFiles?.map((file) => file.id)).toEqual([id]);
    });

    it('promotes selected handles once and releases all draft handles without losing selection metadata', async () => {
        const repository = new IndexedDBFileSessionRepository();
        const selected = { id: 'local', handle: { name: 'local.srt' } as FileSystemFileHandle };
        await repository.setCachedSubtitleFiles([embedded], {
            subtitleTrackIds: [[id], ['local'], ['-']],
            embeddedSubtitles: { [id]: descriptor },
        });
        await repository.merge({
            subtitleHandles: [selected],
            bufferedSubtitleHandles: [
                selected,
                { id: 'unused', handle: { name: 'unused.srt' } as FileSystemFileHandle },
            ],
        });
        await repository.promoteBuffered(['local']);
        const saved = await repository.fetch();
        expect(saved?.subtitleHandles.map((handle) => handle.id)).toEqual(['local']);
        expect(saved?.bufferedSubtitleHandles).toBeUndefined();
        expect(saved?.subtitleTrackIds).toEqual([[id], ['local'], ['-']]);
        expect(saved?.embeddedSubtitles).toEqual({ [id]: descriptor });
    });
});
