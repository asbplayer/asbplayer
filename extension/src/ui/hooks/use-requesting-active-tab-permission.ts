import { useEffect, useState } from 'react';
import { getTabRequestingActiveTabPermission } from '../../services/active-tab-permission-request';

interface Tab {
    tabId: number;
    src: string;
}

export const useRequestingActiveTabPermission = () => {
    const [requestingActiveTabPermission, setRequestingActiveTabPermission] = useState<boolean>();
    const [tabRequestingActiveTabPermission, setTabRequestingActiveTabPermission] = useState<Tab>();
    useEffect(() => {
        const init = async () => {
            const tabRequestingActiveTabPermission = await getTabRequestingActiveTabPermission();

            if (tabRequestingActiveTabPermission === undefined) {
                setRequestingActiveTabPermission(false);
            } else {
                const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });

                if (currentTabs.length > 0 && currentTabs[0].id === tabRequestingActiveTabPermission.tabId) {
                    setRequestingActiveTabPermission(true);
                    setTabRequestingActiveTabPermission(tabRequestingActiveTabPermission);
                } else {
                    setRequestingActiveTabPermission(false);
                }
            }
        };

        void init();
    }, []);

    return { requestingActiveTabPermission, tabRequestingActiveTabPermission };
};
