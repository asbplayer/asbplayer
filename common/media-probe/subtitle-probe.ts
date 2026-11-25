import ByteReader from '@project/common/media-probe/byte-reader';
import { ebmlHeaderId, ebmlHeaderIdBytes } from '@project/common/media-probe/ebml';
import { isMatroskaWebVttCodec, matroskaSubtitleTracks } from '@project/common/media-probe/matroska';
import {
    isoBmffSubtitleTracks,
    isoBmffBoxTypeOffset,
    isoBmffBoxTypeBytes,
    isoBmffTopLevelBoxTypes,
} from '@project/common/media-probe/iso-bmff';
import { ffmpegSubtitleFormats } from '@project/ffmpeg/protocol';
import type { SubtitleOutputFormat } from '@project/ffmpeg/protocol';

export interface EmbeddedSubtitleTrack {
    /** Zero-based position among subtitle tracks, including unsupported codecs. */
    readonly trackIndex: number;
    /** Native extraction identity: MP4 track ID or Matroska subtitle ordinal. */
    readonly trackKey: number | undefined;
    readonly codec: string;
    readonly language?: string;
    readonly title?: string;
    /** Absent when the track is listed but cannot be extracted, such as an unsupported codec or unusable track key. */
    readonly outputFormat?: SubtitleOutputFormat;
}

const codecsByMatroskaId: Record<string, string> = {
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
const codecsByMp4Format: Record<string, string> = { tx3g: 'mov_text', text: 'mov_text', wvtt: 'webvtt', stpp: 'ttml' };
const outputFormatsByCodec: Record<string, SubtitleOutputFormat> = {
    subrip: ffmpegSubtitleFormats.text.extension,
    text: ffmpegSubtitleFormats.text.extension,
    ass: ffmpegSubtitleFormats.text.extension,
    ssa: ffmpegSubtitleFormats.text.extension,
    webvtt: ffmpegSubtitleFormats.text.extension,
    mov_text: ffmpegSubtitleFormats.text.extension,
    hdmv_pgs_subtitle: ffmpegSubtitleFormats.image.extension,
    dvd_subtitle: ffmpegSubtitleFormats.image.extension,
    dvb_subtitle: ffmpegSubtitleFormats.image.extension,
};

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

const subtitle = ({
    trackIndex,
    trackKey,
    codec,
    language,
    title,
    supported,
}: {
    trackIndex: number;
    trackKey: number | undefined;
    codec: string;
    language: string | undefined;
    title: string | undefined;
    supported: boolean;
}): EmbeddedSubtitleTrack => ({
    trackIndex,
    trackKey,
    codec,
    language,
    title,
    outputFormat: supported ? outputFormatsByCodec[codec] : undefined,
});

/** Discover dedicated subtitle tracks from container metadata, without loading FFmpeg. */
export const probeSubtitleTracks = async (blob: Blob, signal: AbortSignal): Promise<EmbeddedSubtitleTrack[]> => {
    const reader = new ByteReader(blob, { signal });
    if ((await reader.unsignedInt(0, ebmlHeaderIdBytes)) === ebmlHeaderId) {
        const tracks = await matroskaSubtitleTracks(reader);
        if (!tracks) throw new Error('Could not read Matroska tracks');
        return tracks.map((track, index) => {
            const codec = isMatroskaWebVttCodec(track.codecId)
                ? 'webvtt'
                : (codecsByMatroskaId[track.codecId] ?? track.codecId);
            return subtitle({
                trackIndex: index,
                trackKey: index,
                codec,
                language: track.language,
                title: track.title,
                supported: true,
            });
        });
    }
    const boxType = await reader.ascii(isoBmffBoxTypeOffset, isoBmffBoxTypeBytes);
    if (boxType && isoBmffTopLevelBoxTypes.includes(boxType)) {
        const tracks = await isoBmffSubtitleTracks(reader);
        if (!tracks) throw new Error('Could not read MP4 tracks');
        const seenTrackKeys = new Set<number>();
        return tracks.map((track, index) => {
            if (!track.format) throw new Error('Missing MP4 subtitle sample entry');
            const duplicateKey = track.id !== undefined && seenTrackKeys.has(track.id);
            const trackKey = track.id && track.id > 0 && !duplicateKey ? track.id : undefined;
            if (trackKey !== undefined) seenTrackKeys.add(trackKey);
            return subtitle({
                trackIndex: index,
                trackKey,
                codec: codecsByMp4Format[track.format] ?? track.format,
                language: track.language,
                title: track.title,
                supported:
                    trackKey !== undefined &&
                    (track.format === 'tx3g' || track.format === 'text' || track.format === 'dvd_subtitle'),
            });
        });
    }
    return [];
};
