import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useExternalConnections } from '@/ui/hooks/use-external-connections';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LinkIcon from '@mui/icons-material/Link';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ExtensionIcon from '@mui/icons-material/Extension';

const ExternalConnections: React.FC = () => {
    const { t } = useTranslation();

    const { externalConnections, approveExternalConnection, denyExternalConnection, removeExternalConnection } =
        useExternalConnections();

    const handleApprove = useCallback(
        async (extensionId: string) => {
            await approveExternalConnection(extensionId);
        },
        [approveExternalConnection]
    );
    const handleDeny = useCallback(
        async (extensionId: string) => {
            await denyExternalConnection(extensionId);
        },
        [denyExternalConnection]
    );
    const handleRemove = useCallback(
        async (extensionId: string) => {
            await removeExternalConnection(extensionId);
        },
        [removeExternalConnection]
    );
    const pending = Object.entries(externalConnections?.pending ?? {});
    const approved = Object.entries(externalConnections?.approved ?? {});

    return (
        <Paper square>
            <Box p={2}>
                <Typography variant="body1" color="textSecondary">
                    {t('externalConnections.incomingRequest')}
                </Typography>
                {pending.length > 0 && (
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
            </Box>
        </Paper>
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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.75 }}>
            <ExtensionIcon color="action" />
            {content}
            {children}
        </Stack>
    );
};

export default ExternalConnections;
