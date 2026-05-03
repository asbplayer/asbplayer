import {
    AsbPlayerCommand,
    AsbPlayerToVideoCommandV2,
    AsbplayerInstance,
    CardModel,
    DictionaryRequestStatisticsGenerationMessage,
    DictionaryRequestStatisticsSnapshotMessage,
    DictionaryRequestStatisticsMineSentencesMessage,
    DictionaryRequestStatisticsSeekMessage,
    DictionaryStatisticsMessage,
    ExtensionToAsbPlayerCommand,
    ExtensionToAsbPlayerCommandTabsCommand,
    GetSettingsMessage,
    Message,
    MessageWithId,
    ToggleSidePanelMessage,
    PublishCardMessage,
    SetSettingsMessage,
    SettingsUpdatedMessage,
    VideoTabModel,
    AsbplayerHeartbeatMessage,
    GetActiveProfileMessage,
    SetActiveProfileMessage,
    GetProfilesMessage,
    AddProfileMessage,
    RemoveProfileMessage,
    RequestSubtitlesFromAppMessage,
    LoadSubtitlesMessage,
    RequestCopyHistoryMessage,
    RequestCopyHistoryResponse,
    DeleteCopyHistoryMessage,
    CopyHistoryItem,
    SaveCopyHistoryMessage,
    ClearCopyHistoryMessage,
    SetGlobalStateMessage,
    GetGlobalStateMessage,
    DictionaryBuildAnkiCacheMessage,
    DictionaryGetAllTokensMessage,
    DictionaryGetRecordsMessage,
    DictionaryGetBulkMessage,
    DictionaryGetByLemmaBulkMessage,
    DictionarySaveRecordLocalBulkMessage,
    DictionaryDeleteRecordLocalBulkMessage,
    DictionaryDeleteRecordsMessage,
    DictionaryDeleteProfileMessage,
    DictionaryExportRecordLocalBulkMessage,
    DictionaryImportRecordLocalBulkMessage,
    DictionaryUpdateRecordsMessage,
    CardUpdatedDialogMessage,
    CardExportedDialogMessage,
    SaveTokenLocalFromAppMessage,
    SidePanelLocation,
    AckTabsMessage,
    BrowserFeatures,
} from '@project/common';
import { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
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
import {
    ApplyStrategy,
    AsbplayerSettings,
    PageSettings,
    Profile,
    SettingsFormPageConfig,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { GlobalState } from '@project/common/global-state';
import { v4 as uuidv4 } from 'uuid';
import gte from 'semver/functions/gte';
import gt from 'semver/functions/gt';
import { isFirefox } from '../../browser-detection';
import { isMobile } from 'react-device-detect';

export interface ExtensionMessage {
    data: Message;
    tabId?: number;
    src?: string;
}

const id = uuidv4();

export default class ChromeExtension {
    readonly version: string;
    readonly extensionCommands: { [key: string]: string | undefined };
    readonly pageConfig?: { [K in keyof PageSettings]: SettingsFormPageConfig };
    readonly browserFeatures?: BrowserFeatures;

    tabs: VideoTabModel[] | undefined;
    asbplayers: AsbplayerInstance[] | undefined;
    installed: boolean;
    sidePanel: boolean;
    sidePanelAppRequestedLocation?: SidePanelLocation;
    videoPlayer: boolean | undefined;
    syncedVideoElement: VideoTabModel | undefined;
    loadedSubtitles: boolean = false;

    private readonly windowEventListener: (event: MessageEvent) => void;
    private readonly _responseResolves: { [key: string]: (value: any) => void } = {};
    private onMessageCallbacks: Array<(message: ExtensionMessage) => void>;
    private onTabsCallbacks: Array<(tabs: VideoTabModel[]) => void>;
    private heartbeatInterval?: NodeJS.Timeout;

    constructor(
        version?: string,
        extensionCommands?: { [key: string]: string | undefined },
        pageConfig?: { [K in keyof PageSettings]: SettingsFormPageConfig },
        browserFeatures?: BrowserFeatures
    ) {
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
        this.installed = version !== undefined;
        this.version = version ?? '';
        this.extensionCommands = extensionCommands ?? {};
        this.pageConfig = pageConfig;
        this.browserFeatures = browserFeatures;
        this.sidePanel = false;
        this.windowEventListener = (event: MessageEvent) => {
            if (event.source !== window) {
                return;
            }

            if (event.data.sender !== 'asbplayer-extension-to-player' || !event.data.message) {
                return;
            }

            if (event.data.asbplayerId && event.data.asbplayerId !== id) {
                return;
            }

            if (typeof event.data.message.messageId === 'string') {
                const messageId = event.data.message.messageId;

                if (messageId in this._responseResolves) {
                    this._responseResolves[messageId]?.(event.data.message.response);
                    delete this._responseResolves[messageId];
                }
            }

            if (event.data.message.command === 'tabs') {
                const tabsCommand = event.data as ExtensionToAsbPlayerCommandTabsCommand;
                this.tabs = tabsCommand.message.tabs;
                this.asbplayers = tabsCommand.message.asbplayers;

                for (let c of this.onTabsCallbacks) {
                    c(this.tabs);
                }

                if (tabsCommand.message.ackRequested) {
                    let ackTabsMessage: AckTabsMessage = {
                        command: 'ackTabs',
                        id: id,
                        receivedTabs: this.tabs,
                        sidePanel: this.sidePanel,
                        sidePanelAppRequestedLocation: this.sidePanelAppRequestedLocation,
                        loadedSubtitles: this.loadedSubtitles,
                        syncedVideoElement: this.syncedVideoElement,
                        videoPlayer: this.videoPlayer ?? false,
                    };
                    window.postMessage({
                        sender: 'asbplayerv2',
                        message: ackTabsMessage,
                    });
                }
            } else {
                const command = event.data as ExtensionToAsbPlayerCommand<Message>;
                for (let c of this.onMessageCallbacks) {
                    c({
                        data: command.message,
                        tabId: command.tabId,
                        src: command.src,
                    });
                }
            }
        };

        window.addEventListener('message', this.windowEventListener);
    }

    get supportsDictionaryBrowser() {
        return this.installed && gte(this.version, '1.16.0');
    }

    get supportsDictionaryStatistics() {
        return this.installed && gte(this.version, '1.16.0');
    }

    get supportsDictionaryYomitanMecab() {
        return this.installed && gte(this.version, '1.15.0');
    }

    get supportsDictionaryTokenStatusDisplayAlpha() {
        return this.installed && gte(this.version, '1.15.0');
    }

    get supportsDictionary() {
        return this.installed && gte(this.version, '1.14.0');
    }

    get supportsPageSettings() {
        return this.installed && gte(this.version, '1.12.0');
    }

    get supportsExportCardBind() {
        return this.installed && gte(this.version, '1.10.0');
    }

    get supportsGlobalState() {
        return this.installed && gte(this.version, '1.9.0');
    }

    get supportsLastSelectedAnkiExportModeSetting() {
        return this.installed && gte(this.version, '1.9.0');
    }

    get supportsCopyHistoryRequest() {
        return this.installed && gte(this.version, '1.7.0');
    }

    get supportsLandingPageStreamingVideoElementSelector() {
        return this.installed && gte(this.version, '1.6.0');
    }

    get supportsPauseOnHover() {
        return this.installed && gte(this.version, '1.4.0');
    }

    get supportsSubtitlesWidthSetting() {
        return this.installed && gte(this.version, '1.4.0');
    }

    get supportsOrderableAnkiFields() {
        return this.installed && gte(this.version, '1.3.0');
    }

    get supportsTrackSpecificSettings() {
        return this.installed && gte(this.version, '1.3.0');
    }

    get supportsSettingsProfiles() {
        return this.installed && gte(this.version, '1.3.0');
    }

    get supportsStreamingVideoOverlay() {
        return this.installed && gte(this.version, '1.1.0');
    }

    get supportsSidePanel() {
        return (
            this.installed &&
            (this.browserFeatures?.sidePanel ?? false) &&
            ((!isFirefox && !isMobile && gte(this.version, '1.0.0')) ||
                (isFirefox && !isMobile && gte(this.version, '1.14.0')))
        );
    }

    get supportsAppIntegration() {
        return this.installed && gte(this.version, '1.0.0');
    }

    get supportsWebSocketClient() {
        return this.installed && gte(this.version, '1.1.0');
    }

    get supportsVideoPlayerMiningCommands() {
        return this.installed && gte(this.version, '1.0.0');
    }

    get supportsPlaybackRateMessage() {
        return this.installed && gte(this.version, '0.24.0');
    }

    get supportsOffsetMessage() {
        return this.installed && gte(this.version, '0.23.0');
    }

    get id() {
        return id;
    }

    startHeartbeat() {
        if (!this.installed) {
            return;
        }

        if (this.heartbeatInterval !== undefined) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        if (this.videoPlayer) {
            if (gt(this.version, '0.23.0')) {
                this._sendHeartbeat(true, this.loadedSubtitles, undefined);
                this.heartbeatInterval = setInterval(
                    () => this._sendHeartbeat(true, this.loadedSubtitles, this.syncedVideoElement),
                    1000
                );
            }
        } else {
            this._sendHeartbeat(false, this.loadedSubtitles, this.syncedVideoElement);
            this.heartbeatInterval = setInterval(
                () => this._sendHeartbeat(false, this.loadedSubtitles, this.syncedVideoElement),
                1000
            );
        }
    }

    private _sendHeartbeat(
        fromVideoPlayer: boolean,
        loadedSubtitles: boolean,
        syncedVideoElement: VideoTabModel | undefined
    ) {
        const message: AsbplayerHeartbeatMessage = {
            command: 'heartbeat',
            id: id,
            receivedTabs: fromVideoPlayer ? [] : this.tabs,
            videoPlayer: fromVideoPlayer,
            sidePanel: this.sidePanel,
            sidePanelAppRequestedLocation: this.sidePanelAppRequestedLocation,
            loadedSubtitles,
            syncedVideoElement,
        };
        window.postMessage({
            sender: 'asbplayerv2',
            message,
        });
    }

    openShortcuts() {
        window.postMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'open-extension-shortcuts',
            },
        });
    }

    sendMessageToVideoElement(message: Message, tabId: number, src: string, callback?: (response: any) => void) {
        let command: AsbPlayerToVideoCommandV2<Message> | AsbPlayerToVideoCommandV2<MessageWithId>;

        if (callback === undefined) {
            command = {
                sender: 'asbplayerv2',
                message,
                tabId: tabId,
                src: src,
            };
            window.postMessage(command);
        } else {
            const messageId = uuidv4();
            command = {
                sender: 'asbplayerv2',
                message: { ...message, messageId },
                tabId: tabId,
                src: src,
            };
            window.postMessage(command);
            this._createResponsePromise(messageId).then(callback);
        }
    }

    notifySettingsUpdated() {
        const command: AsbPlayerCommand<SettingsUpdatedMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'settings-updated',
            },
            asbplayerId: id,
        };
        window.postMessage(command);
    }

    toggleSidePanel(location?: SidePanelLocation) {
        const command: AsbPlayerCommand<ToggleSidePanelMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'toggle-side-panel',
                location,
            },
        };
        window.postMessage(command);
    }

    publishCard(card: CardModel) {
        const command: AsbPlayerCommand<PublishCardMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'publish-card',
                ...card,
            },
        };
        window.postMessage(command);
    }

    cardUpdatedDialog(tabId: number, src: string) {
        const command: AsbPlayerToVideoCommandV2<CardUpdatedDialogMessage> = {
            sender: 'asbplayerv2',
            tabId,
            src,
            message: {
                command: 'card-updated-dialog',
            },
        };
        window.postMessage(command);
    }

    cardExportedDialog(tabId: number, src: string) {
        const command: AsbPlayerToVideoCommandV2<CardExportedDialogMessage> = {
            sender: 'asbplayerv2',
            tabId,
            src,
            message: {
                command: 'card-exported-dialog',
            },
        };
        window.postMessage(command);
    }

    requestSubtitles(tabId: number, src: string) {
        const messageId = uuidv4();
        const command: AsbPlayerToVideoCommandV2<RequestSubtitlesFromAppMessage> = {
            sender: 'asbplayerv2',
            tabId,
            src,
            message: {
                command: 'request-subtitles',
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    saveTokenLocal(
        tabId: number,
        src: string,
        track: number,
        token: string,
        status: TokenStatus | null,
        states: TokenState[],
        applyStates: ApplyStrategy
    ) {
        const messageId = uuidv4();
        const command: AsbPlayerToVideoCommandV2<SaveTokenLocalFromAppMessage> = {
            sender: 'asbplayerv2',
            tabId,
            src,
            message: {
                command: 'save-token-local',
                track,
                token,
                status,
                states,
                applyStates,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    requestCopyHistory(count: number) {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<RequestCopyHistoryMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'request-copy-history',
                count,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId) as Promise<RequestCopyHistoryResponse>;
    }

    deleteCopyHistory(id: string) {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DeleteCopyHistoryMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'delete-copy-history',
                ids: [id],
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId) as Promise<void>;
    }

    saveCopyHistory(copyHistoryItem: CopyHistoryItem) {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<SaveCopyHistoryMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'save-copy-history',
                copyHistoryItems: [copyHistoryItem],
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId) as Promise<void>;
    }

    clearCopyHistory() {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<ClearCopyHistoryMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'clear-copy-history',
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId) as Promise<void>;
    }

    loadSubtitles(tabId: number, src: string) {
        const command: AsbPlayerToVideoCommandV2<LoadSubtitlesMessage> = {
            sender: 'asbplayerv2',
            tabId,
            src,
            message: { command: 'load-subtitles', fromAsbplayerId: id },
        };
        window.postMessage(command);
    }

    getSettings(keysAndDefaults: Partial<AsbplayerSettings>): Promise<Partial<AsbplayerSettings>> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetSettingsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'get-settings',
                keysAndDefaults,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    setSettings(settings: Partial<AsbplayerSettings>): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<SetSettingsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'set-settings',
                settings,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId).then(() => this.notifySettingsUpdated());
    }

    getGlobalState(): Promise<GlobalState> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetGlobalStateMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'get-global-state',
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    getSomeGlobalState<K extends keyof GlobalState>(keys: K[]): Promise<Pick<GlobalState, K>> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetGlobalStateMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'get-global-state',
                keys,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    setGlobalState(state: Partial<GlobalState>): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<SetGlobalStateMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'set-global-state',
                state,
                messageId,
            },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    activeSettingsProfile(): Promise<Profile | undefined> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetActiveProfileMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'get-active-profile', messageId },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    setActiveSettingsProfile(name: string | undefined): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<SetActiveProfileMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'set-active-profile', name, messageId },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId).then(() => this.notifySettingsUpdated());
    }

    settingsProfiles(): Promise<Profile[]> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<GetProfilesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'get-profiles', messageId },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    addSettingsProfile(name: string): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<AddProfileMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'add-profile', name, messageId },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    removeSettingsProfile(name: string): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<RemoveProfileMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'remove-profile', name, messageId },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId);
    }

    async dictionaryGetBulk(profile: string | undefined, track: number, tokens: string[]): Promise<TokenResults> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryGetBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-get-bulk',
                profile,
                track,
                tokens,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryGetAllTokens(profile: string | undefined, track: number): Promise<TokenResults> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryGetAllTokensMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-get-all-tokens',
                profile,
                track,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryGetByLemmaBulk(
        profile: string | undefined,
        track: number,
        lemmas: string[]
    ): Promise<LemmaResults> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryGetByLemmaBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-get-by-lemma-bulk',
                profile,
                track,
                lemmas,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionarySaveRecordLocalBulk(
        profile: string | undefined,
        localTokenInputs: DictionaryLocalTokenInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionarySaveRecordLocalResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionarySaveRecordLocalBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-save-record-local-bulk',
                profile,
                localTokenInputs,
                applyStates,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryDeleteRecordLocalBulk(
        profile: string | undefined,
        tokens: string[]
    ): Promise<DictionaryDeleteRecordLocalResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryDeleteRecordLocalBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-delete-record-local-bulk',
                profile,
                tokens,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryDeleteProfile(profile: string): Promise<DictionaryDeleteProfileResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryDeleteProfileMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-delete-profile',
                profile,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryExportRecordLocalBulk(): Promise<DictionaryExportRecordLocalResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryExportRecordLocalBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-export-record-local-bulk',
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryImportRecordLocalBulk(
        records: Partial<DictionaryTokenRecord>[],
        profiles: string[]
    ): Promise<DictionaryImportRecordLocalResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryImportRecordLocalBulkMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-import-record-local-bulk',
                records,
                profiles,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId);
    }

    async dictionaryGetRecords(
        profile: string | undefined,
        track: number | undefined
    ): Promise<DictionaryRecordsResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryGetRecordsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-get-records',
                profile,
                track,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId, 60000); // Usually a few seconds
    }

    async dictionaryUpdateRecords(
        profile: string | undefined,
        updates: DictionaryRecordUpdateInput[],
        applyStates: ApplyStrategy
    ): Promise<DictionaryRecordUpdateResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryUpdateRecordsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-update-records',
                profile,
                updates,
                applyStates,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId, 60000); // Usually a few seconds
    }

    async dictionaryDeleteRecords(
        profile: string | undefined,
        tokenKeys: DictionaryTokenKey[]
    ): Promise<DictionaryRecordDeleteResult> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryDeleteRecordsMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-delete-records',
                profile,
                tokenKeys,
                messageId,
            },
        };
        window.postMessage(command);
        return await this._createResponsePromise(messageId, 60000); // Usually a few seconds
    }

    buildAnkiCache(profile: string | undefined, settings: AsbplayerSettings): Promise<void> {
        const messageId = uuidv4();
        const command: AsbPlayerCommand<DictionaryBuildAnkiCacheMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'dictionary-build-anki-cache', messageId, profile, settings },
        };
        window.postMessage(command);
        return this._createResponsePromise(messageId, 60000); // Usually <10s
    }

    publishStatisticsSnapshot(mediaId: string, snapshot?: DictionaryStatisticsSnapshot) {
        const command: AsbPlayerCommand<DictionaryStatisticsMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'dictionary-statistics', mediaId, snapshot },
        };
        window.postMessage(command);
    }

    requestStatisticsSnapshot(mediaId?: string) {
        const command: AsbPlayerCommand<DictionaryRequestStatisticsSnapshotMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'dictionary-request-statistics-snapshot', mediaId },
        };
        window.postMessage(command);
    }

    requestStatisticsGeneration(mediaId?: string) {
        const command: AsbPlayerCommand<DictionaryRequestStatisticsGenerationMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'dictionary-request-statistics-generation', mediaId },
        };
        window.postMessage(command);
    }

    requestStatisticsSeek(mediaId: string, timestamp: number) {
        const command: AsbPlayerCommand<DictionaryRequestStatisticsSeekMessage> = {
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-request-statistics-seek',
                mediaId,
                timestamp,
            },
        };
        window.postMessage(command);
    }

    requestStatisticsMineSentences(mediaId: string, indexes: number[]) {
        const command: AsbPlayerCommand<DictionaryRequestStatisticsMineSentencesMessage> = {
            sender: 'asbplayerv2',
            message: { command: 'dictionary-request-statistics-mine-sentences', mediaId, indexes },
        };
        window.postMessage(command);
    }

    private _createResponsePromise<T>(messageId: string, timeout = 5000) {
        return new Promise<T>((resolve, reject) => {
            this._responseResolves[messageId] = resolve;
            setTimeout(() => {
                if (messageId in this._responseResolves) {
                    delete this._responseResolves[messageId];
                    reject('Request timed out');
                }
            }, timeout);
        });
    }

    subscribeTabs(callback: (tabs: VideoTabModel[]) => void) {
        if (this.tabs !== undefined) {
            callback(this.tabs);
        }

        this.onTabsCallbacks.push(callback);
        return () => this._remove(callback, this.onTabsCallbacks);
    }

    subscribe(callback: (message: ExtensionMessage) => void) {
        this.onMessageCallbacks.push(callback);
        return () => this._remove(callback, this.onMessageCallbacks);
    }

    _remove(callback: Function, callbacks: Function[]) {
        for (let i = callbacks.length - 1; i >= 0; --i) {
            if (callback === callbacks[i]) {
                callbacks.splice(i, 1);
                break;
            }
        }
    }

    unbind() {
        window.removeEventListener('message', this.windowEventListener);
        this.onMessageCallbacks = [];
        this.onTabsCallbacks = [];
    }
}
