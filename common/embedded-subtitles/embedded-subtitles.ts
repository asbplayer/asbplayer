import { probeSubtitleTracks } from '@project/common/media-probe/subtitle-probe';
import type { EmbeddedSubtitleTrack } from '@project/common/media-probe/subtitle-probe';
import type { FileWithId } from '@project/common/file-selector';
import type { EmbeddedSubtitleDescriptor, SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleId, subtitleSourceMatches } from '@project/common/embedded-subtitles/subtitle-source';
import { mimeTypeForSubtitleFormat, subtitleOutputFormats } from '@project/ffmpeg/protocol';

const fileExtensionRegex = /\.[^.]+$/;
const invalidLanguageSuffixCharactersRegex = /[^\p{L}\p{N}_-]/gu;
const maxLanguageSuffixLength = 30;

/** The player's single producer owns extraction. Completed catalogs and output Files survive its worker. */
export class EmbeddedSubtitles {
    private readonly catalogsByFile = new Map<File, readonly EmbeddedSubtitleTrack[]>();
    private readonly outputsByFile = new Map<File, Map<number, FileWithId>>();

    constructor(private readonly host: SubtitleHost) {}

    retain(sources: readonly FileWithId[]) {
        const files = new Set(sources.map((source) => source.file));
        for (const file of this.catalogsByFile.keys()) {
            if (!files.has(file)) this.catalogsByFile.delete(file);
        }
        for (const file of this.outputsByFile.keys()) {
            if (!files.has(file)) this.outputsByFile.delete(file);
        }
    }

    discoveredTracks(source: FileWithId): readonly EmbeddedSubtitleTrack[] | undefined {
        return this.catalogsByFile.get(source.file);
    }

    completedFile(source: FileWithId, trackIndex: number): FileWithId | undefined {
        const file = this.outputsByFile.get(source.file)?.get(trackIndex);
        return file?.embedded?.videoId === source.id ? file : undefined;
    }

    /** Register only completed session files, including valid empty outputs, and never pending placeholders. */
    restoreCompleted(source: FileWithId, files: readonly FileWithId[]) {
        const previous = this.outputsByFile.get(source.file);
        const cached =
            previous && [...previous.values()].every((file) => file.embedded?.videoId === source.id)
                ? previous
                : new Map<number, FileWithId>();
        for (const file of files) {
            const descriptor = file.embedded;
            if (
                descriptor &&
                subtitleSourceMatches(source, descriptor) &&
                subtitleOutputFormats.has(descriptor.format) &&
                file.id === embeddedSubtitleId(source.id, descriptor.trackIndex)
            ) {
                cached.set(descriptor.trackIndex, file);
            }
        }
        this.outputsByFile.set(source.file, cached);
    }

    async discover(source: FileWithId, signal: AbortSignal): Promise<readonly EmbeddedSubtitleTrack[]> {
        signal.throwIfAborted();
        const cached = this.catalogsByFile.get(source.file);
        if (cached) return cached;
        const tracks = await probeSubtitleTracks(source.file, signal);
        signal.throwIfAborted();
        this.catalogsByFile.set(source.file, tracks);
        return tracks;
    }

    /** Names and provenance for selection. Uncached entries contain no output and must not be persisted yet. */
    async prepare(
        source: FileWithId,
        descriptors: readonly EmbeddedSubtitleDescriptor[],
        signal: AbortSignal
    ): Promise<Map<string, FileWithId>> {
        signal.throwIfAborted();
        if (!descriptors.length) return new Map();
        if (descriptors.some((d) => !subtitleSourceMatches(source, d))) {
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
                const suffix = language
                    ?.replace(invalidLanguageSuffixCharactersRegex, '')
                    .slice(0, maxLanguageSuffixLength);
                const base = source.file.name.replace(fileExtensionRegex, '');
                return [
                    id,
                    {
                        id,
                        embedded: descriptor,
                        file: new File(
                            [],
                            `${base}.track-${descriptor.trackIndex + 1}${suffix ? '.' + suffix : ''}.${descriptor.format}`,
                            {
                                type: mimeTypeForSubtitleFormat(descriptor.format),
                            }
                        ),
                    },
                ];
            })
        );
    }

    async extract(
        source: FileWithId,
        descriptors: readonly EmbeddedSubtitleDescriptor[],
        signal: AbortSignal,
        onChunk: (trackIndex: number, chunk: ArrayBuffer) => void
    ): Promise<Map<string, FileWithId>> {
        const prepared = await this.prepare(source, descriptors, signal);
        const previous = this.outputsByFile.get(source.file);
        const cached =
            previous && [...previous.values()].every((file) => file.embedded?.videoId === source.id)
                ? previous
                : new Map<number, FileWithId>();
        const selected = [...new Map(descriptors.map((descriptor) => [descriptor.trackIndex, descriptor])).values()];
        const missing = selected.filter(({ trackIndex }) => !cached.has(trackIndex));
        for (const { trackIndex } of selected) {
            const file = cached.get(trackIndex);
            if (!file) continue;
            const bytes = await file.file.arrayBuffer();
            signal.throwIfAborted();
            onChunk(trackIndex, bytes);
        }
        if (missing.length) {
            signal.throwIfAborted();
            const catalog = this.catalogsByFile.get(source.file);
            const tracksByKey = new Map<number, EmbeddedSubtitleDescriptor>();
            for (const descriptor of missing) {
                const trackKey = catalog?.[descriptor.trackIndex]?.trackKey;
                if (trackKey === undefined) throw new Error('Missing subtitle extraction key');
                if (tracksByKey.has(trackKey)) throw new Error('Duplicate subtitle extraction key');
                tracksByKey.set(trackKey, descriptor);
            }
            const results = await this.host.extractSubtitles({
                file: source.file,
                fileId: source.id,
                trackKeys: [...tracksByKey.keys()],
                signal,
                onChunk: (key, chunk) => {
                    const track = tracksByKey.get(key);
                    if (!track) throw new Error('Unexpected embedded subtitle track');
                    onChunk(track.trackIndex, chunk);
                },
            });
            signal.throwIfAborted();
            if (
                results.length !== missing.length ||
                new Set(results.map(({ trackKey }) => trackKey)).size !== missing.length
            ) {
                throw new Error('Incomplete embedded subtitle output');
            }
            const completed = results.map((result): readonly [number, FileWithId] => {
                const descriptor = tracksByKey.get(result.trackKey);
                if (!descriptor || result.format !== descriptor.format) {
                    throw new Error('Unexpected subtitle output format');
                }
                const original = prepared.get(embeddedSubtitleId(source.id, descriptor.trackIndex))!;
                return [
                    descriptor.trackIndex,
                    {
                        ...original,
                        file: new File([result.blob], original.file.name, { type: result.blob.type }),
                    },
                ];
            });
            for (const [trackIndex, file] of completed) cached.set(trackIndex, file);
            this.outputsByFile.set(source.file, cached);
        }
        return new Map(
            selected.map(({ trackIndex }) => {
                const file = cached.get(trackIndex)!;
                return [file.id, file];
            })
        );
    }
}
