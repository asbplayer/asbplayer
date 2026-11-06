#ifndef ASB_AUDIO_TRANSCODER_HPP
#define ASB_AUDIO_TRANSCODER_HPP

#include "error.hpp"
#include "host_io.hpp"
#include "diagnostics.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/audio_fifo.h>
#include <libavutil/avutil.h>
#include <libavutil/samplefmt.h>
#include <libswresample/swresample.h>
}

namespace asb::detail {

inline constexpr double javascript_max_safe_integer = 9007199254740991.0;

inline int prepare_frame(AVFrame* frame, AVCodecContext* encoder, int samples) {
    av_frame_unref(frame);
    frame->format = encoder->sample_fmt;
    frame->sample_rate = encoder->sample_rate;
    frame->nb_samples = samples;
    const int result = av_channel_layout_copy(&frame->ch_layout, &encoder->ch_layout);
    return result < 0 ? result : av_frame_get_buffer(frame, 0);
}

struct AudioTranscoder {
    static constexpr int opus_sample_rate = 48000;
    static constexpr int opus_bit_rate = 96000;
    static constexpr int opus_compression_level = 4;
    static constexpr int output_channels = 2;
    static constexpr char cluster_time_limit_ms[] = "2000";

    AVFormatContext* input = nullptr;
    AVIOContext* input_io = nullptr;
    AVCodecContext* decoder = nullptr;
    AVCodecContext* encoder = nullptr;
    AVFormatContext* output = nullptr;
    SwrContext* resampler = nullptr;
    AVChannelLayout resampler_layout = {};
    AVSampleFormat resampler_format = AV_SAMPLE_FMT_NONE;
    int resampler_sample_rate = 0;
    AVAudioFifo* fifo = nullptr;
    AVFrame* decoded = nullptr;
    AVFrame* converted = nullptr;
    AVFrame* encoded = nullptr;
    AVPacket* packet = nullptr;
    AVPacket* encoded_packet = nullptr;
    AVStream* input_stream = nullptr;
    int64_t origin = 0;
    int64_t written_samples = 0;
    int64_t source_position = 0;
    bool source_position_known = false;
    int64_t next_pts = 0;
    double total_seconds = 0;
    int64_t decoder_errors = 0;
    int64_t silence_samples = 0;
    int64_t trimmed_samples = 0;

    ~AudioTranscoder() {
        char message[256] = {};
        if (this->decoder_errors > 0) {
            std::snprintf(message, sizeof(message), "Tolerated %lld audio decoder errors",
                          static_cast<long long>(this->decoder_errors));
            runtime_diagnostic(DiagnosticLevel::warning, message);
        }
        if (this->silence_samples > 0 || this->trimmed_samples > 0) {
            std::snprintf(message, sizeof(message),
                          "Audio timeline at 48000 Hz: inserted %lld silence samples, trimmed %lld samples",
                          static_cast<long long>(this->silence_samples), static_cast<long long>(this->trimmed_samples));
            runtime_diagnostic(DiagnosticLevel::trace, message);
        }
        if (this->output != nullptr && this->output->pb != nullptr) {
            av_freep(&this->output->pb->buffer);
            avio_context_free(&this->output->pb);
        }
        av_packet_free(&this->encoded_packet);
        av_packet_free(&this->packet);
        av_frame_free(&this->encoded);
        av_frame_free(&this->converted);
        av_frame_free(&this->decoded);
        av_audio_fifo_free(this->fifo);
        swr_free(&this->resampler);
        av_channel_layout_uninit(&this->resampler_layout);
        avcodec_free_context(&this->encoder);
        avcodec_free_context(&this->decoder);
        avformat_free_context(this->output);
        if (this->input != nullptr) {
            this->input->pb = nullptr;
            avformat_close_input(&this->input);
        }
        if (this->input_io != nullptr) {
            av_freep(&this->input_io->buffer);
            avio_context_free(&this->input_io);
        }
    }

    int drain_encoder() {
        int result;
        while ((result = avcodec_receive_packet(this->encoder, this->encoded_packet)) >= 0) {
            av_packet_rescale_ts(this->encoded_packet, this->encoder->time_base, this->output->streams[0]->time_base);
            this->encoded_packet->stream_index = 0;
            result = av_interleaved_write_frame(this->output, this->encoded_packet);
            av_packet_unref(this->encoded_packet);
            if (result < 0) return result;
        }
        return result == AVERROR(EAGAIN) || result == AVERROR_EOF ? 0 : result;
    }

    int encode_pending(bool final = false) {
        while (av_audio_fifo_size(this->fifo) >= this->encoder->frame_size ||
               (final && av_audio_fifo_size(this->fifo) > 0)) {
            const int samples = std::min(av_audio_fifo_size(this->fifo), this->encoder->frame_size);
            int result = prepare_frame(this->encoded, this->encoder, samples);
            if (result < 0) return result;
            if (av_audio_fifo_read(this->fifo, reinterpret_cast<void**>(this->encoded->extended_data), samples) !=
                samples) {
                return AVERROR(EIO);
            }
            this->encoded->pts = this->next_pts;
            this->next_pts += samples;
            result = avcodec_send_frame(this->encoder, this->encoded);
            if (result < 0) return result;
            result = drain_encoder();
            if (result < 0) return result;
        }
        return 0;
    }

    int append_samples(AVFrame* frame, int offset, int count) {
        if (count == 0) return 0;
        const int channels = this->encoder->ch_layout.nb_channels;
        const bool planar = av_sample_fmt_is_planar(this->encoder->sample_fmt);
        const int stride = av_get_bytes_per_sample(this->encoder->sample_fmt) * (planar ? 1 : channels);
        uint8_t* planes[AV_NUM_DATA_POINTERS] = {};
        for (int channel = 0; channel < (planar ? channels : 1); ++channel) {
            planes[channel] = frame->extended_data[channel] + offset * stride;
        }
        int result = av_audio_fifo_realloc(this->fifo, av_audio_fifo_size(this->fifo) + count);
        if (result < 0) return result;
        if (av_audio_fifo_write(this->fifo, reinterpret_cast<void**>(planes), count) != count) return AVERROR(EIO);
        this->written_samples += count;
        return encode_pending();
    }

    int append_silence(int64_t samples) {
        while (samples > 0) {
            const int count = static_cast<int>(std::min<int64_t>(samples, this->encoder->frame_size));
            int result = prepare_frame(this->encoded, this->encoder, count);
            if (result < 0) return result;
            result = av_samples_set_silence(this->encoded->extended_data, 0, count,
                                           this->encoder->ch_layout.nb_channels, this->encoder->sample_fmt);
            if (result < 0) return result;
            const int64_t before = this->written_samples;
            result = append_samples(this->encoded, 0, count);
            this->silence_samples += this->written_samples - before;
            if (result < 0) return result;
            samples -= count;
        }
        return 0;
    }

    int append_converted(int samples, int64_t target) {
        // Millisecond rounding can survive a remux into MP4's finer timestamp clock.
        // Allow at least that much jitter, while retaining real offsets and gaps.
        const int64_t tolerance = std::max<int64_t>(this->encoder->sample_rate / 1000,
            av_rescale_q(1, this->input_stream->time_base, this->encoder->time_base));
        // Keep the sample clock through container timestamp rounding, including
        // DTS's 512-sample frames at 48 kHz and TrueHD/MLP's shorter frames.
        if (this->source_position_known) {
            int64_t delta;
            if (__builtin_sub_overflow(target, this->source_position, &delta)) return AVERROR_INVALIDDATA;
            if (delta >= -tolerance && delta <= tolerance) target = this->source_position;
        }
        int64_t difference;
        if (__builtin_add_overflow(target, static_cast<int64_t>(samples), &this->source_position) ||
            __builtin_sub_overflow(target, this->written_samples, &difference)) {
            return AVERROR_INVALIDDATA;
        }
        this->source_position_known = true;
        if (difference > tolerance) {
            const int result = append_silence(difference);
            if (result < 0) return result;
        }
        // Trim samples preceding the media origin, even within one timestamp tick.
        int skip = 0;
        if (target < 0 || difference < -tolerance) {
            skip = difference <= -static_cast<int64_t>(samples) ? samples : static_cast<int>(-difference);
        }
        this->trimmed_samples += skip;
        return append_samples(this->converted, skip, samples - skip);
    }

    int drain_resampler() {
        if (this->resampler == nullptr) return 0;
        while (true) {
            const int capacity = static_cast<int>(swr_get_delay(this->resampler, this->encoder->sample_rate));
            if (capacity <= 0) return 0;
            int result = prepare_frame(this->converted, this->encoder, capacity);
            if (result < 0) return result;
            const int samples = swr_convert(this->resampler, this->converted->extended_data, capacity, nullptr, 0);
            if (samples <= 0) return samples;
            result = append_converted(samples,
                this->source_position_known ? this->source_position : this->written_samples);
            if (result < 0) return result;
        }
    }

    int configure_resampler() {
        if (this->resampler != nullptr && this->resampler_sample_rate == this->decoded->sample_rate &&
            this->resampler_format == this->decoded->format &&
            av_channel_layout_compare(&this->resampler_layout, &this->decoded->ch_layout) == 0) {
            return 0;
        }

        // Drain the previous format before replacing its resampler, retaining its sample clock.
        int result = drain_resampler();
        if (result < 0) return result;
        swr_free(&this->resampler);
        av_channel_layout_uninit(&this->resampler_layout);
        result = av_channel_layout_copy(&this->resampler_layout, &this->decoded->ch_layout);
        if (result < 0) return result;
        this->resampler_format = static_cast<AVSampleFormat>(this->decoded->format);
        this->resampler_sample_rate = this->decoded->sample_rate;
        char layout[128] = {};
        av_channel_layout_describe(&this->resampler_layout, layout, sizeof(layout));
        const char* sample_format = av_get_sample_fmt_name(this->resampler_format);
        char message[512] = {};
        std::snprintf(message, sizeof(message),
                      "Decoded audio format: codec=%s, sample_rate=%d, sample_format=%s, channel_layout=%s",
                      avcodec_get_name(this->decoder->codec_id), this->resampler_sample_rate,
                      sample_format != nullptr ? sample_format : "unknown", layout);
        runtime_diagnostic(DiagnosticLevel::trace, message);
        result = swr_alloc_set_opts2(&this->resampler, &this->encoder->ch_layout, this->encoder->sample_fmt,
            this->encoder->sample_rate, &this->resampler_layout, this->resampler_format,
            this->resampler_sample_rate, 0, nullptr);
        return result < 0 ? result : swr_init(this->resampler);
    }

    int convert_frame() {
        int result = configure_resampler();
        if (result < 0) return result;
        const int64_t delay = swr_get_delay(this->resampler, this->resampler_sample_rate);
        const int capacity = static_cast<int>(av_rescale_rnd(delay + this->decoded->nb_samples,
            this->encoder->sample_rate, this->resampler_sample_rate, AV_ROUND_UP));
        result = prepare_frame(this->converted, this->encoder, capacity);
        if (result < 0) return result;
        const int samples = swr_convert(this->resampler, this->converted->extended_data, capacity,
            const_cast<const uint8_t**>(this->decoded->extended_data), this->decoded->nb_samples);
        if (samples <= 0) return samples;

        int64_t target = this->source_position_known ? this->source_position : this->written_samples;
        if (this->decoded->best_effort_timestamp != AV_NOPTS_VALUE) {
            const int64_t timestamp = av_rescale_q(this->decoded->best_effort_timestamp,
                this->input_stream->time_base, this->encoder->time_base);
            const int64_t delay_samples = av_rescale_q(delay, AVRational{1, this->resampler_sample_rate},
                this->encoder->time_base);
            // av_rescale_q returns INT64_MIN when the input cannot fit the output clock.
            if (timestamp == AV_NOPTS_VALUE || delay_samples == AV_NOPTS_VALUE ||
                __builtin_sub_overflow(timestamp, this->origin, &target) ||
                __builtin_sub_overflow(target, delay_samples, &target)) {
                return AVERROR_INVALIDDATA;
            }
        }
        return append_converted(samples, target);
    }

    // Like the ffmpeg CLI, skip corrupt input: the next frame's timestamp fills its gap with silence.
    int tolerate_decode_error(int result) {
        if (result == AVERROR(ENOMEM)) return result;
        ++this->decoder_errors;
        return 0;
    }

    int receive_frames() {
        while (true) {
            int result = avcodec_receive_frame(this->decoder, this->decoded);
            if (result == AVERROR(EAGAIN) || result == AVERROR_EOF) return 0;
            result = result < 0 ? tolerate_decode_error(result) : convert_frame();
            if (result < 0) return result;
        }
    }

    int finish() {
        int result = avcodec_send_packet(this->decoder, nullptr);
        if (result < 0 && result != AVERROR_EOF) return result;
        result = receive_frames();
        if (result < 0) return result;
        result = drain_resampler();
        if (result < 0) return result;
        result = encode_pending(true);
        if (result < 0) return result;
        result = avcodec_send_frame(this->encoder, nullptr);
        if (result < 0) return result;
        result = drain_encoder();
        return result < 0 ? result : av_write_trailer(this->output);
    }
    // Each stage returns 0 or the result of fail(), leaving partially created resources to the destructor.

    int open_input(InputBuffer* input_buffer) {
        auto* io_buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (io_buffer == nullptr) return fail("Unable to allocate FFmpeg input buffer", AVERROR(ENOMEM));
        this->input_io = avio_alloc_context(io_buffer, io_buffer_bytes, 0, input_buffer,
            read_input, nullptr, seek_input);
        if (this->input_io == nullptr) {
            av_free(io_buffer);
            return fail("Unable to create FFmpeg input context", AVERROR(ENOMEM));
        }
        this->input = avformat_alloc_context();
        if (this->input == nullptr) return fail("Unable to allocate FFmpeg input format", AVERROR(ENOMEM));
        this->input->pb = this->input_io;
        this->input->flags |= AVFMT_FLAG_CUSTOM_IO;
        const int result = avformat_open_input(&this->input, nullptr, nullptr, nullptr);
        return result < 0 ? fail("Could not open input", result) : 0;
    }

    int select_track(int track_index) {
        int audio_count = 0;
        for (unsigned int index = 0; index < this->input->nb_streams; ++index) {
            auto* stream = this->input->streams[index];
            if (stream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO && audio_count++ == track_index) {
                this->input_stream = stream;
            } else {
                // Video timestamps must contribute to the media origin during probing;
                // discarding them here shifts delayed Matroska audio back to zero.
                if (stream->codecpar->codec_type != AVMEDIA_TYPE_VIDEO) stream->discard = AVDISCARD_ALL;
                // Stream probing copies codec data into temporary decoder contexts.
                // In particular, font attachments can exhaust WASM memory this way.
                av_freep(&stream->codecpar->extradata);
                stream->codecpar->extradata_size = 0;
            }
        }
        if (this->input_stream == nullptr) return fail("The requested audio track does not exist", AVERROR(EINVAL));
        const int result = avformat_find_stream_info(this->input, nullptr);
        return result < 0 ? fail("Could not read input stream information", result) : 0;
    }

    int open_decoder() {
        const auto* codec = avcodec_find_decoder(this->input_stream->codecpar->codec_id);
        if (codec == nullptr) return fail("The selected audio codec is not available", AVERROR_DECODER_NOT_FOUND);
        this->decoder = avcodec_alloc_context3(codec);
        if (this->decoder == nullptr) return fail("Unable to allocate the audio decoder", AVERROR(ENOMEM));
        int result = avcodec_parameters_to_context(this->decoder, this->input_stream->codecpar);
        if (result < 0) return fail("Could not configure audio decoder", result);
        this->decoder->pkt_timebase = this->input_stream->time_base;
        result = avcodec_open2(this->decoder, codec, nullptr);
        return result < 0 ? fail("Could not open audio decoder", result) : 0;
    }

    int open_output() {
        int result = avformat_alloc_output_context2(&this->output, nullptr, "webm", nullptr);
        if (result < 0 || this->output == nullptr) {
            return fail("Could not create audio output", result < 0 ? result : AVERROR(ENOMEM));
        }
        const auto* codec = avcodec_find_encoder_by_name("libopus");
        if (codec == nullptr) return fail("The audio encoder is not available", AVERROR_ENCODER_NOT_FOUND);
        auto* output_stream = avformat_new_stream(this->output, nullptr);
        this->encoder = avcodec_alloc_context3(codec);
        if (output_stream == nullptr || this->encoder == nullptr) {
            return fail("Unable to allocate the audio encoder", AVERROR(ENOMEM));
        }
        this->encoder->codec_type = AVMEDIA_TYPE_AUDIO;
        this->encoder->codec_id = AV_CODEC_ID_OPUS;
        this->encoder->sample_rate = opus_sample_rate;
        this->encoder->sample_fmt = AV_SAMPLE_FMT_FLT;
        this->encoder->bit_rate = opus_bit_rate;
        this->encoder->compression_level = opus_compression_level;
        av_channel_layout_default(&this->encoder->ch_layout, output_channels);
        this->encoder->time_base = AVRational{1, this->encoder->sample_rate};
        if (this->output->oformat->flags & AVFMT_GLOBALHEADER) this->encoder->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        result = avcodec_open2(this->encoder, codec, nullptr);
        if (result < 0) return fail("Could not open audio encoder", result);
        result = avcodec_parameters_from_context(output_stream->codecpar, this->encoder);
        if (result < 0) return fail("Could not configure audio output", result);
        output_stream->time_base = this->encoder->time_base;
        auto* output_buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (output_buffer == nullptr) return fail("Could not allocate audio output buffer", AVERROR(ENOMEM));
        this->output->pb = avio_alloc_context(output_buffer, io_buffer_bytes, 1, nullptr,
            nullptr, write_output, nullptr);
        if (this->output->pb == nullptr) {
            av_free(output_buffer);
            return fail("Could not create audio output context", AVERROR(ENOMEM));
        }
        this->output->flags |= AVFMT_FLAG_CUSTOM_IO | AVFMT_FLAG_FLUSH_PACKETS;
        return 0;
    }

    int read_first_audio_packet() {
        // Browser video keeps positive presentation timestamps and clips negative
        // preroll. FFmpeg's container/stream start may instead be inferred from audio.
        const bool has_video = std::any_of(this->input->streams, this->input->streams + this->input->nb_streams,
            [](const AVStream* stream) { return stream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO; });
        // Audio-only inputs retain their existing normalization.
        if (!has_video && this->input->start_time != AV_NOPTS_VALUE) {
            this->origin = std::min<int64_t>(0,
                av_rescale_q(this->input->start_time, AV_TIME_BASE_Q, this->encoder->time_base));
            if (this->origin == AV_NOPTS_VALUE) return fail("Invalid audio timeline", AVERROR_INVALIDDATA);
        }

        int result;
        while ((result = av_read_frame(this->input, this->packet)) >= 0) {
            if (this->packet->stream_index == this->input_stream->index) {
                char message[512] = {};
                const auto container_start = this->input->start_time == AV_NOPTS_VALUE
                    ? "unknown" : std::to_string(this->input->start_time);
                const auto stream_start = this->input_stream->start_time == AV_NOPTS_VALUE
                    ? "unknown" : std::to_string(this->input_stream->start_time);
                const auto first_pts = this->packet->pts == AV_NOPTS_VALUE
                    ? "unknown" : std::to_string(this->packet->pts);
                const auto first_dts = this->packet->dts == AV_NOPTS_VALUE
                    ? "unknown" : std::to_string(this->packet->dts);
                std::snprintf(message, sizeof(message),
                              "Audio timeline origin: stream_index=%d, codec=%s, has_video=%s, "
                              "container_start_us=%s, stream_start_pts=%s, input_time_base=%d/%d, "
                              "first_packet_pts=%s, first_packet_dts=%s, origin_samples=%lld, "
                              "output_time_base=%d/%d, basis=%s",
                              this->input_stream->index, avcodec_get_name(this->input_stream->codecpar->codec_id),
                              has_video ? "true" : "false", container_start.c_str(), stream_start.c_str(),
                              this->input_stream->time_base.num, this->input_stream->time_base.den,
                              first_pts.c_str(), first_dts.c_str(), static_cast<long long>(this->origin),
                              this->encoder->time_base.num, this->encoder->time_base.den,
                              has_video ? "browser_video_zero" : "nonpositive_container_start_or_zero");
                runtime_diagnostic(DiagnosticLevel::trace, message);
                for (unsigned int index = 0; index < this->input->nb_streams; ++index) {
                    auto* stream = this->input->streams[index];
                    if (stream != this->input_stream) stream->discard = AVDISCARD_ALL;
                }
                return 0;
            }
            av_packet_unref(this->packet);
        }
        return fail("Could not read the first audio packet", result);
    }

    void resolve_timeline() {
        if (this->input_stream->duration != AV_NOPTS_VALUE && this->input_stream->duration > 0) {
            this->total_seconds = this->input_stream->duration * av_q2d(this->input_stream->time_base);
            if (this->input_stream->start_time != AV_NOPTS_VALUE) {
                const double offset = this->input_stream->start_time * av_q2d(this->input_stream->time_base)
                    - static_cast<double>(this->origin) / this->encoder->sample_rate;
                this->total_seconds += std::max(0.0, offset);
            }
        } else if (this->input->duration != AV_NOPTS_VALUE && this->input->duration > 0) {
            this->total_seconds = static_cast<double>(this->input->duration) / AV_TIME_BASE;
        }
    }

    int write_header() {
        // Reserve a Duration element even when the input has no duration metadata.
        // The caller patches this header with the exact sample duration for the completed Blob.
        this->output->duration = this->total_seconds > 0
            ? static_cast<int64_t>(std::llround(this->total_seconds * AV_TIME_BASE)) : AV_TIME_BASE;
        AVDictionary* options = nullptr;
        av_dict_set(&options, "cluster_time_limit", cluster_time_limit_ms, 0);
        const int result = avformat_write_header(this->output, &options);
        av_dict_free(&options);
        if (result < 0) return fail("Could not write audio output header", result);
        avio_flush(this->output->pb);
        return 0;
    }

    int allocate_buffers() {
        this->fifo = av_audio_fifo_alloc(this->encoder->sample_fmt, this->encoder->ch_layout.nb_channels,
            this->encoder->frame_size);
        this->decoded = av_frame_alloc();
        this->converted = av_frame_alloc();
        this->encoded = av_frame_alloc();
        this->packet = av_packet_alloc();
        this->encoded_packet = av_packet_alloc();
        if (this->fifo == nullptr || this->decoded == nullptr || this->converted == nullptr ||
            this->encoded == nullptr || this->packet == nullptr || this->encoded_packet == nullptr) {
            return fail("Unable to allocate audio frames", AVERROR(ENOMEM));
        }
        return 0;
    }

    int open(InputBuffer* input_buffer, int track_index) {
        if (open_input(input_buffer) < 0 || select_track(track_index) < 0 || open_decoder() < 0 || open_output() < 0) {
            return -1;
        }
        if (allocate_buffers() < 0 || read_first_audio_packet() < 0) return -1;
        resolve_timeline();
        return write_header();
    }

    int process_packets() {
        int result = 0;
        // The first audio packet was retained while resolving the media origin.
        do {
            if (this->packet->stream_index == this->input_stream->index) {
                result = avcodec_send_packet(this->decoder, this->packet);
                if (result < 0) result = tolerate_decode_error(result);
                if (result >= 0) result = receive_frames();
            }
            av_packet_unref(this->packet);
            if (result < 0) return fail("Could not transcode audio", result);
        } while ((result = av_read_frame(this->input, this->packet)) >= 0);
        return result == AVERROR_EOF ? 0 : fail("Could not read audio packets", result);
    }

    int finalize() {
        const int result = finish();
        if (result < 0) return fail("Could not finish audio output", result);
        avio_flush(this->output->pb);
        if (this->output->pb->error < 0) return fail("Could not deliver audio output", this->output->pb->error);
        if (this->next_pts == 0) return fail("The audio track contains no decodable audio", AVERROR_INVALIDDATA);
        return 0;
    }
};

inline double transcode_audio(double input_size, int track_index) noexcept {
    if (!std::isfinite(input_size) || input_size <= 0 || input_size > javascript_max_safe_integer ||
        std::floor(input_size) != input_size || track_index < 0) {
        return fail("Invalid audio transcode arguments", AVERROR(EINVAL));
    }
    last_error.clear();
    // Declared before the transcoder: its input context reads from this buffer until destruction.
    InputBuffer input_buffer{static_cast<int64_t>(input_size)};
    AudioTranscoder transcode;
    if (transcode.open(&input_buffer, track_index) < 0) return -1;
    if (transcode.process_packets() < 0 || transcode.finalize() < 0) return -1;
    return static_cast<double>(transcode.next_pts) / transcode.encoder->sample_rate;
}

} // namespace asb::detail

#endif
