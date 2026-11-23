#ifndef ASB_BITMAP_SUBTITLES_HPP
#define ASB_BITMAP_SUBTITLES_HPP

#include "diagnostics.hpp"
#include "host_io.hpp"
#include <algorithm>
#include <cstring>
#include <string>
#include <utility>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/base64.h>
}

namespace asb::detail {

inline constexpr AVRational milliseconds{1, 1000};

inline bool supported_bitmap_codec(AVCodecID id) {
    return id == AV_CODEC_ID_HDMV_PGS_SUBTITLE || id == AV_CODEC_ID_DVD_SUBTITLE || id == AV_CODEC_ID_DVB_SUBTITLE;
}

/**
 * Composites each display to a PNG, preserving palette alpha and relative rectangle placement.
 * Keeps one pending cue so contiguous displays of the same image can share its interval.
 */
struct BitmapSubtitleOutput {
    static constexpr int maximum_dimension = 8192;
    static constexpr int maximum_png_bytes = 16 * 1024 * 1024;
    static constexpr int max_palette_colors = 256;
    static constexpr int rgba_bytes_per_pixel = 4;
    uint32_t track_key;
    int screen_width;
    int screen_height;
    int64_t start = 0;
    int64_t end = AV_NOPTS_VALUE;
    int64_t latest_display_start = 0;
    std::string image;

    BitmapSubtitleOutput(uint32_t track_key, int screen_width, int screen_height)
        : track_key(track_key), screen_width(screen_width), screen_height(screen_height) {}

    int finish(int64_t boundary) {
        if (this->image.empty()) return 0;

        if (this->end != AV_NOPTS_VALUE) {
            boundary = boundary == AV_NOPTS_VALUE ? this->end : std::min(boundary, this->end);
        }

        if (boundary == AV_NOPTS_VALUE) {
            runtime_diagnostic(DiagnosticLevel::warning,
                               "Omitted final bitmap display without an end time or container duration");
        }

        // Each merged display already confirmed that the image lasted up to its start.
        const int64_t cue_end = std::max(boundary, this->latest_display_start);
        const int64_t clamped_start = std::max<int64_t>(0, this->start);
        int result = 0;
        if (cue_end > clamped_start) {
            auto record = "{\"start\":" + std::to_string(clamped_start) +
                          ",\"end\":" + std::to_string(cue_end) + ",\"textImage\":" + this->image + "}\n";
            result = asb_write_output(this->track_key, reinterpret_cast<const uint8_t*>(record.data()),
                                      record.size()) == static_cast<int>(record.size()) ? 0 : AVERROR(EIO);
        }

        this->image.clear();
        return result;
    }

    int display(const AVSubtitle& subtitle, int64_t start, int64_t end, AVCodecContext* decoder) {
        if (subtitle.num_rects == 0) return this->finish(start);

        std::string next_image;
        const int encode_error = this->encode_image(subtitle, decoder, next_image);
        // A new start caps the previous display. The serialized image includes the PNG and both sets of dimensions.
        if (encode_error >= 0 && !next_image.empty() && start > std::max<int64_t>(0, this->latest_display_start) &&
            (this->end == AV_NOPTS_VALUE || start <= this->end) && next_image == this->image) {
            this->latest_display_start = start;
            this->end = end;
            return 0;
        }

        const int write_error = this->finish(start);
        if (write_error < 0) return write_error;
        if (encode_error < 0 || next_image.empty()) return encode_error;

        this->image = std::move(next_image);
        this->start = start;
        this->latest_display_start = start;
        this->end = end;
        return 0;
    }

private:
    int encode_image(const AVSubtitle& subtitle, const AVCodecContext* decoder, std::string& image) const {
        const int width = decoder->width > 0 ? decoder->width : this->screen_width;
        const int height = decoder->height > 0 ? decoder->height : this->screen_height;
        if (width <= 0 || height <= 0 || width > maximum_dimension || height > maximum_dimension) {
            return AVERROR_INVALIDDATA;
        }

        int left = width, top = height, right = 0, bottom = 0;
        for (unsigned i = 0; i < subtitle.num_rects; ++i) {
            const auto* rect = subtitle.rects[i];
            if (rect->w == 0 || rect->h == 0) continue;

            if (rect->type != SUBTITLE_BITMAP || rect->x < 0 || rect->y < 0 || rect->w < 0 || rect->h < 0 ||
                rect->x > width - rect->w || rect->y > height - rect->h || !rect->data[0] || !rect->data[1] ||
                rect->linesize[0] < rect->w || rect->nb_colors <= 0 || rect->nb_colors > max_palette_colors) {
                return AVERROR_INVALIDDATA;
            }

            left = std::min(left, rect->x);
            top = std::min(top, rect->y);
            right = std::max(right, rect->x + rect->w);
            bottom = std::max(bottom, rect->y + rect->h);
        }

        if (right <= left || bottom <= top) return 0;

        const auto* png = avcodec_find_encoder(AV_CODEC_ID_PNG);
        if (!png) return AVERROR(ENOMEM);

        struct PngResources {
            AVCodecContext* encoder = nullptr;
            AVFrame* frame = nullptr;
            AVPacket* packet = nullptr;

            ~PngResources() {
                av_packet_free(&this->packet);
                av_frame_free(&this->frame);
                avcodec_free_context(&this->encoder);
            }
        } resources;
        resources.encoder = avcodec_alloc_context3(png);
        resources.frame = av_frame_alloc();
        resources.packet = av_packet_alloc();
        if (!resources.encoder || !resources.frame || !resources.packet) return AVERROR(ENOMEM);

        auto* encoder = resources.encoder;
        auto* frame = resources.frame;
        auto* packet = resources.packet;
        encoder->width = frame->width = right - left;
        encoder->height = frame->height = bottom - top;
        encoder->pix_fmt = AV_PIX_FMT_RGBA;
        frame->format = AV_PIX_FMT_RGBA;
        encoder->time_base = milliseconds;
        int error = avcodec_open2(encoder, png, nullptr);
        if (error < 0) return error;
        if ((error = av_frame_get_buffer(frame, 0)) < 0) return error;

        for (int y = 0; y < frame->height; ++y) {
            std::memset(frame->data[0] + y * frame->linesize[0], 0, frame->width * rgba_bytes_per_pixel);
        }

        for (unsigned i = 0; i < subtitle.num_rects; ++i) {
            const auto* rect = subtitle.rects[i];
            for (int y = 0; y < rect->h; ++y) {
                for (int x = 0; x < rect->w; ++x) {
                    const auto index = rect->data[0][y * rect->linesize[0] + x];
                    if (index >= rect->nb_colors) return AVERROR_INVALIDDATA;

                    uint32_t color;
                    std::memcpy(&color, rect->data[1] + index * sizeof(color), sizeof(color));
                    auto* pixel = frame->data[0] + (rect->y - top + y) * frame->linesize[0] +
                                  (rect->x - left + x) * rgba_bytes_per_pixel;
                    const unsigned alpha = color >> 24;
                    const unsigned background = pixel[3] * (255 - alpha);
                    const unsigned combined = alpha * 255 + background;
                    if (combined == 0) continue;

                    for (int channel = 0; channel < 3; ++channel) {
                        const unsigned component = (color >> (16 - channel * 8)) & 255;
                        pixel[channel] = (component * alpha * 255 + pixel[channel] * background) / combined;
                    }
                    pixel[3] = (combined + 127) / 255;
                }
            }
        }

        if ((error = avcodec_send_frame(encoder, frame)) < 0) return error;
        if ((error = avcodec_receive_packet(encoder, packet)) < 0) return error;
        if (packet->size > maximum_png_bytes) return AVERROR(ENOMEM);

        std::string base64(AV_BASE64_SIZE(packet->size), '\0');
        av_base64_encode(base64.data(), base64.size(), packet->data, packet->size);
        base64.resize(std::strlen(base64.c_str()));
        image = "{\"dataUrl\":\"data:image/png;base64," + base64 +
                "\",\"screen\":{\"width\":" + std::to_string(width) +
                ",\"height\":" + std::to_string(height) + "},\"image\":{\"width\":" +
                std::to_string(frame->width) + ",\"height\":" + std::to_string(frame->height) +
                "}}";
        return 0;
    }
};

} // namespace asb::detail

#endif
