import Drawer from '@project/common/components/Drawer';
import Statistics from '@project/common/components/Statistics';
import type { StatisticsProps } from '@project/common/components/Statistics';

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
