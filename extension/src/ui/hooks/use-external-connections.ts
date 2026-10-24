import { useMemo } from 'react';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import {
    approveExternalConnection,
    denyExternalConnection,
    removeExternalConnection,
    viewPendingExternalConnection,
} from '@project/common/global-state';
import type { ExternalConnectionsState } from '@project/common/global-state';

export const useExternalConnections = () => {
    const provider = useMemo(() => new ExtensionGlobalStateProvider(), []);
    const [externalConnections, setExternalConnetions] = useState<ExternalConnectionsState>();

    useEffect(() => {
        void provider.get(['externalConnections']).then((s) => setExternalConnetions(s.externalConnections));
        return provider.onUpdated((s) => {
            if (s['externalConnections'] !== undefined) setExternalConnetions(s['externalConnections']);
        });
    }, [provider]);

    const approve = useCallback((extensionId: string) => approveExternalConnection(provider, extensionId), [provider]);
    const deny = useCallback((extensionId: string) => denyExternalConnection(provider, extensionId), [provider]);
    const remove = useCallback((extensionId: string) => removeExternalConnection(provider, extensionId), [provider]);
    const viewPending = useCallback(
        (extensionId: string) => viewPendingExternalConnection(provider, extensionId),
        [provider]
    );

    return {
        externalConnections,
        approveExternalConnection: approve,
        denyExternalConnection: deny,
        removeExternalConnection: remove,
        viewPendingExternalConnection: viewPending,
    };
};
