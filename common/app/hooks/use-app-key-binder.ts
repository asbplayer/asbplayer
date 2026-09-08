import { useEffect, useState } from 'react';
import type { KeyBindSet } from '@project/common/settings';
import AppKeyBinder from '@project/common/app/services/app-key-binder';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import { DefaultKeyBinder } from '@project/common/key-binder';

export const useAppKeyBinder = (keyBindSet: KeyBindSet, extension: ChromeExtension) => {
    const [appKeyBinder, setAppKeyBinder] = useState<AppKeyBinder>(
        () => new AppKeyBinder(new DefaultKeyBinder(keyBindSet), extension)
    );

    useEffect(() => {
        const newAppKeyBinder = new AppKeyBinder(new DefaultKeyBinder(keyBindSet), extension);
        setAppKeyBinder((oldAppKeyBinder) => {
            oldAppKeyBinder.unsubscribeExtension();
            return newAppKeyBinder;
        });
    }, [keyBindSet, extension]);

    return appKeyBinder;
};
