import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CloseIcon from '@mui/icons-material/Close';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { JimakuClient, JimakuEntry } from '@/services/subtitle-sources';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Toolbar from '@mui/material/Toolbar';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

interface OnlineSubtitleImportCandidate {
    name: string;
    url: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onImport: (file: OnlineSubtitleImportCandidate) => Promise<void>;
    detectedTitleHint?: string;
    jimakuApiKey: string;
    onJimakuApiKeyChange: (jimakuApiKey: string) => void;
}

const SUPPORTED_JIMAKU_EXTENSIONS = ['.srt', '.ass'];

const isSupportedSubtitleFile = (name: string) =>
    SUPPORTED_JIMAKU_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const normalizeDetectedTitleHint = (hint?: string) => {
    const trimmedHint = hint?.trim() ?? '';

    if (trimmedHint.length === 0) {
        return '';
    }

    const suffixSplit = trimmedHint.split(' - ');
    if (suffixSplit.length > 1) {
        return suffixSplit[0].trim();
    }

    return trimmedHint;
};

const FilterTextField: React.FC<{ filterString: string; onChange: (s: string) => void }> = ({
    filterString,
    onChange,
}) => {
    return (
        <TextField
            size="small"
            fullWidth
            value={filterString}
            onChange={(e) => onChange(e.target.value)}
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <SearchIcon fontSize="small" />
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
};
export default function OnlineSubtitleSourceDialog({
    open,
    onClose,
    onImport,
    detectedTitleHint,
    jimakuApiKey,
    onJimakuApiKeyChange,
}: Props) {
    const { t } = useTranslation();
    const [searching, setSearching] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [error, setError] = useState<string>();

    const [query, setQuery] = useState('');
    const [lastQuery, setLastQuery] = useState<string>();
    const [jimakuEntries, setJimakuEntries] = useState<{ id: number; name: string }[]>([]);
    const [jimakuSelectedEntry, setJimakuSelectedEntry] = useState<JimakuEntry>();
    const [jimakuFiles, setJimakuFiles] = useState<OnlineSubtitleImportCandidate[]>();

    const normalizedDetectedTitleHint = useMemo(
        () => normalizeDetectedTitleHint(detectedTitleHint),
        [detectedTitleHint]
    );
    const isSearchDisabled =
        searching ||
        query.trim().length === 0 ||
        jimakuApiKey.trim().length === 0 ||
        lastQuery === query ||
        loadingFiles;

    const resetState = useCallback(() => {
        setSearching(false);
        setError(undefined);
        setJimakuEntries([]);
        setJimakuSelectedEntry(undefined);
        setJimakuFiles(undefined);
    }, []);

    useEffect(() => {
        if (open) {
            resetState();
            setQuery(normalizedDetectedTitleHint);
        }
    }, [open, normalizedDetectedTitleHint, resetState]);

    const handleSearchJimaku = useCallback(async () => {
        setError(undefined);
        setSearching(true);
        setFilterString('');

        try {
            const client = new JimakuClient({ apiKey: jimakuApiKey });
            const entries = (await client.searchEntries(query)).data;
            setLastQuery(query);
            setJimakuEntries(entries.map((entry) => ({ id: entry.id, name: entry.name })));
            setJimakuSelectedEntry(undefined);
            setJimakuFiles(undefined);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSearching(false);
        }
    }, [jimakuApiKey, query]);

    const handleLoadJimakuFiles = useCallback(
        async (entry: JimakuEntry) => {
            setError(undefined);
            setSearching(true);
            setFilterString('');
            setJimakuSelectedEntry(entry);

            try {
                const client = new JimakuClient({ apiKey: jimakuApiKey });
                const files = (await client.getFiles(entry.id)).data
                    .filter((file) => isSupportedSubtitleFile(file.name))
                    .map((file) => ({ name: file.name, url: file.url }));
                setJimakuFiles(files);
            } catch (e) {
                setError((e as Error).message);
                setJimakuFiles(undefined);
            } finally {
                setSearching(false);
            }
        },
        [jimakuApiKey]
    );

    const handleImport = useCallback(
        async (file: OnlineSubtitleImportCandidate) => {
            setError(undefined);
            setLoadingFiles(true);

            try {
                await onImport(file);
                onClose();
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoadingFiles(false);
            }
        },
        [onClose, onImport]
    );

    const handleSearch = handleSearchJimaku;

    const [filterString, setFilterString] = useState<string>('');
    const filteredJimakuEntries = useMemo(() => {
        return jimakuEntries.filter((entry) => entry.name.toLowerCase().includes(filterString.toLowerCase()));
    }, [filterString, jimakuEntries]);
    const filteredJimakuFiles = useMemo(() => {
        return jimakuFiles?.filter((f) => f.name.toLowerCase().includes(filterString.toLowerCase()));
    }, [filterString, jimakuFiles]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>
                    {t('onlineSubtitleSources.searchOnlineSubtitles')}
                </Typography>
                <IconButton onClick={onClose} edge="end">
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent>
                <Stack spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            autoFocus
                            margin="dense"
                            label={t('onlineSubtitleSources.searchTerm')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(evt) => {
                                if (evt.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                            fullWidth
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                loading={searching}
                                                onClick={handleSearch}
                                                disabled={isSearchDisabled}
                                            >
                                                <SearchIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                    </Box>

                    <TextField
                        label={t('onlineSubtitleSources.jimakuApiKey')}
                        value={jimakuApiKey}
                        onChange={(e) => onJimakuApiKeyChange(e.target.value)}
                        helperText={
                            <Trans
                                i18nKey="onlineSubtitleSources.jimakuApiKeyAutosaveHint"
                                components={[
                                    <Link
                                        key={0}
                                        href="https://jimaku.cc/account"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        underline="hover"
                                    >
                                        here
                                    </Link>,
                                ]}
                            />
                        }
                        fullWidth
                    />

                    {lastQuery !== undefined && (
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            {jimakuFiles === undefined && (
                                <>
                                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                                        {t('onlineSubtitleSources.entries')} ({jimakuEntries.length})
                                    </Typography>
                                    <FilterTextField filterString={filterString} onChange={setFilterString} />
                                    <List
                                        dense
                                        sx={{
                                            maxHeight: 220,
                                            overflow: 'auto',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        {filteredJimakuEntries.map((entry) => (
                                            <ListItemButton
                                                key={entry.id}
                                                onClick={() => handleLoadJimakuFiles(entry)}
                                                disabled={loadingFiles}
                                            >
                                                <ListItemText primary={entry.name} />
                                            </ListItemButton>
                                        ))}
                                        {filteredJimakuEntries.length === 0 && (
                                            <ListItem>
                                                <ListItemText primary={t('onlineSubtitleSources.noEntries')} />
                                            </ListItem>
                                        )}
                                    </List>
                                </>
                            )}

                            {jimakuFiles !== undefined && jimakuSelectedEntry !== undefined && (
                                <>
                                    <Box display="flex" sx={{ alignItems: 'center' }}>
                                        <IconButton
                                            size="small"
                                            sx={{ p: 0.5 }}
                                            onClick={() => {
                                                setJimakuFiles(undefined);
                                                setFilterString('');
                                            }}
                                        >
                                            <ChevronLeftIcon />
                                        </IconButton>
                                        <Typography variant="subtitle1" noWrap>
                                            {jimakuSelectedEntry.name}
                                        </Typography>
                                        <Typography variant="subtitle1">&nbsp;({jimakuFiles.length})</Typography>
                                    </Box>
                                    <FilterTextField filterString={filterString} onChange={setFilterString} />
                                    <List
                                        dense
                                        sx={{
                                            maxHeight: 220,
                                            overflow: 'auto',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        {filteredJimakuFiles?.map((file) => (
                                            <ListItemButton key={file.url} onClick={() => handleImport(file)}>
                                                <ListItemText primary={file.name} />
                                            </ListItemButton>
                                        ))}
                                        {filteredJimakuFiles?.length === 0 && (
                                            <ListItem>
                                                <ListItemText primary={t('onlineSubtitleSources.noFiles')} />
                                            </ListItem>
                                        )}
                                    </List>
                                </>
                            )}
                        </Stack>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
            </DialogActions>
        </Dialog>
    );
}
