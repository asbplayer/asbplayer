// Requires a system ffmpeg. Generated media contains authored text/bitmaps and a solid-color video.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

export const generateSubtitleMedia = async (root) => {
    const srt =
        '1\n00:00:02,000 --> 00:00:04,000\n日本語 &amp; &lt;literal&gt; C:\\new and C:\\Notes\nline two\n\n2\n00:00:03,000 --> 00:00:05,000\nOverlap\n\n3\n00:00:07,000 --> 00:00:08,000\nFinal cue\n';
    const header =
        '[Script Info]\nScriptType: v4.00+\nPlayResX: 320\nPlayResY: 240\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    await writeFile(resolve(root, 'text.srt'), srt);
    await writeFile(
        resolve(root, 'text.ass'),
        header +
            'Dialogue: 0,0:00:01.00,0:00:01.00,Default,,0,0,0,,Zero duration cue\n' +
            'Dialogue: 0,0:00:02.00,0:00:04.00,Default,,0,0,0,,{\\k20}日本語\\htext\\N\\Nline two{\\p01}m 0 0 l 10 10{\\p} end {note \\p1}<b>literal</b> &amp;\n' +
            'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,{\\p1}m 0 0 l 5 5{\\r}Reset text\n'
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
    // Author a mov_text sample with literal backslashes and ASS-like braces (ffmpeg -c:s mov_text from SRT mangles them).
    const literalMovText = 'C:\\new and C:\\Notes {\\b1}tag{\\b0} Before {\\unclosed after';
    await writeFile(
        resolve(root, 'movtext-placeholder.srt'),
        `1\n00:00:02,000 --> 00:00:04,000\n${'X'.repeat(literalMovText.length)}\n`
    );
    run([
        ...video,
        '-i',
        'movtext-placeholder.srt',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'mov_text',
        'movtext-literal.mp4',
    ]);
    const movTextLiteral = await readFile(resolve(root, 'movtext-literal.mp4'));
    const placeholderOffset = movTextLiteral.indexOf('X'.repeat(literalMovText.length));
    if (placeholderOffset < 0) throw new Error('Expected mov_text placeholder payload');
    movTextLiteral.write(literalMovText, placeholderOffset, 'utf8');
    await writeFile(resolve(root, 'movtext-literal.mp4'), movTextLiteral);

    // Author a BOM-marked UTF-16BE mov_text sample (3GPP TS 26.245) and a NUL-terminated UTF-8 sample.
    const utf16BeBytes = Buffer.from([
        0xfe,
        0xff, // UTF-16BE BOM
        0x65,
        0xe5, // 日
        0x67,
        0x2c, // 本
        0x8a,
        0x9e, // 語
        0xd8,
        0x40,
        0xdc,
        0x0b, // 𠀋 (U+2000B surrogate pair)
    ]);
    const nulTerminatedBytes = Buffer.from('Hello\0ignored', 'utf8');
    const crLineBreakBytes = Buffer.from('Top\rLine', 'utf8');
    await writeFile(
        resolve(root, 'movtext-utf16.srt'),
        `1\n00:00:02,000 --> 00:00:03,000\n${'A'.repeat(utf16BeBytes.length)}\n\n` +
            `2\n00:00:04,000 --> 00:00:05,000\n${'B'.repeat(nulTerminatedBytes.length)}\n\n` +
            `3\n00:00:06,000 --> 00:00:07,000\n${'C'.repeat(crLineBreakBytes.length)}\n`
    );
    run([
        ...video,
        '-i',
        'movtext-utf16.srt',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'mov_text',
        'movtext-utf16.mp4',
    ]);
    const movTextUtf16 = await readFile(resolve(root, 'movtext-utf16.mp4'));
    const utf16Offset = movTextUtf16.indexOf('A'.repeat(utf16BeBytes.length));
    const nulOffset = movTextUtf16.indexOf('B'.repeat(nulTerminatedBytes.length));
    const crOffset = movTextUtf16.indexOf('C'.repeat(crLineBreakBytes.length));
    if (utf16Offset < 0 || nulOffset < 0 || crOffset < 0) {
        throw new Error('Expected mov_text UTF-16/NUL/CR placeholder payloads');
    }
    utf16BeBytes.copy(movTextUtf16, utf16Offset);
    nulTerminatedBytes.copy(movTextUtf16, nulOffset);
    crLineBreakBytes.copy(movTextUtf16, crOffset);
    await writeFile(resolve(root, 'movtext-utf16.mp4'), movTextUtf16);

    // Author an MP4 whose two mov_text cue samples both have corrupt tsmb box sizes (< 8).
    await writeFile(
        resolve(root, 'movtext-two.srt'),
        '1\n00:00:02,000 --> 00:00:03,000\nAAAAAAAAAAAA\n\n2\n00:00:04,000 --> 00:00:05,000\nBBBBBBBBBBBB\n'
    );
    run([
        ...video,
        '-i',
        'movtext-two.srt',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'mov_text',
        'movtext-unreadable.mp4',
    ]);
    const movTextUnreadable = await readFile(resolve(root, 'movtext-unreadable.mp4'));
    for (const marker of ['AAAAAAAAAAAA', 'BBBBBBBBBBBB']) {
        const offset = movTextUnreadable.indexOf(marker);
        if (offset < 2) throw new Error(`Expected mov_text sample ${marker}`);
        // Replace 2-byte text_length (12) + 12-byte text with text_length=0 + an 8-byte invalid box (size=0 < 8).
        movTextUnreadable.writeUInt16BE(0, offset - 2);
        movTextUnreadable.fill(0, offset, offset + 12);
        movTextUnreadable.write('styl', offset + 4, 'ascii');
    }
    await writeFile(resolve(root, 'movtext-unreadable.mp4'), movTextUnreadable);

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
    const pgsSegment = (type, payload) => {
        const bytes = Buffer.from(payload);
        const header = Buffer.alloc(3);
        header[0] = type;
        header.writeUInt16BE(bytes.length, 1);
        return Buffer.concat([header, bytes]);
    };
    const displaySegments = (seconds, { clear = false, alpha = 128, screenWidth = 320 } = {}) => {
        const composition = Buffer.concat([
            word(screenWidth),
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
        const parts = [pgsSegment(pgsPresentationCompositionSegment, composition)];
        if (!clear) {
            parts.push(
                pgsSegment(pgsPaletteDefinitionSegment, [
                    0,
                    0,
                    0,
                    0,
                    128,
                    128,
                    0,
                    1,
                    235,
                    128,
                    128,
                    255,
                    2,
                    81,
                    240,
                    90,
                    alpha,
                ])
            );
            for (const id of [0, 1]) {
                const rle = Buffer.from([1, 2, 0, 2, 0, 0, 1, 1, 1, 1, 0, 0]);
                parts.push(
                    pgsSegment(
                        pgsObjectDefinitionSegment,
                        Buffer.concat([word(id), Buffer.from([0, 0xc0, 0, 0, rle.length + 4]), word(4), word(2), rle])
                    )
                );
            }
        }
        parts.push(pgsSegment(pgsEndDisplaySetSegment, []));
        return parts;
    };
    const display = (seconds, options) => {
        const supHeader = Buffer.alloc(10);
        supHeader.write('PG');
        supHeader.writeUInt32BE(seconds * pgsClockRateHz, 2);
        return Buffer.concat(displaySegments(seconds, options).flatMap((segment) => [supHeader, segment]));
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
    // Cropped DVD rip: VOBSUB rectangles at y=180..184 extend past the 320x120 video with unset subtitle tkhd dims.
    run([
        '-copyts',
        '-f',
        'lavfi',
        '-i',
        'color=size=320x120:rate=1:duration=10',
        '-i',
        'dvd.mkv',
        '-map',
        '0:v',
        '-map',
        '1:s',
        '-c:v',
        'libx264',
        '-c:s',
        'copy',
        'dvd-cropped.mp4',
    ]);
    const croppedMp4Path = resolve(root, 'dvd-cropped.mp4');
    const croppedMp4 = await readFile(croppedMp4Path);
    const subtitleTkhd = croppedMp4.indexOf('tkhd', croppedMp4.indexOf('tkhd') + 4);
    const tkhdSize = croppedMp4.readUInt32BE(subtitleTkhd - 4);
    croppedMp4.fill(0, subtitleTkhd - 4 + tkhdSize - 8, subtitleTkhd - 4 + tkhdSize);
    await writeFile(croppedMp4Path, croppedMp4);
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

    const subtitleBlock = (ms, payload, duration = 1000) => {
        const header = Buffer.from([0x81, 0, 0, 0]);
        header.writeInt16BE(ms, 1);
        const block = element('a1', Buffer.concat([header, Buffer.from(payload)]));
        return duration === 0 ? master('a0', block) : master('a0', block, uint('9b', duration));
    };
    const matroskaSubtitles = (codec, blocks) =>
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master('1654ae6b', master('ae', uint('d7', 1), uint('73c5', 1), uint('83', 17), text('86', codec))),
                master('1f43b675', uint('e7', 0), ...blocks)
            ),
        ]);
    const subtitleMedia = (...blocks) => matroskaSubtitles('S_TEXT/UTF8', blocks);
    const pgsBlock = (seconds, options, duration) =>
        subtitleBlock(seconds * 1000, Buffer.concat(displaySegments(seconds, options)), duration);
    const resized = { alpha: 64, screenWidth: 640 };
    await writeFile(
        resolve(root, 'repeated-pgs.mkv'),
        matroskaSubtitles('S_HDMV/PGS', [
            pgsBlock(2, undefined, 0),
            pgsBlock(3),
            pgsBlock(4, { alpha: 64 }),
            pgsBlock(5, resized),
            pgsBlock(7, resized),
            pgsBlock(8, { clear: true }),
            pgsBlock(8, resized),
            pgsBlock(9, resized, 0),
        ])
    );
    const truncatedPgs = subtitleBlock(4000, Buffer.from([pgsPresentationCompositionSegment]));
    const [composition, ...segments] = displaySegments(4);
    composition[10] = 0; // Normal composition references objects and palette from the preceding display.
    const dependentPgs = subtitleBlock(4000, Buffer.concat([composition, segments.at(-1)]));
    await writeFile(
        resolve(root, 'damaged-pgs.mkv'),
        matroskaSubtitles('S_HDMV/PGS', [
            pgsBlock(2, undefined, 0),
            pgsBlock(3, undefined, 0),
            truncatedPgs,
            dependentPgs,
            pgsBlock(5),
        ])
    );
    await writeFile(resolve(root, 'undecodable-pgs.mkv'), matroskaSubtitles('S_HDMV/PGS', [truncatedPgs]));
    await writeFile(
        resolve(root, 'reordered.mkv'),
        subtitleMedia(subtitleBlock(3000, 'Later cue'), subtitleBlock(2000, 'Earlier cue'))
    );
    await writeFile(
        resolve(root, 'dense.mkv'),
        subtitleMedia(...Array.from({ length: 300 }, (_, index) => subtitleBlock(index * 2, `Dense cue ${index}`)))
    );
    await writeFile(
        resolve(root, 'empty-ass-header.mkv'),
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master(
                    '1654ae6b',
                    master('ae', uint('d7', 1), uint('73c5', 1), uint('83', 17), text('86', 'S_TEXT/ASS'))
                ),
                master('1f43b675', uint('e7', 0), subtitleBlock(2000, '0,0,Default,,0,0,0,,Headerless ASS cue'))
            ),
        ])
    );
    await writeFile(
        resolve(root, 'webvtt-nbsp.mkv'),
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master(
                    '1654ae6b',
                    master('ae', uint('d7', 1), uint('73c5', 1), uint('83', 17), text('86', 'D_WEBVTT/SUBTITLES'))
                ),
                master(
                    '1f43b675',
                    uint('e7', 0),
                    subtitleBlock(2000, '\n\nfirst&nbsp;second {music} C:\\path \\h &lt;tag&gt; &amp;')
                )
            ),
        ])
    );
    await writeFile(
        resolve(root, 'raw-text.mkv'),
        Buffer.concat([
            ebml,
            master(
                '18538067',
                master('1549a966', uint('2ad7b1', 1000000)),
                master(
                    '1654ae6b',
                    master('ae', uint('d7', 1), uint('73c5', 1), uint('83', 17), text('86', 'S_TEXT/ASCII'))
                ),
                master('1f43b675', uint('e7', 0), subtitleBlock(2000, '{music} C:\\path\nsecond line'))
            ),
        ])
    );
    await writeFile(
        resolve(root, 'non-utf8.mkv'),
        subtitleMedia(
            master(
                'a0',
                element(
                    'a1',
                    Buffer.concat([Buffer.from([0x81, 0x07, 0xd0, 0]), Buffer.from([0x63, 0x61, 0x66, 0xe9])])
                ),
                uint('9b', 1000)
            ),
            subtitleBlock(4000, 'After Latin-1')
        )
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
