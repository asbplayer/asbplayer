import { createTheme as createMuiTheme, PaletteMode } from '@mui/material/styles';
import { red } from '@mui/material/colors';

export const createTheme = (themeType: PaletteMode) =>
    createMuiTheme({
        palette: {
            primary: {
                main: '#ff3f78',
            },
            error: {
                main: red.A400,
            },
            background: {
                default: 'rgba(0, 0, 0, 0)',
            },
            mode: themeType,
        },
    });
