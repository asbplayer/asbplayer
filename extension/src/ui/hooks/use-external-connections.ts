import { useCallback, useEffect, useState, useMemo } from 'react';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import {
    approveExternalConnection,
    denyExternalConnection,
    removeExternalConnection,
} from '@project/common/global-state';
import type { ExternalConnectionsState } from '@project/common/global-state';
import { asbError } from '@project/common/util/log';

export const useExternalConnections = () => {
    const provider = useMemo(() => new ExtensionGlobalStateProvider(), []);
    const [externalConnections, setExternalConnections] = useState<ExternalConnectionsState>({});

    useEffect(() => {
        void provider
            .get(['externalConnections'])
            .then((s) => setExternalConnections(s.externalConnections))
            .catch((error) => asbError('external-connection', 'Failed to load external connections:', error));
        return provider.onUpdated((s) => {
            if (s['externalConnections'] !== undefined) setExternalConnections(s['externalConnections']);
        });
    }, [provider]);

    const approve = useCallback(
        (extensionId: string) => approveExternalConnection(provider, extensionId, Date.now()),
        [provider]
    );
    const deny = useCallback(
        (extensionId: string) => denyExternalConnection(provider, extensionId, Date.now()),
        [provider]
    );
    const remove = useCallback((extensionId: string) => removeExternalConnection(provider, extensionId), [provider]);

    return {
        externalConnections,
        approveExternalConnection: approve,
        denyExternalConnection: deny,
        removeExternalConnection: remove,
    };
};
