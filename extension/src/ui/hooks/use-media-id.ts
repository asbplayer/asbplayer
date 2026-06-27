import { useEffect, useState } from 'react';
import TabRegistry, { Asbplayer } from '@/services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { AsbplayerInstance, VideoTabModel } from '@project/common';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
export const uiTabRegistry = new TabRegistry(settingsProvider);

interface Params {
    whereVideoElement?: (m: VideoTabModel) => boolean;
    whereAsbplayer?: (a: Asbplayer) => boolean;
}

export const useMediaId = (params?: Params) => {
    const [mediaIdWithSubtitles, setMediaIdWithSubtitles] = useState<string>();

    useEffect(() => {
        let mounted = true;
        const update = async () => {
            try {
                const videoElements = await uiTabRegistry.activeVideoElements();
                const whereVideoElement = params?.whereVideoElement;
                const anySyncedVideoElement = videoElements.find(
                    (videoElement) =>
                        videoElement.synced &&
                        videoElement.loadedSubtitles &&
                        (whereVideoElement === undefined || whereVideoElement?.(videoElement))
                );

                const whereAsbplayer = params?.whereAsbplayer;
                const syncedAsbplayerId = await uiTabRegistry.findAsbplayer({
                    filter: (asbplayer) =>
                        (asbplayer.loadedSubtitles && (whereAsbplayer === undefined || whereAsbplayer?.(asbplayer))) ??
                        false,
                    allowTabCreation: false,
                });

                if (mounted) {
                    setMediaIdWithSubtitles(anySyncedVideoElement?.src || syncedAsbplayerId);
                    return;
                }
            } catch (e) {
                // Swallow errors - best effort
            }
        };
        void update();
        const interval = setInterval(update, 1000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [params?.whereAsbplayer, params?.whereVideoElement]);

    return mediaIdWithSubtitles;
};

const findLastMediaId = async () => {
    try {
        const videoElements = await uiTabRegistry.activeVideoElements();
        let lastSyncedVideoElement: VideoTabModel | undefined;
        let lastSyncedVideoElementTabTimestamp: number | undefined;

        for (const v of videoElements) {
            if (v.synced && v.loadedSubtitles) {
                const tab = await browser.tabs.get(v.id);

                if (
                    lastSyncedVideoElementTabTimestamp === undefined ||
                    (tab.lastAccessed !== undefined && lastSyncedVideoElementTabTimestamp < tab.lastAccessed)
                ) {
                    lastSyncedVideoElement = v;
                    lastSyncedVideoElementTabTimestamp = tab.lastAccessed;
                }
            }
        }

        const asbplayerInstances = await uiTabRegistry.asbplayerInstances();
        let lastSyncedAsbplayer: AsbplayerInstance | undefined;
        let lastAsbplayerTabTimestamp: number | undefined;

        for (const a of asbplayerInstances) {
            if (a.loadedSubtitles && a.tabId !== undefined) {
                const tab = await browser.tabs.get(a.tabId);

                if (
                    lastAsbplayerTabTimestamp === undefined ||
                    (tab.lastAccessed !== undefined && lastAsbplayerTabTimestamp < tab.lastAccessed)
                ) {
                    lastSyncedAsbplayer = a;
                    lastAsbplayerTabTimestamp = tab.lastAccessed;
                }
            }
        }

        if (lastSyncedVideoElement === undefined) {
            return lastSyncedAsbplayer?.id;
        }
        if (lastSyncedAsbplayer === undefined) {
            return lastSyncedVideoElement?.src;
        }
        if ((lastSyncedVideoElementTabTimestamp ?? 0) < (lastAsbplayerTabTimestamp ?? 0)) {
            return lastSyncedAsbplayer.id;
        }
        return lastSyncedVideoElement.src;
    } catch (e) {
        // Swallow errors - best effort
    }
};

export const useLastMediaIdOnce = () => {
    const [lastMediaId, setLastMediaId] = useState<string>();
    useEffect(() => {
        let mounted = true;

        findLastMediaId().then((lastMediaId) => {
            if (mounted) {
                setLastMediaId(lastMediaId);
            }
        });
        return () => {
            mounted = false;
        };
    }, []);
    return lastMediaId;
};

export const useLastMediaId = () => {
    const [lastMediaId, setLastMediaId] = useState<string>();
    useEffect(() => {
        let mounted = true;

        const interval = setInterval(() => {
            findLastMediaId().then((lastMediaId) => {
                if (mounted) {
                    setLastMediaId(lastMediaId);
                }
            });
        }, 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);
    return lastMediaId;
};
