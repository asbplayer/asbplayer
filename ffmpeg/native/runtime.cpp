#include "asb_ffmpeg.h"
#include "audio_transcoder.hpp"
#include "error.hpp"
#include "runtime_info.hpp"

#include <emscripten.h>

extern "C" {
#include <libavutil/log.h>
}

// The worker owns a bounded File/Blob reader. Offsets stay doubles at the JS boundary,
// preserving safe integer positions beyond 4 GiB without allocating the input in WASM.
EM_JS(int, asb_read_input, (double offset, uint8_t* buffer, int length), {
    return Module['asbReadInput'](offset, buffer, length);
});

// Output is copied and transferred to the caller as it is written. The muxer never
// seeks or retains a complete output in the WASM heap.
EM_JS(int, asb_write_output, (const uint8_t* buffer, int length), {
    return Module['asbWriteOutput'](buffer, length);
});

// Diagnostics are buffered by the bridge and travel with the terminal reply.
// Logging must never throw back into native conversion or resource cleanup.
EM_JS(void, asb_emit_diagnostic, (int source, int level, const char* message), {
    try {
        Module['asbDiagnostic'](
            source === 0 ? 'ffmpeg' : 'runtime',
            ['trace', 'warning', 'error'][level],
            UTF8ToString(message)
        );
    } catch (error) {}
});

namespace {

void ffmpeg_diagnostic(void* context, int level, const char* format, va_list args) {
    if (level > AV_LOG_WARNING) return;
    char message[1024] = {};
    int print_prefix = 1;
    av_log_format_line2(context, level, format, args, message, sizeof(message), &print_prefix);
    const auto severity = level <= AV_LOG_ERROR ? asb::detail::DiagnosticLevel::error
                                              : asb::detail::DiagnosticLevel::warning;
    asb_emit_diagnostic(static_cast<int>(asb::detail::DiagnosticSource::ffmpeg), static_cast<int>(severity), message);
}

} // namespace

extern "C" const char* asb_runtime_info_json(void) noexcept {
    return asb::detail::runtime_info_json();
}

extern "C" const char* asb_last_error(void) noexcept { return asb::detail::last_error.c_str(); }

extern "C" double asb_transcode_audio(double input_size, int track_index) noexcept {
    av_log_set_callback(ffmpeg_diagnostic);
    return asb::detail::transcode_audio(input_size, track_index);
}
