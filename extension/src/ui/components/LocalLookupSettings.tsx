import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { getLocalLookupToken, localLookupTokenKey } from '@/services/local-lookup-token';

export default function LocalLookupSettings() {
    const { t } = useTranslation();
    const [savedToken, setSavedToken] = useState<string>();
    const [token, setToken] = useState('');
    const [error, setError] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void getLocalLookupToken()
            .then((value) => {
                setSavedToken(value);
                setToken(value);
            })
            .catch(() => setError(true));
    }, []);

    const save = async () => {
        const value = token.trim();
        setSaving(true);
        setError(false);
        try {
            await browser.storage.local.set({ [localLookupTokenKey]: value });
            setSavedToken(value);
            setToken(value);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    const tooShort = token.trim().length > 0 && token.trim().length < 32;
    return (
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mt: 2 }}>
            <TextField
                fullWidth
                type="password"
                autoComplete="off"
                label={t('settings.localLookupToken')}
                helperText={t(error ? 'settings.localLookupTokenStorageError' : 'settings.localLookupTokenHint')}
                value={token}
                disabled={savedToken === undefined || saving}
                error={error || tooShort}
                onChange={(event) => setToken(event.target.value)}
            />
            <Button
                disabled={savedToken === undefined || saving || tooShort || token.trim() === savedToken}
                onClick={() => void save()}
            >
                {t('settings.localLookupTokenSave')}
            </Button>
        </Stack>
    );
}
