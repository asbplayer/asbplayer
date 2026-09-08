import type { SvgIconProps } from '@mui/material/SvgIcon';
import SvgIcon from '@mui/material/SvgIcon';

// This icon is a derivative of Material Icons: https://github.com/mui/material-ui/tree/master/packages/mui-icons-material

const LoadSubtitlesIcon = (props: SvgIconProps) => {
    return (
        <SvgIcon {...props}>
            <path d="M 20 9 H 4 c -1.1 0 -2 1 -2 5 v 6 c 0 1.1 0.9 2 2 2 h 16 c 1.1 0 2 -0.9 2 -2 V 11 c 0 -1.1 -0.9 -2 -2 -2 M 4 14 h 4 v 2 H 4 z m 10 6 H 4 v -2 h 10 z m 6 0 h -4 v -2 h 4 z m 0 -4 H 10 v -2 h 10 z M 17 9 L 17 12 L 7 12 L 7 9 M 10 6 L 10 10 L 14 10 L 14 6 L 19 6 L 12 0 L 5 6 L 10 6" />
        </SvgIcon>
    );
};

export default LoadSubtitlesIcon;
