import type { FC } from 'react';
import type { ButtonProps } from '@mui/material/Button';
import Button from '@mui/material/Button';

const NoWrapButton: FC<ButtonProps> = ({ children, sx, ...rest }) => {
    return (
        <Button
            {...rest}
            sx={[
                {
                    display: 'flex',
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    '& .MuiButton-startIcon': {
                        flexShrink: 0,
                    },
                    '& > span': {
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    },
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        >
            <span>{children}</span>
        </Button>
    );
};

export default NoWrapButton;
