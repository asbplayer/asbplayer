import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import type { SubtitleOutputFormat } from '@project/ffmpeg/protocol';

export interface EmbeddedSubtitleDescriptor {
    videoId: string;
    fingerprint: Pick<File, 'name' | 'size' | 'lastModified'>;
    /** Zero-based position among subtitle tracks, including unsupported codecs. */
    trackIndex: number;
    codec: string;
    /** Requested output representation; probe outputFormat separately indicates support. */
    format: SubtitleOutputFormat;
}

export interface SubtitleExtractionOptions {
    file: File;
    fileId: string;
    /** Zero-based positions among subtitle tracks, including unsupported codecs. */
    trackIndexes: number[];
    signal: AbortSignal;
    /** Arbitrary byte chunks in the selected output format; consumers must buffer incomplete records. */
    onChunk: (trackIndex: number, chunk: ArrayBuffer) => void;
}

export interface ExtractedSubtitleFile {
    trackIndex: number;
    blob: Blob;
    format: SubtitleOutputFormat;
}

/** Shared code requests subtitle data; the website supplies the FFmpeg implementation. */
export interface SubtitleHost {
    extractSubtitles(options: SubtitleExtractionOptions): Promise<ExtractedSubtitleFile[]>;
}

export const subtitleSourceMatches = (source: FileWithId, descriptor: EmbeddedSubtitleDescriptor) =>
    source.id === descriptor.videoId &&
    source.file.name === descriptor.fingerprint.name &&
    source.file.size === descriptor.fingerprint.size &&
    source.file.lastModified === descriptor.fingerprint.lastModified;

export const embeddedSubtitleId = (videoId: string, trackIndex: number) => `embedded:${videoId}:${trackIndex}`;

export const embeddedDescriptor = (source: FileWithId, track: EmbeddedSubtitleTrack): EmbeddedSubtitleDescriptor => ({
    videoId: source.id,
    fingerprint: { name: source.file.name, size: source.file.size, lastModified: source.file.lastModified },
    trackIndex: track.trackIndex,
    codec: track.codec,
    format: track.outputFormat ?? 'srt',
});
