import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useVideoDataSyncDialogState } from '@project/common/components/VideoDataSyncDialog';
import type { FileWithId } from '@project/common/file-selector';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const subtitleFile = (id: string, name = `${id}.srt`): FileWithId => ({ id, file: new File([''], name) });
const readFileBytes = (file: File) =>
    new Promise<number[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });

const subtitleExtensions = [
    'srt',
    'ass',
    'vtt',
    'sup',
    'nfvtt',
    'nfimsc',
    'ytxml',
    'ytsrv3',
    'dfxp',
    'ttml2',
    'bbjson',
];
const binarySubtitleData = new Uint8Array([0x50, 0x47, 0x00, 0xff, 0x81, 0x00, 0x7f]);

describe('local subtitle track selection', () => {
    let container: HTMLDivElement;
    let root: Root;
    let state: ReturnType<typeof useVideoDataSyncDialogState>;

    function Harness({ files }: { files?: FileWithId[] }) {
        state = useVideoDataSyncDialogState(files);
        return null;
    }

    const render = (files?: FileWithId[]) => {
        act(() => root.render(<Harness files={files} />));
    };
    const open = () => act(() => state.openSubtitleTrackSelector());

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it('shows dropped files as the selected tracks in their loaded order', () => {
        const files = [subtitleFile('ja', 'Japanese.ass'), subtitleFile('en', 'English.srt')];
        render(files);
        open();

        expect(state.subtitleTrackSelectorOpen).toBe(true);
        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['ja', 'en', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'ja', 'en']);
        const track = state.subtitleTrackSelectorTracks[1];
        expect(track.file).toBe(files[0].file);
        expect(track.label).toBe('Japanese.ass');
        expect(track.extension).toBe('ass');
    });

    it('preserves an empty slot before a loaded track', () => {
        render([subtitleFile('-', '.srt'), subtitleFile('en')]);
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['-', 'en', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'en']);
        expect(state.subtitleTrackSelectorTracks[0].file?.size).toBe(0);
        expect(state.subtitleTrackSelectorTracks[0].file?.name).toBe('.srt');
    });

    it.each(subtitleExtensions)('preserves the original %s file and its playback slot', async (extension) => {
        const file = new File([binarySubtitleData], `字幕.en.${extension}`);
        render([subtitleFile('-', '.srt'), { id: 'loaded', file }]);
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['-', 'loaded', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'loaded']);
        const track = state.subtitleTrackSelectorTracks[1];
        expect(track.file).toBe(file);
        expect(track.label).toBe(file.name);
        expect(track.extension).toBe(extension);
        expect(await readFileBytes(track.file!)).toEqual(Array.from(binarySubtitleData));
        expect(state.subtitleTrackSelectorTracks[0].file?.size).toBe(0);
    });

    it('restores a mixed ASS, VTT and SUP playback order after reopening', async () => {
        const files = ['ass', 'vtt', 'sup'].map((extension) => ({
            id: extension,
            file: new File([binarySubtitleData], `episode.${extension}`),
        }));
        render(files);
        open();
        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['ass', 'vtt', 'sup']);

        act(() => state.closeSubtitleTrackSelector());
        const reorderedFiles = [files[2], files[0], files[1]];
        render(reorderedFiles);
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['sup', 'ass', 'vtt']);
        for (const [index, source] of reorderedFiles.entries()) {
            const track = state.subtitleTrackSelectorTracks[index + 1];
            expect(track.file).toBe(source.file);
            expect(track.extension).toBe(source.id);
        }
        expect(await readFileBytes(state.subtitleTrackSelectorTracks[1].file!)).toEqual(Array.from(binarySubtitleData));
    });

    it('reopens with loaded files rather than cancelled draft choices', () => {
        const files = [subtitleFile('ja'), subtitleFile('en')];
        render(files);
        open();
        act(() => {
            state.setSubtitleTrackSelectorSelectedTrackIds(['en', '-', '-']);
            state.closeSubtitleTrackSelector();
        });
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['ja', 'en', '-']);
    });

    it('uses replacement files on the next open without changing an open draft', () => {
        render([subtitleFile('ja')]);
        open();
        act(() => state.setSubtitleTrackSelectorSelectedTrackIds(['-', 'ja', '-']));

        render([subtitleFile('fr')]);
        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['-', 'ja', '-']);
        act(() => state.closeSubtitleTrackSelector());
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['fr', '-', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'fr']);
    });

    it('keeps duplicate selected slots while listing each file only once', () => {
        const file = subtitleFile('ja');
        render([file, file]);
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['ja', 'ja', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'ja']);
    });

    it('keeps every loaded file available when more than three files were dropped', () => {
        render(['ja', 'en', 'fr', 'de'].map((id) => subtitleFile(id)));
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['ja', 'en', 'fr']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-', 'ja', 'en', 'fr', 'de']);
    });

    it('clears stale choices when the loaded file list is empty', () => {
        render([subtitleFile('ja')]);
        open();
        act(() => state.closeSubtitleTrackSelector());
        render([]);
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['-', '-', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['-']);
    });

    it('preserves caller-managed selections when no loaded file list is supplied', () => {
        render();
        act(() => {
            state.setSubtitleTrackSelectorTracks([
                { id: 'detected', label: 'Japanese', extension: 'vtt', url: 'https://example.com/ja.vtt' },
            ]);
            state.setSubtitleTrackSelectorSelectedTrackIds(['detected', '-', '-']);
        });
        open();

        expect(state.subtitleTrackSelectorSelectedTrackIds).toEqual(['detected', '-', '-']);
        expect(state.subtitleTrackSelectorTracks.map(({ id }) => id)).toEqual(['detected']);
    });
});
