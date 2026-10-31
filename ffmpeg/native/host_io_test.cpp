#include "host_io.hpp"

#include <array>
#include <iostream>
#include <limits>
#include <optional>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, const char* message) {
    if (!condition) {
        std::cerr << message << '\n';
        ++failures;
    }
}

// A bounded, synthetic file avoids allocating gigabytes for the offset tests.
int64_t file_size = 0;
int maximum_host_read = std::numeric_limits<int>::max();
std::optional<int> forced_read_result;
int read_calls = 0;
double last_read_offset = 0;
int last_read_length = 0;
std::optional<int> forced_write_result;
std::vector<uint8_t> output;

uint8_t file_byte(int64_t position) {
    return static_cast<uint8_t>(position ^ (position >> 32));
}

void test_seeks() {
    using asb::detail::seek_input;
    constexpr int64_t large_offset = int64_t{1} << 32;
    asb::detail::InputBuffer input{large_offset + 16};

    check(seek_input(&input, large_offset + 2, SEEK_SET) == large_offset + 2, "SEEK_SET must preserve 64-bit offsets");
    check(seek_input(&input, 3, SEEK_CUR | AVSEEK_FORCE) == large_offset + 5, "SEEK_CUR must support AVSEEK_FORCE");
    check(seek_input(&input, -2, SEEK_CUR) == large_offset + 3, "SEEK_CUR must support backwards seeks");
    check(seek_input(&input, -1, SEEK_END) == input.size - 1, "SEEK_END must use the file size");

    const int64_t position = input.position;
    check(seek_input(&input, 0, AVSEEK_SIZE | AVSEEK_FORCE) == input.size, "AVSEEK_SIZE must return the file size");
    check(input.position == position, "A size query must not move the reader");

    for (const int mode : {SEEK_SET, SEEK_CUR, SEEK_END}) {
        check(seek_input(&input, std::numeric_limits<int64_t>::min(), mode) == AVERROR(EINVAL),
              "A seek before the file must fail without overflowing");
        check(input.position == position, "A rejected backwards seek must not move the reader");
        check(seek_input(&input, std::numeric_limits<int64_t>::max(), mode) == AVERROR(EINVAL),
              "A seek past the file must fail without overflowing");
        check(input.position == position, "A rejected forwards seek must not move the reader");
    }
    check(seek_input(&input, 0, -1) == AVERROR(EINVAL), "An unsupported seek mode must fail");
    check(input.position == position, "An unsupported seek mode must not move the reader");
    check(seek_input(&input, 0, SEEK_SET) == 0, "Seeking to the start must succeed");
    check(seek_input(&input, -1, SEEK_CUR) == AVERROR(EINVAL), "Seeking one byte before the start must fail");
    check(input.position == 0, "A seek before the start must preserve position zero");
    check(seek_input(&input, 0, SEEK_END | AVSEEK_FORCE) == input.size, "Seeking exactly to EOF must succeed");
    check(seek_input(&input, 1, SEEK_CUR) == AVERROR(EINVAL), "Seeking one byte beyond EOF must fail");
    check(input.position == input.size, "A seek beyond EOF must preserve the EOF position");

    asb::detail::InputBuffer empty{0};
    check(seek_input(&empty, 0, SEEK_END) == 0, "An empty file must allow seeking to its EOF");
}

void test_reads() {
    using asb::detail::read_input;
    using asb::detail::io_buffer_bytes;
    std::array<uint8_t, io_buffer_bytes * 2> buffer{};
    file_size = io_buffer_bytes + 2;
    asb::detail::InputBuffer input{file_size};

    check(read_input(&input, buffer.data(), buffer.size()) == io_buffer_bytes,
          "Reads must obey the native buffer limit");
    check(last_read_length == io_buffer_bytes, "The host read request must also obey the native buffer limit");
    check(input.position == io_buffer_bytes, "A successful read must advance the position");
    check(buffer.front() == file_byte(0) && buffer[io_buffer_bytes - 1] == file_byte(io_buffer_bytes - 1),
          "A read must deliver the host file bytes");

    check(read_input(&input, buffer.data(), 1) == 1, "A smaller destination must limit the host read");
    check(last_read_length == 1 && input.position == file_size - 1, "A small read must advance only by its size");
    check(read_input(&input, buffer.data(), buffer.size()) == 1, "A read near EOF must be clipped to remaining bytes");
    check(last_read_length == 1 && input.position == file_size, "The final read must stop exactly at EOF");
    const int calls_at_eof = read_calls;
    check(read_input(&input, buffer.data(), buffer.size()) == AVERROR_EOF, "A read at EOF must return AVERROR_EOF");
    asb::detail::InputBuffer empty{0};
    check(read_input(&empty, buffer.data(), 1) == AVERROR_EOF, "An empty input must return AVERROR_EOF");
    check(read_calls == calls_at_eof, "EOF reads must not touch the host");

    file_size = 10;
    input = {file_size};
    maximum_host_read = 2;
    check(read_input(&input, buffer.data(), 5) == 2 && input.position == 2,
          "A short read must advance by bytes received");
    check(read_input(&input, buffer.data(), 5) == 2 && input.position == 4,
          "Reading after a short read must continue correctly");
    check(buffer[0] == file_byte(2) && buffer[1] == file_byte(3), "Short reads must not skip input bytes");
    maximum_host_read = std::numeric_limits<int>::max();

    for (const int result : {-1, 0, 6}) {
        forced_read_result = result;
        check(read_input(&input, buffer.data(), 5) == AVERROR(EIO),
              "Failed, empty or oversized host reads must report EIO");
        check(input.position == 4, "An unsuccessful host read must not advance the position");
    }
    forced_read_result.reset();
    check(read_input(&input, buffer.data(), 5) == 5 && buffer[0] == file_byte(4),
          "A read after a host failure must resume at the same position");

    constexpr int64_t large_offset = (int64_t{1} << 32) + 1;
    file_size = large_offset + 2;
    input = {file_size, large_offset};
    check(read_input(&input, buffer.data(), 8) == 2, "A read above 4 GiB must still clip at EOF");
    check(last_read_offset == static_cast<double>(large_offset),
          "The JavaScript offset must not be truncated to 32 bits");
    check(buffer[0] == file_byte(large_offset) && buffer[1] == file_byte(large_offset + 1),
          "A large-offset read must deliver the requested bytes");
    check(input.position == file_size, "A large-offset read must preserve its 64-bit position");
}

void test_writes() {
    const std::array<uint8_t, 2> buffer{7, 9};
    check(asb::detail::write_output(nullptr, buffer.data(), buffer.size()) == 2, "A complete host write must succeed");
    check(output == std::vector<uint8_t>({7, 9}), "The host must receive the output bytes");
    for (const int result : {-1, 0, 1}) {
        forced_write_result = result;
        check(asb::detail::write_output(nullptr, buffer.data(), buffer.size()) == AVERROR(EIO),
              "Failed or short output writes must report EIO");
    }
}

} // namespace

extern "C" int asb_read_input(double offset, uint8_t* buffer, int length) {
    ++read_calls;
    last_read_offset = offset;
    last_read_length = length;
    if (forced_read_result.has_value()) return *forced_read_result;
    const auto position = static_cast<int64_t>(offset);
    const int count = static_cast<int>(std::min<int64_t>({length, maximum_host_read, file_size - position}));
    for (int index = 0; index < count; ++index) buffer[index] = file_byte(position + index);
    return count;
}

extern "C" int asb_write_output(const uint8_t* buffer, int length) {
    const int count = forced_write_result.value_or(length);
    if (count > 0 && count <= length) output.insert(output.end(), buffer, buffer + count);
    return count;
}

int main() {
    test_seeks();
    test_reads();
    test_writes();
    return failures == 0 ? 0 : 1;
}
