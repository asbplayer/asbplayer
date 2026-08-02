import {
    MobileOverlayToVideoCommand,
    MobileOverlayModel,
    RequestMobileOverlayModelMessage,
    VideoToMobileOverlayCommand,
    UpdateMobileOverlayModelMessage,
} from '@project/common';
import { useEffect, useRef, useState } from 'react';

interface Params {
    location?: {
        src: string;
    };
}

const overlayInstanceId = new URLSearchParams(window.location.search).get('overlayId');

const isCurrentOverlayModel = (model: MobileOverlayModel | undefined) =>
    overlayInstanceId === null || model?.overlayInstanceId === overlayInstanceId;

export const useMobileVideoOverlayModel = ({ location }: Params) => {
    const [model, setModel] = useState<MobileOverlayModel>();
    const [isActive, setIsActive] = useState(true);
    const isActiveRef = useRef(true);

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
            if (cancelled || !isActiveRef.current) {
                return;
            }
            if (!isCurrentOverlayModel(initialModel)) {
                isActiveRef.current = false;
                setIsActive(false);
                return;
            }
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
            if (!isCurrentOverlayModel(command.message.model)) {
                isActiveRef.current = false;
                setIsActive(false);
                return;
            }
            setModel(command.message.model);
        };
        browser.runtime.onMessage.addListener(listener);
        return () => browser.runtime.onMessage.removeListener(listener);
    }, [location]);
    return { model, isActive };
};
