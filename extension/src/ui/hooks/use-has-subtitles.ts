import { useEffect, useState } from 'react';
import TabRegistry, { Asbplayer } from '@/services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { VideoTabModel } from '@project/common';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
export const uiTabRegistry = new TabRegistry(settingsProvider);

interface Params {
    whereVideoElement?: (m: VideoTabModel) => boolean;
    whereAsbplayer?: (a: Asbplayer) => boolean;
}

export const useHasSubtitles = (params?: Params) => {
    const [hasSubtitles, setHasSubtitles] = useState(false);

    useEffect(() => {
        let mounted = true;
        const update = async () => {
            try {
                const videoElements = await uiTabRegistry.activeVideoElements();
                const whereVideoElement = params?.whereVideoElement;
                const anyVideoElementSynced = videoElements.some(
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
                    setHasSubtitles(anyVideoElementSynced || Boolean(syncedAsbplayerId));
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

    return hasSubtitles;
};
