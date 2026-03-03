import { useEffect, useState } from "react";

// tracks memory usage every 500ms (only chrome based browsers)
const MemoryMonitor = () => {
    type MemoryState = {
        count: number;
        currentUsage: number; // memory size currently using
        totalAllocated: number; // total memory browser allocated
        totalUsed: number;
        limit: number; // max memory limit
        average: number;   
    }

    const [memory, setMemory] = useState<MemoryState>({count: 0, currentUsage: 0, totalAllocated: 0, totalUsed: 0, limit: 0, average: 0});

    useEffect(() => {

        const probeMemory = setInterval(() => {
            if ((performance as any).memory) {
                const m = (performance as any).memory;

                setMemory(prev => {
                    const count = prev.count + 1;
                    const currentUsage = (m.usedJSHeapSize / 1048576); 
                    const totalAllocated = (m.totalJSHeapSize / 1048576); 
                    const limit = (m.jsHeapSizeLimit / 1048576); 
                    const totalUsed = prev.totalUsed + currentUsage;
                    const average = totalUsed / count;

                    return {
                        count: count, 
                        currentUsage: currentUsage, 
                        totalAllocated: totalAllocated, 
                        totalUsed: totalUsed,
                        limit: limit, 
                        average: average};
                    }
                )
            }
        }, 500);

        return () => clearInterval(probeMemory);
    }, []);

    if (!memory) return <div>Memory API not supported (use Chromium based browser)</div>

    return (
        <div style={{ position: "fixed", bottom: 10, right: 10, background: "#000", color: "#0f0", padding: 8, fontSize: 12, zIndex: 999 }}>
            <div>Current: {memory.currentUsage.toFixed(2)} MB</div>
            <div>Average: {memory.average.toFixed(2)} MB</div>
            <div>Total: {memory.totalAllocated.toFixed(2)} MB</div>
            <div>Limit: {memory.limit.toFixed(2)} MB</div>
        </div>
    );
};

export default MemoryMonitor;
