import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type projectConfig from '../project.json';

type ExtensionReleaseProject = {
    version: string;
    releases: Pick<typeof projectConfig.releases, 'extension'>;
    extension: {
        [Browser in keyof typeof projectConfig.extension]: Pick<(typeof projectConfig.extension)[Browser], 'artifact'>;
    };
};

export function extensionReleaseInfo({ version, releases, extension }: ExtensionReleaseProject) {
    const { releaseTitle, releaseTag, sources: sourcesTemplate } = releases.extension;
    const resolve = (template: string) => template.replaceAll('{{version}}', version);
    const chromeTemplate = extension.chrome.artifact;
    const firefoxTemplate = extension.firefox.artifact;
    const firefoxAndroidTemplate = extension.firefoxAndroid.artifact;
    return {
        version,
        tag: resolve(releaseTag),
        chromeTemplate,
        firefoxTemplate,
        firefoxAndroidTemplate,
        sourcesTemplate,
        chrome: resolve(chromeTemplate),
        firefox: resolve(firefoxTemplate),
        firefoxAndroid: resolve(firefoxAndroidTemplate),
        sources: resolve(sourcesTemplate),
        title: resolve(releaseTitle),
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
