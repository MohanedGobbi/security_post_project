#!/usr/bin/env bash
# Switches the automatic updates of Faculty Security on or off. Run as root; the installer (kit/install.sh) calls it
# with --auto-update / --no-auto-update. The package ships it in /opt/FacultySecurity/resources/updater/.
#
#   setup-auto-update.sh --enable OWNER/REPO --user NAME [--deb FILE] [--token-file FILE]
#   setup-auto-update.sh --disable
#
# --enable writes /etc/faculty-security/update.conf (root only; an existing one is kept), creates the request folder
# owned by the program's user, keeps a copy of the installed .deb (the way back for the first update), installs the
# updater in /usr/local/lib/faculty-security and starts the nightly timer and the path unit.
# --disable stops and removes them; history and backups in /var/lib/faculty-security-update stay.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${UPD_CONF:-/etc/faculty-security/update.conf}"
STATE="${UPD_STATE:-/var/lib/faculty-security-update}"
LIB_DIR="${UPD_LIB_DIR:-/usr/local/lib/faculty-security}"
UNIT_DIR="${UPD_UNIT_DIR:-/etc/systemd/system}"
PKG=security-register
UNITS=(faculty-security-update.service faculty-security-update.timer faculty-security-update.path)

ok()  { printf '\033[1;32m ok\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo)"

MODE="" REPO="" APP_USER="" DEB="" TOKEN_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --enable) MODE=enable; REPO="${2:-}"; shift ;;
    --disable) MODE=disable ;;
    --user) APP_USER="${2:-}"; shift ;;
    --deb) DEB="${2:-}"; shift ;;
    --token-file) TOKEN_FILE="${2:-}"; shift ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

disable() {
  systemctl disable --now faculty-security-update.timer faculty-security-update.path >/dev/null 2>&1 || true
  local u
  for u in "${UNITS[@]}"; do rm -f "$UNIT_DIR/$u"; done
  systemctl daemon-reload >/dev/null 2>&1 || true
  rm -rf "$STATE/request" "$LIB_DIR"
  rm -f "$CONF"
  ok "automatic updates are off (history and backups stay in $STATE)"
}

enable() {
  [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "--enable needs OWNER/REPO, for example MohanedGobbi/security_post_project"
  [[ -n "$APP_USER" ]] && id "$APP_USER" >/dev/null 2>&1 || die "--user must name the account that uses the program"
  command -v python3 >/dev/null 2>&1 || die "python3 is needed by the updater (sudo apt install python3)"

  install -d -m 755 "$(dirname "$CONF")"
  if [[ -f "$CONF" ]]; then
    ok "keeping the existing $CONF ($(grep -E '^REPO=' "$CONF" || echo 'REPO=?'))"
  else
    local token=""
    [[ -n "$TOKEN_FILE" ]] && token="$(tr -d '[:space:]' <"$TOKEN_FILE")"
    local tmp
    tmp="$(mktemp "$(dirname "$CONF")/.update.conf.XXXXXX")"
    chmod 600 "$tmp"
    cat >"$tmp" <<EOF
# Faculty Security automatic updates (read by $LIB_DIR/update.sh, as root)
# The GitHub repository whose releases are installed:
REPO=$REPO
# Read-only fine-grained token, only for a private repository (Contents: read-only):
TOKEN=$token
# The account that uses the program (its data folder is ~/.config/FacultySecurity):
APP_USER=$APP_USER
# DATA_DIR=/home/$APP_USER/.config/FacultySecurity
# API_BASE=https://api.github.com
EOF
    mv -f "$tmp" "$CONF"
    ok "wrote $CONF"
  fi
  chown root:root "$CONF"
  chmod 600 "$CONF"

  install -d -m 755 "$STATE"
  install -d -m 700 "$STATE/packages" "$STATE/backups"
  install -d -m 755 -o "$APP_USER" -g "$(id -gn "$APP_USER")" "$STATE/request"
  ok "request folder $STATE/request (owned by $APP_USER)"

  if [[ -n "$DEB" && -f "$DEB" ]]; then
    local installed
    installed="$(dpkg-query -W -f='${Version}' "$PKG" 2>/dev/null || true)"
    if [[ "$(dpkg-deb -f "$DEB" Version 2>/dev/null)" == "$installed" ]]; then
      install -m 600 "$DEB" "$STATE/packages/installed.deb"
      ok "kept a copy of version $installed to go back to"
    fi
  fi

  install -d -m 755 "$LIB_DIR"
  install -m 755 "$HERE/update.sh" "$LIB_DIR/update.sh"
  local u
  for u in "${UNITS[@]}"; do install -m 644 "$HERE/$u" "$UNIT_DIR/$u"; done
  systemctl daemon-reload
  systemctl enable --now faculty-security-update.timer faculty-security-update.path >/dev/null
  ok "nightly check at 03:00 and the \"Check for updates now\" button are on ($REPO)"
}

case "$MODE" in
  enable) enable ;;
  disable) disable ;;
  *) die "use --enable OWNER/REPO --user NAME, or --disable" ;;
esac
