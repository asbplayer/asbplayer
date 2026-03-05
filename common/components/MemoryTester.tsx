import { useEffect, useState } from "react";

// this only captures the heap, not all the dom stuff, use measureUserAgentSpecificMemory() instead
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
                        average: average
                    };
                })
            }
        }, 500);

        return () => clearInterval(probeMemory);
    }, []);

    useEffect(() => {

        const probeMemoryUsage = async () => {
            if (crossOriginIsolated && ('measureUserAgentSpecificMemory' in performance)) {
                const measure = performance.measureUserAgentSpecificMemory as () => Promise<{
                    bytes: number,
                    breakdown: []
                }>
                const memSample = await measure();
                console.log(memSample);
            }
        }

    })

    if (!memory) return <div>Memory API not supported (use Chromium based browser)</div>

    return (
        <div style={{ position: "fixed", bottom: 10, right: 10, background: "#000", color: "#0f0", padding: 8, fontSize: 12, zIndex: 999 }}>
        </div>
    );
};

export default MemoryMonitor;
