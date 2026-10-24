import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageRoot, readJson } from './lib.mjs';
import { runtimeVersion as version } from './release-names.mjs';

const { notices } = await readJson(resolve(packageRoot, 'runtime-assets.json'));
for (const filename of notices) {
    const source =
        filename === 'FFmpeg-LGPL-2.1.txt'
            ? resolve(packageRoot, '.cache/sources/ffmpeg/COPYING.LGPLv2.1')
            : filename === 'asbplayer-AGPL-3.0-or-later.txt'
              ? resolve(packageRoot, '../LICENSE')
              : resolve(packageRoot, '.cache/docker-output/notices', filename);
    await copyFile(source, resolve(packageRoot, 'dist', version, 'notices', filename));
}
