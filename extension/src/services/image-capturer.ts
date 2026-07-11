import { CropAndResizeMessage, ExtensionToVideoCommand, ImageCaptureParams, RectModel } from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { captureVisibleTab } from './capture-visible-tab';

export interface CaptureOptions {
    maxWidth: number;
    maxHeight: number;
    rect: RectModel;
    frameId?: string;
}

export default class ImageCapturer {
    private readonly settings: SettingsProvider;
    private imageBase64Promise: Promise<string> | undefined;
    private imageBase64Resolve: ((value: string) => void) | undefined;
    private imageBase64Reject: ((error: any) => void) | undefined;
    private lastCaptureTimeoutId?: ReturnType<typeof setTimeout>;

    private _capturing = false;
    private _lastImageBase64?: string;

    constructor(settings: SettingsProvider) {
        this.settings = settings;
    }

    get lastImageBase64() {
        return this._lastImageBase64;
    }

    capture(tabId: number, src: string, delay: number, captureParams: ImageCaptureParams): Promise<string> {
        if (this._capturing) {
            return Promise.reject(new Error('Already capturing visible tab'));
        }

        this._lastImageBase64 = undefined;

        if (
            this.imageBase64Resolve !== undefined &&
            this.imageBase64Reject !== undefined &&
            this.imageBase64Promise !== undefined
        ) {
            this._captureWithDelay(tabId, src, delay, captureParams, this.imageBase64Resolve, this.imageBase64Reject);
            return this.imageBase64Promise;
        }

        this.imageBase64Promise = new Promise((resolve, reject) => {
            this.imageBase64Resolve = resolve;
            this.imageBase64Reject = reject;
            this._captureWithDelay(tabId, src, delay, captureParams, this.imageBase64Resolve, this.imageBase64Reject);
        });

        return this.imageBase64Promise;
    }

    private _captureWithDelay(
        tabId: number,
        src: string,
        delay: number,
        captureParams: ImageCaptureParams,
        resolve: (value: string) => void,
        reject: (error: any) => void
    ) {
        const timeoutId = setTimeout(() => {
            this._capturing = true;
            captureVisibleTab(tabId)
                .then(async (dataUrl) => {
                    try {
                        this._capturing = false;

                        if (timeoutId !== this.lastCaptureTimeoutId) {
                            // The promise was already resolved by another call to capture with a shorter delay
                            return;
                        }

                        const croppedDataUrl = await this._cropAndResize(dataUrl, tabId, src, captureParams);

                        if (timeoutId !== this.lastCaptureTimeoutId) {
                            // The promise was already resolved by another call to capture with a shorter delay
                            return;
                        }

                        this._lastImageBase64 = croppedDataUrl.substring(croppedDataUrl.indexOf(',') + 1);
                        resolve(this._lastImageBase64);
                    } catch (e) {
                        reject(e);
                    }
                })
                .catch(reject)
                .finally(() => {
                    this._capturing = false;
                    this.imageBase64Promise = undefined;
                    this.imageBase64Resolve = undefined;
                    this.imageBase64Reject = undefined;
                    this.lastCaptureTimeoutId = undefined;
                });
        }, delay);
        this.lastCaptureTimeoutId = timeoutId;
    }

    private async _cropAndResize(
        dataUrl: string,
        tabId: number,
        src: string,
        imageCaptureParams: ImageCaptureParams
    ): Promise<string> {
        const cropScreenshot = await this.settings.getSingle('streamingCropScreenshot');

        if (!cropScreenshot) {
            return dataUrl;
        }

        const cropAndResizeCommand: ExtensionToVideoCommand<CropAndResizeMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'crop-and-resize', dataUrl, ...imageCaptureParams },
            src: src,
        };

        const response = await browser.tabs.sendMessage(tabId, cropAndResizeCommand);
        return response.dataUrl;
    }
}
