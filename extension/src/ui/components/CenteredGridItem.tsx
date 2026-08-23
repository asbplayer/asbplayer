import type { GridProps } from '@mui/material/Grid';
import Grid from '@mui/material/Grid';

import React from 'react';

const CenteredGridItem = ({ children, ...props }: { children: React.ReactNode } & GridProps) => {
    const { style, ...rest } = props;
    return (
        <Grid style={{ textAlign: 'center', ...style }} {...rest}>
            {children}
        </Grid>
    );
};

export default CenteredGridItem;
