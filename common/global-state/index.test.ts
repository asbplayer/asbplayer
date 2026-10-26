import { describe, expect, it } from '@jest/globals';
import { activePendingEntries, pendingRequestExpirationMs } from '@project/common/global-state';

describe('activePendingEntries', () => {
    const now = Date.now();

    it('keeps pending requests that have not expired', () => {
        const pending = { fresh: { name: 'Fresh', requestedAt: now - 1 } };
        expect(activePendingEntries(pending, now)).toEqual(pending);
    });

    it('keeps pending requests at the expiration boundary', () => {
        const pending = { boundary: { name: 'Boundary', requestedAt: now - pendingRequestExpirationMs } };
        expect(activePendingEntries(pending, now)).toEqual(pending);
    });

    it('drops pending requests whose expiration has passed', () => {
        const pending = {
            expired: { name: 'Expired', requestedAt: now - pendingRequestExpirationMs - 1 },
            fresh: { name: 'Fresh', requestedAt: now - 1 },
        };
        expect(activePendingEntries(pending, now)).toEqual({ fresh: pending.fresh });
    });

    it('drops pending requests without a requestedAt timestamp', () => {
        const pending = { broken: { name: 'Broken' } as { name: string; requestedAt: number } };
        expect(activePendingEntries(pending, now)).toEqual({});
    });
});
