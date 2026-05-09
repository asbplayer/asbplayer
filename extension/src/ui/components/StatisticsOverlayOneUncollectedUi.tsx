import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyledEngineProvider, ThemeProvider, type PaletteMode } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Bridge from '../bridge';
import { createTheme } from '@project/common/theme';
import { Message, UpdateStateMessage } from '@project/common';
import OneUncollectedSentenceDetailsDialog from '@project/common/components/OneUncollectedSentenceDetailsDialog';
import { type DictionaryStatisticsSentenceBucketEntry } from '@project/common/dictionary-statistics';
import { DictionaryProvider } from '@project/common/dictionary-db';
import { ExtensionDictionaryStorage } from '@/services/extension-dictionary-storage';
import { useI18n } from '../hooks/use-i18n';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import { SettingsProvider } from '@project/common/settings';

interface Props {
    bridge: Bridge;
}

export interface UiState {
    open: boolean;
    mediaId: string;
    entries: DictionaryStatisticsSentenceBucketEntry[];
    totalSentences: number;
}

const dictionaryProvider = new DictionaryProvider(new ExtensionDictionaryStorage());
const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());

const StatisticsOverlayOneUncollectedUi: React.FC<Props> = ({ bridge }) => {
    const [themeType, setThemeType] = useState<PaletteMode>('dark');
    const [open, setOpen] = useState<boolean>(false);
    const [mediaId, setMediaId] = useState<string>();
    const [entries, setEntries] = useState<DictionaryStatisticsSentenceBucketEntry[]>([]);
    const [totalSentences, setTotalSentences] = useState<number>(0);
    const [language, setLanguage] = useState<string>('en');

    const theme = useMemo(() => createTheme(themeType), [themeType]);
    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const { open, mediaId, entries, totalSentences } = (message as UpdateStateMessage).state as UiState;

            setOpen(open);
            setMediaId(mediaId);
            setEntries(entries);
            setTotalSentences(totalSentences);
        });
    }, [bridge]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    useEffect(() => {
        settingsProvider.get(['themeType', 'language']).then(({ themeType, language }) => {
            setThemeType(themeType);
            setLanguage(language);
        });
    });

    const handleClose = useCallback(() => {
        setOpen(false);
        // Hack - let animation play before closing
        setTimeout(() => bridge.sendMessageFromServer({ command: 'close' }), 300);
    }, [bridge]);

    const { initialized: i18nInitialized } = useI18n({ language });

    if (!i18nInitialized) {
        return null;
    }

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <OneUncollectedSentenceDetailsDialog
                    open={open}
                    entries={entries}
                    totalSentences={totalSentences}
                    miningEnabled
                    onClose={handleClose}
                    mediaId={mediaId}
                    dictionaryProvider={dictionaryProvider}
                />
            </ThemeProvider>
        </StyledEngineProvider>
    );
};

export default StatisticsOverlayOneUncollectedUi;
