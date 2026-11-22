import { v4 as uuidv4 } from 'uuid';
import type {
    ConfirmedVideoDataSubtitleTrack,
    LegacyPlayerSyncMessage,
    PlayerSyncMessage,
    LoadableSubtitleTrack,
    SerializedSubtitleFile,
    IndexedSubtitleModel,
} from '@project/common';
import { subtitleSourceNames, subtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { base64ToBlob } from '@project/common/base64';
import type { FileWithId } from '@project/common/file-selector';
import { LocalizedError } from '@project/common/app/components/localized-error';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';
import { subtitleSourceMatches } from '@project/common/embedded-subtitles/subtitle-source';

/** A selected media source. Omitted track indexes assign each subtitle file its own track. */
export type MediaSourceFile = FileWithId & { track?: number };

/** A complete subtitle file or a fragment, assigned to one subtitle track. */
export type SubtitleSourceFile = FileWithId & { track: number };

type MediaSubtitleSource =
    | {
          readonly kind: 'files';
          readonly tracks: LoadableSubtitleTrack<SubtitleSourceFile>[];
          /** The selected files include embedded placeholders. Export waits for their extracted contents. */
          readonly pendingEmbedded: boolean;
      }
    | { readonly kind: 'remote'; readonly names: string[]; readonly status: SubtitleSourceStatus };

export const videoExtensions = ['.mkv', '.mp4', '.m4v', '.avi', '.webm'] as const;
export const audioExtensions = ['.mp3', '.m4a', '.aac', '.flac', '.ogg', '.wav', '.opus', '.m4b'] as const;
export const subtitleExtensions = [
    '.srt',
    '.ass',
    '.vtt',
    '.sup',
    `.${ffmpegSubtitleFormats.image.extension}`,
    '.nfvtt',
    '.nfimsc',
    '.ytxml',
    '.ytsrv3',
    '.dfxp',
    '.ttml2',
    '.bbjson',
] as const;

export const VIDEO_EXT_SET: ReadonlySet<string> = new Set(videoExtensions);
export const AUDIO_EXT_SET: ReadonlySet<string> = new Set(audioExtensions);
export const SUBTITLE_EXT_SET: ReadonlySet<string> = new Set(subtitleExtensions);

export const getExtension = (fileName: string) => {
    const index = fileName.lastIndexOf('.');
    return index === -1 ? '' : fileName.substring(index).toLowerCase();
};

/** Replace the instance when sources change; derived arrays stay stable between renders. */
export class MediaSources {
    readonly subtitleTracks: LoadableSubtitleTrack<SubtitleSourceFile>[];
    readonly subtitleSourceFiles: SubtitleSourceFile[];
    readonly firstSubtitleSourceFiles: (SubtitleSourceFile | undefined)[];
    readonly subtitleFileNames: string[];
    readonly allSourceFiles: FileWithId[];

    constructor(
        readonly subtitleSource: MediaSubtitleSource = { kind: 'files', tracks: [], pendingEmbedded: false },
        readonly videoFile?: FileWithId,
        readonly videoFileUrl?: string,
        readonly audioTrackIndex?: number
    ) {
        this.subtitleTracks = subtitleSource.kind === 'files' ? subtitleSource.tracks : [];
        this.subtitleSourceFiles = this.subtitleTracks.flatMap(({ fileParts }) => fileParts);
        this.firstSubtitleSourceFiles = this.subtitleTracks.map(({ fileParts }) => fileParts[0]);
        this.subtitleFileNames =
            subtitleSource.kind === 'remote'
                ? subtitleSource.names
                : this.subtitleTracks.map(({ fileParts }) => fileParts[0]?.file.name ?? '');
        this.allSourceFiles = videoFile ? [...this.subtitleSourceFiles, videoFile] : this.subtitleSourceFiles;
    }

    /** Merge incoming sources with the current state, preserving unchanged media and external subtitles on video-only loads. */
    merge(
        incoming: MediaSources,
        createVideoUrl: (file: File) => string,
        pendingTrackIndexes: ReadonlySet<number>,
        { applyAudioSelection = false }: { applyAudioSelection?: boolean } = {}
    ): {
        sources: MediaSources;
        newVideo: boolean;
        revokedVideoUrl?: string;
        loadingSources: FileWithId[];
        resetJumpToSubtitle: boolean;
    } {
        const remoteSubtitles = incoming.subtitleSource.kind === 'remote';
        const resetJumpToSubtitle = Boolean(remoteSubtitles || incoming.videoFile || incoming.subtitleFileNames.length);
        const newVideo = Boolean(incoming.videoFile && incoming.videoFile.file !== this.videoFile?.file);

        let videoFile = this.videoFile;
        let videoFileUrl = this.videoFileUrl;
        let revokedVideoUrl: string | undefined;

        if (newVideo && incoming.videoFile) {
            videoFile = incoming.videoFile;
            videoFileUrl = createVideoUrl(videoFile.file);
            revokedVideoUrl = this.videoFileUrl;
        } else if (!incoming.videoFile && remoteSubtitles) {
            videoFile = undefined;
            videoFileUrl = undefined;
            revokedVideoUrl = this.videoFileUrl;
        }

        // A video-only selection retains file-backed subtitles, while a new video drops embedded tracks
        // and a same-video reload drops still-pending embedded tracks whose extraction is cancelled.
        let subtitleSource = incoming.subtitleSource;
        if (incoming.videoFile && !incoming.subtitleSourceFiles.length && this.subtitleSource.kind === 'files') {
            if (newVideo) {
                const tracks = this.subtitleTracks.map(({ fileParts }) => ({
                    fileParts: fileParts.filter((file) => !file.embedded),
                }));
                subtitleSource = {
                    kind: 'files',
                    pendingEmbedded: false,
                    tracks: tracks.some(({ fileParts }) => fileParts.some(({ id }) => id !== '-')) ? tracks : [],
                };
            } else if (this.subtitleSource.pendingEmbedded) {
                const tracks = this.subtitleTracks.map(({ fileParts }) => ({
                    fileParts: fileParts.filter(
                        (file) => !file.embedded || !pendingTrackIndexes.has(file.embedded.trackIndex)
                    ),
                }));
                subtitleSource = {
                    kind: 'files',
                    pendingEmbedded: false,
                    tracks: tracks.some(({ fileParts }) => fileParts.some(({ id }) => id !== '-')) ? tracks : [],
                };
            } else {
                subtitleSource = this.subtitleSource;
            }
        }

        const audioTrackIndex = !videoFile
            ? undefined
            : newVideo || applyAudioSelection
              ? incoming.audioTrackIndex
              : this.audioTrackIndex;
        const sources = new MediaSources(subtitleSource, videoFile, videoFileUrl, audioTrackIndex);
        const loadingSources = sources.allSourceFiles.filter(
            (source) => !this.allSourceFiles.some((previous) => source.file === previous.file)
        );
        return { sources, newVideo, revokedVideoUrl, loadingSources, resetJumpToSubtitle };
    }

    /** Keep completed subtitles for standalone playback when their video is unloaded. */
    withoutVideo(pendingTrackIndexes: ReadonlySet<number>): MediaSources {
        const source = this.subtitleSource;
        if (source.kind !== 'files') return new MediaSources(source);
        if (!source.pendingEmbedded && !this.subtitleSourceFiles.some(({ embedded }) => embedded)) {
            if (!this.subtitleSourceFiles.some(({ id }) => id !== '-')) return new MediaSources();
            return new MediaSources(source);
        }
        const tracks = source.tracks.map(({ fileParts }) => ({
            fileParts: fileParts.flatMap((filePart) => {
                const { embedded, ...file } = filePart;
                if (!embedded) return [filePart];
                if (source.pendingEmbedded && pendingTrackIndexes.has(embedded.trackIndex)) return [];
                return [file];
            }),
        }));
        if (!tracks.some(({ fileParts }) => fileParts.some(({ id }) => id !== '-'))) return new MediaSources();
        return new MediaSources({ kind: 'files', pendingEmbedded: false, tracks });
    }

    static fromFiles(files: MediaSourceFile[], { pendingEmbedded }: { pendingEmbedded: boolean }): MediaSources {
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

        return new MediaSources({ kind: 'files', tracks: subtitleTracks, pendingEmbedded }, videoFile);
    }

    static fromSync(message: LegacyPlayerSyncMessage | PlayerSyncMessage): MediaSources {
        if (message.command === 'sync') {
            return MediaSources.fromFiles(decodeSubtitleSourceFiles([message.subtitles]), { pendingEmbedded: false });
        }
        if (message.subtitleSource) {
            return new MediaSources({
                kind: 'remote',
                names: subtitleSourceNames(message.subtitleSource.tracks),
                status: subtitleSourceStatus(message.subtitleSource.tracks),
            });
        }
        return MediaSources.fromFiles(decodeSubtitleSourceFiles(message.subtitles, message.flatten), {
            pendingEmbedded: false,
        });
    }

    get canDownloadSubtitles(): boolean {
        if (this.subtitleSource.kind === 'remote') {
            return (
                this.subtitleSource.status === 'complete' &&
                this.subtitleFileNames.some((name) => name.length > 0 && getExtension(name) !== '.sup')
            );
        }
        return (
            !this.subtitleSource.pendingEmbedded &&
            this.subtitleTracks.some(({ fileParts }) =>
                fileParts.some(
                    ({ id, file }) =>
                        id !== '-' && file.size > 0 && file.name.length > 0 && getExtension(file.name) !== '.sup'
                )
            )
        );
    }

    /** Exports completed remote text tracks with cues, or reparses files using the current parsing settings. */
    async subtitleTracksForExport(
        reader: Pick<SubtitleReader, 'subtitles'>,
        subtitles: readonly IndexedSubtitleModel[]
    ) {
        if (!this.canDownloadSubtitles) return [];
        if (this.subtitleSource.kind === 'remote') {
            return this.subtitleFileNames.flatMap((name, track) => {
                if (name.length === 0 || getExtension(name) === '.sup') return [];
                const cues = subtitles
                    .filter((cue) => cue.track === track && cue.textImage === undefined)
                    .map((cue) => ({
                        track,
                        text: cue.originalText ?? cue.text,
                        start: cue.originalStart,
                        end: cue.originalEnd,
                    }));
                return cues.length === 0 ? [] : [{ track, name, subtitles: cues }];
            });
        }
        const sourceTracks = this.subtitleTracks.map(({ fileParts }) => ({
            fileParts: fileParts
                .map(({ file }) => file)
                .filter((file) => file.size > 0 && getExtension(file.name) !== '.sup'),
        }));
        const parsed = await reader.subtitles(sourceTracks);
        return sourceTracks.flatMap(({ fileParts }, track) =>
            fileParts.length === 0
                ? []
                : [{ track, name: fileParts[0].name, subtitles: parsed.filter((cue) => cue.track === track) }]
        );
    }

    hasSubtitleFile(name: string): boolean {
        return name.length > 0 && this.subtitleFileNames.includes(name);
    }

    withAudioTrackIndex(audioTrackIndex: number | undefined): MediaSources {
        return audioTrackIndex === this.audioTrackIndex
            ? this
            : new MediaSources(this.subtitleSource, this.videoFile, this.videoFileUrl, audioTrackIndex);
    }

    /** Picker slots identify a whole track by its first part. Unfilled trailing slots have no source. */
    matchesSubtitleSelection(tracks: readonly ConfirmedVideoDataSubtitleTrack[]): boolean {
        if (this.subtitleSource.kind !== 'files') return false;
        const count = Math.max(tracks.length, this.subtitleTracks.length);
        for (let index = 0; index < count; index++) {
            const selected = tracks[index];
            const parts = this.subtitleTracks[index]?.fileParts;
            const first = parts?.[0];
            if ((!selected || selected.id === '-') && !parts?.some((part) => part.id !== '-')) continue;
            if (!selected || selected.id === '-' || !first || selected.disabledReason || selected.id !== first.id) {
                return false;
            }
            if (selected.embedded) {
                const previous = first.embedded;
                if (
                    !this.videoFile ||
                    !previous ||
                    !subtitleSourceMatches(this.videoFile, selected.embedded) ||
                    !subtitleSourceMatches(this.videoFile, previous) ||
                    selected.embedded.trackIndex !== previous.trackIndex ||
                    selected.embedded.codec !== previous.codec ||
                    selected.embedded.format !== previous.format
                ) {
                    return false;
                }
            } else if (first.embedded || selected.file !== first.file) {
                return false;
            }
        }
        return true;
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
