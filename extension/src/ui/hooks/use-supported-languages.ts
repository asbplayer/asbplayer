import { asbError } from '@project/common/util/log';
import { useEffect, useState } from 'react';
import { supportedLanguages as defaultSupportedLanguages } from '@project/common/settings';
import { fetchSupportedLanguages } from '@project/extension/src/services/localization-fetcher';

export const useSupportedLanguages = () => {
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>(defaultSupportedLanguages);

    useEffect(() => {
        void fetchSupportedLanguages()
            .then(setSupportedLanguages)
            .catch((error) => asbError('localization', 'Failed to load supported languages:', error));
    }, []);

    return { supportedLanguages };
};
