import { SidePanelLocation } from '@project/common';

const appRequestedLocationKey = 'sidePanelAppRequestedLocation';
const extensionRequestedLocationKey = 'sidePanelExtensionRequestedLocation';

export const setAppRequestedLocation = async (location: SidePanelLocation) => {
    await setRequestedLocation(appRequestedLocationKey, location);
};

export const setExtensionRequestedLocation = async (location: SidePanelLocation) => {
    await setRequestedLocation(extensionRequestedLocationKey, location);
};

export const clearExtensionRequestedLocation = async () => {
    await browser.storage.local.remove(extensionRequestedLocationKey);
};

const setRequestedLocation = async (key: string, location: SidePanelLocation) => {
    await browser.storage.local.set({ [key]: location });
};

export const getAppRequestedLocation = async (): Promise<SidePanelLocation | undefined> => {
    return await getRequestedLocation(appRequestedLocationKey);
};

export const getExtensionRequestedLocation = async (): Promise<SidePanelLocation | undefined> => {
    return await getRequestedLocation(extensionRequestedLocationKey);
};

const getRequestedLocation = async (key: string): Promise<SidePanelLocation | undefined> => {
    const value = (await browser.storage.local.get(key))?.[key];
    return value as SidePanelLocation | undefined;
};

export const onAppRequestedAppLocationChanged = (callback: (location?: SidePanelLocation) => void) => {
    return onRequestedLocationChanged(appRequestedLocationKey, callback);
};

export const onExtensionRequestedAppLocationChanged = (callback: (location?: SidePanelLocation) => void) => {
    return onRequestedLocationChanged(extensionRequestedLocationKey, callback);
};

const onRequestedLocationChanged = (key: string, callback: (location?: SidePanelLocation) => void) => {
    const listener = (changes: { [k: string]: Browser.storage.StorageChange }) => {
        for (const k of Object.keys(changes)) {
            if (k === key) {
                callback(changes[k].newValue as SidePanelLocation | undefined);
            }
        }
    };
    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
};
