import {
    CardExportedDialogMessage,
    CardUpdatedDialogMessage,
    DictionaryBuildAnkiCacheMessage,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateMessage,
    DictionaryGetAllTokensMessage,
    DictionaryGetRecordsMessage,
    DictionaryDBCommand,
    DictionaryDeleteRecordsMessage,
    DictionaryDeleteProfileMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryExportRecordLocalBulkMessage,
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionaryImportRecordLocalBulkMessage,
    DictionaryRequestStatisticsGenerationMessage,
    DictionaryRequestStatisticsSnapshotMessage,
    DictionaryRequestStatisticsMineSentencesMessage,
    DictionaryRequestStatisticsSeekMessage,
    DictionarySaveRecordLocalBulkMessage,
    DictionaryStatisticsMessage,
    DictionaryUpdateRecordsMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToVideoCommand,
    Message,
} from '@project/common';
import { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
import {
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
import { v4 as uuidv4 } from 'uuid';

type ExtensionDictionaryStatisticsCommand<T extends Message> =
    | ExtensionToAsbPlayerCommand<T>
    | ExtensionToVideoCommand<T>;

function isExtensionDictionaryStatisticsSender(sender: string) {
    return sender === 'asbplayer-extension-to-player' || sender === 'asbplayer-extension-to-video';
}

export class ExtensionDictionaryStorage implements DictionaryStorage {
    private buildAnkiCacheStateChangeCallbacks: ((message: DictionaryBuildAnkiCacheState) => void)[];
    private buildAnkiCacheStateChange?: (
        message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage>
    ) => void;
    private ankiCardModifiedCallbacks: (() => void)[];
    private ankiCardModified?: (
        message: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage>
    ) => void;
    private dictionaryStatisticsCallbacks: ((snapshot?: DictionaryStatisticsSnapshot) => void)[];
    private dictionaryStatisticsListener?: (
        message: ExtensionDictionaryStatisticsCommand<DictionaryStatisticsMessage>
    ) => void;
    private dictionaryStatisticsSnapshotRequestCallbacks: (() => void)[];
    private dictionaryStatisticsSnapshotRequestListener?: (
        message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSnapshotMessage>
    ) => void;
    private dictionaryStatisticsGenerationRequestCallbacks: (() => void)[];
    private dictionaryStatisticsGenerationRequestListener?: (
        message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsGenerationMessage>
    ) => void;
    private dictionaryStatisticsSeekCallbacks: ((timestamp: number) => void)[];
    private dictionaryStatisticsSeekListener?: (
        message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSeekMessage>
    ) => void;
    private dictionaryStatisticsMineSentencesCallbacks: ((mediaId: string, indexes: number[]) => void)[];
    private dictionaryStatisticsMineSentencesListener?: (
        message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsMineSentencesMessage>
    ) => void;

    constructor() {
        this.buildAnkiCacheStateChangeCallbacks = [];
        this.ankiCardModifiedCallbacks = [];
        this.dictionaryStatisticsCallbacks = [];
        this.dictionaryStatisticsSnapshotRequestCallbacks = [];
        this.dictionaryStatisticsGenerationRequestCallbacks = [];
        this.dictionaryStatisticsSeekCallbacks = [];
        this.dictionaryStatisticsMineSentencesCallbacks = [];
    }

    getBulk(profile: string | undefined, track: number, tokens: string[]) {
        const message: DictionaryDBCommand<DictionaryGetBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-bulk',
                profile,
                track,
                tokens,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    getAllTokens(profile: string | undefined, track: number) {
        const message: DictionaryDBCommand<DictionaryGetAllTokensMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-all-tokens',
                messageId: uuidv4(),
                profile,
                track,
            },
        };
        return browser.runtime.sendMessage(message);
    }

    getByLemmaBulk(profile: string | undefined, track: number, lemmas: string[]) {
        const message: DictionaryDBCommand<DictionaryGetByLemmaBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-by-lemma-bulk',
                profile,
                track,
                lemmas,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    saveRecordLocalBulk(
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ) {
        const message: DictionaryDBCommand<DictionarySaveRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-save-record-local-bulk',
                profile,
                localTokenInputs,
                applyStates,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    deleteRecordLocalBulk(profile: string | undefined, tokens: string[]) {
        const message: DictionaryDBCommand<DictionaryDeleteRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-delete-record-local-bulk',
                profile,
                tokens,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    deleteProfile(profile: string) {
        const message: DictionaryDBCommand<DictionaryDeleteProfileMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-delete-profile',
                profile,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    exportRecordLocalBulk() {
        const message: DictionaryDBCommand<DictionaryExportRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-export-record-local-bulk', messageId: uuidv4() },
        };
        return browser.runtime.sendMessage(message);
    }

    importRecordLocalBulk(records: Partial<DictionaryTokenRecord>[], profiles: string[]) {
        const message: DictionaryDBCommand<DictionaryImportRecordLocalBulkMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-import-record-local-bulk', messageId: uuidv4(), records, profiles },
        };
        return browser.runtime.sendMessage(message);
    }

    getRecords(profile: string | undefined, track: number | undefined): Promise<DictionaryRecordsResult> {
        const message: DictionaryDBCommand<DictionaryGetRecordsMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-get-records',
                messageId: uuidv4(),
                profile,
                track,
            },
        };
        return browser.runtime.sendMessage(message);
    }

    updateRecords(
        profile: string | undefined,
        updates: DictionaryRecordUpdateInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionaryRecordUpdateResult> {
        const message: DictionaryDBCommand<DictionaryUpdateRecordsMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-update-records',
                profile,
                updates,
                applyStates,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    deleteRecords(profile: string | undefined, tokenKeys: DictionaryTokenKey[]): Promise<DictionaryRecordDeleteResult> {
        const message: DictionaryDBCommand<DictionaryDeleteRecordsMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-delete-records',
                profile,
                tokenKeys,
                messageId: uuidv4(),
            },
        };
        return browser.runtime.sendMessage(message);
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings) {
        const message: DictionaryDBCommand<DictionaryBuildAnkiCacheMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-build-anki-cache', messageId: uuidv4(), profile, settings },
        };
        return browser.runtime.sendMessage(message);
    }

    ankiCardWasModified() {
        browser.runtime.sendMessage({
            sender: 'asbplayer-dictionary',
            message: { command: 'card-updated-dialog' },
        } as DictionaryDBCommand<CardUpdatedDialogMessage>);
    }

    onAnkiCardModified(callback: () => void) {
        this.ankiCardModifiedCallbacks.push(callback);
        if (!this.ankiCardModified) {
            this.ankiCardModified = (
                message: DictionaryDBCommand<CardUpdatedDialogMessage | CardExportedDialogMessage>
            ) => {
                if (message.sender !== 'asbplayer-dictionary') return;
                if (
                    message.message.command !== 'card-updated-dialog' &&
                    message.message.command !== 'card-exported-dialog'
                )
                    return;
                this.ankiCardModifiedCallbacks.forEach((c) => c());
            };
            browser.runtime.onMessage.addListener(this.ankiCardModified);
        }
        return () => {
            this._removeCallback(callback, this.ankiCardModifiedCallbacks);
            if (!this.ankiCardModifiedCallbacks.length && this.ankiCardModified) {
                browser.runtime.onMessage.removeListener(this.ankiCardModified);
                this.ankiCardModified = undefined;
            }
        };
    }

    onBuildAnkiCacheStateChange(callback: (message: DictionaryBuildAnkiCacheState) => void) {
        this.buildAnkiCacheStateChangeCallbacks.push(callback);
        if (!this.buildAnkiCacheStateChange) {
            this.buildAnkiCacheStateChange = (
                message: ExtensionToAsbPlayerCommand<DictionaryBuildAnkiCacheStateMessage>
            ) => {
                if (message.sender !== 'asbplayer-extension-to-player') return;
                if (message.message.command !== 'dictionary-build-anki-cache-state') return;
                this.buildAnkiCacheStateChangeCallbacks.forEach((c) => c(message.message));
            };
            browser.runtime.onMessage.addListener(this.buildAnkiCacheStateChange);
        }
        return () => {
            this._removeCallback(callback, this.buildAnkiCacheStateChangeCallbacks);
            if (!this.buildAnkiCacheStateChangeCallbacks.length && this.buildAnkiCacheStateChange) {
                browser.runtime.onMessage.removeListener(this.buildAnkiCacheStateChange);
                this.buildAnkiCacheStateChange = undefined;
            }
        };
    }

    publishStatisticsSnapshot(mediaId: string, snapshot?: DictionaryStatisticsSnapshot) {
        const message: DictionaryDBCommand<DictionaryStatisticsMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-statistics', mediaId, snapshot },
        };
        return browser.runtime.sendMessage(message);
    }

    onStatisticsSnapshot(callback: (snapshot?: DictionaryStatisticsSnapshot) => void) {
        this.dictionaryStatisticsCallbacks.push(callback);
        if (!this.dictionaryStatisticsListener) {
            this.dictionaryStatisticsListener = (
                message: ExtensionDictionaryStatisticsCommand<DictionaryStatisticsMessage>
            ) => {
                if (!isExtensionDictionaryStatisticsSender(message.sender)) return;
                if (message.message.command !== 'dictionary-statistics') return;
                this.dictionaryStatisticsCallbacks.forEach((listener) => listener(message.message.snapshot));
            };
            browser.runtime.onMessage.addListener(this.dictionaryStatisticsListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsCallbacks);
            if (!this.dictionaryStatisticsCallbacks.length && this.dictionaryStatisticsListener) {
                browser.runtime.onMessage.removeListener(this.dictionaryStatisticsListener);
                this.dictionaryStatisticsListener = undefined;
            }
        };
    }

    requestStatisticsSnapshot(mediaId?: string) {
        const message: DictionaryDBCommand<DictionaryRequestStatisticsSnapshotMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-request-statistics-snapshot', mediaId },
        };
        return browser.runtime.sendMessage(message);
    }

    onRequestStatisticsSnapshot(callback: () => void) {
        this.dictionaryStatisticsSnapshotRequestCallbacks.push(callback);
        if (!this.dictionaryStatisticsSnapshotRequestListener) {
            this.dictionaryStatisticsSnapshotRequestListener = (
                message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSnapshotMessage>
            ) => {
                if (!isExtensionDictionaryStatisticsSender(message.sender)) return;
                if (message.message.command !== 'dictionary-request-statistics-snapshot') return;
                this.dictionaryStatisticsSnapshotRequestCallbacks.forEach((listener) => listener());
            };
            browser.runtime.onMessage.addListener(this.dictionaryStatisticsSnapshotRequestListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsSnapshotRequestCallbacks);
            if (
                !this.dictionaryStatisticsSnapshotRequestCallbacks.length &&
                this.dictionaryStatisticsSnapshotRequestListener
            ) {
                browser.runtime.onMessage.removeListener(this.dictionaryStatisticsSnapshotRequestListener);
                this.dictionaryStatisticsSnapshotRequestListener = undefined;
            }
        };
    }

    requestStatisticsGeneration(mediaId?: string) {
        const message: DictionaryDBCommand<DictionaryRequestStatisticsGenerationMessage> = {
            sender: 'asbplayer-dictionary',
            message: { command: 'dictionary-request-statistics-generation', mediaId },
        };
        return browser.runtime.sendMessage(message);
    }

    onRequestStatisticsGeneration(callback: () => void) {
        this.dictionaryStatisticsGenerationRequestCallbacks.push(callback);
        if (!this.dictionaryStatisticsGenerationRequestListener) {
            this.dictionaryStatisticsGenerationRequestListener = (
                message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsGenerationMessage>
            ) => {
                if (!isExtensionDictionaryStatisticsSender(message.sender)) return;
                if (message.message.command !== 'dictionary-request-statistics-generation') return;
                this.dictionaryStatisticsGenerationRequestCallbacks.forEach((listener) => listener());
            };
            browser.runtime.onMessage.addListener(this.dictionaryStatisticsGenerationRequestListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsGenerationRequestCallbacks);
            if (
                !this.dictionaryStatisticsGenerationRequestCallbacks.length &&
                this.dictionaryStatisticsGenerationRequestListener
            ) {
                browser.runtime.onMessage.removeListener(this.dictionaryStatisticsGenerationRequestListener);
                this.dictionaryStatisticsGenerationRequestListener = undefined;
            }
        };
    }

    requestStatisticsSeek(mediaId: string, timestamp: number) {
        const message: DictionaryDBCommand<DictionaryRequestStatisticsSeekMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-request-statistics-seek',
                timestamp,
                mediaId,
            },
        };
        return browser.runtime.sendMessage(message);
    }

    onRequestStatisticsSeek(callback: (timestamp: number) => void) {
        this.dictionaryStatisticsSeekCallbacks.push(callback);
        if (!this.dictionaryStatisticsSeekListener) {
            this.dictionaryStatisticsSeekListener = (
                message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsSeekMessage>
            ) => {
                if (!isExtensionDictionaryStatisticsSender(message.sender)) return;
                if (message.message.command !== 'dictionary-request-statistics-seek') return;
                this.dictionaryStatisticsSeekCallbacks.forEach((listener) => listener(message.message.timestamp));
            };
            browser.runtime.onMessage.addListener(this.dictionaryStatisticsSeekListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsSeekCallbacks);
            if (!this.dictionaryStatisticsSeekCallbacks.length && this.dictionaryStatisticsSeekListener) {
                browser.runtime.onMessage.removeListener(this.dictionaryStatisticsSeekListener);
                this.dictionaryStatisticsSeekListener = undefined;
            }
        };
    }

    requestStatisticsMineSentences(mediaId: string, indexes: number[]) {
        const message: DictionaryDBCommand<DictionaryRequestStatisticsMineSentencesMessage> = {
            sender: 'asbplayer-dictionary',
            message: {
                command: 'dictionary-request-statistics-mine-sentences',
                mediaId,
                indexes,
            },
        };
        return browser.runtime.sendMessage(message);
    }

    onRequestStatisticsMineSentences(callback: (mediaId: string, indexes: number[]) => void) {
        this.dictionaryStatisticsMineSentencesCallbacks.push(callback);
        if (!this.dictionaryStatisticsMineSentencesListener) {
            this.dictionaryStatisticsMineSentencesListener = (
                message: ExtensionDictionaryStatisticsCommand<DictionaryRequestStatisticsMineSentencesMessage>
            ) => {
                if (!isExtensionDictionaryStatisticsSender(message.sender)) return;
                if (message.message.command !== 'dictionary-request-statistics-mine-sentences') return;
                this.dictionaryStatisticsMineSentencesCallbacks.forEach((listener) =>
                    listener(message.message.mediaId, message.message.indexes)
                );
            };
            browser.runtime.onMessage.addListener(this.dictionaryStatisticsMineSentencesListener);
        }
        return () => {
            this._removeCallback(callback, this.dictionaryStatisticsMineSentencesCallbacks);
            if (
                !this.dictionaryStatisticsMineSentencesCallbacks.length &&
                this.dictionaryStatisticsMineSentencesListener
            ) {
                browser.runtime.onMessage.removeListener(this.dictionaryStatisticsMineSentencesListener);
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
