import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectedRuntimeMetadata } from '@project/ffmpeg/selected-runtime';
import type { FfmpegRuntimeArchive } from '@project/ffmpeg/metadata';
import artifactLock from '@project/ffmpeg/artifact-lock.json' with { type: 'json' };
import buildConfig from '@project/ffmpeg/build-config.json' with { type: 'json' };
import { releaseNames, runtimeVersion } from '@project/ffmpeg/release-names';
import { prepareRuntime } from '@project/ffmpeg/prepare-runtime';

const runtimeDefines = (metadata: {
    runtimeVersion: string;
    ffmpegVersion: string;
    runtimeArchive: FfmpegRuntimeArchive;
}) => ({
    __ASB_FFMPEG_RUNTIME_ARCHIVE__: JSON.stringify(metadata.runtimeArchive),
    __ASB_FFMPEG_RUNTIME_VERSION__: JSON.stringify(metadata.runtimeVersion),
    __ASB_FFMPEG_VERSION__: JSON.stringify(metadata.ffmpegVersion),
});

export const createFfmpegBuildConfig = async ({
    candidate,
    base,
    prepare = true,
}: {
    candidate: boolean;
    base: string;
    /** Preview serves an existing build without acquiring or verifying its inputs again. */
    prepare?: boolean;
}) => {
    const metadata = {
        ...selectedRuntimeMetadata,
        runtimeArchive: {
            ...selectedRuntimeMetadata.runtimeArchive,
            url: `${base.replace(/\/?$/, '/')}ffmpeg/runtime.tgz`,
        },
    };
    if (!prepare) return { define: runtimeDefines(metadata), copyTargets: [] };

    let archivePath: string;
    if (candidate) {
        const filename = releaseNames(runtimeVersion).runtimeArchive;
        archivePath = fileURLToPath(new URL(`../ffmpeg/release/${filename}`, import.meta.url));
        execFileSync(
            process.execPath,
            [fileURLToPath(new URL('../ffmpeg/scripts/verify-artifacts.mjs', import.meta.url)), '--candidate'],
            { stdio: 'inherit' }
        );
        const bytes = readFileSync(archivePath);
        metadata.runtimeVersion = runtimeVersion;
        metadata.ffmpegVersion = buildConfig.ffmpeg.version;
        metadata.runtimeArchive.sha256 = createHash('sha256').update(bytes).digest('hex');
        metadata.runtimeArchive.bytes = bytes.byteLength;
    } else {
        archivePath = await prepareRuntime(artifactLock);
    }
    return {
        define: runtimeDefines(metadata),
        // Vite treats *.gz as Content-Encoding: gzip; .tgz preserves the archive bytes for hashing.
        copyTargets: [{ src: archivePath, dest: 'ffmpeg', rename: 'runtime.tgz' }],
    };
};
