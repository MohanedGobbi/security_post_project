#!/usr/bin/env bash
# Checks that this PC is ready for the Faculty Security program, and changes nothing.
# Run it before installing, and again when something does not work: it prints what it finds.
set -uo pipefail

pass() { printf '\033[1;32m PASS\033[0m %s\n' "$*"; }
note() { printf '\033[1;33m NOTE\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m FAIL\033[0m %s\n' "$*"; FAILED=1; }
FAILED=0

echo "Faculty Security: checking this PC"
echo

# system
if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}:${VERSION_ID:-}" in
    ubuntu:22.04|ubuntu:24.04|ubuntu:24.10|ubuntu:25.*|debian:12|debian:13|linuxmint:21*|linuxmint:22*) pass "system: $PRETTY_NAME" ;;
    *) if command -v apt-get >/dev/null 2>&1; then note "system: $PRETTY_NAME (Debian-based, not on the tested list)"; else fail "system: $PRETTY_NAME (needs Ubuntu, Debian or Linux Mint)"; fi ;;
  esac
fi
[[ "$(uname -m)" == x86_64 ]] && pass "processor: 64-bit (x86_64)" || fail "processor: $(uname -m) (needs 64-bit Intel/AMD)"

mem=$(awk '/MemTotal/ {printf "%.1f", $2/1048576}' /proc/meminfo)
awk -v m="$mem" 'BEGIN { exit !(m >= 3.5) }' && pass "memory: ${mem} GB" || fail "memory: ${mem} GB (4 GB or more needed)"

free_gb=$(df -Pk "$HOME" | awk 'NR==2 {printf "%.1f", $4/1048576}')
awk -v f="$free_gb" 'BEGIN { exit !(f >= 2) }' && pass "free disk: ${free_gb} GB" || fail "free disk: ${free_gb} GB (2 GB or more needed)"

# desktop session
if [[ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ]]; then
  pass "desktop: ${XDG_CURRENT_DESKTOP:-unknown} (${XDG_SESSION_TYPE:-unknown} session)"
else
  fail "no graphical session: run this from the desktop, not over SSH"
fi

# keyring
if [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]]; then
  pass "keyring: KDE Wallet"
elif dpkg -s gnome-keyring >/dev/null 2>&1; then
  pass "keyring: gnome-keyring installed"
else
  note "keyring: none installed (install.sh offers to add gnome-keyring)"
fi

# webcam
if compgen -G '/dev/video*' >/dev/null; then
  cam="$(compgen -G '/dev/video*' | head -n1)"
  if [[ -r "$cam" ]]; then pass "webcam: $cam"; else note "webcam: $cam exists but $USER cannot open it yet (install.sh fixes it)"; fi
else
  note "webcam: none plugged in (needed to scan ID cards)"
fi

# screen size
if command -v xrandr >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  res=$(xrandr 2>/dev/null | awk '/\*/ {print $1; exit}')
  [[ -n "$res" ]] && pass "screen: $res (1366x768 or more is best)"
fi

# installed already?
if dpkg -s security-register >/dev/null 2>&1; then
  pass "program: installed, version $(dpkg-query -W -f='${Version}' security-register)"
else
  note "program: not installed yet"
fi
[[ -d "$HOME/.config/FacultySecurity" ]] && note "data folder exists: ~/.config/FacultySecurity (it is kept on reinstall)"

# printer
if command -v lpstat >/dev/null 2>&1 && lpstat -d >/dev/null 2>&1; then
  pass "printer: $(lpstat -d 2>/dev/null | sed 's/.*: //')"
else
  note "printer: no default printer (PDF and Excel exports work without one)"
fi

echo
if [[ $FAILED -eq 0 ]]; then echo "This PC is ready."; else echo "Fix the FAIL lines above before installing."; fi
exit $FAILED
