import FormHelperText from '@mui/material/FormHelperText';
import AnkiConnectTutorialBubble from './AnkiConnectTutorialBubble';
import DeckFieldTutorialBubble from './DeckFieldTutorialBubble';
import SettingsTextField from './SettingsTextField';
import { Trans, useTranslation } from 'react-i18next';
import AnkiSelect from './AnkiSelect';
import React, { useCallback, useEffect, useState } from 'react';
import TutorialBubble from './TutorialBubble';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import NoteTypeTutorialBubble from './NoteTypeTutorialBubble';
import ListField from './ListField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import {
    AnkiFieldSettings,
    AnkiFieldUiModel,
    AsbplayerSettings,
    CustomAnkiFieldSettings,
    sortedAnkiFieldModels,
} from '../settings';
import { CardModel } from '../src/model';
import { Direction, TutorialStep } from './settings-model';
import { Anki, exportCard } from '../anki';
import Stack from '@mui/material/Stack';

const defaultDeckName = 'Sentences';
const maskApiToken = (apiToken: string) => '•'.repeat(Array.from(apiToken).length);

const defaultNoteType = {
    modelName: 'Sentence Card',
    inOrderFields: ['Sentence', 'Word', 'Definition', 'Image', 'Audio', 'Source', 'URL'],
    css: `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: white;
  background-color: black;
}

.image {
  width: auto;
  height: auto;
  max-width: 500px;
  max-height: 500px;
  margin-left: auto;
  margin-right: auto;
}

.front {
  font-size: 30px;
}`,
    cardTemplates: [
        {
            Front: `<div class="front">{{Sentence}}</div>`,
            Back: `<div class="front">{{Sentence}}</div>
<hr id=answer>
{{Definition}}
<p/>
<div class="image">
{{Image}}
</div>
<p/>
{{Audio}}
<p/>
{{Source}}
<p/>
{{URL}}`,
        },
    ],
};

interface AddCustomFieldProps {
    onAddCustomField: (fieldName: string) => void;
}

function AddCustomField({ onAddCustomField }: AddCustomFieldProps) {
    const { t } = useTranslation();
    const [fieldName, setFieldName] = useState<string>('');

    return (
        <SettingsTextField
            label={t('settings.addCustomField')}
            placeholder={t('settings.customFieldName')!}
            fullWidth
            value={fieldName}
            color="primary"
            onChange={(e) => setFieldName(e.target.value)}
            slotProps={{
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                disabled={fieldName.trim() === ''}
                                onClick={() => {
                                    onAddCustomField(fieldName.trim());
                                    setFieldName('');
                                }}
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}

interface Props {
    settings: AsbplayerSettings;
    extensionInstalled?: boolean;
    extensionSupportsOrderableAnkiFields?: boolean;
    isMobile?: boolean;
    insideApp?: boolean;
    inTutorial?: boolean;
    onSettingChanged: <K extends keyof AsbplayerSettings>(key: K, value: AsbplayerSettings[K]) => Promise<void>;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    tutorialStep: TutorialStep;
    onTutorialStepChanged: (step: TutorialStep) => void;
    anki: Anki;
    testCard?: () => Promise<CardModel>;
}

const AnkiSettingsTab: React.FC<Props> = ({
    settings,
    extensionInstalled,
    extensionSupportsOrderableAnkiFields,
    isMobile,
    insideApp,
    inTutorial,
    onSettingChanged,
    onSettingsChanged,
    tutorialStep,
    onTutorialStepChanged,
    anki,
    testCard,
}) => {
    const { t } = useTranslation();

    const [deckNames, setDeckNames] = useState<string[]>();
    const [modelNames, setModelNames] = useState<string[]>();
    const [ankiConnectUrlError, setAnkiConnectUrlError] = useState<string>();
    const [ankiConnectApiKeyRequired, setAnkiConnectApiKeyRequired] = useState<boolean>(false);
    const [showAnkiConnectApiKey, setShowAnkiConnectApiKey] = useState<boolean>(() => !settings.ankiConnectApiKey);
    const [fieldNames, setFieldNames] = useState<string[]>();

    const handleAddCustomField = useCallback(
        (customFieldName: string) => {
            onSettingChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: '' });
        },
        [settings.customAnkiFields, onSettingChanged]
    );
    const handleCustomFieldChange = useCallback(
        (customFieldName: string, value: string) => {
            onSettingChanged('customAnkiFields', { ...settings.customAnkiFields, [customFieldName]: value });
        },
        [settings.customAnkiFields, onSettingChanged]
    );
    const handleCustomFieldRemoval = useCallback(
        (customFieldName: string) => {
            const newCustomFields = { ...settings.customAnkiFields };
            delete newCustomFields[customFieldName];
            onSettingChanged('customAnkiFields', newCustomFields);
        },
        [onSettingChanged, settings.customAnkiFields]
    );

    const {
        ankiConnectUrl,
        ankiConnectApiKey,
        deck,
        noteType,
        sentenceField,
        definitionField,
        audioField,
        imageField,
        wordField,
        sourceField,
        urlField,
        track1Field,
        track2Field,
        track3Field,
        ankiFieldSettings,
        customAnkiFields,
        customAnkiFieldSettings,
        tags,
    } = settings;

    const requestAnkiConnect = useCallback(async () => {
        let apiKeyRequired = false;
        const detectApiKeyRequired = (result: any) => {
            if (Anki.requiresApiKey(result)) apiKeyRequired = true;
        };

        try {
            if (insideApp) {
                try {
                    detectApiKeyRequired(await anki.requestPermission(ankiConnectUrl));
                } catch (e) {
                    // Request permission can give confusing errors due to AnkiConnect's implementation (or the implementation not existing in the case of Android).
                    // Furthermore, "request permission" should hardly ever work since recent Chrome security policies require the origin of the asbplayer app to
                    // be specified manually in the AnkiConnect settings anyway.
                    // So fallback to using the "version" endpoint if the above fails.
                    detectApiKeyRequired(e);
                    detectApiKeyRequired(await anki.version(ankiConnectUrl));
                }
            } else {
                // Extension does not need to be allowed explicitly by AnkiConnect
                detectApiKeyRequired(await anki.version(ankiConnectUrl));
            }

            setAnkiConnectApiKeyRequired(apiKeyRequired);
            setDeckNames(await anki.deckNames(ankiConnectUrl));
            const modelNames = await anki.modelNames(ankiConnectUrl);
            setModelNames(modelNames);
            setAnkiConnectUrlError(undefined);
        } catch (e) {
            setAnkiConnectApiKeyRequired(apiKeyRequired || Anki.requiresApiKey(e));
            console.error(e);
            setDeckNames(undefined);
            setModelNames(undefined);

            if (e instanceof Error) {
                setAnkiConnectUrlError(e.message);
            } else if (typeof e === 'string') {
                setAnkiConnectUrlError(e);
            } else {
                setAnkiConnectUrlError(String(e));
            }
        }
    }, [anki, ankiConnectUrl, insideApp]);

    useEffect(() => {
        let canceled = false;

        const timeout = setTimeout(async () => {
            if (canceled) {
                return;
            }

            requestAnkiConnect();
        }, 1000);

        return () => {
            canceled = true;
            clearTimeout(timeout);
        };
    }, [anki, ankiConnectUrl, ankiConnectApiKey, requestAnkiConnect]);

    useEffect(() => {
        if (!noteType || ankiConnectUrlError) {
            return undefined;
        }

        let canceled = false;

        async function refreshFieldNames() {
            try {
                if (canceled) {
                    return;
                }

                setFieldNames(await anki.modelFieldNames(noteType, ankiConnectUrl));
                setAnkiConnectUrlError(undefined);
            } catch (e) {
                if (canceled) {
                    return;
                }

                console.error(e);
                setFieldNames(undefined);

                if (e instanceof Error) {
                    setAnkiConnectUrlError(e.message);
                } else if (typeof e === 'string') {
                    setAnkiConnectUrlError(e);
                } else {
                    setAnkiConnectUrlError(String(e));
                }
            }
        }

        refreshFieldNames();

        return () => {
            canceled = true;
        };
    }, [anki, noteType, ankiConnectUrl, ankiConnectApiKey, ankiConnectUrlError]);

    const handleAnkiFieldOrderChange = useCallback(
        (direction: Direction, models: AnkiFieldUiModel[], index: number) => {
            if (direction === Direction.up && index === 0) {
                return;
            }

            if (direction === Direction.down && index === models.length - 1) {
                return;
            }

            const me = models[index];
            const other = direction === Direction.up ? models[index - 1] : models[index + 1];
            let newCustomAnkiFieldSettings: CustomAnkiFieldSettings | undefined = undefined;
            let newAnkiFieldSettings: AnkiFieldSettings | undefined = undefined;
            const newMeField = { [me.key]: { ...me.field, order: other.field.order } };
            const newOtherField = { [other.key]: { ...other.field, order: me.field.order } };

            if (other.custom) {
                newCustomAnkiFieldSettings = { ...customAnkiFieldSettings, ...newOtherField };
            } else {
                newAnkiFieldSettings = { ...ankiFieldSettings, ...newOtherField };
            }

            if (me.custom) {
                newCustomAnkiFieldSettings = {
                    ...(newCustomAnkiFieldSettings ?? customAnkiFieldSettings),
                    ...newMeField,
                };
            } else {
                newAnkiFieldSettings = { ...(newAnkiFieldSettings ?? ankiFieldSettings), ...newMeField };
            }

            onSettingsChanged({
                ankiFieldSettings: newAnkiFieldSettings ?? ankiFieldSettings,
                customAnkiFieldSettings: newCustomAnkiFieldSettings ?? customAnkiFieldSettings,
            });
        },
        [onSettingsChanged, customAnkiFieldSettings, ankiFieldSettings]
    );

    const handleAnkiFieldDisplayChange = useCallback(
        (model: AnkiFieldUiModel, display: boolean) => {
            const newField = { ...model.field, display };

            if (model.custom) {
                const newCustomAnkiFieldSettings = { ...customAnkiFieldSettings, [model.key]: newField };
                onSettingsChanged({
                    customAnkiFieldSettings: newCustomAnkiFieldSettings,
                });
            } else {
                const newAnkiFieldSettings = { ...ankiFieldSettings, [model.key]: newField };
                onSettingsChanged({
                    ankiFieldSettings: newAnkiFieldSettings,
                });
            }
        },
        [customAnkiFieldSettings, ankiFieldSettings, onSettingsChanged]
    );

    const handleCreateDefaultDeck = useCallback(() => {
        anki.createDeck(defaultDeckName)
            .then(() => requestAnkiConnect())
            .then(() => onSettingChanged('deck', defaultDeckName))
            .catch(console.error);
    }, [anki, requestAnkiConnect, onSettingChanged]);

    useEffect(() => {
        if (tutorialStep === TutorialStep.deck && deck) {
            onTutorialStepChanged(TutorialStep.noteType);
        }
    }, [tutorialStep, onTutorialStepChanged, deck]);

    const handleCreateDefaultNoteType = useCallback(() => {
        anki.createModel(defaultNoteType)
            .then(() => requestAnkiConnect())
            .then(() => onSettingChanged('noteType', defaultNoteType.modelName))
            .then(() =>
                Promise.all([
                    onSettingChanged('sentenceField', 'Sentence'),
                    onSettingChanged('definitionField', 'Definition'),
                    onSettingChanged('wordField', 'Word'),
                    onSettingChanged('audioField', 'Audio'),
                    onSettingChanged('imageField', 'Image'),
                    onSettingChanged('sourceField', 'Source'),
                    onSettingChanged('urlField', 'URL'),
                ])
            )
            .catch(console.error);
        if (tutorialStep === TutorialStep.ankiFields) {
            onTutorialStepChanged(TutorialStep.testCard);
        }
    }, [anki, tutorialStep, requestAnkiConnect, onSettingChanged, onTutorialStepChanged]);

    const handleCreateTestCard = useCallback(async () => {
        if (testCard === undefined) {
            return;
        }

        if (tutorialStep === TutorialStep.testCard) {
            onTutorialStepChanged(TutorialStep.done);
        }

        await exportCard(await testCard(), settings, isMobile ? 'default' : 'gui');
    }, [tutorialStep, settings, isMobile, testCard, onTutorialStepChanged]);

    const ankiFieldModels = sortedAnkiFieldModels(settings);
    const ankiConnectApiKeyVisible = showAnkiConnectApiKey || !ankiConnectApiKey;

    return (
        <Stack spacing={1}>
            <AnkiConnectTutorialBubble
                show={tutorialStep === TutorialStep.ankiConnect}
                disabled={!inTutorial}
                ankiConnectUrlError={Boolean(ankiConnectUrlError)}
                onConfirm={() => {
                    onTutorialStepChanged(TutorialStep.deck);
                }}
            >
                <SettingsTextField
                    label={t('settings.ankiConnectUrl')}
                    value={ankiConnectUrl}
                    error={Boolean(ankiConnectUrlError)}
                    helperText={ankiConnectUrlError}
                    color="primary"
                    onChange={(event) => onSettingChanged('ankiConnectUrl', event.target.value)}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={requestAnkiConnect}>
                                        <RefreshIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </AnkiConnectTutorialBubble>
            {(ankiConnectApiKey || ankiConnectApiKeyRequired) && (
                <SettingsTextField
                    label={t('settings.ankiConnectApiKey')}
                    value={ankiConnectApiKeyVisible ? ankiConnectApiKey : maskApiToken(ankiConnectApiKey)}
                    type="text"
                    color="primary"
                    onChange={(event) => onSettingChanged('ankiConnectApiKey', event.target.value)}
                    sx={{ '& input': { fontFamily: 'monospace' } }}
                    slotProps={{
                        input: {
                            disabled: !ankiConnectApiKeyVisible,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title="">
                                        <IconButton
                                            onClick={() => setShowAnkiConnectApiKey((showKey) => !showKey)}
                                            onMouseDown={(event) => event.preventDefault()}
                                        >
                                            {ankiConnectApiKeyVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            )}
            {insideApp && (
                <FormHelperText>
                    <Trans
                        i18nKey={'settings.corsHelperText'}
                        values={{ origin }}
                        components={[
                            <Link
                                key={0}
                                color="primary"
                                target="_blank"
                                rel="noreferrer"
                                href="https://youtu.be/Mv7fEVb6PHo?t=44"
                            >
                                video
                            </Link>,
                        ]}
                    />
                </FormHelperText>
            )}
            <DeckFieldTutorialBubble
                show={tutorialStep === TutorialStep.deck && !ankiConnectUrlError && !deck}
                disabled={!inTutorial}
                noDecks={deckNames === undefined || deckNames.length === 0}
                onCreateDefaultDeck={handleCreateDefaultDeck}
            >
                <AnkiSelect
                    label={t('settings.deck')}
                    value={deck}
                    selections={deckNames}
                    onValueChange={(value) => onSettingChanged('deck', value)}
                    onOpen={() => {
                        if (tutorialStep === TutorialStep.deck) {
                            onTutorialStepChanged(TutorialStep.noteType);
                        }
                    }}
                />
            </DeckFieldTutorialBubble>
            <NoteTypeTutorialBubble
                show={tutorialStep === TutorialStep.noteType && Boolean(deck) && !noteType}
                disabled={!inTutorial}
                noNoteTypes={modelNames === undefined || modelNames.length === 0}
                onCreateDefaultNoteType={handleCreateDefaultNoteType}
            >
                <AnkiSelect
                    label={t('settings.noteType')}
                    value={noteType}
                    selections={modelNames}
                    onValueChange={(value) => onSettingChanged('noteType', value)}
                    onOpen={() => {
                        if (tutorialStep === TutorialStep.noteType) {
                            onTutorialStepChanged(TutorialStep.ankiFields);
                        }
                    }}
                />
            </NoteTypeTutorialBubble>
            {ankiFieldModels.map((model, index) => {
                const key = model.custom ? `custom_${model.key}` : `standard_${model.key}`;
                const handleOrderChange =
                    !extensionInstalled || extensionSupportsOrderableAnkiFields
                        ? (d: Direction) => handleAnkiFieldOrderChange(d, ankiFieldModels, index)
                        : undefined;
                const handleDisplayChange =
                    !extensionInstalled || extensionSupportsOrderableAnkiFields
                        ? (display: boolean) => handleAnkiFieldDisplayChange(model, display)
                        : undefined;

                let disabledDirection: Direction | undefined = undefined;

                if (index === 0) {
                    disabledDirection = Direction.up;
                } else if (index === ankiFieldModels.length - 1) {
                    disabledDirection = Direction.down;
                }

                const rest = {
                    onOrderChange: handleOrderChange,
                    onDisplayChange: handleDisplayChange,
                    disabledDirection,
                    display: model.field.display,
                };

                return (
                    <React.Fragment key={key}>
                        {!model.custom && model.key === 'sentence' && (
                            <TutorialBubble
                                placement="bottom"
                                disabled={!inTutorial}
                                show={tutorialStep === TutorialStep.ankiFields && Boolean(deck) && Boolean(noteType)}
                                disableArrow
                                text={t('ftue.ankiFields')!}
                                onConfirm={() => onTutorialStepChanged(TutorialStep.testCard)}
                            >
                                <AnkiSelect
                                    label={t('settings.sentenceField')}
                                    value={sentenceField}
                                    selections={fieldNames}
                                    onValueChange={(value) => onSettingChanged('sentenceField', value)}
                                    {...rest}
                                />
                            </TutorialBubble>
                        )}
                        {!model.custom && model.key === 'definition' && (
                            <AnkiSelect
                                label={t('settings.definitionField')}
                                value={definitionField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('definitionField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom && model.key === 'word' && (
                            <AnkiSelect
                                label={t('settings.wordField')}
                                value={wordField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('wordField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom && model.key === 'audio' && (
                            <AnkiSelect
                                label={t('settings.audioField')}
                                value={audioField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('audioField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom && model.key === 'image' && (
                            <AnkiSelect
                                label={t('settings.imageField')}
                                value={imageField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('imageField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom && model.key === 'source' && (
                            <AnkiSelect
                                label={t('settings.sourceField')}
                                value={sourceField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('sourceField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom && model.key === 'url' && (
                            <AnkiSelect
                                label={t('settings.urlField')}
                                value={urlField}
                                selections={fieldNames}
                                onValueChange={(value) => onSettingChanged('urlField', value)}
                                {...rest}
                            />
                        )}
                        {!model.custom &&
                            model.key === 'track1' &&
                            (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                <AnkiSelect
                                    label={t('settings.track1Field')}
                                    value={track1Field}
                                    selections={fieldNames}
                                    onValueChange={(value) => onSettingChanged('track1Field', value)}
                                    {...rest}
                                />
                            )}
                        {!model.custom &&
                            model.key === 'track2' &&
                            (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                <AnkiSelect
                                    label={t('settings.track2Field')}
                                    value={track2Field}
                                    selections={fieldNames}
                                    onValueChange={(value) => onSettingChanged('track2Field', value)}
                                    {...rest}
                                />
                            )}
                        {!model.custom &&
                            model.key === 'track3' &&
                            (!extensionInstalled || extensionSupportsOrderableAnkiFields) && (
                                <AnkiSelect
                                    label={t('settings.track3Field')}
                                    value={track3Field}
                                    selections={fieldNames}
                                    onValueChange={(value) => onSettingChanged('track3Field', value)}
                                    {...rest}
                                />
                            )}
                        {model.custom && (
                            <AnkiSelect
                                label={`${model.key}`}
                                value={customAnkiFields[model.key]}
                                selections={fieldNames!}
                                onValueChange={(value) => handleCustomFieldChange(model.key, value)}
                                onRemoval={() => handleCustomFieldRemoval(model.key)}
                                removable={true}
                                {...rest}
                            />
                        )}
                    </React.Fragment>
                );
            })}
            <AddCustomField onAddCustomField={handleAddCustomField} />
            <ListField
                textFieldComponent={SettingsTextField}
                label={t('settings.tags')}
                fullWidth
                color="primary"
                items={tags}
                onItemsChange={(tags) => onSettingChanged('tags', tags)}
            />
            {testCard && (
                <TutorialBubble
                    placement="top"
                    disabled={!inTutorial}
                    show={tutorialStep === TutorialStep.testCard}
                    text={t('ftue.testCard')!}
                    onConfirm={() => onTutorialStepChanged(TutorialStep.done)}
                >
                    <Button variant="contained" onClick={handleCreateTestCard}>
                        {t('settings.createTestCard')}
                    </Button>
                </TutorialBubble>
            )}
        </Stack>
    );
};

export default AnkiSettingsTab;
