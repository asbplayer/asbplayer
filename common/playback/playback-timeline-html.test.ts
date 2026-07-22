import { describe, expect, it } from '@jest/globals';
import { AutoPausePreference, PlayMode, type SubtitleModel } from '@project/common';
import { defaultSettings } from '@project/common/settings';
import { makeTextSubtitle } from '@project/common/playback/playback-engine-test-utils';
import { buildPlaybackPlan } from '@project/common/playback/playback-plan';
import {
    buildPlaybackTimelineExportPlan,
    playbackTimelineToHtml,
} from '@project/common/playback/playback-timeline-html';

const modeLabels = {
    normal: 'Normal',
    fastForward: 'Fast forward',
    condensed: 'Condensed',
    autoPauseAtStart: 'At Subtitle Start',
    autoPauseAtEnd: 'At Subtitle End',
    repeat: 'Repeat',
};

const timelineOptions = [
    { label: 'Playback mode start offset', value: '0 ms', settingKey: 'playbackModeStartOffsetMs' as const },
    {
        label: 'Fast-forward minimum interval',
        value: '500 ms',
        settingKey: 'fastForwardMinimumSkipIntervalMs' as const,
    },
    { label: 'Playback modes start gap', value: '0 ms', settingKey: 'playbackModesStartGapMs' as const },
    { label: 'Playback mode end offset', value: '0 ms', settingKey: 'playbackModeEndOffsetMs' as const },
    { label: 'Condensed minimum interval', value: '500 ms', settingKey: 'condensedMinimumSkipIntervalMs' as const },
    { label: 'Playback modes end gap', value: '0 ms', settingKey: 'playbackModesEndGapMs' as const },
];

const htmlOptions = {
    timelineOptionsTitle: 'Playback modes',
    timelineOptions,
    timelineSettings: {
        playbackModeStartOffsetMs: 0,
        playbackModeEndOffsetMs: 0,
        playbackModesStartGapMs: 0,
        playbackModesEndGapMs: 0,
        fastForwardMinimumSkipIntervalMs: 500,
        condensedMinimumSkipIntervalMs: 500,
    },
    timelineTracks: [{ track: 0, label: 'Track 1' }],
    initialModeVisibility: {
        normal: true,
        fastForward: false,
        condensed: false,
        autoPauseAtStart: true,
        autoPauseAtEnd: true,
        repeat: true,
    },
    timelineSubtitles: [makeTextSubtitle(1000, 2000, 'one', 0)],
};

const plan = (subtitles: SubtitleModel[], playModes: PlayMode[] = [PlayMode.normal], durationMs = 20_000) =>
    buildPlaybackPlan({
        subtitles,
        durationMs,
        playModes: new Set(playModes),
        autoPausePreference: AutoPausePreference.atStartAndEnd,
        playbackModeStartOffset: 0,
        playbackModeEndOffset: 0,
        playbackModesStartGap: 0,
        playbackModesEndGap: 0,
        repeatCountPreference: 1,
        condensedPlaybackMinimumSkipIntervalMs: 500,
        playbackRate: 1,
        fastForwardModePlaybackRate: 2,
        fastForwardPlaybackMinimumSkipIntervalMs: 500,
    });

describe('playbackTimelineToHtml', () => {
    it('builds every independently-toggleable layer from AsbplayerSettings', () => {
        const exportPlan = buildPlaybackTimelineExportPlan({
            subtitles: [makeTextSubtitle(1000, 2000, 'one', 0)],
            durationMs: 5000,
            settings: {
                ...defaultSettings,
                autoPausePreference: AutoPausePreference.atEnd,
                repeatCountPreference: 2,
            },
            playbackRate: 1.25,
        });

        expect(exportPlan.fastForward).toBeDefined();
        expect(exportPlan.condensed).toBeDefined();
        expect(exportPlan.condensed?.pauseAtStart).toBe(true);
        expect(exportPlan.timeline.blocks[0].startAction).toBe(true);
        expect(exportPlan.timeline.blocks[0].endAction).toEqual({ pause: true, repeat: { count: 2 } });
    });

    it('renders full-width ten-second rows and escapes subtitle text', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(1000, 2000, '<unsafe>', 0)]),
            themeColor: '#123456',
            title: 'Example & timeline',
            modeLabels: {
                normal: 'Normal label',
                fastForward: 'Fast forward label',
                condensed: 'Condensed label',
                autoPauseAtStart: 'At subtitle start label',
                autoPauseAtEnd: 'At subtitle end label',
                repeat: 'Repeat label',
            },
            ...htmlOptions,
        });

        const parsed = new DOMParser().parseFromString(html, 'text/html');
        expect(html).toContain('<title>Example &amp; timeline</title>');
        expect(html).toContain('&lt;unsafe&gt;');
        expect(parsed.querySelector('.event.normal')?.textContent).toBe('0 | <unsafe>');
        expect(parsed.querySelectorAll('.row')).toHaveLength(2);
        expect([...parsed.querySelectorAll('.label.end')].map((label) => label.textContent)).toEqual(['0:10', '0:20']);
        expect(html).toContain('--normal-color: #123456');
        expect(html).toContain('color-scheme: dark');
        expect(parsed.querySelector('.mode-controls')).not.toBeNull();
        expect(parsed.body.classList.contains('hide-fast-forward')).toBe(true);
        expect(parsed.body.classList.contains('hide-condensed')).toBe(true);
        expect(parsed.querySelector('input[data-mode="normal"]')).not.toBeNull();
        expect(parsed.querySelector('input[data-mode="condensed"]')).not.toBeNull();
        expect(parsed.querySelector('input[data-mode="fast-forward"]')).not.toBeNull();
        expect([...parsed.querySelectorAll('label')].map((label) => label.textContent)).toContain('Fast forward label');
        expect(parsed.querySelector('h2')?.textContent).toBe('Playback modes');
        expect(html).not.toContain('seekable');
        expect(parsed.querySelector('select[data-track-select] option')?.textContent).toBe('Track 1');
        expect(html).not.toContain('Subtitle Track');
        expect(html).not.toContain('>All<');
        expect(parsed.querySelector('.settings-summary')).not.toBeNull();
        expect(parsed.querySelector('.settings-options-grid')).not.toBeNull();
        expect(html).toContain('title="00:01:000 -&gt; 00:02:000"');
        expect(html.indexOf('Playback mode start offset')).toBeLessThan(html.indexOf('Fast-forward minimum interval'));
        expect(html.indexOf('Fast-forward minimum interval')).toBeLessThan(html.indexOf('Playback modes start gap'));
        expect(html.indexOf('Playback modes start gap')).toBeLessThan(html.indexOf('Playback mode end offset'));
        expect(html.indexOf('Playback mode end offset')).toBeLessThan(html.indexOf('Condensed minimum interval'));
        expect(html.indexOf('Condensed minimum interval')).toBeLessThan(html.indexOf('Playback modes end gap'));
        expect(html).toContain('<div class="tick" style="left:10%"></div>');
        expect(html).toContain('<div class="tick" style="left:90%"></div>');
        expect(html).toContain('<div class="tick" style="left:50%"></div>');
        expect(html).toContain('data-setting="playbackModeStartOffsetMs"');
        expect(parsed.querySelector('input[data-mode="normal"]')?.parentElement?.textContent).toContain('Normal');
    });

    it('formats subtitle hover timestamps with millisecond precision', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(101_580, 104_050, 'one', 0)], [PlayMode.normal], 120_000),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });

        expect(html).toContain('title="01:41:580 -&gt; 01:44:050"');
    });

    it('renders playback modes using their distinct visual markers', () => {
        const html = playbackTimelineToHtml({
            plan: plan(
                [makeTextSubtitle(1000, 2000, 'one', 0), makeTextSubtitle(5000, 6000, 'two', 1)],
                [PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat]
            ),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });

        expect(html).toContain('class="event fast-forward"');
        expect(html).toContain('class="event autoPause-start"');
        expect(html).toContain('class="event autoPause-end autoPause-overlap"');
        expect(html).toContain('class="event repeat repeat-overlap"');
        expect(html).toContain('class="event autoPause-end autoPause-overlap" style="left:20%;');
        expect(html).toContain('class="event repeat repeat-overlap" style="left:20%;');
        expect(html).toContain('background:#34a853');
        expect(html).toContain('background:#1976d2');
        expect(html).toContain('background:#f2c94c');
    });

    it('renders coincident auto-pause and repeat markers as stacked bands', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(1000, 2000, 'one', 0)], [PlayMode.autoPause, PlayMode.repeat]),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });

        expect(html).toContain('class="event autoPause-end autoPause-overlap"');
        expect(html).toContain('class="event repeat repeat-overlap"');
        expect(html).toContain(
            '.event.autoPause-start.autoPause-overlap, .event.autoPause-end.autoPause-overlap { top: 0; height: 21px; }'
        );
        expect(html).toContain('.event.repeat-overlap { top: 21px; height: 21px; }');

        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const normalEvents = [...parsed.querySelectorAll<HTMLElement>('.event.normal')];
        const normalEnd = Math.max(
            ...normalEvents.map((event) => {
                const style = event.getAttribute('style') ?? '';
                const left = Number(style.match(/left:([^%]+)%/)?.[1]);
                const width = Number(style.match(/width:([^%]+)%/)?.[1]);
                return left + width;
            })
        );
        const pauseEndStyle = parsed.querySelector('.event.autoPause-end')?.getAttribute('style') ?? '';
        const pauseEndLeft = Number(pauseEndStyle.match(/left:([^%]+)%/)?.[1]);
        expect(normalEnd).toBeCloseTo(pauseEndLeft, 5);
    });

    it('renders condensed gaps and an empty timeline without throwing', () => {
        const condensedHtml = playbackTimelineToHtml({
            plan: plan(
                [makeTextSubtitle(1000, 2000, 'one', 0), makeTextSubtitle(5000, 6000, 'two', 1)],
                [PlayMode.condensed]
            ),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });
        const emptyHtml = playbackTimelineToHtml({ plan: plan([]), themeColor: '#123456', modeLabels, ...htmlOptions });

        expect(condensedHtml).toContain('class="event condensed"');
        expect(condensedHtml).toContain('background:#ef4444');
        expect(emptyHtml).toContain('class="row"');
    });

    it('rebuilds mode boundaries when an editable setting changes', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(1000, 2000, 'one', 0)]),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;
        expect(scriptText).toBeTruthy();

        window.eval(scriptText ?? '');
        const input = document.querySelector<HTMLInputElement>('input[data-setting="playbackModeStartOffsetMs"]');
        expect(input).not.toBeNull();
        input!.value = '500';
        input!.dispatchEvent(new Event('input', { bubbles: true }));

        expect(document.querySelector('.event.autoPause-start')?.getAttribute('style')).toContain('left:15%');
    });

    it('keeps normal subtitles visible while making normal and other modes mutually exclusive', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(1000, 2000, 'one', 0)]),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;

        window.eval(scriptText ?? '');
        const normalCheckbox = document.querySelector<HTMLInputElement>('input[data-mode="normal"]');
        const fastForwardCheckbox = document.querySelector<HTMLInputElement>('input[data-mode="fast-forward"]');
        expect(normalCheckbox?.checked).toBe(true);
        expect(fastForwardCheckbox?.checked).toBe(false);

        fastForwardCheckbox!.checked = true;
        fastForwardCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(normalCheckbox?.checked).toBe(false);
        expect(document.body.classList).not.toContain('hide-normal');
        expect(document.querySelector('.event.normal')).not.toBeNull();

        normalCheckbox!.checked = true;
        normalCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(fastForwardCheckbox?.checked).toBe(false);
        expect(document.body.classList).toContain('hide-fast-forward');

        normalCheckbox!.checked = false;
        normalCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(normalCheckbox?.checked).toBe(true);
        expect(document.body.classList).not.toContain('hide-normal');
        expect(document.querySelector('.event.normal')).not.toBeNull();
    });

    it('checks normal when no mode is initially selected', () => {
        const html = playbackTimelineToHtml({
            plan: plan([makeTextSubtitle(1000, 2000, 'one', 0)]),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
            initialModeVisibility: {
                normal: false,
                fastForward: false,
                condensed: false,
                autoPauseAtStart: false,
                autoPauseAtEnd: false,
                repeat: false,
            },
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;

        window.eval(scriptText ?? '');

        expect(document.querySelector<HTMLInputElement>('input[data-mode="normal"]')?.checked).toBe(true);
    });

    it('matches the server-rendered timeline after the embedded compiler redraws it', () => {
        const paritySettings = {
            playbackModeStartOffsetMs: 250,
            playbackModeEndOffsetMs: -150,
            playbackModesStartGapMs: -100,
            playbackModesEndGapMs: 200,
            fastForwardMinimumSkipIntervalMs: 800,
            condensedMinimumSkipIntervalMs: 700,
        };
        const paritySubtitles = [makeTextSubtitle(1000, 2000, 'one', 0)];
        const secondTrack = makeTextSubtitle(5000, 6500, 'two', 1, 1);
        const buildParityPlan = (subtitles: SubtitleModel[]) => {
            const parityPlan = buildPlaybackPlan({
                subtitles,
                displaySubtitles: subtitles,
                durationMs: 20_000,
                playModes: new Set([PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                playbackModeStartOffset: paritySettings.playbackModeStartOffsetMs,
                playbackModeEndOffset: paritySettings.playbackModeEndOffsetMs,
                playbackModesStartGap: paritySettings.playbackModesStartGapMs,
                playbackModesEndGap: paritySettings.playbackModesEndGapMs,
                repeatCountPreference: 1,
                condensedPlaybackMinimumSkipIntervalMs: paritySettings.condensedMinimumSkipIntervalMs,
                playbackRate: 1,
                fastForwardModePlaybackRate: 2,
                fastForwardPlaybackMinimumSkipIntervalMs: paritySettings.fastForwardMinimumSkipIntervalMs,
            });
            return {
                ...parityPlan,
                condensed: {
                    minimumSkipIntervalMs: paritySettings.condensedMinimumSkipIntervalMs,
                    pauseAtStart: false,
                },
            };
        };
        const parityOptions = {
            ...htmlOptions,
            timelineOptions: [
                { label: 'Playback mode start offset', value: '250 ms', settingKey: 'playbackModeStartOffsetMs' },
                {
                    label: 'Fast-forward minimum skip interval',
                    value: '800 ms',
                    settingKey: 'fastForwardMinimumSkipIntervalMs',
                },
                { label: 'Playback modes start gap', value: '-100 ms', settingKey: 'playbackModesStartGapMs' },
                { label: 'Playback mode end offset', value: '-150 ms', settingKey: 'playbackModeEndOffsetMs' },
                {
                    label: 'Condensed minimum skip interval',
                    value: '700 ms',
                    settingKey: 'condensedMinimumSkipIntervalMs',
                },
                { label: 'Playback modes end gap', value: '200 ms', settingKey: 'playbackModesEndGapMs' },
            ] as const,
            timelineSettings: paritySettings,
            timelineSubtitles: [...paritySubtitles, secondTrack],
            timelineTracks: [
                { track: 0, label: 'Track 1' },
                { track: 1, label: 'Track 2' },
            ],
        };
        const html = playbackTimelineToHtml({
            plan: buildParityPlan(paritySubtitles),
            themeColor: '#123456',
            modeLabels,
            ...parityOptions,
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const expectedTimeline = parsed.querySelector('.timeline')?.innerHTML;
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;

        window.eval(scriptText ?? '');

        expect(document.querySelector('.timeline')?.innerHTML).toBe(expectedTimeline);

        const trackSelect = document.querySelector<HTMLSelectElement>('select[data-track-select]');
        expect(trackSelect).not.toBeNull();
        trackSelect!.value = '1';
        trackSelect!.dispatchEvent(new Event('change', { bubbles: true }));

        const secondTrackHtml = playbackTimelineToHtml({
            plan: buildParityPlan([secondTrack]),
            themeColor: '#123456',
            modeLabels,
            ...parityOptions,
        });
        const expectedSecondTimeline = new DOMParser()
            .parseFromString(secondTrackHtml, 'text/html')
            .querySelector('.timeline')?.innerHTML;
        expect(document.querySelector('.timeline')?.innerHTML).toBe(expectedSecondTimeline);
    });

    it('keeps the embedded compiler in parity with the runtime plan across serialized modes, settings, and tracks', () => {
        const paritySettings = {
            playbackModeStartOffsetMs: 250,
            playbackModeEndOffsetMs: -350,
            playbackModesStartGapMs: -100,
            playbackModesEndGapMs: 200,
            fastForwardMinimumSkipIntervalMs: 800,
            condensedMinimumSkipIntervalMs: 700,
        };
        const firstTrack = [
            makeTextSubtitle(-500, 1500, 'before and clipped', 0, 0),
            makeTextSubtitle(1000, 3500, 'overlapping', 1, 0),
            makeTextSubtitle(5600, 6100, 'short gap', 2, 0),
            makeTextSubtitle(9000, 11000, 'last', 3, 0),
        ];
        const secondTrack = [
            makeTextSubtitle(2500, 4600, 'second track one', 0, 1),
            makeTextSubtitle(7000, 8500, 'second track two', 1, 1),
        ];
        const allTracks = [...firstTrack, ...secondTrack];
        const buildParityPlan = (selectedSubtitles: SubtitleModel[], settings: Partial<typeof paritySettings> = {}) => {
            const effectiveSettings = { ...paritySettings, ...settings };
            const runtimePlan = buildPlaybackPlan({
                subtitles: selectedSubtitles,
                displaySubtitles: selectedSubtitles,
                durationMs: 12_000,
                playModes: new Set([PlayMode.fastForward, PlayMode.autoPause, PlayMode.repeat]),
                autoPausePreference: AutoPausePreference.atStartAndEnd,
                playbackModeStartOffset: effectiveSettings.playbackModeStartOffsetMs,
                playbackModeEndOffset: effectiveSettings.playbackModeEndOffsetMs,
                playbackModesStartGap: effectiveSettings.playbackModesStartGapMs,
                playbackModesEndGap: effectiveSettings.playbackModesEndGapMs,
                repeatCountPreference: 2,
                condensedPlaybackMinimumSkipIntervalMs: effectiveSettings.condensedMinimumSkipIntervalMs,
                playbackRate: 1.25,
                fastForwardModePlaybackRate: 2.5,
                fastForwardPlaybackMinimumSkipIntervalMs: effectiveSettings.fastForwardMinimumSkipIntervalMs,
            });

            // The production export intentionally shows condensed and repeat layers together.
            return {
                ...runtimePlan,
                condensed: {
                    minimumSkipIntervalMs: effectiveSettings.condensedMinimumSkipIntervalMs,
                    pauseAtStart: false,
                },
            };
        };
        const parityOptions = {
            ...htmlOptions,
            timelineSettings: paritySettings,
            timelineOptions: [
                { label: 'Playback mode start offset', value: '250 ms', settingKey: 'playbackModeStartOffsetMs' },
                {
                    label: 'Fast-forward minimum interval',
                    value: '800 ms',
                    settingKey: 'fastForwardMinimumSkipIntervalMs',
                },
                { label: 'Playback modes start gap', value: '-100 ms', settingKey: 'playbackModesStartGapMs' },
                { label: 'Playback mode end offset', value: '-350 ms', settingKey: 'playbackModeEndOffsetMs' },
                { label: 'Condensed minimum interval', value: '700 ms', settingKey: 'condensedMinimumSkipIntervalMs' },
                { label: 'Playback modes end gap', value: '200 ms', settingKey: 'playbackModesEndGapMs' },
            ] as const,
            timelineTracks: [
                { track: 0, label: 'Track 1' },
                { track: 1, label: 'Track 2' },
            ],
            timelineSubtitles: allTracks,
        };
        const html = playbackTimelineToHtml({
            plan: buildParityPlan(firstTrack),
            themeColor: '#123456',
            modeLabels,
            ...parityOptions,
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const expectedInitialTimeline = parsed.querySelector('.timeline')?.innerHTML;
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;

        window.eval(scriptText ?? '');
        expect(document.querySelector('.timeline')?.innerHTML).toBe(expectedInitialTimeline);

        const effectiveSettings = { ...paritySettings };
        const settingChanges: Array<[keyof typeof paritySettings, number]> = [
            ['playbackModeStartOffsetMs', 900],
            ['playbackModeEndOffsetMs', -900],
            ['playbackModesStartGapMs', -600],
            ['playbackModesEndGapMs', 600],
            ['fastForwardMinimumSkipIntervalMs', 1_100],
            ['condensedMinimumSkipIntervalMs', 1_200],
        ];
        for (const [key, value] of settingChanges) {
            effectiveSettings[key] = value;
            const input = document.querySelector<HTMLInputElement>(`input[data-setting="${key}"]`);
            expect(input).not.toBeNull();
            input!.value = String(value);
            input!.dispatchEvent(new Event('input', { bubbles: true }));

            const expectedHtml = playbackTimelineToHtml({
                plan: buildParityPlan(firstTrack, effectiveSettings),
                themeColor: '#123456',
                modeLabels,
                ...parityOptions,
                timelineSettings: effectiveSettings,
            });
            const expectedTimeline = new DOMParser()
                .parseFromString(expectedHtml, 'text/html')
                .querySelector('.timeline')?.innerHTML;
            expect(document.querySelector('.timeline')?.innerHTML).toBe(expectedTimeline);
        }

        const trackSelect = document.querySelector<HTMLSelectElement>('select[data-track-select]');
        expect(trackSelect).not.toBeNull();
        trackSelect!.value = '1';
        trackSelect!.dispatchEvent(new Event('change', { bubbles: true }));

        const expectedSecondTrackHtml = playbackTimelineToHtml({
            plan: buildParityPlan(secondTrack, effectiveSettings),
            themeColor: '#123456',
            modeLabels,
            ...parityOptions,
            timelineSettings: effectiveSettings,
        });
        const expectedSecondTrackTimeline = new DOMParser()
            .parseFromString(expectedSecondTrackHtml, 'text/html')
            .querySelector('.timeline')?.innerHTML;
        expect(document.querySelector('.timeline')?.innerHTML).toBe(expectedSecondTrackTimeline);
    });

    it('can switch the timeline to another subtitle track', () => {
        const firstTrack = makeTextSubtitle(1000, 2000, 'one', 0, 0);
        const secondTrack = makeTextSubtitle(3000, 4000, 'two', 1, 1);
        const html = playbackTimelineToHtml({
            plan: plan([firstTrack]),
            themeColor: '#123456',
            modeLabels,
            ...htmlOptions,
            timelineSubtitles: [firstTrack, secondTrack],
            timelineTracks: [
                { track: 0, label: 'Track 1' },
                { track: 1, label: 'Track 2' },
            ],
        });
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const script = parsed.querySelector('script');
        const scriptText = script?.textContent;
        script?.remove();
        document.body.innerHTML = parsed.body.innerHTML;

        window.eval(scriptText ?? '');
        const trackSelect = document.querySelector<HTMLSelectElement>('select[data-track-select]');
        expect(trackSelect).not.toBeNull();
        trackSelect!.value = '1';
        trackSelect!.dispatchEvent(new Event('change', { bubbles: true }));

        expect(document.querySelector('.event.normal')?.textContent).toContain('1 | two');
        expect(document.querySelector('.event.normal')?.textContent).not.toContain('0 | one');
    });
});
