#ifndef ASB_SUBTITLES_HPP
#define ASB_SUBTITLES_HPP

#include "diagnostics.hpp"
#include "error.hpp"
#include "host_io.hpp"
#include "json.hpp"
#include <cmath>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avstring.h>
}

namespace asb::detail {

// Seekable container input for confirmed extraction.
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
        if (!bytes) {
            return AVERROR(ENOMEM);
        }

        this->io = avio_alloc_context(bytes, io_buffer_bytes, 0, &this->buffer, read_input, nullptr, seek_input);
        if (!this->io) {
            av_free(bytes);
            return AVERROR(ENOMEM);
        }

        this->format = avformat_alloc_context();
        if (!this->format) {
            return AVERROR(ENOMEM);
        }

        this->format->pb = this->io;
        this->format->flags |= AVFMT_FLAG_CUSTOM_IO;
        return avformat_open_input(&this->format, nullptr, nullptr, nullptr);
    }
};

inline bool valid_subtitle_input(double size) {
    return std::isfinite(size) && size > 0 && size <= 9007199254740991.0 && std::floor(size) == size;
}

inline bool supported_text_codec(AVCodecID id) {
    return id == AV_CODEC_ID_SUBRIP || id == AV_CODEC_ID_TEXT || id == AV_CODEC_ID_ASS ||
           id == AV_CODEC_ID_SSA || id == AV_CODEC_ID_WEBVTT || id == AV_CODEC_ID_MOV_TEXT;
}

inline const char* subtitle_failure(const char* message, int code) {
    fail(message, code);
    return nullptr;
}

// The text encoder removes styling, but retains drawing payloads and literal \\h.
// Strip drawing runs before encoding while keeping karaoke syllables and line breaks.
inline std::string normalize_ass_text(const char* ass) {
    std::string source(ass), output;
    size_t position = 0;

    for (int field = 0; field < 8; ++field) {
        auto comma = source.find(',', position);
        if (comma == std::string::npos) {
            return source;
        }

        position = comma + 1;
    }

    output = source.substr(0, position);
    bool drawing = false;

    while (position < source.size()) {
        if (source[position] == '{') {
            const auto end = source.find('}', position);
            if (end != std::string::npos) {
                const auto block = source.substr(position, end - position + 1);
                for (size_t p = 0; (p = block.find("\\p", p)) != std::string::npos; p += 2) {
                    size_t number = p + 2;
                    while (number < block.size() && block[number] == ' ') {
                        ++number;
                    }

                    if (number < block.size() && block[number] >= '0' && block[number] <= '9') {
                        drawing = block[number] != '0';
                    }
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

struct SubtitleOutput {
    uint32_t track_index;
    AVCodecContext* decoder = nullptr;
    AVCodecContext* encoder = nullptr;
    AVFormatContext* format = nullptr;
    AVStream* source;
    AVPacket* encoded = nullptr;
    std::vector<uint8_t> bytes = std::vector<uint8_t>(1024 * 1024);

    SubtitleOutput(uint32_t track_index, AVStream* stream) : track_index(track_index), source(stream) {}

    ~SubtitleOutput() {
        av_packet_free(&this->encoded);
        avcodec_free_context(&this->decoder);
        avcodec_free_context(&this->encoder);

        if (this->format && this->format->pb) {
            av_freep(&this->format->pb->buffer);
            avio_context_free(&this->format->pb);
        }

        avformat_free_context(this->format);
    }

    static int write(void* opaque, const uint8_t* data, int size) {
        const auto track_index = static_cast<SubtitleOutput*>(opaque)->track_index;
        return asb_write_subtitle_output(track_index, data, size) == size ? size : AVERROR(EIO);
    }

    int open() {
        const auto* codec = avcodec_find_decoder(this->source->codecpar->codec_id);
        this->decoder = avcodec_alloc_context3(codec);
        const auto* text = avcodec_find_encoder(AV_CODEC_ID_TEXT);
        this->encoder = avcodec_alloc_context3(text);
        this->encoded = av_packet_alloc();
        if (!codec || !text || !this->decoder || !this->encoder || !this->encoded) {
            return AVERROR(ENOMEM);
        }

        int error = avcodec_parameters_to_context(this->decoder, this->source->codecpar);
        if (error < 0) {
            return error;
        }

        this->decoder->pkt_timebase = this->source->time_base;
        if ((error = avcodec_open2(this->decoder, codec, nullptr)) < 0) {
            return error;
        }

        this->encoder->time_base = AVRational{1, 1000};
        if (this->decoder->subtitle_header_size > 0) {
            this->encoder->subtitle_header = static_cast<uint8_t*>(av_mallocz(this->decoder->subtitle_header_size + 1));
            if (!this->encoder->subtitle_header) {
                return AVERROR(ENOMEM);
            }

            std::copy_n(this->decoder->subtitle_header, this->decoder->subtitle_header_size,
                        this->encoder->subtitle_header);
            this->encoder->subtitle_header_size = this->decoder->subtitle_header_size;
        }
        if ((error = avcodec_open2(this->encoder, text, nullptr)) < 0) {
            return error;
        }

        if ((error = avformat_alloc_output_context2(&this->format, nullptr, "srt", nullptr)) < 0) {
            return error;
        }

        auto* stream = avformat_new_stream(this->format, nullptr);
        if (!stream) {
            return AVERROR(ENOMEM);
        }

        if ((error = avcodec_parameters_from_context(stream->codecpar, this->encoder)) < 0) {
            return error;
        }

        auto* buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (!buffer) {
            return AVERROR(ENOMEM);
        }

        this->format->pb = avio_alloc_context(buffer, io_buffer_bytes, 1, this, nullptr, write, nullptr);
        if (!this->format->pb) {
            av_free(buffer);
            return AVERROR(ENOMEM);
        }

        this->format->flags |= AVFMT_FLAG_CUSTOM_IO | AVFMT_FLAG_FLUSH_PACKETS;
        return avformat_write_header(this->format, nullptr);
    }

    int decode(AVPacket* packet, int64_t origin, bool* got) {
        AVSubtitle subtitle{};
        int produced = 0;
        int error = avcodec_decode_subtitle2(this->decoder, &subtitle, &produced, packet);
        *got = produced != 0;
        if (error < 0 || !produced) {
            return error < 0 ? error : 0;
        }

        if (subtitle.num_rects == 0) {
            avsubtitle_free(&subtitle);
            return 0;
        }

        // Decoder subtitle PTS is in AV_TIME_BASE units, display intervals in milliseconds.
        int64_t pts = subtitle.pts;
        if (pts == AV_NOPTS_VALUE && packet->pts != AV_NOPTS_VALUE) {
            pts = av_rescale_q(packet->pts, this->source->time_base, AV_TIME_BASE_Q);
        }

        if (pts == AV_NOPTS_VALUE) {
            avsubtitle_free(&subtitle);
            return AVERROR_INVALIDDATA;
        }

        int64_t start = av_rescale_q(pts - origin, AV_TIME_BASE_Q, AVRational{1, 1000}) + subtitle.start_display_time;
        int64_t end = av_rescale_q(pts - origin, AV_TIME_BASE_Q, AVRational{1, 1000}) + subtitle.end_display_time;
        if (subtitle.end_display_time == UINT32_MAX || end <= start) {
            if (packet->duration > 0) {
                end = start + av_rescale_q(packet->duration, this->source->time_base, AVRational{1, 1000});
            } else if (subtitle.num_rects > 0) {
                avsubtitle_free(&subtitle);
                return AVERROR_INVALIDDATA;
            }
        }

        for (unsigned i = 0; i < subtitle.num_rects; ++i) {
            auto* rect = subtitle.rects[i];
            if (rect->ass) {
                auto normalized = normalize_ass_text(rect->ass);
                av_freep(&rect->ass);
                rect->ass = av_strdup(normalized.c_str());
                if (!rect->ass) {
                    avsubtitle_free(&subtitle);
                    return AVERROR(ENOMEM);
                }
            }
        }

        const int length = avcodec_encode_subtitle(this->encoder, this->bytes.data(), this->bytes.size(), &subtitle);
        avsubtitle_free(&subtitle);
        if (length < 0) {
            return length;
        }

        if (length == 0 || end <= 0) {
            return 0;
        }

        // The text encoder has already removed formatting. Escape literal markup
        // before muxing so ordinary SRT readers do not interpret it a second time.
        std::string escaped;
        escaped.reserve(length);
        for (int i = 0; i < length; ++i) {
            switch (this->bytes[i]) {
                case '&':
                    escaped += "&amp;";
                    break;
                case '<':
                    escaped += "&lt;";
                    break;
                case '>':
                    escaped += "&gt;";
                    break;
                default:
                    escaped += this->bytes[i];
                    break;
            }
        }

        error = av_new_packet(this->encoded, static_cast<int>(escaped.size()));
        if (error < 0) {
            return error;
        }

        std::copy(escaped.begin(), escaped.end(), this->encoded->data);
        const AVRational milliseconds{1, 1000};
        this->encoded->pts = av_rescale_q(std::max<int64_t>(0, start), milliseconds, this->format->streams[0]->time_base);
        this->encoded->dts = this->encoded->pts; // overlapping and non-monotonic subtitle cues are valid
        this->encoded->duration = av_rescale_q(end - std::max<int64_t>(0, start), milliseconds,
                                             this->format->streams[0]->time_base);
        this->encoded->stream_index = 0;
        error = av_write_frame(this->format, this->encoded);
        av_packet_unref(this->encoded);
        return error;
    }
};

inline const char* extract_subtitles(double size, const uint32_t* track_indexes, size_t count) {
    static std::string result;
    last_error.clear();
    if (!valid_subtitle_input(size) || !track_indexes) {
        return subtitle_failure("Invalid subtitle extraction", AVERROR(EINVAL));
    }

    if (count == 0) {
        return subtitle_failure("No subtitle tracks selected", AVERROR(EINVAL));
    }

    SubtitleInput input(size);
    int error = input.open();
    if (error < 0) {
        return subtitle_failure("Could not open subtitle input", error);
    }

    // Resolve public subtitle ordinals once; packet routing below uses FFmpeg stream indexes.
    // Unsupported codecs still occupy a position in this list.
    std::vector<AVStream*> subtitle_streams;
    for (unsigned int index = 0; index < input.format->nb_streams; ++index) {
        auto* stream = input.format->streams[index];
        if (stream->codecpar->codec_type == AVMEDIA_TYPE_SUBTITLE) {
            subtitle_streams.push_back(stream);
        }
    }

    std::vector<std::unique_ptr<SubtitleOutput>> outputs;

    for (size_t position = 0; position < count; ++position) {
        const auto track_index = track_indexes[position];
        if (track_index >= subtitle_streams.size()) {
            return subtitle_failure("Invalid subtitle track index", AVERROR(EINVAL));
        }

        auto* stream = subtitle_streams[track_index];
        if (!supported_text_codec(stream->codecpar->codec_id)) {
            return subtitle_failure("Unsupported subtitle track", AVERROR(EINVAL));
        }

        if (std::any_of(outputs.begin(), outputs.end(), [track_index](const auto& out) {
                return out->track_index == track_index;
            })) {
            return subtitle_failure("Duplicate subtitle track", AVERROR(EINVAL));
        }

        char message[384] = {};
        const auto start = stream->start_time == AV_NOPTS_VALUE ? "unknown" : std::to_string(stream->start_time);
        std::snprintf(message, sizeof(message),
                      "Selected subtitle track: track_index=%u, stream_index=%d, codec=%s, input_time_base=%d/%d, "
                      "stream_start_pts=%s, output_format=%s",
                      track_index, stream->index, avcodec_get_name(stream->codecpar->codec_id),
                      stream->time_base.num, stream->time_base.den, start.c_str(), "srt");
        runtime_diagnostic(DiagnosticLevel::trace, message);
        auto output = std::make_unique<SubtitleOutput>(track_index, stream);
        if ((error = output->open()) < 0) {
            return subtitle_failure("Could not open subtitle output", error);
        }

        outputs.push_back(std::move(output));
    }

    // Read initial packets until each media stream has a presentation origin. Do not
    // use stream-info here: codecs without a video decoder (e.g. H.264) may never get
    // start_time assigned there. Keep selected subtitle packets encountered in the prefix.
    std::vector<int64_t> starts(input.format->nb_streams, AV_NOPTS_VALUE);
    unsigned missing_starts = 0;

    for (unsigned i = 0; i < input.format->nb_streams; ++i) {
        auto* stream = input.format->streams[i];
        const auto type = stream->codecpar->codec_type;
        if (type == AVMEDIA_TYPE_AUDIO || type == AVMEDIA_TYPE_VIDEO) {
            if (stream->start_time != AV_NOPTS_VALUE) {
                starts[i] = av_rescale_q(stream->start_time, stream->time_base, AV_TIME_BASE_Q);
            } else {
                ++missing_starts;
            }
        }

        if (type == AVMEDIA_TYPE_ATTACHMENT) {
            av_freep(&stream->codecpar->extradata);
            stream->codecpar->extradata_size = 0;
            stream->discard = AVDISCARD_ALL;
        }
    }

    auto release_packet = [](AVPacket* packet) { av_packet_free(&packet); };
    using SavedPacket = std::unique_ptr<AVPacket, decltype(release_packet)>;
    std::vector<SavedPacket> prefix;
    AVPacket* packet = av_packet_alloc();
    if (!packet) {
        return subtitle_failure("Could not allocate subtitle packet", AVERROR(ENOMEM));
    }

    SavedPacket owned_packet(packet, release_packet);
    int64_t prefix_bytes = 0;

    while (missing_starts > 0 && (error = av_read_frame(input.format, packet)) >= 0) {
        const auto* stream = input.format->streams[packet->stream_index];
        const auto type = stream->codecpar->codec_type;
        if ((type == AVMEDIA_TYPE_VIDEO || type == AVMEDIA_TYPE_AUDIO) &&
            starts[packet->stream_index] == AV_NOPTS_VALUE && packet->pts != AV_NOPTS_VALUE) {
            starts[packet->stream_index] = av_rescale_q(packet->pts, stream->time_base, AV_TIME_BASE_Q);
            --missing_starts;
        }

        if (std::any_of(outputs.begin(), outputs.end(), [packet](const auto& out) {
                return out->source->index == packet->stream_index;
            })) {
            prefix_bytes += packet->size;
            if (prefix_bytes > 4 * 1024 * 1024) {
                return subtitle_failure("Subtitle timeline prefix exceeds the memory budget", AVERROR(ENOMEM));
            }

            auto* saved = av_packet_clone(packet);
            if (!saved) {
                return subtitle_failure("Could not retain subtitle preroll", AVERROR(ENOMEM));
            }

            prefix.emplace_back(saved, release_packet);
        }

        av_packet_unref(packet);
    }

    if (missing_starts > 0) {
        return subtitle_failure("Could not resolve the media timeline", AVERROR_INVALIDDATA);
    }

    int64_t origin = AV_NOPTS_VALUE;
    for (const auto start : starts) {
        if (start != AV_NOPTS_VALUE) {
            origin = origin == AV_NOPTS_VALUE ? start : std::min(origin, start);
        }
    }

    const bool has_media_origin = origin != AV_NOPTS_VALUE;
    if (origin == AV_NOPTS_VALUE) {
        origin = 0; // Subtitle-only containers use zero, never their first cue.
    }

    char message[384] = {};
    const auto container_start = input.format->start_time == AV_NOPTS_VALUE
        ? "unknown" : std::to_string(input.format->start_time);
    std::snprintf(message, sizeof(message),
                  "Subtitle media origin: origin_us=%lld, basis=%s, container_start_us=%s, "
                  "retained_prefix_bytes=%lld",
                  static_cast<long long>(origin), has_media_origin ? "earliest_media_start" : "subtitle_only_zero",
                  container_start.c_str(), static_cast<long long>(prefix_bytes));
    runtime_diagnostic(DiagnosticLevel::trace, message);

    for (unsigned i = 0; i < starts.size(); ++i) {
        if (starts[i] == AV_NOPTS_VALUE) {
            continue;
        }

        const auto* stream = input.format->streams[i];
        std::snprintf(message, sizeof(message),
                      "Subtitle media timeline reference: stream_index=%d, media_type=%s, "
                      "input_time_base=%d/%d, resolved_start_us=%lld, basis=%s",
                      stream->index, stream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO ? "video" : "audio",
                      stream->time_base.num, stream->time_base.den, static_cast<long long>(starts[i]),
                      stream->start_time == AV_NOPTS_VALUE ? "first_packet_pts" : "stream_start_time");
        runtime_diagnostic(DiagnosticLevel::trace, message);
    }

    for (unsigned i = 0; i < input.format->nb_streams; ++i) {
        if (std::none_of(outputs.begin(), outputs.end(), [i](const auto& out) {
                return out->source->index == static_cast<int>(i);
            })) {
            input.format->streams[i]->discard = AVDISCARD_ALL;
        }
    }

    for (auto& saved : prefix) {
        for (auto& output : outputs) {
            if (output->source->index == saved->stream_index) {
                bool got;
                if ((error = output->decode(saved.get(), origin, &got)) < 0) {
                    return subtitle_failure("Could not extract subtitle preroll", error);
                }
            }
        }
    }

    prefix.clear();

    while ((error = av_read_frame(input.format, packet)) >= 0) {
        for (auto& output : outputs) {
            if (output->source->index == packet->stream_index) {
                bool got;
                error = output->decode(packet, origin, &got);
                break;
            }
        }

        av_packet_unref(packet);
        if (error < 0) {
            break;
        }
    }

    if (error != AVERROR_EOF) {
        return subtitle_failure("Could not extract subtitle packets", error);
    }

    result = "[";
    for (auto& output : outputs) {
        AVPacket empty{};
        empty.pts = empty.dts = AV_NOPTS_VALUE;
        bool got;
        do {
            error = output->decode(&empty, origin, &got);
        } while (error >= 0 && got);

        if (error < 0 || (error = av_write_trailer(output->format)) < 0) {
            return subtitle_failure("Could not finish subtitle output", error);
        }

        avio_flush(output->format->pb);
        if (output->format->pb->error < 0) {
            return subtitle_failure("Could not deliver subtitle output", output->format->pb->error);
        }

        if (result.size() > 1) {
            result += ',';
        }

        result += "{\"trackIndex\":" + std::to_string(output->track_index);
        result += ",\"extension\":\"srt\",\"mimeType\":\"application/x-subrip\"";
        result += '}';
    }

    result += ']';
    return result.c_str();
}

} // namespace asb::detail

#endif
