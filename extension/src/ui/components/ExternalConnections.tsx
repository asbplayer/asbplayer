import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TypographyOwnProps } from '@mui/material/Typography';
import { useState, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useExternalConnections } from '@/ui/hooks/use-external-connections';
import { activePendingEntries } from '@project/common/global-state';
import { asbError } from '@project/common/util/log';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LinkIcon from '@mui/icons-material/Link';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ExtensionIcon from '@mui/icons-material/Extension';
import { isFirefoxBuild } from '@/services/build-flags';
import { ButtonBase, Link } from '@mui/material';
import Tooltip from '@project/common/components/Tooltip';

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
    const pending = Object.entries(activePendingEntries(externalConnections?.pending ?? {}, Date.now()));
    const approved = Object.entries(externalConnections?.approved ?? {});

    return (
        <Paper square>
            <Box p={2}>
                {extensionIdForWarning && (
                    <ExternalConnectionWarning
                        extensionId={extensionIdForWarning}
                        onAcknowledgeWarning={handleAcknowledgeWarning}
                        onCancel={handleCancelWarning}
                    />
                )}
                {!extensionIdForWarning && (
                    <>
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
                        )}
                        {approved.length > 0 && (
                            <Stack spacing={1} sx={{ mt: 1.5 }}>
                                {approved.map(([extensionId, approval]) => (
                                    <ExternalConnectionRow
                                        key={extensionId}
                                        extensionId={extensionId}
                                        name={approval.name}
                                    >
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
                    </>
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
                <Typography {...styles} sx={{ overflowWrap: 'anywhere' }}>
                    {id}
                </Typography>
            </Tooltip>
        );
    }

    if (!link) {
        return (
            <Typography {...styles} sx={{ overflowWrap: 'anywhere' }}>
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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.75 }}>
            <ExtensionIcon color="action" />
            {content}
            {children}
        </Stack>
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
        <Stack spacing={1}>
            <Box>
                <p>
                    <Typography>
                        <Trans
                            i18nKey={'externalConnections.warning'}
                            components={[<ExtensionId inline key={0} id={extensionId} />]}
                        />
                    </Typography>
                </p>
                <p>
                    <Typography>
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
                    </Typography>
                </p>
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
