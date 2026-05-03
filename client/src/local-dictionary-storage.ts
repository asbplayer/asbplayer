import {
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    DictionaryRequestStatisticsSnapshotMessage,
    DictionaryStatisticsMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryDBCommand,
    ExtensionToAsbPlayerCommand,
    DictionaryRequestStatisticsGenerationMessage,
    DictionaryRequestStatisticsMineSentencesMessage,
    DictionaryRequestStatisticsSeekMessage,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';
import { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
import {
    DictionaryDB,
    DictionaryLocalTokenInput,
    DictionaryStorage,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    DictionaryRecordDeleteResult,
    DictionaryRecordUpdateInput,
    DictionaryRecordUpdateResult,
    DictionaryRecordsResult,
} from '@project/common/dictionary-db';
import { ApplyStrategy, AsbplayerSettings } from '@project/common/settings';

type ExtensionDictionaryStatisticsCommand<T extends Message> =
    | ExtensionToAsbPlayerCommand<T>
    | ExtensionToVideoCommand<T>;

function isExtensionDictionaryStatisticsSender(sender: string) {
    return sender === 'asbplayer-extension-to-player' || sender === 'asbplayer-extension-to-video';
}

export class LocalDictionaryStorage implements DictionaryStorage {
    private readonly dictionaryDB: DictionaryDB;
    private buildAnkiCacheStateChangeCallbacks: ((message: DictionaryBuildAnkiCacheState) => void)[];
    private buildAnkiCacheStateChange?: (event: MessageEvent) => void;
    private ankiCardModifiedCallbacks: (() => void)[];
    private ankiCardModified?: (event: MessageEvent) => void;
    private dictionaryStatisticsCallbacks: ((snapshot?: DictionaryStatisticsSnapshot) => void)[];
    private dictionaryStatisticsListener?: (event: MessageEvent) => void;
    private dictionaryStatisticsSnapshotRequestCallbacks: (() => void)[];
    private dictionaryStatisticsSnapshotRequestListener?: (event: MessageEvent) => void;
    private dictionaryStatisticsGenerationRequestCallbacks: (() => void)[];
    private dictionaryStatisticsGenerationRequestListener?: (event: MessageEvent) => void;
    private dictionaryStatisticsSeekCallbacks: ((timestamp: number) => void)[];
    private dictionaryStatisticsSeekListener?: (event: MessageEvent) => void;
    private dictionaryStatisticsMineSentencesCallbacks: ((mediaId: string, indexes: number[]) => void)[];
    private dictionaryStatisticsMineSentencesListener?: (event: MessageEvent) => void;

    constructor() {
        this.dictionaryDB = new DictionaryDB();
        this.buildAnkiCacheStateChangeCallbacks = [];
        this.ankiCardModifiedCallbacks = [];
        this.dictionaryStatisticsCallbacks = [];
        this.dictionaryStatisticsSnapshotRequestCallbacks = [];
        this.dictionaryStatisticsGenerationRequestCallbacks = [];
        this.dictionaryStatisticsSeekCallbacks = [];
        this.dictionaryStatisticsMineSentencesCallbacks = [];
    }

    getBulk(profile: string | undefined, track: number, tokens: string[]) {
        return this.dictionaryDB.getBulk(profile, track, tokens);
    }

    getAllTokens(profile: string | undefined, track: number) {
        return this.dictionaryDB.getAllTokens(profile, track);
    }

    getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        return this.dictionaryDB.getByLemmaBulk(profile, track, lemmas);
    }

    saveRecordLocalBulk(
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ) {
        return this.dictionaryDB.saveRecordLocalBulk(profile, localTokenInputs, applyStates);
    }

    deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        return this.dictionaryDB.deleteRecordLocalBulk(profile, tokens);
    }

    deleteProfile(profile: string) {
        return this.dictionaryDB.deleteProfile(profile);
    }

    exportRecordLocalBulk() {
        return this.dictionaryDB.exportRecordLocalBulk();
    }

    importRecordLocalBulk(records: Partial<DictionaryTokenRecord>[], profiles: string[]) {
        return this.dictionaryDB.importRecordLocalBulk(records, profiles);
    }

    getRecords(profile: string | undefined, track: number | undefined): Promise<DictionaryRecordsResult> {
        return this.dictionaryDB.getRecords(profile, track);
    }

    updateRecords(
        profile: string | undefined,
        updates: DictionaryRecordUpdateInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionaryRecordUpdateResult> {
        return this.dictionaryDB.updateRecords(profile, updates, applyStates);
    }

    deleteRecords(profile: string | undefined, tokenKeys: DictionaryTokenKey[]): Promise<DictionaryRecordDeleteResult> {
        return this.dictionaryDB.deleteRecords(profile, tokenKeys);
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings) {
        return this.dictionaryDB.buildAnkiCache(profile, settings, (state: DictionaryBuildAnkiCacheState) => {
            const message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage> = {
                sender: 'asbplayer-extension-to-player',
                message: { command: 'dictionary-build-anki-cache-state', ...state },
            };
            window.parent.postMessage(message);
        });
    }

    ankiCardWasModified() {
        window.parent.postMessage({
            sender: 'asbplayer-dictionary',
            message: { command: 'card-updated-dialog' },
        } as DictionaryDBCommand<CardUpdatedDialogMessage>);
    }

    onAnkiCardModified(callback: () => void) {
        this.ankiCardModifiedCallbacks.push(callback);
        if (!this.ankiCardModified) {
            this.ankiCardModified = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage> = event.data;
                if (data.sender !== 'asbplayer-dictionary') return;
                if (data.message.command !== 'card-updated-dialog' && data.message.command !== 'card-exported-dialog') {
                    return;
                }
                this.ankiCardModifiedCallbacks.forEach((c) => c());
            };
            window.parent.addEventListener('message', this.ankiCardModified);
        }
        return () => {
            this._removeCallback(callback, this.ankiCardModifiedCallbacks);
            if (!this.ankiCardModifiedCallbacks.length && this.ankiCardModified) {
                window.parent.removeEventListener('message', this.ankiCardModified);
                this.ankiCardModified = undefined;
            }
        };
    }

    onBuildAnkiCacheStateChange(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this.buildAnkiCacheStateChangeCallbacks.push(callback);
        if (!this.buildAnkiCacheStateChange) {
            this.buildAnkiCacheStateChange = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage> = event.data;
                if (data.sender !== 'asbplayer-extension-to-player') return;
                if (data.message.command !== 'dictionary-build-anki-cache-state') return;
                this.buildAnkiCacheStateChangeCallbacks.forEach((c) => c(data.message));
            };
            window.parent.addEventListener('message', this.buildAnkiCacheStateChange);
        }
        return () => {
            this._removeCallback(callback, this.buildAnkiCacheStateChangeCallbacks);
            if (!this.buildAnkiCacheStateChangeCallbacks.length && this.buildAnkiCacheStateChange) {
                window.parent.removeEventListener('message', this.buildAnkiCacheStateChange);
                this.buildAnkiCacheStateChange = undefined;
            }
        };
    }

    publishStatisticsSnapshot(mediaId: string, snapshot?: DictionaryStatisticsSnapshot) {
        const message: ExtensionToAsbPlayerCommand<DictionaryStatisticsMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: { command: 'dictionary-statistics', mediaId, snapshot },
        };
        window.parent.postMessage(message);
    }

    onStatisticsSnapshot(callback: (snapshot?: DictionaryStatisticsSnapshot) => void) {
        this.dictionaryStatisticsCallbacks.push(callback);
        if (!this.dictionaryStatisticsListener) {
            this.dictionaryStatisticsListener = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionDictionaryStatisticsCommand<DictionaryStatisticsMessage> = event.data;
                if (!isExtensionDictionaryStatisticsSender(data.sender)) return;
                if (data.message.command !== 'dictionary-statistics') return;
                this.dictionaryStatisticsCallbacks.forEach((listener) => listener(data.message.snapshot));
            };
            window.parent.addEventListener('message', this.dictionaryStatisticsListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsCallbacks);
            if (!this.dictionaryStatisticsCallbacks.length && this.dictionaryStatisticsListener) {
                window.parent.removeEventListener('message', this.dictionaryStatisticsListener);
                this.dictionaryStatisticsListener = undefined;
            }
        };
    }

    requestStatisticsSnapshot(mediaId?: string) {
        const message: ExtensionToAsbPlayerCommand<DictionaryRequestStatisticsSnapshotMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: { command: 'dictionary-request-statistics-snapshot', mediaId },
        };
        window.parent.postMessage(message);
    }

    onRequestStatisticsSnapshot(callback: () => void) {
        this.dictionaryStatisticsSnapshotRequestCallbacks.push(callback);
        if (!this.dictionaryStatisticsSnapshotRequestListener) {
            this.dictionaryStatisticsSnapshotRequestListener = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSnapshotMessage> =
                    event.data;
                if (!isExtensionDictionaryStatisticsSender(data.sender)) return;
                if (data.message.command !== 'dictionary-request-statistics-snapshot') return;
                this.dictionaryStatisticsSnapshotRequestCallbacks.forEach((listener) => listener());
            };
            window.parent.addEventListener('message', this.dictionaryStatisticsSnapshotRequestListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsSnapshotRequestCallbacks);
            if (
                !this.dictionaryStatisticsSnapshotRequestCallbacks.length &&
                this.dictionaryStatisticsSnapshotRequestListener
            ) {
                window.parent.removeEventListener('message', this.dictionaryStatisticsSnapshotRequestListener);
                this.dictionaryStatisticsSnapshotRequestListener = undefined;
            }
        };
    }

    requestStatisticsGeneration(mediaId?: string) {
        const message: ExtensionToAsbPlayerCommand<DictionaryRequestStatisticsGenerationMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: { command: 'dictionary-request-statistics-generation', mediaId },
        };
        window.parent.postMessage(message);
    }

    onRequestStatisticsGeneration(callback: () => void) {
        this.dictionaryStatisticsGenerationRequestCallbacks.push(callback);
        if (!this.dictionaryStatisticsGenerationRequestListener) {
            this.dictionaryStatisticsGenerationRequestListener = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsGenerationMessage> =
                    event.data;
                if (!isExtensionDictionaryStatisticsSender(data.sender)) return;
                if (data.message.command !== 'dictionary-request-statistics-generation') return;
                this.dictionaryStatisticsGenerationRequestCallbacks.forEach((listener) => listener());
            };
            window.parent.addEventListener('message', this.dictionaryStatisticsGenerationRequestListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsGenerationRequestCallbacks);
            if (
                !this.dictionaryStatisticsGenerationRequestCallbacks.length &&
                this.dictionaryStatisticsGenerationRequestListener
            ) {
                window.parent.removeEventListener('message', this.dictionaryStatisticsGenerationRequestListener);
                this.dictionaryStatisticsGenerationRequestListener = undefined;
            }
        };
    }

    requestStatisticsSeek(mediaId: string, timestamp: number) {
        const message: ExtensionToAsbPlayerCommand<DictionaryRequestStatisticsSeekMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'dictionary-request-statistics-seek',
                mediaId,
                timestamp,
            },
        };
        window.parent.postMessage(message);
    }

    onRequestStatisticsSeek(callback: (timestamp: number) => void) {
        this.dictionaryStatisticsSeekCallbacks.push(callback);
        if (!this.dictionaryStatisticsSeekListener) {
            this.dictionaryStatisticsSeekListener = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSeekMessage> = event.data;
                if (!isExtensionDictionaryStatisticsSender(data.sender)) return;
                if (data.message.command !== 'dictionary-request-statistics-seek') return;
                this.dictionaryStatisticsSeekCallbacks.forEach((listener) => listener(data.message.timestamp));
            };
            window.parent.addEventListener('message', this.dictionaryStatisticsSeekListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsSeekCallbacks);
            if (!this.dictionaryStatisticsSeekCallbacks.length && this.dictionaryStatisticsSeekListener) {
                window.parent.removeEventListener('message', this.dictionaryStatisticsSeekListener);
                this.dictionaryStatisticsSeekListener = undefined;
            }
        };
    }

    requestStatisticsMineSentences(mediaId: string, indexes: number[]) {
        const message: ExtensionToAsbPlayerCommand<DictionaryRequestStatisticsMineSentencesMessage> = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'dictionary-request-statistics-mine-sentences',
                mediaId,
                indexes,
            },
        };
        window.parent.postMessage(message);
    }

    onRequestStatisticsMineSentences(callback: (mediaId: string, indexes: number[]) => void) {
        this.dictionaryStatisticsMineSentencesCallbacks.push(callback);
        if (!this.dictionaryStatisticsMineSentencesListener) {
            this.dictionaryStatisticsMineSentencesListener = (event: MessageEvent) => {
                if (event.type !== 'message') return;
                const data: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsMineSentencesMessage> =
                    event.data;
                if (!isExtensionDictionaryStatisticsSender(data.sender)) return;
                if (data.message.command !== 'dictionary-request-statistics-mine-sentences') return;
                this.dictionaryStatisticsMineSentencesCallbacks.forEach((listener) =>
                    listener(data.message.mediaId, data.message.indexes)
                );
            };
            window.parent.addEventListener('message', this.dictionaryStatisticsMineSentencesListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsMineSentencesCallbacks);
            if (
                !this.dictionaryStatisticsMineSentencesCallbacks.length &&
                this.dictionaryStatisticsMineSentencesListener
            ) {
                window.parent.removeEventListener('message', this.dictionaryStatisticsMineSentencesListener);
                this.dictionaryStatisticsMineSentencesListener = undefined;
            }
        };
    }

    _removeCallback(callback: Function, callbacks: Function[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }
}
