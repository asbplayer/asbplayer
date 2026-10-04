import { useRef } from 'react';

/** Creates a value once and returns the value without exposing its backing ref. */
export const useLazyRef = <T>(initializer: () => T): T => {
    const valueRef = useRef<T | undefined>(undefined);
    if (valueRef.current === undefined) valueRef.current = initializer();
    return valueRef.current;
};
