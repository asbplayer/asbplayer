#ifndef ASB_FFMPEG_H
#define ASB_FFMPEG_H

#ifdef __cplusplus
#define ASB_NOEXCEPT noexcept
extern "C" {
#else
#define ASB_NOEXCEPT
#endif

const char* asb_runtime_info_json(void) ASB_NOEXCEPT;

#ifdef __cplusplus
}
#endif
#undef ASB_NOEXCEPT

#endif
