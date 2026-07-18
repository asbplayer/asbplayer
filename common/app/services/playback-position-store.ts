const storageKey = 'playbackPositions';
const maxPlaybackPositions = 50;

export interface PlaybackPositionRecord {
    fileName: string;
    position: number;
}

export function upsertPlaybackPosition(
    positions: PlaybackPositionRecord[],
    record: PlaybackPositionRecord
): PlaybackPositionRecord[] {
    const next = [record, ...positions.filter((p) => p.fileName !== record.fileName)].slice(0, maxPlaybackPositions);

    try {
        localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
        console.error(e);
    }

    return next;
}

export function loadPlaybackPositions(): PlaybackPositionRecord[] {
    try {
        const raw = localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as PlaybackPositionRecord[]) : [];
    } catch (e) {
        console.error(e);
        return [];
    }
}
