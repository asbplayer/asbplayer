import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

interface Props {
    text: string;
    onTextChange: (text: string) => void;
    disableTutorial?: boolean;
    showTutorial?: boolean;
    onConfirmTutorial?: () => void;
}
export default function DefinitionField({ text, onTextChange }: Props) {
    const { t } = useTranslation();

    return (
        <TextField
            variant="filled"
            color="primary"
            multiline
            maxRows={8}
            fullWidth
            label={t('ankiDialog.definition')}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
        />
    );
}
