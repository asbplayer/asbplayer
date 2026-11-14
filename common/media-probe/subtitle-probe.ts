import ByteReader from '@project/common/media-probe/byte-reader';
import { ebmlHeaderId, ebmlHeaderIdBytes } from '@project/common/media-probe/ebml';
import { matroskaTracks, matroskaSubtitleTrackType } from '@project/common/media-probe/matroska';
import { isoBmffTracks, isoBmffBoxTypeOffset, isoBmffBoxTypeBytes } from '@project/common/media-probe/iso-bmff';

export interface EmbeddedSubtitleTrack {
    /** Zero-based position among subtitle tracks, including unsupported codecs. */
    trackIndex: number;
    codec: string;
    language?: string;
    title?: string;
    outputFormat?: 'srt';
}

const matroskaCodecs: Record<string, string> = {
    'S_TEXT/UTF8': 'subrip',
    'S_TEXT/ASCII': 'text',
    'S_TEXT/ASS': 'ass',
    S_ASS: 'ass',
    'S_TEXT/SSA': 'ass',
    S_SSA: 'ass',
    'S_HDMV/PGS': 'hdmv_pgs_subtitle',
    S_VOBSUB: 'dvd_subtitle',
    S_DVBSUB: 'dvb_subtitle',
};
const mp4Codecs: Record<string, string> = { tx3g: 'mov_text', text: 'mov_text', wvtt: 'webvtt', stpp: 'ttml' };
const textCodecs = new Set(['subrip', 'text', 'ass', 'ssa', 'webvtt', 'mov_text']);

const displayNamesByCodec: Record<string, string> = {
    subrip: 'SRT',
    text: 'TXT',
    ass: 'ASS',
    ssa: 'SSA',
    webvtt: 'VTT',
    mov_text: 'TX3G',
    ttml: 'TTML',
    hdmv_pgs_subtitle: 'PGS',
    dvd_subtitle: 'VOBSUB',
    dvb_subtitle: 'DVB',
};

/** Familiar source format names, independent of the format used for extraction. */
export const subtitleCodecDisplayName = (codec: string) => displayNamesByCodec[codec] ?? codec.toUpperCase();

const subtitle = (
    trackIndex: number,
    codec: string,
    language: string | undefined,
    title: string | undefined,
    supported = true
): EmbeddedSubtitleTrack => ({
    trackIndex,
    codec,
    language,
    title,
    ...(supported && textCodecs.has(codec) ? { outputFormat: 'srt' } : {}),
});

/** Discover dedicated subtitle tracks from container metadata, without loading FFmpeg. */
export const probeSubtitleTracks = async (blob: Blob, signal: AbortSignal): Promise<EmbeddedSubtitleTrack[]> => {
    const reader = new ByteReader(blob, undefined, signal);
    if ((await reader.unsignedInt(0, ebmlHeaderIdBytes)) === ebmlHeaderId) {
        const tracks = await matroskaTracks(reader);
        if (!tracks) throw new Error('Could not read Matroska tracks');
        return tracks
            .filter((track) => track.type === matroskaSubtitleTrackType)
            .map((track, index) => {
                const codec = track.codecId.startsWith('D_WEBVTT/')
                    ? 'webvtt'
                    : (matroskaCodecs[track.codecId] ?? track.codecId);
                return subtitle(index, codec, track.language, track.title);
            });
    }
    const boxType = await reader.ascii(isoBmffBoxTypeOffset, isoBmffBoxTypeBytes);
    if (boxType && ['ftyp', 'styp', 'moov', 'free', 'skip', 'wide', 'mdat'].includes(boxType)) {
        const tracks = await isoBmffTracks(reader);
        if (!tracks) throw new Error('Could not read MP4 tracks');
        return tracks
            .filter((track) => !track.chapter && ['text', 'sbtl', 'subt', 'subp', 'clcp'].includes(track.handler))
            .map((track, index) => {
                if (!track.format) throw new Error('Missing MP4 subtitle sample entry');
                // Only timed text is enabled for MP4 in this runtime.
                return subtitle(
                    index,
                    mp4Codecs[track.format] ?? track.format,
                    track.language,
                    track.title,
                    track.format === 'tx3g' || track.format === 'text'
                );
            });
    }
    throw new Error('Unsupported subtitle container');
};
