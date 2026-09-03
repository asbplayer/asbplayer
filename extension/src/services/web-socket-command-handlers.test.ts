import { afterEach, describe, expect, it } from '@jest/globals';
import type { AsbplayerInstance, SubtitleModel, VideoTabModel } from '@project/common';
import { PostMineAction } from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { webSocketCommandHandlers } from '@project/extension/src/services/web-socket-command-handlers';
import { localMediaId, streamingMediaId } from '@project/extension/src/services/web-socket-media-id';

const subtitle = (text: string, track: number, start: number): SubtitleModel => ({
    text,
    start,
    end: start + 1000,
    originalStart: start,
    originalEnd: start + 1000,
    track,
});

const videoElement = (id: number, src: string, overrides: Partial<VideoTabModel> = {}): VideoTabModel => ({
    id,
    src,
    subscribed: true,
    synced: true,
    loadedSubtitles: true,
    ...overrides,
});

const asbplayerInstance = (
    id: string,
    tabId: number,
    overrides: Partial<AsbplayerInstance> = {}
): AsbplayerInstance => ({
    id,
    tabId,
    sidePanel: false,
    videoPlayer: false,
    loadedSubtitles: true,
    timestamp: 0,
    ...overrides,
});

interface HarnessOptions {
    videoElements?: VideoTabModel[];
    asbplayers?: AsbplayerInstance[];
    activeTabId?: number;
    videoElementSubtitles?: { [tabId: number]: SubtitleModel[] };
    asbplayerSubtitles?: { [asbplayerId: string]: SubtitleModel[] };
    unreachableTabIds?: number[];
}

const harness = ({
    videoElements = [],
    asbplayers = [],
    activeTabId,
    videoElementSubtitles = {},
    asbplayerSubtitles = {},
    unreachableTabIds = [],
}: HarnessOptions) => {
    const videoElementCommands: any[] = [];
    const asbplayerCommands: any[] = [];
    const videoElementTabCommands: any[] = [];
    const tabIds = [...new Set([...videoElements.map((v) => v.id), ...asbplayers.map((a) => a.tabId!)])];

    (globalThis as any).browser = {
        tabs: {
            query: async (query: any) =>
                tabIds
                    .map((id) => ({ id, active: id === activeTabId }))
                    .filter((tab) => query.active !== true || tab.active),
            sendMessage: async (tabId: number) => {
                if (unreachableTabIds.includes(tabId)) {
                    throw new Error('Tab is not reachable');
                }

                return { subtitles: videoElementSubtitles[tabId] };
            },
        },
    };

    const tabRegistry = {
        activeVideoElements: async () => videoElements,
        asbplayerInstances: async () => asbplayers,
        publishCommandToVideoElements: async (commandFactory: (videoElement: any) => any) => {
            for (const v of videoElements) {
                const command = commandFactory({ tab: { id: v.id }, src: v.src });

                if (command !== undefined) {
                    videoElementCommands.push(command);
                }
            }
        },
        publishCommandToAsbplayers: async ({ commandFactory }: { commandFactory: (asbplayer: any) => any }) => {
            for (const a of asbplayers) {
                const command = commandFactory(a);

                if (command !== undefined) {
                    asbplayerCommands.push(command);
                }
            }
        },
        publishCommandToVideoElementTabs: async (commandFactory: () => any) => {
            const command = commandFactory();

            if (command !== undefined) {
                videoElementTabCommands.push(command);
            }
        },
        publishCommandToAsbplayersAndAwaitResponse: async ({ asbplayerId }: { asbplayerId: string }) => ({
            response: { subtitles: asbplayerSubtitles[asbplayerId] },
        }),
    } as unknown as TabRegistry;

    const settings = new SettingsProvider(new ExtensionSettingsStorage(new MockStorageArea()));
    const handlers = webSocketCommandHandlers(settings, tabRegistry);
    return { handlers, settings, videoElementCommands, asbplayerCommands, videoElementTabCommands };
};

const mineCommand = (body: any) => ({ command: 'mine-subtitle' as const, messageId: 'm', body });
const seekCommand = (body: any) => ({ command: 'seek-timestamp' as const, messageId: 's', body });

afterEach(() => {
    delete (globalThis as any).browser;
});

describe('seek-timestamp', () => {
    it('seeks only the media named by an explicit media ID', async () => {
        const targeted = videoElement(1, 'https://example.com/a.mp4');
        const other = videoElement(2, 'https://example.com/b.mp4');
        const { handlers, videoElementCommands } = harness({ videoElements: [targeted, other], activeTabId: 2 });

        await handlers.onSeekTimestamp(
            seekCommand({ timestamp: 42, mediaId: streamingMediaId(targeted.id, targeted.src) })
        );

        expect(videoElementCommands).toEqual([
            {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'currentTime', value: 42 },
                src: targeted.src,
            },
        ]);
    });

    it('seeks the active tab when no media ID is given', async () => {
        const active = videoElement(1, 'https://example.com/a.mp4');
        const background = videoElement(2, 'https://example.com/b.mp4');
        const { handlers, videoElementCommands } = harness({ videoElements: [active, background], activeTabId: 1 });

        await handlers.onSeekTimestamp(seekCommand({ timestamp: 7 }));

        expect(videoElementCommands.map((command) => command.src)).toEqual([active.src]);
    });

    it('seeks nothing when the media ID matches no media', async () => {
        const { handlers, videoElementCommands } = harness({
            videoElements: [videoElement(1, 'https://example.com/a.mp4')],
            activeTabId: 1,
        });

        await handlers.onSeekTimestamp(seekCommand({ timestamp: 7, mediaId: 'not-a-media-id' }));

        expect(videoElementCommands).toEqual([]);
    });

    it('does not seek local media', async () => {
        const asbplayer = asbplayerInstance('asbplayer-1', 3);
        const { handlers, videoElementCommands, asbplayerCommands } = harness({
            asbplayers: [asbplayer],
            activeTabId: 3,
        });

        await handlers.onSeekTimestamp(seekCommand({ timestamp: 7, mediaId: localMediaId(asbplayer.id) }));

        expect(videoElementCommands).toEqual([]);
        expect(asbplayerCommands).toEqual([]);
    });
});

describe('mine-subtitle', () => {
    it('publishes mapped Anki fields and the note ID to the targeted video element', async () => {
        const targeted = videoElement(1, 'https://example.com/a.mp4');
        const { handlers, settings, videoElementCommands } = harness({ videoElements: [targeted], activeTabId: 1 });
        await settings.set({
            wordField: 'Word',
            definitionField: 'Definition',
            sentenceField: 'Sentence',
            customAnkiFields: { furigana: 'Reading' },
        });

        const published = await handlers.onMineSubtitle(
            mineCommand({
                fields: { Word: 'ねこ', Definition: 'cat', Sentence: 'ねこがいる', Reading: 'ねこ[猫]' },
                postMineAction: PostMineAction.updateLastCard,
                mediaId: streamingMediaId(targeted.id, targeted.src),
                noteId: 555,
            })
        );

        expect(published).toBe(true);
        expect(videoElementCommands).toEqual([
            {
                sender: 'asbplayer-extension-to-video',
                message: {
                    command: 'copy-subtitle',
                    word: 'ねこ',
                    definition: 'cat',
                    text: 'ねこがいる',
                    customFieldValues: { furigana: 'ねこ[猫]' },
                    postMineAction: PostMineAction.updateLastCard,
                    noteId: 555,
                },
                src: targeted.src,
            },
        ]);
    });

    it('publishes to a targeted local asbplayer without a note ID', async () => {
        const asbplayer = asbplayerInstance('asbplayer-1', 3);
        const { handlers, settings, asbplayerCommands, videoElementCommands } = harness({
            asbplayers: [asbplayer],
            activeTabId: 3,
        });
        await settings.set({ wordField: 'Word', definitionField: '', sentenceField: '', customAnkiFields: {} });

        const published = await handlers.onMineSubtitle(
            mineCommand({
                fields: { Word: 'ねこ' },
                postMineAction: PostMineAction.showAnkiDialog,
                mediaId: localMediaId(asbplayer.id),
                noteId: 555,
            })
        );

        expect(published).toBe(true);
        expect(videoElementCommands).toEqual([]);
        expect(asbplayerCommands).toEqual([
            {
                sender: 'asbplayer-extension-to-player',
                message: {
                    command: 'copy-subtitle-with-additional-fields',
                    word: 'ねこ',
                    definition: undefined,
                    text: undefined,
                    customFieldValues: {},
                    postMineAction: PostMineAction.showAnkiDialog,
                },
                asbplayerId: asbplayer.id,
            },
        ]);
    });

    it('defaults to showing the Anki dialog when no post-mine action is given', async () => {
        const targeted = videoElement(1, 'https://example.com/a.mp4');
        const { handlers, videoElementCommands } = harness({ videoElements: [targeted], activeTabId: 1 });

        await handlers.onMineSubtitle(mineCommand({ fields: {}, postMineAction: undefined }));

        expect(videoElementCommands[0].message.postMineAction).toEqual(PostMineAction.showAnkiDialog);
    });

    it('publishes to every kind of media in the active tab when no media ID is given', async () => {
        const { handlers, videoElementCommands, asbplayerCommands } = harness({
            videoElements: [videoElement(3, 'https://example.com/a.mp4'), videoElement(9, 'https://example.com/b.mp4')],
            asbplayers: [asbplayerInstance('asbplayer-1', 3), asbplayerInstance('asbplayer-2', 9)],
            activeTabId: 3,
        });

        const published = await handlers.onMineSubtitle(mineCommand({ fields: {}, postMineAction: 0 }));

        expect(published).toBe(true);
        expect(videoElementCommands.map((command) => command.src)).toEqual(['https://example.com/a.mp4']);
        expect(asbplayerCommands.map((command) => command.asbplayerId)).toEqual(['asbplayer-1']);
    });

    it('reports not published when the targeted media has no loaded subtitles', async () => {
        const targeted = videoElement(1, 'https://example.com/a.mp4', { loadedSubtitles: false });
        const { handlers, videoElementCommands } = harness({ videoElements: [targeted], activeTabId: 1 });

        const published = await handlers.onMineSubtitle(mineCommand({ fields: {}, postMineAction: 0 }));

        expect(published).toBe(false);
        expect(videoElementCommands).toEqual([]);
    });

    it('reports not published when no media resolves', async () => {
        const { handlers } = harness({ videoElements: [videoElement(1, 'https://example.com/a.mp4')] });

        const published = await handlers.onMineSubtitle(mineCommand({ fields: {}, postMineAction: 0 }));

        expect(published).toBe(false);
    });
});

describe('get-bound-media', () => {
    it('reports streaming and local media with stable IDs', async () => {
        const streaming = videoElement(1, 'https://example.com/a.mp4', {
            title: 'Episode 1',
            faviconUrl: 'https://example.com/favicon.ico',
            subtitleTracks: [{ trackNumber: 0, fileName: 'a.srt' }],
        });
        const local = asbplayerInstance('asbplayer-1', 3, {
            subtitleTracks: [{ trackNumber: 0, fileName: 'movie.ass' }],
        });
        const { handlers } = harness({ videoElements: [streaming], asbplayers: [local], activeTabId: 1 });

        const media = await handlers.onGetBoundMedia();

        expect(media).toEqual([
            {
                id: streamingMediaId(1, streaming.src),
                type: 'streaming',
                title: 'Episode 1',
                faviconUrl: 'https://example.com/favicon.ico',
                loadedSubtitles: [{ trackNumber: 0, fileName: 'a.srt' }],
                active: true,
            },
            {
                id: localMediaId('asbplayer-1'),
                type: 'local',
                title: 'movie',
                loadedSubtitles: [{ trackNumber: 0, fileName: 'movie.ass' }],
                active: false,
            },
        ]);
    });

    it('excludes side panel, video player, and synced asbplayer instances', async () => {
        const { handlers } = harness({
            asbplayers: [
                asbplayerInstance('side-panel', 1, { sidePanel: true }),
                asbplayerInstance('synced', 2, {
                    syncedVideoElement: videoElement(2, 'https://example.com/a.mp4'),
                }),
                asbplayerInstance('no-subtitles', 3, { loadedSubtitles: false }),
            ],
            activeTabId: 1,
        });

        expect(await handlers.onGetBoundMedia()).toEqual([]);
    });

    it('reports IDs that resolve back to the same media', async () => {
        const streaming = videoElement(1, 'https://example.com/a.mp4');
        const { handlers, videoElementCommands } = harness({ videoElements: [streaming], activeTabId: 99 });

        const [media] = await handlers.onGetBoundMedia();
        await handlers.onSeekTimestamp(seekCommand({ timestamp: 3, mediaId: media.id }));

        expect(videoElementCommands.map((command) => command.src)).toEqual([streaming.src]);
    });
});

describe('get-subtitles', () => {
    it('returns cues from the media named by an explicit media ID', async () => {
        const targeted = videoElement(1, 'https://example.com/a.mp4');
        const { handlers } = harness({
            videoElements: [targeted, videoElement(2, 'https://example.com/b.mp4')],
            activeTabId: 2,
            videoElementSubtitles: {
                1: [subtitle('ねこ', 0, 0)],
                2: [subtitle('いぬ', 0, 0)],
            },
        });

        const subtitles = await handlers.onGetSubtitles(streamingMediaId(targeted.id, targeted.src), undefined);

        expect(subtitles).toEqual([{ text: 'ねこ', start: 0, end: 1000, track: 0 }]);
    });

    it('filters cues to the requested tracks', async () => {
        const { handlers } = harness({
            videoElements: [videoElement(1, 'https://example.com/a.mp4')],
            activeTabId: 1,
            videoElementSubtitles: { 1: [subtitle('ねこ', 0, 0), subtitle('いぬ', 1, 0), subtitle('とり', 2, 0)] },
        });

        const subtitles = await handlers.onGetSubtitles(undefined, [1, 2]);

        expect(subtitles.map((cue) => cue.text)).toEqual(['いぬ', 'とり']);
    });

    it('returns every cue when the requested track list is empty', async () => {
        const { handlers } = harness({
            videoElements: [videoElement(1, 'https://example.com/a.mp4')],
            activeTabId: 1,
            videoElementSubtitles: { 1: [subtitle('ねこ', 0, 0), subtitle('いぬ', 1, 0)] },
        });

        expect(await handlers.onGetSubtitles(undefined, [])).toHaveLength(2);
    });

    it('returns cues from a local asbplayer target', async () => {
        const asbplayer = asbplayerInstance('asbplayer-1', 3);
        const { handlers } = harness({
            asbplayers: [asbplayer],
            activeTabId: 3,
            asbplayerSubtitles: { 'asbplayer-1': [subtitle('ねこ', 0, 500)] },
        });

        expect(await handlers.onGetSubtitles(localMediaId(asbplayer.id), undefined)).toEqual([
            { text: 'ねこ', start: 500, end: 1500, track: 0 },
        ]);
    });

    it('falls back to a local asbplayer in the active tab when no media ID is given', async () => {
        const asbplayer = asbplayerInstance('asbplayer-1', 3);
        const { handlers } = harness({
            asbplayers: [asbplayer],
            activeTabId: 3,
            asbplayerSubtitles: { 'asbplayer-1': [subtitle('ねこ', 0, 0)] },
        });

        expect(await handlers.onGetSubtitles(undefined, undefined)).toEqual([
            { text: 'ねこ', start: 0, end: 1000, track: 0 },
        ]);
    });

    it('prefers the video element when the active tab has both kinds of media', async () => {
        const { handlers } = harness({
            videoElements: [videoElement(3, 'https://example.com/a.mp4')],
            asbplayers: [asbplayerInstance('asbplayer-1', 3)],
            activeTabId: 3,
            videoElementSubtitles: { 3: [subtitle('streaming', 0, 0)] },
            asbplayerSubtitles: { 'asbplayer-1': [subtitle('local', 0, 0)] },
        });

        expect((await handlers.onGetSubtitles(undefined, undefined)).map((cue) => cue.text)).toEqual(['streaming']);
    });

    it('ignores media outside the active tab when no media ID is given', async () => {
        const { handlers } = harness({
            videoElements: [videoElement(1, 'https://example.com/a.mp4')],
            activeTabId: 2,
            videoElementSubtitles: { 1: [subtitle('ねこ', 0, 0)] },
        });

        expect(await handlers.onGetSubtitles(undefined, undefined)).toEqual([]);
    });

    it('returns no cues when no media resolves', async () => {
        const { handlers } = harness({ videoElements: [videoElement(1, 'https://example.com/a.mp4')] });

        expect(await handlers.onGetSubtitles(undefined, undefined)).toEqual([]);
    });

    it('returns no cues when the target tab cannot be reached', async () => {
        const { handlers } = harness({
            videoElements: [videoElement(1, 'https://example.com/a.mp4')],
            activeTabId: 1,
            videoElementSubtitles: { 1: [subtitle('ねこ', 0, 0)] },
            unreachableTabIds: [1],
        });

        expect(await handlers.onGetSubtitles(undefined, undefined)).toEqual([]);
    });
});

describe('load-subtitles', () => {
    it('publishes the received files to video element tabs', async () => {
        const { handlers, videoElementTabCommands } = harness({});
        const files = [{ base64: 'AAA', name: 'a.srt' }];

        await handlers.onLoadSubtitles({ command: 'load-subtitles', messageId: 'l', body: { files } });

        expect(videoElementTabCommands).toEqual([
            {
                sender: 'asbplayer-extension-to-video',
                message: { command: 'toggle-video-select', subtitleFiles: files },
            },
        ]);
    });
});
