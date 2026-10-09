import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ASB_TOKEN_SELECTED_CLASS } from '@project/common/annotations';
import {
    makeDictionaryTrack,
    makeDictionaryTracks,
    makeSubtitle,
    makeToken,
} from '@project/common/annotations/annotations-test-utils';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import { defaultSettings, TokenStatus } from '@project/common/settings';
import type { SettingsProvider, SubtitlesWidthUnit } from '@project/common/settings';
import SubtitleController from '@project/extension/src/controllers/subtitle-controller';
import type Binding from '@project/extension/src/services/binding';

describe('SubtitleController appearance rendering', () => {
    const controllers: SubtitleController[] = [];

    afterEach(() => {
        for (const controller of controllers) controller.unbind();
        controllers.length = 0;
        document.body.replaceChildren();
        jest.useRealTimers();
        Reflect.deleteProperty(document, 'fullscreenElement');
    });

    const controllerForVideo = () => {
        const video = document.createElement('video');
        video.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 360 }) as DOMRect;
        const controller = new SubtitleController(
            {
                video,
                registeredVideoSrc: 'https://example.com/video.mp4',
                currentTimeMs: 0,
                subtitlesChanged: () => {},
            } as unknown as Binding,
            { publishStatisticsSnapshot: async () => {} } as unknown as DictionaryProvider,
            {
                activeProfile: async () => undefined,
                getAll: async () => defaultSettings,
                getSingle: async (key: keyof typeof defaultSettings) => defaultSettings[key],
            } as unknown as SettingsProvider
        );
        controllers.push(controller);
        return controller;
    };

    it('keeps cached image subtitle width responsive and rebuilds its ratio when image scale changes', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings({ ...defaultSettings, imageBasedSubtitleScaleFactor: 2 });
        controller.subtitles = [
            {
                text: '',
                textImage: {
                    dataUrl: 'data:image/png;base64,image',
                    screen: { width: 100, height: 50 },
                    image: { width: 25, height: 10 },
                },
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 0,
                index: 0,
            },
        ];
        controller.cacheHtml();

        let imageContainer = document.querySelector<HTMLImageElement>('img[alt="subtitle"]')?.parentElement;
        expect(imageContainer?.dataset.asbVideoWidthRatio).toBe('0.5');
        expect(imageContainer?.style.maxWidth).toBe('100%');
        expect(imageContainer?.getAttributeNames()).not.toContain('}');

        controller.setSubtitleSettings({ ...defaultSettings, imageBasedSubtitleScaleFactor: 4 });

        imageContainer = document.querySelector<HTMLImageElement>('img[alt="subtitle"]')?.parentElement;
        expect(imageContainer?.dataset.asbVideoWidthRatio).toBe('1');
    });

    it('falls back to track zero subtitle classes for tracks without appearance settings', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings({ ...defaultSettings, subtitleBlur: true });
        controller.subtitles = [
            {
                text: 'subtitle',
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 5,
                index: 0,
            },
            {
                text: '',
                textImage: {
                    dataUrl: 'data:image/png;base64,image',
                    screen: { width: 100, height: 50 },
                    image: { width: 25, height: 10 },
                },
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 6,
                index: 1,
            },
        ];
        controller.cacheHtml();

        expect(document.querySelector('span[data-track="5"]')?.className).toBe('asbplayer-subtitles-blurred');
        expect(document.querySelector('div[data-track="6"]')?.className).toBe('asbplayer-subtitles-blurred');
    });

    it('rebuilds cached word visibility when subtitles are shown only while paused', () => {
        const controller = controllerForVideo();
        const track = makeDictionaryTrack();
        track.dictionaryPlaybackConfig.wordVisibility.onStatuses[TokenStatus.MATURE].enabled = true;
        controller.dictionaryTrackSettings = makeDictionaryTracks(track);
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            makeSubtitle({
                text: '語 学',
                originalText: '語 学',
                tokenization: {
                    tokens: [
                        makeToken({ pos: [0, 1], status: TokenStatus.MATURE }),
                        makeToken({ pos: [2, 3], status: TokenStatus.UNKNOWN }),
                    ],
                },
            }),
        ];
        controller.subtitles[0].tokenization!.tokens[0].status = TokenStatus.MATURE;
        controller.subtitles[0].tokenization!.tokens[1].status = TokenStatus.UNKNOWN;
        controller.cacheHtml();
        controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: false });
        expect(
            document.querySelector('.asbplayer-subtitles-container-bottom .asb-token-adaptive-hidden')
        ).not.toBeNull();

        controller.setAdaptiveWordVisibilityEnabled(false);
        expect(document.querySelector('.asbplayer-subtitles-container-bottom .asb-token-adaptive-hidden')).toBeNull();
        controller.setAdaptiveWordVisibilityEnabled(true);
        expect(
            document.querySelector('.asbplayer-subtitles-container-bottom .asb-token-adaptive-hidden')
        ).not.toBeNull();
    });

    it.each(['bottom', 'top'] as const)(
        'keeps adaptive word visibility in sync when the %s overlay enters and exits fullscreen',
        (subtitleAlignment) => {
            const controller = controllerForVideo();
            const track = makeDictionaryTrack();
            track.dictionaryPlaybackConfig.wordVisibility.onStatuses[TokenStatus.MATURE].enabled = true;
            controller.dictionaryTrackSettings = makeDictionaryTracks(track);
            controller.setPlaybackPaused(true);
            controller.setSubtitleSettings({ ...defaultSettings, subtitleAlignment });
            controller.subtitles = [
                makeSubtitle({
                    text: '語 学',
                    tokenization: {
                        tokens: [
                            makeToken({ pos: [0, 1], status: TokenStatus.MATURE }),
                            makeToken({ pos: [2, 3], status: TokenStatus.UNKNOWN }),
                        ],
                    },
                }),
            ];
            controller.subtitles[0].tokenization!.tokens[0].status = TokenStatus.MATURE;
            controller.subtitles[0].tokenization!.tokens[1].status = TokenStatus.UNKNOWN;
            controller.cacheHtml();
            controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: true });

            const hiddenWord = document.querySelector('.asbplayer-subtitles .asb-token-adaptive-hidden');
            expect(hiddenWord).not.toBeNull();
            expect(hiddenWord?.closest('.asb-playback-paused')).not.toBeNull();

            Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.body });
            document.dispatchEvent(new Event('fullscreenchange'));
            expect(document.querySelector('.asbplayer-fullscreen-subtitles .asb-token-adaptive-hidden')).toBe(
                hiddenWord
            );
            expect(hiddenWord?.closest('.asb-playback-paused')).not.toBeNull();

            controller.setPlaybackPaused(false);
            controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: false });
            expect(hiddenWord?.closest('.asb-playback-paused')).toBeNull();

            Reflect.deleteProperty(document, 'fullscreenElement');
            document.dispatchEvent(new Event('fullscreenchange'));
            expect(document.querySelector('.asbplayer-subtitles .asb-token-adaptive-hidden')).toBe(hiddenWord);
            expect(hiddenWord?.closest('.asb-playback-paused')).toBeNull();
        }
    );

    it('identifies rendered text subtitles for token selection', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            {
                text: 'subtitle',
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 0,
                index: 0,
            },
        ];
        controller.cacheHtml();

        expect(document.querySelector('span[data-track="0"]')?.getAttribute('data-asb-subtitle-index')).toBe('0');
    });

    it.each([false, true])('preserves the selection source after annotations update (auto-pause: %s)', (autoPause) => {
        const controller = controllerForVideo();
        controller.dictionaryTrackSettings = makeDictionaryTracks(
            makeDictionaryTrack({ dictionaryColorizeSubtitles: true })
        );
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            makeSubtitle({
                index: 0,
                text: 'word',
                tokenization: { tokens: [makeToken({ pos: [0, 4], status: TokenStatus.UNKNOWN })] },
            }),
        ];
        controller.subtitles[0].tokenization!.tokens[0].status = TokenStatus.UNKNOWN;
        controller.cacheHtml();
        controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: true });
        expect(controller.selectToken({ subtitleIndex: 0, tokenStart: 0 }, { autoPause })).toBe(true);
        const originalToken = document.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`);
        const focusedElement = document.createElement('button');
        document.body.append(focusedElement);
        focusedElement.focus();

        controller.subtitles[0].tokenization!.tokens[0].status = TokenStatus.LEARNING;
        controller.cacheHtml();
        controller.refreshCurrentSubtitle = true;
        controller.refreshShowingSubtitles();

        const updatedToken = document.querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`);
        expect(updatedToken).not.toBeNull();
        expect(updatedToken).not.toBe(originalToken);
        expect(document.getSelection()?.toString()).toBe('word');
        expect(document.activeElement).toBe(focusedElement);

        controller.clearAutoPauseTokenSelection();
        expect(controller.currentTokenSelectionLocation()).toEqual(
            autoPause ? undefined : { subtitleIndex: 0, tokenStart: 0 }
        );
        expect(
            document.querySelector('.asbplayer-subtitles-container-bottom .asb-subtitle-token-selected') !== null
        ).toBe(!autoPause);
        expect(document.getSelection()?.toString()).toBe(autoPause ? '' : 'word');
    });

    it('selects tokens only in this controller when multiple video bindings share a document', () => {
        const firstController = controllerForVideo();
        const secondController = controllerForVideo();
        for (const controller of [firstController, secondController]) {
            controller.dictionaryTrackSettings = makeDictionaryTracks(
                makeDictionaryTrack({ dictionaryColorizeSubtitles: true })
            );
            controller.setSubtitleSettings(defaultSettings);
            controller.subtitles = [
                makeSubtitle({
                    index: 0,
                    text: 'word',
                    tokenization: { tokens: [makeToken({ pos: [0, 4], status: TokenStatus.UNKNOWN })] },
                }),
            ];
            controller.subtitles[0].tokenization!.tokens[0].status = TokenStatus.UNKNOWN;
            controller.cacheHtml();
            controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: true });
        }

        const containers = document.querySelectorAll('.asbplayer-subtitles-container-bottom');
        expect(containers).toHaveLength(2);
        expect(Array.from(containers, (container) => container.querySelectorAll('.asb-token').length)).toEqual([1, 1]);
        expect(firstController.selectToken({ subtitleIndex: 0, tokenStart: 0 })).toBe(true);
        expect(containers[0].querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).not.toBeNull();
        expect(containers[1].querySelector(`.${ASB_TOKEN_SELECTED_CLASS}`)).toBeNull();
        expect(firstController.currentTokenSelectionLocation()).toEqual({ subtitleIndex: 0, tokenStart: 0 });
        expect(secondController.currentTokenSelectionLocation()).toBeUndefined();
    });

    it('rerenders the current subtitle when appearance or alignment settings change', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings({ ...defaultSettings, subtitleColor: '#ff0000' });
        controller.subtitles = [
            {
                text: 'subtitle',
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 0,
                index: 0,
            },
        ];
        controller.cacheHtml();
        controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: false });

        expect(document.querySelector('.asbplayer-subtitles-container-bottom span')?.getAttribute('style')).toContain(
            'color: #ff0000'
        );

        controller.setSubtitleSettings({
            ...defaultSettings,
            subtitleColor: '#0000ff',
            subtitleAlignment: 'top',
        });

        expect(document.querySelector('.asbplayer-subtitles-container-bottom span')).toBeNull();
        expect(document.querySelector('.asbplayer-subtitles-container-top span')?.getAttribute('style')).toContain(
            'color: #0000ff'
        );
    });

    it('clears the loaded subtitle filename after its timeout when no subtitle is showing', () => {
        jest.useFakeTimers();
        const controller = controllerForVideo();
        controller.subtitleFileNames = ['episode.srt'];
        controller.playbackStateChanged({
            timestampMs: 0,
            showingSubtitleIndexes: [],
            invisibleSubtitleIndexes: [],
            paused: true,
        });

        controller.showLoadedMessage([]);
        expect(document.querySelector('.asbplayer-subtitles-container-bottom')?.textContent).toContain('episode.srt');

        jest.advanceTimersByTime(1000);

        expect(document.querySelector('.asbplayer-subtitles-container-bottom')?.textContent).not.toContain(
            'episode.srt'
        );
    });

    it('renders layout placeholders invisibly and supports playback states from older clients', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            {
                text: 'primary',
                start: 0,
                end: 3000,
                originalStart: 0,
                originalEnd: 3000,
                track: 0,
                index: 0,
            },
            {
                text: 'secondary',
                start: 1000,
                end: 2000,
                originalStart: 1000,
                originalEnd: 2000,
                track: 1,
                index: 1,
            },
        ];
        controller.cacheHtml();

        controller.playbackStateChanged({
            timestampMs: 0,
            showingSubtitleIndexes: [0],
            invisibleSubtitleIndexes: [1],
            paused: false,
        });

        const secondary = document.querySelector<HTMLElement>('span[data-track="1"]')?.parentElement;
        const container = document.querySelector<HTMLElement>('.asbplayer-subtitles-container-bottom');
        const primary = document.querySelector<HTMLElement>('span[data-track="0"]')?.parentElement;
        expect(container?.style.getPropertyValue('pointer-events')).toBe('none');
        expect(primary?.style.pointerEvents).toBe('auto');
        expect(secondary?.style.visibility).toBe('hidden');
        expect(secondary?.style.pointerEvents).toBe('none');
        expect(secondary?.getAttribute('aria-hidden')).toBe('true');

        controller.playbackStateChanged({ timestampMs: 1000, showingSubtitleIndexes: [0, 1], paused: false });

        expect(document.querySelector<HTMLElement>('span[data-track="1"]')?.parentElement?.style.visibility).toBe('');
    });

    it('excludes invisible layout placeholders from hover hit testing', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            {
                text: 'visible',
                start: 0,
                end: 3000,
                originalStart: 0,
                originalEnd: 3000,
                track: 0,
                index: 0,
            },
            {
                text: 'placeholder',
                start: 1000,
                end: 2000,
                originalStart: 1000,
                originalEnd: 2000,
                track: 1,
                index: 1,
            },
        ];
        controller.cacheHtml();
        controller.playbackStateChanged({
            timestampMs: 0,
            showingSubtitleIndexes: [0],
            invisibleSubtitleIndexes: [1],
            paused: false,
        });

        const container = document.querySelector<HTMLElement>('.asbplayer-subtitles-container-bottom')!;
        const visible = document.querySelector<HTMLElement>('span[data-track="0"]')!.parentElement!;
        const placeholder = document.querySelector<HTMLElement>('span[data-track="1"]')!.parentElement!;
        container.getBoundingClientRect = () => ({ x: 100, y: 100, width: 100, height: 80 }) as DOMRect;
        visible.getBoundingClientRect = () => ({ x: 100, y: 100, width: 100, height: 20 }) as DOMRect;
        placeholder.getBoundingClientRect = () => ({ x: 100, y: 140, width: 100, height: 20 }) as DOMRect;

        expect(controller.intersects(110, 110)).toBe(true);
        expect(controller.intersects(110, 155)).toBe(false);
    });

    it('filters hidden subtitles without removing unhidden layout placeholders', () => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings(defaultSettings);
        controller.subtitles = [
            {
                text: 'primary',
                start: 0,
                end: 3000,
                originalStart: 0,
                originalEnd: 3000,
                track: 0,
                index: 0,
            },
            {
                text: 'placeholder',
                start: 1000,
                end: 2000,
                originalStart: 1000,
                originalEnd: 2000,
                track: 1,
                index: 1,
            },
        ];
        controller.cacheHtml();

        controller.playbackStateChanged({
            timestampMs: 0,
            showingSubtitleIndexes: [0],
            invisibleSubtitleIndexes: [1],
            hiddenSubtitleIndexes: [0],
            paused: false,
        });

        const container = document.querySelector('.asbplayer-subtitles-container-bottom');
        expect(container?.querySelector('span[data-track="0"]')).toBeNull();
        expect(container?.querySelector<HTMLElement>('span[data-track="1"]')?.parentElement?.style.visibility).toBe(
            'hidden'
        );

        controller.playbackStateChanged({
            timestampMs: 0,
            showingSubtitleIndexes: [0],
            invisibleSubtitleIndexes: [1],
            hiddenSubtitleIndexes: [0, 1],
            paused: false,
        });

        expect(container?.querySelector('span[data-track="0"]')).toBeNull();
        expect(container?.querySelector('span[data-track="1"]')).toBeNull();
    });

    // The video is 640px wide and the viewport is 1024px wide in these tests
    const containerWidthFor = (width: number, unit: SubtitlesWidthUnit) => {
        const controller = controllerForVideo();
        controller.setSubtitleSettings({ ...defaultSettings, subtitlesWidth: width, subtitlesWidthUnit: unit });
        controller.setSubtitlesWidth(width, unit);
        controller.subtitles = [
            {
                text: 'subtitle',
                start: 0,
                end: 1000,
                originalStart: 0,
                originalEnd: 1000,
                track: 0,
                index: 0,
            },
        ];
        controller.playbackStateChanged({ timestampMs: 0, showingSubtitleIndexes: [0], paused: false });
        controller.refresh();

        const containers = document.querySelectorAll<HTMLElement>('.asbplayer-subtitles-container-bottom');
        return containers[containers.length - 1]?.style.width;
    };

    it('applies the subtitle width as a percentage of the video', () => {
        expect(containerWidthFor(50, '%')).toBe('320px');
    });

    it('applies the subtitle width in pixels', () => {
        expect(containerWidthFor(800, 'px')).toBe('800px');
    });

    it('caps the subtitle width at the viewport width', () => {
        expect(containerWidthFor(2000, 'px')).toBe(`${Math.min(window.innerWidth, 2000)}px`);
    });
});
