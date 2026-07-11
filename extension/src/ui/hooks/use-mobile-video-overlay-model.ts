import {
    MobileOverlayToVideoCommand,
    MobileOverlayModel,
    RequestMobileOverlayModelMessage,
    VideoToMobileOverlayCommand,
    UpdateMobileOverlayModelMessage,
} from '@project/common';
import { useEffect, useState } from 'react';

interface Params {
    location?: {
        src: string;
    };
}

export const useMobileVideoOverlayModel = ({ location }: Params) => {
    const [model, setModel] = useState<MobileOverlayModel>();

    useEffect(() => {
        if (!location) {
            return;
        }

        const requestModel = async () => {
            const command: MobileOverlayToVideoCommand<RequestMobileOverlayModelMessage> = {
                sender: 'asbplayer-mobile-overlay-to-video',
                message: {
                    command: 'request-mobile-overlay-model',
                },
                src: location.src,
            };
            const initialModel = await browser.runtime.sendMessage(command);
            setModel(initialModel);
        };

        let timeout: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const init = async () => {
            try {
                if (cancelled) {
                    return;
                }

                await requestModel();
            } catch (e) {
                console.log(
                    'Failed to request overlay model, retrying in 1s. Message: ' +
                        (e instanceof Error ? e.message : String(e))
                );
                timeout = setTimeout(() => {
                    void init();
                }, 1000);
            }
        };

        void init();

        return () => {
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }

            cancelled = true;
        };
    }, [location]);

    useEffect(() => {
        if (!location) {
            return;
        }

        const listener = (message: any) => {
            if (message.sender !== 'asbplayer-video-to-mobile-overlay' || message.src !== location.src) {
                return;
            }

            const command = message as VideoToMobileOverlayCommand<UpdateMobileOverlayModelMessage>;
            setModel(command.message.model);
        };
        browser.runtime.onMessage.addListener(listener);
        return () => browser.runtime.onMessage.removeListener(listener);
    }, [location]);
    return model;
};
