import {
    getAppRequestedLocation,
    getExtensionRequestedLocation,
    onAppRequestedAppLocationChanged,
    onExtensionRequestedAppLocationChanged,
} from '@/services/side-panel';
import { SidePanelLocation } from '@project/common';
import { useEffect, useState } from 'react';

export const useSidePanelRequestedLocation = () => {
    const [appRequestedLocation, setAppRequestedLocation] = useState<SidePanelLocation>();
    const [extensionRequestedLocation, setExtensionRequestedLocation] = useState<SidePanelLocation>();

    useEffect(() => {
        getAppRequestedLocation().then(setAppRequestedLocation);
        return onAppRequestedAppLocationChanged(setAppRequestedLocation);
    }, []);

    useEffect(() => {
        getExtensionRequestedLocation().then(setExtensionRequestedLocation);
        return onExtensionRequestedAppLocationChanged(setExtensionRequestedLocation);
    }, []);

    return { appRequestedLocation, extensionRequestedLocation };
};
