import {
    DictionaryLocalTokenInput,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    DictionaryExportRecordLocalResult,
    DictionaryImportRecordLocalResult,
    LemmaResults,
    DictionarySaveRecordLocalResult,
    TokenResults,
    DictionaryDeleteRecordLocalResult,
    DictionaryDeleteProfileResult,
    DictionaryRecordDeleteResult,
    DictionaryRecordUpdateInput,
    DictionaryRecordUpdateResult,
    DictionaryRecordsResult,
} from '@project/common/dictionary-db';
import { DictionaryBuildAnkiCacheState } from '@project/common';
import { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
import { ApplyStrategy, AsbplayerSettings } from '@project/common/settings';
import { download, getCurrentTimeString } from '../util';

export interface DictionaryStorage {
    getBulk: (profile: string | undefined, track: number, tokens: string[]) => Promise<TokenResults>;
    getAllTokens: (profile: string | undefined, track: number) => Promise<TokenResults>;
    getByLemmaBulk: (profile: string | undefined, track: number, lemmas: string[]) => Promise<LemmaResults>;
    saveRecordLocalBulk: (
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ) => Promise<DictionarySaveRecordLocalResult>;
    deleteRecordLocalBulk: (
        profile: string | undefined,
        tokens: string[]
    ) => Promise<DictionaryDeleteRecordLocalResult>;
    deleteProfile: (profile: string) => Promise<DictionaryDeleteProfileResult>;
    exportRecordLocalBulk: () => Promise<DictionaryExportRecordLocalResult>;
    importRecordLocalBulk: (
        records: Partial<DictionaryTokenRecord>[],
        profiles: string[]
    ) => Promise<DictionaryImportRecordLocalResult>;
    getRecords: (profile: string | undefined, track: number | undefined) => Promise<DictionaryRecordsResult>;
    updateRecords: (
        profile: string | undefined,
        updates: DictionaryRecordUpdateInput[],
        applyStates: ApplyStrategy
    ) => Promise<DictionaryRecordUpdateResult>;
    deleteRecords: (
        profile: string | undefined,
        tokenKeys: DictionaryTokenKey[]
    ) => Promise<DictionaryRecordDeleteResult>;
    buildAnkiCache: (profile: string | undefined, settings: AsbplayerSettings) => Promise<void>;
    ankiCardWasModified: () => void;
    onAnkiCardModified: (callback: () => void) => () => void;
    onBuildAnkiCacheStateChange: (callback: (message: DictionaryBuildAnkiCacheState) => void) => () => void;
    publishStatisticsSnapshot: (mediaId: string, snapshot?: DictionaryStatisticsSnapshot) => Promise<void> | void;
    onStatisticsSnapshot: (callback: (snapshot?: DictionaryStatisticsSnapshot) => void) => () => void;
    requestStatisticsSnapshot: (mediaId?: string) => Promise<void> | void;
    onRequestStatisticsSnapshot: (callback: () => void) => () => void;
    requestStatisticsGeneration: (mediaId?: string) => Promise<void> | void;
    onRequestStatisticsGeneration: (callback: () => void) => () => void;
    requestStatisticsSeek: (mediaId: string, timestamp: number) => Promise<void> | void;
    onRequestStatisticsSeek: (callback: (timestamp: number) => void) => () => void;
    requestStatisticsMineSentences: (mediaId: string, indexes: number[]) => Promise<void> | void;
    onRequestStatisticsMineSentences: (callback: (mediaId: string, indexes: number[]) => void) => () => void;
    _removeCallback(callback: Function, callbacks: Function[]): void;
}

export class DictionaryProvider {
    private _storage: DictionaryStorage;

    constructor(storage: DictionaryStorage) {
        this._storage = storage;
    }

    getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return this._storage.getBulk(profile, track, tokens);
    }

    getAllTokens(profile: string | undefined, track: number) {
        return this._storage.getAllTokens(profile, track);
    }

    getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return this._storage.getByLemmaBulk(profile, track, lemmas);
    }

    saveRecordLocalBulk(
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ) {
        return this._storage.saveRecordLocalBulk(profile, localTokenInputs, applyStates);
    }

    deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return this._storage.deleteRecordLocalBulk(profile, tokens);
    }

    deleteProfile(profile: string) {
        return this._storage.deleteProfile(profile);
    }

    async exportRecordLocalBulk() {
        download(
            new Blob([JSON.stringify((await this._storage.exportRecordLocalBulk()).exportedRecords)], {
                type: 'application/json',
            }),
            `asbplayer-local-words-${getCurrentTimeString()}.json`
        );
    }

    importRecordLocalBulk(records: Partial<DictionaryTokenRecord>[], profiles: string[]) {
        return this._storage.importRecordLocalBulk(records, profiles);
    }

    getRecords(profile: string | undefined, track: number | undefined) {
        return this._storage.getRecords(profile, track);
    }

    updateRecords(profile: string | undefined, updates: DictionaryRecordUpdateInput[], applyStates: ApplyStrategy) {
        return this._storage.updateRecords(profile, updates, applyStates);
    }

    deleteRecords(profile: string | undefined, tokenKeys: DictionaryTokenKey[]) {
        return this._storage.deleteRecords(profile, tokenKeys);
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings) {
        return this._storage.buildAnkiCache(profile, settings);
    }

    ankiCardWasModified() {
        return this._storage.ankiCardWasModified();
    }

    onAnkiCardModified(callback: () => void) {
        return this._storage.onAnkiCardModified(callback);
    }

    onBuildAnkiCacheStateChange(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        return this._storage.onBuildAnkiCacheStateChange(callback);
    }

    publishStatisticsSnapshot(mediaId: string, snapshot?: DictionaryStatisticsSnapshot) {
        return this._storage.publishStatisticsSnapshot(mediaId, snapshot);
    }

    onStatisticsSnapshot(callback: (snapshot?: DictionaryStatisticsSnapshot) => void) {
        return this._storage.onStatisticsSnapshot(callback);
    }

    requestStatisticsSnapshot(mediaId?: string) {
        return this._storage.requestStatisticsSnapshot(mediaId);
    }

    onRequestStatisticsSnapshot(callback: () => void) {
        return this._storage.onRequestStatisticsSnapshot(callback);
    }

    requestStatisticsGeneration(mediaId?: string) {
        return this._storage.requestStatisticsGeneration(mediaId);
    }

    onRequestStatisticsGeneration(callback: () => void) {
        return this._storage.onRequestStatisticsGeneration(callback);
    }

    requestStatisticsSeek(mediaId: string, timestamp: number) {
        return this._storage.requestStatisticsSeek(mediaId, timestamp);
    }

    onRequestStatisticsSeek(callback: (timestamp: number) => void) {
        return this._storage.onRequestStatisticsSeek(callback);
    }

    requestStatisticsMineSentences(mediaId: string, indexes: number[]) {
        return this._storage.requestStatisticsMineSentences(mediaId, indexes);
    }

    onRequestStatisticsMineSentences(callback: (mediaId: string, indexes: number[]) => void) {
        return this._storage.onRequestStatisticsMineSentences(callback);
    }
}
