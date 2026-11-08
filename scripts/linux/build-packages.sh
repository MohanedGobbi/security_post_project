#!/usr/bin/env bash
# Builds installable Linux packages of Faculty Security into release/ (run setup.sh once before, on this build machine).
# The .deb installs into /opt/FacultySecurity with a menu entry; it is the package to use on Debian, Ubuntu and Mint.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

usage() {
  cat <<EOF
Usage: scripts/linux/build-packages.sh [--deb] [--rpm] [--appimage] [--all]

  --deb        Debian / Ubuntu / Mint package (the default)
  --rpm        Fedora / RHEL / openSUSE package (needs rpmbuild: sudo apt install rpm, or sudo dnf install rpm-build)
  --appimage   one file that runs on most distributions (its sandbox: see the Linux section of README.md)
  --all        all three
EOF
}

targets=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --deb) targets+=(deb) ;;
    --rpm) targets+=(rpm) ;;
    --appimage) targets+=(AppImage) ;;
    --all) targets=(deb rpm AppImage) ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "unknown option: $1" ;;
  esac
  shift
done
[[ ${#targets[@]} -eq 0 ]] && targets=(deb)

cd "$ROOT"
[[ -d node_modules/electron-builder ]] || die "run scripts/linux/setup.sh first (npm packages are missing)"
if [[ " ${targets[*]} " == *" rpm "* ]] && ! command -v rpmbuild >/dev/null 2>&1; then
  die "the rpm package needs rpmbuild (sudo apt install rpm, or sudo dnf install rpm-build)"
fi

say "Building the program"
node scripts/release/write-version.mjs
npm run build

say "Packaging: ${targets[*]}"
npx electron-builder --linux "${targets[@]}" --publish never

echo
ok "packages in $ROOT/release:"
find release -maxdepth 1 -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' \) -printf '  %f  (%s bytes)\n'
cat <<EOF

Install on a gate PC (copy the file there first):
  sudo apt install ./FacultySecurity-*.deb          Debian, Ubuntu, Mint
  sudo dnf install ./FacultySecurity-*.rpm          Fedora, RHEL
EOF
