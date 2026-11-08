#!/usr/bin/env bash
# Builds ONE self-contained installer file, FacultySecurity-Install.sh: the .deb and the kit's scripts packed inside it.
# On the security office PC:   bash FacultySecurity-Install.sh [options]      (options: see install.sh --help)
# Usage here:  scripts/linux/make-single-installer.sh <the .deb> <output folder>
set -euo pipefail

DEB="${1:?usage: make-single-installer.sh <package.deb> <output folder>}"
OUT="${2:?usage: make-single-installer.sh <package.deb> <output folder>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp "$DEB" "$STAGE/"
cp "$HERE"/kit/install.sh "$HERE"/kit/uninstall.sh "$HERE"/kit/check-pc.sh "$STAGE/"
(cd "$STAGE" && sha256sum "$(basename "$DEB")" > SHA256SUMS.txt)
tar -C "$STAGE" -czf "$STAGE/payload.tgz" "$(basename "$DEB")" SHA256SUMS.txt install.sh uninstall.sh check-pc.sh

mkdir -p "$OUT"
TARGET="$OUT/FacultySecurity-Install.sh"
{
  cat <<'STUB'
#!/usr/bin/env bash
# Faculty Security Management: single-file installer (برنامج إدارة الأمن بالكلية).
# Run it as the user of the security office PC, not as root:   bash FacultySecurity-Install.sh
# Options (all optional):  --yes  --autostart  --keep-awake  --dean-ip IP  --port N  --fixed-ip A/N --gateway IP  (see --help)
# The program package and the install scripts are inside this file.
set -euo pipefail
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  LINE="$(LC_ALL=C grep -a -n -m1 '^__PAYLOAD_BELOW__$' "$0" | cut -d: -f1)"
  tail -n +"$((LINE + 1))" "$0" | tar -xz -C "$TMP" install.sh
  bash "$TMP/install.sh" --help
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
LINE="$(LC_ALL=C grep -a -n -m1 '^__PAYLOAD_BELOW__$' "$0" | cut -d: -f1)"
[[ -n "$LINE" ]] || { echo "ERR this file is damaged (no package inside): copy it again" >&2; exit 1; }
printf '\033[1;34m==>\033[0m Unpacking the installer...\n'
tail -n +"$((LINE + 1))" "$0" | tar -xz -C "$TMP" || { echo "ERR this file is damaged: copy it again" >&2; exit 1; }
cd "$TMP"
bash ./install.sh "$@"
exit $?
__PAYLOAD_BELOW__
STUB
  cat "$STAGE/payload.tgz"
} > "$TARGET"
chmod +x "$TARGET"
echo "written $TARGET ($(du -h "$TARGET" | cut -f1))"
