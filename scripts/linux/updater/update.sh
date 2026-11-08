#!/usr/bin/env bash
# Faculty Security updater: installs the newest GitHub release of the program on this PC, and goes back by itself when
# the new version does not start. Run as root by faculty-security-update.service (nightly timer, or the "Check for
# updates now" button through faculty-security-update.path). Needs: bash, dpkg, python3 (Ubuntu has them). No git.
#
#   1. reads /etc/faculty-security/update.conf (REPO, optional TOKEN, APP_USER)
#   2. asks the GitHub API for the latest release; stops when it is not newer than the installed version (sort -V)
#   3. downloads the .deb and SHA256SUMS, checks the checksum and the version inside the package
#   4. closes the program, backs up its data folder, installs the .deb, opens the program again and waits up to 60 s
#      for it to report that it started (running.json in the data folder)
#   5. on failure: reinstalls the previous .deb, restores the data folder (migrations may have run), opens the program,
#      keeps the broken package as packages/failed-VERSION.deb and skips that version until a newer one appears
#
# Progress goes to status.json (read by Administration > System), one line per update to history.log, details to the
# journal (journalctl -u faculty-security-update). Every path can be changed through the environment, for the tests.
#
# The body is one function called on the last line: dpkg replaces this program's files while it runs, and bash would
# otherwise go on reading a file that changed under it.

main() {
  set -uo pipefail
  umask 022

  CONF="${UPD_CONF:-/etc/faculty-security/update.conf}"
  STATE="${UPD_STATE:-/var/lib/faculty-security-update}"
  APP_DIR="${UPD_APP_DIR:-/opt/FacultySecurity}"
  LIB_DIR="${UPD_LIB_DIR:-/usr/local/lib/faculty-security}"
  UNIT_DIR="${UPD_UNIT_DIR:-/etc/systemd/system}"
  LOCK="${UPD_LOCK:-/run/faculty-security-update.lock}"
  HEALTH_TIMEOUT="${UPD_HEALTH_TIMEOUT:-60}"
  STOP_TIMEOUT="${UPD_STOP_TIMEOUT:-20}"
  PKG=security-register
  BIN="$APP_DIR/security-register"
  REQ_DIR="$STATE/request"
  STATUS_FILE="$STATE/status.json"
  HISTORY="$STATE/history.log"
  FAILED_FILE="$STATE/failed-version"
  PKGS="$STATE/packages"
  BACKUPS="$STATE/backups"
  INSTALLED="" LATEST="" WORK=""

  # the request of the "Check for updates now" button is consumed first thing, so the .path unit does not fire again
  rm -f "$REQ_DIR/check-now"

  mkdir -p "$(dirname "$LOCK")"
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "another update is already running: stepping aside"
    exit 0
  fi

  command -v python3 >/dev/null 2>&1 || { log "python3 is missing: cannot read the GitHub API"; exit 1; }
  install -d -m 755 "$STATE"
  install -d -m 700 "$PKGS" "$BACKUPS"
  load_config || exit 1

  INSTALLED="$(installed_version)"
  status checking "Asking GitHub for the latest release of $REPO"

  local release
  if ! release="$(latest_release)"; then
    status error "Cannot reach GitHub or read the latest release of $REPO"
    exit 1
  fi
  local tag deb_name deb_url sums_url
  IFS=$'\t' read -r tag deb_name deb_url sums_url <<<"$release"
  LATEST="${tag#v}"
  log "installed: ${INSTALLED:-none}, latest release: $LATEST"

  if [[ -n "$INSTALLED" ]] && ! newer "$LATEST" "$INSTALLED"; then
    status up_to_date "Version $INSTALLED is the latest"
    exit 0
  fi
  if [[ -f "$FAILED_FILE" && "$(cat "$FAILED_FILE")" == "$LATEST" ]]; then
    status skipped "Version $LATEST failed to start before; waiting for a newer release"
    exit 0
  fi
  if [[ -z "$deb_url" || -z "$sums_url" ]]; then
    status error "Release $tag has no .deb or no SHA256SUMS"
    exit 1
  fi

  # ---- download and check --------------------------------------------------------------------------------------
  status downloading "Downloading version $LATEST"
  WORK="$(mktemp -d "$STATE/download.XXXXXX")"
  trap 'rm -rf "$WORK"' EXIT
  if ! fetch "$deb_url" "$WORK/$deb_name" || ! fetch "$sums_url" "$WORK/SHA256SUMS"; then
    status error "Download of version $LATEST failed"
    exit 1
  fi
  if ! verify_checksum "$WORK" "$deb_name"; then
    status error "Checksum of $deb_name does not match SHA256SUMS: package refused"
    history_line "refused" "checksum mismatch"
    exit 1
  fi
  local new_deb="$WORK/$deb_name" problem
  if problem="$(check_package "$new_deb" "$LATEST")"; then :; else
    status error "Package refused: $problem"
    history_line "refused" "$problem"
    exit 1
  fi

  # ---- the way back: a copy of the installed package --------------------------------------------------------------
  if [[ -n "$INSTALLED" ]] && ! have_rollback_package; then
    status error "No copy of the installed version $INSTALLED to go back to: update not started"
    exit 1
  fi

  # ---- install ------------------------------------------------------------------------------------------------------
  status installing "Installing version $LATEST"
  local t0 backup
  t0="$(date +%s)"
  capture_session
  stop_app
  backup="$(backup_data)" || { status error "Backup of the data folder failed: update not started"; relaunch_app; exit 1; }
  log "data backed up to ${backup:-nothing (no data folder yet)}"

  if ! dpkg_install "$new_deb"; then
    rollback "$new_deb" "$backup" "dpkg could not install version $LATEST"
    exit 1
  fi
  local note
  if relaunch_app; then
    if ! wait_healthy "$LATEST" "$t0"; then
      rollback "$new_deb" "$backup" "version $LATEST did not start within ${HEALTH_TIMEOUT}s"
      exit 1
    fi
    note="started and healthy"
  else
    note="installed; not started because nobody is logged in (it starts at the next login)"
  fi

  # the package of the version before stays as previous.deb, the new one becomes the way back for the next update
  [[ -f "$PKGS/installed.deb" ]] && mv -f "$PKGS/installed.deb" "$PKGS/previous.deb"
  cp -f "$new_deb" "$PKGS/installed.deb.tmp" && mv -f "$PKGS/installed.deb.tmp" "$PKGS/installed.deb"
  rm -f "$FAILED_FILE"
  apply_templates
  local from="${INSTALLED:-none}"
  INSTALLED="$LATEST"
  status updated "Updated from $from to $LATEST: $note"
  history_line "updated" "$note" "$from"
  log "done"
}

# --------------------------------------------------------------------------------------------------------------------

log() { printf '[faculty-security-update] %s\n' "$*"; }

# status STATE MESSAGE : status.json for the program (dir 755, file 644), written to a temp file then renamed
status() {
  local state="$1" message="$2"
  log "$state: $message"
  python3 - "$STATUS_FILE" "$state" "$INSTALLED" "$LATEST" "$message" <<'PY'
import datetime, json, os, sys, tempfile
path, state, installed, latest, message = sys.argv[1:6]
data = {
    "state": state,
    "installed": installed or None,
    "latest": latest or None,
    "message": message,
    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds"),
}
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".status.")
with os.fdopen(fd, "w") as f:
    json.dump(data, f)
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
}

# history_line RESULT MESSAGE [FROM]
history_line() {
  printf '%s %s -> %s %s: %s\n' "$(date -Is)" "${3:-${INSTALLED:-none}}" "${LATEST:-?}" "$1" "$2" >>"$HISTORY"
}

# KEY=VALUE lines; only known keys are taken (the file is root-only and never sourced)
load_config() {
  REPO="" TOKEN="" APP_USER="" DATA_DIR="" API_BASE="https://api.github.com"
  if [[ ! -r "$CONF" ]]; then
    log "no configuration at $CONF (the installer writes it with --auto-update)"
    status error "Automatic updates are not configured ($CONF is missing)"
    return 1
  fi
  local key value
  while IFS='=' read -r key value; do
    key="${key//[[:space:]]/}"
    [[ -z "$key" || "$key" == \#* ]] && continue
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    case "$key" in
      REPO) REPO="$value" ;;
      TOKEN) TOKEN="$value" ;;
      APP_USER) APP_USER="$value" ;;
      DATA_DIR) DATA_DIR="$value" ;;
      API_BASE) API_BASE="${value%/}" ;;
    esac
  done <"$CONF"
  if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    status error "REPO in $CONF must look like owner/name"
    return 1
  fi
  if [[ -z "$APP_USER" ]] || ! id "$APP_USER" >/dev/null 2>&1; then
    status error "APP_USER in $CONF is not a user of this PC"
    return 1
  fi
  if [[ -z "$DATA_DIR" ]]; then
    local home
    home="$(getent passwd "$APP_USER" | cut -d: -f6)"
    DATA_DIR="$home/.config/FacultySecurity"
  fi
  export TOKEN
}

installed_version() {
  local v
  v="$(dpkg-query -W -f='${Version}' "$PKG" 2>/dev/null)" && [[ -n "$v" ]] && { echo "$v"; return; }
  [[ -f "$APP_DIR/resources/version.json" ]] && python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$APP_DIR/resources/version.json" 2>/dev/null
}

# newer A B : true when version A is strictly newer than B
newer() {
  [[ "$1" != "$2" && "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" == "$1" ]]
}

# fetch URL FILE [ACCEPT] : HTTPS download; the token (private repositories) is never sent to another host on a redirect
fetch() {
  python3 - "$1" "$2" "${3:-application/octet-stream}" <<'PY'
import os, sys, urllib.parse, urllib.request
url, out, accept = sys.argv[1:4]
token = os.environ.get("TOKEN", "")

class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and urllib.parse.urlsplit(newurl).netloc != urllib.parse.urlsplit(req.full_url).netloc:
            new.remove_header("Authorization")
        return new

req = urllib.request.Request(url, headers={"User-Agent": "faculty-security-updater", "Accept": accept})
if token:
    req.add_header("Authorization", "Bearer " + token)
try:
    with urllib.request.build_opener(Redirect).open(req, timeout=60) as r, open(out + ".part", "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(out + ".part", out)
except Exception as e:
    print(f"download failed: {url}: {e}", file=sys.stderr)
    sys.exit(1)
PY
}

# prints: tag <TAB> deb file name <TAB> deb URL <TAB> SHA256SUMS URL
latest_release() {
  release_info "$API_BASE/repos/$REPO/releases/latest"
}

release_info() {
  local json
  json="$(mktemp)"
  if ! fetch "$1" "$json" "application/vnd.github+json"; then rm -f "$json"; return 1; fi
  python3 - "$json" <<'PY'
import json, os, re, sys
try:
    rel = json.load(open(sys.argv[1]))
    tag = rel["tag_name"]
except Exception as e:
    print(f"unreadable release answer: {e}", file=sys.stderr)
    sys.exit(1)
if not re.fullmatch(r"v?\d+\.\d+\.\d+", tag):
    print(f"tag is not a version: {tag}", file=sys.stderr)
    sys.exit(1)
private = bool(os.environ.get("TOKEN"))
deb = sums = ("", "")
for a in rel.get("assets", []):
    name = a.get("name", "")
    link = a.get("url" if private else "browser_download_url", "")
    if re.fullmatch(r"FacultySecurity-[\d.]+-amd64\.deb", name):
        deb = (name, link)
    elif name == "SHA256SUMS":
        sums = (name, link)
print("\t".join([tag, deb[0], deb[1], sums[1]]))
PY
  local rc=$?
  rm -f "$json"
  return $rc
}

verify_checksum() {
  local dir="$1" name="$2" line
  line="$(grep -E "^[0-9a-f]{64}[ *]+${name//./\\.}\$" "$dir/SHA256SUMS")" || return 1
  (cd "$dir" && printf '%s\n' "$line" | sha256sum --check --status)
}

# check_package DEB VERSION : prints the problem and fails when the package is not what the release says
check_package() {
  local deb="$1" want="$2" name ver inside
  name="$(dpkg-deb -f "$deb" Package 2>/dev/null)" || { echo "not a Debian package"; return 1; }
  [[ "$name" == "$PKG" ]] || { echo "package is $name, not $PKG"; return 1; }
  ver="$(dpkg-deb -f "$deb" Version)"
  [[ "$ver" == "$want" ]] || { echo "package version $ver does not match the release tag $want"; return 1; }
  inside="$(dpkg-deb --fsys-tarfile "$deb" | tar -xO "./${APP_DIR#/}/resources/version.json" 2>/dev/null |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])' 2>/dev/null)"
  [[ "$inside" == "$want" ]] || { echo "version file inside the package says '${inside:-nothing}', not $want"; return 1; }
}

# packages/installed.deb must be the installed version; when it is missing, the release of that version is downloaded
have_rollback_package() {
  local keep="$PKGS/installed.deb"
  [[ -f "$keep" && "$(dpkg-deb -f "$keep" Version 2>/dev/null)" == "$INSTALLED" ]] && return 0
  log "no copy of version $INSTALLED kept: downloading its release"
  local info tag name url sums
  info="$(release_info "$API_BASE/repos/$REPO/releases/tags/v$INSTALLED")" || return 1
  IFS=$'\t' read -r tag name url sums <<<"$info"
  [[ -n "$url" && -n "$sums" ]] || return 1
  fetch "$url" "$WORK/old-$name" && fetch "$sums" "$WORK/old-SHA256SUMS" || return 1
  mkdir -p "$WORK/old" && mv "$WORK/old-$name" "$WORK/old/$name" && mv "$WORK/old-SHA256SUMS" "$WORK/old/SHA256SUMS"
  verify_checksum "$WORK/old" "$name" || return 1
  [[ "$(dpkg-deb -f "$WORK/old/$name" Version)" == "$INSTALLED" ]] || return 1
  mv -f "$WORK/old/$name" "$keep"
}

# ---- the program in the user's desktop session ----------------------------------------------------------------------

# processes of the program: by executable, or by command line (when started through /usr/bin/security-register)
app_pids() {
  local pid exe cmd
  for pid in $(pgrep -u "$APP_USER" 2>/dev/null); do
    exe="$(readlink "/proc/$pid/exe" 2>/dev/null)"
    cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)"
    case "$exe|$cmd" in
      "$BIN|"* | "$BIN (deleted)|"* | *"|$BIN "* | *"|/usr/bin/$PKG "*) echo "$pid" ;;
    esac
  done
}

# the main process: the one without --type= (the others are Chromium's helpers)
app_main_pid() {
  local pid
  for pid in $(app_pids); do
    tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -q -- '--type=' || { echo "$pid"; return; }
  done
}

# keeps the display, session bus and language of the running program (or of the logged-in desktop) to open it again
capture_session() {
  local pid src=""
  rm -f "$STATE/session.env" "$STATE/session.args"
  pid="$(app_main_pid)"
  if [[ -n "$pid" ]]; then
    src="$pid"
    # program arguments after the executable (--password-store=..., --no-sandbox), one per line
    tr '\0' '\n' <"/proc/$pid/cmdline" | tail -n +2 | grep -E '^--[a-z0-9-]+(=.*)?$' >"$STATE/session.args" || true
  else
    for pid in $(pgrep -u "$APP_USER" 2>/dev/null); do
      if tr '\0' '\n' <"/proc/$pid/environ" 2>/dev/null | grep -qE '^(DISPLAY|WAYLAND_DISPLAY)='; then src="$pid"; break; fi
    done
  fi
  [[ -n "$src" ]] || { log "nobody is logged in: the program will not be opened after the update"; return 0; }
  tr '\0' '\n' <"/proc/$src/environ" 2>/dev/null |
    grep -E '^(DISPLAY|WAYLAND_DISPLAY|XAUTHORITY|XDG_RUNTIME_DIR|DBUS_SESSION_BUS_ADDRESS|XDG_CURRENT_DESKTOP|XDG_SESSION_TYPE|XDG_SESSION_DESKTOP|DESKTOP_SESSION|LANG|LANGUAGE|LC_[A-Z]+|SECREG_[A-Z_]+)=' \
    >"$STATE/session.env" || true
  chmod 600 "$STATE/session.env" 2>/dev/null || true
  log "desktop session found (process $src)"
}

stop_app() {
  local pid i
  pid="$(app_main_pid)"
  [[ -n "$pid" ]] || return 0
  log "closing the program (process $pid)"
  kill -TERM "$pid" 2>/dev/null || true
  for ((i = 0; i < STOP_TIMEOUT; i++)); do
    [[ -z "$(app_pids)" ]] && return 0
    sleep 1
  done
  log "the program did not close within ${STOP_TIMEOUT}s: killing it"
  local p
  for p in $(app_pids); do kill -KILL "$p" 2>/dev/null || true; done
  sleep 1
}

# opens the program in the user's session; fails when there is no session to open it in
relaunch_app() {
  [[ -s "$STATE/session.env" ]] || return 1
  local args=() line uid
  while IFS= read -r line; do [[ -n "$line" ]] && args+=("--setenv=$line"); done <"$STATE/session.env"
  local prog=("$BIN")
  if [[ -s "$STATE/session.args" ]]; then
    while IFS= read -r line; do prog+=("$line"); done <"$STATE/session.args"
  fi
  local unit
  unit="faculty-security-app-$(date +%s)"
  log "opening the program for $APP_USER"
  # in the user's own systemd manager (closed with the session, like a program started from the menu)
  if systemd-run --quiet --collect --user --machine="$APP_USER@.host" --unit="$unit" "${args[@]}" "${prog[@]}" 2>/dev/null 9>&-; then
    return 0
  fi
  # older systemd: a transient system unit running as the user, with the same environment
  uid="$(id -u "$APP_USER")"
  systemd-run --quiet --collect --unit="$unit" --uid="$uid" --gid="$(id -g "$APP_USER")" \
    --setenv=HOME="$(getent passwd "$APP_USER" | cut -d: -f6)" --setenv=USER="$APP_USER" "${args[@]}" "${prog[@]}" 9>&-
}

# the program writes running.json in its data folder once its window has loaded (src/main/updates.ts)
wait_healthy() {
  local want="$1" since="$2" marker="$DATA_DIR/running.json" i
  for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
    if [[ -f "$marker" && "$(stat -c %Y "$marker")" -ge "$since" ]] &&
      python3 - "$marker" "$want" <<'PY'
import json, sys
try:
    m = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(1)
sys.exit(0 if m.get("version") == sys.argv[2] and m.get("state") == "ok" else 1)
PY
    then
      log "the program reports version $want running"
      return 0
    fi
    sleep 1
  done
  return 1
}

# ---- data ------------------------------------------------------------------------------------------------------------

# the whole data folder (database, its WAL, the data key, settings) except the program's own safety copies; prints the
# backup folder, or nothing when there is no data folder yet
backup_data() {
  [[ -d "$DATA_DIR" ]] || return 0
  local dir
  dir="$BACKUPS/$(date +%Y%m%d-%H%M%S)-${INSTALLED:-none}"
  install -d -m 700 "$dir" || return 1
  tar -C "$DATA_DIR" --exclude=./backups -czf "$dir/data.tar.gz" . || return 1
  # keep the last 5
  ls -1dt "$BACKUPS"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
  echo "$dir"
}

restore_data() {
  local dir="$1"
  [[ -n "$dir" && -f "$dir/data.tar.gz" ]] || return 0
  find "$DATA_DIR" -mindepth 1 -maxdepth 1 ! -name backups -exec rm -rf {} + || return 1
  tar -C "$DATA_DIR" -xzf "$dir/data.tar.gz"
}

dpkg_install() {
  DEBIAN_FRONTEND=noninteractive dpkg --force-confold -i "$1" </dev/null 9>&-
}

# ---- rollback ----------------------------------------------------------------------------------------------------------

rollback() {
  local new_deb="$1" backup="$2" why="$3" note
  log "FAILED: $why: going back to version $INSTALLED"
  stop_app
  if [[ -n "$INSTALLED" ]] && ! dpkg_install "$PKGS/installed.deb"; then
    note="could not reinstall version $INSTALLED"
  elif ! restore_data "$backup"; then
    note="version $INSTALLED reinstalled but the data folder could not be restored from $backup"
  else
    note="back to version $INSTALLED, data restored from the backup"
  fi
  cp -f "$new_deb" "$PKGS/failed-$LATEST.deb" 2>/dev/null || true
  echo "$LATEST" >"$FAILED_FILE"
  apply_templates
  local since
  since="$(date +%s)"
  if relaunch_app; then
    wait_healthy "$INSTALLED" "$since" || note="$note; the old version did not report back either"
  fi
  status failed "$why; $note. Version $LATEST is skipped until a newer release appears"
  history_line "failed" "$why; $note"
}

# ---- systemd units -----------------------------------------------------------------------------------------------------

# the installed package carries the updater and its units: a new version may have changed them
apply_templates() {
  local src="$APP_DIR/resources/updater" changed=0 f
  [[ -d "$src" ]] || return 0
  if [[ -f "$src/update.sh" ]] && ! cmp -s "$src/update.sh" "$LIB_DIR/update.sh"; then
    install -d -m 755 "$LIB_DIR"
    cp "$src/update.sh" "$LIB_DIR/.update.sh.new" && chmod 755 "$LIB_DIR/.update.sh.new" && mv -f "$LIB_DIR/.update.sh.new" "$LIB_DIR/update.sh"
    log "updater replaced by the one of the new version"
  fi
  for f in faculty-security-update.service faculty-security-update.timer faculty-security-update.path; do
    [[ -f "$src/$f" ]] || continue
    if ! cmp -s "$src/$f" "$UNIT_DIR/$f"; then
      install -m 644 "$src/$f" "$UNIT_DIR/$f"
      changed=1
    fi
  done
  if [[ $changed -eq 1 ]]; then
    systemctl daemon-reload || true
    systemctl enable faculty-security-update.timer faculty-security-update.path >/dev/null 2>&1 || true
    log "systemd units refreshed"
  fi
}

main "$@"
