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
        void getAppRequestedLocation().then(setAppRequestedLocation);
        return onAppRequestedAppLocationChanged(setAppRequestedLocation);
    }, []);

    useEffect(() => {
        void getExtensionRequestedLocation().then(setExtensionRequestedLocation);
        return onExtensionRequestedAppLocationChanged(setExtensionRequestedLocation);
    }, []);

    return { appRequestedLocation, extensionRequestedLocation };
};
