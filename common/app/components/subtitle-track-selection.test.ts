import { mirrorLoadedSubtitles } from '@project/common/app/components/subtitle-track-selection';
import { expect, it } from '@jest/globals';

const emptyTrack = { id: '-', language: '-', url: '-', label: 'Empty', extension: 'srt' };
const subtitle = (id: string, name: string) => ({ id, file: new File(['1'], name) });

it('adds loaded subtitles as tracks and selects them in load order', () => {
    const ja = subtitle('ja', 'Episode 1.ja.srt');
    const en = subtitle('en', 'Episode 1.en.ass');

    const { tracks, selectedTrackIds } = mirrorLoadedSubtitles([emptyTrack], [ja, en]);

    expect(tracks).toEqual([
        emptyTrack,
        { id: 'ja', label: 'Episode 1.ja.srt', file: ja.file, extension: 'srt' },
        { id: 'en', label: 'Episode 1.en.ass', file: en.file, extension: 'ass' },
    ]);
    expect(selectedTrackIds).toEqual(['ja', 'en', '-']);
});

it('does not duplicate tracks the selector already has', () => {
    const ja = subtitle('ja', 'Episode 1.ja.srt');
    const existing = [emptyTrack, { id: 'ja', label: 'Episode 1.ja.srt', file: ja.file, extension: 'srt' }];

    const { tracks, selectedTrackIds } = mirrorLoadedSubtitles(existing, [ja]);

    expect(tracks).toBe(existing);
    expect(selectedTrackIds).toEqual(['ja', '-', '-']);
});

it('selects every loaded subtitle when there are more than three', () => {
    const loaded = ['a', 'b', 'c', 'd'].map((id) => subtitle(id, `${id}.srt`));

    expect(mirrorLoadedSubtitles([emptyTrack], loaded).selectedTrackIds).toEqual(['a', 'b', 'c', 'd']);
});
