import { bufferToBase64 } from '@project/common/base64';

export class TimedRecordingInProgressError extends Error {}
export class NoRecordingInProgressError extends Error {}

export default class AudioRecorder {
    private recording: boolean;
    private recorder: MediaRecorder | null;
    private stream: MediaStream | null;
    private blobPromise: Promise<Blob> | null;
    private timeoutId?: ReturnType<typeof setTimeout>;
    private timeoutResolve?: (base64: string) => void;

    constructor() {
        this.recording = false;
        this.recorder = null;
        this.stream = null;
        this.blobPromise = null;
    }

    startWithTimeout(
        stream: MediaStream,
        time: number,
        onStartedCallback: () => void,
        doNotManageStream: boolean = false
    ): Promise<string> {
        if (this.recording) {
            console.error('Already recording, cannot start with timeout.');
            return Promise.reject('Already recording');
        }

        return this.start(stream, doNotManageStream).then(() => {
            onStartedCallback();

            return new Promise((resolve, reject) => {
                this.timeoutResolve = resolve;
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = undefined;
                    void this.stop(doNotManageStream).then(resolve, reject);
                }, time);
            });
        });
    }

    start(stream: MediaStream, doNotManageStream: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.recording) {
                reject('Already recording, cannot start');
                return;
            }

            try {
                const recorder = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];
                recorder.ondataavailable = (e) => {
                    chunks.push(e.data);
                };
                this.blobPromise = new Promise((resolve) => {
                    recorder.onstop = () => {
                        resolve(new Blob(chunks));
                    };
                });
                recorder.start();

                if (!doNotManageStream) {
                    const output = new AudioContext();
                    const source = output.createMediaStreamSource(stream);
                    source.connect(output.destination);
                }

                this.recorder = recorder;
                this.recording = true;
                this.stream = stream;
                resolve(undefined);
            } catch (e) {
                reject(e);
            }
        });
    }

    async stopSafely(doNotManageStream: boolean = false) {
        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;

        if (!doNotManageStream) {
            this.stream?.getTracks()?.forEach((t) => t.stop());
            this.stream = null;
        }

        if (this.blobPromise !== null) {
            const blob = await this.blobPromise;
            this.blobPromise = null;
            const base64 = bufferToBase64(await blob.arrayBuffer());

            if (this.timeoutId !== undefined) {
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
                this.timeoutResolve?.(base64);
                this.timeoutResolve = undefined;
            }
        }
    }

    async stop(doNotManageStream: boolean = false): Promise<string> {
        if (!this.recording) {
            throw new NoRecordingInProgressError();
        }

        this.recording = false;
        this.recorder?.stop();
        this.recorder = null;

        if (!doNotManageStream) {
            this.stream?.getTracks()?.forEach((t) => t.stop());
            this.stream = null;
        }

        const blob = await this.blobPromise;
        this.blobPromise = null;
        const base64 = bufferToBase64(await blob!.arrayBuffer());

        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
            this.timeoutResolve?.(base64);
            this.timeoutResolve = undefined;
            throw new TimedRecordingInProgressError();
        }

        return base64;
    }
}
