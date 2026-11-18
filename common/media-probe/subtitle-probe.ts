import ByteReader from '@project/common/media-probe/byte-reader';
import { ebmlHeaderId, ebmlHeaderIdBytes } from '@project/common/media-probe/ebml';
import { isMatroskaWebVttCodec, matroskaSubtitleTracks } from '@project/common/media-probe/matroska';
import { isoBmffSubtitleTracks, isoBmffBoxTypeOffset, isoBmffBoxTypeBytes } from '@project/common/media-probe/iso-bmff';

export interface EmbeddedSubtitleTrack {
    /** Zero-based position among subtitle tracks, including unsupported codecs. */
    trackIndex: number;
    /** Native extraction identity: MP4 track ID or Matroska subtitle ordinal. */
    trackKey: number | undefined;
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
    trackKey: number | undefined,
    codec: string,
    language: string | undefined,
    title: string | undefined,
    supported: boolean
): EmbeddedSubtitleTrack => ({
    trackIndex,
    trackKey,
    codec,
    language,
    title,
    ...(supported && textCodecs.has(codec) ? { outputFormat: 'srt' } : {}),
});

/** Discover dedicated subtitle tracks from container metadata, without loading FFmpeg. */
export const probeSubtitleTracks = async (blob: Blob, signal: AbortSignal): Promise<EmbeddedSubtitleTrack[]> => {
    const reader = new ByteReader(blob, undefined, signal);
    if ((await reader.unsignedInt(0, ebmlHeaderIdBytes)) === ebmlHeaderId) {
        const tracks = await matroskaSubtitleTracks(reader);
        if (!tracks) throw new Error('Could not read Matroska tracks');
        return tracks.map((track, index) => {
            const codec = isMatroskaWebVttCodec(track.codecId)
                ? 'webvtt'
                : (matroskaCodecs[track.codecId] ?? track.codecId);
            return subtitle(index, index, codec, track.language, track.title, true);
        });
    }
    const boxType = await reader.ascii(isoBmffBoxTypeOffset, isoBmffBoxTypeBytes);
    if (boxType && ['ftyp', 'styp', 'moov', 'free', 'skip', 'wide', 'mdat'].includes(boxType)) {
        const tracks = await isoBmffSubtitleTracks(reader);
        if (!tracks) throw new Error('Could not read MP4 tracks');
        return tracks.map((track, index) => {
            if (!track.format) throw new Error('Missing MP4 subtitle sample entry');
            const trackKey = track.id !== undefined && track.id > 0 ? track.id : undefined;
            return subtitle(
                index,
                trackKey,
                mp4Codecs[track.format] ?? track.format,
                track.language,
                track.title,
                trackKey !== undefined && (track.format === 'tx3g' || track.format === 'text')
            );
        });
    }
    return [];
};
