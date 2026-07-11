let documentPromise: Promise<void> | undefined = undefined;

export const ensureOffscreenAudioServiceDocument = async () => {
    if (documentPromise === undefined) {
        documentPromise = offscreenAudioServiceDocumentPromise();
    }

    const promise = documentPromise;
    try {
        await promise;
    } catch (e) {
        if (promise === documentPromise) {
            documentPromise = undefined;
        }

        throw e;
    }
};

const offscreenAudioServiceDocumentPromise = async () => {
    const contexts = await browser.runtime.getContexts({
        contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });

    if (contexts.length === 0) {
        await browser.offscreen.createDocument({
            url: 'offscreen-audio-service.html',
            reasons: [browser.offscreen.Reason.USER_MEDIA],
            justification: 'Audio recording and encoding',
        });
    }
};
