#ifndef ASB_JSON_HPP
#define ASB_JSON_HPP

#include <string>
#include <string_view>

namespace asb {

inline void append_json_string(std::string& output, std::string_view value) {
    static constexpr char hex[] = "0123456789abcdef";
    output.push_back('"');
    for (const unsigned char character : value) {
        switch (character) {
            case '"': output += "\\\""; break;
            case '\\': output += "\\\\"; break;
            case '\b': output += "\\b"; break;
            case '\f': output += "\\f"; break;
            case '\n': output += "\\n"; break;
            case '\r': output += "\\r"; break;
            case '\t': output += "\\t"; break;
            default:
                if (character < 0x20) {
                    output += "\\u00";
                    output.push_back(hex[character >> 4]);
                    output.push_back(hex[character & 0x0f]);
                } else {
                    output.push_back(static_cast<char>(character));
                }
        }
    }
    output.push_back('"');
}

} // namespace asb

#endif
