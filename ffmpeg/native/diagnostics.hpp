#ifndef ASB_DIAGNOSTICS_HPP
#define ASB_DIAGNOSTICS_HPP

extern "C" void asb_emit_diagnostic(int source, int level, const char* message);

namespace asb::detail {

enum class DiagnosticSource { ffmpeg, runtime };
enum class DiagnosticLevel { trace, warning, error };

inline void runtime_diagnostic(DiagnosticLevel level, const char* message) {
    asb_emit_diagnostic(static_cast<int>(DiagnosticSource::runtime), static_cast<int>(level), message);
}

} // namespace asb::detail

#endif
