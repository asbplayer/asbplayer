import React, { useCallback, useEffect, useState } from 'react';
import type { TextFieldProps } from '@mui/material';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

function extractTagsFromString(value: string) {
    if (value === '') {
        return [];
    }

    const splitTags = value.split(' ').join('').split(',');
    const tags = [];

    for (const tag of splitTags) {
        tags.push(tag.trim());
    }

    return tags;
}

export interface Props {
    items: string[];
    textFieldComponent?: React.FC<TextFieldProps>;
    onItemsChange: (tags: string[]) => void;
}

export default function ListField({ items, onItemsChange, textFieldComponent, ...props }: Props & TextFieldProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState('');

    useEffect(() => {
        const tagsString = items.join(', ');

        if (tagsString !== value) {
            setValue(items.join(', '));
        }
    }, [value, items]);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            let currentValue = e.target.value;

            if (value.length > currentValue.length && value.includes(currentValue) && currentValue.endsWith(',')) {
                // Detected a backspace at the last comma, move cursor back enough to remove the comma
                currentValue = currentValue.substring(0, currentValue.length - 1);
            }

            // Decompose string into individual tags by removing all spaces and splitting on ","
            const newTags = extractTagsFromString(currentValue);
            setValue(newTags.join(', '));
            onItemsChange(newTags);
        },
        [value, onItemsChange]
    );

    const textFieldProps = { ...props, helperText: t('settings.tagsHelperText'), value, onChange: handleChange };

    if (textFieldComponent) {
        return textFieldComponent(textFieldProps);
    }

    return <TextField {...textFieldProps} />;
}
