import { useState, useEffect, useMemo } from 'react';

export const useLocationHash = (requiredParams?: { [key: string]: string }) => {
    const [url, setUrl] = useState(() => new URL(window.location.href));
    useEffect(() => {
        const update = (event: HashChangeEvent | PopStateEvent) => {
            const href = event.type === 'hashchange' ? (event as HashChangeEvent).newURL : undefined;
            setUrl(new URL(href || window.location.href));
        };
        window.addEventListener('hashchange', update);
        window.addEventListener('popstate', update);
        return () => {
            window.removeEventListener('hashchange', update);
            window.removeEventListener('popstate', update);
        };
    }, []);
    const hasRequiredParams = useMemo(() => {
        if (requiredParams === undefined) {
            return true;
        }
        const searchParams = url.searchParams;
        for (const [key, value] of Object.entries(requiredParams)) {
            if (searchParams.get(key) !== value) {
                return false;
            }
        }
        return true;
    }, [requiredParams, url]);
    const hash = hasRequiredParams ? url.hash.substring(1).split('?')[0] : undefined;
    return { hash, url };
};
