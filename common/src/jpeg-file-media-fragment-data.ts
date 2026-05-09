import { resizeCanvas } from './image-transformer';
import {
    CancelledMediaFragmentDataRenderingError,
    createVideoElement,
    disposeVideoElement,
    makeMediaFragmentFileName,
    type MediaFragmentData,
    mediaFragmentErrorForFile,
} from './media-fragment';
import { FileModel, MediaFragmentErrorCode } from './model';

export const defaultJpegCompressionQuality = 0.85;

const resolveJpegCompressionQuality = (quality: number) => {
    if (!Number.isFinite(quality)) {
        return defaultJpegCompressionQuality;
    }

    return Math.max(0, Math.min(1, quality));
};

export class JpegFileMediaFragmentData implements MediaFragmentData {
    private readonly _file: FileModel;
    private readonly _timestamp: number;
    private readonly _maxWidth: number;
    private readonly _maxHeight: number;
    private readonly _name: string;
    private readonly _jpegCompressionQuality: number;
    private _video?: HTMLVideoElement;
    private _canvas?: HTMLCanvasElement;
    private _canvasPromise?: Promise<HTMLCanvasElement>;
    private _canvasPromiseReject?: (error: Error) => void;

    constructor(
        file: FileModel,
        timestamp: number,
        maxWidth: number,
        maxHeight: number,
        jpegCompressionQuality: number = defaultJpegCompressionQuality,
        video?: HTMLVideoElement,
        canvas?: HTMLCanvasElement
    ) {
        this._file = file;
        this._name = `${makeMediaFragmentFileName(file.name, timestamp)}.jpeg`;
        this._timestamp = timestamp;
        this._maxWidth = maxWidth;
        this._maxHeight = maxHeight;
        this._jpegCompressionQuality = resolveJpegCompressionQuality(jpegCompressionQuality);
        this._video = video;
        this._canvas = canvas;
    }

    get name() {
        return this._name;
    }

    get timestamp() {
        return this._timestamp;
    }

    get extension() {
        return 'jpeg';
    }

    get error(): MediaFragmentErrorCode | undefined {
        return mediaFragmentErrorForFile(this._file);
    }

    atTimestamp(timestamp: number) {
        if (timestamp === this._timestamp) {
            return this;
        }

        const canvasPromiseReject = this._canvasPromiseReject;
        if (canvasPromiseReject) {
            this._canvasPromise = undefined;
            this._canvasPromiseReject = undefined;
            canvasPromiseReject(new CancelledMediaFragmentDataRenderingError());
        }

        return new JpegFileMediaFragmentData(
            this._file,
            timestamp,
            this._maxWidth,
            this._maxHeight,
            this._jpegCompressionQuality,
            this._video,
            this._canvas
        );
    }

    get canChangeTimestamp() {
        return true;
    }

    async base64(): Promise<string> {
        const canvas = await this._getCanvas();
        const dataUrl = canvas.toDataURL('image/jpeg', this._jpegCompressionQuality);
        return dataUrl.substring(dataUrl.indexOf(',') + 1);
    }

    async blob(): Promise<Blob> {
        const canvas = await this._getCanvas();
        return await new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob === null) {
                        reject(new Error('Could not obtain blob'));
                    } else {
                        resolve(blob);
                    }
                },
                'image/jpeg',
                this._jpegCompressionQuality
            );
        });
    }

    async dataUrl() {
        const canvas = await this._getCanvas();
        return canvas.toDataURL('image/jpeg', this._jpegCompressionQuality);
    }

    private async _getCanvas(): Promise<HTMLCanvasElement> {
        if (this._canvasPromise) {
            return this._canvasPromise;
        }

        let canvasPromise: Promise<HTMLCanvasElement>;
        canvasPromise = this._renderCanvas().catch((error) => {
            if (this._canvasPromise === canvasPromise) {
                this._canvasPromise = undefined;
            }

            this._canvasPromiseReject = undefined;
            throw error;
        });
        this._canvasPromise = canvasPromise;
        return canvasPromise;
    }

    private async _renderCanvas(): Promise<HTMLCanvasElement> {
        const video = await this._videoElement(this._file);
        const calculateCurrentTime = () => Math.max(0, Math.min(video.duration, this._timestamp / 1000));

        return await new Promise((resolve, reject) => {
            let settled = false;

            const cleanup = () => {
                video.removeEventListener('loadedmetadata', onLoadedMetadata);
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onVideoError);
            };

            const fail = (error: unknown) => {
                if (settled) {
                    return;
                }

                settled = true;
                cleanup();
                this._canvasPromiseReject = undefined;
                reject(error instanceof Error ? error : new Error(String(error)));
            };

            const finish = () => {
                this._drawCanvas(video)
                    .then((canvas) => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        cleanup();
                        this._canvasPromiseReject = undefined;
                        resolve(canvas);
                    })
                    .catch(fail);
            };

            const onSeeked = () => {
                finish();
            };

            const onVideoError = () => {
                fail(new Error(video.error?.message ?? 'Could not load video to obtain screenshot'));
            };

            const onLoadedMetadata = () => {
                video.currentTime = calculateCurrentTime();
            };

            this._canvasPromiseReject = (error) => {
                fail(error);
            };

            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onVideoError, { once: true });

            if (Number.isFinite(video.duration)) {
                video.currentTime = calculateCurrentTime();
            } else {
                video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            }
        });
    }

    private async _drawCanvas(video: HTMLVideoElement): Promise<HTMLCanvasElement> {
        if (!this._canvas) {
            this._canvas = document.createElement('canvas');
        }

        const canvas = this._canvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (this._maxWidth > 0 || this._maxHeight > 0) {
            await resizeCanvas(canvas, ctx!, this._maxWidth, this._maxHeight);
        }

        return canvas;
    }

    private async _videoElement(file: FileModel): Promise<HTMLVideoElement> {
        if (!this._video) {
            this._video = await createVideoElement(file.blobUrl);
        }

        return this._video;
    }

    dispose() {
        disposeVideoElement(this._video);
        this._video = undefined;
        this._canvas?.remove();
    }
}
