import { asbError } from '@project/common/util';
import type { RectModel } from '@project/common/src/model';

export const resizeCanvas = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    maxWidth: number,
    maxHeight: number
): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const widthRatio = maxWidth <= 0 ? 1 : maxWidth / canvas.width;
        const heightRatio = maxHeight <= 0 ? 1 : maxHeight / canvas.height;
        const ratio = Math.min(1, Math.min(widthRatio, heightRatio));

        if (ratio < 1) {
            const newWidth = canvas.width * ratio;
            const newHeight = canvas.height * ratio;
            createImageBitmap(canvas, { resizeWidth: newWidth, resizeHeight: newHeight, resizeQuality: 'high' })
                .then((sprite) => {
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    ctx.drawImage(sprite, 0, 0);
                    resolve(canvas);
                })
                .catch((e) => reject(e));
        } else {
            resolve(canvas);
        }
    });
};

export const cropAndResize = async (
    maxWidth: number,
    maxHeight: number,
    rect: RectModel,
    imageDataUrl: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = async () => {
            const canvas = document.createElement('canvas');
            const r = window.devicePixelRatio;
            const width = rect.width * r;
            const height = rect.height * r;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, rect.left * r, rect.top * r, width, height, 0, 0, width, height);

            if (maxWidth > 0 || maxHeight > 0) {
                try {
                    await resizeCanvas(canvas, ctx, maxWidth, maxHeight);
                    resolve(canvas.toDataURL('image/jpeg'));
                } catch (e) {
                    asbError('image', 'Failed to crop and resize image: ' + e);
                    reject(e);
                }
            } else {
                resolve(canvas.toDataURL('image/jpeg'));
            }
        };

        image.src = imageDataUrl;
    });
};
