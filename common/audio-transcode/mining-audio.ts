import { readEbmlElement, readEbmlVarInt } from '@project/common/media-probe/ebml';
import type { EbmlElement } from '@project/common/media-probe/ebml';
import type { FileModel } from '@project/common';
import ByteReader from '@project/common/media-probe/byte-reader';
import { createBlobUrl } from '@project/common/blob-url';
import {
    finalizeWebmAudio,
    readWebmAudioDuration,
    webmElementId,
    webmDefaultTimestampScaleNs,
    nanosecondsPerMillisecond,
} from '@project/common/audio-transcode/webm-audio';

const snapshotReadWindowBytes = 256;
const relativeBlockTimestampBytes = 2;
const blockFlagsBytes = 1;
const blockHeaderBytesAfterTrack = relativeBlockTimestampBytes + blockFlagsBytes;
const millisecondsPerSecond = 1000;

/** Session-scoped audio URL and available duration for a card or dialog. */
export type MiningAudioSource = Pick<FileModel, 'transcodedAudioBlobUrl' | 'transcodedAudioDurationMs'>;

/** Shared across documents; each document gives the immutable audio its own URL. */
export type MiningAudioSnapshot = {
    readonly audio?: Blob;
    readonly durationMs?: number;
};

/** Snapshot the single-track WebM our muxer produces, excluding an unfinished cluster. */
export const snapshotWebmAudio = async (audio: Blob): Promise<{ blob: Blob; durationMs: number } | undefined> => {
    // Only timestamps and element headers are needed; avoid prefetching encoded packet payloads.
    const reader = new ByteReader(audio, snapshotReadWindowBytes);
    let offset = 0,
        limit = audio.size,
        scale = webmDefaultTimestampScaleNs,
        codecDelay = 0;
    let headerEnd = 0,
        snapshotEnd = 0,
        lastCluster: EbmlElement | undefined;
    // Master elements needed for timestamps; skip encoded packet payloads and other metadata.
    const masters = new Set<number>([webmElementId.info, webmElementId.tracks, webmElementId.trackEntry]);
    const metadata = async (start: number, end: number): Promise<void> => {
        while (start < end) {
            const child = await readEbmlElement(reader, start, end);
            if (child === undefined) throw new Error('Invalid WebM snapshot metadata');

            if (masters.has(child.id)) {
                await metadata(child.dataOffset, child.end);
            } else if (child.id === webmElementId.timestampScale) {
                scale = (await reader.unsignedInt(child.dataOffset, child.end - child.dataOffset))!;
            } else if (child.id === webmElementId.codecDelay) {
                codecDelay = (await reader.unsignedInt(child.dataOffset, child.end - child.dataOffset))!;
            }
            start = child.end;
        }
    };
    while (offset < limit) {
        const entry = await readEbmlElement(reader, offset, limit);
        if (entry === undefined) break;
        if (entry.id === webmElementId.segment) {
            offset = entry.dataOffset;
            limit = entry.end;
            continue;
        }
        if (entry.id === webmElementId.cluster) {
            // FFmpeg writes finite-sized clusters. An unknown-sized cluster cannot be sealed yet.
            if (entry.unknown) break;
            if (headerEnd === 0) headerEnd = offset;
            lastCluster = entry;
            snapshotEnd = entry.end;
        } else if (masters.has(entry.id)) {
            await metadata(entry.dataOffset, entry.end);
        }
        offset = entry.end;
    }
    if (lastCluster === undefined) return;
    let timestamp = 0,
        lastBlock = -Infinity;
    const blocks = async (start: number, end: number): Promise<void> => {
        while (start < end) {
            const child = await readEbmlElement(reader, start, end);
            if (child === undefined) throw new Error('Invalid WebM snapshot cluster');

            if (child.id === webmElementId.clusterTimestamp) {
                timestamp = (await reader.unsignedInt(child.dataOffset, child.end - child.dataOffset))!;
            } else if (child.id === webmElementId.blockGroup) {
                await blocks(child.dataOffset, child.end);
            } else if (child.id === webmElementId.simpleBlock || child.id === webmElementId.block) {
                const track = await readEbmlVarInt(reader, child.dataOffset);
                if (track === undefined || child.dataOffset + track.length + blockHeaderBytesAfterTrack > child.end) {
                    throw new Error('Invalid WebM snapshot block');
                }
                const bytes = (await reader.bytes(child.dataOffset + track.length, relativeBlockTimestampBytes))!;
                lastBlock = Math.max(
                    lastBlock,
                    new DataView(bytes.buffer, bytes.byteOffset, relativeBlockTimestampBytes).getInt16(0)
                );
            }
            start = child.end;
        }
    };
    await blocks(lastCluster.dataOffset, lastCluster.end);
    // Stop at the start of the last complete packet: conservatively leave one Opus frame unused.
    const durationMs = ((timestamp + lastBlock) * scale - codecDelay) / nanosecondsPerMillisecond;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const blob = await finalizeWebmAudio(
        [audio.slice(0, headerEnd, audio.type), audio.slice(headerEnd, snapshotEnd, audio.type)],
        durationMs / millisecondsPerSecond
    );
    return { blob, durationMs };
};

/** Capture one audio boundary for the history card and dialog created by a mining action. */
export const snapshotMiningAudio = async ({
    audio,
    required,
    complete,
}: {
    audio?: Blob;
    required: boolean;
    complete: boolean;
}): Promise<MiningAudioSnapshot> => {
    if (!required) return {};
    if (audio !== undefined && complete)
        return { audio, durationMs: (await readWebmAudioDuration(audio)) * millisecondsPerSecond };
    const snapshot = audio === undefined ? undefined : await snapshotWebmAudio(audio);
    if (snapshot === undefined) return { durationMs: 0 };
    return { audio: snapshot.blob, durationMs: snapshot.durationMs };
};

/** Each card owns a document-local source URL, independent of the playback MSE URL. */
export const createMiningAudioSource = ({ audio, durationMs }: MiningAudioSnapshot): MiningAudioSource => {
    return {
        ...(audio === undefined ? {} : { transcodedAudioBlobUrl: createBlobUrl(audio) }),
        ...(durationMs === undefined ? {} : { transcodedAudioDurationMs: durationMs }),
    };
};
