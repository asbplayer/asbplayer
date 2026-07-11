import { WavHeader, Mp3Encoder } from 'lamejs';
import { SerializableAudioBuffer } from './mp3-encoder';

const samplesPerFrame = 1152;
const bitRate = 192;

// https://stackoverflow.com/questions/61264581/how-to-convert-audio-buffer-to-mp3-in-javascript
class Wav {
    header: any;
    samples: Int16Array;

    constructor(audioBuffer: SerializableAudioBuffer) {
        const length = audioBuffer.length * audioBuffer.numberOfChannels * 2 + 44;
        const view = new View(new DataView(new ArrayBuffer(length)));
        view.setUint32(0x46464952); // "RIFF"
        view.setUint32(length - 8); // file length - 8
        view.setUint32(0x45564157); // "WAVE"
        view.setUint32(0x20746d66); // "fmt " chunk
        view.setUint32(16); // length = 16
        view.setUint16(1); // PCM (uncompressed)
        view.setUint16(audioBuffer.numberOfChannels);
        view.setUint32(audioBuffer.sampleRate);
        view.setUint32(audioBuffer.sampleRate * 2 * audioBuffer.numberOfChannels); // avg. bytes/sec
        view.setUint16(audioBuffer.numberOfChannels * 2); // block-align
        view.setUint16(16); // 16-bit
        view.setUint32(0x61746164); // "data" - chunk
        view.setUint32(length - view.position - 4); // chunk length

        const channels = audioBuffer.channels;

        let offset = 0;

        while (view.position < length) {
            for (let i = 0; i < audioBuffer.numberOfChannels; ++i) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(sample); // write 16-bit sample
            }

            ++offset; // next source sample
        }

        this.header = WavHeader.readHeader(view.dataView);
        this.samples = new Int16Array(view.dataView.buffer, this.header.dataOffset, this.header.dataLen / 2);
    }
}

class View {
    dataView: DataView;
    position: number;

    constructor(dataView: DataView) {
        this.dataView = dataView;
        this.position = 0;
    }

    setUint16(data: number) {
        this.dataView.setUint16(this.position, data, true);
        this.position += 2;
    }

    setUint32(data: number) {
        this.dataView.setUint32(this.position, data, true);
        this.position += 4;
    }

    setInt16(data: number) {
        this.dataView.setInt16(this.position, data, true);
        this.position += 2;
    }
}

async function encode(audioBuffer: SerializableAudioBuffer) {
    const wav = new Wav(audioBuffer);
    const channels = wav.header.channels;
    const sampleRate = wav.header.sampleRate;
    const samples = wav.samples;

    let left: Int16Array;
    let right: Int16Array | null = null;

    if (channels === 1) {
        left = new Int16Array(samples);
    } else if (channels === 2) {
        const leftSamples: number[] = [];
        const rightSamples: number[] = [];

        for (let i = 0; i < samples.length; i += 2) {
            leftSamples.push(samples[i]);
            rightSamples.push(samples[i + 1]);
        }

        left = new Int16Array(leftSamples);
        right = new Int16Array(rightSamples);
    } else {
        throw new Error('Unsupport number of channels ' + channels);
    }

    const buffer: Int8Array[] = [];
    const encoder = new Mp3Encoder(channels, sampleRate, bitRate);
    let remaining = samples.length;

    for (let i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
        const rightSubArray = right === null ? null : right.subarray(i, i + samplesPerFrame);
        const mp3Buff = encoder.encodeBuffer(left.subarray(i, i + samplesPerFrame), rightSubArray);

        if (mp3Buff.length > 0) {
            buffer.push(new Int8Array(mp3Buff));
        }

        remaining -= samplesPerFrame;
    }

    const data = encoder.flush();

    if (data.length > 0) {
        buffer.push(new Int8Array(data));
    }

    return buffer;
}

export function onMessage() {
    onmessage = async (e) => {
        postMessage({
            command: 'finished',
            buffer: await encode(e.data.audioBuffer),
        });
    };
}

onMessage();
