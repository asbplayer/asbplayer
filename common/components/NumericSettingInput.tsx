import React, { useEffect, useRef, useState } from 'react';
import type { TextFieldProps } from '@mui/material/TextField';
import { normalizeFinite } from '@project/common/util';
import SettingsTextField from '@project/common/components/SettingsTextField';

const integerValueRegex = /^-?\d+$/;

export interface NumericSettingInputProps extends Omit<TextFieldProps, 'onBlur' | 'onChange' | 'type' | 'value'> {
    value: number;
    onValueChange: (value: number) => void;
    normalizeValue?: (value: number) => number | undefined;
    integerOnly?: boolean;
    onBlur?: TextFieldProps['onBlur'];
}

const NumericSettingInput: React.FC<NumericSettingInputProps> = ({
    value,
    onValueChange,
    normalizeValue = (value) => normalizeFinite(value, undefined),
    integerOnly = false,
    onBlur,
    ...props
}) => {
    const [inputValue, setInputValue] = useState(String(value));
    const lastReportedValue = useRef<number | undefined>(value);

    useEffect(() => {
        if (lastReportedValue.current !== value) setInputValue(String(value));
        lastReportedValue.current = value;
    }, [value]);

    return (
        <SettingsTextField
            {...props}
            type="number"
            value={inputValue}
            onChange={(event) => {
                const nextInputValue = event.target.value;
                setInputValue(nextInputValue);

                const parsedValue = Number(nextInputValue);
                const normalizedValue =
                    nextInputValue.trim() === '' || (integerOnly && !integerValueRegex.test(nextInputValue))
                        ? undefined
                        : normalizeValue(parsedValue);
                lastReportedValue.current = normalizedValue;
                if (normalizedValue !== undefined) {
                    if (parsedValue !== normalizedValue) {
                        setInputValue(String(normalizedValue));
                    }
                    onValueChange(normalizedValue);
                }
            }}
            onBlur={(event) => {
                const parsedValue = Number(inputValue);
                const normalizedValue =
                    inputValue.trim() === '' || (integerOnly && !integerValueRegex.test(inputValue))
                        ? undefined
                        : normalizeValue(parsedValue);
                if (normalizedValue === undefined) {
                    lastReportedValue.current = value;
                    setInputValue(String(value));
                } else if (parsedValue !== normalizedValue) {
                    lastReportedValue.current = normalizedValue;
                    setInputValue(String(normalizedValue));
                }
                onBlur?.(event);
            }}
        />
    );
};

export default NumericSettingInput;
