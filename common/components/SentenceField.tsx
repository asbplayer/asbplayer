import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import makeStyles from '@mui/styles/makeStyles';
import type { SubtitleModel } from '..';
import SubtitleTextImage from '@project/common/components/SubtitleTextImage';
import { type Theme } from '@mui/material';

interface TextImageSetProps {
    selectedSubtitles: SubtitleModel[];
    width: number;
}

const useTextImageSetStyles = makeStyles<Theme>((theme) => ({
    root: {
        marginBottom: theme.spacing(1),
        padding: theme.spacing(1),
        backgroundColor: theme.palette.action.disabledBackground,
    },
}));

const TextImageSet = ({ selectedSubtitles, width }: TextImageSetProps) => {
    const classes = useTextImageSetStyles();

    if (selectedSubtitles.length === 0 || width <= 0) {
        return null;
    }

    return (
        <Paper className={classes.root}>
            {selectedSubtitles.map((s, index) => {
                return <SubtitleTextImage key={index} availableWidth={width} subtitle={s} scale={1} />;
            })}
        </Paper>
    );
};

interface Props {
    width: number;
    text: string;
    label: string;
    onChangeText: (text: string) => void;
    selectedSubtitles: SubtitleModel[];
}

export default function SentenceField({ width, text, label, onChangeText, selectedSubtitles }: Props) {
    return (
        <>
            <TextImageSet
                selectedSubtitles={selectedSubtitles.filter((s) => s.textImage !== undefined)}
                width={width}
            />
            <TextField
                variant="filled"
                color="primary"
                multiline
                fullWidth
                maxRows={8}
                label={label}
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
            />
        </>
    );
}
