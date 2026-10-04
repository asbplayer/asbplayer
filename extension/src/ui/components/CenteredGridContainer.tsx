import React from 'react';
import type { GridProps } from '@mui/material/Grid';
import Grid from '@mui/material/Grid';

const CenteredGridContainer = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    return (
        <Grid
            container
            style={{ width: '100%', height: '100%' }}
            alignContent="center"
            justifyContent="center"
            {...props}
        >
            {children}
        </Grid>
    );
};

export default CenteredGridContainer;
