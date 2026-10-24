import { watchServiceWorkerUpdates } from '@project/common/app/services/service-worker-updates';

const container = (controlled: boolean) =>
    Object.assign(new EventTarget(), { controller: controlled ? {} : null }) as ServiceWorkerContainer;

it('reloads a controlled tab when an accepted update changes its controller', () => {
    const worker = container(true);
    const reload = jest.fn();
    watchServiceWorkerUpdates(worker, reload);
    expect(reload).not.toHaveBeenCalled();
    worker.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
});

it('does not reload on initial installation, then reloads for a later update', () => {
    const worker = container(false);
    const reload = jest.fn();
    watchServiceWorkerUpdates(worker, reload);
    worker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
    worker.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
});

it('stops observing controller changes when the client unmounts', () => {
    const worker = container(true);
    const reload = jest.fn();
    const stop = watchServiceWorkerUpdates(worker, reload);
    stop();
    worker.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
});
