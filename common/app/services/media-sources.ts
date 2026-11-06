import { v4 as uuidv4 } from 'uuid';
import type { LoadableSubtitleTrack, SerializedSubtitleFile } from '@project/common';
import { base64ToBlob } from '@project/common/base64';
import type { FileWithId } from '@project/common/file-selector';
import { LocalizedError } from '@project/common/app/components/localized-error';

/** A selected media source. Omitted track indexes assign each subtitle file its own track. */
export type MediaSourceFile = FileWithId & { track?: number };

/** A complete subtitle file or a fragment, assigned to one subtitle track. */
export type SubtitleSourceFile = FileWithId & { track: number };

export const videoExtensions = ['.mkv', '.mp4', '.m4v', '.avi', '.webm'] as const;
export const audioExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.ogg', '.wav', '.opus', '.m4b'] as const;
export const subtitleExtensions = [
    '.srt',
    '.ass',
    '.vtt',
    '.sup',
    '.nfvtt',
    '.nfimsc',
    '.ytxml',
    '.ytsrv3',
    '.dfxp',
    '.ttml2',
    '.bbjson',
] as const;

export const VIDEO_EXT_SET = new Set<string>(videoExtensions);
export const AUDIO_EXT_SET = new Set<string>(audioExtensions);
export const SUBTITLE_EXT_SET = new Set<string>(subtitleExtensions);

export const getExtension = (fileName: string) => {
    const index = fileName.lastIndexOf('.');
    return index === -1 ? '' : fileName.substring(index).toLowerCase();
};

/** Replace the instance when sources change; derived arrays stay stable between renders. */
export class MediaSources {
    readonly subtitleSourceFiles: SubtitleSourceFile[];
    readonly firstSubtitleSourceFiles: SubtitleSourceFile[];
    readonly subtitleFileNames: string[];
    readonly allSourceFiles: FileWithId[];

    constructor(
        readonly subtitleTracks: LoadableSubtitleTrack<SubtitleSourceFile>[] = [],
        readonly videoFile?: FileWithId,
        readonly videoFileUrl?: string
    ) {
        this.subtitleSourceFiles = subtitleTracks.flatMap(({ fileParts }) => fileParts);
        this.firstSubtitleSourceFiles = subtitleTracks.flatMap(({ fileParts }) => fileParts.slice(0, 1));
        this.subtitleFileNames = subtitleTracks.map(({ fileParts }) => fileParts[0]?.file.name ?? '');
        this.allSourceFiles = videoFile ? [...this.subtitleSourceFiles, videoFile] : this.subtitleSourceFiles;
    }

    static fromFiles(files: MediaSourceFile[]): MediaSources {
        const subtitleSourceFiles: SubtitleSourceFile[] = [];
        let videoFile: FileWithId | undefined;

        for (const selectedFile of files) {
            const extension = getExtension(selectedFile.file.name);

            if (extension === '') {
                throw new LocalizedError('error.unknownExtension', { fileName: selectedFile.file.name });
            }

            if (SUBTITLE_EXT_SET.has(extension)) {
                subtitleSourceFiles.push({ ...selectedFile, track: selectedFile.track ?? subtitleSourceFiles.length });
            } else if (VIDEO_EXT_SET.has(extension)) {
                if (videoFile) throw new LocalizedError('error.onlyOneVideoFile');
                videoFile = selectedFile;
            } else if (AUDIO_EXT_SET.has(extension)) {
                if (videoFile) throw new LocalizedError('error.onlyOneAudioFile');
                videoFile = selectedFile;
            } else {
                throw new LocalizedError('error.unsupportedExtension', { extension: extension.substring(1) });
            }
        }

        const subtitleTracks: LoadableSubtitleTrack<SubtitleSourceFile>[] = [];
        for (const subtitleSourceFile of subtitleSourceFiles) {
            const { track } = subtitleSourceFile;
            if (!Number.isInteger(track) || track < 0 || track >= subtitleSourceFiles.length) {
                throw new Error('Invalid subtitle track index');
            }
            while (subtitleTracks.length <= track) subtitleTracks.push({ fileParts: [] });
            subtitleTracks[track].fileParts.push(subtitleSourceFile);
        }

        return new MediaSources(subtitleTracks, videoFile);
    }

    hasSubtitleFile(name: string): boolean {
        return name.length > 0 && this.subtitleFileNames.includes(name);
    }

    findSubtitleTrack(firstFilePart: FileWithId): LoadableSubtitleTrack<SubtitleSourceFile> | undefined {
        return this.subtitleTracks.find(({ fileParts }) => {
            const first = fileParts[0];
            return first?.id === firstFilePart.id && first.file === firstFilePart.file;
        });
    }
}

/** Decodes complete subtitle files or fragments, accepting legacy messages without track indexes. */
export const decodeSubtitleSourceFiles = (
    serializedSourceFiles: SerializedSubtitleFile[],
    flatten = false
): SubtitleSourceFile[] =>
    serializedSourceFiles.map(({ name, base64, track }, index) => {
        const trackIndex = track ?? (flatten ? 0 : index);
        if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= serializedSourceFiles.length) {
            throw new Error('Invalid subtitle track index');
        }
        return {
            file: new File([base64ToBlob(base64, 'text/plain')], name),
            id: uuidv4(),
            track: trackIndex,
        };
    });
