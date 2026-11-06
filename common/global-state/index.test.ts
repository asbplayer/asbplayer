import { describe, expect, it } from '@jest/globals';
import {
    activePendingExternalConnections,
    externalConnectionsPermissionSignature,
    pendingRequestExpirationMs,
} from '@project/common/global-state';

describe('activePendingExternalConnections', () => {
    const now = Date.now();

    it('keeps pending requests that have not expired', () => {
        const pending = { fresh: { name: 'Fresh', requestedAt: now - 1, methods: {} } };
        expect(activePendingExternalConnections(pending, now)).toEqual(pending);
    });

    it('keeps pending requests at the expiration boundary', () => {
        const pending = { boundary: { name: 'Boundary', requestedAt: now - pendingRequestExpirationMs, methods: {} } };
        expect(activePendingExternalConnections(pending, now)).toEqual(pending);
    });

    it('drops pending requests whose expiration has passed', () => {
        const pending = {
            expired: { name: 'Expired', requestedAt: now - pendingRequestExpirationMs - 1, methods: {} },
            fresh: { name: 'Fresh', requestedAt: now - 1, methods: {} },
        };
        expect(activePendingExternalConnections(pending, now)).toEqual({ fresh: pending.fresh });
    });

    it('drops pending requests without a requestedAt timestamp', () => {
        const pending = { broken: { name: 'Broken', methods: {} } };
        expect(activePendingExternalConnections(pending, now)).toEqual({});
    });
});

describe('externalConnectionsPermissionSignature', () => {
    const approved = {
        sibling: { name: 'Sibling', requestedAt: 1, approvedAt: 2, methods: {} },
    };

    it('detects permission and name changes', () => {
        expect(
            externalConnectionsPermissionSignature({ ...approved, sibling: { ...approved.sibling, deniedAt: 3 } })
        ).not.toEqual(externalConnectionsPermissionSignature(approved));
        expect(
            externalConnectionsPermissionSignature({ ...approved, sibling: { ...approved.sibling, name: 'Renamed' } })
        ).not.toEqual(externalConnectionsPermissionSignature(approved));
    });

    it('ignores usage and connection timestamp changes', () => {
        const withUsage = {
            sibling: {
                ...approved.sibling,
                lastConnectedAt: 3,
                lastDisconnectedAt: 4,
                lastUsedAt: 5,
                methods: { 'get-bound-media': { count: 1, lastUsedAt: 5 } },
            },
        };

        expect(externalConnectionsPermissionSignature(withUsage)).toEqual(
            externalConnectionsPermissionSignature(approved)
        );
    });
});
