import { registerSW } from 'virtual:pwa-register';
import { useEffect, useState } from 'react';

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
        const updateSW = registerSW({
            onNeedRefresh() {
                onNeedRefresh();
            },
            onOfflineReady() {
                onOfflineReady();
            },
        });
        setUpdateFunction({ fn: updateSW });
    }, [onNeedRefresh, onOfflineReady]);

    return { doUpdate: updateFunction.fn };
};
