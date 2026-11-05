import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TypographyOwnProps } from '@mui/material/Typography';
import { useState, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useExternalConnections } from '@/ui/hooks/use-external-connections';
import { activePendingExternalConnections, approvedExternalConnections } from '@project/common/global-state';
import type { ExternalConnection } from '@project/common/global-state';
import { asbError } from '@project/common/util/log';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LinkIcon from '@mui/icons-material/Link';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ExtensionIcon from '@mui/icons-material/Extension';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import ButtonBase from '@mui/material/ButtonBase';
import project from '@project/common/project';
import { isFirefoxBuild } from '@/services/build-flags';
import Tooltip from '@project/common/components/Tooltip';
import DialogContentText from '@mui/material/DialogContentText';
import useConfirmation from '@project/common/hooks/use-confirmation';
import BarChartIcon from '@mui/icons-material/BarChart';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';

const ExternalConnections: React.FC = () => {
    const { t } = useTranslation();

    const { externalConnections, approveExternalConnection, denyExternalConnection, removeExternalConnection } =
        useExternalConnections();

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

    const [extensionIdForStatistics, setExtensionIdForStatistics] = useState<string>();
    const [connectionStatisticsOpen, setConnectionStatisticsOpen] = useState<boolean>(false);
    const handleOpenConnectionStatistics = useCallback((extensionId: string) => {
        setExtensionIdForStatistics(extensionId);
        setConnectionStatisticsOpen(true);
    }, []);
    const handleCloseConnectionStatistics = useCallback(() => {
        setExtensionIdForStatistics(undefined);
        setConnectionStatisticsOpen(false);
    }, []);
    const firstPending = Object.entries(activePendingExternalConnections(externalConnections ?? {}, Date.now()))[0];
    const firstPendingId = firstPending?.[0];
    const firstPendingRequest = firstPending?.[1];
    const approved = Object.entries(approvedExternalConnections(externalConnections ?? {}));

    return (
        <Box p={1.5} sx={{ width: '100%', height: '100%', overflowY: 'auto' }}>
            {firstPending !== undefined && (
                <Stack spacing={3} sx={{ mt: 1.5 }}>
                    <ExternalConnectionWarning extensionId={firstPendingId} />
                    <ExternalConnectionRow extensionId={firstPendingId} name={firstPendingRequest.name} pending>
                        <ApproveButton extensionId={firstPendingId} onApprove={approveExternalConnection} />
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<BlockIcon />}
                            onClick={() => handleDeny(firstPendingId)}
                        >
                            {t('action.deny')}
                        </Button>
                    </ExternalConnectionRow>
                </Stack>
            )}
            {approved.length > 0 && (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {approved.map(([extensionId, approval]) => (
                        <ExternalConnectionRow key={extensionId} extensionId={extensionId} name={approval.name}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                startIcon={<BarChartIcon />}
                                onClick={() => handleOpenConnectionStatistics(extensionId)}
                            >
                                {t('statistics.title')}
                            </Button>
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
            {externalConnections !== undefined && firstPending === undefined && approved.length === 0 && (
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
            {extensionIdForStatistics && externalConnections?.[extensionIdForStatistics] && (
                <ConnectionStatistics
                    open={connectionStatisticsOpen}
                    extensionId={extensionIdForStatistics}
                    connection={externalConnections[extensionIdForStatistics]}
                    onClose={handleCloseConnectionStatistics}
                />
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

const ExtensionId: React.FC<{
    id: string;
    inline?: boolean;
    link?: boolean; // Ignored on Firefox since Firefox can't link to extension details
}> = ({ id, inline, link }) => {
    const styles: Partial<TypographyOwnProps> = inline
        ? { variant: 'inherit', color: 'primary', fontWeight: 600 }
        : { variant: 'subtitle2', color: 'textPrimary' };

    if (isFirefoxBuild) {
        return (
            <Tooltip
                title={
                    <Trans
                        i18nKey={'externalConnections.extensionDetailsHelper'}
                        values={{ address: 'about:addons' }}
                        components={[<code key={0}>about:addons</code>]}
                    />
                }
            >
                <Typography {...styles} component={inline ? 'span' : 'h6'} sx={{ overflowWrap: 'anywhere' }}>
                    {id}
                </Typography>
            </Tooltip>
        );
    }

    if (!link) {
        return (
            <Typography {...styles} component={inline ? 'span' : 'h6'} sx={{ overflowWrap: 'anywhere' }}>
                {id}
            </Typography>
        );
    }

    return (
        <Link
            component={ButtonBase}
            {...styles}
            sx={{ width: 'fit-content', justifyContent: 'flex-start', overflowWrap: 'anywhere', maxWidth: '100%' }}
            onClick={() => browser.tabs.create({ url: `chrome://extensions/?id=${id}`, active: true })}
        >
            {id}
        </Link>
    );
};

const ExternalConnectionRow: React.FC<ExternalConnectionRowProps> = ({ extensionId, pending = false, children }) => {
    const content = (
        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
            <ExtensionId link id={extensionId} />
            {/* Intentionally not displaying the connecting extension's self-reported name as it is unreliable */}
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
                    '& .MuiAlert-action': { mr: 0, pt: 0 },
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

const ApproveButton: React.FC<{
    extensionId: string;
    onApprove: (extensionId: string) => void;
}> = ({ extensionId, onApprove }) => {
    const { t } = useTranslation();
    const { confirming: confirmingApproval, confirm: approveWithConfirmation } = useConfirmation(
        () => void onApprove(extensionId)
    );
    return (
        <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<LinkIcon />}
            onClick={approveWithConfirmation}
        >
            {confirmingApproval ? t('action.confirm') : t('action.approve')}
        </Button>
    );
};

const ExternalConnectionWarning: React.FC<{ extensionId: string }> = ({ extensionId }) => {
    const { t } = useTranslation();
    return (
        <Stack spacing={2}>
            <DialogContentText>{t('externalConnections.incomingRequest')}</DialogContentText>
            <DialogContentText>
                <Trans
                    i18nKey={'externalConnections.warning'}
                    components={[<ExtensionId inline key={0} id={extensionId} />]}
                />
            </DialogContentText>
            <DialogContentText>
                <Trans
                    i18nKey={'externalConnections.extensionDetailsHelper'}
                    values={{ address: 'about:addons' }}
                    components={[
                        isFirefoxBuild ? (
                            <code key={0}>about:addons</code>
                        ) : (
                            <ExtensionId inline link id={extensionId} />
                        ),
                    ]}
                />
            </DialogContentText>
        </Stack>
    );
};

const formatTimestamp = (timestamp: number | undefined): string | undefined =>
    timestamp === undefined ? undefined : new Date(timestamp).toLocaleString();

const ConnectionStatistics: React.FC<{
    open: boolean;
    extensionId: string;
    connection: ExternalConnection;
    onClose: () => void;
}> = ({ open, extensionId, connection, onClose }) => {
    const { t } = useTranslation();
    const statistics = {
        extensionId,
        lastConnectedAt: formatTimestamp(connection.lastConnectedAt),
        lastDisconnectedAt: formatTimestamp(connection.lastDisconnectedAt),
        lastUsedAt: formatTimestamp(connection.lastUsedAt),
        methods: Object.fromEntries(
            Object.entries(connection.methods ?? {}).map(([method, usage]) => [
                method,
                {
                    count: usage.count,
                    lastUsedAt: formatTimestamp(usage.lastUsedAt),
                },
            ])
        ),
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: 'transparent',
                        backgroundImage: 'none',
                        boxShadow: 'none',
                    },
                },
            }}
        >
            <Box
                component="pre"
                sx={{
                    m: 0,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    overflow: 'auto',
                    maxHeight: '60vh',
                }}
            >
                {JSON.stringify(statistics, null, 2)}
            </Box>
            <DialogActions sx={{ px: 0, pt: 1, pb: 0 }}>
                <Button variant="text" size="small" onClick={onClose}>
                    {t('action.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExternalConnections;
