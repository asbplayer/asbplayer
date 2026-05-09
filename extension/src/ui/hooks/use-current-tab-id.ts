import { useEffect, useCallback, useState } from 'react';

export const useCurrentTabId = () => {
    const [currentTabId, setCurrentTabId] = useState<number>();
    const refresh = useCallback(() => {
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs.length > 0) {
                setCurrentTabId(tabs[0].id);
            }
        });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const listener = (info: Browser.tabs.OnActivatedInfo) => setCurrentTabId(info.tabId);
        browser.tabs.onActivated.addListener(listener);
        return () => browser.tabs.onActivated.removeListener(listener);
    }, []);

    useEffect(() => {
        browser.windows.onFocusChanged.addListener(refresh);
        return () => browser.windows.onFocusChanged.removeListener(refresh);
    }, [refresh]);

    return currentTabId;
};
