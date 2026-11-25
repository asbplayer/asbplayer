import { spawn } from 'node:child_process';

interface CropOptions {
    input: string;
    output: string;
    /** Crop rectangle in page pixels. */
    x: number;
    y: number;
    width: number;
    height: number;
    /** Portion of the recording to keep, in seconds. */
    start?: number;
    duration?: number;
}

const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

/** Crops and trims a recording into a docs asset; the region is fixed for the whole clip. */
export function cropVideo({ input, output, x, y, width, height, start, duration }: CropOptions) {
    const filters = [`crop=${even(width)}:${even(height)}:${even(x)}:${even(y)}`];
    const args = ['-y', '-hide_banner', '-loglevel', 'error'];

    if (start !== undefined) args.push('-ss', start.toFixed(2));
    if (duration !== undefined) args.push('-t', duration.toFixed(2));

    args.push(
        '-i',
        input,
        '-vf',
        filters.join(','),
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        output
    );

    return new Promise<void>((resolve, reject) => {
        const process = spawn('ffmpeg', args, { stdio: 'inherit' });
        process.on('error', reject);
        process.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))
        );
    });
}
