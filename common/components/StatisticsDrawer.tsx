import Drawer from './Drawer';
import Statistics, { type StatisticsProps } from './Statistics';

interface Props extends StatisticsProps {
    open: boolean;
    showBackButton: boolean;
    drawerWidth?: number;
    onClose: () => void;
}

const StatisticsDrawer: React.FC<Props> = ({ open, showBackButton, drawerWidth, onClose, sx, ...statisticsProps }) => {
    return (
        <Drawer open={open} showBackButton={showBackButton} drawerWidth={drawerWidth} onClose={onClose}>
            <Statistics {...statisticsProps} sx={{ width: '100%', ...sx }} />
        </Drawer>
    );
};
export default StatisticsDrawer;
