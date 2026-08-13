import { useMemo } from 'react';
import { makeStyles } from '@mui/styles';
import { type Theme } from '@mui/material';
import { SubtitleSettings, TextSubtitleSettings, textSubtitleSettingsForTrack } from '@project/common/settings';
import { computeStyles } from '@project/common/util';

interface Props {
    subtitleSettings: SubtitleSettings;
    text: string;
    track?: number;
    onTextChanged: (text: string) => void;
}

const useStyles = makeStyles<Theme>((theme) => ({
    subtitlePreview: {
        backgroundImage: `linear-gradient(45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(-45deg, ${theme.palette.action.disabledBackground} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${theme.palette.action.disabledBackground} 75%), linear-gradient(-45deg, transparent 75%,${theme.palette.action.disabledBackground} 75%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        maxWidth: '100%',
        padding: 10,
    },
    subtitlePreviewInput: {
        border: 'none',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0)',
        '&:focus': {
            outline: 'none',
        },
    },
    blurred: {
        filter: 'blur(10px)',
        '&:hover': {
            filter: 'none',
        },
    },
}));

interface InputProps {
    text: string;
    className: string;
    onTextChanged: (text: string) => void;
    textSubtitleSettings: TextSubtitleSettings;
}

const SubtitlePreviewInput = ({ text, className, textSubtitleSettings, onTextChanged }: InputProps) => {
    const {
        subtitleSize,
        subtitleColor,
        subtitleThickness,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleShadowThickness,
        subtitleShadowColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitleCustomStyles,
        subtitleBlur,
        subtitleAlignment,
    } = textSubtitleSettings;

    const subtitlePreviewStyles = useMemo(
        () =>
            computeStyles({
                subtitleColor,
                subtitleSize,
                subtitleThickness,
                subtitleOutlineThickness,
                subtitleOutlineColor,
                subtitleShadowThickness,
                subtitleShadowColor,
                subtitleBackgroundOpacity,
                subtitleBackgroundColor,
                subtitleFontFamily,
                subtitleCustomStyles,
                subtitleBlur,
                subtitleAlignment,
            }),
        [
            subtitleColor,
            subtitleSize,
            subtitleThickness,
            subtitleOutlineThickness,
            subtitleOutlineColor,
            subtitleShadowThickness,
            subtitleShadowColor,
            subtitleBackgroundOpacity,
            subtitleBackgroundColor,
            subtitleFontFamily,
            subtitleCustomStyles,
            subtitleBlur,
            subtitleAlignment,
        ]
    );

    return (
        <input
            value={text}
            className={className}
            onChange={(event) => onTextChanged(event.target.value)}
            style={subtitlePreviewStyles}
        />
    );
};

export default function SubtitlePreview({ subtitleSettings, text, track, onTextChanged }: Props) {
    const classes = useStyles();
    const inputClassName = (s: TextSubtitleSettings) =>
        s.subtitleBlur ? `${classes.subtitlePreviewInput} ${classes.blurred}` : classes.subtitlePreviewInput;
    const textSubtitleSettings = textSubtitleSettingsForTrack(subtitleSettings, track);
    const {
        subtitleSize,
        subtitleColor,
        subtitleThickness,
        subtitleOutlineThickness,
        subtitleOutlineColor,
        subtitleShadowThickness,
        subtitleShadowColor,
        subtitleBackgroundColor,
        subtitleBackgroundOpacity,
        subtitleFontFamily,
        subtitleCustomStyles,
        subtitleBlur,
    } = textSubtitleSettings;

    if (
        subtitleSize === undefined ||
        subtitleColor === undefined ||
        subtitleThickness === undefined ||
        subtitleOutlineThickness === undefined ||
        subtitleOutlineColor === undefined ||
        subtitleShadowThickness === undefined ||
        subtitleShadowColor === undefined ||
        subtitleBackgroundColor === undefined ||
        subtitleBackgroundOpacity === undefined ||
        subtitleFontFamily === undefined ||
        subtitleCustomStyles === undefined ||
        subtitleBlur === undefined
    ) {
        return (
            <div className={classes.subtitlePreview}>
                {[...Array(subtitleSettings.subtitleTracksV2.length + 1).keys()].map((track) => {
                    const textSubtitleSettings = textSubtitleSettingsForTrack(
                        subtitleSettings,
                        track
                    ) as TextSubtitleSettings;

                    return (
                        <SubtitlePreviewInput
                            key={track}
                            text={text}
                            className={inputClassName(textSubtitleSettings)}
                            textSubtitleSettings={textSubtitleSettings}
                            onTextChanged={onTextChanged}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <div className={classes.subtitlePreview}>
            <SubtitlePreviewInput
                text={text}
                className={inputClassName(textSubtitleSettings as TextSubtitleSettings)}
                textSubtitleSettings={textSubtitleSettings as TextSubtitleSettings}
                onTextChanged={onTextChanged}
            />
        </div>
    );
}
