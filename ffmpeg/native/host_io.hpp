#ifndef ASB_HOST_IO_HPP
#define ASB_HOST_IO_HPP

#include <algorithm>
#include <cstdint>
#include <cstdio>

extern "C" {
#include <libavformat/avio.h>
#include <libavutil/error.h>

int asb_read_input(double offset, uint8_t* buffer, int length);
int asb_write_output(const uint8_t* buffer, int length);
}

namespace asb::detail {

inline constexpr int io_buffer_bytes = 32 * 1024;

inline int write_output(void*, const uint8_t* buffer, int length) {
    return asb_write_output(buffer, length) == length ? length : AVERROR(EIO);
}

struct InputBuffer {
    int64_t size;
    int64_t position = 0;
};

inline int read_input(void* opaque, uint8_t* buffer, int buffer_size) {
    auto* input = static_cast<InputBuffer*>(opaque);
    if (input->position >= input->size) return AVERROR_EOF;
    const int count = static_cast<int>(std::min<int64_t>(io_buffer_bytes, std::min<int64_t>(buffer_size, input->size - input->position)));
    const int read = asb_read_input(static_cast<double>(input->position), buffer, count);
    if (read <= 0 || read > count) return AVERROR(EIO);
    input->position += read;
    return read;
}

inline int64_t seek_input(void* opaque, int64_t offset, int whence) {
    auto* input = static_cast<InputBuffer*>(opaque);
    const int mode = whence & ~AVSEEK_FORCE;
    if (mode == AVSEEK_SIZE) return input->size;
    int64_t base = 0;
    if (mode == SEEK_CUR) base = input->position;
    else if (mode == SEEK_END) base = input->size;
    else if (mode != SEEK_SET) return AVERROR(EINVAL);
    if (offset < -base || offset > input->size - base) return AVERROR(EINVAL);
    input->position = base + offset;
    return input->position;
}

} // namespace asb::detail

#endif
