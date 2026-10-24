import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'react';
import { watchServiceWorkerUpdates } from '@project/common/app/services/service-worker-updates';

interface Params {
    onNeedRefresh: () => void;
    onOfflineReady: () => void;
}

interface FunctionWrapper {
    fn: () => void;
}

export const useServiceWorker = ({ onNeedRefresh, onOfflineReady }: Params) => {
    const [updateFunction, setUpdateFunction] = useState<FunctionWrapper>({ fn: () => {} });

    useEffect(() => {
        let reloading = false;
        const reload = () => {
            if (reloading) return;
            reloading = true;
            window.location.reload();
        };
        const stopWatching = navigator.serviceWorker
            ? watchServiceWorkerUpdates(navigator.serviceWorker, reload)
            : undefined;
        const updateSW = registerSW({
            onNeedRefresh() {
                onNeedRefresh();
            },
            onOfflineReady() {
                onOfflineReady();
            },
            onNeedReload: reload,
        });
        setUpdateFunction({ fn: updateSW });
        return () => {
            stopWatching?.();
        };
    }, [onNeedRefresh, onOfflineReady]);

    return { doUpdate: updateFunction.fn };
};
