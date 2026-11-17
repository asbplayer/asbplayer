// jsdom does not expose structuredClone; settings consistency code clones
// defaults with it.
if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}
