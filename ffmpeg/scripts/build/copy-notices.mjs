import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageRoot, readJson } from '../lib.mjs';
import { runtimeVersion as version } from '../release-names.mjs';

const { notices } = await readJson(resolve(packageRoot, 'runtime-assets.json'));
const noticeSources = {
    'FFmpeg-LGPL-3.0.txt': '.cache/sources/ffmpeg/COPYING.LGPLv3',
    'FFmpeg-GPL-3.0.txt': '.cache/sources/ffmpeg/COPYING.GPLv3',
    'Opus-BSD.txt': '.cache/sources/opus/COPYING',
    'zlib-LICENSE.txt': '.cache/sources/zlib/LICENSE',
    'asbplayer-AGPL-3.0-or-later.txt': '../LICENSE',
};

for (const filename of notices) {
    const source = resolve(packageRoot, noticeSources[filename] ?? `.cache/docker-output/notices/${filename}`);
    await copyFile(source, resolve(packageRoot, 'dist', version, 'notices', filename));
}
