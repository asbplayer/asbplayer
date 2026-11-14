// Requires a system ffmpeg. Generated media contains only authored text and a solid-color video.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
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
            'Dialogue: 0,0:00:02.00,0:00:04.00,Default,,0,0,0,,{\\k20}日本語\\htext\\Nline two{\\p1}m 0 0 l 10 10{\\p0} end <b>literal</b> &amp;\n'
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
    // Minimal Matroska elements exercise compressed subtitle packets.
    const vint = (value) => {
        for (let length = 1; length <= 8; length++) {
            if (value < 2 ** (7 * length) - 1) {
                let bits = BigInt(value) | (1n << BigInt(7 * length));
                const bytes = Buffer.alloc(length);
                for (let i = length - 1; i >= 0; i--) {
                    bytes[i] = Number(bits & 255n);
                    bits >>= 8n;
                }
                return bytes;
            }
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
};
