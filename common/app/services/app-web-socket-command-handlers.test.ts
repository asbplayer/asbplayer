import { describe, expect, it } from '@jest/globals';
import type { SubtitleModel } from '@project/common/src/model';
import { appWebSocketCommandHandlers } from '@project/common/app/services/app-web-socket-command-handlers';
import { localMediaId } from '@project/common/web-socket-client/web-socket-media';

const appId = 'b2c9c0f4-6a7f-4a1a-9d6c-2c1a1d3e4f50';

const subtitle = (text: string, track: number, start: number): SubtitleModel => ({
    text,
    start,
    end: start + 1000,
    originalStart: start,
    originalEnd: start + 1000,
    track,
});

const handlers = ({
    subtitles = [],
    subtitleFileNames = [],
    active = true,
}: Partial<{ subtitles: SubtitleModel[]; subtitleFileNames: string[]; active: boolean }> = {}) =>
    appWebSocketCommandHandlers({ appId, subtitles, subtitleFileNames, isActive: () => active });

describe('get-bound-media', () => {
    it('reports no media when no subtitles are loaded', async () => {
        expect(await handlers().onGetBoundMedia()).toEqual([]);
    });

    it('reports one local media item with the shared local media ID and metadata', async () => {
        const media = await handlers({
            subtitles: [subtitle('one', 0, 0), subtitle('two', 1, 1000)],
            subtitleFileNames: ['japanese.srt', 'english.srt'],
        }).onGetBoundMedia();

        expect(media).toEqual([
            {
                id: localMediaId(appId),
                type: 'local',
                title: 'japanese',
                loadedSubtitles: [
                    { trackNumber: 0, fileName: 'japanese.srt' },
                    { trackNumber: 1, fileName: 'english.srt' },
                ],
                active: true,
            },
        ]);
    });

    it('reports the app as inactive while it is hidden', async () => {
        const [media] = await handlers({
            subtitles: [subtitle('one', 0, 0)],
            subtitleFileNames: ['japanese.srt'],
            active: false,
        }).onGetBoundMedia();

        expect(media.active).toEqual(false);
    });
});

describe('get-subtitles', () => {
    const subtitles = [subtitle('one', 0, 0), subtitle('two', 1, 1000)];
    const subtitleFileNames = ['japanese.srt', 'english.srt'];
    const cues = [
        { text: 'one', start: 0, end: 1000, track: 0 },
        { text: 'two', start: 1000, end: 2000, track: 1 },
    ];

    it('returns the loaded subtitles without a media ID only while the app is visible', async () => {
        expect(
            await handlers({ subtitles, subtitleFileNames, active: true }).onGetSubtitles(undefined, undefined)
        ).toEqual(cues);
        expect(
            await handlers({ subtitles, subtitleFileNames, active: false }).onGetSubtitles(undefined, undefined)
        ).toEqual([]);
    });

    it('returns the loaded subtitles only for its own media ID, even while hidden', async () => {
        const hidden = handlers({ subtitles, subtitleFileNames, active: false });

        expect(await hidden.onGetSubtitles(localMediaId(appId), undefined)).toEqual(cues);
        expect(await hidden.onGetSubtitles(localMediaId('other-app'), undefined)).toEqual([]);
    });

    it('filters by the requested track numbers', async () => {
        expect(await handlers({ subtitles, subtitleFileNames }).onGetSubtitles(undefined, [1])).toEqual([cues[1]]);
    });
});
