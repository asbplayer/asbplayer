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
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { JimakuClient } from '@project/common/subtitle-sources';
import type { JimakuEntry, JimakuFile } from '@project/common/subtitle-sources';
import { EPISODE_PATTERNS } from '@project/common/subtitle-sources/jimaku-episode-patterns';
import type { JimakuCachedWork } from '@project/common/global-state';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Toolbar from '@mui/material/Toolbar';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { asbError, asbWarn } from '@project/common/util';

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
    jimakuSearchCategory: 'anime' | 'drama';
    onJimakuSearchCategoryChange: (category: 'anime' | 'drama') => void;
    jimakuRecentWorks: JimakuCachedWork[];
    onJimakuRecentWorksChange: (recentWorks: JimakuCachedWork[]) => void;
}

const SUPPORTED_JIMAKU_EXTENSIONS = ['.srt', '.ass'];
const MAX_RECENT_WORKS = 10;

const isSupportedSubtitleFile = (name: string) =>
    SUPPORTED_JIMAKU_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

// Detect episode and strip the matched marker from the title in one pass, so the
// search query stays clean for every supported format (SxxExx, EP, CJK episode markers).
const prepareHint = (hint?: string): { episode: number | undefined; cleaned: string } => {
    const trimmed = hint?.trim() ?? '';
    if (trimmed.length === 0) {
        return { episode: undefined, cleaned: '' };
    }

    let episode: number | undefined;
    let stripped = trimmed;
    for (const { regex, parse } of EPISODE_PATTERNS) {
        const match = regex.exec(stripped);
        if (match?.[1] === undefined) {
            continue;
        }
        const parsed = parse(match[1]);
        if (parsed === undefined) {
            continue;
        }
        episode = parsed;
        stripped = stripped.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
        break;
    }

    const suffixSplit = stripped.split(' - ');
    const cleaned = suffixSplit.length > 1 ? suffixSplit[0].trim() : stripped;
    return { episode, cleaned };
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
    jimakuSearchCategory,
    onJimakuSearchCategoryChange,
    jimakuRecentWorks,
    onJimakuRecentWorksChange,
}: Props) {
    const { t } = useTranslation();
    const [searching, setSearching] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [error, setError] = useState<string>();

    const [query, setQuery] = useState('');
    const [lastQuery, setLastQuery] = useState<string>();
    const [lastSearchCategory, setLastSearchCategory] = useState<string>();
    const [jimakuEntries, setJimakuEntries] = useState<{ id: number; name: string }[]>([]);
    const [jimakuSelectedEntry, setJimakuSelectedEntry] = useState<{ id: number; name: string }>();
    const [jimakuFiles, setJimakuFiles] = useState<OnlineSubtitleImportCandidate[]>();
    const [loadingJimakuFiles, setLoadingJimakuFiles] = useState(false);
    const [detectedEpisode, setDetectedEpisode] = useState<number | undefined>(undefined);
    const [activeEpisodeFilter, setActiveEpisodeFilter] = useState<number | undefined>(undefined);
    const resultsCache = useRef<Map<string, { anime: JimakuEntry[]; drama: JimakuEntry[] }>>(new Map());

    // Ref to avoid stale closure in upsertRecentWork
    const recentWorksRef = useRef(jimakuRecentWorks);
    recentWorksRef.current = jimakuRecentWorks;

    // Guards against out-of-order responses when user navigates quickly
    const selectedEntryIdRef = useRef<number | undefined>(undefined);
    const fileLoadRequestIdRef = useRef(0);

    const upsertRecentWork = useCallback(
        (work: JimakuCachedWork) => {
            const next = [work, ...recentWorksRef.current.filter((w) => w.id !== work.id)].slice(0, MAX_RECENT_WORKS);
            recentWorksRef.current = next;
            onJimakuRecentWorksChange(next);
        },
        [onJimakuRecentWorksChange]
    );

    const { episode: hintEpisode, cleaned: cleanedHint } = useMemo(
        () => prepareHint(detectedTitleHint),
        [detectedTitleHint]
    );
    const isApiKeyMissing = jimakuApiKey.trim().length === 0;
    const isSearchDisabled =
        searching ||
        loadingJimakuFiles ||
        query.trim().length === 0 ||
        isApiKeyMissing ||
        (lastQuery === query && lastSearchCategory === jimakuSearchCategory) ||
        loadingFiles;

    const resetState = useCallback(() => {
        setSearching(false);
        setError(undefined);
        setJimakuEntries([]);
        setJimakuSelectedEntry(undefined);
        setJimakuFiles(undefined);
        setLoadingJimakuFiles(false);
        setLastQuery(undefined);
        setLastSearchCategory(undefined);
        setActiveEpisodeFilter(undefined);
        selectedEntryIdRef.current = undefined;
        fileLoadRequestIdRef.current += 1;
    }, []);

    useEffect(() => {
        if (open) {
            resetState();
            setQuery(cleanedHint);
            setDetectedEpisode(hintEpisode);
        }
    }, [open, cleanedHint, hintEpisode, resetState]);

    useEffect(() => {
        resultsCache.current.clear();
    }, [query]);

    const handleSearchJimaku = useCallback(async () => {
        setError(undefined);
        setSearching(true);
        setFilterString('');
        fileLoadRequestIdRef.current += 1;
        selectedEntryIdRef.current = undefined;
        setLoadingJimakuFiles(false);

        try {
            const cacheKey = query.trim();
            const cached = resultsCache.current.get(cacheKey);
            if (cached) {
                const cachedResult = jimakuSearchCategory === 'anime' ? cached.anime : cached.drama;
                if (cachedResult.length > 0) {
                    setLastQuery(query);
                    setLastSearchCategory(jimakuSearchCategory);
                    setJimakuEntries(cachedResult.map((entry) => ({ id: entry.id, name: entry.name })));
                    setJimakuSelectedEntry(undefined);
                    setJimakuFiles(undefined);
                    selectedEntryIdRef.current = undefined;
                    setSearching(false);
                    return;
                }
            }

            const client = new JimakuClient({ apiKey: jimakuApiKey });
            const result =
                jimakuSearchCategory === 'anime'
                    ? await client.searchEntries(query)
                    : await client.searchEntries(query, false);

            setLastQuery(query);
            setLastSearchCategory(jimakuSearchCategory);
            setJimakuEntries(result.data.map((entry) => ({ id: entry.id, name: entry.name })));
            const cacheEntry = resultsCache.current.get(cacheKey) ?? { anime: [], drama: [] };
            if (jimakuSearchCategory === 'anime') {
                cacheEntry.anime = result.data;
            } else {
                cacheEntry.drama = result.data;
            }
            resultsCache.current.set(cacheKey, cacheEntry);
            setJimakuSelectedEntry(undefined);
            setJimakuFiles(undefined);
            selectedEntryIdRef.current = undefined;
        } catch (e) {
            asbError('subtitle/source', e);
            setError((e as Error).message);
        } finally {
            setSearching(false);
        }
    }, [jimakuApiKey, query, jimakuSearchCategory]);

    const prevCategoryRef = useRef(jimakuSearchCategory);
    useEffect(() => {
        if (prevCategoryRef.current !== jimakuSearchCategory && lastQuery !== undefined) {
            void handleSearchJimaku();
        }
        prevCategoryRef.current = jimakuSearchCategory;
    }, [handleSearchJimaku, jimakuSearchCategory, lastQuery]);

    const loadJimakuFiles = useCallback(
        async (entry: { id: number; name: string }, episode: number | undefined) => {
            const requestId = fileLoadRequestIdRef.current + 1;
            fileLoadRequestIdRef.current = requestId;

            setError(undefined);
            setFilterString('');
            setJimakuSelectedEntry(entry);
            selectedEntryIdRef.current = entry.id;
            setLoadingJimakuFiles(true);
            setJimakuFiles(undefined);
            setActiveEpisodeFilter(undefined);

            try {
                const client = new JimakuClient({ apiKey: jimakuApiKey });
                const toCandidates = (files: JimakuFile[]) =>
                    files
                        .filter((file) => isSupportedSubtitleFile(file.name))
                        .map((file) => ({ name: file.name, url: file.url }));

                let files = toCandidates((await client.getFiles(entry.id, { episode })).data);
                let appliedEpisode = episode;
                // Episode filter may legitimately return zero playable subtitles
                // (wrong episode, or only unsupported formats); fall back to all
                // files so the user never faces an empty "no subtitles" list.
                if (episode !== undefined && files.length === 0) {
                    asbWarn(
                        'subtitle/source',
                        `Jimaku returned no playable files for episode ${episode} on entry ${entry.id}, falling back to all files.`
                    );
                    files = toCandidates((await client.getFiles(entry.id)).data);
                    appliedEpisode = undefined;
                }

                if (fileLoadRequestIdRef.current === requestId && selectedEntryIdRef.current === entry.id) {
                    setJimakuFiles(files);
                    setActiveEpisodeFilter(appliedEpisode);
                    upsertRecentWork({ id: entry.id, name: entry.name });
                }
            } catch (e) {
                asbError('subtitle/source', e);
                if (fileLoadRequestIdRef.current === requestId && selectedEntryIdRef.current === entry.id) {
                    setError((e as Error).message);
                    setJimakuSelectedEntry(undefined);
                    selectedEntryIdRef.current = undefined;
                }
            } finally {
                if (fileLoadRequestIdRef.current === requestId) {
                    setLoadingJimakuFiles(false);
                }
            }
        },
        [jimakuApiKey, upsertRecentWork]
    );

    const handleLoadJimakuFiles = useCallback(
        (entry: { id: number; name: string }) => {
            void loadJimakuFiles(entry, detectedEpisode);
        },
        [loadJimakuFiles, detectedEpisode]
    );

    const handleClearEpisodeFilter = useCallback(() => {
        if (jimakuSelectedEntry !== undefined) {
            void loadJimakuFiles(jimakuSelectedEntry, undefined);
        }
    }, [loadJimakuFiles, jimakuSelectedEntry]);

    const handleImport = useCallback(
        async (file: OnlineSubtitleImportCandidate) => {
            setError(undefined);
            setLoadingFiles(true);

            try {
                await onImport(file);
                onClose();
            } catch (e) {
                asbError('subtitle/source', e);
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
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <TextField
                            autoFocus
                            margin="dense"
                            label={t('onlineSubtitleSources.searchTerm')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(evt) => {
                                if (evt.key === 'Enter') {
                                    void handleSearch();
                                }
                            }}
                            fullWidth
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <ToggleButtonGroup
                                                value={jimakuSearchCategory}
                                                exclusive
                                                size="small"
                                                sx={{ mr: 1.5, height: 36 }}
                                                onChange={(_, value) => {
                                                    if (value !== null) {
                                                        onJimakuSearchCategoryChange(value);
                                                    }
                                                }}
                                            >
                                                <ToggleButton value="anime">
                                                    {t('onlineSubtitleSources.categoryAnime')}
                                                </ToggleButton>
                                                <ToggleButton value="drama">
                                                    {t('onlineSubtitleSources.categoryDrama')}
                                                </ToggleButton>
                                            </ToggleButtonGroup>
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

                    {lastQuery !== undefined && jimakuSelectedEntry === undefined && (
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
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
                                        disabled={loadingFiles || loadingJimakuFiles || isApiKeyMissing}
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
                        </Stack>
                    )}

                    {jimakuSelectedEntry !== undefined && (
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            <Box display="flex" sx={{ alignItems: 'center' }}>
                                <IconButton
                                    size="small"
                                    sx={{ p: 0.5 }}
                                    onClick={() => {
                                        fileLoadRequestIdRef.current += 1;
                                        setLoadingJimakuFiles(false);
                                        setJimakuFiles(undefined);
                                        setJimakuSelectedEntry(undefined);
                                        selectedEntryIdRef.current = undefined;
                                        setFilterString('');
                                        setActiveEpisodeFilter(undefined);
                                    }}
                                >
                                    <ChevronLeftIcon />
                                </IconButton>
                                <Typography variant="subtitle1" noWrap>
                                    {jimakuSelectedEntry.name}
                                </Typography>
                                {jimakuFiles !== undefined && (
                                    <Typography variant="subtitle1">&nbsp;({jimakuFiles.length})</Typography>
                                )}
                                {activeEpisodeFilter !== undefined && (
                                    <Chip
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ ml: 'auto' }}
                                        label={`EP ${activeEpisodeFilter}`}
                                        onDelete={handleClearEpisodeFilter}
                                    />
                                )}
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
                                {jimakuFiles === undefined && loadingJimakuFiles && (
                                    <ListItem sx={{ justifyContent: 'center' }}>
                                        <CircularProgress size={20} />
                                    </ListItem>
                                )}
                                {filteredJimakuFiles?.map((file) => (
                                    <ListItemButton
                                        key={file.url}
                                        onClick={() => handleImport(file)}
                                        disabled={loadingFiles}
                                    >
                                        <ListItemText primary={file.name} />
                                    </ListItemButton>
                                ))}
                                {filteredJimakuFiles?.length === 0 && (
                                    <ListItem>
                                        <ListItemText primary={t('onlineSubtitleSources.noFiles')} />
                                    </ListItem>
                                )}
                            </List>
                        </Stack>
                    )}

                    {lastQuery === undefined && jimakuSelectedEntry === undefined && jimakuRecentWorks.length > 0 && (
                        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                                {t('onlineSubtitleSources.recentEntries')}
                            </Typography>
                            <List
                                dense
                                sx={{
                                    maxHeight: 220,
                                    overflow: 'auto',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                {jimakuRecentWorks.map((entry) => (
                                    <ListItemButton
                                        key={entry.id}
                                        onClick={() => handleLoadJimakuFiles(entry)}
                                        disabled={loadingFiles || loadingJimakuFiles || isApiKeyMissing}
                                    >
                                        <ListItemText primary={entry.name} />
                                    </ListItemButton>
                                ))}
                            </List>
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
