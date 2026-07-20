import { buildPlaybackPlan, type PlaybackPlan, type PlaybackPlanBlock } from '@project/common/playback/playback-plan';
import type { PlaybackTimelineBlock } from '@project/common/playback/playback-timeline';
import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import type { AsbplayerSettings } from '@project/common/settings';

export interface PlaybackTimelineExportPlanInput<T extends SubtitleModel> {
    readonly subtitles: readonly T[];
    readonly durationMs: number;
    readonly settings: AsbplayerSettings;
    readonly playbackRate: number;
}

/** Builds all independently-toggleable playback layers for the standalone timeline document. */
export const buildPlaybackTimelineExportPlan = <T extends SubtitleModel>({
    subtitles,
    durationMs,
    settings,
    playbackRate,
}: PlaybackTimelineExportPlanInput<T>): PlaybackPlan<T> => {
    const plan = buildPlaybackPlan({
        subtitles,
        displaySubtitles: subtitles,
        durationMs,
        playModes: new Set([PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat]),
        autoPausePreference: AutoPausePreference.atStartAndEnd,
        playbackModeStartOffset: settings.playbackModeStartOffset,
        playbackModeEndOffset: settings.playbackModeEndOffset,
        playbackModesStartGap: settings.playbackModesStartGap,
        playbackModesEndGap: settings.playbackModesEndGap,
        repeatCountPreference: settings.repeatCountPreference,
        condensedPlaybackMinimumSkipIntervalMs: settings.streamingCondensedPlaybackMinimumSkipIntervalMs,
        playbackRate,
        fastForwardModePlaybackRate: settings.fastForwardModePlaybackRate,
        fastForwardPlaybackMinimumSkipIntervalMs: settings.fastForwardPlaybackMinimumSkipIntervalMs,
    });

    return {
        ...plan,
        // The export displays the condensed layer independently alongside the runtime playback actions.
        condensed: {
            minimumSkipIntervalMs: settings.streamingCondensedPlaybackMinimumSkipIntervalMs,
        },
    };
};

export interface PlaybackTimelineOptionLabels {
    readonly title: string;
    readonly subtitleTrack: (trackNumber: number) => string;
    readonly playbackModeStartOffset: string;
    readonly playbackModeEndOffset: string;
    readonly playbackModesStartGap: string;
    readonly playbackModesEndGap: string;
    readonly condensedPlaybackMinimumSkipInterval: string;
    readonly fastForwardPlaybackMinimumSkipInterval: string;
}

export interface PlaybackTimelineSettingsSummary {
    readonly title: string;
    readonly options: readonly PlaybackTimelineOption[];
    readonly settings: PlaybackTimelineSettings;
}

export const playbackTimelineSettingsSummary = (
    settings: AsbplayerSettings,
    labels: PlaybackTimelineOptionLabels
): PlaybackTimelineSettingsSummary => {
    return {
        title: labels.title,
        settings: {
            playbackModeStartOffsetMs: settings.playbackModeStartOffset,
            playbackModeEndOffsetMs: settings.playbackModeEndOffset,
            playbackModesStartGapMs: settings.playbackModesStartGap,
            playbackModesEndGapMs: settings.playbackModesEndGap,
            fastForwardMinimumSkipIntervalMs: settings.fastForwardPlaybackMinimumSkipIntervalMs,
            condensedMinimumSkipIntervalMs: settings.streamingCondensedPlaybackMinimumSkipIntervalMs,
        },
        options: [
            {
                label: labels.playbackModeStartOffset,
                value: `${settings.playbackModeStartOffset} ms`,
                settingKey: 'playbackModeStartOffsetMs',
            },
            {
                label: labels.fastForwardPlaybackMinimumSkipInterval,
                value: `${settings.fastForwardPlaybackMinimumSkipIntervalMs} ms`,
                settingKey: 'fastForwardMinimumSkipIntervalMs',
            },
            {
                label: labels.playbackModesStartGap,
                value: `${settings.playbackModesStartGap} ms`,
                settingKey: 'playbackModesStartGapMs',
            },
            {
                label: labels.playbackModeEndOffset,
                value: `${settings.playbackModeEndOffset} ms`,
                settingKey: 'playbackModeEndOffsetMs',
            },
            {
                label: labels.condensedPlaybackMinimumSkipInterval,
                value: `${settings.streamingCondensedPlaybackMinimumSkipIntervalMs} ms`,
                settingKey: 'condensedMinimumSkipIntervalMs',
            },
            {
                label: labels.playbackModesEndGap,
                value: `${settings.playbackModesEndGap} ms`,
                settingKey: 'playbackModesEndGapMs',
            },
        ],
    };
};

const playbackTimelineColors = {
    normal: 'var(--normal-color)',
    fastForward: '#34a853',
    condensed: '#ef4444',
    autoPause: '#1976d2',
    repeat: '#f2c94c',
} as const;

export type PlaybackTimelineSettingKey =
    | 'playbackModeStartOffsetMs'
    | 'playbackModeEndOffsetMs'
    | 'playbackModesStartGapMs'
    | 'playbackModesEndGapMs'
    | 'fastForwardMinimumSkipIntervalMs'
    | 'condensedMinimumSkipIntervalMs';

export interface PlaybackTimelineSettings {
    readonly playbackModeStartOffsetMs: number;
    readonly playbackModeEndOffsetMs: number;
    readonly playbackModesStartGapMs: number;
    readonly playbackModesEndGapMs: number;
    readonly fastForwardMinimumSkipIntervalMs: number;
    readonly condensedMinimumSkipIntervalMs: number;
}

export interface PlaybackTimelineTrack {
    readonly track: number;
    readonly label: string;
}

export interface PlaybackTimelineModeVisibility {
    readonly normal: boolean;
    readonly fastForward: boolean;
    readonly condensed: boolean;
    readonly autoPauseAtStart: boolean;
    readonly autoPauseAtEnd: boolean;
    readonly repeat: boolean;
}

type TimelineInterval = {
    startSeconds: number;
    endSeconds: number;
    color: string;
    className: string;
    label?: string;
    title?: string;
};

const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatTimestamp = (seconds: number): string => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
        : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatSubtitleTimestamp = (timestampMs: number, totalMs: number): string => {
    const roundedMs = Math.round(timestampMs);
    const sign = roundedMs < 0 ? '-' : '';
    const absoluteMs = Math.abs(roundedMs);
    const remainingMs = absoluteMs % 1000;
    const totalSeconds = Math.floor(absoluteMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const includeHours = totalMs >= 3_600_000 || absoluteMs >= 3_600_000;
    return includeHours
        ? `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(remainingMs).padStart(3, '0')}`
        : `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(remainingMs).padStart(3, '0')}`;
};

const interval = (
    startSeconds: number,
    endSeconds: number,
    color: string,
    className: string,
    label?: string,
    title?: string
): TimelineInterval | undefined => {
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds <= startSeconds) return;
    return { startSeconds, endSeconds, color, className, label, title };
};

const subtitleLabel = <T extends SubtitleModel>(subtitles: readonly T[]): string | undefined => {
    const text = subtitles
        .filter((subtitle) => subtitle.text.trim().length > 0)
        .map((subtitle) => `${subtitle.index ?? ''} | ${subtitle.text.trim()}`)
        .join(' / ');
    return text || undefined;
};

const subtitleTitle = <T extends SubtitleModel>(subtitles: readonly T[], totalMs: number): string | undefined => {
    const title = subtitles
        .filter((subtitle) => Number.isFinite(subtitle.start) && Number.isFinite(subtitle.end))
        .map(
            (subtitle) =>
                `${formatSubtitleTimestamp(subtitle.start, totalMs)} -> ${formatSubtitleTimestamp(subtitle.end, totalMs)}`
        )
        .join(' / ');
    return title || undefined;
};

const normalIntervals = <T extends SubtitleModel>(
    subtitles: readonly T[],
    durationSeconds: number
): TimelineInterval[] =>
    subtitles.flatMap((subtitle) => {
        const startSeconds = Math.max(0, Math.min(durationSeconds, subtitle.start / 1000));
        const endSeconds = Math.max(0, Math.min(durationSeconds, subtitle.end / 1000));
        const value = interval(
            startSeconds,
            endSeconds,
            playbackTimelineColors.normal,
            'normal',
            subtitleLabel([subtitle]),
            subtitleTitle([subtitle], durationSeconds * 1000)
        );
        return value === undefined ? [] : [value];
    });

const gapIntervals = (
    blocks: readonly PlaybackTimelineBlock[],
    durationSeconds: number,
    color: string,
    className: string,
    minimumDurationSeconds?: number
): TimelineInterval[] => {
    const intervals: TimelineInterval[] = [];
    let gapStartSeconds = 0;
    const addGap = (gapEndSeconds: number) => {
        const minimum = minimumDurationSeconds ?? 0;
        if (gapEndSeconds - gapStartSeconds + 0.001 < minimum) return;
        const value = interval(gapStartSeconds, gapEndSeconds, color, className);
        if (value !== undefined) intervals.push(value);
    };

    for (const block of blocks) {
        addGap(block.playbackModesStartGapMs / 1000);
        gapStartSeconds = block.playbackModesEndGapMs / 1000;
    }
    addGap(durationSeconds);
    return intervals;
};

const condensedIntervals = (
    blocks: readonly PlaybackTimelineBlock[],
    durationSeconds: number,
    minimumDurationSeconds: number
): TimelineInterval[] => {
    const intervals: TimelineInterval[] = [];
    for (const [index, block] of blocks.entries()) {
        const nextBlock = blocks[index + 1];
        if (nextBlock === undefined) continue;
        const startSeconds = block.playbackModeEndExclusiveMs / 1000;
        const endSeconds = nextBlock.playbackModesStartGapMs / 1000;
        if (endSeconds - startSeconds + 0.001 < minimumDurationSeconds) continue;
        const value = interval(
            Math.max(0, startSeconds),
            Math.min(durationSeconds, endSeconds),
            playbackTimelineColors.condensed,
            'condensed'
        );
        if (value !== undefined) intervals.push(value);
    }

    const firstBlock = blocks[0];
    if (firstBlock !== undefined && firstBlock.playbackModesStartGapMs / 1000 + 0.001 >= minimumDurationSeconds) {
        const value = interval(
            0,
            firstBlock.playbackModesStartGapMs / 1000,
            playbackTimelineColors.condensed,
            'condensed'
        );
        if (value !== undefined) intervals.unshift(value);
    }
    return intervals;
};

const markerIntervals = (
    blocks: readonly PlaybackPlanBlock[],
    kind: 'autoPause-start' | 'autoPause-end' | 'repeat'
): TimelineInterval[] =>
    blocks.flatMap((block) => {
        const enabled =
            kind === 'autoPause-start'
                ? block.startAction !== undefined
                : kind === 'autoPause-end'
                  ? block.endAction?.pause === true
                  : block.endAction?.repeat !== undefined;
        if (!enabled) return [];
        const timestampSeconds =
            kind === 'autoPause-start' ? block.playbackModeStartMs / 1000 : block.playbackModeEndExclusiveMs / 1000;
        return [
            {
                startSeconds: timestampSeconds,
                endSeconds: timestampSeconds + 0.001,
                color: kind.startsWith('autoPause') ? playbackTimelineColors.autoPause : playbackTimelineColors.repeat,
                className: kind,
            },
        ];
    });

const renderInterval = (value: TimelineInterval, rowStartSeconds: number): string => {
    const left = ((value.startSeconds - rowStartSeconds) / 10) * 100;
    const width = ((value.endSeconds - value.startSeconds) / 10) * 100;
    const renderedWidth = value.className === 'normal' ? width : Math.max(width, 0.15);
    return `<div class="event ${value.className}" style="left:${left}%;width:${renderedWidth}%;background:${value.color}"${
        value.title === undefined ? '' : ` title="${escapeHtml(value.title)}"`
    }>${value.className === 'normal' && value.label !== undefined ? escapeHtml(value.label) : ''}</div>`;
};

const renderModeToggle = (className: string, label: string, color: string, checked: boolean): string =>
    `<label class="mode-toggle"><input type="checkbox" data-mode="${className}"${checked ? ' checked' : ''}><span class="legend-swatch ${className}" style="background:${color}"></span>${label}</label>`;

const renderTrackSelector = (tracks: readonly PlaybackTimelineTrack[]): string =>
    `<select class="track-selector" data-track-select>${tracks
        .map(({ track, label }) => `<option value="${track}">${escapeHtml(label)}</option>`)
        .join('')}</select>`;

const renderTicks = (rowStartSeconds: number, rowEndSeconds: number): string =>
    Array.from({ length: 10 }, (_, index) => index + 1)
        .filter((second) => rowStartSeconds + second <= rowEndSeconds)
        .map((second) => `<div class="tick" style="left:${(second / 10) * 100}%"></div>`)
        .join('');

const renderTimelineOption = ({ label, value, settingKey }: PlaybackTimelineOption): string => {
    const renderedValue =
        settingKey === undefined
            ? `<span class="settings-value">${escapeHtml(value)}</span>`
            : `<input id="setting-${settingKey}" type="number" data-setting="${settingKey}" aria-label="${escapeHtml(label)}" value="${escapeHtml(value.replace(/\s*ms$/, ''))}" step="1"><span class="settings-unit">ms</span>`;
    return `<div class="settings-row"><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
};

export interface PlaybackTimelineOption {
    readonly label: string;
    readonly value: string;
    readonly settingKey?: PlaybackTimelineSettingKey;
}

export interface PlaybackTimelineHtmlOptions<T extends SubtitleModel = SubtitleModel> {
    readonly plan: PlaybackPlan<T>;
    readonly themeColor: string;
    readonly title?: string;
    readonly modeLabels: PlaybackTimelineModeLabels;
    readonly timelineOptionsTitle: string;
    readonly timelineOptions: readonly PlaybackTimelineOption[];
    readonly timelineSettings: PlaybackTimelineSettings;
    readonly timelineTracks: readonly PlaybackTimelineTrack[];
    readonly initialModeVisibility: PlaybackTimelineModeVisibility;
    readonly timelineSubtitles: readonly T[];
}

export interface PlaybackTimelineModeLabels {
    readonly normal: string;
    readonly fastForward: string;
    readonly condensed: string;
    readonly autoPauseAtStart: string;
    readonly autoPauseAtEnd: string;
    readonly repeat: string;
}

export const playbackTimelineToHtml = <T extends SubtitleModel>({
    plan,
    themeColor,
    title = 'Subtitle playback timeline',
    modeLabels,
    timelineOptionsTitle,
    timelineOptions,
    timelineSettings,
    timelineTracks,
    initialModeVisibility,
    timelineSubtitles,
}: PlaybackTimelineHtmlOptions<T>): string => {
    const durationSeconds = Math.max(0, plan.timeline.durationMs / 1000);
    const rows = Math.max(1, Math.ceil(durationSeconds / 10));
    const normal = normalIntervals(plan.timeline.displaySubtitles, durationSeconds);
    const fastForward =
        plan.fastForward === undefined
            ? []
            : gapIntervals(
                  plan.timeline.blocks,
                  durationSeconds,
                  playbackTimelineColors.fastForward,
                  'fast-forward',
                  plan.fastForward.minimumSkipIntervalMs / 1000
              );
    const condensed =
        plan.condensed === undefined
            ? []
            : condensedIntervals(plan.timeline.blocks, durationSeconds, plan.condensed.minimumSkipIntervalMs / 1000);
    const autoPause = [
        ...markerIntervals(plan.timeline.blocks, 'autoPause-start'),
        ...markerIntervals(plan.timeline.blocks, 'autoPause-end'),
    ];
    const repeat = markerIntervals(plan.timeline.blocks, 'repeat');
    const repeatTimestamps = new Set(repeat.map((value) => value.startSeconds));
    for (const value of autoPause) {
        if (repeatTimestamps.has(value.startSeconds)) value.className += ' autoPause-overlap';
    }
    for (const value of repeat) {
        if (autoPause.some((autoPauseValue) => autoPauseValue.startSeconds === value.startSeconds)) {
            value.className += ' repeat-overlap';
        }
    }
    const intervals = [...normal, ...fastForward, ...condensed, ...autoPause, ...repeat];

    const renderedRows = Array.from({ length: rows }, (_, index) => {
        const rowStartSeconds = index * 10;
        const rowEndSeconds = Math.min(durationSeconds, rowStartSeconds + 10);
        const rowIntervals = intervals.filter(
            (value) => value.startSeconds < rowEndSeconds && value.endSeconds > rowStartSeconds
        );
        const renderedIntervals = rowIntervals
            .map((value) => ({
                ...value,
                startSeconds: Math.max(value.startSeconds, rowStartSeconds),
                endSeconds: Math.min(value.endSeconds, rowEndSeconds),
            }))
            .map((value) => renderInterval(value, rowStartSeconds))
            .join('');
        return `<section class="row"><div class="label">${formatTimestamp(rowStartSeconds)}</div><div class="track">${renderedIntervals}${renderTicks(rowStartSeconds, rowEndSeconds)}</div><div class="label end">${formatTimestamp(rowEndSeconds)}</div></section>`;
    }).join('');

    const escapedTitle = escapeHtml(title);
    const readonlyOptions = timelineOptions.filter(({ settingKey }) => settingKey === undefined);
    const configurableOptions = timelineOptions.filter(({ settingKey }) => settingKey !== undefined);
    const renderedTimelineOptions = [
        ...readonlyOptions.map(renderTimelineOption),
        configurableOptions.length > 0
            ? `<div class="settings-options-grid">${configurableOptions.map(renderTimelineOption).join('')}</div>`
            : '',
    ].join('');
    const timelineData = JSON.stringify({
        durationSeconds,
        subtitles: timelineSubtitles.map(({ text, start, end, track, index }) => ({
            text,
            start,
            end,
            track,
            index,
        })),
        settings: timelineSettings,
    })
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    const initialHiddenModes = Object.entries({
        'fast-forward': initialModeVisibility.fastForward,
        condensed: initialModeVisibility.condensed,
        'autoPause-start': initialModeVisibility.autoPauseAtStart,
        'autoPause-end': initialModeVisibility.autoPauseAtEnd,
        repeat: initialModeVisibility.repeat,
    })
        .filter(([, enabled]) => !enabled)
        .map(([mode]) => `hide-${mode}`)
        .join(' ');
    const initialNormalModeVisibility =
        initialModeVisibility.normal ||
        !(
            initialModeVisibility.fastForward ||
            initialModeVisibility.condensed ||
            initialModeVisibility.autoPauseAtStart ||
            initialModeVisibility.autoPauseAtEnd ||
            initialModeVisibility.repeat
        );
    const renderedTrackSelector = renderTrackSelector(timelineTracks);
    const timelineScript = String.raw`
const timelineData = ${timelineData};
const timelineColors = ${JSON.stringify(playbackTimelineColors)};
const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const formatTimestamp = (seconds) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    return hours > 0
        ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0')
        : minutes + ':' + String(remainingSeconds).padStart(2, '0');
};
const formatSubtitleTimestamp = (timestampMs, totalMs) => {
    const roundedMs = Math.round(timestampMs);
    const sign = roundedMs < 0 ? '-' : '';
    const absoluteMs = Math.abs(roundedMs);
    const remainingMs = absoluteMs % 1000;
    const totalSeconds = Math.floor(absoluteMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const includeHours = totalMs >= 3600000 || absoluteMs >= 3600000;
    return includeHours
        ? sign + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + ':' + String(remainingMs).padStart(3, '0')
        : sign + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + ':' + String(remainingMs).padStart(3, '0');
};
const finiteOrZero = (value) => Number.isFinite(value) ? value : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const interval = (startSeconds, endSeconds, color, className, label, title) =>
    Number.isFinite(startSeconds) && Number.isFinite(endSeconds) && endSeconds > startSeconds
        ? { startSeconds, endSeconds, color, className, label, title }
        : undefined;
const compileBlocks = (settings, subtitles) => {
    const durationSeconds = timelineData.durationSeconds;
    const sortedSubtitles = subtitles
        .filter((subtitle) => Number.isFinite(subtitle.start) && Number.isFinite(subtitle.end) && subtitle.end > subtitle.start)
        .slice()
        .sort((left, right) => left.start - right.start || left.end - right.end || left.track - right.track);
    const mutableBlocks = [];
    for (const subtitle of sortedSubtitles) {
        const startSeconds = clamp(subtitle.start / 1000, 0, durationSeconds);
        const endSeconds = clamp(subtitle.end / 1000, 0, durationSeconds);
        if (endSeconds <= startSeconds) continue;
        const previous = mutableBlocks[mutableBlocks.length - 1];
        if (previous !== undefined && startSeconds < previous.endSeconds) {
            previous.endSeconds = Math.max(previous.endSeconds, endSeconds);
            continue;
        }
        mutableBlocks.push({ startSeconds, endSeconds });
    }
    const startOffset = finiteOrZero(settings.playbackModeStartOffsetMs);
    const endOffset = finiteOrZero(settings.playbackModeEndOffsetMs);
    const startGapOffset = Math.min(0, finiteOrZero(settings.playbackModesStartGapMs));
    const endGap = Math.max(0, finiteOrZero(settings.playbackModesEndGapMs));
    return mutableBlocks.map((block, index) => {
        const previousEndSeconds = mutableBlocks[index - 1]?.endSeconds ?? 0;
        const nextStartSeconds = mutableBlocks[index + 1]?.startSeconds ?? durationSeconds;
        const latestLegalTriggerSeconds = Math.max(previousEndSeconds, (nextStartSeconds * 1000 - 1) / 1000);
        const shiftedStartSeconds = clamp((block.startSeconds * 1000 + startOffset) / 1000, previousEndSeconds, latestLegalTriggerSeconds);
        const shiftedEndSeconds = clamp((block.endSeconds * 1000 - 1 + endOffset) / 1000, previousEndSeconds, latestLegalTriggerSeconds);
        const playbackModeStartSeconds = Math.min(shiftedStartSeconds, shiftedEndSeconds);
        const playbackModeEndSeconds = Math.max(shiftedStartSeconds, shiftedEndSeconds);
        return {
            ...block,
            playbackModeStartSeconds,
            playbackModeEndSeconds,
            playbackModeEndExclusiveSeconds: Math.min(durationSeconds, (playbackModeEndSeconds * 1000 + 1) / 1000),
            playbackModesStartGapSeconds: clamp((block.startSeconds * 1000 - 1 + startGapOffset) / 1000, previousEndSeconds, block.startSeconds),
            playbackModesEndGapSeconds: clamp((block.endSeconds * 1000 + endGap) / 1000, block.endSeconds, nextStartSeconds)
        };
    });
};
const subtitleLabel = (subtitles) => {
    const text = subtitles
        .filter((subtitle) => String(subtitle.text).trim().length > 0)
        .map((subtitle) => (subtitle.index == null ? '' : subtitle.index) + ' | ' + String(subtitle.text).trim())
        .join(' / ');
    return text || undefined;
};
const subtitleTitle = (subtitles) => {
    const title = subtitles
        .filter((subtitle) => Number.isFinite(subtitle.start) && Number.isFinite(subtitle.end))
        .map((subtitle) => formatSubtitleTimestamp(subtitle.start, timelineData.durationSeconds * 1000) + ' -> ' + formatSubtitleTimestamp(subtitle.end, timelineData.durationSeconds * 1000))
        .join(' / ');
    return title || undefined;
};
const compileNormalIntervals = (subtitles) => {
    const durationSeconds = timelineData.durationSeconds;
    return subtitles.flatMap((subtitle) => {
        const startSeconds = clamp(subtitle.start / 1000, 0, durationSeconds);
        const endSeconds = clamp(subtitle.end / 1000, 0, durationSeconds);
        const value = interval(
            startSeconds,
            endSeconds,
            timelineColors.normal,
            'normal',
            subtitleLabel([subtitle]),
            subtitleTitle([subtitle])
        );
        return value === undefined ? [] : [value];
    });
};
const gapIntervals = (blocks, durationSeconds, color, className, minimumDurationSeconds) => {
    const intervals = [];
    let gapStartSeconds = 0;
    const addGap = (gapEndSeconds) => {
        if (gapEndSeconds - gapStartSeconds + 0.001 < minimumDurationSeconds) return;
        const value = interval(gapStartSeconds, gapEndSeconds, color, className);
        if (value !== undefined) intervals.push(value);
    };
    for (const block of blocks) {
        addGap(block.playbackModesStartGapSeconds);
        gapStartSeconds = block.playbackModesEndGapSeconds;
    }
    addGap(durationSeconds);
    return intervals;
};
const condensedIntervals = (blocks, durationSeconds, minimumDurationSeconds) => {
    const intervals = [];
    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        const nextBlock = blocks[index + 1];
        if (nextBlock === undefined) continue;
        const startSeconds = block.playbackModeEndExclusiveSeconds;
        const endSeconds = nextBlock.playbackModesStartGapSeconds;
        if (endSeconds - startSeconds + 0.001 < minimumDurationSeconds) continue;
        const value = interval(Math.max(0, startSeconds), Math.min(durationSeconds, endSeconds), timelineColors.condensed, 'condensed');
        if (value !== undefined) intervals.push(value);
    }
    const firstBlock = blocks[0];
    if (firstBlock !== undefined && firstBlock.playbackModesStartGapSeconds + 0.001 >= minimumDurationSeconds) {
        const value = interval(0, firstBlock.playbackModesStartGapSeconds, timelineColors.condensed, 'condensed');
        if (value !== undefined) intervals.unshift(value);
    }
    return intervals;
};
const markerIntervals = (blocks, kind) => blocks.flatMap((block) => {
    const timestampSeconds = kind === 'autoPause-start'
        ? block.playbackModeStartSeconds
        : block.playbackModeEndExclusiveSeconds;
    return [{
        startSeconds: timestampSeconds,
        endSeconds: timestampSeconds + 0.001,
        color: kind.startsWith('autoPause') ? timelineColors.autoPause : timelineColors.repeat,
        className: kind
    }];
});
const renderInterval = (value, rowStartSeconds) => {
    const left = ((value.startSeconds - rowStartSeconds) / 10) * 100;
    const width = ((value.endSeconds - value.startSeconds) / 10) * 100;
    const renderedWidth = value.className === 'normal' ? width : Math.max(width, 0.15);
    const label = value.title === undefined ? '' : ' title="' + escapeHtml(value.title) + '"';
    const text = value.className === 'normal' && value.label !== undefined ? escapeHtml(value.label) : '';
    return '<div class="event ' + value.className + '" style="left:' + left + '%;width:' + renderedWidth + '%;background:' + value.color + '"' + label + '>' + text + '</div>';
};
const renderTicks = (rowStartSeconds, rowEndSeconds) => Array.from({ length: 10 }, (_, index) => index + 1)
    .filter((second) => rowStartSeconds + second <= rowEndSeconds)
    .map((second) => '<div class="tick" style="left:' + (second / 10) * 100 + '%"></div>')
    .join('');
const renderTimeline = (settings, selectedTracks) => {
    const durationSeconds = Math.max(0, timelineData.durationSeconds);
    const subtitles = timelineData.subtitles.filter((subtitle) => selectedTracks.has(subtitle.track));
    const blocks = compileBlocks(settings, subtitles);
    const normal = compileNormalIntervals(subtitles);
    const fastForward = gapIntervals(blocks, durationSeconds, timelineColors.fastForward, 'fast-forward', finiteOrZero(settings.fastForwardMinimumSkipIntervalMs) / 1000);
    const condensed = condensedIntervals(blocks, durationSeconds, finiteOrZero(settings.condensedMinimumSkipIntervalMs) / 1000);
    const autoPause = [...markerIntervals(blocks, 'autoPause-start'), ...markerIntervals(blocks, 'autoPause-end')];
    const repeat = markerIntervals(blocks, 'repeat');
    const repeatTimestamps = new Set(repeat.map((value) => value.startSeconds));
    for (const value of autoPause) {
        if (repeatTimestamps.has(value.startSeconds)) value.className += ' autoPause-overlap';
    }
    for (const value of repeat) {
        if (autoPause.some((autoPauseValue) => autoPauseValue.startSeconds === value.startSeconds)) value.className += ' repeat-overlap';
    }
    const intervals = [...normal, ...fastForward, ...condensed, ...autoPause, ...repeat];
    const rows = Math.max(1, Math.ceil(durationSeconds / 10));
    return Array.from({ length: rows }, (_, index) => {
        const rowStartSeconds = index * 10;
        const rowEndSeconds = Math.min(durationSeconds, rowStartSeconds + 10);
        const renderedIntervals = intervals
            .filter((value) => value.startSeconds < rowEndSeconds && value.endSeconds > rowStartSeconds)
            .map((value) => ({ ...value, startSeconds: Math.max(value.startSeconds, rowStartSeconds), endSeconds: Math.min(value.endSeconds, rowEndSeconds) }))
            .map((value) => renderInterval(value, rowStartSeconds))
            .join('');
        return '<section class="row"><div class="label">' + formatTimestamp(rowStartSeconds) + '</div><div class="track">' + renderedIntervals + renderTicks(rowStartSeconds, rowEndSeconds) + '</div><div class="label end">' + formatTimestamp(rowEndSeconds) + '</div></section>';
    }).join('');
};
const readTimelineSettings = () => {
    const settings = { ...timelineData.settings };
    document.querySelectorAll('input[data-setting]').forEach((input) => {
        const key = input.getAttribute('data-setting');
        if (key !== null) settings[key] = Number.isFinite(Number(input.value)) ? Number(input.value) : 0;
    });
    return settings;
};
const readSelectedTracks = () => new Set([Number(document.querySelector('select[data-track-select]')?.value)]);
const rebuildTimeline = () => {
    document.querySelector('.timeline').innerHTML = renderTimeline(readTimelineSettings(), readSelectedTracks());
};
document.querySelectorAll('input[data-setting]').forEach((input) => input.addEventListener('input', rebuildTimeline));
document.querySelectorAll('select[data-track-select]').forEach((select) => select.addEventListener('change', rebuildTimeline));
document.querySelectorAll('input[data-mode]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        const mode = checkbox.getAttribute('data-mode');
        if (mode === null) return;

        if (checkbox.checked && mode === 'normal') {
            document.querySelectorAll('input[data-mode]').forEach((otherCheckbox) => {
                const otherMode = otherCheckbox.getAttribute('data-mode');
                if (otherCheckbox === checkbox || otherMode === null) return;
                otherCheckbox.checked = false;
                document.body.classList.add('hide-' + otherMode);
            });
            return;
        }

        if (mode === 'normal') {
            const hasSelectedNonNormalMode = [...document.querySelectorAll('input[data-mode]')].some(
                (otherCheckbox) => otherCheckbox !== checkbox && otherCheckbox.checked
            );
            if (!checkbox.checked && !hasSelectedNonNormalMode) checkbox.checked = true;
            return;
        }

        if (checkbox.checked && mode !== 'normal') {
            const normalCheckbox = document.querySelector('input[data-mode="normal"]');
            if (normalCheckbox) normalCheckbox.checked = false;
        }

        if (mode === 'fast-forward' || mode === 'condensed') {
            const otherMode = mode === 'fast-forward' ? 'condensed' : 'fast-forward';
            const otherCheckbox = document.querySelector('input[data-mode="' + otherMode + '"]');
            if (checkbox.checked && otherCheckbox) {
                otherCheckbox.checked = false;
                document.body.classList.add('hide-' + otherMode);
            }
        }
        document.body.classList.toggle('hide-' + mode, !checkbox.checked);
        if (!checkbox.checked) {
            const normalCheckbox = document.querySelector('input[data-mode="normal"]');
            const hasSelectedNonNormalMode = [...document.querySelectorAll('input[data-mode]')].some(
                (otherCheckbox) => otherCheckbox !== normalCheckbox && otherCheckbox.checked
            );
            if (normalCheckbox && !hasSelectedNonNormalMode) normalCheckbox.checked = true;
        }
    });
});
rebuildTimeline();
`;
    return `<!doctype html>
<html lang="und" translate="no" class="notranslate">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google" content="notranslate">
<title>${escapedTitle}</title>
<style>
:root { color-scheme: dark; --normal-color: ${escapeHtml(themeColor)}; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; color: #e6edf3; background: #0f1115; font-family: system-ui, sans-serif; }
h1 { margin: 0 0 16px; font-size: 1.35rem; }
.settings-summary { margin-bottom: 16px; padding: 12px; border: 1px solid #30363d; border-radius: 6px; background: #161b22; }
.settings-heading { display: flex; align-items: center; justify-content: flex-start; gap: 12px; margin-bottom: 8px; }
.settings-summary h2 { margin: 0; font-size: 1rem; }
.settings-summary dl { display: grid; gap: 6px; margin: 0; }
.settings-options-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px 12px; }
.settings-row { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr); gap: 12px; font-size: .9rem; }
.settings-row dt { color: #8b949e; }
.settings-row dd { margin: 0; overflow-wrap: anywhere; }
.settings-row input { width: 120px; padding: 3px 5px; color: #e6edf3; background: #0f1115; border: 1px solid #484f58; border-radius: 4px; }
.settings-unit { margin-left: 6px; color: #8b949e; }
.track-selector { min-width: 120px; padding: 3px 6px; color: #e6edf3; background: #0f1115; border: 1px solid #484f58; border-radius: 4px; font-size: .9rem; }
.mode-controls { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 12px; font-size: .9rem; }
.mode-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.mode-toggle input { margin: 0; accent-color: var(--normal-color); }
.legend-swatch { display: inline-block; width: 18px; height: 12px; border-radius: 3px; }
.legend-swatch.autoPause-start, .legend-swatch.autoPause-end, .legend-swatch.repeat { width: 4px; border-radius: 0; }
.timeline { width: 100%; }
.row { display: grid; grid-template-columns: 52px minmax(0, 1fr) 52px; align-items: center; min-height: 64px; border-top: 1px solid #30363d; }
.label { color: #8b949e; font: 12px ui-monospace, monospace; }
.label.end { text-align: right; }
.track { position: relative; height: 42px; overflow: hidden; background: #21262d; border-radius: 4px; }
.event { position: absolute; overflow: hidden; height: 24px; top: 9px; padding: 4px 6px; color: #fff; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; line-height: 16px; opacity: .92; }
.event.normal { z-index: 1; }
.event.fast-forward, .event.condensed { top: 0; height: 42px; opacity: .45; }
.event.condensed { z-index: 3; }
.event.fast-forward { z-index: 2; }
.event.autoPause-start, .event.autoPause-end, .event.repeat { top: 0; height: 42px; min-width: 3px; z-index: 5; padding: 0; opacity: 1; }
.event.repeat { z-index: 6; }
.event.autoPause-start.autoPause-overlap, .event.autoPause-end.autoPause-overlap { top: 0; height: 21px; }
.event.repeat-overlap { top: 21px; height: 21px; }
.tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(139, 148, 158, .35); z-index: 7; }
.hide-fast-forward .event.fast-forward, .hide-condensed .event.condensed, .hide-autoPause-start .event.autoPause-start, .hide-autoPause-end .event.autoPause-end, .hide-repeat .event.repeat { display: none; }
@media (max-width: 560px) { body { padding: 12px; } .row { grid-template-columns: 42px minmax(0, 1fr) 42px; } }
@media (max-width: 700px) { .settings-options-grid { grid-template-columns: 1fr; } .settings-heading { align-items: flex-start; flex-direction: column; } }
@media print { body { padding: 0; } .row { break-inside: avoid; } }
</style>
</head>
<body class="${initialHiddenModes}">
<h1>${escapedTitle}</h1>
<section class="settings-summary"><div class="settings-heading"><h2>${escapeHtml(timelineOptionsTitle)}</h2>${renderedTrackSelector}</div><dl>${renderedTimelineOptions}</dl><div class="mode-controls" aria-label="Timeline layers">${renderModeToggle('normal', escapeHtml(modeLabels.normal), playbackTimelineColors.normal, initialNormalModeVisibility)}${renderModeToggle('fast-forward', escapeHtml(modeLabels.fastForward), playbackTimelineColors.fastForward, initialModeVisibility.fastForward)}${renderModeToggle('condensed', escapeHtml(modeLabels.condensed), playbackTimelineColors.condensed, initialModeVisibility.condensed)}${renderModeToggle('autoPause-start', escapeHtml(modeLabels.autoPauseAtStart), playbackTimelineColors.autoPause, initialModeVisibility.autoPauseAtStart)}${renderModeToggle('autoPause-end', escapeHtml(modeLabels.autoPauseAtEnd), playbackTimelineColors.autoPause, initialModeVisibility.autoPauseAtEnd)}${renderModeToggle('repeat', escapeHtml(modeLabels.repeat), playbackTimelineColors.repeat, initialModeVisibility.repeat)}</div></section>
<main class="timeline">${renderedRows}</main>
<script>${timelineScript}</script>
</body>
</html>`;
};
