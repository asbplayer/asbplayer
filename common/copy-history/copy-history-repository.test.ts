import 'core-js/stable/structured-clone'; // fake-indexeddb requires structured clone polyfill
import 'fake-indexeddb/auto';
import { IndexedDBCopyHistoryRepository } from '@project/common/copy-history/copy-history-repository';
import { expect, it, beforeEach } from '@jest/globals';
import { SettingsProvider } from '@project/common/settings';
import { MockSettingsStorage } from '@project/common/settings/mock-settings-storage';

beforeEach(async () => {
    const settings = new SettingsProvider(new MockSettingsStorage());
    const repository = new IndexedDBCopyHistoryRepository(settings);
    await repository.clear();
});

const repositoryWithLimit = async (limit: number) => {
    const settings = new SettingsProvider(new MockSettingsStorage());
    await settings.set({ miningHistoryStorageLimit: limit });
    const repository = new IndexedDBCopyHistoryRepository(settings);
    return repository;
};

it('saves and fetches', async () => {
    const repository = await repositoryWithLimit(1);
    const item = {
        subtitle: { text: 'text', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
        id: 'id',
        timestamp: 1234,
        surroundingSubtitles: [],
        subtitleFileName: 'subtitle-file',
        mediaTimestamp: 5678,
    };
    await repository.save(item);
    const records = await repository.fetch(1);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject(item);
});

it('attempts to update existing record same ID', async () => {
    const repository = await repositoryWithLimit(1);
    const item = {
        subtitle: { text: 'text1', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
        id: 'id',
        timestamp: 1234,
        surroundingSubtitles: [],
        subtitleFileName: 'subtitle-file',
        mediaTimestamp: 5678,
    };
    await repository.save(item);
    await repository.save({ ...item, subtitle: { ...item.subtitle, text: 'text2' } });

    const records = await repository.fetch(2);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject({ ...item, subtitle: { ...item.subtitle, text: 'text2' } });
});

it('respects table size limit', async () => {
    const repository = await repositoryWithLimit(1);
    const item = {
        subtitle: { text: 'text', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
        id: 'id',
        timestamp: 1234,
        mediaTimestamp: 56789,
        surroundingSubtitles: [],
        subtitleFileName: 'subtitle-file',
    };
    await repository.save({ ...item, id: 'id1' });
    await repository.save({ ...item, id: 'id2' });
    const records = await repository.fetch(2);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject({ ...item, id: 'id2' });
});

it('respects fetch limit', async () => {
    const repository = await repositoryWithLimit(3);
    const item = {
        subtitle: { text: 'text', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
        id: 'id',
        timestamp: 1234,
        mediaTimestamp: 5678,
        surroundingSubtitles: [],
        subtitleFileName: 'subtitle-file',
    };
    await repository.save({ ...item, id: 'id1' });
    await repository.save({ ...item, id: 'id2' });
    await repository.save({ ...item, id: 'id3' });
    const records = await repository.fetch(2);
    expect(records.length).toEqual(2);
    expect(records[0]).toMatchObject({ ...item, id: 'id2' });
    expect(records[1]).toMatchObject({ ...item, id: 'id3' });
});

it('can filter by card ID and returns cards in correct order', async () => {
    const repository = await repositoryWithLimit(5);
    const item = {
        subtitle: { text: 'text', start: 0, end: 1, originalStart: 0, originalEnd: 1, track: 0 },
        id: 'id',
        timestamp: 1234,
        mediaTimestamp: 5678,
        surroundingSubtitles: [],
        subtitleFileName: 'subtitle-file',
    };
    await repository.save({ ...item, id: 'id1' });
    await repository.save({ ...item, id: 'id3' });
    await repository.save({ ...item, id: 'id2' });

    let records = await repository.fetch(3);
    expect(records[0]).toMatchObject({ ...item, id: 'id1' });
    expect(records[1]).toMatchObject({ ...item, id: 'id3' });
    expect(records[2]).toMatchObject({ ...item, id: 'id2' });

    records = await repository.fetch(2);
    expect(records[0]).toMatchObject({ ...item, id: 'id3' });
    expect(records[1]).toMatchObject({ ...item, id: 'id2' });

    records = await repository.fetch(1, ['id1', 'id2', 'id3']);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject({ ...item, id: 'id2' });

    records = await repository.fetch(2, ['id1', 'id2', 'id3']);
    expect(records.length).toEqual(2);
    expect(records[0]).toMatchObject({ ...item, id: 'id3' });
    expect(records[1]).toMatchObject({ ...item, id: 'id2' });

    records = await repository.fetch(1, ['id2']);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject({ ...item, id: 'id2' });

    records = await repository.fetch(1, ['id3']);
    expect(records.length).toEqual(1);
    expect(records[0]).toMatchObject({ ...item, id: 'id3' });

    records = await repository.fetch(1, ['id4']);
    expect(records.length).toEqual(0);

    records = await repository.fetch(1, []);
    expect(records.length).toEqual(0);
});

it('strips tokenization from subtitles', async () => {
    const repository = await repositoryWithLimit(5);
    const item = {
        subtitle: {
            text: 'text',
            start: 0,
            end: 1,
            originalStart: 0,
            originalEnd: 1,
            track: 0,
            tokenization: {
                tokens: [{ pos: [0, 2] as [number, number], states: [], readings: [] }],
            },
        },
        id: 'id',
        timestamp: 1234,
        mediaTimestamp: 5678,
        surroundingSubtitles: [
            {
                text: 'text',
                start: 0,
                end: 1,
                originalStart: 0,
                originalEnd: 1,
                track: 0,
                tokenization: {
                    tokens: [{ pos: [0, 2] as [number, number], states: [], readings: [] }],
                },
            },
        ],
        subtitleFileName: 'subtitle-file',
    };
    await repository.save(item);
    const fetched = (await repository.fetch(1))[0];
    expect(fetched.subtitle.tokenization).toBeUndefined();
    for (const s of fetched.surroundingSubtitles) {
        expect(s.tokenization).toBeUndefined();
    }
});
