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
    return [record, ...positions.filter((p) => p.fileName !== record.fileName)].slice(0, maxPlaybackPositions);
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

export function savePlaybackPositions(positions: PlaybackPositionRecord[]) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(positions));
    } catch (e) {
        console.error(e);
    }
}
