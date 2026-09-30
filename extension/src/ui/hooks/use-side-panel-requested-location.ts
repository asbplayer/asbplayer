import {
    getAppRequestedLocation,
    getExtensionRequestedLocation,
    onAppRequestedAppLocationChanged,
    onExtensionRequestedAppLocationChanged,
} from '@/services/side-panel';
import type { SidePanelLocation } from '@project/common';
import { asbError } from '@project/common/util/log';
import { useEffect, useState } from 'react';

export const useSidePanelRequestedLocation = () => {
    const [appRequestedLocation, setAppRequestedLocation] = useState<SidePanelLocation>();
    const [extensionRequestedLocation, setExtensionRequestedLocation] = useState<SidePanelLocation>();

    useEffect(() => {
        void getAppRequestedLocation()
            .then(setAppRequestedLocation)
            .catch((error) => asbError('side-panel', 'Failed to load the app-requested panel location:', error));
        return onAppRequestedAppLocationChanged(setAppRequestedLocation);
    }, []);

    useEffect(() => {
        void getExtensionRequestedLocation()
            .then(setExtensionRequestedLocation)
            .catch((error) => asbError('side-panel', 'Failed to load the extension-requested panel location:', error));
        return onExtensionRequestedAppLocationChanged(setExtensionRequestedLocation);
    }, []);

    return { appRequestedLocation, extensionRequestedLocation };
};
