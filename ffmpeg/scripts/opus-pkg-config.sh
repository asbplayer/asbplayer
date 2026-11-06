#!/bin/sh
# The pinned Emscripten image has no pkg-config. This adapter exposes only the
# statically built libopus; FFmpeg still compiles/links its normal feature probe.
set -eu
if [ "$*" = --version ]; then
    echo asbplayer-opus-config
    exit 0
fi
case " $* " in
    *" opus "*) ;;
    *) exit 1 ;;
esac
test -f /build/opus/lib/pkgconfig/opus.pc
for argument in "$@"; do
    case "$argument" in
        --cflags) echo -I/build/opus/include/opus ;;
        --libs) echo -L/build/opus/lib -lopus -lm ;;
        --modversion) sed -n 's/^Version: //p' /build/opus/lib/pkgconfig/opus.pc ;;
        --variable=includedir) echo /build/opus/include ;;
    esac
done
