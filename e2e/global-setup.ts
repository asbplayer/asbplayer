import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_BUILD_DIR, EXTENSION_DIR, REPO_DIR } from './fixtures/paths';

function run(command: string, args: string[], cwd: string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
        );
    });
}

const missing = (dir: string, file: string) => !fs.existsSync(path.join(dir, file));

export default async function globalSetup() {
    // The extension and the web app are independent builds; run them side by side.
    const builds: Promise<void>[] = [];

    if (missing(EXTENSION_DIR, 'manifest.json')) {
        console.log('e2e: extension build missing, building @project/extension...');
        builds.push(run('pnpm', ['--filter', '@project/extension', 'run', 'build'], REPO_DIR));
    }

    if (missing(CLIENT_BUILD_DIR, 'index.html')) {
        console.log('e2e: client build missing, building @project/client...');
        builds.push(run('pnpm', ['--filter', '@project/client', 'run', 'buildFast'], REPO_DIR));
    }

    await Promise.all(builds);
}
