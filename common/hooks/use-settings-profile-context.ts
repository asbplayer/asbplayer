import { DictionaryProvider } from '../dictionary-db';
import { Profile, SettingsProvider } from '../settings';
import { useEffect, useState, useCallback } from 'react';

interface Params {
    dictionaryProvider: DictionaryProvider;
    settingsProvider: SettingsProvider;
    onProfileChanged: () => void;
}

export const useSettingsProfileContext = ({ dictionaryProvider, settingsProvider, onProfileChanged }: Params) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<string>();
    const refreshProfileContext = useCallback(() => {
        void settingsProvider.profiles().then(setProfiles);
        void settingsProvider.activeProfile().then((p) => setActiveProfile(p?.name));
    }, [settingsProvider]);
    useEffect(() => {
        refreshProfileContext();
    }, [refreshProfileContext]);

    const onNewProfile = useCallback(
        (name: string) =>
            settingsProvider
                .addProfile(name)
                .then(() => settingsProvider.profiles().then(setProfiles))
                .then(() => settingsProvider.setActiveProfile(name))
                .then(() => setActiveProfile(name))
                .then(() => onProfileChanged()),
        [settingsProvider, onProfileChanged]
    );
    const onRemoveProfile = useCallback(
        async (name: string) => {
            await dictionaryProvider.deleteProfile(name);

            if (name === activeProfile) {
                await settingsProvider.setActiveProfile(undefined);
                setActiveProfile(undefined);
                onProfileChanged();
            }
            void settingsProvider.removeProfile(name).then(() => settingsProvider.profiles().then(setProfiles));
        },
        [dictionaryProvider, settingsProvider, activeProfile, onProfileChanged]
    );
    const onSetActiveProfile = useCallback(
        (name: string | undefined) =>
            settingsProvider
                .setActiveProfile(name)
                .then(() => setActiveProfile(name))
                .then(() => onProfileChanged()),
        [settingsProvider, onProfileChanged]
    );

    return { profiles, activeProfile, onNewProfile, onRemoveProfile, onSetActiveProfile, refreshProfileContext };
};
