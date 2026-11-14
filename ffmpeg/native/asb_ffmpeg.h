#ifndef ASB_FFMPEG_H
#define ASB_FFMPEG_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
#define ASB_NOEXCEPT noexcept
extern "C" {
#else
#define ASB_NOEXCEPT
#endif

const char* asb_runtime_info_json(void) ASB_NOEXCEPT;

const char* asb_extract_subtitles(double input_size, const uint32_t* track_indexes, size_t count) ASB_NOEXCEPT;

double asb_transcode_audio(double input_size, int track_index) ASB_NOEXCEPT;
const char* asb_last_error(void) ASB_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef ASB_NOEXCEPT

#endif
