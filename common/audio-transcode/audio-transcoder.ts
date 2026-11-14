export interface AudioTranscodeOptions {
    readonly file: File;
    readonly fileId: string;
    /** Zero-based position among audio tracks. */
    readonly trackIndex: number;
    readonly signal: AbortSignal;
    /** Cumulative immutable audio prefix; the host owns chunk accumulation. */
    readonly onAudio: (audio: Blob) => void;
}

/** Shared UI depends on this interface; the website supplies the FFmpeg implementation. */
export interface AudioTranscodeHost {
    supportsAudioPlayback(): boolean;
    transcodeAudio(options: AudioTranscodeOptions): Promise<Blob>;
}

/** Conversion data is carried only by the state that can use it. */
export type AudioConversion =
    | { readonly state: 'idle'; readonly blob?: never; readonly error?: never }
    | { readonly state: 'transcoding'; readonly blob?: Blob; readonly error?: never }
    | { readonly state: 'ready'; readonly blob: Blob; readonly error?: never }
    | { readonly state: 'failed'; readonly blob?: never; readonly error: unknown };

export type AudioConversionState = AudioConversion['state'];

/**
 * Select converted audio before its first playable chunk, so playback waits instead of using the original track.
 * Keep the switch exhaustive so new lifecycle states require a source-selection decision.
 */
export const usesConvertedAudio = (state: AudioConversionState): boolean => {
    switch (state) {
        case 'transcoding':
        case 'ready':
            return true;
        case 'idle':
        case 'failed':
            return false;
    }
};
