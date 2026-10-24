import project from '../../project.json' with { type: 'json' };

const { prefix, tagPrefix } = project.artifacts.ffmpeg;

/** Development version; published app builds use artifact-lock.json instead. */
export const runtimeVersion = project.artifacts.ffmpeg.version;

/** Public release names shared by packaging, selection, CI, and the client build. */
export const releaseNames = (version) => {
    const stem = `${prefix}-${version}`;
    return {
        tag: `${tagPrefix}${version}`,
        title: `${prefix}-v${version}`,
        runtimeArchive: `${stem}-runtime.tar.gz`,
        sourcesArchive: `${stem}-sources.tar.gz`,
        sourcesRoot: `${stem}-sources`,
    };
};
