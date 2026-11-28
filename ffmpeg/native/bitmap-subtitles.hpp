#ifndef ASB_BITMAP_SUBTITLES_HPP
#define ASB_BITMAP_SUBTITLES_HPP

#include "diagnostics.hpp"
#include "host_io.hpp"
#include <algorithm>
#include <cstring>
#include <memory>
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
private:
    struct FrameDeleter {
        void operator()(AVFrame* frame) const { av_frame_free(&frame); }
    };
    using Frame = std::unique_ptr<AVFrame, FrameDeleter>;

    static constexpr int maximum_dimension = 8192;
    static constexpr int maximum_png_bytes = 16 * 1024 * 1024;
    static constexpr size_t maximum_cached_rgba_bytes = 16 * 1024 * 1024;
    static constexpr int max_palette_colors = 256;
    static constexpr int rgba_bytes_per_pixel = 4;
    uint32_t track_key;
    int screen_width;
    int screen_height;
    int64_t start = 0;
    int64_t end = AV_NOPTS_VALUE;
    int64_t latest_display_start = 0;
    std::string image;
    Frame previous_frame;
    int previous_screen_width = 0;
    int previous_screen_height = 0;

public:
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
        this->previous_frame.reset();
        return result;
    }

    int interrupt(int64_t boundary) {
        // Without a packet timestamp only the prefix confirmed by a prior display is safe to emit.
        return this->finish(boundary == AV_NOPTS_VALUE ? this->latest_display_start : boundary);
    }

    int display(const AVSubtitle& subtitle, int64_t start, int64_t end, const AVCodecContext* decoder) {
        if (subtitle.num_rects == 0) return this->finish(start);

        const int width = decoder->width > 0 ? decoder->width : this->screen_width;
        const int height = decoder->height > 0 ? decoder->height : this->screen_height;
        Frame frame;
        int error = compose_image(subtitle, width, height, frame);
        const bool contiguous = start > std::max<int64_t>(0, this->latest_display_start) &&
            (this->end == AV_NOPTS_VALUE || start <= this->end);
        const bool comparable = contiguous && error >= 0 && frame && this->previous_frame &&
            width == this->previous_screen_width && height == this->previous_screen_height;
        bool repeat = comparable && same_pixels(*frame, *this->previous_frame);

        std::string next_image;
        if (error >= 0 && frame && !repeat) {
            error = encode_image(*frame, width, height, next_image);
            // Large images use exact serialized comparison without retaining a second representation.
            repeat = !comparable && contiguous && error >= 0 && next_image == this->image;
        }
        if (repeat) {
            this->latest_display_start = start;
            this->end = end;
            return 0;
        }

        const int write_error = this->finish(start);
        if (write_error < 0) return write_error;
        if (error < 0 || !frame) return error;

        this->image = std::move(next_image);
        if (frame->buf[0]->size <= maximum_cached_rgba_bytes) {
            this->previous_frame = std::move(frame);
            this->previous_screen_width = width;
            this->previous_screen_height = height;
        }
        this->start = start;
        this->latest_display_start = start;
        this->end = end;
        return 0;
    }

private:
    static bool same_pixels(const AVFrame& frame, const AVFrame& previous) {
        if (frame.width != previous.width || frame.height != previous.height) return false;
        const size_t row_bytes = frame.width * rgba_bytes_per_pixel;
        for (int y = 0; y < frame.height; ++y) {
            if (std::memcmp(frame.data[0] + y * frame.linesize[0],
                            previous.data[0] + y * previous.linesize[0], row_bytes) != 0) return false;
        }
        return true;
    }

    static int compose_image(const AVSubtitle& subtitle, int width, int height, Frame& frame) {
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

        frame.reset(av_frame_alloc());
        if (!frame) return AVERROR(ENOMEM);
        frame->width = right - left;
        frame->height = bottom - top;
        frame->format = AV_PIX_FMT_RGBA;
        const int error = av_frame_get_buffer(frame.get(), 0);
        if (error < 0) return error;

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
        return 0;
    }

    static int encode_image(const AVFrame& frame, int width, int height, std::string& image) {
        const auto* png = avcodec_find_encoder(AV_CODEC_ID_PNG);
        if (!png) return AVERROR(ENOMEM);

        struct PngResources {
            AVCodecContext* encoder;
            AVPacket* packet;

            ~PngResources() {
                av_packet_free(&this->packet);
                avcodec_free_context(&this->encoder);
            }
        } resources{avcodec_alloc_context3(png), av_packet_alloc()};
        auto* encoder = resources.encoder;
        auto* packet = resources.packet;
        if (!encoder || !packet) return AVERROR(ENOMEM);

        encoder->width = frame.width;
        encoder->height = frame.height;
        encoder->pix_fmt = AV_PIX_FMT_RGBA;
        encoder->time_base = milliseconds;
        int error = avcodec_open2(encoder, png, nullptr);
        if (error < 0) return error;
        if ((error = avcodec_send_frame(encoder, &frame)) < 0) return error;
        if ((error = avcodec_receive_packet(encoder, packet)) < 0) return error;
        if (packet->size > maximum_png_bytes) return AVERROR(ENOMEM);

        std::string base64(AV_BASE64_SIZE(packet->size), '\0');
        av_base64_encode(base64.data(), base64.size(), packet->data, packet->size);
        base64.resize(std::strlen(base64.c_str()));
        image = "{\"dataUrl\":\"data:image/png;base64," + base64 +
                "\",\"screen\":{\"width\":" + std::to_string(width) +
                ",\"height\":" + std::to_string(height) + "},\"image\":{\"width\":" +
                std::to_string(frame.width) + ",\"height\":" + std::to_string(frame.height) +
                "}}";
        return 0;
    }
};

} // namespace asb::detail

#endif
