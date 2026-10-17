import type { VideoDataSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';

const minimumTrackCount = 3;

// Mirror subtitles loaded outside the track selector (drag and drop, file picker, restored session)
// so the selector opens with them selected, in load order.
export function mirrorLoadedSubtitles(tracks: VideoDataSubtitleTrack[], loaded: FileWithId[]) {
    const newTracks = loaded
        .filter(({ id }) => !tracks.some((track) => track.id === id))
        .map(({ file, id }) => ({
            label: file.name,
            id,
            file,
            extension: file.name.substring(file.name.lastIndexOf('.') + 1),
        }));
    return {
        tracks: newTracks.length === 0 ? tracks : [...tracks, ...newTracks],
        selectedTrackIds: Array.from(
            { length: Math.max(minimumTrackCount, loaded.length) },
            (_, i) => loaded[i]?.id ?? '-'
        ),
    };
}
