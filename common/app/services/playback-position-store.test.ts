import { PlaybackPositionRecord, upsertPlaybackPosition } from './playback-position-store';

const record = (fileName: string, position: number): PlaybackPositionRecord => ({
    fileName,
    position,
});

it('prepends a new record', () => {
    const positions = [record('a.mp4', 1000)];
    const result = upsertPlaybackPosition(positions, record('b.mp4', 2000));
    expect(result).toEqual([record('b.mp4', 2000), record('a.mp4', 1000)]);
});

it('overwrites an existing record with the same file name', () => {
    const positions = [record('a.mp4', 1000), record('b.mp4', 2000)];
    const result = upsertPlaybackPosition(positions, record('a.mp4', 5000));
    expect(result).toEqual([record('a.mp4', 5000), record('b.mp4', 2000)]);
});

it('caps the list at 50 entries', () => {
    const positions = Array.from({ length: 50 }, (_, i) => record(`${i}.mp4`, i));
    const result = upsertPlaybackPosition(positions, record('new.mp4', 100));
    expect(result).toHaveLength(50);
    expect(result[0]).toEqual(record('new.mp4', 100));
    expect(result.find((p) => p.fileName === '49.mp4')).toBeUndefined();
});
