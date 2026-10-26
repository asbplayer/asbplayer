import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectedRuntimeMetadata } from '@project/ffmpeg/selected-runtime';
import type { FfmpegRuntimeArchive } from '@project/ffmpeg/metadata';
import buildConfig from '@project/ffmpeg/build-config.json' with { type: 'json' };
import { releaseNames, runtimeVersion } from '@project/ffmpeg/release-names';

const runtimeDefines = (metadata: {
    runtimeVersion: string;
    ffmpegVersion: string;
    runtimeArchive: FfmpegRuntimeArchive;
    releaseApiUrl: string | null;
}) => ({
    __ASB_FFMPEG_RUNTIME_ARCHIVE__: JSON.stringify(metadata.runtimeArchive),
    __ASB_FFMPEG_RELEASE_API_URL__: JSON.stringify(metadata.releaseApiUrl),
    __ASB_FFMPEG_RUNTIME_VERSION__: JSON.stringify(metadata.runtimeVersion),
    __ASB_FFMPEG_VERSION__: JSON.stringify(metadata.ffmpegVersion),
});

export const createFfmpegBuildConfig = ({ candidate, base }: { candidate: boolean; base: string }) => {
    if (!candidate) return { define: runtimeDefines(selectedRuntimeMetadata), copyTargets: [] };

    const filename = releaseNames(runtimeVersion).runtimeArchive;
    const archivePath = fileURLToPath(new URL(`../ffmpeg/release/${filename}`, import.meta.url));
    execFileSync(
        process.execPath,
        [fileURLToPath(new URL('../ffmpeg/scripts/verify-artifacts.mjs', import.meta.url)), '--candidate'],
        { stdio: 'inherit' }
    );
    const bytes = readFileSync(archivePath);
    // Vite marks *.gz files as Content-Encoding: gzip; serve plain archive bytes for verification.
    const servedName = filename.replace(/\.tar\.gz$/, '.tgz');
    return {
        define: runtimeDefines({
            runtimeVersion,
            ffmpegVersion: buildConfig.ffmpeg.version,
            runtimeArchive: {
                url: `${base.replace(/\/?$/, '/')}ffmpeg/${servedName}`,
                sha256: createHash('sha256').update(bytes).digest('hex'),
                bytes: bytes.byteLength,
            },
            releaseApiUrl: null,
        }),
        copyTargets: [{ src: archivePath, dest: 'ffmpeg', rename: servedName }],
    };
};
