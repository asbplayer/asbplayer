import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DictionaryBuildWaniKaniCacheStateErrorCode, DictionaryBuildWaniKaniCacheStateType } from '@project/common';
import { makeDictionaryTrack, makeStorage } from '@project/common/annotations/annotations-test-utils';
import { WaniKaniAnnotations } from '@project/common/annotations/wanikani-annotations';
import { DictionaryProvider } from '@project/common/dictionary-db';
import type { DictionaryStatisticsWaniKaniSnapshots } from '@project/common/dictionary-statistics';
import type { DictionaryTrack } from '@project/common/settings';

const waniKaniTrack = (token = 'token') =>
    makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryWaniKaniApiToken: token });

const makeSource = ({
    dictionaryTracks = [waniKaniTrack()],
    generateStatistics = true,
}: { dictionaryTracks?: DictionaryTrack[]; generateStatistics?: boolean } = {}) => {
    const storage = makeStorage();
    const tracks = dictionaryTracks.map((dt, track) => ({ track, dt }));
    const snapshots: DictionaryStatisticsWaniKaniSnapshots[] = [];
    const tokensWereModified = jest.fn();
    const source = new WaniKaniAnnotations({
        dictionaryProvider: new DictionaryProvider(storage as any),
        getProfile: () => 'Profile',
        getTracks: () => tracks,
        generateStatistics: () => generateStatistics,
        tokensWereModified,
        replaceStatisticsSnapshots: (snapshot) => snapshots.push(snapshot),
    });
    return { source, storage, tracks, snapshots, tokensWereModified };
};

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('WaniKaniAnnotations', () => {
    it('uses current tracks, refreshes invalidated statistics, and rebuilds its cache after reset', async () => {
        const { source, storage, tracks, snapshots, tokensWereModified } = makeSource({ dictionaryTracks: [] });

        await source.refresh();
        expect(storage.buildWaniKaniCache).not.toHaveBeenCalled();

        tracks.push({ track: 0, dt: waniKaniTrack() });
        await source.refresh();
        await source.refresh();
        expect(storage.buildWaniKaniCache).toHaveBeenCalledWith('Profile');
        expect(snapshots).toHaveLength(1);

        source.cacheStateChanged({
            type: DictionaryBuildWaniKaniCacheStateType.stats,
            body: { track: 0, modifiedTokens: ['word'] },
        });
        await source.refresh();
        expect(tokensWereModified).toHaveBeenCalledWith(['word']);
        expect(snapshots).toHaveLength(2);

        source.reset();
        await source.refresh();
        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(2);
        expect(snapshots).toHaveLength(3);
    });

    it('skips WaniKani when no enabled track has a non-blank API token', async () => {
        const { source, storage, snapshots } = makeSource({
            dictionaryTracks: [waniKaniTrack('   '), makeDictionaryTrack({ dictionaryWaniKaniApiToken: 'token' })],
        });

        await source.refresh();

        expect(storage.buildWaniKaniCache).not.toHaveBeenCalled();
        expect(snapshots).toEqual([]);
    });

    it('runs only one refresh at a time', async () => {
        const { source, storage } = makeSource();
        let finishBuild!: () => void;
        storage.buildWaniKaniCache.mockImplementationOnce(
            () => new Promise<undefined>((resolve) => (finishBuild = () => resolve(undefined)))
        );

        const first = source.refresh();
        await source.refresh();
        finishBuild();
        await first;

        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(1);
    });

    it('retries the cache build on the next refresh after it fails', async () => {
        const { source, storage } = makeSource();
        storage.buildWaniKaniCache.mockRejectedValueOnce(new Error('build failed'));

        await source.refresh();
        await source.refresh();
        await source.refresh();

        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(2);
    });

    it('refreshes statistics again after a token or Yomitan error but not after other errors', async () => {
        const { source, snapshots } = makeSource();
        await source.refresh();
        const error = (code: DictionaryBuildWaniKaniCacheStateErrorCode) => ({
            type: DictionaryBuildWaniKaniCacheStateType.error,
            body: { track: 0, code, msg: 'error', modifiedTokens: [] },
        });

        source.cacheStateChanged(error(DictionaryBuildWaniKaniCacheStateErrorCode.concurrentBuild));
        await source.refresh();
        expect(snapshots).toHaveLength(1);

        source.cacheStateChanged(error(DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken));
        await source.refresh();
        expect(snapshots).toHaveLength(2);
    });

    it('does not publish statistics unless generation is enabled', async () => {
        const { source, storage, snapshots } = makeSource({ generateStatistics: false });

        await source.refresh();

        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(1);
        expect(snapshots).toEqual([]);
    });

    it('refreshes when requested or after the polling interval elapses', async () => {
        let now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        const { source, storage } = makeSource({ generateStatistics: false });
        const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

        source.refreshIfDue();
        await flush();
        expect(storage.buildWaniKaniCache).not.toHaveBeenCalled();

        source.requestRefresh();
        source.refreshIfDue();
        await flush();
        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(1);

        source.reset();
        now += 10_000;
        source.refreshIfDue();
        await flush();
        expect(storage.buildWaniKaniCache).toHaveBeenCalledTimes(2);
    });
});
