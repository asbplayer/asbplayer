#ifndef ASB_BITMAP_SUBTITLES_HPP
#define ASB_BITMAP_SUBTITLES_HPP

#include "diagnostics.hpp"
#include "host_io.hpp"
#include <algorithm>
#include <cstring>
#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/base64.h>
}

namespace asb::detail {

inline bool supported_bitmap_codec(AVCodecID id) {
    return id == AV_CODEC_ID_HDMV_PGS_SUBTITLE || id == AV_CODEC_ID_DVD_SUBTITLE || id == AV_CODEC_ID_DVB_SUBTITLE;
}

// One composited PNG per display, preserving palette alpha and the relative placement
// of every rectangle. Retain only the latest display: PGS ends at the next display/clear.
struct BitmapSubtitleOutput {
    static constexpr int maximum_dimension = 8192;
    static constexpr int maximum_png_bytes = 16 * 1024 * 1024;
    uint32_t track_index;
    int screen_width;
    int screen_height;
    int64_t start = 0;
    int64_t end = AV_NOPTS_VALUE;
    std::string image;

    BitmapSubtitleOutput(uint32_t index, int width, int height)
        : track_index(index), screen_width(width), screen_height(height) {}

    int finish(int64_t boundary) {
        if (this->image.empty()) {
            return 0;
        }

        if (this->end != AV_NOPTS_VALUE) {
            boundary = boundary == AV_NOPTS_VALUE ? this->end : std::min(boundary, this->end);
        }

        int result = 0;
        if (boundary != AV_NOPTS_VALUE && boundary > std::max<int64_t>(0, this->start)) {
            auto record = "{\"start\":" + std::to_string(std::max<int64_t>(0, this->start)) +
                          ",\"end\":" + std::to_string(boundary) + ",\"textImage\":" + this->image + "}\n";
            result = asb_write_subtitle_output(this->track_index, reinterpret_cast<const uint8_t*>(record.data()),
                                               record.size()) == static_cast<int>(record.size()) ? 0 : AVERROR(EIO);
        }

        if (boundary == AV_NOPTS_VALUE) {
            runtime_diagnostic(DiagnosticLevel::warning, "Omitted final bitmap display without an end time or container duration");
        }
        this->image.clear();
        return result;
    }

    int display(const AVSubtitle& subtitle, int64_t start, int64_t end, AVCodecContext* decoder) {
        int error = this->finish(start);
        if (error < 0 || subtitle.num_rects == 0) {
            return error;
        }

        const int width = decoder->width > 0 ? decoder->width : this->screen_width;
        const int height = decoder->height > 0 ? decoder->height : this->screen_height;
        if (width <= 0 || height <= 0 || width > maximum_dimension || height > maximum_dimension) {
            return AVERROR_INVALIDDATA;
        }

        int left = width, top = height, right = 0, bottom = 0;
        for (unsigned i = 0; i < subtitle.num_rects; ++i) {
            const auto* rect = subtitle.rects[i];
            if (rect->w == 0 || rect->h == 0) {
                continue;
            }

            if (rect->type != SUBTITLE_BITMAP || rect->x < 0 || rect->y < 0 || rect->w < 0 || rect->h < 0 ||
                rect->x > width - rect->w || rect->y > height - rect->h || !rect->data[0] || !rect->data[1] ||
                rect->linesize[0] < rect->w || rect->nb_colors <= 0 || rect->nb_colors > 256) {
                return AVERROR_INVALIDDATA;
            }

            left = std::min(left, rect->x);
            top = std::min(top, rect->y);
            right = std::max(right, rect->x + rect->w);
            bottom = std::max(bottom, rect->y + rect->h);
        }

        if (right <= left || bottom <= top) {
            return 0;
        }

        const auto* png = avcodec_find_encoder(AV_CODEC_ID_PNG);
        auto* encoder = avcodec_alloc_context3(png);
        auto* frame = av_frame_alloc();
        auto* packet = av_packet_alloc();
        if (!png || !encoder || !frame || !packet) {
            error = AVERROR(ENOMEM);
        } else {
            encoder->width = frame->width = right - left;
            encoder->height = frame->height = bottom - top;
            encoder->pix_fmt = AV_PIX_FMT_RGBA;
            frame->format = AV_PIX_FMT_RGBA;
            encoder->time_base = AVRational{1, 1000};
            error = avcodec_open2(encoder, png, nullptr);
            if (error >= 0) {
                error = av_frame_get_buffer(frame, 0);
            }

            if (error >= 0) {
                for (int y = 0; y < frame->height; ++y) {
                    std::memset(frame->data[0] + y * frame->linesize[0], 0, frame->width * 4);
                }

                for (unsigned i = 0; i < subtitle.num_rects && error >= 0; ++i) {
                    const auto* rect = subtitle.rects[i];
                    for (int y = 0; y < rect->h && error >= 0; ++y) {
                        for (int x = 0; x < rect->w; ++x) {
                            const auto index = rect->data[0][y * rect->linesize[0] + x];
                            if (index >= rect->nb_colors) {
                                error = AVERROR_INVALIDDATA;
                                break;
                            }

                            uint32_t color;
                            std::memcpy(&color, rect->data[1] + index * sizeof(color), sizeof(color));
                            auto* pixel = frame->data[0] + (rect->y - top + y) * frame->linesize[0] +
                                          (rect->x - left + x) * 4;
                            const unsigned alpha = color >> 24;
                            const unsigned background = pixel[3] * (255 - alpha);
                            const unsigned combined = alpha * 255 + background;
                            if (combined == 0) {
                                continue;
                            }

                            for (int channel = 0; channel < 3; ++channel) {
                                const unsigned component = (color >> (16 - channel * 8)) & 255;
                                pixel[channel] = (component * alpha * 255 + pixel[channel] * background) / combined;
                            }
                            pixel[3] = (combined + 127) / 255;
                        }
                    }
                }
            }

            if (error >= 0) {
                error = avcodec_send_frame(encoder, frame);
            }
            if (error >= 0) {
                error = avcodec_receive_packet(encoder, packet);
            }
            if (error >= 0 && packet->size > maximum_png_bytes) {
                error = AVERROR(ENOMEM);
            }
            if (error >= 0) {
                std::string base64(AV_BASE64_SIZE(packet->size), '\0');
                av_base64_encode(base64.data(), base64.size(), packet->data, packet->size);
                base64.resize(std::strlen(base64.c_str()));
                this->image = "{\"dataUrl\":\"data:image/png;base64," + base64 +
                              "\",\"screen\":{\"width\":" + std::to_string(width) +
                              ",\"height\":" + std::to_string(height) + "},\"image\":{\"width\":" +
                              std::to_string(frame->width) + ",\"height\":" + std::to_string(frame->height) +
                              "}}";
                this->start = start;
                this->end = end;
            }
        }

        av_packet_free(&packet);
        av_frame_free(&frame);
        avcodec_free_context(&encoder);
        return error;
    }
};

} // namespace asb::detail

#endif
