import { aviAudioCodecs } from './avi';
import ByteReader from './byte-reader';
import { isoBmffAudioSampleFormats } from './iso-bmff';
import { matroskaAudioCodecIds } from './matroska';

export interface ProbedAudioTrack {
    /**
     * Position among the audio tracks, matching ffmpeg's `0:a:<index>` stream specifier.
     */
    readonly index: number;
    readonly codec: string;
}

const isoBmffTopLevelBoxTypes = ['ftyp', 'styp', 'moov', 'free', 'skip', 'wide', 'mdat'];

/**
 * Codecs that no browser is guaranteed to decode, mapped to the MIME type used to ask the browser
 * whether it can. Anything absent from this map is left alone.
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

const probeContainer = async (reader: ByteReader): Promise<ProbedContainer | undefined> => {
    const leadingBytes = await reader.bytes(0, 12);

    if (leadingBytes === undefined) {
        return undefined;
    }

    const [b0, b1, b2, b3] = leadingBytes;

    if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) {
        const codecIds = await matroskaAudioCodecIds(reader);
        return codecIds && { mimeType: 'video/x-matroska', audioCodecs: codecIds.map(codecFromMatroskaCodecId) };
    }

    const riff = await reader.ascii(0, 4);

    if (riff === 'RIFF' && (await reader.ascii(8, 4)) === 'AVI ') {
        const codecs = await aviAudioCodecs(reader);
        return codecs && { mimeType: 'video/avi', audioCodecs: codecs };
    }

    if (isoBmffTopLevelBoxTypes.includes((await reader.ascii(4, 4)) ?? '')) {
        const formats = await isoBmffAudioSampleFormats(reader);
        return formats && { mimeType: 'video/mp4', audioCodecs: formats.map(codecFromIsoBmffFormat) };
    }

    return undefined;
};

// A video element, since this is asked about video containers as well as audio codecs.
let probeElement: HTMLVideoElement | undefined;

const canPlayType = (mimeType: string) => {
    probeElement = probeElement ?? document.createElement('video');
    return probeElement.canPlayType(mimeType) !== '';
};

/**
 * Reads the container header to determine what audio codecs a media file carries. Only header
 * bytes are read, so this is cheap even for multi-gigabyte files.
 *
 * @returns the audio tracks, or undefined when the container could not be parsed.
 */
export const probeAudioTracks = async (blob: Blob): Promise<ProbedAudioTrack[] | undefined> => {
    try {
        const container = await probeContainer(new ByteReader(blob));
        return container?.audioCodecs.map((codec, index) => ({ index, codec }));
    } catch (e) {
        // A file we can't parse is one we shouldn't interfere with.
        console.warn('Failed to probe audio codecs:', e);
        return undefined;
    }
};

/**
 * @returns whether the browser is able to decode the given codec. Codecs outside the set of
 * patent-encumbered formats that browsers commonly omit are always reported as decodable.
 */
export const browserCanDecodeAudioCodec = (codec: string) => {
    const mimeType = mimeTypesByCodec[codec];
    return mimeType === undefined || canPlayType(mimeType);
};

export const audioCodecDisplayName = (codec: string) => displayNamesByCodec[codec] ?? codec.toUpperCase();

/**
 * Decides whether a file needs its audio transcoded to be heard at all.
 *
 * A file is only a problem when the browser can decode none of its audio tracks: given a mix of
 * playable and unplayable tracks a browser falls back to one it can decode, so transcoding would
 * be pointless and the prompt just noise.
 *
 * @returns the track to transcode, or undefined when the file plays fine, has no audio, or is in a
 * container that could not be parsed.
 */
export const audioTrackRequiringTranscode = async (blob: Blob): Promise<ProbedAudioTrack | undefined> => {
    let container: ProbedContainer | undefined;

    try {
        container = await probeContainer(new ByteReader(blob));
    } catch (e) {
        // A file we can't parse is one we shouldn't interfere with.
        console.warn('Failed to probe audio codecs:', e);
        return undefined;
    }

    if (container === undefined || container.audioCodecs.length === 0) {
        return undefined;
    }

    // Converting the audio of a file the browser can't open at all - an mkv in Firefox, any avi -
    // would leave the user with sound and no picture, so leave those alone too.
    if (!canPlayType(container.mimeType)) {
        return undefined;
    }

    if (container.audioCodecs.some(browserCanDecodeAudioCodec)) {
        return undefined;
    }

    return { index: 0, codec: container.audioCodecs[0] };
};
