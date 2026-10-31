#ifndef ASB_ERROR_HPP
#define ASB_ERROR_HPP

#include <string>

extern "C" {
#include <libavutil/error.h>
}

namespace asb::detail {

inline std::string last_error;

inline int fail(const char* operation, int error) {
    char buffer[AV_ERROR_MAX_STRING_SIZE] = {};
    av_strerror(error, buffer, sizeof(buffer));
    last_error = std::string(operation) + ": " + buffer;
    return -1;
}

} // namespace asb::detail

#endif
