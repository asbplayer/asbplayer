import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename } from 'node:path';

const [mapPath, noticesRoot] = process.argv.slice(2);
if (!mapPath || !noticesRoot) throw new Error('Usage: verify-system-notices.mjs <link-map> <notices-directory>');

const map = await readFile(mapPath, 'utf8');
const systemLibraries = new Set(
    [...map.matchAll(/\/emsdk\/upstream\/emscripten\/cache\/sysroot\/lib\/wasm32-emscripten\/([^(: ]+\.a)\(/g)].map(
        ([, library]) => library
    )
);
if (systemLibraries.size === 0) throw new Error('No Emscripten system libraries were found in the linker map');

const requiredNotices = new Map([
    ['libc.a', ['Emscripten-MIT.txt', 'musl-COPYRIGHT.txt']],
    ['libc++-noexcept.a', ['libcxx-Apache-2.0.txt']],
    ['libc++abi-noexcept.a', ['libcxxabi-LICENSE.txt']],
    ['libclang_rt.builtins.a', ['compiler-rt-LICENSE.txt']],
    ['libdlmalloc.a', []],
    ['libnoexit.a', ['Emscripten-MIT.txt']],
    ['libstubs.a', ['Emscripten-MIT.txt']],
]);

for (const library of systemLibraries) {
    const notices = requiredNotices.get(library);
    if (notices === undefined) throw new Error(`No notice policy is recorded for ${library}`);
    for (const notice of notices) {
        await access(`${noticesRoot}/${notice}`, constants.R_OK);
    }
}

process.stdout.write(
    `Verified system-library notices for ${[...systemLibraries]
        .map((library) => basename(library))
        .sort()
        .join(', ')}\n`
);
