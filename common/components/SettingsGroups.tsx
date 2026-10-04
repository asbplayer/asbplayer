import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Stack from '@mui/material/Stack';
import React from 'react';

interface Props {
    children: React.ReactNode[];
    groupLabels: string[];
    selectedGroupIndex: number;
    onGroupSelected: (groupIndex: number) => void;
}

const SettingsGroups: React.FC<Props> = ({ children, groupLabels, selectedGroupIndex, onGroupSelected }) => {
    return (
        <div>
            <ButtonGroup variant="outlined" fullWidth>
                {groupLabels.map((label, index) => {
                    return (
                        <Button
                            key={index}
                            onClick={() => onGroupSelected(index)}
                            variant={selectedGroupIndex === index ? 'contained' : 'outlined'}
                            sx={{
                                borderBottomLeftRadius: index === 0 ? 1 : undefined,
                                borderBottomRightRadius: index === groupLabels.length - 1 ? 1 : undefined,
                            }}
                        >
                            {label}
                        </Button>
                    );
                })}
            </ButtonGroup>
            <Stack
                spacing={1}
                sx={{
                    p: 1.5,
                    border: (theme) => `1px solid ${theme.palette.action.focus}`,
                    borderTop: 'none',
                    borderRadius: 1,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                }}
            >
                {children}
            </Stack>
        </div>
    );
};

export default SettingsGroups;
