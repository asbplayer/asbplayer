import { useCallback, useEffect, useState, useMemo } from 'react';
import { ControlType } from '..';

interface Params {
    isMobile: boolean;
    fetchLastControlType: () => Promise<ControlType | undefined>;
    saveLastControlType: (controlType: ControlType) => Promise<void>;
}

export const useLastScrollableControlType = ({ isMobile, fetchLastControlType, saveLastControlType }: Params) => {
    const defaultControlType = useMemo(
        () => (isMobile ? ControlType.timeDisplay : ControlType.subtitleOffset),
        [isMobile]
    );
    const [lastControlType, setLastControlType] = useState<ControlType>(defaultControlType);

    useEffect(() => {
        void fetchLastControlType().then((controlType) => {
            if (controlType === undefined) {
                setLastControlType(defaultControlType);
            } else {
                setLastControlType(controlType);
            }
        });
    }, [defaultControlType, fetchLastControlType]);

    const wrapSaveLastControlType = useCallback(
        (controlType: ControlType) => {
            setLastControlType(controlType);
            void saveLastControlType(controlType);
        },
        [saveLastControlType]
    );

    return { lastControlType, setLastControlType: wrapSaveLastControlType };
};

export default useLastScrollableControlType;
