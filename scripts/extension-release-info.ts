import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type projectConfig from '../project.json';

export function extensionReleaseInfo({
    version,
    artifacts,
}: {
    version: string;
    artifacts: Pick<typeof projectConfig.artifacts, 'extension'>;
}) {
    const { prefix, tagPrefix } = artifacts.extension;
    const artifactTemplate = `${prefix}-{{version}}-{{browser}}.zip`;
    const sourcesTemplate = `${prefix}-{{version}}-sources.zip`;
    const filename = (browser: string) =>
        artifactTemplate.replaceAll('{{version}}', version).replaceAll('{{browser}}', browser);
    return {
        version,
        tag: `${tagPrefix}${version}`,
        artifactTemplate,
        sourcesTemplate,
        chrome: filename('chrome'),
        firefox: filename('firefox'),
        firefoxAndroid: filename('firefox-android'),
        sources: sourcesTemplate.replaceAll('{{version}}', version),
        title: `${prefix}-extension-v${version}`,
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const project: typeof projectConfig = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8'));
    const [field, version = project.version] = process.argv.slice(2);
    const info = extensionReleaseInfo({ ...project, version });
    if (field === undefined) {
        for (const [key, value] of Object.entries(info)) {
            process.stdout.write(`${key}=${value}\n`);
        }
    } else {
        if (!Object.hasOwn(info, field)) throw new Error(`Unknown extension release field: ${field}`);
        process.stdout.write(`${info[field as keyof typeof info]}\n`);
    }
}
