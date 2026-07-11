export interface SerializableAudioBuffer {
    channels: Float32Array[];
    numberOfChannels: number;
    length: number;
    sampleRate: number;
}

export default class Mp3Encoder {
    static async encode(blob: Blob, workerFactory: () => Worker | Promise<Worker>): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioContext = new AudioContext();

                    if (e.target === null) {
                        reject(new Error('Could not obtain buffer to encode'));
                        return;
                    }

                    const audioBuffer = await audioContext.decodeAudioData(e.target.result as ArrayBuffer);
                    const channels: Float32Array[] = [];

                    for (let i = 0; i < audioBuffer.numberOfChannels; ++i) {
                        channels.push(audioBuffer.getChannelData(i));
                    }

                    const workerValue = workerFactory();
                    const worker = workerValue instanceof Worker ? workerValue : await workerValue;
                    worker.postMessage({
                        command: 'encode',
                        audioBuffer: {
                            channels: channels,
                            numberOfChannels: audioBuffer.numberOfChannels,
                            length: audioBuffer.length,
                            sampleRate: audioBuffer.sampleRate,
                        },
                    });
                    worker.onmessage = (e) => {
                        resolve(new Blob(e.data.buffer, { type: 'audio/mp3' }));
                        worker.terminate();
                    };
                    worker.onerror = (e) => {
                        const error = e?.error ?? new Error('MP3 encoding failed: ' + e?.message);
                        reject(error);
                        worker.terminate();
                    };
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsArrayBuffer(blob);
        });
    }
}
