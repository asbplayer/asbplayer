import { useCallback, useMemo } from 'react';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';

/**
 * Provides access to the `externalConnections` global state key for extension settings surfaces
 * (popup, options page). Reads and writes go through extension storage; changes are subscribed to
 * via `browser.storage.local.onChanged`.
 */
export const useExternalConnections = () => {
    const provider = useMemo(() => new ExtensionGlobalStateProvider(), []);
    const onExternalConnectionsChanged = useCallback((listener: () => void) => {
        const handler = (changes: { [key: string]: Browser.storage.StorageChange }) => {
            if ('externalConnections' in changes) {
                listener();
            }
        };

        browser.storage.local.onChanged.addListener(handler);
        return () => browser.storage.local.onChanged.removeListener(handler);
    }, []);

    return { provider, onExternalConnectionsChanged };
};
