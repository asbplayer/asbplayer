/**
 * Parse the canonical development/release version without reading project files or Git history.
 * @param {unknown} version
 * @returns {[bigint, bigint]}
 */
export const parseRuntimeVersion = (version) => {
    const match = typeof version === 'string' && /^0\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
    if (!match || match[0] !== version) {
        throw new Error(
            `FFmpeg runtime version must be 0.X.Y with no leading zeros or suffixes; received ${JSON.stringify(version)}`
        );
    }
    return [BigInt(match[1]), BigInt(match[2])];
};
