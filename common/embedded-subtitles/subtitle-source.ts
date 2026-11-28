import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import type { SubtitleOutputFormat } from '@project/ffmpeg/protocol';

export interface EmbeddedSubtitleDescriptor {
    videoId: string;
    fingerprint: Pick<File, 'name' | 'size' | 'lastModified'>;
    /** Zero-based position among subtitle tracks, including unsupported codecs. */
    trackIndex: number;
    codec: string;
    /** Requested output representation. Probe outputFormat separately indicates support. */
    format: SubtitleOutputFormat;
}

export interface SubtitleExtractionOptions {
    file: File;
    fileId: string;
    /** MP4 track IDs or zero-based Matroska subtitle ordinals. */
    trackKeys: number[];
    signal: AbortSignal;
    /** Arbitrary byte chunks in the selected output format. Consumers must buffer incomplete records. */
    onChunk: (trackKey: number, chunk: ArrayBuffer) => void;
}

export interface ExtractedSubtitleFile {
    trackKey: number;
    blob: Blob;
    format: SubtitleOutputFormat;
}

/** Shared code requests subtitle data, and the website supplies the FFmpeg implementation. */
export interface SubtitleHost {
    extractSubtitles(options: SubtitleExtractionOptions): Promise<ExtractedSubtitleFile[]>;
}

export const subtitleSourceMatches = (source: FileWithId, descriptor: EmbeddedSubtitleDescriptor) =>
    source.id === descriptor.videoId &&
    source.file.name === descriptor.fingerprint.name &&
    source.file.size === descriptor.fingerprint.size &&
    source.file.lastModified === descriptor.fingerprint.lastModified;

export const embeddedSubtitleId = (videoId: string, trackIndex: number) => `embedded:${videoId}:${trackIndex}`;

export const embeddedDescriptor = (
    source: FileWithId,
    track: Pick<EmbeddedSubtitleTrack, 'trackIndex' | 'codec' | 'outputFormat'>
): EmbeddedSubtitleDescriptor => ({
    videoId: source.id,
    fingerprint: { name: source.file.name, size: source.file.size, lastModified: source.file.lastModified },
    trackIndex: track.trackIndex,
    codec: track.codec,
    format: track.outputFormat ?? 'srt',
});
