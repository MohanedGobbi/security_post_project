#!/usr/bin/env bash
# Starts Faculty Security from the source folder: rebuilds it (a few seconds, so it always runs the latest code), then opens it.
# The Linux counterpart of tools/start-system.cmd; the menu entry made by setup.sh runs this file.
# Data stays in ~/.config/FacultySecurity (SECREG_DATA_DIR changes it). Extra arguments go to Electron.
# Settings can live in ~/.config/faculty-security.env (one VAR=value per line), so they also apply when started from the menu:
#
#   SECREG_SKIP_BUILD=1        open the last build without rebuilding
#   SECREG_PASSWORD_STORE=...  pin the keyring that protects the data key: gnome-libsecret, kwallet5, kwallet6 or basic
#                              (decide once, before the first start: see README.md, section Linux)
#   SECREG_NO_SANDBOX=1        run without the Chromium sandbox (last resort, see README.md, section Linux)
#   SECREG_FLAGS="..."         more Electron flags, for example --disable-gpu or --ozone-platform=x11
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

ENV_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/faculty-security.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/faculty-security"
LOG="$LOG_DIR/start.log"
mkdir -p "$LOG_DIR"

# shown in a terminal when there is one, as a desktop notification when started from the menu
fail() {
  printf 'Faculty Security: %s\n' "$1" >&2
  if [[ ! -t 2 ]] && command -v notify-send >/dev/null 2>&1; then notify-send -u critical "Faculty Security" "$1" || true; fi
  exit 1
}

cd "$ROOT"
[[ -x "$ELECTRON_DIR/electron" ]] || fail "Electron is not installed. Run scripts/linux/setup.sh first."

: >"$LOG"
if [[ "${SECREG_SKIP_BUILD:-0}" != 1 ]]; then
  npm run build >>"$LOG" 2>&1 || fail "the build failed. See $LOG, or run \"npm run build\" in $ROOT."
fi
[[ -f out/main/index.js ]] || fail "there is no build yet. Run \"npm run build\" in $ROOT."

args=()
read -r -a flags <<<"${SECREG_FLAGS:-}"
args+=("${flags[@]}")
[[ -n "${SECREG_PASSWORD_STORE:-}" ]] && args+=("--password-store=$SECREG_PASSWORD_STORE")
if [[ "${SECREG_NO_SANDBOX:-0}" == 1 ]]; then
  args+=(--no-sandbox)
elif sandbox_needs_suid && ! sandbox_is_suid; then
  fail "this system blocks the Electron sandbox. Fix it once with:
  sudo chown root:root '$ELECTRON_DIR/chrome-sandbox' && sudo chmod 4755 '$ELECTRON_DIR/chrome-sandbox'"
fi

echo "--- $(date -Is) starting Faculty Security" >>"$LOG"
exec "$ELECTRON_DIR/electron" . "${args[@]}" "$@" >>"$LOG" 2>&1
