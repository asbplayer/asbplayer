import { expect, it } from '@jest/globals';
import AutoSyncCoordinator from './auto-sync-coordinator';

const video = () => document.createElement('video');

it('allows only the preferred candidate to claim auto-sync and reuse its claim', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const preferred = video();
    const fallback = video();

    coordinator.reconcile([preferred, fallback], preferred);

    const claim = coordinator.tryClaim(preferred);
    expect(claim).toBeDefined();
    expect(coordinator.tryClaim(fallback)).toBeUndefined();
    expect(coordinator.tryClaim(preferred)).toBe(claim);
});

it('does not claim an invalid-first candidate until it becomes eligible', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const invalidVideo = video();
    const validVideo = video();

    coordinator.reconcile([], undefined);
    expect(coordinator.tryClaim(invalidVideo)).toBeUndefined();

    coordinator.reconcile([validVideo], validVideo);
    expect(coordinator.tryClaim(validVideo)).toBeDefined();
});

it('can move ownership before a claim is made', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const first = video();
    const second = video();

    coordinator.reconcile([first], first);
    coordinator.reconcile([first, second], second);

    expect(coordinator.tryClaim(first)).toBeUndefined();
    expect(coordinator.tryClaim(second)).toBeDefined();
});

it('allows a new candidate to claim after the previous candidate disappears', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const first = video();
    const second = video();

    coordinator.reconcile([first], first);
    expect(coordinator.tryClaim(first)).toBeDefined();

    coordinator.reconcile([second], second);
    expect(coordinator.tryClaim(second)).toBeDefined();
});

it('revokes the active claim when reset', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const candidate = video();

    coordinator.reconcile([candidate], candidate);
    const claim = coordinator.tryClaim(candidate);

    expect(coordinator.reset()).toBe(claim);
    expect(coordinator.isCurrent(claim)).toBe(false);
});

it('revokes a claimed video when a higher-preference candidate appears later', () => {
    const coordinator = new AutoSyncCoordinator(() => performance.now());
    const fallback = video();
    const preferred = video();

    coordinator.reconcile([fallback], fallback);
    const fallbackClaim = coordinator.tryClaim(fallback);
    expect(fallbackClaim).toBeDefined();
    expect(coordinator.isCurrent(fallbackClaim)).toBe(true);
    expect(coordinator.isCurrent(undefined)).toBe(true);

    const revokedClaim = coordinator.reconcile([preferred, fallback], preferred);
    expect(revokedClaim).toBe(fallbackClaim);
    expect(coordinator.isCurrent(fallbackClaim)).toBe(false);
    expect(coordinator.tryClaim(fallback)).toBeUndefined();
    expect(coordinator.tryClaim(preferred)).toBeDefined();
});

it('does not promote a claimed video after the promotion time limit', () => {
    let now = 0;
    const coordinator = new AutoSyncCoordinator(() => now);
    const fallback = video();
    const preferred = video();

    coordinator.reconcile([fallback], fallback);
    const fallbackClaim = coordinator.tryClaim(fallback);
    expect(fallbackClaim).toBeDefined();

    now = 10_000;

    expect(coordinator.reconcile([preferred, fallback], preferred)).toBeUndefined();
    expect(coordinator.isCurrent(fallbackClaim)).toBe(true);
    expect(coordinator.tryClaim(fallback)).toBe(fallbackClaim);
    expect(coordinator.tryClaim(preferred)).toBeUndefined();

    expect(coordinator.reconcile([preferred], preferred)).toBe(fallbackClaim);
    expect(coordinator.tryClaim(preferred)).toBeDefined();
});
