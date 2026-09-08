export function bufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer);
    return uint8ArrayToBase64(bytes);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const length = bytes.byteLength;

    for (let i = 0; i < length; ++i) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

export async function urlToBase64(url: string): Promise<string> {
    return bufferToBase64(await (await fetch(url)).arrayBuffer());
}

export const blobToBase64 = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reject(reader.error ?? new Error('Could not read blob as base64'));
        };
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.substring(result.indexOf(',') + 1);
            resolve(base64);
        };
        reader.readAsDataURL(blob);
    });
};

export const base64ToBuffer = (base64: string) => {
    const decoded = atob(base64);
    const buffer = new Uint8Array(decoded.length);

    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = decoded.charCodeAt(i);
    }

    return buffer;
};

export const base64ToBlob = (base64: string, mimeType: string) => {
    const buffer = base64ToBuffer(base64);
    return new Blob([buffer.buffer], { type: mimeType });
};
