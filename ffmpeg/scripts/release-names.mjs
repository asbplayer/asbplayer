import project from '../../project.json' with { type: 'json' };

const { releaseTitle, releaseTag, artifact, sources } = project.releases.ffmpeg;

/** Development version; published app builds use artifact-lock.json instead. */
export const runtimeVersion = project.releases.ffmpeg.version;

/** Public release names shared by packaging, selection, CI, and the client build. */
export const releaseNames = (version) => {
    const resolve = (template) => template.replaceAll('{{version}}', version);
    const sourcesRoot = resolve(sources);
    return {
        tag: resolve(releaseTag),
        title: resolve(releaseTitle),
        runtimeArchive: `${resolve(artifact)}.tar.gz`,
        sourcesArchive: `${sourcesRoot}.tar.gz`,
        sourcesRoot,
    };
};
