/** Reload existing clients after an accepted update, including updates accepted in another tab. */
export const watchServiceWorkerUpdates = (serviceWorker: ServiceWorkerContainer, reload: () => void) => {
    let controlled = serviceWorker.controller !== null;
    const onControllerChange = () => {
        if (controlled) reload(); // Claiming an uncontrolled client on the first installation does not require a reload.
        controlled = true;
    };
    serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => serviceWorker.removeEventListener('controllerchange', onControllerChange);
};
