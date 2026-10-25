import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type projectConfig from '../project.json';

export function ankiReleaseInfo({
    version,
    releaseTitle,
    artifact,
    releaseTag,
}: typeof projectConfig.releases.ankiAddon) {
    const info = {
        version,
        filename: artifact.replaceAll('{{version}}', version),
        tag: releaseTag.replaceAll('{{version}}', version),
        title: releaseTitle.replaceAll('{{version}}', version),
    };
    if (/[\/\\\0]/.test(info.filename))
        throw new Error('Anki release filename must not contain path separators or NUL');
    if (Object.values(info).some((value) => /[\r\n]/.test(value))) {
        throw new Error('Release metadata must not contain newlines');
    }
    return info;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const project: typeof projectConfig = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8'));
    const info = ankiReleaseInfo(project.releases.ankiAddon);
    const field = process.argv[2];
    if (field === undefined) {
        for (const [key, value] of Object.entries(info)) {
            process.stdout.write(`${key}=${value}\n`);
        }
    } else {
        if (!Object.hasOwn(info, field)) throw new Error(`Unknown Anki release field: ${field}`);
        process.stdout.write(`${info[field as keyof typeof info]}\n`);
    }
}
