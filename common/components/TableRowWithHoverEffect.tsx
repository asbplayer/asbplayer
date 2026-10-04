import TableRow from '@mui/material/TableRow';
import styled from '@mui/styles/styled';
import type { Theme } from '@mui/material';

const TableRowWithHoverEffect = styled(TableRow)<Theme>(({ theme }) => ({
    '&:hover .MuiIconButton-root': {
        background: `${theme.palette.secondary.main}29`,
    },
    '&:hover': {
        cursor: 'pointer',
    },
}));

export default TableRowWithHoverEffect;
