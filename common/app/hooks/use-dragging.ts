import { useEffect, useState } from 'react';

export interface ScreenLocation {
    clientX: number;
    clientY: number;
}

export interface DraggingOptions {
    holdToDragMs: number;
}

export const useDragging = ({ holdToDragMs }: DraggingOptions) => {
    const [dragging, setDragging] = useState<boolean>(false);
    const [holding, setHolding] = useState<boolean>(false);
    const [draggingStartLocation, setDraggingStartLocation] = useState<ScreenLocation>();
    const [draggingCurrentLocation, setDraggingCurrentLocation] = useState<ScreenLocation>();

    const updateLocation = (e: MouseEvent) => {
        setDraggingStartLocation((old) => {
            if (old) {
                return old;
            }
            return { clientX: e.clientX, clientY: e.clientY };
        });
        setDraggingCurrentLocation({ clientX: e.clientX, clientY: e.clientY });
    };

    useEffect(() => {
        if (!holding) {
            return;
        }

        const timeout = setTimeout(() => {
            // If the user is intentionally trying to select something then don't
            // enable dragging
            const selection = document.getSelection();
            if (selection === null || selection.type !== 'Range') {
                setDragging(true);
                setHolding(false);
            }
        }, holdToDragMs);
        return () => clearTimeout(timeout);
    }, [holdToDragMs, holding]);

    useEffect(() => {
        const enableDragging = (e: MouseEvent) => {
            // Must be left-click and far enough to the left to avoid
            // triggering drag due to scrolling
            if (e.button === 0 && e.clientX <= window.innerWidth - 50) {
                setHolding(true);
                updateLocation(e);
            }
        };
        const disableDragging = () => {
            setDragging(false);
            setHolding(false);
            setDraggingStartLocation(undefined);
            setDraggingCurrentLocation(undefined);
        };

        window.addEventListener('mousedown', enableDragging);
        window.addEventListener('mouseup', disableDragging);
        window.addEventListener('mouseleave', disableDragging);
        return () => {
            window.removeEventListener('mousedown', enableDragging);
            window.removeEventListener('mouseup', disableDragging);
            window.removeEventListener('mouseleave', disableDragging);
        };
    }, []);

    useEffect(() => {
        if (!dragging) {
            return;
        }

        window.addEventListener('mousemove', updateLocation);
        return () => window.removeEventListener('mousemove', updateLocation);
    }, [dragging]);

    return { dragging, draggingStartLocation, draggingCurrentLocation };
};
