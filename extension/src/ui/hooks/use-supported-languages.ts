import { useEffect, useState } from 'react';
import { supportedLanguages as defaultSupportedLanguages } from '@project/common/settings';
import { fetchSupportedLanguages } from '../../services/localization-fetcher';

export const useSupportedLanguages = () => {
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>(defaultSupportedLanguages);

    useEffect(() => {
        void fetchSupportedLanguages().then(setSupportedLanguages);
    }, []);

    return { supportedLanguages };
};
