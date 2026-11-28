import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Usage: node pages/serve.mjs [--root <dir>] [--port <port>] [--spa]
// Serves the fixture pages by default; --spa serves a single-page app (index.html fallback).
const args = process.argv.slice(2);
const flag = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
};

const root = path.resolve(import.meta.dirname, flag('--root', 'public'));
const port = Number(flag('--port', '8931'));
const spa = args.includes('--spa');

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.mp4': 'video/mp4',
    '.srt': 'text/plain; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

// Chrome requires byte-range support on media responses for seeking to work.
http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    let file = path.normalize(path.join(root, url.pathname));
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
    }

    fs.stat(file, (err, stats) => {
        if (err || !stats.isFile()) {
            // Single-page apps route client-side; anything without a file extension is a route.
            if (spa && !path.extname(url.pathname)) {
                file = path.join(root, 'index.html');
                fs.stat(file, (spaErr, spaStats) => {
                    if (spaErr || !spaStats.isFile()) {
                        res.writeHead(404).end();
                        return;
                    }
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Content-Length': spaStats.size,
                    });
                    fs.createReadStream(file).pipe(res);
                });
                return;
            }
            res.writeHead(404).end();
            return;
        }

        const headers = {
            'Content-Type': contentTypes[path.extname(file)] ?? 'application/octet-stream',
            'Accept-Ranges': 'bytes',
        };

        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
        if (range) {
            const start = range[1] ? Number(range[1]) : 0;
            const end = range[2] ? Number(range[2]) : stats.size - 1;
            res.writeHead(206, {
                ...headers,
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': end - start + 1,
            });
            fs.createReadStream(file, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { ...headers, 'Content-Length': stats.size });
            fs.createReadStream(file).pipe(res);
        }
    });
}).listen(port, () => {
    console.log(`serving ${root} on http://localhost:${port}${spa ? ' (spa)' : ''}`);
});
