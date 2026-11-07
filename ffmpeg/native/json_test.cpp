#include "json.hpp"

#include <iostream>
#include <string>

int main() {
    std::string input = "quote\" slash\\";
    input.push_back('\b');
    input.push_back('\f');
    input.push_back('\n');
    input.push_back('\r');
    input.push_back('\t');
    input.push_back('\0');
    input.push_back('\x1f');

    std::string output = "prefix:";
    asb::append_json_string(output, input);

    const std::string expected = R"json(prefix:"quote\" slash\\\b\f\n\r\t\u0000\u001f")json";
    if (output != expected) {
        std::cerr << "JSON escaping mismatch\nExpected: " << expected << "\nActual:   " << output << '\n';
        return 1;
    }

    return 0;
}
