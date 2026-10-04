import Stack from '@mui/material/Stack';
import type { StackProps } from '@mui/material/Stack';

const responsiveSettingsStackSx = {
    flexWrap: 'wrap',
    '& > *': {
        flex: '1 1 280px',
        minWidth: 'min(100%, 280px)',
    },
} as const;

const ResponsiveSettingsStack = ({ children, ...props }: StackProps) => (
    <Stack direction="row" spacing={1} useFlexGap sx={responsiveSettingsStackSx} {...props}>
        {children}
    </Stack>
);

export default ResponsiveSettingsStack;
