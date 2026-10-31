import project from '../../project.json' with { type: 'json' };
import artifactLock from '../artifact-lock.json' with { type: 'json' };
import { parseRuntimeVersion } from './runtime-version.mjs';

const { releaseTitle, releaseTag, artifact, sources } = project.releases.ffmpeg;

/** Candidates use the selected version; release builds temporarily override it without changing the lock. */
export const runtimeVersion = process.env.ASB_FFMPEG_RUNTIME_VERSION ?? artifactLock.runtimeVersion;
parseRuntimeVersion(runtimeVersion);

/** Public release names shared by packaging, selection, CI, and the client build. */
export const releaseNames = (version) => {
    const resolve = (template) => template.replaceAll('{{version}}', version);
    const runtimeRoot = resolve(artifact);
    const sourcesRoot = resolve(sources);
    return {
        tag: resolve(releaseTag),
        title: resolve(releaseTitle),
        runtimeArchive: `${runtimeRoot}.tar.gz`,
        runtimeRoot,
        sourcesArchive: `${sourcesRoot}.tar.gz`,
        sourcesRoot,
    };
};
