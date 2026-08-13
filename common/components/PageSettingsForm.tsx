import { JSX } from 'react';
import { MutablePageConfig, Page, PageConfig, PageSettings, YoutubePage } from '@project/common/settings';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import Toolbar from '@mui/material/Toolbar';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import TextField from '@project/common/components/SettingsTextField';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import LabelWithHoverEffect from '@project/common/components/LabelWithHoverEffect';
import { pageMetadata } from '@project/common/pages';
import ListField from '@project/common/components/ListField';
import SettingsTextField from '@project/common/components/SettingsTextField';

const maxAdditionalHostsLength = 50;
const youtubeTargetLanguageLimit = 3;

const totalLength = (strings: string[]) => {
    let total = 0;

    for (const str of strings) {
        total += str.length;
    }

    return total;
};

export interface PageSettingsFormProps {
    open: boolean;
    pageKey: keyof PageSettings;
    page: Page;
    defaultPageConfig: PageConfig;
    additionalControls?: JSX.Element;
    hasModifications: boolean;
    onClose: () => void;
    onPageChanged: <K extends keyof PageSettings>(key: K, page: PageSettings[K]) => void;
}

// Commenting out "disable CSP" functionality in case it's useful later
// const useDisableCspDnrRule = (pageKey: keyof PageSettings) => {
//     const [rule, setRule] = useState<Browser.declarativeNetRequest.Rule>();
//     const refreshRule = useCallback(() => {
//         setRule(undefined);

//         if (browser.declarativeNetRequest) {
//             browser.declarativeNetRequest.getDynamicRules().then((rules) => {
//                 setRule(rules.find((r) => r.id === pageMetadata[pageKey].disableCspRuleId));
//             });
//         }
//     }, [pageKey]);
//     useEffect(() => refreshRule(), [refreshRule]);
//     const createDisableCspDnrRule = useCallback(
//         (hostRegex: string) => {
//             if (!browser.declarativeNetRequest) {
//                 return;
//             }

//             const ruleId = pageMetadata[pageKey].disableCspRuleId;
//             browser.declarativeNetRequest
//                 .updateDynamicRules({
//                     addRules: [
//                         {
//                             id: ruleId,
//                             condition: {
//                                 regexFilter: hostRegex,
//                             },
//                             action: {
//                                 type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
//                                 responseHeaders: [
//                                     {
//                                         header: 'content-security-policy',
//                                         operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
//                                     },
//                                 ],
//                             },
//                         },
//                     ],
//                 })
//                 .then(refreshRule)
//                 .catch(console.error);
//         },
//         [refreshRule, pageKey]
//     );

//     const deleteDisableCspDnrRule = useCallback(() => {
//         if (!browser.declarativeNetRequest) {
//             return;
//         }

//         const ruleId = pageMetadata[pageKey].disableCspRuleId;
//         browser.declarativeNetRequest
//             .updateDynamicRules({ removeRuleIds: [ruleId] })
//             .then(refreshRule)
//             .catch(console.error);
//     }, [refreshRule, pageKey]);
//     return { disableCspDnrRule: rule, createDisableCspDnrRule, deleteDisableCspDnrRule };
// };

const PageSettingsForm = (props: PageSettingsFormProps) => {
    if (props.pageKey === 'youtube') {
        return <YoutubePageSettingsForm {...props} />;
    }

    return <DefaultPageSettingsForm {...props} />;
};

const YoutubePageSettingsForm = (props: PageSettingsFormProps) => {
    const { t } = useTranslation();
    const { onPageChanged, page } = props;
    const { targetLanguages } = page as YoutubePage;

    return (
        <DefaultPageSettingsForm
            {...props}
            additionalControls={
                <ListField
                    textFieldComponent={SettingsTextField}
                    label={t('extension.settings.pages.youtube.targetLanguages')}
                    items={targetLanguages ?? []}
                    onItemsChange={(newTargetLanguages) => {
                        if (newTargetLanguages.length <= youtubeTargetLanguageLimit) {
                            onPageChanged('youtube', { ...page, targetLanguages: newTargetLanguages });
                        }
                    }}
                />
            }
        />
    );
};

const DefaultPageSettingsForm = ({
    open,
    pageKey,
    page,
    defaultPageConfig,
    additionalControls,
    hasModifications,
    onClose,
    onPageChanged,
}: PageSettingsFormProps) => {
    const { t } = useTranslation();
    const overrides = page.overrides;
    const handleOverrideFieldChanged = <K extends keyof MutablePageConfig>(key: K, value: MutablePageConfig[K]) => {
        const newOverrides = { ...page.overrides, [key]: value };
        if (typeof newOverrides[key] === 'string' && newOverrides[key] === (defaultPageConfig[key] ?? '')) {
            delete newOverrides[key];
        } else if (typeof newOverrides[key] === 'boolean' && newOverrides[key] === (defaultPageConfig[key] ?? false)) {
            delete newOverrides[key];
        }
        const newOverridesAreEmpty = Object.keys(newOverrides).length === 0;
        onPageChanged(pageKey, { ...page, overrides: newOverridesAreEmpty ? undefined : newOverrides });
    };
    // const { disableCspDnrRule, createDisableCspDnrRule, deleteDisableCspDnrRule } = useDisableCspDnrRule(pageKey);
    // const doNotAllowDisableCsp = page.additionalHosts !== undefined && page.additionalHosts.length > 0;
    // const [confirmDisableCspDialogOpen, setConfirmDisableCspDialogOpen] = useState<boolean>(false);
    return (
        <>
            {/* {browser.declarativeNetRequest && (
                <ConfirmDisableCspDialog
                    open={confirmDisableCspDialogOpen}
                    onConfirm={() => {
                        createDisableCspDnrRule(defaultPageConfig.hostRegex);
                        setConfirmDisableCspDialogOpen(false);
                    }}
                    onClose={() => setConfirmDisableCspDialogOpen(false)}
                />
            )} */}
            <Dialog fullWidth open={open} onClose={onClose}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {pageMetadata[pageKey].title}
                    </Typography>
                    <IconButton edge="end" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Toolbar>
                <DialogContent>
                    <Stack spacing={1}>
                        {hasModifications && (
                            <Alert
                                severity="warning"
                                action={
                                    <Button
                                        onClick={() =>
                                            onPageChanged(pageKey, {
                                                ...page,
                                                overrides: undefined,
                                                additionalHosts: undefined,
                                                targetLanguages: undefined,
                                            })
                                        }
                                        size="small"
                                    >
                                        {t('action.revert')}
                                    </Button>
                                }
                            >
                                {t('extension.settings.pages.overridesWarning')}
                            </Alert>
                        )}
                        <TextField
                            disabled
                            label={t('extension.settings.pages.host')}
                            value={defaultPageConfig.hostRegex}
                        />
                        <ListField
                            label={t('extension.settings.pages.additionalHosts')}
                            items={page.additionalHosts ?? []}
                            onItemsChange={(additionalHosts) => {
                                if (totalLength(additionalHosts) > maxAdditionalHostsLength) {
                                    return;
                                }

                                // if (disableCspDnrRule !== undefined) {
                                //     deleteDisableCspDnrRule();
                                // }

                                onPageChanged(pageKey, {
                                    ...page,
                                    additionalHosts: additionalHosts.length === 0 ? undefined : additionalHosts,
                                });
                            }}
                        />
                        <TextField
                            label={t('extension.settings.pages.syncAllowedAtPath')}
                            value={overrides?.syncAllowedAtPath ?? defaultPageConfig.syncAllowedAtPath ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('syncAllowedAtPath', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.syncAllowedAtHash')}
                            value={overrides?.syncAllowedAtHash ?? defaultPageConfig.syncAllowedAtHash ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('syncAllowedAtHash', e.target.value)}
                        />
                        {/* <TextField
                            label={t('extension.settings.pages.autoSyncVideoSrc')}
                            value={overrides?.autoSyncVideoSrc ?? defaultPageConfig.autoSyncVideoSrc ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('autoSyncVideoSrc', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.autoSyncElementId')}
                            value={overrides?.autoSyncElementId ?? defaultPageConfig.autoSyncElementId ?? ''}
                            onChange={(e) => handleOverrideFieldChanged('autoSyncElementId', e.target.value)}
                        />
                        <TextField
                            label={t('extension.settings.pages.ignoreVideoElementsClass')}
                            value={
                                overrides?.ignoreVideoElementsClass ?? defaultPageConfig.ignoreVideoElementsClass ?? ''
                            }
                            onChange={(e) => handleOverrideFieldChanged('ignoreVideoElementsClass', e.target.value)}
                        /> */}
                        {additionalControls}
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={
                                        overrides?.searchShadowRootsForVideoElements ??
                                        defaultPageConfig.searchShadowRootsForVideoElements ??
                                        false
                                    }
                                    onChange={(e) =>
                                        handleOverrideFieldChanged(
                                            'searchShadowRootsForVideoElements',
                                            e.target.checked
                                        )
                                    }
                                />
                            }
                            label={t('extension.settings.pages.searchShadowRootsForVideoElements')}
                            labelPlacement="start"
                        />
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={
                                        overrides?.allowVideoElementsWithBlankSrc ??
                                        defaultPageConfig.allowVideoElementsWithBlankSrc ??
                                        false
                                    }
                                    onChange={(e) =>
                                        handleOverrideFieldChanged('allowVideoElementsWithBlankSrc', e.target.checked)
                                    }
                                />
                            }
                            label={t('extension.settings.pages.allowVideoElementsWithBlankSrc')}
                            labelPlacement="start"
                        />
                        <LabelWithHoverEffect
                            control={
                                <Switch
                                    checked={overrides?.autoSyncEnabled ?? defaultPageConfig.autoSyncEnabled ?? false}
                                    onChange={(e) => handleOverrideFieldChanged('autoSyncEnabled', e.target.checked)}
                                />
                            }
                            label={t('extension.settings.pages.autoSyncEnabled')}
                            labelPlacement="start"
                        />
                        {/* {!isFirefoxBuild && browser.declarativeNetRequest && (
                            <Tooltip
                                disabled={!doNotAllowDisableCsp}
                                title={t('extension.settings.pages.disableCspRestrictions')}
                            >
                                <LabelWithHoverEffect
                                    control={
                                        <Switch
                                            disabled={doNotAllowDisableCsp}
                                            checked={disableCspDnrRule !== undefined}
                                            onClickCapture={(e) => {
                                                if (disableCspDnrRule === undefined) {
                                                    e.stopPropagation();
                                                    setConfirmDisableCspDialogOpen(true);
                                                }
                                            }}
                                            onChange={(e) => {
                                                if (!e.target.checked) {
                                                    deleteDisableCspDnrRule();
                                                }
                                            }}
                                        />
                                    }
                                    label={t('extension.settings.pages.disableCsp')}
                                    labelPlacement="start"
                                />
                            </Tooltip>
                        )} */}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t('action.ok')}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default PageSettingsForm;
