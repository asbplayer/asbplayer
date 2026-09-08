import FormControlLabel from '@mui/material/FormControlLabel';
import styled from '@mui/styles/styled';
import type { Theme } from '@mui/material';

const LabelWithHoverEffect = styled(FormControlLabel)<Theme>(({ theme }) => ({
    '&:hover .MuiSwitch-thumb': {
        outline: `9px solid ${theme.palette.primary.main}29`,
    },
    '&:hover .MuiRadio-colorPrimary': {
        background: `${theme.palette.primary.main}29`,
    },
}));

export default LabelWithHoverEffect;
