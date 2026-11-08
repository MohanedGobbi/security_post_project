#!/usr/bin/env bash
# Runs the updater's end-to-end test in a fresh Ubuntu 24.04 container (needs Docker and internet for apt).
#   bash tests/updater/run.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
src="$ROOT"
command -v cygpath >/dev/null 2>&1 && src="$(cygpath -w "$ROOT")"   # Git Bash on Windows
# SYS_PTRACE: like root on a real PC, the updater reads the desktop session's environment from /proc/PID/environ
MSYS_NO_PATHCONV=1 docker run --rm --init --cap-add SYS_PTRACE -v "$src:/src:ro" ubuntu:24.04 bash /src/tests/updater/test.sh
