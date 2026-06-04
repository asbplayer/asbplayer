import Drawer from './Drawer';
import Statistics, { type StatisticsProps } from './Statistics';

interface Props extends StatisticsProps {
    open: boolean;
    showBackButton: boolean;
    drawerWidth?: number;
    onClose: () => void;
}

const StatisticsDrawer: React.FC<Props> = ({
    open,
    showBackButton,
    drawerWidth,
    onClose,
    sx,
    contentPadding = 2,
    ...statisticsProps
}) => {
    return (
        <Drawer open={open} showBackButton={showBackButton} drawerWidth={drawerWidth} onClose={onClose}>
            <Statistics {...statisticsProps} contentPadding={contentPadding} sx={{ width: '100%', ...sx, p: 0 }} />
        </Drawer>
    );
};
export default StatisticsDrawer;
