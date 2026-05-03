import { memo, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import CloseIcon from '@mui/icons-material/Close';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import FilterListIcon from '@mui/icons-material/FilterList';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
    DictionaryAnkiCardRecordsByTrack,
    DictionaryAnkiCardRecord,
    DictionaryProvider,
    DictionaryTokenKey,
    DictionaryTokenRecord,
    LOCAL_TOKEN_TRACK,
} from '@project/common/dictionary-db';
import {
    ApplyStrategy,
    DictionaryTokenSource,
    DictionaryTrack,
    getFullyKnownTokenStatus,
    TokenState,
    TokenStatus,
} from '@project/common/settings';
import { getCardTokenStatus } from '@project/common/subtitle-annotations';
import { normalizeForSearch } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan';

type SortField = 'token' | 'lemmas' | 'source' | 'status' | 'states' | 'track' | 'cardIds' | 'noteIds' | 'suspended';
type SortDirection = 'asc' | 'desc';
type MatchGroup = 0 | 1 | 2 | 3 | 4;
type SuspendedFilter = 'all' | 'yes' | 'no' | 'mixed';
type FilterMode = 'include' | 'exclude';
type FilterPopoverKey = 'search' | 'source' | 'status' | 'states' | 'track' | 'cardIds' | 'noteIds' | 'suspended';

interface Props {
    open: boolean;
    dictionaryProvider: DictionaryProvider;
    activeProfile?: string;
    dictionaryTracks: DictionaryTrack[];
    onClose: () => void;
}

interface SearchExpansion {
    exactTerms: string[];
    lemmaTerms: string[];
    yomitanErrors?: { track: number; message: string }[];
}

interface TrackError {
    track: number;
    message: string;
}

interface WordBrowserRow {
    tokenKey: DictionaryTokenKey;
    selectionKey: string;
    selectable: boolean;
    token: string;
    tokenSearchTerms: string[];
    lemmas: string[];
    lemmasDisplay: string;
    lemmaSearchTerms: string[];
    source: DictionaryTokenSource;
    sourceDisplay: string;
    status: TokenStatus;
    statusColor: string;
    states: TokenState[];
    statesDisplay: string;
    trackDisplay: string;
    trackSortValue: number;
    cardIds: number[];
    cardIdsDisplay: string;
    noteIds: number[];
    noteIdsDisplay: string;
    suspendedDisplay: string;
    suspendedFilterValue: SuspendedFilter;
    suspendedSortValue: number;
    suspendedColor?: string;
}

interface ViewCriteria {
    searchQuery: string;
    selectedSourceFilters: Partial<Record<DictionaryTokenSource, FilterMode>>;
    selectedStatusFilters: Partial<Record<TokenStatus, FilterMode>>;
    selectedStateFilters: Partial<Record<TokenState, FilterMode>>;
    selectedTrackFilters: Partial<Record<number, FilterMode>>;
    cardIdFilter: string;
    noteIdFilter: string;
    suspendedFilter: SuspendedFilter;
    sortField: SortField;
    sortDirection: SortDirection;
}

type AutoRefreshViewCriteria = Pick<
    ViewCriteria,
    | 'searchQuery'
    | 'selectedSourceFilters'
    | 'selectedStatusFilters'
    | 'selectedStateFilters'
    | 'selectedTrackFilters'
    | 'cardIdFilter'
    | 'noteIdFilter'
    | 'suspendedFilter'
    | 'sortField'
    | 'sortDirection'
>;

interface WordBrowserTableRowProps {
    row: WordBrowserRow;
    selected: boolean;
    onSelectRow: (selectionKey: string, options: { shiftKey: boolean }) => void;
    renderStatusLabel: (status: TokenStatus, color?: string) => React.ReactNode;
}

type FilterModeValue = string | number;
type FilterMap<T extends FilterModeValue> = Partial<Record<T, FilterMode>>;
type FilterCriteriaKey =
    | 'selectedSourceFilters'
    | 'selectedStatusFilters'
    | 'selectedStateFilters'
    | 'selectedTrackFilters';
type FilterCriteriaValue<K extends FilterCriteriaKey> = ViewCriteria[K] extends FilterMap<infer T> ? T : never;
type TextCriteriaKey = 'searchQuery' | 'cardIdFilter' | 'noteIdFilter';

interface CyclingFilterListProps<T extends FilterModeValue> {
    options: readonly T[];
    selectedFilters: FilterMap<T>;
    onToggle: (value: T) => void;
    renderMenuItemLabel: (value: T) => React.ReactNode;
}

function normalizeSearchText(text: string) {
    return text.normalize('NFKC').trim().toLocaleLowerCase();
}

function normalizedLookupTerms(...texts: Array<string | null | undefined>) {
    return Array.from(
        new Set(
            texts
                .flatMap((text) => {
                    if (!text) return [];
                    const normalized = normalizeForSearch(text);
                    if (!normalized.length || normalized === text) return [text];
                    return [text, normalized];
                })
                .filter((text) => Boolean(text))
                .map(normalizeSearchText)
                .filter((text) => text.length)
        )
    );
}

function matchesSearchTerm(searchTerms: string[], term: string) {
    return searchTerms.some((searchTerm) => searchTerm.includes(term));
}

function hasExactSearchTermMatch(searchTerms: string[], term: string) {
    return searchTerms.includes(term);
}

function nextFilterMode(currentMode?: FilterMode) {
    if (currentMode === undefined) return 'include' as const;
    if (currentMode === 'include') return 'exclude' as const;
    return undefined;
}

function cycleFilterMode<T extends FilterModeValue>(filters: FilterMap<T>, value: T): FilterMap<T> {
    const nextFilters = { ...filters };
    const nextMode = nextFilterMode(nextFilters[value]);

    if (nextMode === undefined) {
        delete nextFilters[value];
    } else {
        nextFilters[value] = nextMode;
    }

    return nextFilters;
}

function renderFilterLabel(label: string, mode?: FilterMode) {
    return mode === 'exclude' ? `- ${label}` : label;
}

function cycleViewCriteriaFilter<K extends FilterCriteriaKey>(
    criteria: ViewCriteria,
    key: K,
    value: FilterCriteriaValue<K>
): ViewCriteria {
    return {
        ...criteria,
        [key]: cycleFilterMode(criteria[key] as FilterMap<FilterCriteriaValue<K>>, value),
    } as ViewCriteria;
}

function tokenKeyToString(key: DictionaryTokenKey) {
    return JSON.stringify(key);
}

function compareValues(lhs: string | number, rhs: string | number) {
    if (typeof lhs === 'number' && typeof rhs === 'number') return lhs - rhs;
    return String(lhs).localeCompare(String(rhs), undefined, { sensitivity: 'base', numeric: true });
}

function dedupeNumbers(values: number[]) {
    return Array.from(new Set(values)).sort((lhs, rhs) => lhs - rhs);
}

function formatList(values: Array<string | number>) {
    return values.join(' · ');
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function dedupedTrackErrors(errors: TrackError[]) {
    return Array.from(new Map(errors.map((error) => [`${error.track}:${error.message}`, error])).values());
}

function filterableTokenStatuses() {
    const statuses: TokenStatus[] = [];
    for (let status = getFullyKnownTokenStatus(); status >= TokenStatus.UNCOLLECTED; --status) {
        statuses.push(status as TokenStatus);
    }
    return statuses;
}

function filterableTokenSources() {
    return [
        DictionaryTokenSource.LOCAL,
        DictionaryTokenSource.ANKI_WORD,
        DictionaryTokenSource.ANKI_SENTENCE,
    ] as DictionaryTokenSource[];
}

const FILTERABLE_STATES: readonly TokenState[] = [TokenState.IGNORED];

function defaultViewCriteria(): ViewCriteria {
    return {
        searchQuery: '',
        selectedSourceFilters: {},
        selectedStatusFilters: {},
        selectedStateFilters: {},
        selectedTrackFilters: {},
        cardIdFilter: '',
        noteIdFilter: '',
        suspendedFilter: 'all',
        sortField: 'token',
        sortDirection: 'asc',
    };
}

function autoRefreshViewCriteria(viewCriteria: ViewCriteria): AutoRefreshViewCriteria {
    return {
        searchQuery: viewCriteria.searchQuery,
        selectedSourceFilters: viewCriteria.selectedSourceFilters,
        selectedStatusFilters: viewCriteria.selectedStatusFilters,
        selectedStateFilters: viewCriteria.selectedStateFilters,
        selectedTrackFilters: viewCriteria.selectedTrackFilters,
        cardIdFilter: viewCriteria.cardIdFilter,
        noteIdFilter: viewCriteria.noteIdFilter,
        suspendedFilter: viewCriteria.suspendedFilter,
        sortField: viewCriteria.sortField,
        sortDirection: viewCriteria.sortDirection,
    };
}

function autoRefreshCriteriaEqual(lhs: AutoRefreshViewCriteria, rhs: AutoRefreshViewCriteria) {
    return (
        lhs.searchQuery === rhs.searchQuery &&
        lhs.cardIdFilter === rhs.cardIdFilter &&
        lhs.noteIdFilter === rhs.noteIdFilter &&
        lhs.suspendedFilter === rhs.suspendedFilter &&
        lhs.sortField === rhs.sortField &&
        lhs.sortDirection === rhs.sortDirection &&
        Object.keys(lhs.selectedTrackFilters).length === Object.keys(rhs.selectedTrackFilters).length &&
        Object.keys(lhs.selectedTrackFilters).every(
            (track) => lhs.selectedTrackFilters[Number(track)] === rhs.selectedTrackFilters[Number(track)]
        ) &&
        filterableTokenSources().every(
            (source) => lhs.selectedSourceFilters[source] === rhs.selectedSourceFilters[source]
        ) &&
        filterableTokenStatuses().every(
            (status) => lhs.selectedStatusFilters[status] === rhs.selectedStatusFilters[status]
        ) &&
        FILTERABLE_STATES.every((state) => lhs.selectedStateFilters[state] === rhs.selectedStateFilters[state])
    );
}

function applyAutoRefreshViewCriteria(
    currentViewCriteria: ViewCriteria,
    nextAutoRefreshCriteria: AutoRefreshViewCriteria
): ViewCriteria {
    return {
        ...currentViewCriteria,
        ...nextAutoRefreshCriteria,
    };
}

const textFilterAutoRefreshDelayMs = 500;
const multiSelectAutoRefreshDelayMs = 300;
const singleSelectAutoRefreshDelayMs = 0;
const allPageSize = -1;
const pageSizeOptions = [10, 100, 1000, 10000, allPageSize] as const;

const WordBrowserTableRow = memo(function WordBrowserTableRow({
    row,
    selected,
    onSelectRow,
    renderStatusLabel,
}: WordBrowserTableRowProps) {
    const handleSelect = useCallback(
        (event: ReactMouseEvent) => {
            if (!row.selectable) return;
            onSelectRow(row.selectionKey, {
                shiftKey: event.shiftKey,
            });
        },
        [onSelectRow, row.selectable, row.selectionKey]
    );

    return (
        <TableRow
            hover
            selected={selected}
            onMouseDown={(event) => {
                if (event.shiftKey) event.preventDefault();
            }}
            onClick={handleSelect}
            sx={row.selectable ? { cursor: 'pointer' } : undefined}
        >
            <TableCell padding="checkbox">
                {row.selectable && (
                    <Checkbox
                        checked={selected}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleSelect(event);
                        }}
                        onChange={() => undefined}
                    />
                )}
            </TableCell>
            <TableCell>{row.token}</TableCell>
            <TableCell>{row.lemmasDisplay}</TableCell>
            <TableCell>{row.sourceDisplay}</TableCell>
            <TableCell>{renderStatusLabel(row.status, row.statusColor)}</TableCell>
            <TableCell>{row.statesDisplay}</TableCell>
            <TableCell>{row.trackDisplay}</TableCell>
            <TableCell>{row.cardIdsDisplay}</TableCell>
            <TableCell>{row.noteIdsDisplay}</TableCell>
            <TableCell>
                <Typography sx={{ color: row.suspendedColor }}>{row.suspendedDisplay}</Typography>
            </TableCell>
        </TableRow>
    );
});

function CyclingFilterList<T extends FilterModeValue>({
    options,
    selectedFilters,
    onToggle,
    renderMenuItemLabel,
}: CyclingFilterListProps<T>) {
    return (
        <Stack spacing={0.5}>
            {options.map((value) => (
                <MenuItem key={String(value)} value={value} onClick={() => onToggle(value)} sx={{ borderRadius: 1 }}>
                    <Checkbox
                        checked={selectedFilters[value] === 'include'}
                        indeterminate={selectedFilters[value] === 'exclude'}
                    />
                    {renderMenuItemLabel(value)}
                </MenuItem>
            ))}
        </Stack>
    );
}

export default function WordBrowserDialog({
    open,
    dictionaryProvider,
    activeProfile,
    dictionaryTracks,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
    const defaultDictionaryTrack = dictionaryTracks[0];
    const yomitans = useMemo(
        () => dictionaryTracks.map((dictionaryTrack) => new Yomitan(dictionaryTrack)),
        [dictionaryTracks]
    );
    const yomitanVersionPromiseRef = useRef<Promise<TrackError[]> | undefined>(undefined);
    const filterableSources = useMemo(() => filterableTokenSources(), []);
    const filterableStates = FILTERABLE_STATES;
    const filterStatusOptions = useMemo(() => filterableTokenStatuses(), []);
    const [records, setRecords] = useState<{
        tokenRecords: DictionaryTokenRecord[];
        ankiCardRecords: DictionaryAnkiCardRecordsByTrack;
    }>({
        tokenRecords: [],
        ankiCardRecords: {},
    });
    const [loading, setLoading] = useState(false);
    const [mutating, setMutating] = useState(false);
    const [loadError, setLoadError] = useState<string>();
    const [draftViewCriteria, setDraftViewCriteria] = useState<ViewCriteria>(() => defaultViewCriteria());
    const [appliedViewCriteria, setAppliedViewCriteria] = useState<ViewCriteria>(() => defaultViewCriteria());
    const [searchExpansion, setSearchExpansion] = useState<SearchExpansion>({ exactTerms: [], lemmaTerms: [] });
    const [searchExpansionRefreshToken, setSearchExpansionRefreshToken] = useState(0);
    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<TokenStatus | ''>('');
    const [bulkIgnoredState, setBulkIgnoredState] = useState<FilterMode>();
    const [bulkStates, setBulkStates] = useState<TokenState[]>([]);
    const [bulkStatesApplyStrategy, setBulkStatesApplyStrategy] = useState<ApplyStrategy>(ApplyStrategy.REPLACE);
    const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [openFilterPopover, setOpenFilterPopover] = useState<{ key: FilterPopoverKey; anchorEl: HTMLElement }>();
    const [pendingAutoRefreshDelayMs, setPendingAutoRefreshDelayMs] = useState<number>();
    const [pageSize, setPageSize] = useState<number>(100);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageInput, setPageInput] = useState('1');
    const loadRequestIdRef = useRef(0);
    const selectionAnchorKeyRef = useRef<string | undefined>(undefined);
    const tableContainerRef = useRef<HTMLDivElement | null>(null);
    const draftAutoRefreshCriteria = useMemo(() => autoRefreshViewCriteria(draftViewCriteria), [draftViewCriteria]);
    const appliedAutoRefreshCriteria = useMemo(
        () => autoRefreshViewCriteria(appliedViewCriteria),
        [appliedViewCriteria]
    );

    const updateDraftViewCriteria = useCallback((delayMs: number, updater: (current: ViewCriteria) => ViewCriteria) => {
        setPendingAutoRefreshDelayMs(delayMs);
        setDraftViewCriteria(updater);
    }, []);

    const updateDraftTextCriteria = useCallback(
        (key: TextCriteriaKey, value: string, delayMs = textFilterAutoRefreshDelayMs) => {
            updateDraftViewCriteria(delayMs, (current) => ({
                ...current,
                [key]: value,
            }));
        },
        [updateDraftViewCriteria]
    );

    const clearDraftTextCriteria = useCallback(
        (key: TextCriteriaKey) => updateDraftTextCriteria(key, '', singleSelectAutoRefreshDelayMs),
        [updateDraftTextCriteria]
    );

    const cycleFilter = useCallback(
        <K extends FilterCriteriaKey>(key: K, value: FilterCriteriaValue<K>) => {
            updateDraftViewCriteria(multiSelectAutoRefreshDelayMs, (current) =>
                cycleViewCriteriaFilter(current, key, value)
            );
        },
        [updateDraftViewCriteria]
    );

    const loadRecords = useCallback(
        async (viewCriteria: ViewCriteria) => {
            const requestId = ++loadRequestIdRef.current;
            setPendingAutoRefreshDelayMs(undefined);
            setAppliedViewCriteria(viewCriteria);
            yomitanVersionPromiseRef.current = undefined;
            setSearchExpansionRefreshToken((current) => current + 1);
            setLoading(true);
            setLoadError(undefined);
            try {
                const nextRecords = await dictionaryProvider.getRecords(activeProfile, undefined);
                if (requestId !== loadRequestIdRef.current) return;
                setRecords(nextRecords);
            } catch (error) {
                if (requestId !== loadRequestIdRef.current) return;
                setLoadError(errorMessage(error));
            } finally {
                if (requestId !== loadRequestIdRef.current) return;
                setLoading(false);
            }
        },
        [dictionaryProvider, activeProfile]
    );

    useEffect(() => {
        if (!open) return;
        const initialViewCriteria = defaultViewCriteria();
        setDraftViewCriteria(initialViewCriteria);
        setSelectedRowKeys(new Set());
        setBulkStatus('');
        setBulkIgnoredState(undefined);
        setBulkStates([]);
        setBulkStatesApplyStrategy(ApplyStrategy.REPLACE);
        setConfirmApplyOpen(false);
        setConfirmDeleteOpen(false);
        setOpenFilterPopover(undefined);
        setPageSize(100);
        setCurrentPage(0);
        setPageInput('1');
        selectionAnchorKeyRef.current = undefined;
        void loadRecords(initialViewCriteria);
    }, [loadRecords, open]);

    useEffect(() => {
        if (!open || autoRefreshCriteriaEqual(appliedAutoRefreshCriteria, draftAutoRefreshCriteria)) return;
        if (pendingAutoRefreshDelayMs === undefined) return;
        const timeoutId = setTimeout(() => {
            setAppliedViewCriteria((current) => {
                const currentAutoRefreshCriteria = autoRefreshViewCriteria(current);
                if (autoRefreshCriteriaEqual(currentAutoRefreshCriteria, draftAutoRefreshCriteria)) return current;
                return applyAutoRefreshViewCriteria(current, draftAutoRefreshCriteria);
            });
            setPendingAutoRefreshDelayMs(undefined);
        }, pendingAutoRefreshDelayMs);
        return () => clearTimeout(timeoutId);
    }, [appliedAutoRefreshCriteria, draftAutoRefreshCriteria, open, pendingAutoRefreshDelayMs]);

    useEffect(() => {
        if (open) return;
        loadRequestIdRef.current += 1;
        const initialViewCriteria = defaultViewCriteria();
        setRecords({ tokenRecords: [], ankiCardRecords: {} });
        setLoading(false);
        setDraftViewCriteria(initialViewCriteria);
        setAppliedViewCriteria(initialViewCriteria);
        setSelectedRowKeys(new Set());
        setLoadError(undefined);
        setSearchExpansion({ exactTerms: [], lemmaTerms: [] });
        setBulkStatus('');
        setBulkIgnoredState(undefined);
        setBulkStates([]);
        setBulkStatesApplyStrategy(ApplyStrategy.REPLACE);
        setConfirmApplyOpen(false);
        setConfirmDeleteOpen(false);
        setOpenFilterPopover(undefined);
        setPageSize(100);
        setCurrentPage(0);
        setPageInput('1');
        selectionAnchorKeyRef.current = undefined;
        setPendingAutoRefreshDelayMs(undefined);
    }, [open]);

    const ensureYomitanVersion = useCallback(async () => {
        if (yomitanVersionPromiseRef.current) return yomitanVersionPromiseRef.current;
        const versionPromise = Promise.allSettled(yomitans.map((yomitan) => yomitan.version())).then((results) =>
            dedupedTrackErrors(
                results.flatMap((result, track) =>
                    result.status === 'rejected' ? [{ track, message: errorMessage(result.reason) }] : []
                )
            )
        );
        yomitanVersionPromiseRef.current = versionPromise;
        return versionPromise;
    }, [yomitans]);

    useEffect(() => {
        yomitanVersionPromiseRef.current = undefined;
    }, [yomitans]);

    const statusColorForTrack = useCallback((dictionaryTrack: DictionaryTrack | undefined, status: TokenStatus) => {
        const config = dictionaryTrack?.dictionaryTokenStatusConfig[status] ?? {
            color: '#9E9E9E',
            alpha: 'FF',
            display: true,
        };
        return `${config.color}${config.alpha}`;
    }, []);

    const dictionaryTrackForTrackValue = useCallback(
        (trackValue: number) =>
            trackValue === LOCAL_TOKEN_TRACK ? defaultDictionaryTrack : dictionaryTracks[trackValue - 1],
        [defaultDictionaryTrack, dictionaryTracks]
    );

    const statusColorForTrackValue = useCallback(
        (trackValue: number, status: TokenStatus) =>
            statusColorForTrack(dictionaryTrackForTrackValue(trackValue), status),
        [dictionaryTrackForTrackValue, statusColorForTrack]
    );

    const statusColorForTrackValues = useCallback(
        (trackValues: number[], status: TokenStatus) => {
            const colors = Array.from(
                new Set(trackValues.map((trackValue) => statusColorForTrackValue(trackValue, status)))
            );
            return colors.length === 1 ? colors[0] : undefined;
        },
        [statusColorForTrackValue]
    );

    const tokenizeAcrossTracks = useCallback(
        async (queryForm: string) => {
            const terms = new Set<string>();
            const errors: TrackError[] = [];
            const results = await Promise.allSettled(yomitans.map((yomitan) => yomitan.tokenize(queryForm)));

            for (const [track, result] of results.entries()) {
                if (result.status === 'rejected') {
                    errors.push({ track, message: errorMessage(result.reason) });
                    continue;
                }

                for (const tokenParts of result.value) {
                    const tokenText = tokenParts
                        .map((part) => part.text)
                        .join('')
                        .trim();
                    if (tokenText.length) terms.add(tokenText);
                }
            }

            return { terms: Array.from(terms), errors: dedupedTrackErrors(errors) };
        },
        [yomitans]
    );

    const lemmatizeAcrossTracks = useCallback(
        async (term: string) => {
            const lemmas = new Set<string>();
            const errors: TrackError[] = [];
            const results = await Promise.allSettled(yomitans.map((yomitan) => yomitan.lemmatize(term)));

            for (const [track, result] of results.entries()) {
                if (result.status === 'rejected') {
                    errors.push({ track, message: errorMessage(result.reason) });
                    continue;
                }

                for (const lemma of result.value ?? []) {
                    for (const normalizedLemma of normalizedLookupTerms(lemma)) {
                        lemmas.add(normalizedLemma);
                    }
                }
            }

            return { lemmas: Array.from(lemmas), errors: dedupedTrackErrors(errors) };
        },
        [yomitans]
    );

    useEffect(() => {
        if (!open) return;
        void ensureYomitanVersion();
    }, [ensureYomitanVersion, open]);

    const renderStatusLabel = useCallback(
        (status: TokenStatus, color?: string) => (
            <Typography component="span" sx={{ color, fontWeight: 500 }}>
                {t(`settings.dictionaryTokenStatus${status}`)}
            </Typography>
        ),
        [t]
    );

    useEffect(() => {
        if (!open) return;
        const trimmed = appliedViewCriteria.searchQuery.trim();
        if (!trimmed.length) {
            setSearchExpansion({ exactTerms: [], lemmaTerms: [] });
            return;
        }
        void (async () => {
            const queryForms = Array.from(new Set([trimmed])).filter((queryForm) => queryForm.length);
            const errors: TrackError[] = [...(await ensureYomitanVersion())];

            for (const queryForm of [...queryForms]) {
                const { terms, errors: tokenizeErrors } = await tokenizeAcrossTracks(queryForm);
                errors.push(...tokenizeErrors);
                for (const tokenText of terms) {
                    if (!queryForms.includes(tokenText)) queryForms.push(tokenText);
                }
            }

            const lemmaTerms = new Set<string>();
            for (const exactTerm of queryForms) {
                const { lemmas, errors: lemmaErrors } = await lemmatizeAcrossTracks(exactTerm);
                errors.push(...lemmaErrors);
                for (const lemma of lemmas) lemmaTerms.add(lemma);
            }

            setSearchExpansion({
                exactTerms: normalizedLookupTerms(...queryForms),
                lemmaTerms: Array.from(lemmaTerms),
                yomitanErrors: dedupedTrackErrors(errors),
            });
        })();
    }, [
        appliedViewCriteria.searchQuery,
        dictionaryTracks,
        ensureYomitanVersion,
        lemmatizeAcrossTracks,
        open,
        searchExpansionRefreshToken,
        tokenizeAcrossTracks,
    ]);

    const visibleYomitanError = useMemo(() => {
        const tracksWithDbEntries = new Set(
            records.tokenRecords.filter((record) => record.track !== LOCAL_TOKEN_TRACK).map((record) => record.track)
        );
        const relevantErrors = (searchExpansion.yomitanErrors ?? []).filter((error) =>
            tracksWithDbEntries.has(error.track)
        );
        if (!relevantErrors.length) return;

        return dedupedTrackErrors(relevantErrors)
            .map(({ track, message }) => `${t('settings.subtitleTrackChoice', { trackNumber: track + 1 })}: ${message}`)
            .join(' | ');
    }, [records.tokenRecords, searchExpansion.yomitanErrors, t]);

    const sourceLabels = useMemo(
        () => ({
            [DictionaryTokenSource.LOCAL]: t('settings.dictionaryBrowser.sources.local'),
            [DictionaryTokenSource.ANKI_WORD]: t('settings.dictionaryBrowser.sources.ankiWord'),
            [DictionaryTokenSource.ANKI_SENTENCE]: t('settings.dictionaryBrowser.sources.ankiSentence'),
        }),
        [t]
    );

    const stateLabels = useMemo(
        () => ({
            [TokenState.IGNORED]: t('settings.dictionaryTokenStateIgnored'),
        }),
        [t]
    );

    const renderStatusFilterLabel = useCallback(
        (status: TokenStatus) =>
            renderFilterLabel(
                t(`settings.dictionaryTokenStatus${status}`),
                draftViewCriteria.selectedStatusFilters[status]
            ),
        [draftViewCriteria.selectedStatusFilters, t]
    );

    const renderSourceFilterLabel = useCallback(
        (source: DictionaryTokenSource) =>
            renderFilterLabel(sourceLabels[source], draftViewCriteria.selectedSourceFilters[source]),
        [draftViewCriteria.selectedSourceFilters, sourceLabels]
    );

    const renderStateFilterLabel = useCallback(
        (state: TokenState) => renderFilterLabel(stateLabels[state], draftViewCriteria.selectedStateFilters[state]),
        [draftViewCriteria.selectedStateFilters, stateLabels]
    );

    const rows = useMemo(() => {
        return records.tokenRecords.map((record) => {
            const trackConfig =
                record.track === LOCAL_TOKEN_TRACK ? defaultDictionaryTrack : dictionaryTracks[record.track];
            const treatSuspended = trackConfig?.dictionaryAnkiTreatSuspended ?? false;
            const trackCardRecords = records.ankiCardRecords[record.track];
            const cardRecords = record.cardIds
                .map((cardId) => trackCardRecords?.[cardId])
                .filter((cardRecord): cardRecord is DictionaryAnkiCardRecord => cardRecord !== undefined);
            const noteIds = dedupeNumbers(cardRecords.map((cardRecord) => cardRecord.noteId));
            const status =
                record.source === DictionaryTokenSource.LOCAL
                    ? record.status!
                    : getCardTokenStatus(
                          cardRecords.map((cardRecord) => ({
                              cardId: cardRecord.cardId,
                              status: cardRecord.status,
                              suspended: cardRecord.suspended,
                          })),
                          treatSuspended
                      );
            const suspendedValues = Array.from(new Set(cardRecords.map((cardRecord) => cardRecord.suspended)));
            let suspendedDisplay = '';
            let suspendedFilterValue: SuspendedFilter = 'all';
            let suspendedSortValue = -1;
            let suspendedColor: string | undefined;

            if (record.source !== DictionaryTokenSource.LOCAL) {
                if (!suspendedValues.length || suspendedValues.every((value) => !value)) {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.no');
                    suspendedFilterValue = 'no';
                    suspendedSortValue = 0;
                    suspendedColor = theme.palette.success.main;
                } else if (suspendedValues.every(Boolean)) {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.yes');
                    suspendedFilterValue = 'yes';
                    suspendedSortValue = 2;
                    suspendedColor = theme.palette.warning.dark;
                } else {
                    suspendedDisplay = t('settings.dictionaryBrowser.suspended.mixed');
                    suspendedFilterValue = 'mixed';
                    suspendedSortValue = 1;
                    suspendedColor = theme.palette.warning.main;
                }
            }
            const lemmasDisplay = formatList(record.lemmas);
            const statesDisplay = formatList(record.states.map((state) => stateLabels[state]));
            const dedupedCardIds = dedupeNumbers(record.cardIds);

            return {
                tokenKey: [record.token, record.source, record.track, record.profile],
                selectionKey: tokenKeyToString([record.token, record.source, record.track, record.profile]),
                selectable: record.source === DictionaryTokenSource.LOCAL,
                token: record.token,
                tokenSearchTerms: normalizedLookupTerms(record.token),
                lemmas: record.lemmas,
                lemmasDisplay,
                lemmaSearchTerms: Array.from(new Set(record.lemmas.flatMap((lemma) => normalizedLookupTerms(lemma)))),
                source: record.source,
                sourceDisplay: sourceLabels[record.source],
                status,
                statusColor: statusColorForTrack(trackConfig, status),
                states: record.states,
                statesDisplay,
                trackDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : String(record.track + 1),
                trackSortValue: record.source === DictionaryTokenSource.LOCAL ? LOCAL_TOKEN_TRACK : record.track + 1,
                cardIds: dedupedCardIds,
                cardIdsDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : formatList(dedupedCardIds),
                noteIds,
                noteIdsDisplay: record.source === DictionaryTokenSource.LOCAL ? '' : formatList(noteIds),
                suspendedDisplay,
                suspendedFilterValue,
                suspendedSortValue,
                suspendedColor,
            } satisfies WordBrowserRow;
        });
    }, [
        defaultDictionaryTrack,
        dictionaryTracks,
        records,
        sourceLabels,
        statusColorForTrack,
        stateLabels,
        t,
        theme.palette.success.main,
        theme.palette.warning.dark,
        theme.palette.warning.main,
    ]);

    const trackFilterOptions = useMemo(() => {
        const trackValues = Array.from(new Set(rows.map((row) => row.trackSortValue))).sort((lhs, rhs) => lhs - rhs);
        return trackValues.map((trackValue) => ({
            value: trackValue,
            label:
                trackValue === LOCAL_TOKEN_TRACK
                    ? sourceLabels[DictionaryTokenSource.LOCAL]
                    : t('settings.subtitleTrackChoice', { trackNumber: trackValue }),
        }));
    }, [rows, sourceLabels, t]);

    const renderTrackFilterLabel = useCallback(
        (trackValue: number) => {
            const trackLabel =
                trackFilterOptions.find((option) => option.value === trackValue)?.label ??
                (trackValue === LOCAL_TOKEN_TRACK
                    ? sourceLabels[DictionaryTokenSource.LOCAL]
                    : t('settings.subtitleTrackChoice', { trackNumber: trackValue }));
            return renderFilterLabel(trackLabel, draftViewCriteria.selectedTrackFilters[trackValue]);
        },
        [draftViewCriteria.selectedTrackFilters, sourceLabels, t, trackFilterOptions]
    );

    const statusFilterTrackValues = useMemo(() => {
        const includedTrackFilters = trackFilterOptions
            .map((option) => option.value)
            .filter((trackValue) => draftViewCriteria.selectedTrackFilters[trackValue] === 'include');
        return includedTrackFilters.length > 0
            ? includedTrackFilters
            : trackFilterOptions.map((option) => option.value);
    }, [draftViewCriteria.selectedTrackFilters, trackFilterOptions]);

    const toggleFilterPopover = useCallback((key: FilterPopoverKey, anchorEl: HTMLElement) => {
        setOpenFilterPopover((current) =>
            current?.key === key && current.anchorEl === anchorEl
                ? undefined
                : {
                      key,
                      anchorEl,
                  }
        );
    }, []);

    const closeFilterPopover = useCallback(() => {
        setOpenFilterPopover(undefined);
    }, []);

    const visibleRows = useMemo(() => {
        const cardIdFilterTerms = appliedViewCriteria.cardIdFilter.split(/\D+/).filter((value) => value.length);
        const noteIdFilterTerms = appliedViewCriteria.noteIdFilter.split(/\D+/).filter((value) => value.length);
        const includedTrackFilters = trackFilterOptions
            .map((option) => option.value)
            .filter((trackValue) => appliedViewCriteria.selectedTrackFilters[trackValue] === 'include');
        const excludedTrackFilters = trackFilterOptions
            .map((option) => option.value)
            .filter((trackValue) => appliedViewCriteria.selectedTrackFilters[trackValue] === 'exclude');
        const includedSourceFilters = filterableSources.filter(
            (source) => appliedViewCriteria.selectedSourceFilters[source] === 'include'
        );
        const excludedSourceFilters = filterableSources.filter(
            (source) => appliedViewCriteria.selectedSourceFilters[source] === 'exclude'
        );
        const includedStatusFilters = filterStatusOptions.filter(
            (status) => appliedViewCriteria.selectedStatusFilters[status] === 'include'
        );
        const excludedStatusFilters = filterStatusOptions.filter(
            (status) => appliedViewCriteria.selectedStatusFilters[status] === 'exclude'
        );
        const includedStateFilters = filterableStates.filter(
            (state) => appliedViewCriteria.selectedStateFilters[state] === 'include'
        );
        const excludedStateFilters = filterableStates.filter(
            (state) => appliedViewCriteria.selectedStateFilters[state] === 'exclude'
        );

        const filtered = rows.filter((row) => {
            if (includedSourceFilters.length > 0 && !includedSourceFilters.includes(row.source)) return false;
            if (excludedSourceFilters.includes(row.source)) return false;
            if (includedStatusFilters.length > 0 && !includedStatusFilters.includes(row.status)) return false;
            if (excludedStatusFilters.includes(row.status)) return false;
            if (includedStateFilters.some((state) => !row.states.includes(state))) return false;
            if (excludedStateFilters.some((state) => row.states.includes(state))) return false;
            if (includedTrackFilters.length > 0 && !includedTrackFilters.includes(row.trackSortValue)) return false;
            if (excludedTrackFilters.includes(row.trackSortValue)) return false;
            if (appliedViewCriteria.suspendedFilter !== 'all') {
                if (row.source === DictionaryTokenSource.LOCAL) {
                    if (appliedViewCriteria.suspendedFilter !== 'no') return false;
                } else {
                    if (row.suspendedFilterValue !== appliedViewCriteria.suspendedFilter) return false;
                }
            }
            if (cardIdFilterTerms.length && !cardIdFilterTerms.some((term) => row.cardIdsDisplay.includes(term))) {
                return false;
            }
            if (noteIdFilterTerms.length && !noteIdFilterTerms.some((term) => row.noteIdsDisplay.includes(term))) {
                return false;
            }
            return true;
        });

        const exactTerms = searchExpansion.exactTerms;
        const lemmaTerms = searchExpansion.lemmaTerms;
        const hasSearch = exactTerms.length > 0 || lemmaTerms.length > 0;
        const matchGroups = new Map<string, MatchGroup>();

        if (!hasSearch) {
            for (const row of filtered) matchGroups.set(row.selectionKey, 0);
        } else {
            const exactTokenRows: WordBrowserRow[] = [];
            const exactRows: WordBrowserRow[] = [];
            const lemmaRows: WordBrowserRow[] = [];
            const remainder: WordBrowserRow[] = [];

            for (const row of filtered) {
                const matchesExactToken = exactTerms.some((term) =>
                    hasExactSearchTermMatch(row.tokenSearchTerms, term)
                );
                if (matchesExactToken) {
                    exactTokenRows.push(row);
                    continue;
                }

                const matchesExact = exactTerms.some(
                    (term) =>
                        matchesSearchTerm(row.tokenSearchTerms, term) || matchesSearchTerm(row.lemmaSearchTerms, term)
                );
                if (matchesExact) {
                    exactRows.push(row);
                } else {
                    remainder.push(row);
                }
            }

            const exactLemmaSet = new Set([...exactTokenRows, ...exactRows].flatMap((row) => row.lemmaSearchTerms));
            const trailingRows: WordBrowserRow[] = [];

            for (const row of remainder) {
                const matchesLemma = lemmaTerms.some(
                    (term) =>
                        matchesSearchTerm(row.tokenSearchTerms, term) || matchesSearchTerm(row.lemmaSearchTerms, term)
                );
                if (matchesLemma) {
                    lemmaRows.push(row);
                    continue;
                }

                const sharesLemma = row.lemmaSearchTerms.some((lemma) => exactLemmaSet.has(lemma));
                if (sharesLemma) trailingRows.push(row);
            }

            for (const row of exactTokenRows) matchGroups.set(row.selectionKey, 0);
            for (const row of exactRows) matchGroups.set(row.selectionKey, 1);
            for (const row of lemmaRows) matchGroups.set(row.selectionKey, 2);
            for (const row of trailingRows) matchGroups.set(row.selectionKey, 3);
        }

        const sorted = filtered
            .filter((row) => matchGroups.has(row.selectionKey))
            .sort((lhs, rhs) => {
                const matchDiff = (matchGroups.get(lhs.selectionKey) ?? 4) - (matchGroups.get(rhs.selectionKey) ?? 4);
                if (matchDiff !== 0) return matchDiff;

                let valueDiff = 0;
                switch (appliedViewCriteria.sortField) {
                    case 'token':
                        valueDiff = compareValues(lhs.token, rhs.token);
                        break;
                    case 'lemmas':
                        valueDiff = compareValues(lhs.lemmasDisplay, rhs.lemmasDisplay);
                        break;
                    case 'source':
                        valueDiff = compareValues(lhs.sourceDisplay, rhs.sourceDisplay);
                        break;
                    case 'status':
                        valueDiff = compareValues(lhs.status, rhs.status);
                        break;
                    case 'states':
                        valueDiff = compareValues(lhs.statesDisplay, rhs.statesDisplay);
                        break;
                    case 'track':
                        valueDiff = compareValues(lhs.trackSortValue, rhs.trackSortValue);
                        break;
                    case 'cardIds':
                        valueDiff = compareValues(lhs.cardIdsDisplay, rhs.cardIdsDisplay);
                        break;
                    case 'noteIds':
                        valueDiff = compareValues(lhs.noteIdsDisplay, rhs.noteIdsDisplay);
                        break;
                    case 'suspended':
                        valueDiff = compareValues(lhs.suspendedSortValue, rhs.suspendedSortValue);
                        break;
                }

                if (valueDiff === 0) valueDiff = compareValues(lhs.token, rhs.token);
                return appliedViewCriteria.sortDirection === 'asc' ? valueDiff : -valueDiff;
            });

        return sorted;
    }, [
        appliedViewCriteria,
        filterStatusOptions,
        filterableSources,
        filterableStates,
        rows,
        searchExpansion,
        trackFilterOptions,
    ]);

    useEffect(() => {
        const visibleKeySet = new Set(visibleRows.filter((row) => row.selectable).map((row) => row.selectionKey));
        setSelectedRowKeys((current) => {
            const next = new Set(Array.from(current).filter((key) => visibleKeySet.has(key)));
            return next.size === current.size ? current : next;
        });
    }, [visibleRows]);

    const pageCount = useMemo(
        () => (pageSize === allPageSize ? 1 : Math.max(1, Math.ceil(visibleRows.length / pageSize))),
        [pageSize, visibleRows.length]
    );
    const clampedCurrentPage = Math.min(currentPage, pageCount - 1);
    const pagedVisibleRows = useMemo(() => {
        if (pageSize === allPageSize) return visibleRows;

        const start = clampedCurrentPage * pageSize;
        return visibleRows.slice(start, start + pageSize);
    }, [clampedCurrentPage, pageSize, visibleRows]);
    const pagedVisibleSelectableRows = useMemo(
        () => pagedVisibleRows.filter((row) => row.selectable),
        [pagedVisibleRows]
    );
    const visibleSelectableRows = useMemo(() => visibleRows.filter((row) => row.selectable), [visibleRows]);
    const pagedVisibleSelectableRowsRef = useRef(pagedVisibleSelectableRows);

    useEffect(() => {
        if (currentPage !== clampedCurrentPage) {
            setCurrentPage(clampedCurrentPage);
        }
    }, [clampedCurrentPage, currentPage]);

    useEffect(() => {
        setPageInput(String(clampedCurrentPage + 1));
    }, [clampedCurrentPage]);

    useEffect(() => {
        tableContainerRef.current?.scrollTo({ top: 0 });
    }, [clampedCurrentPage]);

    useEffect(() => {
        pagedVisibleSelectableRowsRef.current = pagedVisibleSelectableRows;
    }, [pagedVisibleSelectableRows]);

    const selectedCount = selectedRowKeys.size;
    const allVisibleSelected =
        pagedVisibleSelectableRows.length > 0 &&
        pagedVisibleSelectableRows.every((row) => selectedRowKeys.has(row.selectionKey));
    const partiallyVisibleSelected =
        pagedVisibleSelectableRows.some((row) => selectedRowKeys.has(row.selectionKey)) && !allVisibleSelected;

    const selectedRows = useMemo(
        () => visibleSelectableRows.filter((row) => selectedRowKeys.has(row.selectionKey)),
        [selectedRowKeys, visibleSelectableRows]
    );

    const bulkStatusTrackValues = useMemo(
        () =>
            selectedRows.length > 0
                ? Array.from(new Set(selectedRows.map((row) => row.trackSortValue)))
                : [LOCAL_TOKEN_TRACK],
        [selectedRows]
    );

    const bulkStatesConfigured = bulkIgnoredState !== undefined || bulkStates.length > 0;
    const canApplyToSelected =
        selectedCount > 0 && (bulkStatus !== '' || bulkStatesConfigured) && !mutating && !loading;

    const cycleBulkIgnoredState = useCallback(() => {
        const nextState = nextFilterMode(bulkIgnoredState);
        setBulkIgnoredState(nextState);
        setBulkStates(nextState === 'include' ? [TokenState.IGNORED] : []);
        setBulkStatesApplyStrategy(ApplyStrategy.REPLACE);
    }, [bulkIgnoredState]);

    const goToPage = useCallback(
        (page: number) => {
            const nextPage = Math.max(0, Math.min(page, pageCount - 1));
            setCurrentPage(nextPage);
            setPageInput(String(nextPage + 1));
        },
        [pageCount]
    );

    const commitPageInput = useCallback(() => {
        const parsedPage = Number.parseInt(pageInput, 10);
        if (Number.isNaN(parsedPage)) {
            setPageInput(String(clampedCurrentPage + 1));
            return;
        }

        goToPage(parsedPage - 1);
    }, [clampedCurrentPage, goToPage, pageInput]);

    const handlePageSizeChange = useCallback(
        (nextPageSize: number) => {
            const currentOffset = pageSize === allPageSize ? 0 : clampedCurrentPage * pageSize;
            const adjustedOffset =
                nextPageSize !== allPageSize &&
                pageSize !== allPageSize &&
                nextPageSize > pageSize &&
                currentOffset > 0 &&
                currentOffset % nextPageSize === 0
                    ? currentOffset - 1
                    : currentOffset;
            const nextPage = nextPageSize === allPageSize ? 0 : Math.floor(adjustedOffset / nextPageSize);

            setPageSize(nextPageSize);
            setCurrentPage(nextPage);
            setPageInput(String(nextPage + 1));
        },
        [clampedCurrentPage, pageSize]
    );

    const handleSelectRow = useCallback((selectionKey: string, { shiftKey }: { shiftKey: boolean }) => {
        const visibleSelectionKeys = pagedVisibleSelectableRowsRef.current.map((row) => row.selectionKey);
        const preserveExisting = true;

        setSelectedRowKeys((current) => {
            const clickedIndex = visibleSelectionKeys.indexOf(selectionKey);
            if (clickedIndex === -1) return current;

            if (shiftKey) {
                const anchorKey = selectionAnchorKeyRef.current ?? selectionKey;
                const anchorIndex = visibleSelectionKeys.indexOf(anchorKey);

                if (anchorIndex !== -1) {
                    const [start, end] =
                        anchorIndex <= clickedIndex ? [anchorIndex, clickedIndex] : [clickedIndex, anchorIndex];
                    const next = preserveExisting ? new Set(current) : new Set<string>();
                    for (let index = start; index <= end; ++index) next.add(visibleSelectionKeys[index]);
                    return next;
                }
            }

            if (preserveExisting) {
                const next = new Set(current);
                if (next.has(selectionKey)) next.delete(selectionKey);
                else next.add(selectionKey);
                return next;
            }

            return new Set([selectionKey]);
        });

        selectionAnchorKeyRef.current = selectionKey;
    }, []);

    const toggleSelectAllVisible = useCallback(() => {
        setSelectedRowKeys((current) => {
            if (pagedVisibleSelectableRows.every((row) => current.has(row.selectionKey))) {
                return new Set(
                    Array.from(current).filter(
                        (key) => !pagedVisibleSelectableRows.some((row) => row.selectionKey === key)
                    )
                );
            }
            const next = new Set(current);
            for (const row of pagedVisibleSelectableRows) next.add(row.selectionKey);
            return next;
        });
    }, [pagedVisibleSelectableRows]);

    const handleSortColumnClick = useCallback(
        (field: SortField) => {
            updateDraftViewCriteria(singleSelectAutoRefreshDelayMs, (current) => {
                if (current.sortField === field) {
                    return {
                        ...current,
                        sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc',
                    };
                }
                return {
                    ...current,
                    sortField: field,
                    sortDirection: 'asc',
                };
            });
        },
        [updateDraftViewCriteria]
    );

    const renderSortableHeader = useCallback(
        (field: SortField, label: string) => (
            <TableSortLabel
                active={draftViewCriteria.sortField === field}
                direction={draftViewCriteria.sortField === field ? draftViewCriteria.sortDirection : 'asc'}
                onClick={() => handleSortColumnClick(field)}
            >
                {label}
            </TableSortLabel>
        ),
        [draftViewCriteria.sortField, draftViewCriteria.sortDirection, handleSortColumnClick]
    );

    const renderHeaderCell = useCallback(
        (field: SortField, label: string, filterKey?: FilterPopoverKey, filterActive = false) => (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                {renderSortableHeader(field, label)}
                {filterKey && (
                    <Badge color="primary" variant="dot" invisible={!filterActive}>
                        <IconButton
                            size="small"
                            color={filterActive ? 'primary' : 'default'}
                            aria-label={`${label} filter`}
                            onClick={(event) => toggleFilterPopover(filterKey, event.currentTarget)}
                        >
                            <FilterListIcon fontSize="small" />
                        </IconButton>
                    </Badge>
                )}
            </Stack>
        ),
        [renderSortableHeader, toggleFilterPopover]
    );

    const renderClearAdornment = useCallback(
        (value: string, onClear: () => void) =>
            value.length ? (
                <InputAdornment position="end">
                    <IconButton edge="end" size="small" aria-label={t('action.deleteAll')} onClick={onClear}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </InputAdornment>
            ) : undefined,
        [t]
    );

    const handleApplyToSelected = useCallback(async () => {
        if (!selectedRows.length) return;
        setConfirmApplyOpen(false);
        setMutating(true);
        try {
            await dictionaryProvider.updateRecords(
                activeProfile,
                selectedRows.map((row) => ({
                    tokenKey: row.tokenKey,
                    status: bulkStatus === '' ? row.status : bulkStatus,
                    states: bulkStatesConfigured ? bulkStates : row.states,
                })),
                bulkStatesConfigured ? bulkStatesApplyStrategy : ApplyStrategy.REPLACE // Keep existing states if not modifying
            );
            setSelectedRowKeys(new Set());
            await loadRecords(draftViewCriteria);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setMutating(false);
        }
    }, [
        activeProfile,
        bulkStatesConfigured,
        bulkStates,
        bulkStatesApplyStrategy,
        bulkStatus,
        dictionaryProvider,
        draftViewCriteria,
        loadRecords,
        selectedRows,
    ]);

    const handleDeleteSelected = useCallback(async () => {
        if (!selectedRows.length) return;
        setConfirmDeleteOpen(false);
        setMutating(true);
        try {
            await dictionaryProvider.deleteRecords(
                activeProfile,
                selectedRows.map((row) => row.tokenKey)
            );
            setSelectedRowKeys(new Set());
            await loadRecords(draftViewCriteria);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setMutating(false);
        }
    }, [activeProfile, dictionaryProvider, draftViewCriteria, loadRecords, selectedRows]);

    return (
        <Dialog open={open} onClose={mutating ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="xl">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {t('settings.dictionaryBrowser.title')}
                </Typography>
                <IconButton edge="end" onClick={onClose} disabled={mutating}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent sx={{ pt: 1 }}>
                <Stack spacing={2}>
                    {loadError && <Alert severity="error">{loadError}</Alert>}
                    {visibleYomitanError && appliedViewCriteria.searchQuery.trim().length > 0 && (
                        <Alert severity="warning">
                            {t('settings.dictionaryBrowser.yomitanWarning', { message: visibleYomitanError })}
                        </Alert>
                    )}
                    <Stack
                        direction={fullScreen ? 'column' : 'row'}
                        spacing={1.5}
                        alignItems={fullScreen ? 'stretch' : 'center'}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                            {t('settings.dictionaryBrowser.results', {
                                shown: visibleRows.length,
                                total: rows.length,
                                selected: selectedCount,
                            })}
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => void loadRecords(draftViewCriteria)}
                            loading={loading}
                            disabled={mutating}
                        >
                            {t('action.reload')}
                        </Button>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel shrink>{t('settings.dictionaryBrowser.bulkStatus')}</InputLabel>
                            <Select
                                displayEmpty
                                value={bulkStatus}
                                label={t('settings.dictionaryBrowser.bulkStatus')}
                                renderValue={(selected: TokenStatus | string) =>
                                    selected === '' ? (
                                        <Typography component="span" color="text.secondary" sx={{ minHeight: 24 }}>
                                            {t('settings.dictionaryBrowser.bulkStatus')}
                                        </Typography>
                                    ) : (
                                        renderStatusLabel(
                                            selected as TokenStatus,
                                            statusColorForTrackValues(bulkStatusTrackValues, selected as TokenStatus)
                                        )
                                    )
                                }
                                onChange={(event) =>
                                    setBulkStatus(
                                        event.target.value === '' ? '' : (Number(event.target.value) as TokenStatus)
                                    )
                                }
                            >
                                <MenuItem value="">
                                    <Typography color="text.secondary">
                                        {t('settings.dictionaryBrowser.bulkStatus')}
                                    </Typography>
                                </MenuItem>
                                {filterStatusOptions.map((tokenStatus) => (
                                    <MenuItem key={tokenStatus} value={tokenStatus}>
                                        <Typography
                                            sx={{
                                                color: statusColorForTrackValues(bulkStatusTrackValues, tokenStatus),
                                                fontWeight: 500,
                                            }}
                                        >
                                            {t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                        </Typography>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Stack spacing={0.25} sx={{ minWidth: 180 }}>
                            <Typography variant="caption" color="text.secondary">
                                {t('settings.dictionaryBrowser.bulkStates')}
                            </Typography>
                            <Stack direction="row" alignItems="center" sx={{ minHeight: 40 }}>
                                <Checkbox
                                    checked={bulkIgnoredState === 'include'}
                                    indeterminate={bulkIgnoredState === 'exclude'}
                                    onClick={cycleBulkIgnoredState}
                                />
                                <Typography color={bulkIgnoredState === undefined ? 'text.secondary' : undefined}>
                                    {renderFilterLabel(stateLabels[TokenState.IGNORED], bulkIgnoredState)}
                                </Typography>
                            </Stack>
                        </Stack>
                        <Button
                            variant="contained"
                            onClick={() => setConfirmApplyOpen(true)}
                            disabled={!canApplyToSelected}
                            loading={mutating}
                        >
                            {t('settings.dictionaryBrowser.applyToSelected')}
                        </Button>
                        <Dialog open={confirmApplyOpen} onClose={() => setConfirmApplyOpen(false)}>
                            <DialogContent>
                                <Typography>
                                    {t('settings.dictionaryBrowser.confirmApplyToSelected', {
                                        count: selectedCount,
                                    })}
                                </Typography>
                                {bulkStatus === TokenStatus.UNCOLLECTED && (
                                    <Alert severity="warning" sx={{ mt: 2 }}>
                                        {t('settings.dictionaryBrowser.confirmApplyToSelectedDeleteWarning')}
                                    </Alert>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setConfirmApplyOpen(false)}>{t('action.cancel')}</Button>
                                <Button onClick={() => void handleApplyToSelected()}>
                                    {t('settings.dictionaryBrowser.applyToSelected')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                        <Button
                            color="error"
                            variant="outlined"
                            onClick={() => setConfirmDeleteOpen(true)}
                            disabled={!selectedCount || mutating || loading}
                        >
                            {t('settings.dictionaryBrowser.deleteSelected')}
                        </Button>
                        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
                            <DialogContent>
                                <Typography>
                                    {t('settings.dictionaryBrowser.confirmDeleteSelected', {
                                        count: selectedCount,
                                    })}
                                </Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setConfirmDeleteOpen(false)}>{t('action.cancel')}</Button>
                                <Button color="error" onClick={() => void handleDeleteSelected()}>
                                    {t('action.delete')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Stack>
                    <TableContainer
                        ref={tableContainerRef}
                        component={Paper}
                        variant="outlined"
                        sx={{ maxHeight: fullScreen ? '60vh' : '55vh' }}
                    >
                        <Table stickyHeader size="small">
                            <TableHead
                                sx={{
                                    '& .MuiTableCell-head': {
                                        borderBottom: 0,
                                        backgroundColor: theme.palette.background.paper,
                                    },
                                    '& .MuiTableRow-root:first-of-type .MuiTableCell-head': {
                                        top: 0,
                                        zIndex: 3,
                                        height: 40,
                                        boxSizing: 'border-box',
                                    },
                                }}
                            >
                                <TableRow sx={{ boxShadow: `inset 0 -1px 0 ${theme.palette.divider}` }}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={allVisibleSelected}
                                            indeterminate={partiallyVisibleSelected}
                                            onChange={toggleSelectAllVisible}
                                            disabled={!pagedVisibleSelectableRows.length}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'token',
                                            t('settings.dictionaryBrowser.columns.word'),
                                            'search',
                                            draftViewCriteria.searchQuery.length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderSortableHeader('lemmas', t('settings.dictionaryBrowser.columns.lemmas'))}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'source',
                                            t('settings.dictionaryBrowser.columns.source'),
                                            'source',
                                            Object.keys(draftViewCriteria.selectedSourceFilters).length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'status',
                                            t('settings.dictionaryBrowser.columns.status'),
                                            'status',
                                            Object.keys(draftViewCriteria.selectedStatusFilters).length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'states',
                                            t('settings.dictionaryBrowser.columns.states'),
                                            'states',
                                            Object.keys(draftViewCriteria.selectedStateFilters).length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'track',
                                            t('settings.dictionaryBrowser.columns.track'),
                                            'track',
                                            Object.keys(draftViewCriteria.selectedTrackFilters).length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'cardIds',
                                            t('settings.dictionaryBrowser.columns.cardIds'),
                                            'cardIds',
                                            draftViewCriteria.cardIdFilter.length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'noteIds',
                                            t('settings.dictionaryBrowser.columns.noteIds'),
                                            'noteIds',
                                            draftViewCriteria.noteIdFilter.length > 0
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {renderHeaderCell(
                                            'suspended',
                                            t('settings.dictionaryBrowser.columns.suspended'),
                                            'suspended',
                                            draftViewCriteria.suspendedFilter !== 'all'
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pagedVisibleRows.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={10}>
                                            <Typography color="text.secondary">
                                                {t('settings.dictionaryBrowser.noResults')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {pagedVisibleRows.map((row) => (
                                    <WordBrowserTableRow
                                        key={row.selectionKey}
                                        row={row}
                                        selected={selectedRowKeys.has(row.selectionKey)}
                                        onSelectRow={handleSelectRow}
                                        renderStatusLabel={renderStatusLabel}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Popover
                        open={openFilterPopover !== undefined}
                        anchorEl={openFilterPopover?.anchorEl}
                        onClose={closeFilterPopover}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        PaperProps={{ sx: { p: 1.5, width: 280, maxWidth: 'calc(100vw - 32px)' } }}
                    >
                        <Stack spacing={1.5}>
                            {openFilterPopover?.key === 'search' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.word')}
                                    </Typography>
                                    <TextField
                                        autoFocus
                                        placeholder={t('settings.dictionaryBrowser.searchPlaceholder')}
                                        value={draftViewCriteria.searchQuery}
                                        onChange={(event) => updateDraftTextCriteria('searchQuery', event.target.value)}
                                        slotProps={{
                                            input: {
                                                endAdornment: renderClearAdornment(draftViewCriteria.searchQuery, () =>
                                                    clearDraftTextCriteria('searchQuery')
                                                ),
                                            },
                                        }}
                                        size="small"
                                        fullWidth
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'source' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.source')}
                                    </Typography>
                                    <CyclingFilterList
                                        options={filterableSources}
                                        selectedFilters={draftViewCriteria.selectedSourceFilters}
                                        onToggle={(source) => cycleFilter('selectedSourceFilters', source)}
                                        renderMenuItemLabel={(source) => (
                                            <ListItemText primary={renderSourceFilterLabel(source)} />
                                        )}
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'status' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.status')}
                                    </Typography>
                                    <CyclingFilterList
                                        options={filterStatusOptions}
                                        selectedFilters={draftViewCriteria.selectedStatusFilters}
                                        onToggle={(status) => cycleFilter('selectedStatusFilters', status)}
                                        renderMenuItemLabel={(status) => (
                                            <ListItemText
                                                primary={renderStatusFilterLabel(status)}
                                                slotProps={{
                                                    primary: {
                                                        sx: {
                                                            color: statusColorForTrackValues(
                                                                statusFilterTrackValues,
                                                                status
                                                            ),
                                                        },
                                                    },
                                                }}
                                            />
                                        )}
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'states' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.states')}
                                    </Typography>
                                    <CyclingFilterList
                                        options={filterableStates}
                                        selectedFilters={draftViewCriteria.selectedStateFilters}
                                        onToggle={(state) => cycleFilter('selectedStateFilters', state)}
                                        renderMenuItemLabel={(state) => (
                                            <ListItemText primary={renderStateFilterLabel(state)} />
                                        )}
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'track' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.track')}
                                    </Typography>
                                    <CyclingFilterList
                                        options={trackFilterOptions.map((option) => option.value)}
                                        selectedFilters={draftViewCriteria.selectedTrackFilters}
                                        onToggle={(trackValue) => cycleFilter('selectedTrackFilters', trackValue)}
                                        renderMenuItemLabel={(trackValue) => (
                                            <ListItemText primary={renderTrackFilterLabel(trackValue)} />
                                        )}
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'cardIds' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.cardIds')}
                                    </Typography>
                                    <TextField
                                        autoFocus
                                        placeholder={t('settings.dictionaryBrowser.columns.cardIds')}
                                        value={draftViewCriteria.cardIdFilter}
                                        onChange={(event) =>
                                            updateDraftTextCriteria('cardIdFilter', event.target.value)
                                        }
                                        slotProps={{
                                            input: {
                                                endAdornment: renderClearAdornment(draftViewCriteria.cardIdFilter, () =>
                                                    clearDraftTextCriteria('cardIdFilter')
                                                ),
                                            },
                                        }}
                                        size="small"
                                        fullWidth
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'noteIds' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.noteIds')}
                                    </Typography>
                                    <TextField
                                        autoFocus
                                        placeholder={t('settings.dictionaryBrowser.columns.noteIds')}
                                        value={draftViewCriteria.noteIdFilter}
                                        onChange={(event) =>
                                            updateDraftTextCriteria('noteIdFilter', event.target.value)
                                        }
                                        slotProps={{
                                            input: {
                                                endAdornment: renderClearAdornment(draftViewCriteria.noteIdFilter, () =>
                                                    clearDraftTextCriteria('noteIdFilter')
                                                ),
                                            },
                                        }}
                                        size="small"
                                        fullWidth
                                    />
                                </>
                            )}
                            {openFilterPopover?.key === 'suspended' && (
                                <>
                                    <Typography variant="body2" fontWeight={500}>
                                        {t('settings.dictionaryBrowser.columns.suspended')}
                                    </Typography>
                                    <RadioGroup
                                        value={draftViewCriteria.suspendedFilter}
                                        onChange={(event) =>
                                            updateDraftViewCriteria(singleSelectAutoRefreshDelayMs, (current) => ({
                                                ...current,
                                                suspendedFilter: event.target.value as SuspendedFilter,
                                            }))
                                        }
                                    >
                                        <FormControlLabel
                                            value="all"
                                            control={<Radio size="small" />}
                                            label={t('settings.dictionaryBrowser.suspended.all')}
                                        />
                                        <FormControlLabel
                                            value="yes"
                                            control={<Radio size="small" />}
                                            label={t('settings.dictionaryBrowser.suspended.yes')}
                                        />
                                        <FormControlLabel
                                            value="no"
                                            control={<Radio size="small" />}
                                            label={t('settings.dictionaryBrowser.suspended.no')}
                                        />
                                        <FormControlLabel
                                            value="mixed"
                                            control={<Radio size="small" />}
                                            label={t('settings.dictionaryBrowser.suspended.mixed')}
                                        />
                                    </RadioGroup>
                                </>
                            )}
                        </Stack>
                    </Popover>
                </Stack>
            </DialogContent>
            <DialogActions
                sx={{
                    justifyContent: 'space-between',
                    alignItems: fullScreen ? 'stretch' : 'center',
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mr: 'auto' }}>
                    <IconButton
                        size="small"
                        onClick={() => goToPage(0)}
                        disabled={clampedCurrentPage === 0 || !visibleRows.length}
                        aria-label="First page"
                    >
                        <FirstPageIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => goToPage(clampedCurrentPage - 1)}
                        disabled={clampedCurrentPage === 0 || !visibleRows.length}
                        aria-label="Previous page"
                    >
                        <NavigateBeforeIcon fontSize="small" />
                    </IconButton>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        <TextField
                            size="small"
                            value={pageInput}
                            onChange={(event) => {
                                const nextValue = event.target.value.replace(/\D+/g, '');
                                setPageInput(nextValue);
                            }}
                            onBlur={commitPageInput}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitPageInput();
                                }
                            }}
                            slotProps={{
                                htmlInput: {
                                    inputMode: 'numeric',
                                    pattern: '[0-9]*',
                                    min: 1,
                                    max: pageCount,
                                    'aria-label': 'Page number',
                                },
                            }}
                            sx={{ width: 72 }}
                            disabled={!visibleRows.length}
                        />
                        <Typography variant="body2" color="text.secondary">
                            / {pageCount}
                        </Typography>
                    </Stack>
                    <IconButton
                        size="small"
                        onClick={() => goToPage(clampedCurrentPage + 1)}
                        disabled={clampedCurrentPage >= pageCount - 1 || !visibleRows.length}
                        aria-label="Next page"
                    >
                        <NavigateNextIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => goToPage(pageCount - 1)}
                        disabled={clampedCurrentPage >= pageCount - 1 || !visibleRows.length}
                        aria-label="Last page"
                    >
                        <LastPageIcon fontSize="small" />
                    </IconButton>
                    <Select
                        size="small"
                        value={pageSize}
                        onChange={(event) => handlePageSizeChange(Number(event.target.value))}
                        renderValue={(value) =>
                            Number(value) === allPageSize
                                ? t('settings.dictionaryBrowser.suspended.all')
                                : String(value)
                        }
                        sx={{ minWidth: 96 }}
                    >
                        {pageSizeOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option === allPageSize ? t('settings.dictionaryBrowser.suspended.all') : option}
                            </MenuItem>
                        ))}
                    </Select>
                </Stack>
                <Button onClick={onClose} disabled={mutating}>
                    {t('action.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
