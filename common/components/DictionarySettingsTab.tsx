import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import LabelWithHoverEffect from './LabelWithHoverEffect';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import MuiAlert, { type AlertProps } from '@mui/material/Alert';
import {
    AsbplayerSettings,
    TokenMatchStrategy,
    TokenMatchStrategyPriority,
    TokenReadingAnnotation,
    TokenStyling,
    getFullyKnownTokenStatus,
    NUM_DICTIONARY_TRACKS,
    NUM_TOKEN_STATUSES,
    NUM_TOKEN_STATES,
    compareDTField,
    Profile,
    dictionaryStatusCollectionEnabled,
    TokenFrequencyAnnotation,
    TokenStatusConfig,
    textSubtitleSettingsForTrack,
    TextSubtitleSettings,
    TokenStatus,
    TokenState,
    DictionaryTrack,
    TokenAnnotationTriggerOptions,
    EnabledAnnotations,
    TokenAnnotationConfigTarget,
    tokenAnnotationStyleValues,
} from '@project/common/settings';
import { Anki } from '../anki';
import { WaniKani, WaniKaniUser } from '../wanikani';
import { Yomitan } from '../yomitan/yomitan';
import SwitchLabelWithHoverEffect from './SwitchLabelWithHoverEffect';
import SettingsTextField from './SettingsTextField';
import SettingsSection from './SettingsSection';
import {
    DictionaryBuildAnkiCacheProgress,
    DictionaryBuildAnkiCacheState,
    DictionaryBuildAnkiCacheStateError,
    DictionaryBuildAnkiCacheStateErrorBuildExpirationData,
    DictionaryBuildAnkiCacheStateErrorCode,
    DictionaryBuildAnkiCacheStateErrorTrackNumberData,
    DictionaryBuildAnkiCacheStateType,
    DictionaryBuildAnkiCacheStats,
    DictionaryBuildWaniKaniCacheProgress,
    DictionaryBuildWaniKaniCacheState,
    DictionaryBuildWaniKaniCacheStateError,
    DictionaryBuildWaniKaniCacheStateErrorCode,
    DictionaryBuildWaniKaniCacheStateType,
    DictionaryBuildWaniKaniCacheStats,
} from '../src/message';
import { DictionaryProvider } from '../dictionary-db';
import {
    computeStyles,
    ensureStoragePersisted,
    hex2ToPercent,
    humanReadableTime,
    localizedDate,
    percentToHex2,
} from '../util';
import DictionaryImport from './DictionaryImport';
import { computeRichText, getAnnotationsForRender, getAnnotationsHtml, InternalToken } from '../subtitle-annotations';
import WordBrowserDialog from './WordBrowserDialog';
import '../app/components/subtitles.css';
import ButtonGroup from '@mui/material/ButtonGroup';
import SettingsGroups from './SettingsGroups';

const yomitanInstallerUrl = 'https://github.com/yomidevs/yomitan-api';
const yomitanMecabInstallerUrl = 'https://github.com/yomidevs/yomitan-mecab-installer';
const waniKaniApiTokenSetupUrl = 'https://docs.asbplayer.dev/docs/guides/annotation#setup';
const maskApiToken = (apiToken: string) => '•'.repeat(Array.from(apiToken).length);

// These values show all digits with an increasing number of digits
const statusFrequencies = {
    [TokenStatus.MATURE]: 1,
    [TokenStatus.YOUNG]: 23,
    [TokenStatus.GRADUATED]: 456,
    [TokenStatus.LEARNING]: 7890,
    [TokenStatus.UNKNOWN]: 12345,
    [TokenStatus.UNCOLLECTED]: 678901,
};

// The Japanese localization should use the correct pitch accent rather than the demo
const readingPitchAccents: Record<string, string> = {
    じゅくち: 'HLL',
    みじゅく: 'LHH',
    がくしゅうかんりょう: 'LHHHHHHH',
    がくしゅうちゅう: 'LHHHHH',
    しんき: 'HLL',
    みしゅうしゅう: 'LHHHH',
    むし: 'HL',
};

// These are demo values of the main pitch patterns
const statusPitchAccents = {
    [TokenStatus.MATURE]: 'LHHHHHHHHHHHHHHHHHHH',
    [TokenStatus.YOUNG]: 'HLLLLLLLLLLLLLLLLLLL',
    [TokenStatus.GRADUATED]: 'LHHLLLLLLLLLLLLLLLLLL',
    [TokenStatus.LEARNING]: 'LHHHHHHHHHHHHHHHHHHH',
    [TokenStatus.UNKNOWN]: 'HLLLLLLLLLLLLLLLLLLL',
    [TokenStatus.UNCOLLECTED]: 'LHLLLLLLLLLLLLLLLLLL',
};

type DictionaryTokenAnnotationConfig = DictionaryTrack['dictionaryTokenAnnotationConfig'];
type TokenAnnotationHoverKey = keyof EnabledAnnotations;
type TokenAnnotationSizeKey = Exclude<TokenAnnotationHoverKey, 'color'>;
type TokenAnnotationTriggerKey = keyof TokenAnnotationTriggerOptions;
type TokenAnnotationSelection = {
    statuses: TokenStatus[];
    states: TokenState[];
};

const tokenAnnotationStatuses = [...Array(NUM_TOKEN_STATUSES).keys()] as TokenStatus[];
const tokenAnnotationStates = [...Array(NUM_TOKEN_STATES).keys()] as TokenState[];
const tokenAnnotationTargets: { target: TokenAnnotationConfigTarget; labelKey: string }[] = [
    { target: 'video', labelKey: 'settings.dictionaryTokenAnnotationTargetVideo' },
    { target: 'subtitlePlayer', labelKey: 'settings.dictionaryTokenAnnotationTargetSubtitlePlayer' },
];
const tokenAnnotationHoverOptions: { annotation: TokenAnnotationHoverKey; labelKey: string }[] = [
    { annotation: 'color', labelKey: 'settings.dictionaryTokenAnnotationHoverColor' },
    { annotation: 'reading', labelKey: 'settings.dictionaryTokenAnnotationHoverReading' },
    { annotation: 'frequency', labelKey: 'settings.dictionaryTokenAnnotationHoverFrequency' },
    { annotation: 'pitchAccent', labelKey: 'settings.dictionaryTokenAnnotationHoverPitchAccent' },
];
const tokenAnnotationSizeOptions: { annotation: TokenAnnotationSizeKey; labelKey: string }[] = [
    { annotation: 'reading', labelKey: 'settings.dictionaryTokenAnnotationReadingSize' },
    { annotation: 'frequency', labelKey: 'settings.dictionaryTokenAnnotationFrequencySize' },
    { annotation: 'pitchAccent', labelKey: 'settings.dictionaryTokenAnnotationPitchAccentSize' },
];
const tokenAnnotationTriggerOptions: { annotation: TokenAnnotationTriggerKey; labelKey: string }[] = [
    { annotation: 'reading', labelKey: 'settings.dictionaryTokenReadingAnnotation' },
    { annotation: 'frequency', labelKey: 'settings.dictionaryTokenFrequencyAnnotation' },
    { annotation: 'pitchAccent', labelKey: 'settings.dictionaryTokenPitchAccentAnnotation' },
];
const legacyVideoHoverAnnotationKeys: TokenAnnotationHoverKey[] = ['color', 'reading', 'frequency'];

const tokenAnnotationStatusOptionValue = (status: TokenStatus) => status;
const tokenAnnotationStateOptionValue = (state: TokenState) => NUM_TOKEN_STATUSES + state;
const tokenAnnotationOptionValues = (value: unknown): number[] => {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (typeof value === 'string' && value.length === 0) return [];
    if (typeof value === 'string') return value.split(',').map(Number).filter(Number.isFinite);
    return [];
};
const tokenAnnotationSelectionFromOptionValues = (values: number[]): TokenAnnotationSelection => ({
    statuses: tokenAnnotationStatuses.filter((status) => values.includes(tokenAnnotationStatusOptionValue(status))),
    states: tokenAnnotationStates.filter((state) => values.includes(tokenAnnotationStateOptionValue(state))),
});
const tokenAnnotationSelectionOptionValues = ({ statuses, states }: TokenAnnotationSelection): number[] => [
    ...statuses.map((status) => tokenAnnotationStatusOptionValue(status)),
    ...states.map((state) => tokenAnnotationStateOptionValue(state)),
];
const tokenAnnotationSelection = (
    config: DictionaryTokenAnnotationConfig,
    annotation: TokenAnnotationTriggerKey
): TokenAnnotationSelection => ({
    statuses: tokenAnnotationStatuses.filter((status) => config.onStatuses[status][annotation]),
    states: tokenAnnotationStates.filter((state) => config.onStates[state][annotation]),
});

const tokenAnnotationStatusSelectionLabels = (
    statuses: TokenStatus[],
    statusLabel: (status: TokenStatus) => string
): string[] => {
    const sortedStatuses = Array.from(new Set(statuses)).sort((lhs, rhs) => lhs - rhs);
    const labels: string[] = [];

    for (let blockStart = 0; blockStart < sortedStatuses.length; ) {
        let blockEnd = blockStart;
        while (blockEnd + 1 < sortedStatuses.length && sortedStatuses[blockEnd + 1] === sortedStatuses[blockEnd] + 1) {
            ++blockEnd;
        }

        if (blockEnd - blockStart + 1 >= 3) {
            labels.push(`${statusLabel(sortedStatuses[blockStart])} \u2192 ${statusLabel(sortedStatuses[blockEnd])}`);
        } else {
            for (let i = blockStart; i <= blockEnd; ++i) labels.push(statusLabel(sortedStatuses[i]));
        }
        blockStart = blockEnd + 1;
    }

    return labels;
};

const withTokenAnnotationHoverEnabled = (
    config: DictionaryTokenAnnotationConfig,
    target: TokenAnnotationConfigTarget,
    annotation: TokenAnnotationHoverKey,
    onHoverEnabled: boolean
): DictionaryTokenAnnotationConfig => ({
    ...config,
    [target]: {
        ...config[target],
        [annotation]: {
            ...config[target][annotation],
            onHoverEnabled,
        },
    },
});

const withTokenAnnotationsHoverEnabled = (
    config: DictionaryTokenAnnotationConfig,
    target: TokenAnnotationConfigTarget,
    annotations: TokenAnnotationHoverKey[],
    onHoverEnabled: boolean
): DictionaryTokenAnnotationConfig =>
    annotations.reduce<DictionaryTokenAnnotationConfig>(
        (updatedConfig, annotation) =>
            withTokenAnnotationHoverEnabled(updatedConfig, target, annotation, onHoverEnabled),
        config
    );

const withTokenAnnotationSize = (
    config: DictionaryTokenAnnotationConfig,
    target: TokenAnnotationConfigTarget,
    annotation: TokenAnnotationSizeKey,
    size: number
): DictionaryTokenAnnotationConfig => ({
    ...config,
    [target]: {
        ...config[target],
        [annotation]: {
            ...config[target][annotation],
            size,
        },
    },
});

const withTokenAnnotationSelection = (
    config: DictionaryTokenAnnotationConfig,
    annotation: TokenAnnotationTriggerKey,
    selection: TokenAnnotationSelection
): DictionaryTokenAnnotationConfig => {
    const statuses = new Set(selection.statuses);
    const states = new Set(selection.states);
    return {
        ...config,
        onStatuses: tokenAnnotationStatuses.map((status) => ({
            ...config.onStatuses[status],
            [annotation]: statuses.has(status),
        })),
        onStates: tokenAnnotationStates.map((state) => ({
            ...config.onStates[state],
            [annotation]: states.has(state),
        })),
    };
};

const ankiCacheDependentSettings = new Set<keyof DictionaryTrack>([
    'dictionaryYomitanUrl',
    'dictionaryYomitanParser',
    'dictionaryYomitanScanLength',
    'dictionaryAnkiDecks',
    'dictionaryAnkiWordFields',
    'dictionaryAnkiSentenceFields',
    'dictionaryAnkiMatureCutoff',
]);

const waniKaniCacheDependentSettings = new Set<keyof DictionaryTrack>([
    'dictionaryYomitanUrl',
    'dictionaryYomitanParser',
    'dictionaryYomitanScanLength',
    'dictionaryWaniKaniApiToken',
]);

interface StateWithArrivalTime<T> {
    state: T;
    receivedAt: number;
}

const useBuildAnkiCacheState: () => {
    severity: 'error' | 'info';
    msg: string;
    setBuildAnkiCacheState: (state: DictionaryBuildAnkiCacheState | undefined) => void;
} = () => {
    const { t } = useTranslation();
    const [buildAnkiCacheState, setBuildAnkiCacheStateWithArrivalTime] =
        useState<StateWithArrivalTime<DictionaryBuildAnkiCacheState>>();
    const setBuildAnkiCacheState = useCallback((state: DictionaryBuildAnkiCacheState | undefined) => {
        setBuildAnkiCacheStateWithArrivalTime(state === undefined ? undefined : { state, receivedAt: Date.now() });
    }, []);
    let msg: string = '';

    if (buildAnkiCacheState !== undefined) {
        const { state, receivedAt } = buildAnkiCacheState;

        switch (state.type) {
            case DictionaryBuildAnkiCacheStateType.error:
                const error = state.body as DictionaryBuildAnkiCacheStateError;
                switch (error.code) {
                    case DictionaryBuildAnkiCacheStateErrorCode.concurrentBuild:
                        msg = t('settings.dictionaryBuildInProgress', {
                            time: localizedDate(
                                (error.data as DictionaryBuildAnkiCacheStateErrorBuildExpirationData).expiration
                            ),
                        });
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.noAnki:
                        msg = t('settings.dictionaryBuildAnkiError');
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.noYomitan:
                        msg = t('settings.dictionaryBuildYomitanError', {
                            trackNumber: (error.data as DictionaryBuildAnkiCacheStateErrorTrackNumberData).track + 1,
                        });
                        break;
                    case DictionaryBuildAnkiCacheStateErrorCode.failedToSyncTrackStates:
                    case DictionaryBuildAnkiCacheStateErrorCode.failedToBuild:
                    default:
                        msg = error.msg ? t('info.error', { message: error.msg }) : t('info.errorNoMessage');
                        break;
                }
                break;
            case DictionaryBuildAnkiCacheStateType.start:
                msg = t('settings.dictionaryBuildAnkiStarted');
                break;
            case DictionaryBuildAnkiCacheStateType.progress:
                const progress = state.body as DictionaryBuildAnkiCacheProgress;
                const rate = progress.current / (receivedAt - progress.buildTimestamp);
                const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
                msg = `${progress.forAnkiSync ? `${t('settings.dictionaryBuildAnkiStarted')}: ` : ''}${progress.current.toLocaleString('en-US')} / ${t('settings.dictionaryBuildModifiedCards', { numCards: progress.total.toLocaleString('en-US') })} [ETA: ${localizedDate(receivedAt + eta)} (${humanReadableTime(eta)})]`;
                break;
            case DictionaryBuildAnkiCacheStateType.stats:
                const stats = state.body as DictionaryBuildAnkiCacheStats;
                const parts: string[] = [];
                if (stats.tracksToBuild !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildAnkiTracks', {
                            tracks: stats.tracksToBuild.map((track) => `#${track + 1}`).join(', '),
                        })
                    );
                }
                if (stats.modifiedCards !== undefined) {
                    parts.push(
                        `${t('settings.dictionaryBuildModifiedCards', { numCards: stats.modifiedCards.toLocaleString('en-US') })}`
                    );
                }
                if (stats.tracksToClear?.length && stats.orphanedCards !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildOrphanedCards', {
                            numCards: stats.orphanedCards.toLocaleString('en-US'),
                            tracks: stats.tracksToClear.map((track) => `#${track + 1}`).join(', '),
                        })
                    );
                }
                const duration = Math.floor((receivedAt - stats.buildTimestamp) / 1000);
                if (duration > 0) {
                    parts.push(`[${duration.toLocaleString('en-US')}s]`);
                }
                msg = parts.join(' | ');
                break;
        }
    }

    return {
        severity: buildAnkiCacheState?.state.type === DictionaryBuildAnkiCacheStateType.error ? 'error' : 'info',
        msg,
        setBuildAnkiCacheState,
    };
};

const useBuildWaniKaniCacheState: () => {
    severity: 'error' | 'info';
    msg: string;
    setBuildWaniKaniCacheState: (state: DictionaryBuildWaniKaniCacheState | undefined) => void;
} = () => {
    const { t } = useTranslation();
    const [buildWaniKaniCacheStates, setBuildWaniKaniCacheStates] = useState<
        Map<number, StateWithArrivalTime<DictionaryBuildWaniKaniCacheState>>
    >(() => new Map());
    const setBuildWaniKaniCacheState = useCallback((state: DictionaryBuildWaniKaniCacheState | undefined) => {
        if (state === undefined) {
            setBuildWaniKaniCacheStates(new Map());
            return;
        }

        setBuildWaniKaniCacheStates((prev) => {
            const tracks = new Map(prev);
            tracks.set(state.body.track, { state, receivedAt: Date.now() });
            return tracks;
        });
    }, []);

    const formatTrack = (track: number) => {
        return t('settings.dictionaryBuildWaniKaniTrack', { trackNumber: track + 1 });
    };
    const formatTrackMessage = (
        stateWithArrivalTime: StateWithArrivalTime<DictionaryBuildWaniKaniCacheState>
    ): string => {
        const { state, receivedAt } = stateWithArrivalTime;
        const track = state.body.track;
        const trackMessage = formatTrack(track);
        const withTrack = (message: string) => {
            return `${trackMessage}: ${message}`;
        };

        switch (state.type) {
            case DictionaryBuildWaniKaniCacheStateType.error: {
                const error = state.body as DictionaryBuildWaniKaniCacheStateError;
                switch (error.code) {
                    case DictionaryBuildWaniKaniCacheStateErrorCode.concurrentBuild:
                        return withTrack(
                            t('settings.dictionaryBuildInProgress', {
                                time: localizedDate(
                                    (error.data as DictionaryBuildAnkiCacheStateErrorBuildExpirationData).expiration
                                ),
                            })
                        );
                    case DictionaryBuildWaniKaniCacheStateErrorCode.invalidWaniKaniToken:
                        return t('settings.dictionaryBuildWaniKaniTokenInvalidError', {
                            trackNumber: track + 1,
                        });
                    case DictionaryBuildWaniKaniCacheStateErrorCode.noYomitan:
                        return t('settings.dictionaryBuildYomitanError', {
                            trackNumber: track + 1,
                        });
                    case DictionaryBuildWaniKaniCacheStateErrorCode.failedToBuild:
                    default:
                        return withTrack(
                            error.msg ? t('info.error', { message: error.msg }) : t('info.errorNoMessage')
                        );
                }
            }
            case DictionaryBuildWaniKaniCacheStateType.start:
                return withTrack(t('settings.dictionaryBuildWaniKaniStarted'));
            case DictionaryBuildWaniKaniCacheStateType.progress: {
                const progress = state.body as DictionaryBuildWaniKaniCacheProgress;
                const rate = progress.current / (receivedAt - progress.buildTimestamp);
                const eta = rate ? Math.ceil((progress.total - progress.current) / rate) : 0;
                return withTrack(
                    `${progress.current.toLocaleString('en-US')} / ${t('settings.dictionaryBuildWaniKaniSubjects', { numSubjects: progress.total.toLocaleString('en-US') })} [ETA: ${localizedDate(receivedAt + eta)} (${humanReadableTime(eta)})]`
                );
            }
            case DictionaryBuildWaniKaniCacheStateType.stats: {
                const stats = state.body as DictionaryBuildWaniKaniCacheStats;
                const parts: string[] = [];
                if (stats.isTokensCleared) {
                    parts.push(t('settings.dictionaryBuildWaniKaniTrackCleared'));
                }
                if (stats.numFetchedAssignments !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildWaniKaniAssignments', {
                            numAssignments: stats.numFetchedAssignments.toLocaleString('en-US'),
                        })
                    );
                }
                if (stats.numFetchedSubjects !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildWaniKaniSubjects', {
                            numSubjects: stats.numFetchedSubjects.toLocaleString('en-US'),
                        })
                    );
                }
                if (stats.numImportedTokens !== undefined) {
                    parts.push(
                        t('settings.dictionaryBuildWaniKaniTokens', {
                            numTokens: stats.numImportedTokens.toLocaleString('en-US'),
                        })
                    );
                }
                const duration = Math.floor((receivedAt - stats.buildTimestamp) / 1000);
                if (duration > 0) parts.push(`[${duration.toLocaleString('en-US')}s]`);
                if (!parts.length) {
                    parts.push(t('settings.dictionaryBuildWaniKaniTrackNoChanges'));
                }
                return withTrack(parts.join(' | '));
            }
        }

        return '';
    };
    const messages: string[] = [];
    const trackStates = Array.from(buildWaniKaniCacheStates.entries()).sort(([lhs], [rhs]) => lhs - rhs);
    for (const [, state] of trackStates) {
        const trackMessage = formatTrackMessage(state);
        if (trackMessage) messages.push(trackMessage);
    }
    const msg = messages.join('\n');
    const severity = trackStates.some(([, state]) => state.state.type === DictionaryBuildWaniKaniCacheStateType.error)
        ? 'error'
        : 'info';

    return {
        severity,
        msg,
        setBuildWaniKaniCacheState,
    };
};

const Alert: React.FC<AlertProps> = ({ children, ...props }) => {
    return (
        <MuiAlert
            style={{
                // SettingsDialog applies height: 100vh to .MuiPaper-root - override it here
                height: 'auto',
            }}
            {...props}
        >
            {children}
        </MuiAlert>
    );
};

interface Props {
    settings: AsbplayerSettings;
    dictionaryProvider: DictionaryProvider;
    extensionInstalled: boolean;
    supportsDictionaryBrowser: boolean;
    supportsDictionaryWaniKani: boolean;
    supportsDictionaryMatchAcrossScripts: boolean;
    supportsDictionaryTokenAnnotationConfig: boolean;
    supportsDictionaryTokenStatusDisplayAlpha: boolean;
    supportsDictionaryYomitanMecab: boolean;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onViewKeyboardShortcuts: () => void;
    profiles: Profile[];
    activeProfile?: string;
    anki: Anki;
}

const DictionarySettingsTab: React.FC<Props> = ({
    dictionaryProvider,
    settings,
    extensionInstalled,
    supportsDictionaryBrowser,
    supportsDictionaryWaniKani,
    supportsDictionaryMatchAcrossScripts,
    supportsDictionaryTokenAnnotationConfig,
    supportsDictionaryTokenStatusDisplayAlpha,
    supportsDictionaryYomitanMecab,
    onSettingChanged,
    onViewKeyboardShortcuts,
    profiles,
    activeProfile,
    anki,
}) => {
    const { t } = useTranslation();
    const { ankiConnectUrl, ankiConnectApiKey, dictionaryTracks } = settings;
    const initialDictionaryTracksRef = useRef(dictionaryTracks);
    const [selectedDictionaryTrack, setSelectedDictionaryTrack] = useState<number>(0);
    const [tokenAnnotationTarget, setTokenAnnotationTarget] = useState<TokenAnnotationConfigTarget>('video');
    const selectedDictionary = dictionaryTracks[selectedDictionaryTrack];

    const getHelperTextForCacheSettingsDependencies = useCallback(
        (fieldName: string, key: keyof typeof selectedDictionary, error?: React.ReactNode) => {
            if (error) return error;
            const initialTrack = initialDictionaryTracksRef.current[selectedDictionaryTrack];
            if (compareDTField(key, initialTrack, selectedDictionary)) return;
            const helperTexts: string[] = [];
            if (ankiCacheDependentSettings.has(key)) {
                helperTexts.push(t('settings.ankiCacheDependentSettingsHelperText', { field: fieldName }));
            }
            if (waniKaniCacheDependentSettings.has(key)) {
                helperTexts.push(t('settings.waniKaniCacheDependentSettingsHelperText', { field: fieldName }));
            }
            return helperTexts.join(' ');
        },
        [selectedDictionary, selectedDictionaryTrack, t]
    );

    const [deckNames, setDeckNames] = useState<string[]>();
    const [allFieldNames, setAllFieldNames] = useState<string[]>();
    const [ankiError, setAnkiError] = useState<string>();
    const showTokenMatchStrategyPriority = [
        selectedDictionary.dictionaryTokenMatchStrategy,
        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy,
    ].some(
        (s) => s === TokenMatchStrategy.ANY_FORM_COLLECTED || s === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
    );
    const showMatchAcrossScriptsForStrategy = (strategy: TokenMatchStrategy) =>
        supportsDictionaryMatchAcrossScripts &&
        (strategy === TokenMatchStrategy.ANY_FORM_COLLECTED ||
            strategy === TokenMatchStrategy.LEMMA_FORM_COLLECTED ||
            strategy === TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED);
    const showWordMatchAcrossScripts = showMatchAcrossScriptsForStrategy(
        selectedDictionary.dictionaryTokenMatchStrategy
    );
    const showSentenceMatchAcrossScripts = showMatchAcrossScriptsForStrategy(
        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy
    );
    const selectedDictionaryShowThickness =
        selectedDictionary.dictionaryTokenStyling === TokenStyling.UNDERLINE ||
        selectedDictionary.dictionaryTokenStyling === TokenStyling.OVERLINE ||
        selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE;
    const tokenStylingToHide = useMemo(() => {
        if (selectedDictionary.dictionaryColorizeFullyKnownTokens) return;
        return getFullyKnownTokenStatus();
    }, [selectedDictionary.dictionaryColorizeFullyKnownTokens]);
    const tokenAnnotationStatusLabel = useCallback(
        (status: TokenStatus) => t(`settings.dictionaryTokenStatus${status}`),
        [t]
    );
    const tokenAnnotationStateLabel = useCallback(
        (state: TokenState) =>
            state === TokenState.IGNORED ? t('settings.dictionaryTokenStateIgnored') : String(state),
        [t]
    );
    const tokenAnnotationSelectOptions = useMemo(
        () =>
            tokenAnnotationStatuses
                .slice()
                .reverse()
                .map((status) => ({
                    value: tokenAnnotationStatusOptionValue(status),
                    label: tokenAnnotationStatusLabel(status),
                }))
                .concat(
                    tokenAnnotationStates.map((state) => ({
                        value: tokenAnnotationStateOptionValue(state),
                        label: tokenAnnotationStateLabel(state),
                    }))
                ),
        [tokenAnnotationStateLabel, tokenAnnotationStatusLabel]
    );
    const dictionaryTokenUnderlineOverlineStyleLabelKey = useMemo(() => {
        switch (selectedDictionary.dictionaryTokenStyling) {
            case TokenStyling.UNDERLINE:
                return 'settings.dictionaryTokenStylingUnderline';
            case TokenStyling.OVERLINE:
                return 'settings.dictionaryTokenStylingOverline';
            default:
                return undefined;
        }
    }, [selectedDictionary.dictionaryTokenStyling]);
    const dictionaryTokenPitchAccentAnnotationEnabled = useMemo(
        () =>
            selectedDictionary.dictionaryTokenAnnotationConfig.onStatuses.some(({ pitchAccent }) => pitchAccent) ||
            selectedDictionary.dictionaryTokenAnnotationConfig.onStates.some(({ pitchAccent }) => pitchAccent),
        [
            selectedDictionary.dictionaryTokenAnnotationConfig.onStatuses,
            selectedDictionary.dictionaryTokenAnnotationConfig.onStates,
        ]
    );
    const dictionaryTokenPitchAccentHoverOnlyForAllTargets = useMemo(
        () =>
            tokenAnnotationTargets.every(
                ({ target }) => selectedDictionary.dictionaryTokenAnnotationConfig[target].pitchAccent.onHoverEnabled
            ),
        [selectedDictionary.dictionaryTokenAnnotationConfig]
    );
    const dictionaryTokenPitchAccentUnderlineOverlineStyleWarning =
        supportsDictionaryTokenAnnotationConfig &&
        dictionaryTokenUnderlineOverlineStyleLabelKey !== undefined &&
        dictionaryTokenPitchAccentAnnotationEnabled &&
        !dictionaryTokenPitchAccentHoverOnlyForAllTargets
            ? t('settings.dictionaryTokenPitchAccentAnnotationUnderlineOverlineStyle', {
                  style: t(dictionaryTokenUnderlineOverlineStyleLabelKey),
                  pitchAccentOnHover: t('settings.dictionaryTokenAnnotationHoverPitchAccent'),
              })
            : undefined;
    const dictionaryTokenStylingHelperText =
        dictionaryTokenPitchAccentUnderlineOverlineStyleWarning ??
        (selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE
            ? t('settings.dictionaryTokenStylingOutlineHelperText')
            : undefined);
    const updateDictionaryTokenAnnotationConfig = useCallback(
        (
            update: (
                dictionaryTokenAnnotationConfig: DictionaryTokenAnnotationConfig
            ) => DictionaryTokenAnnotationConfig
        ) => {
            const newTracks = [...dictionaryTracks];
            const dictionaryTokenAnnotationConfig = update(
                newTracks[selectedDictionaryTrack].dictionaryTokenAnnotationConfig
            );
            newTracks[selectedDictionaryTrack] = {
                ...newTracks[selectedDictionaryTrack],
                dictionaryTokenAnnotationConfig,
            };
            onSettingChanged('dictionaryTracks', newTracks);
        },
        [dictionaryTracks, onSettingChanged, selectedDictionaryTrack]
    );
    const updateDictionaryTokenHoverAnnotation = useCallback(
        (target: TokenAnnotationConfigTarget, annotation: TokenAnnotationHoverKey, onHoverEnabled: boolean) => {
            updateDictionaryTokenAnnotationConfig((config) =>
                withTokenAnnotationHoverEnabled(config, target, annotation, onHoverEnabled)
            );
        },
        [updateDictionaryTokenAnnotationConfig]
    );
    const updateDictionaryTokenAnnotationSize = useCallback(
        (target: TokenAnnotationConfigTarget, annotation: TokenAnnotationSizeKey, size: number) => {
            updateDictionaryTokenAnnotationConfig((config) =>
                withTokenAnnotationSize(config, target, annotation, size)
            );
        },
        [updateDictionaryTokenAnnotationConfig]
    );
    const updateDictionaryTokenAnnotationStatusesAndStates = useCallback(
        (annotation: TokenAnnotationTriggerKey, selection: TokenAnnotationSelection) => {
            updateDictionaryTokenAnnotationConfig((config) =>
                withTokenAnnotationSelection(config, annotation, selection)
            );
        },
        [updateDictionaryTokenAnnotationConfig]
    );

    const [dictionaryYomitanUrlError, setDictionaryYomitanUrlError] = useState<string>();
    const [dictionaryYomitanMecabError, setDictionaryYomitanMecabError] = useState<React.ReactNode>();
    const [dictionaryWaniKaniError, setDictionaryWaniKaniError] = useState<string>();
    const [waniKaniUserInfo, setWaniKaniUserInfo] = useState<WaniKaniUser>();
    const [pendingDictionaryWaniKaniApiToken, setPendingDictionaryWaniKaniApiToken] = useState<string>();
    const [showDictionaryWaniKaniApiToken, setShowDictionaryWaniKaniApiToken] = useState(
        () => !selectedDictionary.dictionaryWaniKaniApiToken
    );
    const dictionaryWaniKaniApiTokenVisible =
        showDictionaryWaniKaniApiToken || !selectedDictionary.dictionaryWaniKaniApiToken;
    const dictionaryWaniKaniApiTokenSetupHelperText = (
        <Trans
            i18nKey="settings.dictionaryWaniKaniApiTokenHelperText"
            components={[<Link key={0} target="_blank" href={waniKaniApiTokenSetupUrl} />]}
        />
    );
    const dictionaryWaniKaniApiTokenCacheHelperText = getHelperTextForCacheSettingsDependencies(
        t('settings.dictionaryWaniKaniApiToken'),
        'dictionaryWaniKaniApiToken'
    );
    const dictionaryWaniKaniApiTokenHelperText =
        dictionaryWaniKaniError || !selectedDictionary.dictionaryWaniKaniApiToken.trim() ? (
            <>
                {dictionaryWaniKaniError ?? dictionaryWaniKaniApiTokenCacheHelperText}
                {(dictionaryWaniKaniError || dictionaryWaniKaniApiTokenCacheHelperText) && ' '}
                {dictionaryWaniKaniApiTokenSetupHelperText}
            </>
        ) : (
            dictionaryWaniKaniApiTokenCacheHelperText
        );
    const waniKaniUserInfoRequestId = useRef(0);
    const waniKaniUserInfoApiToken = useRef<string | undefined>(undefined);
    const waniKaniUserInfoRequest = useRef<{ apiToken: string; promise: Promise<WaniKaniUser> } | undefined>(undefined);
    const clearWaniKaniUserInfo = useCallback(() => {
        waniKaniUserInfoRequestId.current++;
        waniKaniUserInfoApiToken.current = undefined;
        waniKaniUserInfoRequest.current = undefined;
        setWaniKaniUserInfo(undefined);
    }, []);
    const renderDictionaryMatchAcrossScripts = () => (
        <SwitchLabelWithHoverEffect
            control={
                <Switch
                    checked={selectedDictionary.dictionaryMatchAcrossScripts}
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryMatchAcrossScripts: e.target.checked,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                />
            }
            label={t('settings.dictionaryMatchAcrossScripts')}
            labelPlacement="start"
        />
    );
    const requestDictionaryWaniKaniUserInfo = useCallback(
        async (apiToken: string) => {
            const trimmedApiToken = apiToken.trim();
            if (!trimmedApiToken) {
                setDictionaryWaniKaniError(undefined);
                clearWaniKaniUserInfo();
                return;
            }

            if (waniKaniUserInfo && waniKaniUserInfoApiToken.current === trimmedApiToken) return;

            const existingRequest = waniKaniUserInfoRequest.current;
            if (existingRequest?.apiToken === trimmedApiToken) {
                await existingRequest.promise.catch(() => undefined);
                return;
            }

            const requestId = ++waniKaniUserInfoRequestId.current;
            const promise = new WaniKani(trimmedApiToken).user();
            waniKaniUserInfoRequest.current = { apiToken: trimmedApiToken, promise };

            try {
                const user = await promise;
                if (requestId !== waniKaniUserInfoRequestId.current) return;
                setDictionaryWaniKaniError(undefined);
                waniKaniUserInfoApiToken.current = trimmedApiToken;
                setWaniKaniUserInfo(user);
            } catch (e) {
                if (requestId !== waniKaniUserInfoRequestId.current) return;
                waniKaniUserInfoApiToken.current = undefined;
                setWaniKaniUserInfo(undefined);
                if (e instanceof Error) {
                    setDictionaryWaniKaniError(e.message);
                } else if (typeof e === 'string') {
                    setDictionaryWaniKaniError(e);
                } else {
                    setDictionaryWaniKaniError(String(e));
                }
            } finally {
                if (waniKaniUserInfoRequest.current?.promise === promise) {
                    waniKaniUserInfoRequest.current = undefined;
                }
            }
        },
        [clearWaniKaniUserInfo, waniKaniUserInfo]
    );
    const dictionaryRequestYomitan = useCallback(async () => {
        try {
            const yomitan = new Yomitan(selectedDictionary);
            await yomitan.version();
            setDictionaryYomitanUrlError(undefined);
            if (!supportsDictionaryYomitanMecab) {
                setDictionaryYomitanMecabError(undefined);
                return;
            }
            if (selectedDictionary.dictionaryYomitanParser !== 'mecab' || yomitan.getSupportsMecabLemma()) {
                setDictionaryYomitanMecabError(undefined);
                return;
            }
            if (yomitan.getSupportsMecab()) {
                setDictionaryYomitanMecabError(
                    <Trans
                        i18nKey="settings.dictionaryYomitanMecabLemmaNotSupportedError"
                        components={[<Link key={0} target="_blank" href={yomitanMecabInstallerUrl} />]}
                    />
                );
                return;
            }
            setDictionaryYomitanMecabError(
                <Trans
                    i18nKey="settings.dictionaryYomitanMecabNotSupportedError"
                    components={[<Link key={0} target="_blank" href={yomitanMecabInstallerUrl} />]}
                />
            );
        } catch (e) {
            console.error(e);
            if (e instanceof Error) {
                setDictionaryYomitanUrlError(e.message);
            } else if (typeof e === 'string') {
                setDictionaryYomitanUrlError(e);
            } else {
                setDictionaryYomitanUrlError(String(e));
            }
        }
    }, [selectedDictionary, supportsDictionaryYomitanMecab]);

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            if (canceled) {
                return;
            }

            dictionaryRequestYomitan();
        }, 3000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [dictionaryRequestYomitan]);

    useEffect(() => {
        setDictionaryWaniKaniError(undefined);
        setPendingDictionaryWaniKaniApiToken(undefined);
        clearWaniKaniUserInfo();
    }, [clearWaniKaniUserInfo, selectedDictionaryTrack]);

    useEffect(() => {
        if (pendingDictionaryWaniKaniApiToken === undefined) return;

        const timeout = setTimeout(() => {
            void requestDictionaryWaniKaniUserInfo(pendingDictionaryWaniKaniApiToken);
        }, 3000);

        return () => clearTimeout(timeout);
    }, [pendingDictionaryWaniKaniApiToken, requestDictionaryWaniKaniUserInfo]);

    useEffect(() => {
        void (async () => {
            try {
                setDeckNames((await anki.deckNames(ankiConnectUrl)).sort((a, b) => a.localeCompare(b)));
                const modelNames = await anki.modelNames(ankiConnectUrl);
                const allFieldNamesSet = new Set<string>();
                for (const modelName of modelNames) {
                    const fieldNames = await anki.modelFieldNames(modelName, ankiConnectUrl);
                    for (const fieldName of fieldNames) {
                        allFieldNamesSet.add(fieldName);
                    }
                }
                setAllFieldNames(Array.from(allFieldNamesSet).sort((a, b) => a.localeCompare(b)));
            } catch (e) {
                setDeckNames(undefined);
                setAllFieldNames(undefined);
                setAnkiError(e instanceof Error ? e.message : String(e));
            }
        })();
    }, [anki, ankiConnectUrl, ankiConnectApiKey]);

    const yomitanSectionRef = useRef<HTMLSpanElement | null>(null);
    const handleYomitanHelperTextClicked = () => {
        yomitanSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const [exportingDictionaryDB, setExportingDictionaryDB] = useState<boolean>();
    const handleExportDictionaryDB = useCallback(async () => {
        void ensureStoragePersisted();
        try {
            setExportingDictionaryDB(true);
            await dictionaryProvider.exportRecordLocalBulk();
        } finally {
            setExportingDictionaryDB(false);
        }
    }, [dictionaryProvider]);

    const buildAnkiCacheDisabled = dictionaryTracks.every(
        (dt) => !dictionaryStatusCollectionEnabled(dt, { includeStates: false })
    );
    const ankiFieldsEnabled = dictionaryTracks.some(
        (dt) => dt.dictionaryAnkiWordFields.length || dt.dictionaryAnkiSentenceFields.length
    );
    const buildWaniKaniCacheDisabled = dictionaryTracks.every(
        (dt) => !dictionaryStatusCollectionEnabled(dt, { includeStates: false })
    );
    const waniKaniTokenEnabled = dictionaryTracks.some((dt) => dt.dictionaryWaniKaniApiToken.trim());
    const [buildingAnkiCache, setBuildingAnkiCache] = useState<boolean>(false);
    const { severity: buildMessageSeverity, msg: buildMessage, setBuildAnkiCacheState } = useBuildAnkiCacheState();
    const [buildingWaniKaniCache, setBuildingWaniKaniCache] = useState<boolean>(false);
    const {
        severity: buildWaniKaniMessageSeverity,
        msg: buildWaniKaniMessage,
        setBuildWaniKaniCacheState,
    } = useBuildWaniKaniCacheState();

    const handleBuildAnkiCache = useCallback(async () => {
        try {
            setBuildingAnkiCache(true);
            setBuildAnkiCacheState(undefined);
            void ensureStoragePersisted();
            await dictionaryProvider.buildAnkiCache(activeProfile, settings);
        } catch (e) {
            console.error('Failed to send build Anki cache message', e);
            setBuildAnkiCacheState({
                type: DictionaryBuildAnkiCacheStateType.error,
                body: {
                    code: DictionaryBuildAnkiCacheStateErrorCode.failedToBuild,
                    msg: e instanceof Error ? e.message : String(e),
                } as DictionaryBuildAnkiCacheStateError,
            });
        } finally {
            setBuildingAnkiCache(false);
        }
    }, [dictionaryProvider, settings, activeProfile, setBuildAnkiCacheState]);

    useEffect(() => {
        return dictionaryProvider.onBuildAnkiCacheStateChange(setBuildAnkiCacheState);
    }, [dictionaryProvider, setBuildAnkiCacheState]);

    const handleBuildWaniKaniCache = useCallback(async () => {
        try {
            setBuildingWaniKaniCache(true);
            setBuildWaniKaniCacheState(undefined);
            void ensureStoragePersisted();
            await dictionaryProvider.buildWaniKaniCache(activeProfile);
        } catch (e) {
            console.error('Failed to send build WaniKani cache message', e);
            dictionaryTracks.forEach((dt, track) => {
                if (!dictionaryStatusCollectionEnabled(dt, { includeStates: false })) return;
                setBuildWaniKaniCacheState({
                    type: DictionaryBuildWaniKaniCacheStateType.error,
                    body: {
                        track,
                        code: DictionaryBuildWaniKaniCacheStateErrorCode.failedToBuild,
                        msg: e instanceof Error ? e.message : String(e),
                    } as DictionaryBuildWaniKaniCacheStateError,
                });
            });
        } finally {
            setBuildingWaniKaniCache(false);
        }
    }, [dictionaryProvider, dictionaryTracks, activeProfile, setBuildWaniKaniCacheState]);

    useEffect(() => {
        return dictionaryProvider.onBuildWaniKaniCacheStateChange(setBuildWaniKaniCacheState);
    }, [dictionaryProvider, setBuildWaniKaniCacheState]);

    const [dictionaryImportOpen, setDictionaryImportOpen] = useState<boolean>(false);
    const [wordBrowserOpen, setWordBrowserOpen] = useState<boolean>(false);
    const ankiSectionRef = useRef<HTMLDivElement | null>(null);
    const handleAnkiHelperTextClicked = () => ankiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    const subtitleStyles = useMemo(
        () => computeStyles(textSubtitleSettingsForTrack(settings, selectedDictionaryTrack) as TextSubtitleSettings),
        [settings, selectedDictionaryTrack]
    );
    const theme = useTheme();
    const selectedTokenAnnotationTargetIndex = tokenAnnotationTargets.findIndex(
        ({ target }) => target === tokenAnnotationTarget
    );
    return (
        <>
            <DictionaryImport
                open={dictionaryImportOpen}
                onClose={() => setDictionaryImportOpen(false)}
                dictionaryTracks={dictionaryTracks}
                selectedDictionaryTrack={selectedDictionaryTrack}
                dictionaryProvider={dictionaryProvider}
                activeProfile={activeProfile}
                profiles={profiles}
            />
            <WordBrowserDialog
                open={wordBrowserOpen}
                dictionaryProvider={dictionaryProvider}
                activeProfile={activeProfile}
                dictionaryTracks={dictionaryTracks}
                supportsDictionaryWaniKani={supportsDictionaryWaniKani}
                onClose={() => setWordBrowserOpen(false)}
            />
            <Stack spacing={1}>
                {(dictionaryYomitanUrlError || dictionaryYomitanMecabError || !extensionInstalled) && (
                    <Alert severity="info">
                        <Stack spacing={1}>
                            {(dictionaryYomitanUrlError || dictionaryYomitanMecabError) && (
                                <div>
                                    <Trans
                                        i18nKey="settings.annotationHelperText"
                                        components={[
                                            <Link
                                                key={0}
                                                onClick={handleYomitanHelperTextClicked}
                                                sx={{ cursor: 'pointer' }}
                                            />,
                                        ]}
                                    />
                                </div>
                            )}
                            {!extensionInstalled && (
                                <div>
                                    <Trans i18nKey="settings.annotationNoExtensionWarn" />
                                </div>
                            )}
                        </Stack>
                    </Alert>
                )}
                <SettingsSection>{t('settings.manageWords')}</SettingsSection>
                <Stack spacing={1}>
                    {supportsDictionaryBrowser && (
                        <Button variant="contained" color="primary" onClick={() => setWordBrowserOpen(true)}>
                            {t('settings.dictionaryBrowser.title')}
                        </Button>
                    )}
                    <div>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
                            {t('settings.dictionaryLocalWordDatabase')}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ flex: 1 }}
                                onClick={() => setDictionaryImportOpen(true)}
                            >
                                {t('action.importDictionaryLocalRecords')}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ flex: 1 }}
                                onClick={handleExportDictionaryDB}
                                loading={exportingDictionaryDB}
                            >
                                {t('action.exportDictionaryLocalRecords')}
                            </Button>
                        </Stack>
                        <Typography variant="caption" color="textSecondary">
                            <Trans
                                i18nKey={'settings.annotationLocalAnkiHelperText'}
                                components={[
                                    <Link key={0} onClick={onViewKeyboardShortcuts} sx={{ cursor: 'pointer' }} />,
                                ]}
                            />
                        </Typography>
                    </div>
                    <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
                            {t('settings.dictionaryAnkiWordDatabase')}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            style={{ width: '100%' }}
                            onClick={handleBuildAnkiCache}
                            loading={buildingAnkiCache}
                            disabled={buildAnkiCacheDisabled}
                            startIcon={<RefreshIcon />}
                        >
                            {t('settings.buildAnkiCache')}
                        </Button>
                        <Typography variant="caption" color="textSecondary">
                            {t('settings.buildAnkiCacheHelperText')}{' '}
                            {!ankiFieldsEnabled && (
                                <Trans
                                    i18nKey={'settings.buildAnkiCacheAnkiEnableHelperText'}
                                    components={[
                                        <Link
                                            key={0}
                                            onClick={handleAnkiHelperTextClicked}
                                            sx={{ cursor: 'pointer' }}
                                        />,
                                    ]}
                                />
                            )}
                        </Typography>
                        {buildMessage && buildMessageSeverity && (
                            <div style={{ marginTop: 8 }}>
                                <Alert severity={buildMessageSeverity}>{buildMessage}</Alert>
                            </div>
                        )}
                    </Stack>
                    {supportsDictionaryWaniKani && (
                        <Stack spacing={1}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', pb: 0.5, pt: 1 }}>
                                {t('settings.dictionaryWaniKaniWordDatabase')}
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ width: '100%' }}
                                onClick={() => void handleBuildWaniKaniCache()}
                                loading={buildingWaniKaniCache}
                                disabled={buildWaniKaniCacheDisabled}
                                startIcon={<RefreshIcon />}
                            >
                                {t('settings.buildWaniKaniCache')}
                            </Button>
                            <Typography variant="caption" color="textSecondary">
                                {t('settings.buildWaniKaniCacheHelperText')}{' '}
                                {!waniKaniTokenEnabled && t('settings.buildWaniKaniCacheTokenEnableHelperText')}
                            </Typography>
                            {buildWaniKaniMessage && buildWaniKaniMessageSeverity && (
                                <div style={{ marginTop: 8 }}>
                                    <Alert severity={buildWaniKaniMessageSeverity} sx={{ whiteSpace: 'pre-line' }}>
                                        {buildWaniKaniMessage}
                                    </Alert>
                                </div>
                            )}
                        </Stack>
                    )}
                </Stack>
                <SettingsSection docs="docs/reference/settings#annotation">{t('settings.annotation')}</SettingsSection>
                <SettingsTextField
                    select
                    fullWidth
                    color="primary"
                    variant="outlined"
                    size="small"
                    label={t('settings.subtitleTrack')!}
                    value={selectedDictionaryTrack}
                    onChange={(e) => {
                        const track = Number(e.target.value);
                        setSelectedDictionaryTrack(track);
                        setShowDictionaryWaniKaniApiToken(!dictionaryTracks[track].dictionaryWaniKaniApiToken);
                    }}
                >
                    {[...Array(NUM_DICTIONARY_TRACKS).keys()].map((i) => (
                        <MenuItem key={i} value={i}>
                            {t('settings.subtitleTrackChoice', { trackNumber: i + 1 })}
                        </MenuItem>
                    ))}
                </SettingsTextField>
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryTokenAnnotationConfig.colorizeEnabled}
                            onChange={(e) => {
                                const colorizeEnabled = e.target.checked;
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryColorizeSubtitles: colorizeEnabled,
                                    dictionaryTokenAnnotationConfig: {
                                        ...newTracks[selectedDictionaryTrack].dictionaryTokenAnnotationConfig,
                                        colorizeEnabled,
                                    },
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryColorizeSubtitles')}
                    labelPlacement="start"
                />
                <SwitchLabelWithHoverEffect
                    control={
                        <Switch
                            checked={selectedDictionary.dictionaryAutoGenerateStatistics}
                            onChange={(e) => {
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryAutoGenerateStatistics: e.target.checked,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                        />
                    }
                    label={t('settings.dictionaryAutoGenerateStatistics')}
                    labelPlacement="start"
                />
                {supportsDictionaryTokenAnnotationConfig &&
                    tokenAnnotationTriggerOptions.map(({ annotation, labelKey }) => {
                        const value = tokenAnnotationSelectionOptionValues(
                            tokenAnnotationSelection(selectedDictionary.dictionaryTokenAnnotationConfig, annotation)
                        );
                        return (
                            <SettingsTextField
                                key={annotation}
                                select
                                fullWidth
                                color="primary"
                                variant="outlined"
                                size="small"
                                label={t(labelKey)!}
                                value={value}
                                helperText={
                                    annotation === 'pitchAccent'
                                        ? dictionaryTokenPitchAccentUnderlineOverlineStyleWarning
                                        : undefined
                                }
                                SelectProps={{
                                    multiple: true,
                                    renderValue: (selected) => {
                                        const selectedValues = tokenAnnotationOptionValues(selected);
                                        const selection = tokenAnnotationSelectionFromOptionValues(selectedValues);
                                        const statusLabels = tokenAnnotationStatusSelectionLabels(
                                            selection.statuses,
                                            tokenAnnotationStatusLabel
                                        );
                                        const stateLabels = selection.states.map(tokenAnnotationStateLabel);
                                        return ([...statusLabels, ...stateLabels].join(', ') ||
                                            t('settings.dictionaryTokenReadingAnnotationNever'))!;
                                    },
                                }}
                                onChange={(e) => {
                                    const selectedValues = tokenAnnotationOptionValues(e.target.value);
                                    updateDictionaryTokenAnnotationStatusesAndStates(
                                        annotation,
                                        tokenAnnotationSelectionFromOptionValues(selectedValues)
                                    );
                                }}
                            >
                                {tokenAnnotationSelectOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        <ListItemIcon>
                                            <Checkbox checked={value.includes(option.value)} />
                                        </ListItemIcon>
                                        <ListItemText primary={option.label} />
                                    </MenuItem>
                                ))}
                            </SettingsTextField>
                        );
                    })}
                {!supportsDictionaryTokenAnnotationConfig && (
                    <>
                        <FormControl>
                            <FormLabel component="legend">{t('settings.dictionaryTokenReadingAnnotation')}</FormLabel>
                            <RadioGroup row={false}>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenReadingAnnotation ===
                                                TokenReadingAnnotation.ALWAYS
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenReadingAnnotationAlways')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenReadingAnnotation ===
                                                TokenReadingAnnotation.LEARNING_OR_BELOW
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenReadingAnnotation:
                                                        TokenReadingAnnotation.LEARNING_OR_BELOW,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenReadingAnnotationLearningOrBelow')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenReadingAnnotation ===
                                                TokenReadingAnnotation.UNKNOWN_OR_BELOW
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenReadingAnnotation:
                                                        TokenReadingAnnotation.UNKNOWN_OR_BELOW,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenReadingAnnotationUnknownOrBelow')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenReadingAnnotation ===
                                                TokenReadingAnnotation.NEVER
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenReadingAnnotation: TokenReadingAnnotation.NEVER,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenReadingAnnotationNever')}
                                />
                            </RadioGroup>
                        </FormControl>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryDisplayIgnoredTokenReadings}
                                    onChange={(e) => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryDisplayIgnoredTokenReadings: e.target.checked,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryDisplayIgnoredTokenReadings')}
                            labelPlacement="start"
                        />
                        <FormControl>
                            <FormLabel component="legend">{t('settings.dictionaryTokenFrequencyAnnotation')}</FormLabel>
                            <RadioGroup row={false}>
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                                TokenFrequencyAnnotation.ALWAYS
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.ALWAYS,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenFrequencyAnnotationAlways')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                                TokenFrequencyAnnotation.UNCOLLECTED_ONLY
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenFrequencyAnnotation:
                                                        TokenFrequencyAnnotation.UNCOLLECTED_ONLY,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenFrequencyAnnotationUncollectedOnly')}
                                />
                                <LabelWithHoverEffect
                                    control={
                                        <Radio
                                            checked={
                                                selectedDictionary.dictionaryTokenFrequencyAnnotation ===
                                                TokenFrequencyAnnotation.NEVER
                                            }
                                            onChange={() => {
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.NEVER,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t('settings.dictionaryTokenFrequencyAnnotationNever')}
                                />
                            </RadioGroup>
                        </FormControl>
                    </>
                )}
                {!supportsDictionaryTokenAnnotationConfig && (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryColorizeOnHoverOnly}
                                    onChange={(e) => {
                                        const onHoverEnabled = e.target.checked;
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryColorizeOnHoverOnly: onHoverEnabled,
                                            dictionaryTokenAnnotationConfig: withTokenAnnotationsHoverEnabled(
                                                newTracks[selectedDictionaryTrack].dictionaryTokenAnnotationConfig,
                                                'video',
                                                legacyVideoHoverAnnotationKeys,
                                                onHoverEnabled
                                            ),
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryColorizeOnHoverOnly')}
                            labelPlacement="start"
                        />
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryHighlightOnHover}
                                    onChange={(e) => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryHighlightOnHover: e.target.checked,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryHighlightOnHover')}
                            labelPlacement="start"
                        />
                    </>
                )}
                <SettingsSection>{t('settings.coloringStrategy')}</SettingsSection>
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategy')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.ANY_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.ANY_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryTokenMatchStrategy ===
                                        TokenMatchStrategy.EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenMatchStrategy: TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                        />
                    </RadioGroup>
                </FormControl>
                {showWordMatchAcrossScripts && renderDictionaryMatchAcrossScripts()}
                {showTokenMatchStrategyPriority && (
                    <FormControl>
                        <FormLabel component="legend">{t('settings.dictionaryTokenMatchStrategyPriority')}</FormLabel>
                        <RadioGroup row={false}>
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.EXACT
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.EXACT,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityExact')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.LEMMA
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority: TokenMatchStrategyPriority.LEMMA,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityLemma')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.BEST_KNOWN
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority:
                                                    TokenMatchStrategyPriority.BEST_KNOWN,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityBestKnown')}
                            />
                            <LabelWithHoverEffect
                                control={
                                    <Radio
                                        checked={
                                            selectedDictionary.dictionaryTokenMatchStrategyPriority ===
                                            TokenMatchStrategyPriority.LEAST_KNOWN
                                        }
                                        onChange={() => {
                                            const newTracks = [...dictionaryTracks];
                                            newTracks[selectedDictionaryTrack] = {
                                                ...newTracks[selectedDictionaryTrack],
                                                dictionaryTokenMatchStrategyPriority:
                                                    TokenMatchStrategyPriority.LEAST_KNOWN,
                                            };
                                            onSettingChanged('dictionaryTracks', newTracks);
                                        }}
                                    />
                                }
                                label={t('settings.dictionaryTokenMatchStrategyPriorityLeastKnown')}
                            />
                        </RadioGroup>
                    </FormControl>
                )}
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryAnkiSentenceTokenMatchStrategy')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.ANY_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.ANY_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyAnyFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_OR_EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaOrExactFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.LEMMA_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.LEMMA_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyLemmaFormCollected')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={
                                        selectedDictionary.dictionaryAnkiSentenceTokenMatchStrategy ===
                                        TokenMatchStrategy.EXACT_FORM_COLLECTED
                                    }
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiSentenceTokenMatchStrategy:
                                                TokenMatchStrategy.EXACT_FORM_COLLECTED,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenMatchStrategyExactFormCollected')}
                        />
                    </RadioGroup>
                </FormControl>
                {showSentenceMatchAcrossScripts && renderDictionaryMatchAcrossScripts()}
                <SettingsSection ref={yomitanSectionRef}>{t('settings.dictionaryYomitanSection')}</SettingsSection>
                {dictionaryYomitanUrlError && (
                    <Alert severity="info">
                        <Trans
                            i18nKey={t('settings.yomitanHelperText')}
                            components={[<Link key={0} target="_blank" href={yomitanInstallerUrl} />]}
                        />
                    </Alert>
                )}
                <SettingsTextField
                    label={t('settings.dictionaryYomitanUrl')}
                    value={selectedDictionary.dictionaryYomitanUrl}
                    error={Boolean(dictionaryYomitanUrlError)}
                    helperText={getHelperTextForCacheSettingsDependencies(
                        t('settings.dictionaryYomitanUrl'),
                        'dictionaryYomitanUrl',
                        dictionaryYomitanUrlError
                    )}
                    color="primary"
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryYomitanUrl: e.target.value,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={dictionaryRequestYomitan}>
                                        <RefreshIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
                {dictionaryYomitanMecabError && <Alert severity="info">{dictionaryYomitanMecabError}</Alert>}
                {supportsDictionaryYomitanMecab && (
                    <SettingsTextField
                        select
                        label={t('settings.dictionaryYomitanParser')}
                        value={selectedDictionary.dictionaryYomitanParser}
                        error={Boolean(dictionaryYomitanMecabError)}
                        helperText={getHelperTextForCacheSettingsDependencies(
                            t('settings.dictionaryYomitanParser'),
                            'dictionaryYomitanParser',
                            dictionaryYomitanMecabError
                        )}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryYomitanParser: e.target.value as DictionaryTrack['dictionaryYomitanParser'],
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                    >
                        <MenuItem value="scanning-parser">{t('settings.dictionaryYomitanScanningParser')}</MenuItem>
                        <MenuItem value="mecab">{t('settings.dictionaryYomitanMecabParser')}</MenuItem>
                    </SettingsTextField>
                )}
                {(selectedDictionary.dictionaryYomitanParser === 'scanning-parser' ||
                    !supportsDictionaryYomitanMecab) && (
                    <SettingsTextField
                        type="number"
                        label={t('settings.dictionaryYomitanScanLength')}
                        value={selectedDictionary.dictionaryYomitanScanLength}
                        helperText={getHelperTextForCacheSettingsDependencies(
                            t('settings.dictionaryYomitanScanLength'),
                            'dictionaryYomitanScanLength'
                        )}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryYomitanScanLength: Number(e.target.value),
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                        slotProps={{
                            htmlInput: { min: 1, max: 128, step: 1 },
                        }}
                    />
                )}
                <SettingsSection ref={ankiSectionRef}>{t('settings.anki')}</SettingsSection>
                <Autocomplete
                    multiple
                    options={deckNames ?? []}
                    value={selectedDictionary.dictionaryAnkiDecks}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiDecks: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={({ key, ...restOfProps }, option, { selected }) => (
                        <li key={key} {...restOfProps}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiDecks')}
                            placeholder={t('settings.dictionaryAnkiSelectDecks')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForCacheSettingsDependencies(
                                t('settings.dictionaryAnkiDecks'),
                                'dictionaryAnkiDecks',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <Autocomplete
                    multiple
                    options={allFieldNames ?? []}
                    value={selectedDictionary.dictionaryAnkiWordFields}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiWordFields: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiWordFields')}
                            placeholder={t('settings.dictionaryAnkiSelectFields')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForCacheSettingsDependencies(
                                t('settings.dictionaryAnkiWordFields'),
                                'dictionaryAnkiWordFields',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <Autocomplete
                    multiple
                    options={allFieldNames ?? []}
                    value={selectedDictionary.dictionaryAnkiSentenceFields}
                    onChange={(_, newValue) => {
                        const items = newValue as string[];
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiSentenceFields: items,
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    disableCloseOnSelect
                    renderOption={(props, option, { selected }) => (
                        <li {...props}>
                            <ListItemIcon>
                                <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText primary={option} />
                        </li>
                    )}
                    renderInput={(params) => (
                        <SettingsTextField
                            {...params}
                            label={t('settings.dictionaryAnkiSentenceFields')}
                            placeholder={t('settings.dictionaryAnkiSelectFields')}
                            error={Boolean(ankiError)}
                            helperText={getHelperTextForCacheSettingsDependencies(
                                t('settings.dictionaryAnkiSentenceFields'),
                                'dictionaryAnkiSentenceFields',
                                ankiError
                            )}
                            fullWidth
                        />
                    )}
                />
                <SettingsTextField
                    type="number"
                    label={t('settings.dictionaryAnkiMatureCutoff')}
                    value={selectedDictionary.dictionaryAnkiMatureCutoff}
                    helperText={getHelperTextForCacheSettingsDependencies(
                        t('settings.dictionaryAnkiMatureCutoff'),
                        'dictionaryAnkiMatureCutoff'
                    )}
                    color="primary"
                    onChange={(e) => {
                        const newTracks = [...dictionaryTracks];
                        newTracks[selectedDictionaryTrack] = {
                            ...newTracks[selectedDictionaryTrack],
                            dictionaryAnkiMatureCutoff: Number(e.target.value),
                        };
                        onSettingChanged('dictionaryTracks', newTracks);
                    }}
                    slotProps={{
                        htmlInput: { min: 1, max: 36500, step: 1 },
                    }}
                />
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryAnkiTreatSuspended')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryAnkiTreatSuspended === 'NORMAL'}
                                    onChange={(event) => {
                                        if (!event.target.checked) return;

                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryAnkiTreatSuspended: 'NORMAL',
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryAnkiTreatSuspendedNormal')}
                        />
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            if (tokenStatus === TokenStatus.UNCOLLECTED) return null;
                            return (
                                <LabelWithHoverEffect
                                    key={i}
                                    control={
                                        <Radio
                                            checked={selectedDictionary.dictionaryAnkiTreatSuspended === tokenStatus}
                                            onChange={(event) => {
                                                if (!event.target.checked) return;
                                                const newTracks = [...dictionaryTracks];
                                                newTracks[selectedDictionaryTrack] = {
                                                    ...newTracks[selectedDictionaryTrack],
                                                    dictionaryAnkiTreatSuspended: tokenStatus,
                                                };
                                                onSettingChanged('dictionaryTracks', newTracks);
                                            }}
                                        />
                                    }
                                    label={t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                />
                            );
                        })}
                    </RadioGroup>
                </FormControl>
                {supportsDictionaryWaniKani && (
                    <>
                        <SettingsSection>{t('settings.dictionaryWaniKaniSection')}</SettingsSection>
                        {waniKaniUserInfo && (
                            <Typography variant="body2" color="textSecondary">
                                {`${waniKaniUserInfo.data.username}: ${waniKaniUserInfo.data.level}/${
                                    waniKaniUserInfo.data.subscription.max_level_granted ?? '?'
                                }`}
                            </Typography>
                        )}
                        <SettingsTextField
                            type="text"
                            label={t('settings.dictionaryWaniKaniApiToken')}
                            value={
                                dictionaryWaniKaniApiTokenVisible
                                    ? selectedDictionary.dictionaryWaniKaniApiToken
                                    : maskApiToken(selectedDictionary.dictionaryWaniKaniApiToken)
                            }
                            error={Boolean(dictionaryWaniKaniError)}
                            helperText={dictionaryWaniKaniApiTokenHelperText}
                            color="primary"
                            sx={{ '& input': { fontFamily: 'monospace' } }}
                            onChange={(e) => {
                                const apiToken = e.target.value;
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryWaniKaniApiToken: apiToken,
                                };
                                clearWaniKaniUserInfo();
                                setPendingDictionaryWaniKaniApiToken(apiToken);
                                onSettingChanged('dictionaryTracks', newTracks);
                            }}
                            slotProps={{
                                input: {
                                    disabled: !dictionaryWaniKaniApiTokenVisible,
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip title="">
                                                <IconButton
                                                    onClick={() =>
                                                        setShowDictionaryWaniKaniApiToken((showToken) => !showToken)
                                                    }
                                                    onMouseDown={(event) => event.preventDefault()}
                                                >
                                                    {dictionaryWaniKaniApiTokenVisible ? (
                                                        <VisibilityOffIcon />
                                                    ) : (
                                                        <VisibilityIcon />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="">
                                                <span>
                                                    <IconButton
                                                        disabled={!selectedDictionary.dictionaryWaniKaniApiToken.trim()}
                                                        onClick={() =>
                                                            void requestDictionaryWaniKaniUserInfo(
                                                                selectedDictionary.dictionaryWaniKaniApiToken
                                                            )
                                                        }
                                                    >
                                                        <RefreshIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                    </>
                )}
                <SettingsSection>{t('settings.styling')}</SettingsSection>
                <FormControl>
                    <FormLabel component="legend">{t('settings.dictionaryTokenStyling')}</FormLabel>
                    <RadioGroup row={false}>
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.TEXT}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.TEXT,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingText')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.BACKGROUND}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.BACKGROUND,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingBackground')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.UNDERLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.UNDERLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingUnderline')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.OVERLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.OVERLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingOverline')}
                        />
                        <LabelWithHoverEffect
                            control={
                                <Radio
                                    checked={selectedDictionary.dictionaryTokenStyling === TokenStyling.OUTLINE}
                                    onChange={() => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStyling: TokenStyling.OUTLINE,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryTokenStylingOutline')}
                        />
                    </RadioGroup>
                    {dictionaryTokenStylingHelperText && (
                        <Typography variant="caption" color="textSecondary">
                            {dictionaryTokenStylingHelperText}
                        </Typography>
                    )}
                </FormControl>
                {selectedDictionaryShowThickness && (
                    <SettingsTextField
                        type="number"
                        label={t('settings.dictionaryTokenStylingThickness')}
                        fullWidth
                        value={selectedDictionary.dictionaryTokenStylingThickness}
                        color="primary"
                        onChange={(e) => {
                            const newTracks = [...dictionaryTracks];
                            newTracks[selectedDictionaryTrack] = {
                                ...newTracks[selectedDictionaryTrack],
                                dictionaryTokenStylingThickness: Number(e.target.value),
                            };
                            onSettingChanged('dictionaryTracks', newTracks);
                        }}
                        slotProps={{
                            htmlInput: {
                                min: 0.1,
                                step: 0.1,
                            },
                            input: {
                                endAdornment: <InputAdornment position="end">px</InputAdornment>,
                            },
                        }}
                    />
                )}
                {supportsDictionaryTokenAnnotationConfig && (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryHighlightOnHover}
                                    onChange={(e) => {
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryHighlightOnHover: e.target.checked,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryHighlightOnHover')}
                            labelPlacement="start"
                        />
                        <SettingsGroups
                            groupLabels={tokenAnnotationTargets.map(({ labelKey }) => t(labelKey))}
                            selectedGroupIndex={selectedTokenAnnotationTargetIndex}
                            onGroupSelected={(index) => setTokenAnnotationTarget(tokenAnnotationTargets[index].target)}
                        >
                            {tokenAnnotationHoverOptions.map(({ annotation, labelKey }) => (
                                <SwitchLabelWithHoverEffect
                                    key={annotation}
                                    control={
                                        <Switch
                                            checked={
                                                selectedDictionary.dictionaryTokenAnnotationConfig[
                                                    tokenAnnotationTarget
                                                ][annotation].onHoverEnabled
                                            }
                                            onChange={(e) =>
                                                updateDictionaryTokenHoverAnnotation(
                                                    tokenAnnotationTarget,
                                                    annotation,
                                                    e.target.checked
                                                )
                                            }
                                        />
                                    }
                                    label={t(labelKey)}
                                    labelPlacement="start"
                                />
                            ))}
                            {tokenAnnotationSizeOptions.map(({ annotation, labelKey }) => (
                                <Stack
                                    key={annotation}
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                    }}
                                >
                                    <Typography sx={{ minWidth: 'min(50%,110px)' }}>{t(labelKey)}</Typography>
                                    <div style={{ flexGrow: 1 }} />
                                    <div style={{ width: 'min(50%,110px)', flexShrink: 0 }}>
                                        <SettingsTextField
                                            type="number"
                                            size="small"
                                            value={
                                                selectedDictionary.dictionaryTokenAnnotationConfig[
                                                    tokenAnnotationTarget
                                                ][annotation].size
                                            }
                                            onChange={(e) =>
                                                updateDictionaryTokenAnnotationSize(
                                                    tokenAnnotationTarget,
                                                    annotation,
                                                    Number(e.target.value)
                                                )
                                            }
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0.1,
                                                    step: 0.1,
                                                },
                                                input: {
                                                    endAdornment: <InputAdornment position="end">em</InputAdornment>,
                                                },
                                            }}
                                        />
                                    </div>
                                </Stack>
                            ))}
                        </SettingsGroups>
                    </>
                )}
                {supportsDictionaryTokenStatusDisplayAlpha ? (
                    <Stack spacing={1}>
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            const { display, color, alpha } =
                                selectedDictionary.dictionaryTokenStatusConfig[tokenStatus];
                            const updateTokenStatusConfig = (newConfig: TokenStatusConfig) => {
                                const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];
                                newConfigs[tokenStatus] = newConfig;
                                const newTracks = [...dictionaryTracks];
                                newTracks[selectedDictionaryTrack] = {
                                    ...newTracks[selectedDictionaryTrack],
                                    dictionaryTokenStatusConfig: newConfigs,
                                    dictionaryTokenStatusColors: newConfigs.map((config) => config.color),
                                    dictionaryColorizeFullyKnownTokens: newConfigs[getFullyKnownTokenStatus()].display,
                                };
                                onSettingChanged('dictionaryTracks', newTracks);
                            };

                            // Create a dummy token for previewing the styles
                            const localizedMaturity = t(`settings.dictionaryTokenStatus${tokenStatus}`);
                            const localizedReading = t(`settings.dictionaryTokenStatusReading${tokenStatus}`);
                            const token: InternalToken = {
                                pos: [0, localizedMaturity.length],
                                status: tokenStatus,
                                states: [],
                                readings: [
                                    {
                                        pos: [0, localizedMaturity.length],
                                        reading: localizedReading,
                                    },
                                ],
                                frequency: statusFrequencies[tokenStatus],
                                pitchAccent: readingPitchAccents[localizedReading] ?? statusPitchAccents[tokenStatus],
                                __internal: true,
                            };
                            const tokens: InternalToken[] = [token];
                            let text = localizedMaturity;
                            if (tokenStatus === getFullyKnownTokenStatus()) {
                                const ignoredText = t('settings.dictionaryTokenStateIgnored');
                                const ignoredReading = t('settings.dictionaryTokenStateIgnoredReading');
                                const ignoredStart = localizedMaturity.length + 1;
                                text = `${localizedMaturity}·${ignoredText}`;
                                tokens.push({
                                    pos: [localizedMaturity.length, ignoredStart],
                                    status: tokenStatus,
                                    states: [],
                                    readings: [],
                                    __internal: true,
                                });
                                tokens.push({
                                    pos: [ignoredStart, text.length],
                                    status: tokenStatus,
                                    states: [TokenState.IGNORED],
                                    readings: [
                                        {
                                            pos: [0, ignoredText.length],
                                            reading: ignoredReading,
                                        },
                                    ],
                                    frequency: statusFrequencies[tokenStatus],
                                    pitchAccent: readingPitchAccents[ignoredReading] ?? statusPitchAccents[tokenStatus],
                                    __internal: true,
                                });
                            }

                            const dt = selectedDictionary;
                            const ta = getAnnotationsForRender(dt, tokenAnnotationTarget);

                            const richText = ta.isRichTextEnabled
                                ? computeRichText(
                                      text,
                                      { tokens },
                                      {
                                          dt,
                                          enabledAnnotations: ta.richTextEnabledAnnotations,
                                          allowAsciiReading: true,
                                      }
                                  )
                                : undefined;

                            const richTextOnHover = ta.isRichTextOnHoverEnabled
                                ? computeRichText(
                                      text,
                                      { tokens },
                                      {
                                          dt,
                                          enabledAnnotations: ta.richTextOnHoverEnabledAnnotations,
                                          allowAsciiReading: true,
                                      }
                                  )
                                : undefined;

                            const previewAnnotationConfig = dt.dictionaryTokenAnnotationConfig[tokenAnnotationTarget];

                            return (
                                <Stack
                                    key={i}
                                    direction="row"
                                    sx={{ margin: 0, padding: 0, opacity: display ? 1 : 0.5 }}
                                >
                                    <Stack
                                        sx={{
                                            width: '100%',
                                            ...tokenAnnotationStyleValues(previewAnnotationConfig),
                                            '& .asb-token-highlight:hover': {
                                                backgroundColor: 'rgb(0, 123, 255)', // Necessary so highlight works without focus
                                            },
                                        }}
                                        spacing={1}
                                    >
                                        <div
                                            style={{
                                                ...subtitleStyles,
                                                fontSize: 24,
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexShrink: 0,
                                                backgroundImage: `linear-gradient(45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(-45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.palette.action.disabledBackground} 75%), linear-gradient(-45deg, transparent 75%,${theme.palette.action.disabledBackground} 75%)`,
                                                backgroundSize: '20px 20px',
                                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                                            }}
                                        >
                                            <div
                                                style={{ padding: theme.spacing(1) }}
                                                className="asb-subtitles"
                                                dangerouslySetInnerHTML={{
                                                    __html: getAnnotationsHtml(text, richText, richTextOnHover),
                                                }}
                                            />
                                            <Switch
                                                sx={{ position: 'relative', left: 0 }}
                                                checked={display}
                                                onChange={(e) =>
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        display: e.target.checked,
                                                    })
                                                }
                                            />
                                        </div>
                                        <Stack direction="row" spacing={1} sx={{ flexGrow: 1, alignItems: 'center' }}>
                                            <TextField
                                                type="color"
                                                sx={{ width: '50%' }}
                                                value={color}
                                                color="primary"
                                                disabled={!display}
                                                onChange={(e) =>
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        color: e.target.value,
                                                    })
                                                }
                                            />
                                            <TextField
                                                type="number"
                                                label={t('settings.dictionaryTokenStatusAlpha')}
                                                sx={{ flexGrow: 1 }}
                                                value={Math.round(hex2ToPercent(alpha) * 100)}
                                                disabled={!display}
                                                onChange={(e) => {
                                                    const parsed = Number(e.target.value);
                                                    if (Number.isNaN(parsed)) return;
                                                    updateTokenStatusConfig({
                                                        ...selectedDictionary.dictionaryTokenStatusConfig[tokenStatus],
                                                        alpha: percentToHex2(Math.max(0, Math.min(100, parsed)) / 100),
                                                    });
                                                }}
                                                slotProps={{
                                                    htmlInput: { min: 0, max: 100, step: 1 },
                                                    input: {
                                                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                                    },
                                                }}
                                            />
                                        </Stack>
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Stack>
                ) : (
                    <>
                        <SwitchLabelWithHoverEffect
                            control={
                                <Switch
                                    checked={selectedDictionary.dictionaryColorizeFullyKnownTokens}
                                    onChange={(e) => {
                                        const fullyKnownStatus = getFullyKnownTokenStatus();
                                        const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];

                                        newConfigs[fullyKnownStatus] = {
                                            ...newConfigs[fullyKnownStatus],
                                            display: e.target.checked,
                                        };
                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryColorizeFullyKnownTokens: e.target.checked,
                                            dictionaryTokenStatusConfig: newConfigs,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            }
                            label={t('settings.dictionaryColorizeFullyKnownTokens')}
                            labelPlacement="start"
                        />
                        {[...Array(NUM_TOKEN_STATUSES).keys()].map((i) => {
                            const tokenStatus: TokenStatus = NUM_TOKEN_STATUSES - 1 - i;
                            if (tokenStatus === tokenStylingToHide) return null;
                            return (
                                <SettingsTextField
                                    key={i}
                                    type="color"
                                    label={t(`settings.dictionaryTokenStatus${tokenStatus}`)}
                                    fullWidth
                                    value={selectedDictionary.dictionaryTokenStatusColors[tokenStatus]}
                                    color="primary"
                                    onChange={(e) => {
                                        const newColors = [...selectedDictionary.dictionaryTokenStatusColors];
                                        newColors[tokenStatus] = e.target.value;
                                        const newConfigs = [...selectedDictionary.dictionaryTokenStatusConfig];
                                        newConfigs[tokenStatus] = {
                                            ...newConfigs[tokenStatus],
                                            color: e.target.value,
                                        };

                                        const newTracks = [...dictionaryTracks];
                                        newTracks[selectedDictionaryTrack] = {
                                            ...newTracks[selectedDictionaryTrack],
                                            dictionaryTokenStatusColors: newColors,
                                            dictionaryTokenStatusConfig: newConfigs,
                                        };
                                        onSettingChanged('dictionaryTracks', newTracks);
                                    }}
                                />
                            );
                        })}
                    </>
                )}
            </Stack>
        </>
    );
};

export default DictionarySettingsTab;
