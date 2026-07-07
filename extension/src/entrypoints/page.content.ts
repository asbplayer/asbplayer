import { currentPageDelegate } from '@/services/pages';

const excludeGlobs = ['*://app.asbplayer.dev/*'];

if (import.meta.env.DEV) {
    excludeGlobs.push('*://localhost:3000/*');
}

export default defineContentScript({
    // Set manifest options
    matches: ['<all_urls>'],
    excludeGlobs,
    allFrames: true,
    runAt: 'document_start',

    main() {
        void currentPageDelegate().then((pageDelegate) => pageDelegate?.loadScripts());
    },
});
