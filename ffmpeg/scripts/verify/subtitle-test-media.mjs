// Requires a system ffmpeg. Generated media contains authored text/bitmaps and a solid-color video.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

export const generateSubtitleMedia = async (root) => {
    const srt =
        '1\n00:00:02,000 --> 00:00:04,000\n日本語 & <literal>\nline two\n\n2\n00:00:03,000 --> 00:00:05,000\nOverlap\n\n3\n00:00:07,000 --> 00:00:08,000\nFinal cue\n';
    const header =
        '[Script Info]\nScriptType: v4.00+\nPlayResX: 320\nPlayResY: 240\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    await writeFile(resolve(root, 'text.srt'), srt);
    await writeFile(
        resolve(root, 'text.ass'),
        header +
            'Dialogue: 0,0:00:02.00,0:00:04.00,Default,,0,0,0,,{\\k20}日本語\\htext\\N\\Nline two{\\p1}m 0 0 l 10 10{\\p0} end <b>literal</b> &amp;\n'
    );
    const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: root });
    const video = ['-f', 'lavfi', '-i', 'color=size=16x16:rate=1:duration=10'];
    run([
        '-copyts',
        ...video,
        '-i',
        'text.srt',
        '-i',
        'text.ass',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-map',
        '2:s',
        '-c:v',
        'libx264',
        '-c:s',
        'copy',
        '-metadata:s:s:0',
        'language=jpn',
        '-metadata:s:s:1',
        'title=Karaoke',
        '-output_ts_offset',
        '7',
        'mixed.mkv',
    ]);
    run([
        ...video,
        '-i',
        'text.srt',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'mov_text',
        'timed-text.mp4',
    ]);
    run(['-i', 'timed-text.mp4', '-map', '0', '-c', 'copy', '-output_ts_offset', '10', 'delayed.mp4']);
    run([
        ...video,
        '-f',
        'lavfi',
        '-i',
        'sine=duration=1',
        '-i',
        'text.srt',
        '-map',
        '0:v',
        '-map',
        '1:a',
        '-map',
        '2:s',
        '-af',
        'aselect=0',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-c:s',
        'copy',
        'empty-audio.mkv',
    ]);
    // An unsupported subtitle still occupies an ordinal before a supported one.
    run([
        ...video,
        '-i',
        'text.srt',
        '-i',
        'text.srt',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-map',
        '2:s',
        '-c:v',
        'libx264',
        '-c:s:0',
        'ttml',
        '-c:s:1',
        'mov_text',
        'unsupported-first.mp4',
    ]);
    // FFmpeg classifies an unrecognized WebVTT sample entry as data. It must not shift the selected track ID.
    run(['-i', 'timed-text.mp4', '-map', '0:v', '-map', '0:s', '-map', '0:s', '-c', 'copy', 'two-text-tracks.mp4']);
    const withWebVtt = await readFile(resolve(root, 'two-text-tracks.mp4'));
    const firstSampleEntry = withWebVtt.indexOf('tx3g');
    if (firstSampleEntry < 0) throw new Error('Expected a timed text sample entry');
    withWebVtt.write('wvtt', firstSampleEntry);
    await writeFile(resolve(root, 'webvtt-first.mp4'), withWebVtt);

    // Authored PGS display sets: two placed rectangles, transparent and translucent pixels,
    // followed by clears. System FFmpeg converts these to DVD/DVB for decoder regressions.
    const pgsClockRateHz = 90000;
    const pgsPaletteDefinitionSegment = 0x14;
    const pgsObjectDefinitionSegment = 0x15;
    const pgsPresentationCompositionSegment = 0x16;
    const pgsEndDisplaySetSegment = 0x80;
    const word = (value) => {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(value);
        return buffer;
    };
    const segment = (seconds, type, payload) => {
        const bytes = Buffer.from(payload);
        const header = Buffer.alloc(13);
        header.write('PG');
        header.writeUInt32BE(seconds * pgsClockRateHz, 2);
        header[10] = type;
        header.writeUInt16BE(bytes.length, 11);
        return Buffer.concat([header, bytes]);
    };
    const display = (seconds, { clear = false } = {}) => {
        const composition = Buffer.concat([
            word(320),
            word(240),
            Buffer.from([0x10]),
            word(seconds),
            Buffer.from([clear ? 0 : 0x80, 0, 0, clear ? 0 : 2]),
            ...(clear
                ? []
                : [
                      Buffer.concat([word(0), Buffer.from([0, 0]), word(20), word(180)]),
                      Buffer.concat([word(1), Buffer.from([0, 0]), word(30), word(182)]),
                  ]),
        ]);
        const parts = [segment(seconds, pgsPresentationCompositionSegment, composition)];
        if (!clear) {
            parts.push(
                segment(
                    seconds,
                    pgsPaletteDefinitionSegment,
                    [0, 0, 0, 0, 128, 128, 0, 1, 235, 128, 128, 255, 2, 81, 240, 90, 128]
                )
            );
            for (const id of [0, 1]) {
                const rle = Buffer.from([1, 2, 0, 2, 0, 0, 1, 1, 1, 1, 0, 0]);
                parts.push(
                    segment(
                        seconds,
                        pgsObjectDefinitionSegment,
                        Buffer.concat([word(id), Buffer.from([0, 0xc0, 0, 0, rle.length + 4]), word(4), word(2), rle])
                    )
                );
            }
        }
        parts.push(segment(seconds, pgsEndDisplaySetSegment, []));
        return Buffer.concat(parts);
    };
    await writeFile(
        resolve(root, 'bitmap.sup'),
        Buffer.concat([display(2), display(4, { clear: true }), display(6), display(8, { clear: true })])
    );
    for (const [name, codec] of [
        ['pgs', 'copy'],
        ['dvd', 'dvdsub'],
        ['dvb', 'dvbsub'],
    ]) {
        run([
            '-copyts',
            '-f',
            'lavfi',
            '-i',
            'color=size=320x240:rate=1:duration=10',
            '-fix_sub_duration',
            '-i',
            'bitmap.sup',
            '-map',
            '0:v',
            '-map',
            '1:s',
            '-c:v',
            'libx264',
            '-c:s',
            codec,
            `${name}.mkv`,
        ]);
    }
    // Matroska exposes an attached JPEG as a video stream without a playback timeline.
    run(['-f', 'lavfi', '-i', 'color=size=16x16:duration=1', '-frames:v', '1', 'cover.jpg']);
    run([
        '-i',
        'dvd.mkv',
        '-map',
        '0',
        '-c',
        'copy',
        '-attach',
        'cover.jpg',
        '-metadata:s:t',
        'mimetype=image/jpeg',
        'dvd-cover.mkv',
    ]);
    await writeFile(
        resolve(root, 'uncleared.sup'),
        Buffer.concat([display(2), display(4, { clear: true }), display(6)])
    );
    run([
        '-copyts',
        '-f',
        'lavfi',
        '-i',
        'color=size=320x240:rate=1:duration=10',
        '-i',
        'uncleared.sup',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'copy',
        'uncleared.mkv',
    ]);
    run(['-i', 'dvd.mkv', '-map', '0', '-c', 'copy', 'dvd.mp4']);
    // Minimal Matroska elements exercise compressed subtitle packets.
    const vint = (value) => {
        for (let length = 1; length <= 8; length++) {
            if (value >= 2 ** (7 * length) - 1) continue;
            let bits = BigInt(value) | (1n << BigInt(7 * length));
            const bytes = Buffer.alloc(length);
            for (let i = length - 1; i >= 0; i--) {
                bytes[i] = Number(bits & 255n);
                bits >>= 8n;
            }
            return bytes;
        }
        throw new Error('EBML element too large');
    };
    const element = (id, bytes) => {
        bytes = Buffer.from(bytes);
        return Buffer.concat([Buffer.from(id, 'hex'), vint(bytes.length), bytes]);
    };
    const uint = (id, value) => {
        const bytes = [];
        do {
            bytes.unshift(value & 255);
            value >>>= 8;
        } while (value);
        return element(id, bytes);
    };
    const text = (id, value) => element(id, Buffer.from(value));
    const master = (id, ...children) => element(id, Buffer.concat(children));
    const ebml = master(
        '1a45dfa3',
        uint('4286', 1),
        uint('42f7', 1),
        uint('42f2', 4),
        uint('42f3', 8),
        text('4282', 'matroska'),
        uint('4287', 4),
        uint('4285', 2)
    );
    // Exercise the separately linked zlib dependency without a format-by-format matrix.
    await writeFile(
        resolve(root, 'zlib.mkv'),
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master(
                    '1654ae6b',
                    master(
                        'ae',
                        uint('d7', 1),
                        uint('73c5', 1),
                        uint('83', 17),
                        text('86', 'S_TEXT/UTF8'),
                        master(
                            '6d80',
                            master(
                                '6240',
                                uint('5031', 0),
                                uint('5032', 1),
                                uint('5033', 0),
                                master('5034', uint('4254', 0))
                            )
                        )
                    )
                ),
                master(
                    '1f43b675',
                    uint('e7', 0),
                    master(
                        'a0',
                        element(
                            'a1',
                            Buffer.concat([
                                Buffer.from([0x81, 0x07, 0xd0, 0]),
                                deflateSync(Buffer.from('日本語 compressed text')),
                            ])
                        ),
                        uint('9b', 2000)
                    )
                )
            ),
        ])
    );

    const subtitleBlock = (ms, cueText) => {
        const header = Buffer.from([0x81, 0, 0, 0]);
        header.writeInt16BE(ms, 1);
        return master('a0', element('a1', Buffer.concat([header, Buffer.from(cueText)])), uint('9b', 1000));
    };
    const subtitleMedia = (...blocks) =>
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master(
                    '1654ae6b',
                    master('ae', uint('d7', 1), uint('73c5', 1), uint('83', 17), text('86', 'S_TEXT/UTF8'))
                ),
                master('1f43b675', uint('e7', 0), ...blocks)
            ),
        ]);
    await writeFile(
        resolve(root, 'reordered.mkv'),
        subtitleMedia(subtitleBlock(3000, 'Later cue'), subtitleBlock(2000, 'Earlier cue'))
    );
    await writeFile(
        resolve(root, 'dense.mkv'),
        subtitleMedia(...Array.from({ length: 300 }, (_, index) => subtitleBlock(index * 2, `Dense cue ${index}`)))
    );
    await writeFile(
        resolve(root, 'outside-reorder-window.mkv'),
        subtitleMedia(
            subtitleBlock(9000, 'Published cue'),
            subtitleBlock(12000, 'Buffered cue'),
            subtitleBlock(5000, 'Too late')
        )
    );
};
