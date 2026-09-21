import { afterEach, describe, expect, it } from '@jest/globals';
import type { DictionaryProvider } from '@project/common/dictionary-db';
import { defaultSettings } from '@project/common/settings';
import type { SettingsProvider, SubtitlesWidthUnit } from '@project/common/settings';
import SubtitleController from '@project/extension/src/controllers/subtitle-controller';
import type Binding from '@project/extension/src/services/binding';

describe('SubtitleController appearance rendering', () => {
    const controllers: SubtitleController[] = [];

    afterEach(() => {
        for (const controller of controllers) controller.unbind();
        controllers.length = 0;
        document.body.replaceChildren();
    });

    const controllerForVideo = () => {
        const video = document.createElement('video');
        video.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 360 }) as DOMRect;
        const controller = new SubtitleController(
            {
                video,
                registeredVideoSrc: 'https://example.com/video.mp4',
                currentTimeMs: 0,
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
