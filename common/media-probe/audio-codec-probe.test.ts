import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import {
    audioCodecDisplayName,
    audioTrackRequiringTranscode,
    browserCanDecodeAudioCodec,
    probeAudioTracks,
} from './audio-codec-probe';

// jsdom's Blob does not implement arrayBuffer().
beforeAll(() => {
    if (Blob.prototype.arrayBuffer === undefined) {
        Blob.prototype.arrayBuffer = function () {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(this);
            });
        };
    }
});

const concat = (...parts: (Uint8Array | number[])[]) => {
    const arrays = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)));
    const result = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
    let offset = 0;

    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }

    return result;
};

const ascii = (text: string) => new Uint8Array([...text].map((character) => character.charCodeAt(0)));

const blobOf = (bytes: Uint8Array) => new Blob([bytes]);

// Matroska

const ebmlSize = (size: number) => {
    if (size < 0x7f) {
        return new Uint8Array([0x80 | size]);
    }

    if (size < 0x3fff) {
        return new Uint8Array([0x40 | (size >> 8), size & 0xff]);
    }

    return new Uint8Array([0x10 | ((size >> 24) & 0x0f), (size >> 16) & 0xff, (size >> 8) & 0xff, size & 0xff]);
};

const ebmlElement = (id: number[], data: Uint8Array) => concat(id, ebmlSize(data.length), data);

const trackEntry = (trackType: number, codecId: string) =>
    ebmlElement([0xae], concat(ebmlElement([0x83], new Uint8Array([trackType])), ebmlElement([0x86], ascii(codecId))));

const matroskaFile = ({
    audioCodecIds,
    withVideoTrack = true,
}: {
    audioCodecIds: string[];
    withVideoTrack?: boolean;
}) =>
    concat(
        ebmlElement([0x1a, 0x45, 0xdf, 0xa3], ascii('ebml')),
        ebmlElement(
            [0x18, 0x53, 0x80, 0x67],
            concat(
                // A Void element, so the walk has to skip something to reach Tracks.
                ebmlElement([0xec], new Uint8Array(32)),
                ebmlElement(
                    [0x16, 0x54, 0xae, 0x6b],
                    concat(
                        ...(withVideoTrack ? [trackEntry(1, 'V_MPEG4/ISO/AVC')] : []),
                        ...audioCodecIds.map((codecId) => trackEntry(2, codecId))
                    )
                )
            )
        )
    );

// ISO base media file format

const box = (type: string, data: Uint8Array) => {
    const size = 8 + data.length;
    return concat([(size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff], ascii(type), data);
};

const trak = (handler: string, sampleFormat: string) =>
    box(
        'trak',
        box(
            'mdia',
            concat(
                box('hdlr', concat(new Uint8Array(8), ascii(handler))),
                box(
                    'minf',
                    box(
                        'stbl',
                        box(
                            'stsd',
                            concat(
                                new Uint8Array(4), // version and flags
                                new Uint8Array([0, 0, 0, 1]), // entry count
                                box(sampleFormat, new Uint8Array(20))
                            )
                        )
                    )
                )
            )
        )
    );

const isoBmffFile = ({
    audioSampleFormats,
    moovAtEnd = false,
}: {
    audioSampleFormats: string[];
    moovAtEnd?: boolean;
}) => {
    const moov = box('moov', concat(trak('vide', 'avc1'), ...audioSampleFormats.map((format) => trak('soun', format))));
    const ftyp = box('ftyp', ascii('isom'));
    const mdat = box('mdat', new Uint8Array(64));
    return moovAtEnd ? concat(ftyp, mdat, moov) : concat(ftyp, moov, mdat);
};

// AVI

const leUint32 = (value: number) =>
    new Uint8Array([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);

const riffChunk = (id: string, data: Uint8Array) => {
    const chunk = concat(ascii(id), leUint32(data.length), data);
    return data.length % 2 === 1 ? concat(chunk, [0]) : chunk;
};

const riffList = (listType: string, data: Uint8Array) => riffChunk('LIST', concat(ascii(listType), data));

const aviFile = ({ audioFormatTags }: { audioFormatTags: number[] }) => {
    const streams = audioFormatTags.map((tag) =>
        riffList(
            'strl',
            concat(
                riffChunk('strh', concat(ascii('auds'), new Uint8Array(48))),
                riffChunk('strf', concat(new Uint8Array([tag & 0xff, (tag >> 8) & 0xff]), new Uint8Array(16)))
            )
        )
    );
    const body = concat(ascii('AVI '), riffList('hdrl', concat(...streams)));
    return concat(ascii('RIFF'), leUint32(body.length), body);
};

describe('probeAudioTracks', () => {
    it('reads an E-AC-3 track out of a Matroska file', async () => {
        const tracks = await probeAudioTracks(blobOf(matroskaFile({ audioCodecIds: ['A_EAC3'] })));
        expect(tracks).toEqual([{ index: 0, codec: 'eac3' }]);
    });

    it('reads every Matroska audio track in order, ignoring the video track', async () => {
        const tracks = await probeAudioTracks(blobOf(matroskaFile({ audioCodecIds: ['A_AAC', 'A_EAC3', 'A_DTS'] })));
        expect(tracks).toEqual([
            { index: 0, codec: 'aac' },
            { index: 1, codec: 'eac3' },
            { index: 2, codec: 'dts' },
        ]);
    });

    it('normalizes Matroska CodecID variants', async () => {
        const tracks = await probeAudioTracks(
            blobOf(matroskaFile({ audioCodecIds: ['A_AC3/BSID9', 'A_DTS/EXPRESS', 'A_TRUEHD'] }))
        );
        expect(tracks?.map(({ codec }) => codec)).toEqual(['ac3', 'dts', 'truehd']);
    });

    it('returns no tracks for a Matroska file without audio', async () => {
        const tracks = await probeAudioTracks(blobOf(matroskaFile({ audioCodecIds: [] })));
        expect(tracks).toEqual([]);
    });

    it('reads an E-AC-3 track out of an ISO base media file', async () => {
        const tracks = await probeAudioTracks(blobOf(isoBmffFile({ audioSampleFormats: ['ec-3'] })));
        expect(tracks).toEqual([{ index: 0, codec: 'eac3' }]);
    });

    it('finds moov when it sits after the media data', async () => {
        const tracks = await probeAudioTracks(blobOf(isoBmffFile({ audioSampleFormats: ['ec-3'], moovAtEnd: true })));
        expect(tracks).toEqual([{ index: 0, codec: 'eac3' }]);
    });

    it('normalizes ISO base media sample formats', async () => {
        const tracks = await probeAudioTracks(blobOf(isoBmffFile({ audioSampleFormats: ['mp4a', 'ac-3', 'dtsc'] })));
        expect(tracks?.map(({ codec }) => codec)).toEqual(['aac', 'ac3', 'dts']);
    });

    it('reads an AC-3 stream out of an AVI file', async () => {
        const tracks = await probeAudioTracks(blobOf(aviFile({ audioFormatTags: [0x2000] })));
        expect(tracks).toEqual([{ index: 0, codec: 'ac3' }]);
    });

    it('returns undefined for a container it cannot parse', async () => {
        const tracks = await probeAudioTracks(blobOf(ascii('this is not a media file at all')));
        expect(tracks).toBeUndefined();
    });
});

describe('browserCanDecodeAudioCodec', () => {
    const mockCanPlayType = (result: string) =>
        jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue(result as CanPlayTypeResult);

    it('reports codecs outside the patent-encumbered set as decodable', () => {
        mockCanPlayType('');
        expect(browserCanDecodeAudioCodec('aac')).toBe(true);
        expect(browserCanDecodeAudioCodec('opus')).toBe(true);
    });

    it('defers to the browser for Dolby codecs', () => {
        mockCanPlayType('');
        expect(browserCanDecodeAudioCodec('eac3')).toBe(false);

        mockCanPlayType('probably');
        expect(browserCanDecodeAudioCodec('eac3')).toBe(true);
    });
});

describe('audioTrackRequiringTranscode', () => {
    // Like Chrome: opens the containers, decodes nothing patent-encumbered.
    const playsContainersButNoDolby = (playableContainers = ['video/x-matroska', 'video/mp4']) =>
        jest
            .spyOn(HTMLMediaElement.prototype, 'canPlayType')
            .mockImplementation((type) => (playableContainers.includes(type) ? 'maybe' : ''));

    it('picks the first track when the browser can decode none of them', async () => {
        playsContainersButNoDolby();
        const track = await audioTrackRequiringTranscode(blobOf(matroskaFile({ audioCodecIds: ['A_EAC3', 'A_DTS'] })));
        expect(track).toEqual({ index: 0, codec: 'eac3' });
    });

    // Browsers fall back to a track they can decode, so these files already play.
    it('leaves files alone when any track is playable', async () => {
        playsContainersButNoDolby();
        const track = await audioTrackRequiringTranscode(blobOf(matroskaFile({ audioCodecIds: ['A_EAC3', 'A_AAC'] })));
        expect(track).toBeUndefined();
    });

    // Converting would leave the user with sound and no picture - Firefox with mkv, anyone with avi.
    it('leaves files alone when the browser cannot open the container', async () => {
        playsContainersButNoDolby(['video/mp4']);
        const track = await audioTrackRequiringTranscode(blobOf(matroskaFile({ audioCodecIds: ['A_EAC3'] })));
        expect(track).toBeUndefined();
    });

    it('leaves files without audio alone', async () => {
        playsContainersButNoDolby();
        expect(await audioTrackRequiringTranscode(blobOf(matroskaFile({ audioCodecIds: [] })))).toBeUndefined();
    });

    it('leaves containers it cannot parse alone', async () => {
        playsContainersButNoDolby();
        expect(await audioTrackRequiringTranscode(blobOf(ascii('not a media file')))).toBeUndefined();
    });
});

describe('audioCodecDisplayName', () => {
    it('names the codecs users are likely to see', () => {
        expect(audioCodecDisplayName('eac3')).toBe('E-AC-3');
        expect(audioCodecDisplayName('ac3')).toBe('AC-3');
        expect(audioCodecDisplayName('truehd')).toBe('Dolby TrueHD');
    });

    it('falls back to the codec name', () => {
        expect(audioCodecDisplayName('vorbis')).toBe('VORBIS');
    });
});
