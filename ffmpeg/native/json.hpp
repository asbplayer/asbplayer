#ifndef ASB_JSON_HPP
#define ASB_JSON_HPP

#include <string>
#include <string_view>

namespace asb {

inline void append_json_string(std::string& output, std::string_view value) {
    static constexpr char hex[] = "0123456789abcdef";
    static constexpr unsigned char first_printable_character = 0x20;
    static constexpr int bits_per_hex_digit = 4;
    static constexpr unsigned char hex_digit_mask = 0x0f;
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
                if (character < first_printable_character) {
                    output += "\\u00";
                    output.push_back(hex[character >> bits_per_hex_digit]);
                    output.push_back(hex[character & hex_digit_mask]);
                } else {
                    output.push_back(static_cast<char>(character));
                }
        }
    }
    output.push_back('"');
}

} // namespace asb

#endif
