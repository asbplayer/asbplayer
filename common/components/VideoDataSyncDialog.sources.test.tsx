import { expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VideoDataSyncDialog from '@project/common/components/VideoDataSyncDialog';
import { VideoDataUiOpenReason } from '@project/common';
import type { ConfirmedVideoDataSubtitleTrack, VideoDataSubtitleTrack } from '@project/common';
import { DefaultFileSelector } from '@project/common/file-selector';
import { initialGlobalState } from '@project/common/global-state';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Picker = (props: Partial<React.ComponentProps<typeof VideoDataSyncDialog>>) => (
    <VideoDataSyncDialog
        open={true}
        disabled={false}
        isLoading={false}
        suggestedName="Video"
        subtitleTracks={[]}
        selectedSubtitleTrackIds={['-', '-', '-']}
        defaultCheckboxState={false}
        error=""
        openReason={VideoDataUiOpenReason.userRequested}
        profiles={[]}
        onlineSubtitleSourceConfig={initialGlobalState.onlineSubtitleSourceConfig}
        clientId="test"
        hasSeenFtue={true}
        hideRememberTrackPreferenceToggle={true}
        hideVideoNameTextField={true}
        fileSelector={new DefaultFileSelector(() => {})}
        onCancel={() => {}}
        onOpenSettings={() => {}}
        onConfirm={() => {}}
        onSetActiveProfile={() => {}}
        onOnlineSourceConfigChanged={() => {}}
        onDismissFtue={() => {}}
        onOpenFiles={() => {}}
        onSubtitleTracks={() => {}}
        onSelectedSubtitleTrackIds={() => {}}
        {...props}
    />
);

it('distinguishes embedded, local, downloaded and streaming choices and keeps external tracks first', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const tracks: VideoDataSubtitleTrack[] = [
        { id: '-', label: 'Empty', extension: 'srt' },
        {
            id: 'embedded:video:4',
            label: 'Embedded',
            extension: 'srt',
            embedded: {
                videoId: 'video',
                fingerprint: { name: 'video.mkv', size: 1, lastModified: 0 },
                trackIndex: 4,
                codec: 'subrip',
                format: 'srt',
            },
        },
        { id: 'local', label: 'Local', extension: 'srt', file: new File([''], 'local.srt') },
        // Downloaded outputs retain their URL IDs even when restored from the file cache.
        {
            id: 'https://example.com/subtitle.srt',
            label: 'Cached download',
            extension: 'srt',
            file: new File([''], 'online.srt'),
        },
        {
            id: 'https://example.com/download.srt',
            label: 'Download',
            extension: 'srt',
            url: 'https://example.com/download.srt',
        },
        {
            id: 'en:English:https://example.com/stream.vtt',
            label: 'Streaming',
            extension: 'vtt',
            url: 'https://example.com/stream.vtt',
        },
        {
            id: 'ja:Japanese:https://example.com/segment1.vtt,https://example.com/segment2.vtt',
            label: 'Streaming segments',
            extension: 'vtt',
            url: ['https://example.com/segment1.vtt', 'https://example.com/segment2.vtt'],
        },
    ];
    try {
        act(() => root.render(<Picker subtitleTracks={tracks} selectedSubtitleTrackIds={['local', '-', '-']} />));
        act(() => {
            document
                .querySelector('[role=combobox]')!
                .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        });
        const options = [...document.querySelectorAll('[role=option]')].slice(0, tracks.length);
        expect(options.map((option) => option.textContent)).toEqual([
            'Empty',
            'Local',
            'Cached download',
            'Download',
            'Streaming',
            'Streaming segments',
            'Embedded',
        ]);
        expect(options.map((option) => option.querySelector('svg')?.getAttribute('data-testid'))).toEqual([
            undefined,
            'DescriptionOutlinedIcon',
            'CloudOutlinedIcon',
            'CloudOutlinedIcon',
            'SubtitlesOutlinedIcon',
            'SubtitlesOutlinedIcon',
            'MovieOutlinedIcon',
        ]);
    } finally {
        act(() => root.unmount());
        container.remove();
    }
});

it.each(['srt', 'ass'])('confirms downloaded %s subtitles using their own filename and one extension', (extension) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConfirm = jest.fn<(tracks: ConfirmedVideoDataSubtitleTrack[], remember: boolean) => void>();
    const tracks: VideoDataSubtitleTrack[] = [
        {
            id: `https://example.com/download.${extension}`,
            label: `Downloaded episode.${extension}`,
            url: `https://example.com/download.${extension}`,
            extension,
        },
        {
            id: 'en:English:https://example.com/stream.vtt',
            label: 'English',
            url: 'https://example.com/stream.vtt',
            extension: 'vtt',
        },
        { id: 'local', label: 'Local display label', file: new File([], 'local.srt'), extension: 'srt' },
    ];
    try {
        act(() =>
            root.render(
                <Picker
                    suggestedName="Video.mkv"
                    subtitleTracks={tracks}
                    selectedSubtitleTrackIds={tracks.map(({ id }) => id)}
                    onConfirm={onConfirm}
                />
            )
        );
        act(() => {
            [...document.querySelectorAll('button')].find((button) => button.textContent === 'action.ok')!.click();
        });
        const confirmed = onConfirm.mock.calls[0][0];
        expect(confirmed.map(({ name, extension }) => `${name}.${extension}`)).toEqual([
            `Downloaded episode.${extension}`,
            'Video.mkv - English.vtt',
            'local.srt',
        ]);
    } finally {
        act(() => root.unmount());
        container.remove();
    }
});

it.each([0, 1, 2])('offers %i audio tracks with the appropriate default and confirms explicit choices', (count) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConfirm = jest.fn<React.ComponentProps<typeof VideoDataSyncDialog>['onConfirm']>();
    const audioTracks = Array.from({ length: count }, (_, trackIndex) => ({
        trackIndex,
        codec: 'aac',
        language: 'ja',
        title: 'Japanese',
    }));
    const props = { audioTracks, onConfirm, subtitleTracks: [{ id: '-', label: 'Empty', extension: 'srt' }] };
    const confirm = () =>
        act(() => {
            [...document.querySelectorAll('button')].find((button) => button.textContent === 'action.ok')!.click();
        });
    const openAudioOptions = () =>
        act(() => {
            document
                .querySelector('[role=combobox]')!
                .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        });
    try {
        act(() => root.render(<Picker {...props} />));
        expect(document.querySelectorAll('[role=combobox]')).toHaveLength(count ? 4 : 3);
        confirm();
        expect(onConfirm.mock.calls.at(-1)?.[2]).toBeUndefined();
        if (!count) return;
        expect(document.querySelector('hr')).not.toBeNull();
        const selectedAudioLabel = document
            .querySelector('[role=combobox]')!
            .textContent!.replace(/\u200b/g, '')
            .trim();
        if (count === 1) {
            expect(selectedAudioLabel).toContain('日本語 · AAC');
        } else {
            expect(selectedAudioLabel).toBe('settings.defaultProfile');
        }
        openAudioOptions();
        const options = [...document.querySelectorAll<HTMLElement>('[role=option]')];
        expect(options).toHaveLength(count === 1 ? 1 : 3);
        expect(options[0].getAttribute('aria-selected')).toBe('true');
        if (count === 2) expect(options[0].textContent!.trim()).toBe('settings.defaultProfile');
        act(() => options.at(-1)!.click());
        confirm();
        expect(onConfirm.mock.calls.at(-1)?.[2]).toBe(count === 1 ? undefined : 1);
        if (count === 2) {
            // Closing without committing a draft restores the currently playing choice on reopen.
            act(() => root.render(<Picker {...props} open={false} audioTrackIndex={0} />));
            act(() => root.render(<Picker {...props} audioTrackIndex={0} />));
            confirm();
            expect(onConfirm.mock.calls.at(-1)?.[2]).toBe(0);
            openAudioOptions();
            act(() => document.querySelector<HTMLElement>('[role=option]')!.click());
            confirm();
            expect(onConfirm.mock.calls.at(-1)?.[2]).toBeUndefined();
        }
    } finally {
        act(() => root.unmount());
        container.remove();
    }
});
