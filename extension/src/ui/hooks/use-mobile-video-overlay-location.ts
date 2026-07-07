import { CurrentTabMessage, MobileOverlayCommand } from '@project/common';
import { useEffect, useState } from 'react';

export interface Location {
    tabId: number;
    src: string;
}

export const useMobileVideoOverlayLocation = () => {
    const [location, setLocation] = useState<Location>();

    useEffect(() => {
        const init = async () => {
            const command: MobileOverlayCommand<CurrentTabMessage> = {
                sender: 'asbplayer-mobile-overlay',
                message: {
                    command: 'current-tab',
                },
            };

            const tabId = await browser.runtime.sendMessage(command);

            if (tabId === undefined) {
                return;
            }

            const src = new URLSearchParams(window.location.search).get('src');

            if (!src) {
                return;
            }

            setLocation({ src, tabId });
        };
        void init();
    }, []);

    return location;
};
