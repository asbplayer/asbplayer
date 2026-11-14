import { probeSubtitleTracks } from '@project/common/media-probe/subtitle-probe';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleDescriptor, SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleId, subtitleSourceMatches } from '@project/common/embedded-subtitles/subtitle-source';

const fileExtensionRegex = /\.[^.]+$/;
const invalidLanguageSuffixCharactersRegex = /[^\p{L}\p{N}_-]/gu;

/** The player's single producer owns extraction; completed catalogs and output Files survive its worker. */
export class EmbeddedSubtitles {
    private readonly catalogs = new Map<File, EmbeddedSubtitleTrack[]>();
    private readonly outputs = new Map<File, Map<number, FileWithId>>();

    constructor(private readonly host: SubtitleHost) {}

    retain(sources: FileWithId[]) {
        const files = new Set(sources.map((source) => source.file));
        for (const file of this.catalogs.keys()) if (!files.has(file)) this.catalogs.delete(file);
        for (const file of this.outputs.keys()) if (!files.has(file)) this.outputs.delete(file);
    }

    completedFile(source: FileWithId, trackIndex: number): FileWithId | undefined {
        const file = this.outputs.get(source.file)?.get(trackIndex);
        return file?.embedded?.videoId === source.id ? file : undefined;
    }

    /** Register only completed session files, including valid empty outputs; never pending placeholders. */
    restoreCompleted(source: FileWithId, files: FileWithId[]) {
        const previous = this.outputs.get(source.file);
        const cached =
            previous && [...previous.values()].every((file) => file.embedded?.videoId === source.id)
                ? previous
                : new Map<number, FileWithId>();
        for (const file of files) {
            const descriptor = file.embedded;
            if (
                descriptor &&
                subtitleSourceMatches(source, descriptor) &&
                descriptor.format === 'srt' &&
                file.id === embeddedSubtitleId(source.id, descriptor.trackIndex)
            ) {
                cached.set(descriptor.trackIndex, file);
            }
        }
        this.outputs.set(source.file, cached);
    }

    async discover(source: FileWithId, signal: AbortSignal): Promise<EmbeddedSubtitleTrack[]> {
        signal.throwIfAborted();
        const cached = this.catalogs.get(source.file);
        if (cached !== undefined) return cached;
        const tracks = await probeSubtitleTracks(source.file, signal);
        signal.throwIfAborted();
        this.catalogs.set(source.file, tracks);
        return tracks;
    }

    /** Names and provenance for selection; uncached entries contain no output and must not be persisted yet. */
    async prepare(
        source: FileWithId,
        descriptors: EmbeddedSubtitleDescriptor[],
        signal: AbortSignal
    ): Promise<Map<string, FileWithId>> {
        signal.throwIfAborted();
        if (descriptors.length === 0) return new Map();
        if (descriptors.some((d) => !subtitleSourceMatches(source, d) || d.format !== 'srt')) {
            throw new Error('The embedded subtitle source has changed');
        }
        const tracks = await this.discover(source, signal);
        signal.throwIfAborted();
        for (const descriptor of descriptors) {
            if (
                !tracks.some(
                    (track) =>
                        track.trackIndex === descriptor.trackIndex &&
                        track.outputFormat === descriptor.format &&
                        track.codec === descriptor.codec
                )
            ) {
                throw new Error('The embedded subtitle track is unavailable');
            }
        }
        return new Map(
            descriptors.map((descriptor) => {
                const id = embeddedSubtitleId(source.id, descriptor.trackIndex);
                const existing = this.completedFile(source, descriptor.trackIndex);
                if (existing) return [id, existing];
                const language = tracks[descriptor.trackIndex].language;
                const suffix = language?.replace(invalidLanguageSuffixCharactersRegex, '').slice(0, 30);
                const base = source.file.name.replace(fileExtensionRegex, '');
                return [
                    id,
                    {
                        id,
                        embedded: descriptor,
                        file: new File(
                            [],
                            `${base}.track-${descriptor.trackIndex + 1}${suffix ? '.' + suffix : ''}.srt`,
                            {
                                type: 'application/x-subrip',
                            }
                        ),
                    },
                ];
            })
        );
    }

    async extract(
        source: FileWithId,
        descriptors: EmbeddedSubtitleDescriptor[],
        signal: AbortSignal,
        onChunk: (trackIndex: number, chunk: ArrayBuffer) => void
    ): Promise<Map<string, FileWithId>> {
        const prepared = await this.prepare(source, descriptors, signal);
        const previous = this.outputs.get(source.file);
        const cached =
            previous && [...previous.values()].every((file) => file.embedded?.videoId === source.id)
                ? previous
                : new Map<number, FileWithId>();
        const trackIndexes = [...new Set(descriptors.map((d) => d.trackIndex))];
        const missingTrackIndexes = trackIndexes.filter((trackIndex) => !cached.has(trackIndex));
        for (const trackIndex of trackIndexes) {
            const file = cached.get(trackIndex);
            if (file) {
                const bytes = await file.file.arrayBuffer();
                signal.throwIfAborted();
                onChunk(trackIndex, bytes);
            }
        }
        if (missingTrackIndexes.length > 0) {
            signal.throwIfAborted();
            const results = await this.host.extractSubtitles({
                file: source.file,
                fileId: source.id,
                trackIndexes: missingTrackIndexes,
                signal,
                onChunk,
            });
            signal.throwIfAborted();
            if (
                results.length !== missingTrackIndexes.length ||
                new Set(results.map((result) => result.trackIndex)).size !== missingTrackIndexes.length
            ) {
                throw new Error('Incomplete embedded subtitle output');
            }
            const completed = results.map((result): FileWithId => {
                const descriptor = descriptors.find((d) => d.trackIndex === result.trackIndex);
                if (
                    !missingTrackIndexes.includes(result.trackIndex) ||
                    !descriptor ||
                    result.format !== descriptor.format
                ) {
                    throw new Error('Unexpected subtitle output format');
                }
                const original = prepared.get(embeddedSubtitleId(source.id, result.trackIndex))!;
                return {
                    ...original,
                    file: new File([result.blob], original.file.name, { type: result.blob.type }),
                };
            });
            for (const file of completed) cached.set(file.embedded!.trackIndex, file);
            this.outputs.set(source.file, cached);
        }
        return new Map(
            trackIndexes.map((trackIndex) => {
                const file = cached.get(trackIndex)!;
                return [file.id, file];
            })
        );
    }
}
