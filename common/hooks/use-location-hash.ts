import { useState, useEffect, useMemo } from 'react';

export const useLocationHash = (requiredParams?: { [key: string]: string }) => {
    const [hash, setHash] = useState<string>();
    const hasRequiredParams = useMemo(() => {
        if (requiredParams === undefined) {
            return true;
        }
        const searchParams = new URLSearchParams(location.search);
        for (const [key, value] of Object.entries(requiredParams)) {
            if (searchParams.get(key) !== value) {
                return false;
            }
        }
        return true;
    }, [requiredParams]);

    useEffect(() => {
        if (!hasRequiredParams) {
            setHash(undefined);
            return;
        }
        if (location.hash && location.hash.startsWith('#')) {
            const hash = location.hash.substring(1, location.hash.length);
            setHash(hash);
        } else {
            setHash('');
        }
    }, [hasRequiredParams]);
    return { hash };
};
