import { useState, useLayoutEffect } from 'react';

const appBarSelector = 'header.MuiAppBar-root';

// https://github.com/mui/material-ui/issues/10739
export const useAppBarHeight = () => {
    const [appbarHeight, setAppbarHeight] = useState(0);

    useLayoutEffect(() => {
        let resizeObserver: ResizeObserver | undefined;
        let appBarObserver: MutationObserver | undefined;

        const measure = (appBar: HTMLElement) => {
            const height = appBar.clientHeight;
            if (height > 0) {
                setAppbarHeight(height);
            }
        };

        const observe = (appBar: HTMLElement) => {
            measure(appBar);
            resizeObserver = new ResizeObserver(() => measure(appBar));
            resizeObserver.observe(appBar);
        };

        const appBar = document.querySelector<HTMLElement>(appBarSelector);
        if (appBar) {
            observe(appBar);
        } else {
            appBarObserver = new MutationObserver(() => {
                const element = document.querySelector<HTMLElement>(appBarSelector);
                if (element === null) {
                    return;
                }

                observe(element);
                appBarObserver?.disconnect();
                appBarObserver = undefined;
            });
            appBarObserver.observe(document.body, { childList: true, subtree: true });
        }

        function handleResize() {
            const element = document.querySelector<HTMLElement>(appBarSelector);
            if (element !== null) {
                measure(element);
            }
        }

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver?.disconnect();
            appBarObserver?.disconnect();
        };
    }, []);

    return appbarHeight;
};
