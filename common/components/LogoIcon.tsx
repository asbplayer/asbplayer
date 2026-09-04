import type { SvgIconProps } from '@mui/material/SvgIcon';
import SvgIcon from '@mui/material/SvgIcon';

const LogoIcon = ({ style, ...rest }: SvgIconProps) => {
    return (
        <SvgIcon
            viewBox="0 0 28 28"
            style={{ background: 'linear-gradient(150deg, #ff1f62, #49007a 160%)', borderRadius: 3, ...style }}
            {...rest}
        >
            <path
                fill="white"
                d="M 0 0 L 0 20 L 4 21 A 1 1 0 0 0 8 21 L 8 6 A 1 1 0 0 0 4 6 L 4 21 L 0 20 L 0 0 L 12 0 L 12 23 L 22 23 A 1 1 0 0 0 22 19 L 16 19 L 16 6 A 1 1 0 0 0 12 6 L 12 0 L 20 0 L 20 13 A 1 1 0 0 0 24 13 L 24 6 A 1 1 0 0 0 20 6 L 20 0"
            />
        </SvgIcon>
    );
};

export default LogoIcon;
