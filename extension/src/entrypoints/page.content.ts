import project from '@project/common/project';
import { asbError } from '@project/common/util/log';
import { currentPageDelegate } from '@/services/pages';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

const excludeGlobs = [`*://${new URL(project.urls.app).hostname}/*`];

if (import.meta.env.DEV) {
    excludeGlobs.push(`*://${project.development.host}:${project.development.port}/*`);
}

export default defineContentScript({
    // Set manifest options
    matches: ['<all_urls>'],
    excludeGlobs,
    allFrames: true,
    runAt: 'document_start',

    main() {
        configureExtensionLogProvider();
        void currentPageDelegate()
            .then((pageDelegate) => pageDelegate.loadScripts())
            .catch((error) => asbError('content', 'Failed to load page integration:', error));
    },
});
