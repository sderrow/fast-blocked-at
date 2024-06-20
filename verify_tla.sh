#!/bin/bash
set -Eeuox pipefail
mkdir -p build_tla
cd build_tla
sed -n 's@.*//^ \(.*\)@\1@p' ../native.cc > EventLoopBlockage.tla
pcal EventLoopBlockage.tla
tlc EventLoopBlockage.tla
