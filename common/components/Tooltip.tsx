import type { TooltipProps } from '@mui/material/Tooltip';
import MuiTooltip from '@mui/material/Tooltip';

interface ControllableTooltipProps extends TooltipProps {
    disabled?: boolean;
}

const Tooltip = ({ children, disabled, ...rest }: ControllableTooltipProps) => {
    if (disabled) {
        return children;
    }

    return (
        <MuiTooltip disableInteractive={true} {...rest}>
            {children}
        </MuiTooltip>
    );
};

export default Tooltip;
