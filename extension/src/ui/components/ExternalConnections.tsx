import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useExternalConnections } from '@/ui/hooks/use-external-connections';
import { activePendingExternalConnections, approvedExternalConnections } from '@project/common/global-state';
import { asbError } from '@project/common/util/log';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LinkIcon from '@mui/icons-material/Link';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ExtensionIcon from '@mui/icons-material/Extension';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import project from '@project/common/project';

const ExternalConnections: React.FC = () => {
    const { t } = useTranslation();

    const { externalConnections, approveExternalConnection, denyExternalConnection, removeExternalConnection } =
        useExternalConnections();

    const handleApprove = useCallback(
        async (extensionId: string) => {
            try {
                await approveExternalConnection(extensionId);
            } catch (error) {
                asbError('external-connection', `Failed to approve external connection ${extensionId}:`, error);
            }
        },
        [approveExternalConnection]
    );
    const handleDeny = useCallback(
        async (extensionId: string) => {
            try {
                await denyExternalConnection(extensionId);
            } catch (error) {
                asbError('external-connection', `Failed to deny external connection ${extensionId}:`, error);
            }
        },
        [denyExternalConnection]
    );
    const handleRemove = useCallback(
        async (extensionId: string) => {
            try {
                await removeExternalConnection(extensionId);
            } catch (error) {
                asbError('external-connection', `Failed to remove external connection ${extensionId}:`, error);
            }
        },
        [removeExternalConnection]
    );
    // Do not render expired, pending connection requests; they will be pruned from the
    // underlying state on the next state update.
    const pending = Object.entries(
        activePendingExternalConnections(externalConnections?.connections ?? {}, Date.now())
    );
    const approved = Object.entries(approvedExternalConnections(externalConnections?.connections ?? {}));

    return (
        <Box p={2} sx={{ width: '100%', height: '100%', overflowY: 'auto' }}>
            {pending.length > 0 && (
                <>
                    <Typography variant="body1" color="textSecondary">
                        {t('externalConnections.incomingRequest')}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                        {pending.map(([extensionId, request]) => (
                            <ExternalConnectionRow
                                key={extensionId}
                                extensionId={extensionId}
                                name={request.name}
                                pending
                            >
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="success"
                                    startIcon={<LinkIcon />}
                                    onClick={() => handleApprove(extensionId)}
                                >
                                    {t('action.approve')}
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<BlockIcon />}
                                    onClick={() => handleDeny(extensionId)}
                                >
                                    {t('action.deny')}
                                </Button>
                            </ExternalConnectionRow>
                        ))}
                    </Stack>
                </>
            )}
            {approved.length > 0 && (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {approved.map(([extensionId, approval]) => (
                        <ExternalConnectionRow key={extensionId} extensionId={extensionId} name={approval.name}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<LinkOffIcon />}
                                onClick={() => handleRemove(extensionId)}
                            >
                                {t('action.remove')}
                            </Button>
                        </ExternalConnectionRow>
                    ))}
                </Stack>
            )}
            {pending.length === 0 && approved.length === 0 && (
                <Box
                    display="flex"
                    sx={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        flexDirection: 'column',
                    }}
                >
                    <Typography variant="h6" align="center">
                        {t('externalConnections.empty')}
                    </Typography>
                    <Typography variant="h6" align="center">
                        <Trans
                            i18nKey="externalConnections.help"
                            components={{
                                docs: (
                                    <Link
                                        href={`${project.urls.docs}/docs/guides/external-extensions`}
                                        target="_blank"
                                        rel="noreferrer"
                                    />
                                ),
                            }}
                        />
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

interface ExternalConnectionRowProps {
    extensionId: string;
    name?: string;
    pending?: boolean;
    children?: React.ReactNode;
}

const ExternalConnectionRow: React.FC<ExternalConnectionRowProps> = ({
    extensionId,
    name,
    pending = false,
    children,
}) => {
    const { t } = useTranslation();

    const content = (
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">{name ?? t('externalConnections.unknownName')}</Typography>
            <Typography variant="caption" color="textSecondary" style={{ wordBreak: 'break-all' }}>
                {extensionId}
            </Typography>
        </Stack>
    );

    if (pending) {
        return (
            <Alert
                severity="warning"
                icon={<ExtensionIcon fontSize="inherit" />}
                sx={{
                    alignItems: 'center',
                    '& .MuiAlert-message': { flex: 1, minWidth: 0 },
                    '& .MuiAlert-action': { mr: 0 },
                }}
                action={
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {children}
                    </Stack>
                }
            >
                {content}
            </Alert>
        );
    }

    return (
        <Paper variant="outlined">
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.75 }}>
                <ExtensionIcon color="action" />
                {content}
                {children}
            </Stack>
        </Paper>
    );
};

export default ExternalConnections;
