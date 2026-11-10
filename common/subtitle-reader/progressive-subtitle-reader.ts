import type SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import type { SubtitleSourceCue } from '@project/common/subtitle-reader/subtitle-stream';

const assLineBreakRegex = /\r\n|\r|\n/;
const assEventsHeaderRegex = /^\[events\]\s*$/i;
const assDialogueRegex = /^Dialogue\s*:/i;

/** Buffers incomplete text and parses only complete ASS events, retaining the header between batches. */
export class ProgressiveSubtitleReader {
    private pending = '';
    private readonly header: string[] = [];
    private events = false;
    private cueId = 0;
    private previous?: SubtitleSourceCue;

    constructor(
        private readonly reader: Pick<SubtitleReader, 'subtitles'>,
        extension: string
    ) {
        if (extension !== 'ass') throw new Error(`Unsupported progressive subtitle format: ${extension}`);
    }

    async read(text: string, final = false): Promise<SubtitleSourceCue[]> {
        this.pending += text;
        const lines = this.pending.split(assLineBreakRegex);
        this.pending = final ? '' : lines.pop()!;
        const dialogues: string[] = [];
        for (const line of lines) {
            if (assEventsHeaderRegex.test(line.trim())) this.events = true;
            if (assDialogueRegex.test(line)) {
                if (!this.events) throw new Error('ASS dialogue arrived before the events header');
                dialogues.push(line);
            } else if (this.cueId === 0 && !dialogues.length) {
                this.header.push(line);
            }
        }
        if (final && !this.events) throw new Error('Subtitle response did not contain an ASS events header');
        if (!dialogues.length) return [];
        const nodes = await this.reader.subtitles([
            { fileParts: [new File([`${this.header.join('\n')}\n${dialogues.join('\n')}\n`], 'subtitles.ass')] },
        ]);
        const cues: SubtitleSourceCue[] = [];
        for (const node of nodes) {
            if (
                this.previous &&
                this.previous.start === node.start &&
                this.previous.end === node.end &&
                this.previous.text === node.text
            ) {
                continue;
            }
            this.previous = {
                cueId: this.cueId++,
                start: node.start,
                end: node.end,
                text: node.text,
                tokenization: node.tokenization,
            };
            cues.push(this.previous);
        }
        return cues;
    }
}
