import { useState, useLayoutEffect } from 'react';

// https://github.com/mui/material-ui/issues/10739
export const useAppBarHeight = () => {
    const [appbarHeight, setAppbarHeight] = useState(0);

    useLayoutEffect(() => {
        const appBar = document.querySelector('header.MuiAppBar-root');
        setAppbarHeight(appBar?.clientHeight || 0);

        function handleResize() {
            setAppbarHeight(appBar?.clientHeight || 0);
        }

        const observer = new MutationObserver(() => {
            setAppbarHeight(appBar?.clientHeight || 0);
        });

        if (appBar) {
            observer.observe(appBar, { attributes: true, attributeFilter: ['class'] });
        }

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, []);

    return appbarHeight;
};
