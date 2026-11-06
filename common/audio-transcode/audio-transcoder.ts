export interface AudioTranscodeOptions {
    readonly file: File;
    readonly fileId: string;
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
