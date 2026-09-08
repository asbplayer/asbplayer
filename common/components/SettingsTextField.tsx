import React from 'react';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import MuiTextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';

const SettingsTextField: React.FC<TextFieldProps> = ({ label, ...rest }) => {
    return (
        <FormControl fullWidth>
            <FormLabel>{label}</FormLabel>
            <MuiTextField {...rest} />
        </FormControl>
    );
};

export default SettingsTextField;
