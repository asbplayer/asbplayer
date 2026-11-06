#include "asb-build-config.hpp"
#include "include/asb_ffmpeg.h"
#include "json.hpp"

extern "C" {
#include <libavutil/avutil.h>
}

#include <string>

namespace {
std::string runtime_info() {
    std::string output = "{\"runtimeVersion\":\"" ASB_RUNTIME_VERSION "\",\"ffmpegVersion\":";
    asb::append_json_string(output, av_version_info());
    output += ",\"ffmpegConfiguration\":";
    asb::append_json_string(output, avutil_configuration());
    output += ",\"ffmpegLicense\":";
    asb::append_json_string(output, avutil_license());
    output += ",\"linkedLibraries\":[\"libavutil\"],\"libraries\":[{\"name\":\"libavutil\",\"version\":" +
              std::to_string(avutil_version()) + ",\"configuration\":";
    asb::append_json_string(output, avutil_configuration());
    output += ",\"license\":";
    asb::append_json_string(output, avutil_license());
    output += "}],\"operations\":[\"inspect\"]}";
    return output;
}
} // namespace

extern "C" const char* asb_runtime_info_json(void) noexcept {
    static const std::string info = runtime_info();
    return info.c_str();
}
