import 'core-js/stable/structured-clone';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dexie from 'dexie';
import { useFileSession } from '@project/common/app/hooks/use-file-session';
import { IndexedDBFileSessionRepository, restoreSessionFiles } from '@project/common/file-system-access';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('restores completed downloads in their slots before embedded extraction completes', async () => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    const originalPicker = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: () => {} });
    Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: async () => ({ quota: 1024 ** 3, usage: 0 }) },
    });
    const root = createRoot(document.createElement('div'));
    let session!: ReturnType<typeof useFileSession>;
    const Harness = () => {
        session = useFileSession();
        return null;
    };
    const video = { id: 'video', file: new File(['video'], 'video.mkv', { lastModified: 1 }) };
    const pendingDescriptor = embeddedDescriptor(video, { trackIndex: 0, codec: 'subrip', outputFormat: 'srt' });
    const pending = {
        id: embeddedSubtitleId(video.id, 0),
        embedded: pendingDescriptor,
        file: new File([], 'video.track-1.srt'),
    };
    const online = { id: 'https://example.test/subtitle.srt', file: new File(['Downloaded'], 'online.srt') };
    const empty = {
        id: embeddedSubtitleId(video.id, 1),
        embedded: embeddedDescriptor(video, { trackIndex: 1, codec: 'subrip', outputFormat: 'srt' }),
        file: new File([], 'video.track-2.srt'),
    };
    const repository = new IndexedDBFileSessionRepository();
    const prepare = async () => {
        throw new Error('Completed session files must not need extraction');
    };
    try {
        await act(async () => root.render(<Harness />));
        await act(async () => {
            await session.saveSession({
                videoHandle: { id: video.id, handle: { name: video.file.name } as FileSystemFileHandle },
                subtitleHandles: [],
            });
            await session.saveSubtitleSelection(
                [{ fileParts: [pending] }, { fileParts: [online] }, { fileParts: [empty] }],
                new Set([pending.id])
            );
        });
        const saved = (await repository.fetch())!;
        expect(saved.subtitleTrackIds).toEqual([[], [online.id], [empty.id]]);
        expect(saved.cachedSubtitleFiles?.map(({ id }) => id)).toEqual([online.id, empty.id]);
        expect(saved.embeddedSubtitles).toEqual({ [empty.id]: empty.embedded });
        const restored = await restoreSessionFiles(saved, [video], prepare);
        expect(restored.files.map(({ id }) => id)).toEqual([video.id, '-', online.id, empty.id]);
        expect(restored.files[2].file.size).toBe(online.file.size);
        expect(restored.missingEmbeddedSubtitles).toEqual([]);

        const completed = { ...pending, file: new File(['Extracted'], pending.file.name) };
        await act(async () => {
            await session.saveSubtitleSelection(
                [{ fileParts: [completed] }, { fileParts: [online] }, { fileParts: [empty] }],
                new Set()
            );
        });
        const finished = await restoreSessionFiles((await repository.fetch())!, [video], prepare);
        expect(finished.files.map(({ id }) => id)).toEqual([video.id, pending.id, online.id, empty.id]);
        expect(finished.files[1].file.size).toBe(completed.file.size);
        expect(finished.missingEmbeddedSubtitles).toEqual([]);
    } finally {
        await act(async () => root.unmount());
        await repository.clear();
        if (originalPicker) Object.defineProperty(window, 'showOpenFilePicker', originalPicker);
        else Reflect.deleteProperty(window, 'showOpenFilePicker');
        if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
        else Reflect.deleteProperty(navigator, 'storage');
    }
});
