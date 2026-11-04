#!/usr/bin/env bash
# Removes the Faculty Security program from this PC. The data (registers, accounts, backups) is kept in
# ~/.config/FacultySecurity, so installing again brings everything back. This script never deletes the data.
set -euo pipefail

APP=security-register
[[ $EUID -eq 0 ]] && { echo "Run it without sudo: bash uninstall.sh" >&2; exit 1; }

if dpkg -s "$APP" >/dev/null 2>&1; then
  sudo apt-get remove -y "$APP"
  echo " ok program removed"
else
  echo " ok the program is not installed"
fi
rm -f "${XDG_CONFIG_HOME:-$HOME/.config}/autostart/$APP.desktop"

cat <<EOF

The data is kept in ~/.config/FacultySecurity.
To erase it for good (only after making a backup file you no longer need), delete that folder yourself:
  rm -r ~/.config/FacultySecurity
EOF
