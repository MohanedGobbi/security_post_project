#!/usr/bin/env bash
# End-to-end test of scripts/linux/updater/update.sh in a throwaway Ubuntu container (run tests/updater/run.sh).
# Real: dpkg, the updater, setup-auto-update.sh, flock, tar, the status/history files, a program process running as the
# desktop user. Faked: GitHub (python http.server with the API answers and the assets), systemctl and systemd-run
# (stubs), and the program itself (a small script that "migrates" its database and writes running.json like the real
# one, src/main/updates.ts). Prints PASS/FAIL per check and exits 1 when one failed.
set -uo pipefail

SRC=/src
UPD="$SRC/scripts/linux/updater"
W=/work
GH=$W/gh
PORT=8765
STATE=/var/lib/faculty-security-update
DATA=/home/guard/.config/FacultySecurity
export UPD_HEALTH_TIMEOUT=8 UPD_STOP_TIMEOUT=5

PASSED=0 FAILED=0
pass() { printf '\033[1;32mPASS\033[0m %s\n' "$*"; PASSED=$((PASSED + 1)); }
fail() { printf '\033[1;31mFAIL\033[0m %s\n' "$*"; FAILED=$((FAILED + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
json() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2]))' "$1" "$2" 2>/dev/null; }
installed() { dpkg-query -W -f='${Version}' security-register 2>/dev/null; }
state() { json "$STATE/status.json" state; }
running_version() { json "$DATA/running.json" version; }
db() { cat "$DATA/register.db" 2>/dev/null; }

# ---- tools ----------------------------------------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq python3 procps >/dev/null || { echo "apt failed"; exit 1; }
useradd -m -s /bin/bash guard
mkdir -p $W $GH

# systemctl and systemd-run stubs: record the calls; systemd-run starts the program as the user, detached
cat >/usr/local/bin/systemctl <<'EOF'
#!/bin/bash
echo "systemctl $*" >>/work/systemctl.log
EOF
cat >/usr/local/bin/systemd-run <<'EOF'
#!/bin/bash
# the user-manager form (--user --machine=...) is refused, like an old systemd: the updater falls back to --uid
echo "systemd-run $*" >>/work/systemd-run.log
envs=() cmd=() user=""
for a in "$@"; do
  case "$a" in
    --user) exit 1 ;;
    --setenv=*) envs+=("${a#--setenv=}") ;;
    --uid=*) user="$(getent passwd "${a#--uid=}" | cut -d: -f1)" ;;
    --*) ;;
    *) cmd+=("$a") ;;
  esac
done
setsid runuser -u "$user" -- env "${envs[@]}" "${cmd[@]}" </dev/null >>/work/app.log 2>&1 &
EOF
chmod +x /usr/local/bin/systemctl /usr/local/bin/systemd-run

# ---- fake packages --------------------------------------------------------------------------------------------------
# make_deb VERSION [broken|badversion] [updater-marker]
make_deb() {
  local v="$1" kind="${2:-}" marker="${3:-}" root="$W/pkg-$1"
  rm -rf "$root"
  mkdir -p "$root/DEBIAN" "$root/opt/FacultySecurity/resources/updater" "$root/usr/bin"
  cat >"$root/DEBIAN/control" <<EOF
Package: security-register
Version: $v
Architecture: all
Maintainer: test <test@example.com>
Description: fake Faculty Security $v
EOF
  local inside="$v"
  [[ "$kind" == badversion ]] && inside="9.9.9"
  printf '{"version":"%s","commit":"test","built":"2026-11-08T00:00:00Z"}\n' "$inside" >"$root/opt/FacultySecurity/resources/version.json"
  cp "$UPD"/update.sh "$UPD"/setup-auto-update.sh "$UPD"/faculty-security-update.* "$root/opt/FacultySecurity/resources/updater/"
  [[ -n "$marker" ]] && echo "# $marker" >>"$root/opt/FacultySecurity/resources/updater/update.sh"
  cat >"$root/opt/FacultySecurity/security-register" <<'EOF'
#!/bin/bash
exec -a /opt/FacultySecurity/security-register python3 /opt/FacultySecurity/fakeapp.py "$@"
EOF
  chmod 755 "$root/opt/FacultySecurity/security-register"
  cat >"$root/opt/FacultySecurity/fakeapp.py" <<EOF
import json, os, signal, sys, time
data = os.path.expanduser("~/.config/FacultySecurity")
os.makedirs(data, exist_ok=True)
version = json.load(open("/opt/FacultySecurity/resources/version.json"))["version"]
with open(os.path.join(data, "register.db"), "a") as f:   # the migration of this version
    f.write("migrated to %s\n" % version)
if "$kind" == "broken":
    sys.exit(1)                                            # crashes after migrating: no health report
time.sleep(0.5)
tmp = os.path.join(data, ".running.tmp")
with open(tmp, "w") as f:
    json.dump({"version": version, "state": "ok", "pid": os.getpid()}, f)
os.replace(tmp, os.path.join(data, "running.json"))
signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))
while True:
    time.sleep(1)
EOF
  ln -s /opt/FacultySecurity/security-register "$root/usr/bin/security-register"
  dpkg-deb --root-owner-group -b "$root" "$W/FacultySecurity-$v-amd64.deb" >/dev/null
}

# publish VERSION [damaged] : the fake GitHub's latest release becomes this version
publish() {
  local v="$1" dir="$GH/assets/v$1"
  mkdir -p "$dir" "$GH/repos/o/r/releases/tags"
  cp "$W/FacultySecurity-$v-amd64.deb" "$dir/"
  (cd "$dir" && sha256sum "FacultySecurity-$v-amd64.deb" >SHA256SUMS)
  if [[ "${2:-}" == damaged ]]; then sed -i -E "s/^[0-9a-f]{64}/$(printf '0%.0s' {1..64})/" "$dir/SHA256SUMS"; fi
  cat >"$GH/repos/o/r/releases/tags/v$v" <<EOF
{"tag_name": "v$v", "assets": [
  {"name": "FacultySecurity-$v-amd64.deb", "browser_download_url": "http://127.0.0.1:$PORT/assets/v$v/FacultySecurity-$v-amd64.deb", "url": "x"},
  {"name": "SHA256SUMS", "browser_download_url": "http://127.0.0.1:$PORT/assets/v$v/SHA256SUMS", "url": "x"}]}
EOF
  cp "$GH/repos/o/r/releases/tags/v$v" "$GH/repos/o/r/releases/latest"
}

start_app() {
  setsid runuser -u guard -- env DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/1000 LANG=ar_DZ.UTF-8 /opt/FacultySecurity/security-register </dev/null >>$W/app.log 2>&1 &
  for _ in $(seq 20); do [[ -f "$DATA/running.json" ]] && return 0; sleep 0.5; done
  return 1
}

run_updater() { /usr/local/lib/faculty-security/update.sh >>$W/updater.log 2>&1; }

(cd $GH && python3 -m http.server $PORT >/dev/null 2>&1 &)
for v in 0.1.0 0.2.0 0.4.0; do make_deb $v; done
make_deb 0.3.0 broken
make_deb 0.5.0 badversion
make_deb 0.4.1 "" "updater of 0.4.1"
sleep 1

echo "== install 0.1.0 the way the kit does"
dpkg -i $W/FacultySecurity-0.1.0-amd64.deb >/dev/null
bash /opt/FacultySecurity/resources/updater/setup-auto-update.sh --enable o/r --user guard --deb $W/FacultySecurity-0.1.0-amd64.deb >/dev/null
echo "API_BASE=http://127.0.0.1:$PORT" >>/etc/faculty-security/update.conf
check "config is root-only (600)" test "$(stat -c %a /etc/faculty-security/update.conf)" = 600
check "request folder belongs to the program's user" test "$(stat -c %U $STATE/request)" = guard
check "timer and path unit enabled" grep -q "enable --now faculty-security-update.timer faculty-security-update.path" $W/systemctl.log
check "installed package kept as the way back" test "$(dpkg-deb -f $STATE/packages/installed.deb Version)" = 0.1.0
start_app
echo "seed data" >>"$DATA/register.db"
mkdir -p "$DATA/backups/auto-1" && echo copy >"$DATA/backups/auto-1/register.db"
check "program 0.1.0 runs" test "$(running_version)" = 0.1.0

echo "== same version: nothing to do (and the button's request is consumed)"
publish 0.1.0
runuser -u guard -- touch $STATE/request/check-now
run_updater
check "same version is a no-op (up_to_date)" test "$(state)" = up_to_date
check "still 0.1.0" test "$(installed)" = 0.1.0
check "request file consumed" test ! -e $STATE/request/check-now
check "status dir 755, file 644" test "$(stat -c %a $STATE) $(stat -c %a $STATE/status.json)" = "755 644"
check "status has installed/latest/message/timestamp" python3 -c '
import json; d = json.load(open("/var/lib/faculty-security-update/status.json"))
assert d["installed"] == "0.1.0" and d["latest"] == "0.1.0" and d["message"] and d["timestamp"]'

echo "== newer version installs"
publish 0.2.0
before_db="$(db)"
run_updater
check "0.2.0 installed" test "$(installed)" = 0.2.0
check "status updated" test "$(state)" = updated
check "program reopened as the user and reports 0.2.0" test "$(running_version)" = 0.2.0
check "program runs as guard" pgrep -u guard -f '^/opt/FacultySecurity/security-register'
check "session environment carried over (DISPLAY, LANG)" bash -c "grep -q -- '--setenv=DISPLAY=:0' $W/systemd-run.log && grep -q -- '--setenv=LANG=ar_DZ.UTF-8' $W/systemd-run.log"
check "user data kept and migrated" bash -c "grep -q 'seed data' '$DATA/register.db' && grep -q 'migrated to 0.2.0' '$DATA/register.db'"
check "program's own safety copies kept (data lives outside the app folder)" test -f "$DATA/backups/auto-1/register.db"
check "backup of the data made before installing" bash -c "ls $STATE/backups/*-0.1.0/data.tar.gz"
check "previous version kept (previous.deb = 0.1.0)" test "$(dpkg-deb -f $STATE/packages/previous.deb Version)" = 0.1.0
check "new package is the next way back (installed.deb = 0.2.0)" test "$(dpkg-deb -f $STATE/packages/installed.deb Version)" = 0.2.0
check "history line written" grep -q '0.1.0 -> 0.2.0 updated' $STATE/history.log

echo "== broken release rolls back code and database, then is skipped"
publish 0.3.0
db_before_broken="$(db)"
run_updater
check "back on 0.2.0" test "$(installed)" = 0.2.0
check "status failed" test "$(state)" = failed
# the reopened 0.2.0 appends its own start line again; what matters: the backup came back and 0.3.0's migration is gone
check "database restored (0.3.0's migration undone)" bash -c "! grep -q 'migrated to 0.3.0' '$DATA/register.db' && test \"$(head -c ${#db_before_broken} '$DATA/register.db')\" = \"$db_before_broken\""
check "old version reopened and reports 0.2.0" test "$(running_version)" = 0.2.0
check "broken package kept as failed-0.3.0.deb" test -f $STATE/packages/failed-0.3.0.deb
check "failed version recorded" test "$(cat $STATE/failed-version)" = 0.3.0
check "history records the failure" grep -q '0.2.0 -> 0.3.0 failed' $STATE/history.log
run_updater
check "failed version skipped on the next run (no retry loop)" test "$(state)" = skipped
check "still 0.2.0 after the skip" test "$(installed)" = 0.2.0

echo "== damaged checksum is refused"
publish 0.4.0 damaged
run_updater
check "damaged checksum refused (state error)" bash -c "test \"\$(python3 -c 'import json; d=json.load(open(\"$STATE/status.json\")); print(d[\"state\"], \"Checksum\" in d[\"message\"])')\" = 'error True'"
check "nothing installed" test "$(installed)" = 0.2.0

echo "== version inside the package must match the tag"
publish 0.5.0
run_updater
check "version file mismatch refused" bash -c "python3 -c 'import json; d=json.load(open(\"$STATE/status.json\")); assert d[\"state\"]==\"error\" and \"version file\" in d[\"message\"]'"
check "still 0.2.0" test "$(installed)" = 0.2.0

echo "== a second run steps aside"
publish 0.4.1
flock /run/faculty-security-update.lock sleep 4 &
holder=$!
sleep 0.5
before="$(cat $STATE/status.json)"
start=$(date +%s)
/usr/local/lib/faculty-security/update.sh >$W/second.log 2>&1; rc=$?
check "concurrent run exits at once with success" test "$rc" = 0 -a $(( $(date +%s) - start )) -lt 3
check "concurrent run says it steps aside" grep -q 'stepping aside' $W/second.log
check "concurrent run leaves the status alone" test "$(cat $STATE/status.json)" = "$before"
wait "$holder"

echo "== a later good release installs"
run_updater
check "0.4.1 installed" test "$(installed)" = 0.4.1
check "status updated to 0.4.1" test "$(state)" = updated
check "failed-version cleared" test ! -e $STATE/failed-version
check "program reports 0.4.1" test "$(running_version)" = 0.4.1
check "updater re-applied from the new package" grep -q 'updater of 0.4.1' /usr/local/lib/faculty-security/update.sh

echo "== switching off"
bash /opt/FacultySecurity/resources/updater/setup-auto-update.sh --disable >/dev/null
check "--disable removes config, request folder and units" bash -c "test ! -e /etc/faculty-security/update.conf -a ! -e $STATE/request -a ! -e /etc/systemd/system/faculty-security-update.timer"
check "--disable keeps the history" test -s $STATE/history.log

echo
echo "---- history.log"; cat $STATE/history.log
echo "---- passed: $PASSED, failed: $FAILED"
[[ $FAILED -eq 0 ]] || { echo "---- updater.log (tail)"; tail -n 60 $W/updater.log; exit 1; }
