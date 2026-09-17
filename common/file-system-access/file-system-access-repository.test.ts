import 'core-js/stable/structured-clone'; // fake-indexeddb requires structured clone polyfill
import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from '@jest/globals';
import { IndexedDBFileSessionRepository } from '@project/common/file-system-access/file-system-access-repository';

beforeEach(async () => {
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

    await repository.retain(['selected']);

    const record = await repository.fetch();
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['selected']);
});

it('preserves cached online subtitles while clearing buffered local subtitle handles', async () => {
    const repository = new IndexedDBFileSessionRepository();
    await repository.setCachedSubtitleFiles([{ id: 'online', file: new File(['online'], 'online.ass') }]);

    await repository.clearBuffered();

    const record = await repository.fetch();
    expect(record?.cachedSubtitleFiles?.map((f) => f.id)).toEqual(['online']);
});
