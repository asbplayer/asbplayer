import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TypographyOwnProps } from '@mui/material/Typography';
import { useState, useCallback } from 'react';
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
import ButtonBase from '@mui/material/ButtonBase';
import project from '@project/common/project';
import { isFirefoxBuild } from '@/services/build-flags';
import Tooltip from '@project/common/components/Tooltip';
import DialogContentText from '@mui/material/DialogContentText';

const ExternalConnections: React.FC = () => {
    const { t } = useTranslation();

    const { externalConnections, approveExternalConnection, denyExternalConnection, removeExternalConnection } =
        useExternalConnections();
    const [extensionIdForWarning, setExtensionIdForWarning] = useState<string>();
    const handleCancelWarning = useCallback(() => setExtensionIdForWarning(undefined), []);

    const handleAcknowledgeWarning = useCallback(
        async (extensionId: string) => {
            try {
                await approveExternalConnection(extensionId);
                setExtensionIdForWarning(undefined);
            } catch (error) {
                asbError('external-connection', `Failed to approve external connection ${extensionId}:`, error);
            }
        },
        [approveExternalConnection]
    );

    const handleShowWarning = useCallback((extensionId: string) => {
        setExtensionIdForWarning(extensionId);
    }, []);

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
            {extensionIdForWarning && (
                <ExternalConnectionWarning
                    extensionId={extensionIdForWarning}
                    onAcknowledgeWarning={handleAcknowledgeWarning}
                    onCancel={handleCancelWarning}
                />
            )}
            {!extensionIdForWarning && (
                <>
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
                                        <ApproveButton extensionId={extensionId} onClick={handleShowWarning} />
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
                </>
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

const ApproveButton: React.FC<{
    extensionId: string;
    onClick: (extensionId: string) => void;
}> = ({ extensionId, onClick }) => {
    const { t } = useTranslation();
    return (
        <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<LinkIcon />}
            onClick={() => onClick(extensionId)}
        >
            {t('action.approve')}
        </Button>
    );
};

const ExternalConnectionWarning: React.FC<{
    extensionId: string;
    onAcknowledgeWarning: (extensionId: string) => void;
    onCancel: () => void;
}> = ({ extensionId, onAcknowledgeWarning, onCancel }) => {
    const { t } = useTranslation();
    return (
        <Stack spacing={1} sx={{ height: '100%' }}>
            <Box
                display="flex"
                sx={{
                    flexDirection: 'column',
                    flexGrow: 1,
                    justifyContent: 'center',
                }}
            >
                <DialogContentText sx={{ mb: 2 }}>
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
            </Box>

            <Box display="flex" sx={{ justifyContent: 'flex-end' }}>
                <Stack direction="row" spacing={1}>
                    <ApproveButton extensionId={extensionId} onClick={onAcknowledgeWarning} />
                    <Button variant="outlined" onClick={onCancel}>
                        {t('action.cancel')}
                    </Button>
                </Stack>
            </Box>
        </Stack>
    );
};

export default ExternalConnections;
