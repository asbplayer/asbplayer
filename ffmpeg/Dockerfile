ARG ASB_EMSDK_IMAGE=scratch
FROM ${ASB_EMSDK_IMAGE} AS builder

ARG ASB_INITIAL_MEMORY_BYTES
ARG ASB_MAXIMUM_MEMORY_BYTES
ARG ASB_STACK_BYTES

COPY .cache/sources/ffmpeg /src/ffmpeg
COPY .cache/sources/opus /src/opus
COPY .cache/build/ffmpeg-configure-args /src/asbplayer/ffmpeg-configure-args
COPY .cache/build/asb-build-config.hpp /src/asbplayer/generated/asb-build-config.hpp

WORKDIR /src/opus
RUN emconfigure ./configure --host=wasm32-unknown-emscripten --prefix=/build/opus \
        --disable-shared --enable-static --disable-asm --disable-rtcd --disable-intrinsics \
        --disable-doc --disable-extra-programs --disable-deep-plc --disable-dred --disable-osce \
        CFLAGS='-O3' \
    && emmake make -j"$(nproc)" \
    && emmake make install

ENV PKG_CONFIG_PATH=/build/opus/lib/pkgconfig
COPY scripts/opus-pkg-config.sh /src/asbplayer/opus-pkg-config.sh
WORKDIR /src/ffmpeg
RUN mkdir -p /build/ffmpeg /output \
    && cd /build/ffmpeg \
    && set -- \
    && while IFS= read -r argument; do set -- "$@" "$argument"; done < /src/asbplayer/ffmpeg-configure-args \
    && emconfigure /src/ffmpeg/configure "$@" \
        || { tail -120 ffbuild/config.log; exit 1; } \
    && cp ffbuild/config.mak /output/config.mak \
    && cp config.h /output/config.h \
    && emmake make -j"$(nproc)" libavutil/libavutil.a libavcodec/libavcodec.a libavformat/libavformat.a libswresample/libswresample.a

COPY native/runtime.cpp native/*.hpp native/asb_ffmpeg.h /src/asbplayer/native/
WORKDIR /build/ffmpeg
RUN em++ -std=c++23 -O3 -fno-exceptions -fno-rtti \
        -I/build/opus/include \
        -I/src/asbplayer/generated -I/src/asbplayer/native \
        -I/build/ffmpeg -I/src/ffmpeg \
        -c /src/asbplayer/native/runtime.cpp -o /build/runtime.o \
    && em++ -std=c++23 -O3 -fno-exceptions -fno-rtti --no-entry \
        /build/runtime.o libavformat/libavformat.a libavcodec/libavcodec.a libswresample/libswresample.a libavutil/libavutil.a /build/opus/lib/libopus.a \
        -o /output/ffmpeg-core.js \
        -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=worker \
        -sFILESYSTEM=0 -sDYNAMIC_EXECUTION=0 \
        -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=${ASB_INITIAL_MEMORY_BYTES} \
        -sMAXIMUM_MEMORY=${ASB_MAXIMUM_MEMORY_BYTES} -sSTACK_SIZE=${ASB_STACK_BYTES} \
        -sEXPORTED_FUNCTIONS='["_asb_runtime_info_json","_asb_transcode_audio","_asb_last_error"]' \
        -sEXPORTED_RUNTIME_METHODS='["UTF8ToString","HEAPU8"]' \
        -Wl,-Map=/output/ffmpeg-core.map \
    && em++ --version > /output/compiler-version.txt

COPY native/*_test.cpp /src/asbplayer/tests/native/
COPY scripts/runtime-smoke.mjs /src/asbplayer/scripts/

FROM builder AS cpp-test
RUN set -eux; \
    for test in /src/asbplayer/tests/native/*_test.cpp; do \
        name="$(basename "$test" .cpp)"; \
        g++ -std=c++23 -O2 -Wall -Wextra -Werror -pedantic \
            -I/src/asbplayer/native -I/build/ffmpeg -I/src/ffmpeg \
            "$test" -o "/tmp/$name"; \
        "/tmp/$name"; \
    done

FROM cpp-test AS wasm-test
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY scripts/runtime-audio.mjs /src/asbplayer/scripts/
ARG ASB_RUNTIME_VERSION
ARG ASB_FFMPEG_VERSION
RUN ASB_RUNTIME_VERSION="$ASB_RUNTIME_VERSION" ASB_FFMPEG_VERSION="$ASB_FFMPEG_VERSION" \
    node /src/asbplayer/scripts/runtime-smoke.mjs /output \
    && node /src/asbplayer/scripts/runtime-audio.mjs /output

FROM scratch AS runtime
COPY --from=builder /output /
COPY --from=builder /emsdk/upstream/emscripten/LICENSE /notices/Emscripten-MIT.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libc/musl/COPYRIGHT /notices/musl-COPYRIGHT.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT /notices/compiler-rt-LICENSE.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libcxx/LICENSE.TXT /notices/libcxx-Apache-2.0.txt
COPY --from=builder /emsdk/upstream/emscripten/system/lib/libcxxabi/LICENSE.TXT /notices/libcxxabi-LICENSE.txt
