/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MAX_ARCHIVE_LISTING_BYTES = 64 * 1024 * 1024;

const validateSingleArchiveRoot = (paths, archiveDescription) => {
    const normalizedPaths = paths.map((listedPath) => listedPath.replace(/\/$/, ''));
    if (
        normalizedPaths.some((path) => {
            const components = path.split('/');
            return (
                path === '' ||
                path.startsWith('/') ||
                path.includes('\\') ||
                components.some((component) => component === '' || component === '.' || component === '..')
            );
        })
    ) {
        throw new Error(archiveDescription + ' contains an unsafe path');
    }

    const roots = new Set(normalizedPaths.map((path) => path.split('/')[0]));
    if (roots.size !== 1) throw new Error(archiveDescription + ' must contain exactly one archive root');
    const [root] = roots;
    if (!/^[A-Za-z0-9._-]+$/.test(root)) {
        throw new Error(archiveDescription + ' has an invalid archive root');
    }
    if (!paths.some((listedPath) => listedPath === root || listedPath === `${root}/`)) {
        throw new Error(archiveDescription + ' has no root directory');
    }
    return root;
};

const verifyArchiveEntryTypes = (listing, archiveDescription) => {
    const entries = listing.trim().split('\n').filter(Boolean);
    if (entries.some((entry) => !['d', '-'].includes(entry[0]))) {
        throw new Error(archiveDescription + ' contains a link or special file');
    }
};

const verifyGzipArchive = async (archivePath, expectedRoot, archiveDescription) => {
    const { stdout: listing } = await execFileAsync('tar', ['-tzf', archivePath], {
        maxBuffer: MAX_ARCHIVE_LISTING_BYTES,
    });
    const paths = listing.trim().split('\n').filter(Boolean);
    if (validateSingleArchiveRoot(paths, archiveDescription) !== expectedRoot) {
        throw new Error(archiveDescription + ' has an unexpected root directory');
    }

    const { stdout: verboseListing } = await execFileAsync('tar', ['-tvzf', archivePath], {
        maxBuffer: MAX_ARCHIVE_LISTING_BYTES,
    });
    verifyArchiveEntryTypes(verboseListing, archiveDescription);
    return paths;
};

const verifyRuntimeArchive = (archivePath, expectedRoot) =>
    verifyGzipArchive(archivePath, expectedRoot, 'Runtime archive');

const verifySourcesArchive = (archivePath, expectedRoot) =>
    verifyGzipArchive(archivePath, expectedRoot, 'Sources archive');

module.exports = { verifyRuntimeArchive, verifySourcesArchive };
