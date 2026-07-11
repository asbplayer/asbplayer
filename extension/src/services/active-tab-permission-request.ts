const key = 'tabRequestingActiveTabPermission';

interface SavedTab {
    tabId: number;
    url: string;
    src: string;
}

export const getTabRequestingActiveTabPermission = async () => {
    const result = await browser.storage.session.get(key);
    const tab = result ? result[key] : undefined;

    if (!tab) {
        return undefined;
    }

    const savedTab = tab as SavedTab;
    const currentTabInfo = await tabInfo(savedTab.tabId);

    if (currentTabInfo === undefined || currentTabInfo.url !== savedTab.url) {
        await browser.storage.session.remove(key);
        return undefined;
    }

    return { tabId: savedTab.tabId, src: savedTab.src };
};

export const setRequestingActiveTabPermission = async (tabId: number, src: string, requesting: boolean) => {
    if (requesting) {
        const tab = await tabInfo(tabId);

        if (tab === undefined) {
            await browser.storage.session.remove(key);
        } else if (tab.id !== undefined) {
            const savedTab = { tabId, src, url: tab.url };
            await browser.storage.session.set({ [key]: savedTab });
        }
    } else {
        await browser.storage.session.remove(key);
    }
};

const tabInfo = async (tabId: number) => {
    return browser.tabs.get(tabId);
};
