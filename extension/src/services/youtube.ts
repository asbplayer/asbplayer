import { base64ToBuffer, uint8ArrayToBase64 } from '@project/common/base64';

// Much of the POT decoding code was provided by @kekulta on https://github.com/asbplayer/asbplayer/pull/733
const computeHash = (input: string, start: number = 0, end: number = input.length) => {
    let hash = 0;

    for (let i = start; i < end; i++) {
        const code = input.charCodeAt(i);
        hash = (Math.imul(31, hash) + code) | 0;
    }

    return hash;
};

const transformData = (data: Uint8Array, videoId: string) => {
    const mid = videoId.length >> 1;
    const [key1, key2] = [computeHash(videoId, 0, mid), computeHash(videoId, mid)];
    const data32 = new Uint32Array(data.buffer);
    const firstWord = data32[0];

    for (let i = 1; i < data32.length; i += 2) {
        let a = firstWord;
        let b = i;
        let c = key1;
        let d = key2;

        for (let round = 0; round < 22; round++) {
            b = ((b >>> 8) | (b << 24)) + a;
            b ^= c + 38293;
            a = ((a << 3) | (a >>> 29)) ^ b;

            d = ((d >>> 8) | (d << 24)) + c;
            d ^= round + 38293;
            c = ((c << 3) | (c >>> 29)) ^ d;
        }

        data32[i] ^= a;
        if (i + 1 < data32.length) {
            data32[i + 1] ^= b;
        }
    }
};

const decodeCachedPoToken = (videoId: string, encodedPoToken: string) => {
    const data = base64ToBuffer(encodedPoToken);
    transformData(data, videoId);

    let index = 4;

    while (index < 7 && data[index] === 0) {
        index++;
    }

    // Not sure if these ever change, they're hardcoded in the original code. It's obviously for some kind of validation.
    const VALIDATION_BYTES = [196, 200, 224, 18];

    for (let i = 0; i < VALIDATION_BYTES.length; i++) {
        if (data[index++] !== VALIDATION_BYTES[i]) {
            return undefined;
        }
    }

    const timestamp = new DataView(data.buffer).getUint32(index);
    index += 4;

    // URL-safe base64 encoding
    const poToken = uint8ArrayToBase64(new Uint8Array(data.buffer, index))
        .replace(/\//g, '_')
        .replace(/\+/g, '-')
        .replace(/=+$/g, '');

    return {
        expires: new Date(timestamp * 1000),
        poToken,
    };
};

type Pot = {
    poToken: string;
    expires: Date;
};

export const decodePoToken = (videoId: string) => {
    // This is somehow hardcoded into base.js, maybe grep for it using regex if unstable.
    const potKeyString = window.sessionStorage.getItem('iU5q-!O9@$');

    if (!potKeyString) {
        return undefined;
    }

    const potKeys = potKeyString.split(',');
    let sessionPoToken: Pot | undefined = undefined;

    for (const key of potKeys) {
        const encodedToken = window.sessionStorage.getItem(key);

        if (!encodedToken) {
            continue;
        }

        const decodedToken = decodeCachedPoToken(videoId, encodedToken);

        if (decodedToken !== undefined) {
            sessionPoToken = decodedToken;
        }
    }

    return sessionPoToken;
};

export const fetchPlayerContextForPage = async () => {
    let trustedPolicy: any = undefined;

    if (window.trustedTypes !== undefined) {
        // YouTube doesn't define a default policy
        // we create a default policy to avoid errors that seem to be caused by chrome not supporting trustedScripts in Function sinks
        // If YT enforce a strict default policy in the future, we may need to revisit this
        // hopefully by then chrome will have fixed the issue: https://wpt.fyi/results/trusted-types/eval-function-constructor.html
        // (in chrome 127 the final test was failing)
        if (window.trustedTypes.defaultPolicy === null) {
            window.trustedTypes.createPolicy('default', {
                createHTML: (s: string) => s,
                createScript: (s: string) => s,
                createScriptURL: (s: string) => s,
            });
        }
        trustedPolicy = window.trustedTypes.createPolicy('passThrough', {
            createHTML: (s: string) => s,
            createScript: (s: string) => s,
        });
    }

    const playerContext = await fetch(window.location.href)
        .then((webResponse) => {
            if (!webResponse.ok) {
                throw new Error(
                    `YT Context Retrieval failed with Status ${webResponse.status}/${webResponse.statusText}...`
                );
            }
            return webResponse.text();
        })
        .then((pageString) => {
            if (trustedPolicy !== undefined) {
                pageString = trustedPolicy.createHTML(pageString);
            }

            return new window.DOMParser().parseFromString(pageString, 'text/html');
        })
        .then((page) => {
            const scriptElements = page.body.querySelectorAll('script');

            for (let i = 0; i < scriptElements.length; ++i) {
                const elm = scriptElements[i];

                if (elm.textContent?.includes('ytInitialPlayerResponse')) {
                    let scriptString = `${elm.textContent}; return ytInitialPlayerResponse;`;

                    if (trustedPolicy !== undefined) {
                        scriptString = trustedPolicy.createScript(scriptString);
                    }

                    const context = new Function(scriptString)();

                    if (context) {
                        return context;
                    }
                }
            }

            return undefined;
        });

    return playerContext;
};
