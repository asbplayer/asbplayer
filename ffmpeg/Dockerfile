ARG ASB_EMSDK_IMAGE=scratch
FROM ${ASB_EMSDK_IMAGE} AS builder

ARG ASB_INITIAL_MEMORY_BYTES
ARG ASB_MAXIMUM_MEMORY_BYTES
ARG ASB_STACK_BYTES

COPY .cache/sources/ffmpeg /src/ffmpeg
COPY .cache/build/ffmpeg-configure-args /src/asbplayer/ffmpeg-configure-args
COPY .cache/build/asb-build-config.hpp /src/asbplayer/generated/asb-build-config.hpp
COPY native/runtime.cpp native/*.hpp /src/asbplayer/native/
COPY native/include /src/asbplayer/native/include

WORKDIR /src/ffmpeg
RUN mkdir -p /build/ffmpeg /output \
    && cd /build/ffmpeg \
    && set -- \
    && while IFS= read -r argument; do set -- "$@" "$argument"; done < /src/asbplayer/ffmpeg-configure-args \
    && emconfigure /src/ffmpeg/configure "$@" \
        || { tail -120 ffbuild/config.log; exit 1; } \
    && cp ffbuild/config.mak /output/config.mak \
    && cp config.h /output/config.h \
    && emmake make -j"$(nproc)" libavutil/libavutil.a \
    && em++ -std=c++23 -O3 -fno-exceptions -fno-rtti \
        -I/src/asbplayer/generated -I/src/asbplayer/native -I/src/asbplayer/native/include \
        -I/build/ffmpeg -I/src/ffmpeg \
        -c /src/asbplayer/native/runtime.cpp -o /build/runtime.o \
    && em++ -std=c++23 -O3 -fno-exceptions -fno-rtti --no-entry \
        /build/runtime.o libavutil/libavutil.a \
        -o /output/ffmpeg-core.js \
        -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker \
        -sFILESYSTEM=0 -sDYNAMIC_EXECUTION=0 \
        -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=${ASB_INITIAL_MEMORY_BYTES} \
        -sMAXIMUM_MEMORY=${ASB_MAXIMUM_MEMORY_BYTES} -sSTACK_SIZE=${ASB_STACK_BYTES} \
        -sEXPORTED_FUNCTIONS='["_asb_runtime_info_json"]' \
        -sEXPORTED_RUNTIME_METHODS='["UTF8ToString"]' \
        -Wl,-Map=/output/ffmpeg-core.map \
    && em++ --version > /output/compiler-version.txt

COPY native/*_test.cpp /src/asbplayer/tests/native/
COPY scripts/runtime-smoke.mjs /src/asbplayer/scripts/runtime-smoke.mjs

FROM builder AS cpp-test
RUN set -eux; \
    for test in /src/asbplayer/tests/native/*_test.cpp; do \
        name="$(basename "$test" .cpp)"; \
        g++ -std=c++23 -O2 -Wall -Wextra -Werror -pedantic \
            -I/src/asbplayer/native \
            "$test" -o "/tmp/$name"; \
        "/tmp/$name"; \
    done

FROM cpp-test AS wasm-test
ARG ASB_RUNTIME_VERSION
ARG ASB_FFMPEG_VERSION
RUN ASB_RUNTIME_VERSION="$ASB_RUNTIME_VERSION" ASB_FFMPEG_VERSION="$ASB_FFMPEG_VERSION" \
    node /src/asbplayer/scripts/runtime-smoke.mjs /output

FROM scratch AS runtime
COPY --from=builder /output /
COPY --from=builder /emsdk/upstream/emscripten/LICENSE /notices/Emscripten-MIT.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libc/musl/COPYRIGHT /notices/musl-COPYRIGHT.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT /notices/compiler-rt-LICENSE.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libcxx/LICENSE.TXT /notices/libcxx-Apache-2.0.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libcxxabi/LICENSE.TXT /notices/libcxxabi-LICENSE.txt
