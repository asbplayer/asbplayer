import type { LoadableSubtitleTrack, Message, ReadyFromVideoMessage, SubtitlesToVideoMessage } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { VideoProtocol, VideoProtocolMessage } from '@project/common/app/services/video-protocol';
import type {
    SubtitleSourceProducer,
    SubtitleSourceSnapshot,
    SubtitleSourceUpdate,
} from '@project/common/subtitle-reader/subtitle-stream';

export class TestVideoProtocol implements VideoProtocol {
    readonly sent: Message[] = [];
    source?: SubtitleSourceSnapshot;
    offset = 500;
    onSubtitles?: () => void;
    onMessage?: (message: VideoProtocolMessage) => void;

    postMessage(message: Message) {
        this.sent.push(message);
        if (message.command === 'subtitles') this.onSubtitles?.();
        if (message.command === 'requestSubtitleSource' && this.source) {
            this.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', ...this.source, offset: this.offset } },
            });
        }
    }

    close() {}

    ready() {
        const message: ReadyFromVideoMessage = {
            command: 'ready',
            paused: true,
            currentTime: 0,
            duration: 60,
            playbackRate: 1,
        };
        this.onMessage?.({ data: message });
    }

    get subtitleMessages() {
        return this.sent.filter((message) => message.command === 'subtitles') as SubtitlesToVideoMessage[];
    }
}

export const vttText = (text: string) => `WEBVTT\n\n00:01.000 --> 00:02.000\n${text}\n\n`;
export const track = (text: string, readText = async () => vttText(text)): LoadableSubtitleTrack<FileWithId> => ({
    fileParts: [{ id: text, file: { name: `${text}.vtt`, text: readText } as File }],
});
export function createProducer(loadId = 'producer') {
    let update!: (update: SubtitleSourceUpdate) => void;
    let signal!: AbortSignal;
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const producer: SubtitleSourceProducer = (publish, abortSignal) => {
        update = publish;
        signal = abortSignal;
        return new Promise<void>((resolve, reject) => {
            finish = () => {
                update({ type: 'complete', track: 0, loadId });
                resolve();
            };
            fail = reject;
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            update({
                type: 'snapshot',
                tracks: [{ track: 0, loadId, name: `${loadId}.srt`, status: 'loading', cues: [] }],
            });
        });
    };
    return {
        producer,
        publish: (message: SubtitleSourceUpdate) => update(message),
        append: (text: string, cueId = 0) =>
            update({
                type: 'cues',
                track: 0,
                loadId,
                cues: [{ cueId, start: cueId * 2000 + 1000, end: cueId * 2000 + 2000, text }],
            }),
        finish: () => finish(),
        fail: (error: Error) => fail(error),
        get signal() {
            return signal;
        },
    };
}
