import {
    AckTabsMessage,
    AsbplayerHeartbeatMessage,
    AsbplayerInstance,
    Command,
    ExtensionToAsbPlayerCommandTabsCommand,
    ExtensionToVideoCommand,
    Message,
    SidePanelLocation,
    VideoHeartbeatMessage,
    VideoTabModel,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';

interface SlimTab {
    id: number;
    title: string;
    url: string;
    faviconUrl?: string;
}

export interface Asbplayer {
    id: string;
    tab?: SlimTab;
    sidePanel?: boolean;
    sidePanelAppRequestedLocation?: SidePanelLocation;
    timestamp: number;
    receivedTabs?: VideoTabModel[];
    videoPlayer: boolean;
    loadedSubtitles?: boolean;
    syncedVideoElement?: VideoTabModel;
}

export interface VideoElement {
    src: string;
    tab: SlimTab;
    timestamp: number;
    subscribed: boolean;
    synced: boolean;
    syncedTimestamp?: number;
    loadedSubtitles?: boolean;
}

export default class TabRegistry {
    private readonly _settings: SettingsProvider;
    private _onSyncedElementCallbacks: (() => void)[] = [];
    private _onAsbplayerInstanceCallbacks: (() => void)[] = [];

    constructor(settings: SettingsProvider) {
        this._settings = settings;

        // Update video element state on tab changes
        // Triggers events for when synced video elements appear/disappear
        browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
            this._removeVideoElementsInTab(tabId);
            this._removeAsbplayersInTab(tabId);
        });
        browser.tabs.onUpdated.addListener((tabId, updateInfo) => {
            let shouldGarbageCollect = false;

            if (updateInfo.status === 'loading' && updateInfo.url === undefined) {
                // New tab, or tab was refreshed
                shouldGarbageCollect = true;
            } else if (updateInfo.url !== undefined) {
                // Navigated to different URL
                shouldGarbageCollect = true;
            }

            if (shouldGarbageCollect) {
                this._removeVideoElementsInTab(tabId);
                this._removeAsbplayersInTab(tabId);
            }
        });
    }

    private async _fetchVideoElementState(): Promise<{ [key: string]: VideoElement }> {
        const result = await browser.storage.session.get('tabRegistryVideoElements');
        return (result && (result.tabRegistryVideoElements as { [key: string]: VideoElement })) ?? {};
    }

    private async _saveVideoElementState(state: { [key: string]: VideoElement }) {
        await browser.storage.session.set({ tabRegistryVideoElements: state });
    }

    private async _removeVideoElementsInTab(tabId: number) {
        await this._videoElements((videoElements) => {
            let changed = false;

            for (const [k, v] of Object.entries(videoElements)) {
                if (v.tab.id === tabId) {
                    delete videoElements[k];
                    changed = true;
                }
            }

            return changed;
        });
    }

    private async _videoElements(mutator?: (videoElements: { [key: string]: VideoElement }) => boolean) {
        const videoElements = await this._fetchVideoElementState();
        const oldVideoElements = { ...videoElements };

        let changed = false;

        if (mutator !== undefined) {
            changed = mutator(videoElements) || changed;
        }

        if (changed) {
            await this._saveVideoElementState(videoElements);
        }

        const oldSyncedElementExists = Object.values(oldVideoElements).find((v) => v.synced) !== undefined;
        const syncedElementExists = Object.values(videoElements).find((v) => v.synced) !== undefined;

        if (this._onSyncedElementCallbacks.length > 0 && !oldSyncedElementExists && syncedElementExists) {
            for (const c of this._onSyncedElementCallbacks) {
                c();
            }
        }

        return videoElements;
    }

    private async _fetchAsbplayerState(): Promise<{ [key: string]: Asbplayer }> {
        const result = await browser.storage.session.get('tabRegistryAsbplayers');
        return (result && (result.tabRegistryAsbplayers as { [key: string]: Asbplayer })) ?? {};
    }

    private async _saveAsbplayerState(state: { [key: string]: Asbplayer }) {
        await browser.storage.session.set({ tabRegistryAsbplayers: state });
    }

    private async _removeAsbplayersInTab(tabId: number) {
        await this._asbplayers((asbplayers) => {
            let changed = false;

            for (const [k, v] of Object.entries(asbplayers)) {
                if (v.tab?.id === tabId) {
                    delete asbplayers[k];
                    changed = true;
                }
            }

            return changed;
        });
    }

    private async _asbplayers(mutator?: (asbplayers: { [key: string]: Asbplayer }) => boolean) {
        const asbplayers = await this._fetchAsbplayerState();
        const oldAsbplayers = { ...asbplayers };
        let changed = false;
        const now = Date.now();

        for (const id in asbplayers) {
            const asbplayer = asbplayers[id];
            const disappeared = asbplayer.sidePanel && now - asbplayer.timestamp >= 5000;

            if (disappeared) {
                changed = true;
                delete asbplayers[id];
            }
        }

        if (mutator !== undefined) {
            changed = mutator(asbplayers) || changed;
        }

        let newAsplayerAppeared = false;

        if (changed) {
            await this._saveAsbplayerState(asbplayers);
            newAsplayerAppeared = Object.keys(asbplayers).some((asbplayerId) => !(asbplayerId in oldAsbplayers));
        }

        if (newAsplayerAppeared) {
            for (const c of this._onAsbplayerInstanceCallbacks) {
                c();
            }
        }

        return asbplayers;
    }

    async onAsbplayerHeartbeat(
        tab: Browser.tabs.Tab | undefined,
        {
            id: asbplayerId,
            videoPlayer,
            sidePanel,
            sidePanelAppRequestedLocation,
            receivedTabs,
            loadedSubtitles,
            syncedVideoElement,
        }: AsbplayerHeartbeatMessage
    ) {
        this._updateAsbplayers(
            tab,
            asbplayerId,
            videoPlayer,
            sidePanel ?? false,
            sidePanelAppRequestedLocation,
            loadedSubtitles ?? false,
            receivedTabs,
            syncedVideoElement
        );

        try {
            const command: ExtensionToAsbPlayerCommandTabsCommand = {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'tabs',
                    tabs: await this.activeVideoElements(),
                    asbplayers: await this._asbplayerInstances(),
                    ackRequested: false,
                },
            };

            if (tab?.id) {
                await browser.tabs.sendMessage(tab.id, command);
            } else {
                await browser.runtime.sendMessage(command);
            }
        } catch (e) {
            // Swallow
        }
    }

    async onAsbplayerAckTabs(
        tab: Browser.tabs.Tab | undefined,
        {
            id: asbplayerId,
            videoPlayer,
            sidePanel,
            sidePanelAppRequestedLocation,
            loadedSubtitles,
            receivedTabs,
            syncedVideoElement,
        }: AckTabsMessage
    ) {
        this._updateAsbplayers(
            tab,
            asbplayerId,
            videoPlayer,
            sidePanel ?? false,
            sidePanelAppRequestedLocation,
            loadedSubtitles ?? false,
            receivedTabs,
            syncedVideoElement
        );
    }

    private async _updateAsbplayers(
        tab: Browser.tabs.Tab | undefined,
        asbplayerId: string,
        videoPlayer: boolean,
        sidePanel: boolean,
        sidePanelAppRequestedLocation: SidePanelLocation | undefined,
        loadedSubtitles: boolean,
        receivedTabs: VideoTabModel[] | undefined,
        syncedVideoElement: VideoTabModel | undefined
    ) {
        const slimTab =
            tab === undefined || tab.id === undefined
                ? undefined
                : {
                      id: tab.id,
                      title: tab.title ?? '',
                      url: tab.url ?? '',
                      faviconUrl: tab.favIconUrl,
                  };
        await this._asbplayers((asbplayers) => {
            asbplayers[asbplayerId] = {
                tab: slimTab,
                id: asbplayerId,
                timestamp: Date.now(),
                receivedTabs,
                sidePanel,
                sidePanelAppRequestedLocation,
                loadedSubtitles,
                videoPlayer,
                syncedVideoElement,
            };
            return true;
        });
    }

    async onAsbplayerRemoved(id: string) {
        await this._asbplayers((asbplayers) => {
            if (id in asbplayers) {
                delete asbplayers[id];
                return true;
            }
            return false;
        });
    }

    async activeVideoElements() {
        const videoElements = await this._videoElements();
        const activeVideoElements: VideoTabModel[] = [];

        for (const id in videoElements) {
            const videoElement = videoElements[id];

            if (videoElement.tab.id) {
                const element: VideoTabModel = {
                    id: videoElement.tab.id,
                    title: videoElement.tab.title,
                    faviconUrl: videoElement.tab.faviconUrl,
                    src: videoElement.src,
                    subscribed: videoElement.subscribed,
                    synced: videoElement.synced,
                    loadedSubtitles: videoElement.loadedSubtitles ?? false,
                    syncedTimestamp: videoElement.syncedTimestamp,
                };
                activeVideoElements.push(element);
            }
        }

        return activeVideoElements;
    }

    private async _asbplayerInstances() {
        const asbplayers = await this._asbplayers();
        const asbplayerInstances: AsbplayerInstance[] = [];

        for (const asbplayer of Object.values(asbplayers)) {
            asbplayerInstances.push({
                id: asbplayer.id,
                tabId: asbplayer.tab?.id,
                sidePanel: asbplayer.sidePanel ?? false,
                timestamp: asbplayer.timestamp,
                videoPlayer: asbplayer.videoPlayer,
                loadedSubtitles: asbplayer.loadedSubtitles ?? false,
            });
        }

        return asbplayerInstances;
    }

    async onVideoElementHeartbeat(
        tab: Browser.tabs.Tab,
        src: string,
        { subscribed, synced, syncedTimestamp, loadedSubtitles }: VideoHeartbeatMessage
    ) {
        if (tab.id === undefined) {
            return;
        }

        const tabId = tab.id;

        await this._videoElements((videoElements) => {
            videoElements[`${tab.id}:${src}`] = {
                tab: {
                    id: tabId,
                    title: tab.title ?? '',
                    url: tab.url ?? '',
                    faviconUrl: tab.favIconUrl,
                },
                src,
                subscribed,
                timestamp: Date.now(),
                synced,
                syncedTimestamp,
                loadedSubtitles,
            };
            return true;
        });
    }

    async onVideoElementDisappeared(tab: Browser.tabs.Tab, src: string) {
        await this._videoElements((videoElements) => {
            const key = `${tab.id}:${src}`;

            if (key in videoElements) {
                delete videoElements[key];
                return true;
            }

            return false;
        });
    }

    onSyncedElement(callback: () => void) {
        this._onSyncedElementCallbacks.push(callback);
    }

    onAsbplayerInstance(callback: () => void) {
        this._onAsbplayerInstanceCallbacks.push(callback);
    }

    async publishTabsToAsbplayers() {
        const tabsCommand: ExtensionToAsbPlayerCommandTabsCommand = {
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'tabs',
                tabs: await this.activeVideoElements(),
                asbplayers: await this._asbplayerInstances(),
                ackRequested: true,
            },
        };

        await this.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => (asbplayer.videoPlayer ? undefined : tabsCommand),
        });
    }

    async publishCommandToAsbplayers<T extends Message>({
        asbplayerId,
        commandFactory,
    }: {
        commandFactory: (asbplayer: Asbplayer) => Command<T> | undefined;
        asbplayerId?: string;
    }) {
        const asbplayers = await this._asbplayers();

        if (asbplayerId !== undefined) {
            if (asbplayerId in asbplayers) {
                const asbplayer = asbplayers[asbplayerId];
                const command = commandFactory(asbplayer);

                if (command !== undefined) {
                    await this._sendCommand(asbplayers[asbplayerId], command);
                }
            }
        } else {
            for (const id in asbplayers) {
                const asbplayer = asbplayers[id];
                const command = commandFactory(asbplayer);

                if (command !== undefined) {
                    await this._sendCommand(asbplayer, command);
                }
            }
        }
    }

    private async _sendCommand<T extends Message>(asbplayer: Asbplayer, command: Command<T>) {
        try {
            if (asbplayer.tab?.id !== undefined) {
                await browser.tabs.sendMessage(asbplayer.tab.id, command);
            } else if (asbplayer.sidePanel) {
                await browser.runtime.sendMessage(command);
            }
        } catch (e) {
            // Swallow as this usually only indicates that the tab is not an asbplayer tab
        }
    }

    async publishCommandToVideoElements<T extends Message>(
        commandFactory: (videoElement: VideoElement) => ExtensionToVideoCommand<T> | undefined
    ) {
        const videoElements = await this._videoElements();

        for (const id in videoElements) {
            const videoElement = videoElements[id];
            const tabId = videoElement.tab.id;

            if (typeof tabId !== 'undefined') {
                const command = commandFactory(videoElement);

                if (command !== undefined) {
                    browser.tabs.sendMessage(tabId, command);
                }
            }
        }
    }

    async publishCommandToVideoElementTabs<T extends Message>(
        commandFactory: (tab: SlimTab) => ExtensionToVideoCommand<T> | undefined
    ) {
        const videoElements = await this._videoElements();
        const tabs: SlimTab[] = [];

        for (const v of Object.values(videoElements)) {
            if (tabs.find((t) => t.id === v.tab.id) === undefined) {
                tabs.push(v.tab);
            }
        }

        if (tabs.length > 0) {
            for (const tab of tabs) {
                const command = commandFactory(tab);

                if (command !== undefined) {
                    browser.tabs.sendMessage(tab.id, command);
                }
            }
        }
    }

    async findAsbplayer({
        filter,
        allowTabCreation,
    }: {
        filter?: (asbplayer: Asbplayer) => boolean;
        allowTabCreation: boolean;
    }): Promise<string | undefined> {
        let chosenAsbplayerId = null;
        const now = Date.now();
        let min = null;

        const asbplayers = await this._asbplayers();
        let asbplayerTabCount = 0;

        for (const id in asbplayers) {
            const asbplayer = asbplayers[id];

            if (!asbplayer.sidePanel) {
                ++asbplayerTabCount;
            }

            if (filter === undefined || filter(asbplayer)) {
                const elapsed = now - asbplayer.timestamp;

                if (min === null || elapsed < min) {
                    min = elapsed;
                    chosenAsbplayerId = asbplayer.id;
                }
            }
        }

        if (chosenAsbplayerId) {
            return chosenAsbplayerId;
        }

        if (allowTabCreation) {
            return new Promise(async (resolve, reject) => {
                if (asbplayerTabCount === 0) {
                    await this._createNewTab();
                }

                this._anyAsbplayerTab(resolve, reject, 0, 10, filter);
            });
        }

        return undefined;
    }

    async findAsbplayerTab({ filter }: { filter?: (asbplayer: Asbplayer) => boolean }): Promise<SlimTab | undefined> {
        let chosenTab: SlimTab | undefined;
        let min: number | null = null;
        const now = Date.now();
        const asbplayers = await this._asbplayers();

        for (const asbplayer of Object.values(asbplayers)) {
            if (!asbplayer.tab) continue;
            if (filter !== undefined && !filter(asbplayer)) continue;
            const elapsed = now - asbplayer.timestamp;
            if (min === null || elapsed < min) {
                min = elapsed;
                chosenTab = asbplayer.tab;
            }
        }

        return chosenTab;
    }

    async _createNewTab() {
        return new Promise<Browser.tabs.Tab>(async (resolve, reject) => {
            const activeTabs = await browser.tabs.query({ active: true });
            const activeTabIndex = !activeTabs || activeTabs.length === 0 ? undefined : activeTabs[0].index + 1;
            browser.tabs.create(
                {
                    active: false,
                    url: await this._settings.getSingle('streamingAppUrl'),
                    index: activeTabIndex,
                },
                resolve
            );
        });
    }

    async _anyAsbplayerTab(
        resolve: (value: string | PromiseLike<string>) => void,
        reject: (reason?: any) => void,
        attempt: number,
        maxAttempts: number,
        filter?: (asbplayer: Asbplayer) => boolean
    ) {
        if (attempt >= maxAttempts) {
            reject(new Error('Could not find or create an asbplayer tab'));
            return;
        }

        const asbplayers = await this._asbplayers();

        for (const id in asbplayers) {
            if (filter === undefined || filter(asbplayers[id])) {
                resolve(id);
                return;
            }
        }

        setTimeout(() => this._anyAsbplayerTab(resolve, reject, attempt + 1, maxAttempts, filter), 1000);
    }

    async focusTabForMediaId(mediaId: string) {
        if (!mediaId) {
            return;
        }
        try {
            const videoElements = await this.activeVideoElements();
            let tabId = videoElements.find((videoElement) => videoElement.src === mediaId)?.id;
            if (tabId === undefined) {
                tabId = (await this.findAsbplayerTab({ filter: (asbplayer) => asbplayer.id === mediaId }))?.id;
            }
            if (tabId === undefined) return;

            const targetTab = await browser.tabs.get(tabId);
            if (targetTab.windowId !== undefined) {
                const targetWindow = await browser.windows.get(targetTab.windowId);
                if (!targetWindow.focused) {
                    await browser.windows.update(targetTab.windowId, { focused: true });
                }
            }
            if (!targetTab.active) {
                await browser.tabs.update(tabId, { active: true });
            }
        } catch {
            // Best effort only
        }
    }
}
