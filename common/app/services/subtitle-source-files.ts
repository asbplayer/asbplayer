import { v4 as uuidv4 } from 'uuid';
import type { LoadableSubtitleTrack, SerializedSubtitleFile, SubtitleFile } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import { base64ToBlob } from '@project/common/base64';

/** Serialized sources can be complete subtitle files or individual fragments. */
export const decodeSubtitleSourceFiles = (serializedSourceFiles: SubtitleFile[]): FileWithId[] =>
    serializedSourceFiles.map(({ name, base64 }) => ({
        file: new File([base64ToBlob(base64, 'text/plain')], name),
        id: uuidv4(),
    }));

/** Reconstructs track groups, accepting legacy messages without per-file track indexes. */
export const decodeSubtitleTracks = (
    serializedSourceFiles: SerializedSubtitleFile[],
    flatten = false
): LoadableSubtitleTrack<FileWithId>[] => {
    const subtitleSourceFiles = decodeSubtitleSourceFiles(serializedSourceFiles);
    const subtitleTracks: LoadableSubtitleTrack<FileWithId>[] = [];
    for (const [index, subtitleSourceFile] of subtitleSourceFiles.entries()) {
        const track = serializedSourceFiles[index].track ?? (flatten ? 0 : index);
        if (!Number.isInteger(track) || track < 0 || track >= subtitleSourceFiles.length) {
            throw new Error('Invalid subtitle track index');
        }
        while (subtitleTracks.length <= track) subtitleTracks.push({ fileParts: [] });
        subtitleTracks[track].fileParts.push(subtitleSourceFile);
    }
    return subtitleTracks;
};
