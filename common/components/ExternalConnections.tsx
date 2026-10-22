import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
    ExternalConnectionsState,
    GlobalStateProvider,
} from '@project/common/global-state';
import {
    approveExternalConnection,
    denyExternalConnection,
    removeExternalConnection,
} from '@project/common/global-state';
import SettingsSection from '@project/common/components/SettingsSection';

interface Props {
    provider: GlobalStateProvider;
    /** Optional subscription to live changes of the `externalConnections` global state key. */
    onExternalConnectionsChanged?: (listener: () => void) => () => void;
}

const ExternalConnections: React.FC<Props> = ({ provider, onExternalConnectionsChanged }) => {
    const { t } = useTranslation();
    const [externalConnections, setExternalConnections] = useState<ExternalConnectionsState>();

    const refresh = useCallback(() => {
        void provider
            .get(['externalConnections'])
            .then((state) => setExternalConnections(state.externalConnections));
    }, [provider]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => onExternalConnectionsChanged?.(refresh), [onExternalConnectionsChanged, refresh]);

    const handleApprove = useCallback(
        async (extensionId: string) => {
            await approveExternalConnection(provider, extensionId);
            refresh();
        },
        [provider, refresh]
    );
    const handleDeny = useCallback(
        async (extensionId: string) => {
            await denyExternalConnection(provider, extensionId);
            refresh();
        },
        [provider, refresh]
    );
    const handleRemove = useCallback(
        async (extensionId: string) => {
            await removeExternalConnection(provider, extensionId);
            refresh();
        },
        [provider, refresh]
    );

    const pending = Object.entries(externalConnections?.pending ?? {});
    const approved = Object.entries(externalConnections?.approved ?? {});

    return (
        <>
            <SettingsSection>{t('settings.externalConnections')}</SettingsSection>
            {pending.length > 0 && (
                <>
                    <Typography variant="body2" color="warning.main">
                        {t('externalConnections.pending')}
                    </Typography>
                    {pending.map(([extensionId, request]) => (
                        <Stack key={extensionId} direction="row" alignItems="center" spacing={1}>
                            <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2">
                                    {request.name ?? t('externalConnections.unknownName')}
                                </Typography>
                                <Typography variant="caption" style={{ wordBreak: 'break-all' }}>
                                    {extensionId}
                                </Typography>
                            </Stack>
                            <Button size="small" variant="contained" color="primary" onClick={() => handleApprove(extensionId)}>
                                {t('externalConnections.approve')}
                            </Button>
                            <Button size="small" onClick={() => handleDeny(extensionId)}>
                                {t('externalConnections.deny')}
                            </Button>
                        </Stack>
                    ))}
                </>
            )}
            {approved.length > 0 && (
                <>
                    <Typography variant="body2">{t('externalConnections.approved')}</Typography>
                    {approved.map(([extensionId, approval]) => (
                        <Stack key={extensionId} direction="row" alignItems="center" spacing={1}>
                            <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2">
                                    {approval.name ?? t('externalConnections.unknownName')}
                                </Typography>
                                <Typography variant="caption" style={{ wordBreak: 'break-all' }}>
                                    {extensionId}
                                </Typography>
                            </Stack>
                            <Button size="small" onClick={() => handleRemove(extensionId)}>
                                {t('externalConnections.remove')}
                            </Button>
                        </Stack>
                    ))}
                </>
            )}
        </>
    );
};

export default ExternalConnections;
