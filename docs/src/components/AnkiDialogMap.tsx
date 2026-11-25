import { useState } from 'react';
import map from '../generated/anki-dialog-map.json';
import styles from './AnkiDialogMap.module.css';

interface Region {
    x: number;
    y: number;
    w: number;
    h: number;
}

const links: Record<string, { href: string; label: string }> = {
    'text-fields': { href: '#text-fields', label: 'Text fields' },
    'audio-field': { href: '#audio-field', label: 'Audio field' },
    'image-field': { href: '#image-field', label: 'Image field' },
    'selected-time-range': { href: '#selected-time-range', label: 'Selected time range' },
};

/** Full-area polygon with the region cut out, so the region stays bright. */
const cutout = (region: Region) =>
    `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ` +
    `${region.x}% ${region.y}%, ${region.x + region.w}% ${region.y}%, ` +
    `${region.x + region.w}% ${region.y + region.h}%, ${region.x}% ${region.y + region.h}%, ` +
    `${region.x}% ${region.y}%)`;

/**
 * The Anki export dialog with a link over each adjustable part. Regions are generated from
 * the captured dialog as percentages, so they stay aligned with the image.
 */
const AnkiDialogMap = () => {
    const regions = map.regions as Record<string, Region>;
    const [active, setActive] = useState<string>();
    const activeRegion = active === undefined ? undefined : regions[active];

    const activate = (key: string) => setActive(key);
    const deactivate = (key: string) => setActive((current) => (current === key ? undefined : current));

    return (
        <div
            style={{
                position: 'relative',
                maxWidth: map.width,
                margin: '0 auto',
                overflow: 'hidden',
                borderRadius: 8,
                boxShadow: '0 2px 14px rgba(0, 0, 0, 0.25)',
            }}
        >
            <img
                src="/img/generated/anki-dialog-map.png"
                alt="The Anki export dialog, with each adjustable part linking to its description"
                style={{ display: 'block', width: '100%' }}
            />
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'rgba(0, 0, 0, 0.35)',
                    opacity: activeRegion === undefined ? 0 : 1,
                    transition: 'opacity 160ms ease',
                    clipPath: activeRegion === undefined ? undefined : cutout(activeRegion),
                }}
            />
            {Object.entries(regions).map(([key, region]) => {
                const link = links[key];
                if (link === undefined) return null;
                return (
                    <a
                        key={key}
                        href={link.href}
                        aria-label={link.label}
                        className={styles.region}
                        style={{
                            left: `${region.x}%`,
                            top: `${region.y}%`,
                            width: `${region.w}%`,
                            height: `${region.h}%`,
                        }}
                        onMouseEnter={() => activate(key)}
                        onMouseLeave={() => deactivate(key)}
                        onFocus={() => activate(key)}
                        onBlur={() => deactivate(key)}
                    />
                );
            })}
        </div>
    );
};

export default AnkiDialogMap;
