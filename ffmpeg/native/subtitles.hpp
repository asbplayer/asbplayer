#ifndef ASB_SUBTITLES_HPP
#define ASB_SUBTITLES_HPP

#include "bitmap-subtitles.hpp"
#include "diagnostics.hpp"
#include "error.hpp"
#include "host_io.hpp"
#include <algorithm>
#include <climits>
#include <cmath>
#include <cstdio>
#include <map>
#include <memory>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avstring.h>
}

namespace asb::detail {

/** Seekable container input for confirmed extraction. */
struct SubtitleInput {
    InputBuffer buffer;
    AVFormatContext* format = nullptr;
    AVIOContext* io = nullptr;

    explicit SubtitleInput(double size) : buffer{static_cast<int64_t>(size)} {}

    ~SubtitleInput() {
        if (this->format) {
            this->format->pb = nullptr;
            avformat_close_input(&this->format);
        }

        if (this->io) {
            av_freep(&this->io->buffer);
            avio_context_free(&this->io);
        }
    }

    int open() {
        auto* bytes = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (!bytes) return AVERROR(ENOMEM);

        this->io = avio_alloc_context(bytes, io_buffer_bytes, 0, &this->buffer, read_input, nullptr, seek_input);
        if (!this->io) {
            av_free(bytes);
            return AVERROR(ENOMEM);
        }

        this->format = avformat_alloc_context();
        if (!this->format) return AVERROR(ENOMEM);

        this->format->pb = this->io;
        this->format->flags |= AVFMT_FLAG_CUSTOM_IO;
        return avformat_open_input(&this->format, nullptr, nullptr, nullptr);
    }
};

inline bool valid_subtitle_input(double size) {
    return std::isfinite(size) && size > 0 && size <= javascript_max_safe_integer && std::floor(size) == size;
}

inline bool supported_text_codec(AVCodecID id) {
    return id == AV_CODEC_ID_SUBRIP || id == AV_CODEC_ID_TEXT || id == AV_CODEC_ID_ASS ||
           id == AV_CODEC_ID_SSA || id == AV_CODEC_ID_WEBVTT || id == AV_CODEC_ID_MOV_TEXT;
}

inline const char* subtitle_failure(const char* message, int code) {
    fail(message, code);
    return nullptr;
}

/**
 * The text encoder removes styling, but retains drawing payloads and literal \\h.
 * Strip drawing runs before encoding while keeping karaoke syllables and line breaks.
 */
inline std::string normalize_ass_text(const char* ass) {
    constexpr int ass_text_field_index = 8;
    std::string source(ass), output;
    size_t position = 0;

    for (int field = 0; field < ass_text_field_index; ++field) {
        auto comma = source.find(',', position);
        if (comma == std::string::npos) return source;
        position = comma + 1;
    }

    output = source.substr(0, position);
    bool drawing = false;

    while (position < source.size()) {
        if (source.compare(position, 2, "{\\") == 0) {
            const auto end = source.find('}', position + 2);
            if (end != std::string::npos) {
                const auto block = source.substr(position, end - position + 1);
                size_t tag = 1;
                while (tag < block.size() - 1) {
                    if (block[tag] != '\\') {
                        ++tag;
                        continue;
                    }
                    const size_t next = block.find_first_of("\\}", tag + 1);
                    const size_t tag_end = next == std::string::npos ? block.size() - 1 : next;
                    if (tag + 1 < tag_end && block[tag + 1] == 'r') {
                        drawing = false;
                    } else if (tag + 1 < tag_end && block[tag + 1] == 'p') {
                        size_t value = tag + 2;
                        while (value < tag_end && block[value] == ' ') ++value;
                        if (value == tag_end) {
                            drawing = false;
                        } else if (block[value] >= '0' && block[value] <= '9') {
                            bool nonzero = false;
                            while (value < tag_end && block[value] >= '0' && block[value] <= '9') {
                                if (block[value] != '0') nonzero = true;
                                ++value;
                            }
                            while (value < tag_end && block[value] == ' ') ++value;
                            if (value == tag_end) drawing = nonzero;
                        }
                    }
                    tag = tag_end;
                }

                output += block;
                position = end + 1;
                continue;
            }
        }

        if (!drawing) {
            if (source.compare(position, 2, "\\h") == 0) {
                output += ' ';
                position += 2;
                continue;
            }

            output += source[position];
        }

        ++position;
    }

    return output;
}

/** WebVTT decodes &nbsp; as ASS \\h (escaping literal \\ with U+2060); expand \\h back to a space. */
inline std::string normalize_webvtt_text(const char* ass) {
    constexpr int ass_text_field_index = 8;
    std::string source(ass);
    size_t position = 0;

    for (int field = 0; field < ass_text_field_index; ++field) {
        auto comma = source.find(',', position);
        if (comma == std::string::npos) return source;
        position = comma + 1;
    }

    std::string output = source.substr(0, position);
    while (position < source.size()) {
        if (source.compare(position, 2, "\\h") == 0) {
            output += ' ';
            position += 2;
            continue;
        }
        output += source[position++];
    }
    return output;
}

/** Escape literal backslashes outside ASS override blocks before htmlsubtitles.c so \\n/\\N stay literal. */
inline std::string escape_subrip_backslashes(std::string_view input) {
    std::string output;
    output.reserve(input.size() + 8);
    size_t position = 0;
    while (position < input.size()) {
        if (input.compare(position, 2, "{\\") == 0) {
            const size_t end = input.find('}', position + 2);
            if (end != std::string_view::npos) {
                output.append(input.substr(position, end - position + 1));
                position = end + 1;
                continue;
            }
        }
        if (input[position] == '\\') {
            output += '\\';
            if (input.compare(position + 1, 3, "\xe2\x81\xa0") != 0) output += "\xe2\x81\xa0";
            ++position;
            continue;
        }
        output += input[position++];
    }
    return output;
}

/** Undo ASS escapes (\\{{} and \\<U+2060>) emitted by FFmpeg's WebVTT/text decoders and our SubRip pre-escape. */
inline std::string unescape_ass_text(std::string_view input, bool unescape_braces) {
    std::string output;
    output.reserve(input.size());
    size_t position = 0;
    while (position < input.size()) {
        if (unescape_braces && input.compare(position, 4, "\\{{}") == 0) {
            output += '{';
            position += 4;
            continue;
        }
        if (input.compare(position, 4, "\\\xe2\x81\xa0") == 0) {
            output += '\\';
            position += 4;
            continue;
        }
        output += input[position++];
    }
    return output;
}

/** Convert BOM-marked UTF-16BE/UTF-16LE bytes (3GPP TS 26.245 Timed Text) to UTF-8, stopping at U+0000. */
inline std::string decode_utf16_to_utf8(const uint8_t* bytes, size_t length, bool big_endian) {
    auto append_utf8 = [](std::string& out, uint32_t cp) {
        if (cp <= 0x7F) {
            out += static_cast<char>(cp);
        } else if (cp <= 0x7FF) {
            out += static_cast<char>(0xC0 | (cp >> 6));
            out += static_cast<char>(0x80 | (cp & 0x3F));
        } else if (cp <= 0xFFFF) {
            out += static_cast<char>(0xE0 | (cp >> 12));
            out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
            out += static_cast<char>(0x80 | (cp & 0x3F));
        } else {
            out += static_cast<char>(0xF0 | (cp >> 18));
            out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
            out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
            out += static_cast<char>(0x80 | (cp & 0x3F));
        }
    };
    auto read_unit = [bytes, big_endian](size_t offset) -> uint16_t {
        return big_endian ? static_cast<uint16_t>((static_cast<uint16_t>(bytes[offset]) << 8) | bytes[offset + 1])
                          : static_cast<uint16_t>((static_cast<uint16_t>(bytes[offset + 1]) << 8) | bytes[offset]);
    };

    std::string output;
    output.reserve(length);
    for (size_t offset = 2; offset + 1 < length; offset += 2) {
        const uint16_t unit = read_unit(offset);
        if (unit == 0) break;
        if (unit >= 0xD800 && unit <= 0xDBFF) {
            if (offset + 3 < length) {
                const uint16_t low = read_unit(offset + 2);
                if (low >= 0xDC00 && low <= 0xDFFF) {
                    const uint32_t cp =
                        0x10000 + ((static_cast<uint32_t>(unit) - 0xD800) << 10) + (static_cast<uint32_t>(low) - 0xDC00);
                    append_utf8(output, cp);
                    offset += 2;
                    continue;
                }
            }
            append_utf8(output, 0xFFFD);
        } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
            append_utf8(output, 0xFFFD);
        } else {
            append_utf8(output, unit);
        }
    }
    return output;
}

struct SubtitleOutput {
    // The window is in cue timestamps. A later timestamp or EOF releases pending
    // cues. A cue before the published prefix fails extraction to preserve ordering.
    static constexpr int64_t reorder_window_ms = 2000;
    static constexpr int64_t max_srt_timestamp_ms = int64_t{INT32_MAX} * 1000;
    static constexpr size_t max_pending_bytes = 8 * 1024 * 1024;
    static constexpr size_t encode_buffer_bytes = 1024 * 1024;
    static constexpr size_t pending_cue_overhead_bytes = 128; // Map node and allocator overhead beyond stored text.

    struct Cue {
        int64_t end;
        std::string text;
        size_t bytes;

        Cue(int64_t end, std::string text)
            : end(end), text(std::move(text)), bytes(pending_cue_overhead_bytes + this->text.capacity()) {}
    };

    uint32_t track_key;
    AVCodecContext* decoder = nullptr;
    AVCodecContext* encoder = nullptr;
    AVFormatContext* format = nullptr;
    AVStream* source;
    AVPacket* encoded = nullptr;
    std::unique_ptr<BitmapSubtitleOutput> bitmap;
    std::vector<uint8_t> bytes;

    std::multimap<int64_t, Cue> pending;
    size_t pending_bytes = 0;
    int64_t latest_start = 0;
    int64_t last_written_start = -1;
    size_t decoded_cues = 0;
    size_t decode_errors = 0;

    SubtitleOutput(uint32_t track_key, AVStream* stream) : track_key(track_key), source(stream) {}

    ~SubtitleOutput() {
        if (this->decode_errors > 0) {
            char message[96] = {};
            std::snprintf(message, sizeof(message), "Tolerated %zu subtitle decoder error(s)", this->decode_errors);
            runtime_diagnostic(DiagnosticLevel::warning, message);
        }
        av_packet_free(&this->encoded);
        avcodec_free_context(&this->decoder);
        avcodec_free_context(&this->encoder);

        if (this->format && this->format->pb) {
            av_freep(&this->format->pb->buffer);
            avio_context_free(&this->format->pb);
        }

        avformat_free_context(this->format);
    }

    int open_decoder() {
        const auto* codec = avcodec_find_decoder(this->source->codecpar->codec_id);
        this->decoder = avcodec_alloc_context3(codec);
        if (!codec || !this->decoder) return AVERROR(ENOMEM);

        int error = avcodec_parameters_to_context(this->decoder, this->source->codecpar);
        if (error < 0) return error;

        this->decoder->pkt_timebase = this->source->time_base;
        this->decoder->sub_charenc_mode = FF_SUB_CHARENC_MODE_IGNORE;
        return avcodec_open2(this->decoder, codec, nullptr);
    }

    int open(int video_width, int video_height) {
        int error = this->open_decoder();
        if (error < 0) return error;

        if (supported_bitmap_codec(this->source->codecpar->codec_id)) {
            this->bitmap = std::make_unique<BitmapSubtitleOutput>(this->track_key, video_width, video_height);
            return 0;
        }

        const auto* text = avcodec_find_encoder(AV_CODEC_ID_TEXT);
        this->encoder = avcodec_alloc_context3(text);
        this->encoded = av_packet_alloc();
        if (!text || !this->encoder || !this->encoded) return AVERROR(ENOMEM);

        this->bytes.resize(encode_buffer_bytes);
        this->encoder->time_base = milliseconds;
        if (this->decoder->subtitle_header && this->decoder->subtitle_header_size >= 0) {
            const size_t header_size = static_cast<size_t>(this->decoder->subtitle_header_size);
            this->encoder->subtitle_header = static_cast<uint8_t*>(av_mallocz(header_size + 1));
            if (!this->encoder->subtitle_header) return AVERROR(ENOMEM);

            std::copy_n(this->decoder->subtitle_header, header_size, this->encoder->subtitle_header);
            this->encoder->subtitle_header_size = this->decoder->subtitle_header_size;
        }
        if ((error = avcodec_open2(this->encoder, text, nullptr)) < 0) return error;
        if ((error = avformat_alloc_output_context2(&this->format, nullptr, "srt", nullptr)) < 0) return error;

        auto* stream = avformat_new_stream(this->format, nullptr);
        if (!stream) return AVERROR(ENOMEM);
        if ((error = avcodec_parameters_from_context(stream->codecpar, this->encoder)) < 0) return error;

        auto* buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (!buffer) return AVERROR(ENOMEM);

        this->format->pb = avio_alloc_context(buffer, io_buffer_bytes, 1, &this->track_key, nullptr, write_output, nullptr);
        if (!this->format->pb) {
            av_free(buffer);
            return AVERROR(ENOMEM);
        }

        this->format->flags |= AVFMT_FLAG_CUSTOM_IO | AVFMT_FLAG_FLUSH_PACKETS;
        return avformat_write_header(this->format, nullptr);
    }

    int emit_payload(int64_t clamped_start, int64_t end, std::string_view payload, bool escape_ampersand) {
        // SRT uses blank lines to delimit cues. Drop whitespace-only lines from
        // the payload so a chunk split there cannot truncate a cue.
        std::string escaped;
        escaped.reserve(payload.size());
        size_t position = 0;
        while (position < payload.size()) {
            const size_t line_end = payload.find_first_of("\r\n", position);
            auto line = payload.substr(
                position, line_end == std::string_view::npos ? std::string_view::npos : line_end - position);
            if (line_end == std::string_view::npos) {
                position = payload.size();
            } else {
                const bool crlf =
                    payload[line_end] == '\r' && line_end + 1 < payload.size() && payload[line_end + 1] == '\n';
                position = line_end + (crlf ? 2 : 1);
            }
            if (line.find_first_not_of(" \t") == std::string_view::npos) continue;
            if (!escaped.empty()) escaped += '\n';

            // The text encoder strips styling, leaving literal markup to escape.
            for (const char c : line) {
                switch (c) {
                    case '&':
                        escaped += escape_ampersand ? "&amp;" : "&";
                        break;
                    case '<':
                        escaped += "&lt;";
                        break;
                    case '>':
                        escaped += "&gt;";
                        break;
                    default:
                        escaped += c;
                        break;
                }
            }
        }

        if (escaped.empty()) return 0;
        return queue_cue(clamped_start, end, std::move(escaped));
    }

    /** Decode 3GPP Timed Text (tx3g/mov_text) directly to avoid movtextdec's unescaped ASS roundtrip. */
    int decode_mov_text(const AVPacket* packet, bool* produced) {
        if (produced) *produced = false;
        if (packet->size == 0) return 0; // Flush packet.
        if (!packet->data || packet->size < 2) {
            ++this->decode_errors;
            return 0;
        }
        const size_t text_length =
            (static_cast<size_t>(packet->data[0]) << 8) | static_cast<size_t>(packet->data[1]);
        const size_t packet_size = static_cast<size_t>(packet->size);
        if (text_length > packet_size - 2) {
            ++this->decode_errors;
            return 0;
        }
        if (packet_size == 2) return 0; // 0x0000 marks the end of the previous non-empty cue.
        if (text_length + 2 < packet_size) {
            size_t offset = text_length + 2;
            while (packet_size - offset >= 8) {
                uint64_t box_size = (static_cast<uint64_t>(packet->data[offset]) << 24) |
                                    (static_cast<uint64_t>(packet->data[offset + 1]) << 16) |
                                    (static_cast<uint64_t>(packet->data[offset + 2]) << 8) |
                                    static_cast<uint64_t>(packet->data[offset + 3]);
                offset += 8;
                uint64_t header_size = 8;
                if (box_size == 1) {
                    if (packet_size - offset < 8) break;
                    box_size = 0;
                    for (int byte = 0; byte < 8; ++byte) box_size = (box_size << 8) | packet->data[offset + byte];
                    offset += 8;
                    header_size = 16;
                }
                if (box_size < header_size) {
                    ++this->decode_errors;
                    return 0;
                }
                const uint64_t body_size = box_size - header_size;
                if (packet_size - offset < body_size) break;
                offset += static_cast<size_t>(body_size);
            }
        }
        if (packet->pts == AV_NOPTS_VALUE) return AVERROR_INVALIDDATA;
        const int64_t start = av_rescale_q(packet->pts, this->source->time_base, milliseconds);
        if (start == AV_NOPTS_VALUE) return AVERROR_INVALIDDATA;
        if (packet->duration <= 0) return 0;
        const int64_t duration_ms = av_rescale_q(packet->duration, this->source->time_base, milliseconds);
        int64_t end = start;
        if (duration_ms == AV_NOPTS_VALUE || __builtin_add_overflow(start, duration_ms, &end)) {
            return AVERROR_INVALIDDATA;
        }
        if (end <= start) return 0;
        const int64_t clamped_start = std::max<int64_t>(0, start);
        if (clamped_start > max_srt_timestamp_ms || end > max_srt_timestamp_ms) return AVERROR_INVALIDDATA;

        if (text_length == 0 || end <= 0) return 0;
        const uint8_t* text_bytes = packet->data + 2;
        std::string converted;
        std::string_view payload;
        if (text_length >= 2 && ((text_bytes[0] == 0xFE && text_bytes[1] == 0xFF) ||
                                 (text_bytes[0] == 0xFF && text_bytes[1] == 0xFE))) {
            converted = decode_utf16_to_utf8(text_bytes, text_length, text_bytes[0] == 0xFE);
            payload = converted;
        } else {
            payload = std::string_view(reinterpret_cast<const char*>(text_bytes), text_length);
            if (const size_t nul = payload.find('\0'); nul != std::string_view::npos) payload = payload.substr(0, nul);
        }
        if (payload.find_first_not_of(" \t\r\n") == std::string_view::npos) return 0;
        ++this->decoded_cues;
        return emit_payload(clamped_start, end, payload, true);
    }

    int decode(AVPacket* packet, bool* produced = nullptr) {
        const auto codec_id = this->source->codecpar->codec_id;
        if (codec_id == AV_CODEC_ID_MOV_TEXT) return decode_mov_text(packet, produced);

        std::string escaped_subrip;
        AVPacket adjusted_packet{};
        AVPacket* decode_packet = packet;
        if (codec_id == AV_CODEC_ID_SUBRIP && packet->data && packet->size > 0) {
            const std::string_view raw(reinterpret_cast<const char*>(packet->data), static_cast<size_t>(packet->size));
            if (raw.find('\\') != std::string_view::npos) {
                escaped_subrip = escape_subrip_backslashes(raw);
                if (escaped_subrip.size() > static_cast<size_t>(INT_MAX)) return AVERROR(ENOMEM);
                adjusted_packet = *packet;
                adjusted_packet.data = reinterpret_cast<uint8_t*>(escaped_subrip.data());
                adjusted_packet.size = static_cast<int>(escaped_subrip.size());
                decode_packet = &adjusted_packet;
            }
        }

        AVSubtitle subtitle{};
        int got_subtitle = 0;
        int error = avcodec_decode_subtitle2(this->decoder, &subtitle, &got_subtitle, decode_packet);
        if (produced) *produced = got_subtitle != 0;
        if (error < 0) {
            if (this->bitmap) {
                // The PGS and DVB decoders also return -1 for truncated packets.
                if (packet->size == 0 || (error != AVERROR_INVALIDDATA && error != -1)) return error;

                const int64_t boundary = packet->pts == AV_NOPTS_VALUE
                    ? AV_NOPTS_VALUE
                    : av_rescale_q(packet->pts, this->source->time_base, milliseconds);
                if ((error = this->bitmap->interrupt(boundary)) < 0) return error;
                ++this->decode_errors;
                // PGS and DVB can leave partially updated state and have no decoder flush callback.
                avcodec_free_context(&this->decoder);
                return this->open_decoder();
            }
            if (error == AVERROR(ENOMEM)) return error;
            ++this->decode_errors;
            return 0;
        }
        if (!got_subtitle) return 0;

        if (!this->bitmap && subtitle.num_rects == 0) {
            avsubtitle_free(&subtitle);
            return 0;
        }
        if (subtitle.num_rects > 0) ++this->decoded_cues;

        // Decoder subtitle PTS is in AV_TIME_BASE units, display intervals in milliseconds.
        int64_t pts = subtitle.pts;
        if (pts == AV_NOPTS_VALUE && packet->pts != AV_NOPTS_VALUE) {
            pts = av_rescale_q(packet->pts, this->source->time_base, AV_TIME_BASE_Q);
        }

        if (pts == AV_NOPTS_VALUE) {
            avsubtitle_free(&subtitle);
            return AVERROR_INVALIDDATA;
        }

        const int64_t base_ms = av_rescale_q(pts, AV_TIME_BASE_Q, milliseconds);
        int64_t start = 0;
        if (base_ms == AV_NOPTS_VALUE ||
            __builtin_add_overflow(base_ms, static_cast<int64_t>(subtitle.start_display_time), &start)) {
            avsubtitle_free(&subtitle);
            return AVERROR_INVALIDDATA;
        }

        if (this->bitmap) {
            int64_t end = AV_NOPTS_VALUE;
            bool invalid_end = subtitle.end_display_time != UINT32_MAX &&
                __builtin_add_overflow(base_ms, static_cast<int64_t>(subtitle.end_display_time), &end);
            if (!invalid_end && end <= start && packet->duration > 0) {
                const int64_t duration_ms = av_rescale_q(packet->duration, this->source->time_base, milliseconds);
                invalid_end = duration_ms == AV_NOPTS_VALUE || __builtin_add_overflow(start, duration_ms, &end);
            }
            error = invalid_end ? AVERROR_INVALIDDATA
                : this->bitmap->display(subtitle, start, end > start ? end : AV_NOPTS_VALUE, this->decoder);
            avsubtitle_free(&subtitle);
            return error;
        }

        subtitle.start_display_time = 0;

        // Avoid FFmpeg's uint32_t end_display_time narrowing of negative or >= 2^32 ms packet durations.
        if (packet->duration < 0) {
            avsubtitle_free(&subtitle);
            return 0;
        }
        int64_t end = start;
        if (packet->duration > 0) {
            const int64_t duration_ms = av_rescale_q(packet->duration, this->source->time_base, milliseconds);
            if (duration_ms == AV_NOPTS_VALUE || __builtin_add_overflow(start, duration_ms, &end)) {
                avsubtitle_free(&subtitle);
                return AVERROR_INVALIDDATA;
            }
        } else if (subtitle.end_display_time != UINT32_MAX) {
            if (__builtin_add_overflow(base_ms, static_cast<int64_t>(subtitle.end_display_time), &end)) {
                avsubtitle_free(&subtitle);
                return AVERROR_INVALIDDATA;
            }
        }
        if (end <= start) {
            avsubtitle_free(&subtitle);
            return 0;
        }
        const int64_t clamped_start = std::max<int64_t>(0, start);
        if (clamped_start > max_srt_timestamp_ms || end > max_srt_timestamp_ms) {
            avsubtitle_free(&subtitle);
            return AVERROR_INVALIDDATA;
        }

        const bool is_ass = codec_id == AV_CODEC_ID_ASS || codec_id == AV_CODEC_ID_SSA;
        const bool is_webvtt = codec_id == AV_CODEC_ID_WEBVTT;
        if (is_ass || is_webvtt) {
            for (unsigned i = 0; i < subtitle.num_rects; ++i) {
                auto* rect = subtitle.rects[i];
                if (rect->ass) {
                    auto normalized = is_ass ? normalize_ass_text(rect->ass) : normalize_webvtt_text(rect->ass);
                    av_freep(&rect->ass);
                    rect->ass = av_strdup(normalized.c_str());
                    if (!rect->ass) {
                        avsubtitle_free(&subtitle);
                        return AVERROR(ENOMEM);
                    }
                }
            }
        }

        const int length = avcodec_encode_subtitle(this->encoder, this->bytes.data(), this->bytes.size(), &subtitle);
        avsubtitle_free(&subtitle);
        if (length < 0) return length;
        if (length == 0 || end <= 0) return 0;

        std::string_view payload(reinterpret_cast<const char*>(this->bytes.data()), length);
        std::string unescaped_payload;
        if (codec_id == AV_CODEC_ID_WEBVTT || codec_id == AV_CODEC_ID_TEXT || codec_id == AV_CODEC_ID_SUBRIP) {
            unescaped_payload = unescape_ass_text(payload, codec_id != AV_CODEC_ID_SUBRIP);
            payload = unescaped_payload;
        }
        const bool escape_ampersand = codec_id != AV_CODEC_ID_SUBRIP; // SubRip preserves SRT HTML entities verbatim.
        return emit_payload(clamped_start, end, payload, escape_ampersand);
    }

    int queue_cue(int64_t start, int64_t end, std::string text) {
        if (start < this->last_written_start) {
            runtime_diagnostic(DiagnosticLevel::warning, "Subtitle cue exceeds the reorder window");
            return AVERROR_INVALIDDATA;
        }

        this->latest_start = std::max(this->latest_start, start);
        const int64_t cutoff = this->latest_start - reorder_window_ms;
        const int error = flush_cues(cutoff);
        if (error < 0) return error;
        Cue cue{end, std::move(text)};
        if (start <= cutoff) return write_cue(start, cue);

        if (cue.bytes > max_pending_bytes - this->pending_bytes) return AVERROR(ENOMEM);
        this->pending_bytes += cue.bytes;
        this->pending.emplace(start, std::move(cue));
        return 0;
    }

    int flush_cues(int64_t cutoff) {
        while (!this->pending.empty() && this->pending.begin()->first <= cutoff) {
            const auto& [start, cue] = *this->pending.begin();
            const int error = write_cue(start, cue);
            if (error < 0) return error;
            this->pending_bytes -= cue.bytes;
            this->pending.erase(this->pending.begin());
        }
        return 0;
    }

    int finish(int64_t duration) {
        if (this->decode_errors > 0 && this->decoded_cues == 0) return AVERROR_INVALIDDATA;
        if (this->bitmap) return this->bitmap->finish(duration);
        const int error = flush_cues(INT64_MAX);
        return error < 0 ? error : av_write_trailer(this->format);
    }

    int write_cue(int64_t start, const Cue& cue) {
        int error = av_new_packet(this->encoded, static_cast<int>(cue.text.size()));
        if (error < 0) return error;

        std::copy(cue.text.begin(), cue.text.end(), this->encoded->data);
        const AVRational time_base = this->format->streams[0]->time_base;
        this->encoded->pts = av_rescale_q(start, milliseconds, time_base);
        this->encoded->dts = this->encoded->pts;
        this->encoded->duration = av_rescale_q(cue.end - start, milliseconds, time_base);
        this->encoded->stream_index = 0;
        error = av_write_frame(this->format, this->encoded);
        av_packet_unref(this->encoded);
        if (error >= 0) this->last_written_start = start;
        return error;
    }
};

inline const char* extract_subtitles(double size, const uint32_t* track_keys, size_t count) {
    static std::string result;
    last_error.clear();
    if (!valid_subtitle_input(size) || !track_keys) {
        return subtitle_failure("Invalid subtitle extraction", AVERROR(EINVAL));
    }

    if (count == 0) return subtitle_failure("No subtitle tracks selected", AVERROR(EINVAL));

    SubtitleInput input(size);
    int error = input.open();
    if (error < 0) return subtitle_failure("Could not open subtitle input", error);

    // The MP4 probe uses file track IDs because FFmpeg may classify some entries as data.
    // Matroska uses the ordinal among FFmpeg subtitle streams, including unsupported codecs.
    const bool mp4 = av_match_name("mov", input.format->iformat->name) != 0;
    std::map<uint32_t, AVStream*> subtitle_streams_by_key;
    uint32_t subtitle_index = 0;
    int video_width = 0, video_height = 0;

    for (unsigned i = 0; i < input.format->nb_streams; ++i) {
        auto* stream = input.format->streams[i];
        const auto type = stream->codecpar->codec_type;
        if (type == AVMEDIA_TYPE_ATTACHMENT) {
            av_freep(&stream->codecpar->extradata);
            stream->codecpar->extradata_size = 0;
        } else if (type == AVMEDIA_TYPE_SUBTITLE) {
            const uint32_t key = mp4 ? static_cast<uint32_t>(stream->id) : subtitle_index++;
            subtitle_streams_by_key.emplace(key, stream);
        } else if (type == AVMEDIA_TYPE_VIDEO && !(stream->disposition & AV_DISPOSITION_ATTACHED_PIC) &&
                   video_width <= 0 && video_height <= 0) {
            video_width = stream->codecpar->width;
            video_height = stream->codecpar->height;
        }
    }

    std::vector<std::unique_ptr<SubtitleOutput>> outputs;
    for (size_t position = 0; position < count; ++position) {
        const auto track_key = track_keys[position];
        const auto selected = subtitle_streams_by_key.find(track_key);
        if (selected == subtitle_streams_by_key.end()) {
            return subtitle_failure("Invalid subtitle track key", AVERROR(EINVAL));
        }

        auto* stream = selected->second;
        const bool bitmap = supported_bitmap_codec(stream->codecpar->codec_id);
        if (!supported_text_codec(stream->codecpar->codec_id) && !bitmap) {
            return subtitle_failure("Unsupported subtitle track", AVERROR(EINVAL));
        }

        if (std::any_of(outputs.begin(), outputs.end(), [track_key](const auto& out) {
                return out->track_key == track_key;
            })) {
            return subtitle_failure("Duplicate subtitle track", AVERROR(EINVAL));
        }

        char message[384] = {};
        std::snprintf(message, sizeof(message),
                      "Selected subtitle track: track_key=%u, stream_index=%d, codec=%s, input_time_base=%d/%d, output_format=%s",
                      track_key, stream->index, avcodec_get_name(stream->codecpar->codec_id),
                      stream->time_base.num, stream->time_base.den, bitmap ? "asbimg" : "srt");
        runtime_diagnostic(DiagnosticLevel::trace, message);
        auto output = std::make_unique<SubtitleOutput>(track_key, stream);
        if ((error = output->open(video_width, video_height)) < 0) {
            return subtitle_failure("Could not open subtitle output", error);
        }
        outputs.push_back(std::move(output));
    }

    auto release_packet = [](AVPacket* packet) { av_packet_free(&packet); };
    std::unique_ptr<AVPacket, decltype(release_packet)> owned_packet(av_packet_alloc(), release_packet);
    auto* packet = owned_packet.get();
    if (!packet) return subtitle_failure("Could not allocate subtitle packet", AVERROR(ENOMEM));

    for (unsigned i = 0; i < input.format->nb_streams; ++i) {
        auto* stream = input.format->streams[i];
        if (std::none_of(outputs.begin(), outputs.end(), [stream](const auto& out) {
                return out->source == stream;
            })) {
            stream->discard = AVDISCARD_ALL;
        }
    }

    while ((error = av_read_frame(input.format, packet)) >= 0) {
        for (auto& output : outputs) {
            if (output->source->index == packet->stream_index) {
                error = output->decode(packet);
                break;
            }
        }

        av_packet_unref(packet);
        if (error < 0) break;
    }

    if (error != AVERROR_EOF) return subtitle_failure("Could not extract subtitle packets", error);

    // A container duration can bound the final bitmap display when there is no clear.
    const int64_t duration = input.format->duration == AV_NOPTS_VALUE
        ? AV_NOPTS_VALUE
        : av_rescale_q(input.format->duration, AV_TIME_BASE_Q, milliseconds);
    result = "[";
    for (auto& output : outputs) {
        av_packet_unref(packet);
        bool produced = false;
        do {
            error = output->decode(packet, &produced);
        } while (error >= 0 && produced);

        if (error < 0 || (error = output->finish(duration)) < 0) {
            return subtitle_failure("Could not finish subtitle output", error);
        }

        if (output->format) {
            avio_flush(output->format->pb);
            if (output->format->pb->error < 0) {
                return subtitle_failure("Could not deliver subtitle output", output->format->pb->error);
            }
        }

        if (result.size() > 1) result += ',';

        result += "{\"trackKey\":" + std::to_string(output->track_key);
        result += output->bitmap
            ? ",\"extension\":\"asbimg\",\"mimeType\":\"application/x-asbimg\""
            : ",\"extension\":\"srt\",\"mimeType\":\"application/x-subrip\"";
        result += '}';
    }

    result += ']';
    return result.c_str();
}

} // namespace asb::detail

#endif
