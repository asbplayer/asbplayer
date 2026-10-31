import ByteReader from '@project/common/media-probe/byte-reader';
import { findEbmlElement } from '@project/common/media-probe/ebml';

export const webmOpusMimeType = 'audio/webm; codecs="opus"';
export const webmDefaultTimestampScaleNs = 1_000_000;
export const nanosecondsPerMillisecond = 1_000_000;
const nanosecondsPerSecond = 1_000_000_000;
const durationFloatBytes = 8;

/** EBML element IDs, with their marker bits left intact as they appear on disk. */
export const webmElementId = {
    segment: 0x18538067,
    info: 0x1549a966,
    timestampScale: 0x2ad7b1,
    duration: 0x4489,
    tracks: 0x1654ae6b,
    trackEntry: 0xae,
    codecDelay: 0x56aa,
    cluster: 0x1f43b675,
    clusterTimestamp: 0xe7,
    blockGroup: 0xa0,
    block: 0xa1,
    simpleBlock: 0xa3,
} as const;

const durationMetadata = async (audio: Blob) => {
    const reader = new ByteReader(audio);
    const find = async (id: number, start = 0, end = reader.size) => {
        const element = await findEbmlElement(reader, id, start, end);
        if (element === undefined) throw new Error('Missing WebM initialization metadata');
        return element;
    };
    const segment = await find(webmElementId.segment);
    const info = await find(webmElementId.info, segment.dataOffset, segment.end);
    const scale = await find(webmElementId.timestampScale, info.dataOffset, info.end);
    const nanoseconds = (await reader.unsignedInt(scale.dataOffset, scale.dataSize))!;
    const duration = await find(webmElementId.duration, info.dataOffset, info.end);
    if (nanoseconds <= 0 || duration.dataSize !== durationFloatBytes) throw new Error('Invalid WebM duration metadata');
    return { reader, nanoseconds, duration };
};

/** Read the exact sample duration patched into our completed WebM, using bounded header reads. */
export const readWebmAudioDuration = async (audio: Blob): Promise<number> => {
    const { reader, nanoseconds, duration } = await durationMetadata(audio);
    const bytes = (await reader.bytes(duration.dataOffset, duration.dataSize))!;
    const seconds =
        (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0) * nanoseconds) /
        nanosecondsPerSecond;
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid Opus output duration');
    return seconds;
};

/** Give the completed, unseekable-muxed WebM its exact duration so ordinary audio playback can seek. */
export const finalizeWebmAudio = async (chunks: readonly Blob[], seconds: number): Promise<Blob> => {
    if (chunks.length === 0 || !Number.isFinite(seconds) || seconds <= 0) {
        throw new Error('Invalid Opus output duration');
    }
    // The native muxer flushes the complete initialization header before writing any media.
    const { reader, nanoseconds, duration } = await durationMetadata(chunks[0]);
    const bytes = (await reader.bytes(0, reader.size))!;
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat64(
        duration.dataOffset,
        (seconds * nanosecondsPerSecond) / nanoseconds
    );
    return new Blob([bytes, ...chunks.slice(1)], { type: chunks[0].type });
};
