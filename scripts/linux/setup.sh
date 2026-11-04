#!/usr/bin/env bash
# Prepares this Linux PC to run Faculty Security from the source folder: the system libraries Electron needs, Node.js,
# the npm packages, the Electron sandbox, a first build and an entry in the applications menu.
# Run it as the person who will use the program (not as root); it asks for sudo when it needs it.
# It can be run again at any time (after a git pull, for example).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

usage() {
  cat <<EOF
Usage: scripts/linux/setup.sh [options]

  --yes          answer yes to every question (install Node.js $NODE_MAJOR_WANTED without asking)
  --no-system    never use sudo: no system packages, no sandbox fix, no webcam group (you do those yourself)
  --no-menu      do not add Faculty Security to the applications menu
  --autostart    start Faculty Security every time this user logs in (the PC of a security post)
  -h, --help     show this help
EOF
}

SYSTEM=1 MENU=1 AUTOSTART=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1 ;;
    --no-system) SYSTEM=0 ;;
    --no-menu) MENU=0 ;;
    --autostart) AUTOSTART=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "unknown option: $1" ;;
  esac
  shift
done

[[ $EUID -eq 0 ]] && die "run this as the user who will use Faculty Security, not as root (it asks for sudo when needed)"
[[ "$(uname -s)" == Linux ]] || die "this script is for Linux"
case "$(uname -m)" in
  x86_64|aarch64) ;;
  *) warn "untested processor: $(uname -m) (Electron ships for x86_64 and arm64)" ;;
esac

is_kde() { [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]]; }

# Ubuntu 24.04 and Debian 13 renamed some libraries with a t64 suffix: take that name when it exists
apt_pick() {
  local p
  for p in "$@"; do
    if apt-cache show "${p}t64" >/dev/null 2>&1; then echo "${p}t64"; else echo "$p"; fi
  done
}

install_system_packages() {
  local pm keyring=gnome-keyring
  pm="$(package_manager)"
  is_kde && keyring=""   # KDE has its own wallet, which Electron uses
  say "Installing the libraries Electron needs ($pm)"
  case "$pm" in
    apt-get)
      as_root apt-get update
      # shellcheck disable=SC2046
      as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl git xdg-utils libnotify-bin $keyring \
        $(apt_pick libgtk-3-0 libnss3 libasound2 libgbm1 libxss1 libxtst6 libnotify4 libsecret-1-0 \
          libatspi2.0-0 libdrm2 libxkbcommon0 libuuid1)
      ;;
    dnf)
      as_root dnf install -y ca-certificates curl git xdg-utils libnotify $keyring \
        gtk3 nss alsa-lib mesa-libgbm libXScrnSaver libXtst libsecret at-spi2-core libdrm libxkbcommon
      ;;
    pacman)
      as_root pacman -Sy --needed --noconfirm ca-certificates curl git xdg-utils libnotify $keyring \
        gtk3 nss alsa-lib mesa libxss libxtst libsecret at-spi2-core libdrm libxkbcommon
      ;;
    zypper)
      as_root zypper --non-interactive install ca-certificates curl git xdg-utils libnotify-tools $keyring \
        libgtk-3-0 mozilla-nss libasound2 libgbm1 libXss1 libXtst6 libnotify4 libsecret-1-0 at-spi2-core
      ;;
    *)
      warn "no known package manager (apt, dnf, pacman, zypper): install GTK 3, NSS, ALSA, libgbm, libsecret and git yourself"
      return
      ;;
  esac
  ok "system libraries"
}

fix_sandbox() {
  [[ -f "$ELECTRON_DIR/chrome-sandbox" ]] || return 0
  if ! sandbox_needs_suid; then ok "Electron sandbox (user namespaces are allowed)"; return; fi
  if sandbox_is_suid; then ok "Electron sandbox (chrome-sandbox is already setuid root)"; return; fi
  if [[ $SYSTEM -eq 0 ]]; then
    warn "this system blocks the Electron sandbox; run without --no-system, or:"
    warn "  sudo chown root:root '$ELECTRON_DIR/chrome-sandbox' && sudo chmod 4755 '$ELECTRON_DIR/chrome-sandbox'"
    return
  fi
  say "This system blocks unprivileged user namespaces: making chrome-sandbox setuid root (the standard fix)"
  as_root chown root:root "$ELECTRON_DIR/chrome-sandbox"
  as_root chmod 4755 "$ELECTRON_DIR/chrome-sandbox"
  ok "Electron sandbox"
}

camera_access() {
  compgen -G '/dev/video*' >/dev/null || { warn "no webcam found (/dev/video*); plug one in to scan ID cards"; return; }
  local group
  group="$(stat -c %G "$(compgen -G '/dev/video*' | head -n1)")"
  if id -nG "$USER" | tr ' ' '\n' | grep -qx "$group" || [[ -r "$(compgen -G '/dev/video*' | head -n1)" ]]; then
    ok "webcam ($(compgen -G '/dev/video*' | head -n1))"
  elif [[ $SYSTEM -eq 1 ]]; then
    as_root usermod -aG "$group" "$USER"
    warn "added $USER to the '$group' group for the webcam: log out and back in once"
  else
    warn "$USER cannot open the webcam: sudo usermod -aG $group $USER, then log out and in"
  fi
}

# Exec= value of a .desktop file: quoted, with ", `, $ and \ escaped
desktop_quote() {
  printf '"%s"' "$(printf '%s' "$1" | sed -e 's/[\\"`$]/\\&/g')"
}

write_desktop_entry() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  cat >"$file" <<EOF
[Desktop Entry]
Type=Application
Name=Faculty Security
Name[ar]=برنامج الأمن بالكلية
Name[fr]=Sécurité de la faculté
Comment=Security post registers, visitors and ID card scanning
Exec=$(desktop_quote "$ROOT/scripts/linux/start.sh")
Icon=$ROOT/tools/linux-icon.png
Terminal=false
Categories=Office;
EOF
}

# ---------------------------------------------------------------------------

cd "$ROOT"
say "Faculty Security setup in $ROOT"

if [[ $SYSTEM -eq 1 ]]; then
  command -v sudo >/dev/null 2>&1 || die "sudo is needed (or run with --no-system after installing the libraries yourself)"
  install_system_packages
fi

if node_is_recent; then
  ok "Node.js $(node -v)"
elif [[ $SYSTEM -eq 1 ]]; then
  install_node
  node_is_recent || die "Node.js $(node -v 2>/dev/null || echo '(none)') is too old: 22.12 or newer is needed"
  ok "Node.js $(node -v)"
else
  die "Node.js 22.12 or newer is needed (found: $(node -v 2>/dev/null || echo none))"
fi

say "Installing npm packages (downloads Electron the first time, about 100 MB)"
npm ci --no-audit --no-fund
ok "npm packages"

fix_sandbox
[[ $SYSTEM -eq 1 ]] && camera_access

say "Building the program"
npm run build
ok "build (out/)"

chmod +x "$ROOT"/scripts/linux/*.sh
if [[ $MENU -eq 1 ]]; then
  write_desktop_entry "${XDG_DATA_HOME:-$HOME/.local/share}/applications/faculty-security.desktop"
  ok "applications menu entry: Faculty Security"
fi
if [[ $AUTOSTART -eq 1 ]]; then
  write_desktop_entry "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/faculty-security.desktop"
  ok "starts when $USER logs in (remove ~/.config/autostart/faculty-security.desktop to stop that)"
fi

cat <<EOF

Faculty Security is ready.

  Start it:      scripts/linux/start.sh   (or "Faculty Security" in the applications menu)
  First login:   administrator PIN 246810, team leader PIN 135790 (change both in Administration > Accounts)
  Data folder:   ${SECREG_DATA_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/FacultySecurity}
  Guide:         README.md (section Linux)
EOF
