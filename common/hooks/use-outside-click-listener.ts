import type { RefObject } from 'react';
import { useEffect } from 'react';

export const useOutsideClickListener = (ref: RefObject<HTMLElement | null>, handler: (event: MouseEvent) => void) => {
    useEffect(() => {
        const clickHandler = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) {
                handler(event);
            }
        };
        window.document.addEventListener('click', clickHandler);
        return () => window.document.removeEventListener('click', clickHandler);
    }, [ref, handler]);
};
