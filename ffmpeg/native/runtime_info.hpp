#ifndef ASB_RUNTIME_INFO_HPP
#define ASB_RUNTIME_INFO_HPP

#include "asb-build-config.hpp"
#include "json.hpp"

#include <string>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>
#include <libswresample/swresample.h>
}

namespace asb::detail {

inline std::string runtime_info() {
    std::string output = "{\"runtimeVersion\":\"" ASB_RUNTIME_VERSION "\",\"ffmpegVersion\":";
    asb::append_json_string(output, av_version_info());
    output += ",\"ffmpegConfiguration\":";
    asb::append_json_string(output, avutil_configuration());
    output += ",\"ffmpegLicense\":";
    asb::append_json_string(output, avutil_license());
    output += ",\"linkedLibraries\":[\"libavutil\",\"libavcodec\",\"libavformat\",\"libswresample\"],\"libraries\":[";
    output += "{\"name\":\"libavutil\",\"version\":" + std::to_string(avutil_version()) + ",\"configuration\":";
    asb::append_json_string(output, avutil_configuration());
    output += ",\"license\":";
    asb::append_json_string(output, avutil_license());
    output += "},{\"name\":\"libavcodec\",\"version\":" + std::to_string(avcodec_version()) + ",\"configuration\":";
    asb::append_json_string(output, avcodec_configuration());
    output += ",\"license\":";
    asb::append_json_string(output, avcodec_license());
    output += "},{\"name\":\"libavformat\",\"version\":" + std::to_string(avformat_version()) + ",\"configuration\":";
    asb::append_json_string(output, avformat_configuration());
    output += ",\"license\":";
    asb::append_json_string(output, avformat_license());
    output += "},{\"name\":\"libswresample\",\"version\":" + std::to_string(swresample_version()) + ",\"configuration\":";
    asb::append_json_string(output, swresample_configuration());
    output += ",\"license\":";
    asb::append_json_string(output, swresample_license());
    output += "}],\"operations\":[\"inspect\",\"transcodeAudio\"]}";
    return output;
}

inline const char* runtime_info_json() {
    static const std::string info = runtime_info();
    return info.c_str();
}

} // namespace asb::detail

#endif
