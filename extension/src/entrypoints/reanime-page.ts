import { ReanimeDiscovery } from '@/pages/reanime';
import { bindVideoDataDiscovery } from '@/pages/subtitle-discovery';

export default defineUnlistedScript(() => {
    bindVideoDataDiscovery(new ReanimeDiscovery());
});
