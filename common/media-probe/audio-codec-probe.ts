import ByteReader from '@project/common/media-probe/byte-reader';
import {
    isoBmffAudioSampleFormats,
    isoBmffBoxTypeOffset,
    isoBmffBoxTypeBytes,
} from '@project/common/media-probe/iso-bmff';
import { matroskaAudioCodecIds } from '@project/common/media-probe/matroska';
import { ebmlHeaderId, ebmlHeaderIdBytes } from '@project/common/media-probe/ebml';
import { asbTrace, asbWarn } from '@project/common/util/log';

export interface ProbedAudioTrack {
    /**
     * Position among the audio tracks, matching ffmpeg's `0:a:<index>` stream specifier.
     */
    readonly index: number;
    readonly codec: string;
}

const containerProbeBytes = 12;
const isoBmffTopLevelBoxTypes = ['ftyp', 'styp', 'moov', 'free', 'skip', 'wide', 'mdat'];

/**
 * Codecs that no browser is guaranteed to decode, mapped to the MIME type used to ask the browser
 * whether it can. MP4 sample-entry MIME strings are capability hints, not the source file MIME
 * type or a guarantee that an individual file will play. Source container support is checked
 * separately. Anything absent from this map is left alone.
 */
const mimeTypesByCodec: { [codec: string]: string } = {
    eac3: 'audio/mp4; codecs="ec-3"',
    ac3: 'audio/mp4; codecs="ac-3"',
    dts: 'audio/mp4; codecs="dtsc"',
    truehd: 'audio/mp4; codecs="mlpa"',
    mlp: 'audio/mp4; codecs="mlpa"',
};

const displayNamesByCodec: { [codec: string]: string } = {
    eac3: 'E-AC-3',
    ac3: 'AC-3',
    dts: 'DTS',
    truehd: 'Dolby TrueHD',
    mlp: 'MLP',
};

const isoBmffCodecs: { [format: string]: string } = {
    'ec-3': 'eac3',
    'ac-3': 'ac3',
    dtsc: 'dts',
    dtse: 'dts',
    dtsh: 'dts',
    dtsl: 'dts',
    mlpa: 'truehd',
    mp4a: 'aac',
    Opus: 'opus',
    fLaC: 'flac',
    '.mp3': 'mp3',
    alac: 'alac',
};

const matroskaCodecPrefixes: { prefix: string; codec: string }[] = [
    { prefix: 'A_EAC3', codec: 'eac3' },
    { prefix: 'A_AC3', codec: 'ac3' },
    { prefix: 'A_DTS', codec: 'dts' },
    { prefix: 'A_TRUEHD', codec: 'truehd' },
    { prefix: 'A_MLP', codec: 'mlp' },
    { prefix: 'A_AAC', codec: 'aac' },
    { prefix: 'A_OPUS', codec: 'opus' },
    { prefix: 'A_VORBIS', codec: 'vorbis' },
    { prefix: 'A_FLAC', codec: 'flac' },
    { prefix: 'A_MPEG/L3', codec: 'mp3' },
    { prefix: 'A_MPEG/L2', codec: 'mp2' },
    { prefix: 'A_PCM', codec: 'pcm' },
];

const codecFromMatroskaCodecId = (codecId: string) => {
    const normalized = codecId.toUpperCase();
    return matroskaCodecPrefixes.find(({ prefix }) => normalized.startsWith(prefix))?.codec ?? codecId.toLowerCase();
};

const codecFromIsoBmffFormat = (format: string) => isoBmffCodecs[format] ?? format.trim().toLowerCase();

interface ProbedContainer {
    /** MIME type used to ask the browser whether it can play this container at all. */
    readonly mimeType: string;
    readonly audioCodecs: string[];
}

/** Recognizes the container signature and normalizes its format-specific audio codec IDs. */
const probeContainer = async (reader: ByteReader): Promise<ProbedContainer | undefined> => {
    const leadingBytes = await reader.bytes(0, containerProbeBytes);

    if (leadingBytes === undefined) {
        return;
    }

    if ((await reader.unsignedInt(0, ebmlHeaderIdBytes)) === ebmlHeaderId) {
        const codecIds = await matroskaAudioCodecIds(reader);
        return codecIds && { mimeType: 'video/x-matroska', audioCodecs: codecIds.map(codecFromMatroskaCodecId) };
    }

    if (isoBmffTopLevelBoxTypes.includes((await reader.ascii(isoBmffBoxTypeOffset, isoBmffBoxTypeBytes)) ?? '')) {
        const formats = await isoBmffAudioSampleFormats(reader);
        return formats && { mimeType: 'video/mp4', audioCodecs: formats.map(codecFromIsoBmffFormat) };
    }

    return;
};

// A video element, since this is asked about video containers as well as audio codecs.
let probeElement: HTMLVideoElement | undefined;

const canPlayType = (mimeType: string) => {
    probeElement = probeElement ?? document.createElement('video');
    return probeElement.canPlayType(mimeType) !== '';
};

/**
 * @returns whether the browser is able to decode the given codec. Codecs outside the set of
 * patent-encumbered formats that browsers commonly omit are always reported as decodable.
 */
export const browserCanDecodeAudioCodec = (codec: string) => {
    const mimeType = mimeTypesByCodec[codec];
    return mimeType === undefined || canPlayType(mimeType);
};

/** Human-readable names for conversion notices, with an uppercase fallback for other codecs. */
export const audioCodecDisplayName = (codec: string) => displayNamesByCodec[codec] ?? codec.toUpperCase();

/**
 * Decides whether a file needs its audio transcoded to be heard at all.
 *
 * A file is only a problem when the browser can decode none of its audio tracks: given a mix of
 * playable and unplayable tracks a browser falls back to one it can decode, so transcoding would
 * be pointless.
 *
 * @returns the track to transcode, or undefined when the file plays fine, has no audio, or is in a
 * container that could not be parsed.
 */
export const audioTrackRequiringTranscode = async (blob: Blob): Promise<ProbedAudioTrack | undefined> => {
    let container: ProbedContainer | undefined;

    try {
        container = await probeContainer(new ByteReader(blob));
    } catch (e) {
        asbWarn('media/probe', 'Failed to probe audio codecs:', e);
        return;
    }

    if (container === undefined || container.audioCodecs.length === 0) {
        asbTrace('media/probe', 'Skipping audio conversion', {
            reason: container === undefined ? 'unrecognized-container' : 'no-audio-tracks',
            inputBytes: blob.size,
        });
        return;
    }

    asbTrace('media/probe', 'Detected audio codecs', {
        container: container.mimeType,
        codecs: container.audioCodecs,
        inputBytes: blob.size,
    });

    if (!canPlayType(container.mimeType)) {
        asbTrace('media/probe', 'Skipping audio conversion: browser cannot play the video container', {
            container: container.mimeType,
        });
        return;
    }

    if (container.audioCodecs.some(browserCanDecodeAudioCodec)) {
        asbTrace('media/probe', 'Skipping audio conversion: browser can decode an existing audio track');
        return;
    }

    asbTrace('media/probe', 'Audio conversion required', { trackIndex: 0, codec: container.audioCodecs[0] });
    return { index: 0, codec: container.audioCodecs[0] };
};
