#ifndef ASB_AUDIO_TRANSCODER_HPP
#define ASB_AUDIO_TRANSCODER_HPP

#include "error.hpp"
#include "host_io.hpp"
#include "diagnostics.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>

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
        if (decoder_errors > 0) {
            std::snprintf(message, sizeof(message), "Tolerated %lld audio decoder errors",
                          static_cast<long long>(decoder_errors));
            runtime_diagnostic(DiagnosticLevel::warning, message);
        }
        if (silence_samples > 0 || trimmed_samples > 0) {
            std::snprintf(message, sizeof(message),
                          "Audio timeline at 48000 Hz: inserted %lld silence samples, trimmed %lld samples",
                          static_cast<long long>(silence_samples), static_cast<long long>(trimmed_samples));
            runtime_diagnostic(DiagnosticLevel::trace, message);
        }
        if (output != nullptr && output->pb != nullptr) {
            av_freep(&output->pb->buffer);
            avio_context_free(&output->pb);
        }
        av_packet_free(&encoded_packet);
        av_packet_free(&packet);
        av_frame_free(&encoded);
        av_frame_free(&converted);
        av_frame_free(&decoded);
        av_audio_fifo_free(fifo);
        swr_free(&resampler);
        av_channel_layout_uninit(&resampler_layout);
        avcodec_free_context(&encoder);
        avcodec_free_context(&decoder);
        avformat_free_context(output);
        if (input != nullptr) {
            input->pb = nullptr;
            avformat_close_input(&input);
        }
        if (input_io != nullptr) {
            av_freep(&input_io->buffer);
            avio_context_free(&input_io);
        }
    }

    int drain_encoder() {
        int result;
        while ((result = avcodec_receive_packet(encoder, encoded_packet)) >= 0) {
            av_packet_rescale_ts(encoded_packet, encoder->time_base, output->streams[0]->time_base);
            encoded_packet->stream_index = 0;
            result = av_interleaved_write_frame(output, encoded_packet);
            av_packet_unref(encoded_packet);
            if (result < 0) return result;
        }
        return result == AVERROR(EAGAIN) || result == AVERROR_EOF ? 0 : result;
    }

    int encode_pending(bool final = false) {
        while (av_audio_fifo_size(fifo) >= encoder->frame_size || (final && av_audio_fifo_size(fifo) > 0)) {
            const int samples = std::min(av_audio_fifo_size(fifo), encoder->frame_size);
            int result = prepare_frame(encoded, encoder, samples);
            if (result < 0) return result;
            if (av_audio_fifo_read(fifo, reinterpret_cast<void**>(encoded->extended_data), samples) != samples)
                return AVERROR(EIO);
            encoded->pts = next_pts;
            next_pts += samples;
            result = avcodec_send_frame(encoder, encoded);
            if (result < 0) return result;
            result = drain_encoder();
            if (result < 0) return result;
        }
        return 0;
    }

    int append_samples(AVFrame* frame, int offset, int count) {
        if (count == 0) return 0;
        const int channels = encoder->ch_layout.nb_channels;
        const bool planar = av_sample_fmt_is_planar(encoder->sample_fmt);
        const int stride = av_get_bytes_per_sample(encoder->sample_fmt) * (planar ? 1 : channels);
        uint8_t* planes[AV_NUM_DATA_POINTERS] = {};
        for (int channel = 0; channel < (planar ? channels : 1); ++channel)
            planes[channel] = frame->extended_data[channel] + offset * stride;
        int result = av_audio_fifo_realloc(fifo, av_audio_fifo_size(fifo) + count);
        if (result < 0) return result;
        if (av_audio_fifo_write(fifo, reinterpret_cast<void**>(planes), count) != count) return AVERROR(EIO);
        written_samples += count;
        return encode_pending();
    }

    int append_silence(int64_t samples) {
        while (samples > 0) {
            const int count = static_cast<int>(std::min<int64_t>(samples, encoder->frame_size));
            int result = prepare_frame(encoded, encoder, count);
            if (result < 0) return result;
            result = av_samples_set_silence(encoded->extended_data, 0, count, encoder->ch_layout.nb_channels,
                                           encoder->sample_fmt);
            if (result < 0) return result;
            const int64_t before = written_samples;
            result = append_samples(encoded, 0, count);
            silence_samples += written_samples - before;
            if (result < 0) return result;
            samples -= count;
        }
        return 0;
    }

    int append_converted(int samples, int64_t target) {
        // Reconcile packet timestamps with the media timeline. Allow one timestamp tick of
        // rounding (e.g. Matroska milliseconds), while retaining real offsets and gaps.
        const int64_t tolerance = std::max<int64_t>(1, av_rescale_q(1, input_stream->time_base, encoder->time_base));
        // Keep the sample clock through container timestamp rounding, including
        // DTS's 512-sample frames at 48 kHz and TrueHD/MLP's shorter frames.
        if (source_position_known && std::abs(target - source_position) <= tolerance) target = source_position;
        source_position = target + samples;
        source_position_known = true;
        const int64_t difference = target - written_samples;
        if (difference > tolerance) {
            const int result = append_silence(difference);
            if (result < 0) return result;
        }
        // Trim samples preceding the media origin, even within one timestamp tick.
        const int skip = target < 0 || difference < -tolerance
            ? static_cast<int>(std::min<int64_t>(-difference, samples)) : 0;
        trimmed_samples += skip;
        return append_samples(converted, skip, samples - skip);
    }

    int drain_resampler() {
        if (resampler == nullptr) return 0;
        while (true) {
            const int capacity = static_cast<int>(swr_get_delay(resampler, encoder->sample_rate));
            if (capacity <= 0) return 0;
            int result = prepare_frame(converted, encoder, capacity);
            if (result < 0) return result;
            const int samples = swr_convert(resampler, converted->extended_data, capacity, nullptr, 0);
            if (samples <= 0) return samples;
            result = append_converted(samples, source_position_known ? source_position : written_samples);
            if (result < 0) return result;
        }
    }

    int configure_resampler() {
        if (resampler != nullptr && resampler_sample_rate == decoded->sample_rate &&
            resampler_format == decoded->format && av_channel_layout_compare(&resampler_layout, &decoded->ch_layout) == 0)
            return 0;

        // Drain the previous format before replacing its resampler, retaining its sample clock.
        int result = drain_resampler();
        if (result < 0) return result;
        swr_free(&resampler);
        av_channel_layout_uninit(&resampler_layout);
        result = av_channel_layout_copy(&resampler_layout, &decoded->ch_layout);
        if (result < 0) return result;
        resampler_format = static_cast<AVSampleFormat>(decoded->format);
        resampler_sample_rate = decoded->sample_rate;
        char layout[128] = {};
        av_channel_layout_describe(&resampler_layout, layout, sizeof(layout));
        const char* sample_format = av_get_sample_fmt_name(resampler_format);
        char message[512] = {};
        std::snprintf(message, sizeof(message),
                      "Decoded audio format: codec=%s, sample_rate=%d, sample_format=%s, channel_layout=%s",
                      avcodec_get_name(decoder->codec_id), resampler_sample_rate,
                      sample_format != nullptr ? sample_format : "unknown", layout);
        runtime_diagnostic(DiagnosticLevel::trace, message);
        result = swr_alloc_set_opts2(&resampler, &encoder->ch_layout, encoder->sample_fmt, encoder->sample_rate,
            &resampler_layout, resampler_format, resampler_sample_rate, 0, nullptr);
        return result < 0 ? result : swr_init(resampler);
    }

    int convert_frame() {
        int result = configure_resampler();
        if (result < 0) return result;
        const int64_t delay = swr_get_delay(resampler, resampler_sample_rate);
        const int capacity = static_cast<int>(av_rescale_rnd(delay + decoded->nb_samples,
            encoder->sample_rate, resampler_sample_rate, AV_ROUND_UP));
        result = prepare_frame(converted, encoder, capacity);
        if (result < 0) return result;
        const int samples = swr_convert(resampler, converted->extended_data, capacity,
            const_cast<const uint8_t**>(decoded->extended_data), decoded->nb_samples);
        if (samples <= 0) return samples;

        int64_t target = source_position_known ? source_position : written_samples;
        if (decoded->best_effort_timestamp != AV_NOPTS_VALUE) {
            target = av_rescale_q(decoded->best_effort_timestamp, input_stream->time_base, encoder->time_base) - origin
                - av_rescale_q(delay, AVRational{1, resampler_sample_rate}, encoder->time_base);
        }
        return append_converted(samples, target);
    }

    // Like the ffmpeg CLI, skip corrupt input: the next frame's timestamp fills its gap with silence.
    int tolerate_decode_error(int result) {
        if (result == AVERROR(ENOMEM)) return result;
        ++decoder_errors;
        return 0;
    }

    int receive_frames() {
        while (true) {
            int result = avcodec_receive_frame(decoder, decoded);
            if (result == AVERROR(EAGAIN) || result == AVERROR_EOF) return 0;
            result = result < 0 ? tolerate_decode_error(result) : convert_frame();
            if (result < 0) return result;
        }
    }

    int finish() {
        int result = avcodec_send_packet(decoder, nullptr);
        if (result < 0 && result != AVERROR_EOF) return result;
        result = receive_frames();
        if (result < 0) return result;
        result = drain_resampler();
        if (result < 0) return result;
        result = encode_pending(true);
        if (result < 0) return result;
        result = avcodec_send_frame(encoder, nullptr);
        if (result < 0) return result;
        result = drain_encoder();
        return result < 0 ? result : av_write_trailer(output);
    }
    // Each stage returns 0 or the result of fail(), leaving partially created resources to the destructor.

    int open_input(InputBuffer* input_buffer) {
        auto* io_buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (io_buffer == nullptr) return fail("Unable to allocate FFmpeg input buffer", AVERROR(ENOMEM));
        input_io = avio_alloc_context(io_buffer, io_buffer_bytes, 0, input_buffer, read_input, nullptr, seek_input);
        if (input_io == nullptr) {
            av_free(io_buffer);
            return fail("Unable to create FFmpeg input context", AVERROR(ENOMEM));
        }
        input = avformat_alloc_context();
        if (input == nullptr) return fail("Unable to allocate FFmpeg input format", AVERROR(ENOMEM));
        input->pb = input_io;
        input->flags |= AVFMT_FLAG_CUSTOM_IO;
        const int result = avformat_open_input(&input, nullptr, nullptr, nullptr);
        return result < 0 ? fail("Could not open input", result) : 0;
    }

    int select_track(int track_index) {
        int audio_count = 0;
        for (unsigned int index = 0; index < input->nb_streams; ++index) {
            auto* stream = input->streams[index];
            if (stream->codecpar->codec_type == AVMEDIA_TYPE_AUDIO && audio_count++ == track_index) {
                input_stream = stream;
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
        if (input_stream == nullptr) return fail("The requested audio track does not exist", AVERROR(EINVAL));
        const int result = avformat_find_stream_info(input, nullptr);
        return result < 0 ? fail("Could not read input stream information", result) : 0;
    }

    int open_decoder() {
        const auto* codec = avcodec_find_decoder(input_stream->codecpar->codec_id);
        if (codec == nullptr) return fail("The selected audio codec is not available", AVERROR_DECODER_NOT_FOUND);
        decoder = avcodec_alloc_context3(codec);
        if (decoder == nullptr) return fail("Unable to allocate the audio decoder", AVERROR(ENOMEM));
        int result = avcodec_parameters_to_context(decoder, input_stream->codecpar);
        if (result < 0) return fail("Could not configure audio decoder", result);
        decoder->pkt_timebase = input_stream->time_base;
        result = avcodec_open2(decoder, codec, nullptr);
        return result < 0 ? fail("Could not open audio decoder", result) : 0;
    }

    int open_output() {
        int result = avformat_alloc_output_context2(&output, nullptr, "webm", nullptr);
        if (result < 0 || output == nullptr)
            return fail("Could not create audio output", result < 0 ? result : AVERROR(ENOMEM));
        const auto* codec = avcodec_find_encoder_by_name("libopus");
        if (codec == nullptr) return fail("The audio encoder is not available", AVERROR_ENCODER_NOT_FOUND);
        auto* output_stream = avformat_new_stream(output, nullptr);
        encoder = avcodec_alloc_context3(codec);
        if (output_stream == nullptr || encoder == nullptr)
            return fail("Unable to allocate the audio encoder", AVERROR(ENOMEM));
        encoder->codec_type = AVMEDIA_TYPE_AUDIO;
        encoder->codec_id = AV_CODEC_ID_OPUS;
        encoder->sample_rate = opus_sample_rate;
        encoder->sample_fmt = AV_SAMPLE_FMT_FLT;
        encoder->bit_rate = opus_bit_rate;
        encoder->compression_level = opus_compression_level;
        av_channel_layout_default(&encoder->ch_layout, output_channels);
        encoder->time_base = AVRational{1, encoder->sample_rate};
        if (output->oformat->flags & AVFMT_GLOBALHEADER) encoder->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
        result = avcodec_open2(encoder, codec, nullptr);
        if (result < 0) return fail("Could not open audio encoder", result);
        result = avcodec_parameters_from_context(output_stream->codecpar, encoder);
        if (result < 0) return fail("Could not configure audio output", result);
        output_stream->time_base = encoder->time_base;
        auto* output_buffer = static_cast<uint8_t*>(av_malloc(io_buffer_bytes));
        if (output_buffer == nullptr) return fail("Could not allocate audio output buffer", AVERROR(ENOMEM));
        output->pb = avio_alloc_context(output_buffer, io_buffer_bytes, 1, nullptr, nullptr, write_output, nullptr);
        if (output->pb == nullptr) {
            av_free(output_buffer);
            return fail("Could not create audio output context", AVERROR(ENOMEM));
        }
        output->flags |= AVFMT_FLAG_CUSTOM_IO | AVFMT_FLAG_FLUSH_PACKETS;
        return 0;
    }

    int read_first_audio_packet() {
        // Browser video retains positive presentation timestamps. Keep the origin at
        // zero in that case so the audio includes the corresponding leading silence.
        if (input->start_time != AV_NOPTS_VALUE)
            origin = std::min<int64_t>(0, av_rescale_q(input->start_time, AV_TIME_BASE_Q, encoder->time_base));

        int result;
        while ((result = av_read_frame(input, packet)) >= 0) {
            if (packet->stream_index == input_stream->index) {
                for (unsigned int index = 0; index < input->nb_streams; ++index) {
                    auto* stream = input->streams[index];
                    if (stream != input_stream) stream->discard = AVDISCARD_ALL;
                }
                return 0;
            }
            const auto* stream = input->streams[packet->stream_index];
            // Without video parsers, FFmpeg can leave a video's start time unset.
            // Its leading packet timestamps still anchor delayed audio to the video timeline.
            // A known start time already accounts for MP4 edits. Earlier discarded
            // video packets are decode preroll and must not move that playback origin.
            if (stream->codecpar->codec_type == AVMEDIA_TYPE_VIDEO && stream->start_time == AV_NOPTS_VALUE &&
                !(packet->flags & AV_PKT_FLAG_DISCARD) && packet->pts != AV_NOPTS_VALUE)
                origin = std::min(origin, av_rescale_q(packet->pts, stream->time_base, encoder->time_base));
            av_packet_unref(packet);
        }
        return fail("Could not read the first audio packet", result);
    }

    void resolve_timeline() {
        if (input_stream->duration != AV_NOPTS_VALUE && input_stream->duration > 0) {
            total_seconds = input_stream->duration * av_q2d(input_stream->time_base);
            if (input_stream->start_time != AV_NOPTS_VALUE) {
                const double offset = input_stream->start_time * av_q2d(input_stream->time_base)
                    - static_cast<double>(origin) / encoder->sample_rate;
                total_seconds += std::max(0.0, offset);
            }
        } else if (input->duration != AV_NOPTS_VALUE && input->duration > 0) {
            total_seconds = static_cast<double>(input->duration) / AV_TIME_BASE;
        }
    }

    int write_header() {
        // Reserve a Duration element even when the input has no duration metadata.
        // The caller patches this header with the exact sample duration for the completed Blob.
        output->duration = total_seconds > 0 ? static_cast<int64_t>(std::llround(total_seconds * AV_TIME_BASE)) : AV_TIME_BASE;
        AVDictionary* options = nullptr;
        av_dict_set(&options, "cluster_time_limit", cluster_time_limit_ms, 0);
        const int result = avformat_write_header(output, &options);
        av_dict_free(&options);
        if (result < 0) return fail("Could not write audio output header", result);
        avio_flush(output->pb);
        return 0;
    }

    int allocate_buffers() {
        fifo = av_audio_fifo_alloc(encoder->sample_fmt, encoder->ch_layout.nb_channels, encoder->frame_size);
        decoded = av_frame_alloc();
        converted = av_frame_alloc();
        encoded = av_frame_alloc();
        packet = av_packet_alloc();
        encoded_packet = av_packet_alloc();
        if (fifo == nullptr || decoded == nullptr || converted == nullptr ||
            encoded == nullptr || packet == nullptr || encoded_packet == nullptr)
            return fail("Unable to allocate audio frames", AVERROR(ENOMEM));
        return 0;
    }

    int open(InputBuffer* input_buffer, int track_index) {
        if (open_input(input_buffer) < 0 || select_track(track_index) < 0 || open_decoder() < 0 || open_output() < 0)
            return -1;
        if (allocate_buffers() < 0 || read_first_audio_packet() < 0) return -1;
        resolve_timeline();
        return write_header();
    }

    int process_packets() {
        int result = 0;
        // The first audio packet was retained while resolving the media origin.
        do {
            if (packet->stream_index == input_stream->index) {
                result = avcodec_send_packet(decoder, packet);
                if (result < 0) result = tolerate_decode_error(result);
                if (result >= 0) result = receive_frames();
            }
            av_packet_unref(packet);
            if (result < 0) return fail("Could not transcode audio", result);
        } while ((result = av_read_frame(input, packet)) >= 0);
        return result == AVERROR_EOF ? 0 : fail("Could not read audio packets", result);
    }

    int finalize() {
        const int result = finish();
        if (result < 0) return fail("Could not finish audio output", result);
        avio_flush(output->pb);
        if (output->pb->error < 0) return fail("Could not deliver audio output", output->pb->error);
        if (next_pts == 0) return fail("The audio track contains no decodable audio", AVERROR_INVALIDDATA);
        return 0;
    }
};

inline double transcode_audio(double input_size, int track_index) noexcept {
    if (!std::isfinite(input_size) || input_size <= 0 || input_size > javascript_max_safe_integer ||
        std::floor(input_size) != input_size || track_index < 0)
        return fail("Invalid audio transcode arguments", AVERROR(EINVAL));
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
