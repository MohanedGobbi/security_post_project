#!/usr/bin/env bash
# Installs the Faculty Security program (برنامج إدارة الأمن بالكلية) on this PC from the .deb next to this script.
# Works offline on Ubuntu 22.04 / 24.04, Debian 12 / 13 and Linux Mint 21 / 22. Run it as the person who will use
# the program, not as root: it asks for the sudo password when it needs it. Running it again is safe (it updates).
set -euo pipefail

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: bash install.sh [options]

  --autostart      open the program every time this user logs in (recommended on the security office PC)
  --no-autostart   do not ask about it
  --keep-awake     never blank the screen or go to sleep (GNOME, Ubuntu's desktop)
  --yes            answer yes to every question (autostart and keep-awake included)

The dean's access over the faculty network (switched on later, in the program: Administration > System):
  --dean-ip IP     the address of the dean's PC: opens it in this PC's firewall (can be repeated)
  --port N         the port of that access (default 8443)
  --fixed-ip A/N   give this PC a fixed address on the faculty network, for example 192.168.1.50/24
  --gateway IP     the network's gateway (the router), needed with --fixed-ip
  --dns IP         a DNS server for --fixed-ip (default: the gateway)
  -h, --help       show this help
EOF
}

AUTOSTART="" AWAKE="" YES=0 PORT=8443 FIXED="" GATEWAY="" DNS=""
DEAN_IPS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dean-ip) [[ $# -ge 2 ]] || die "--dean-ip needs an address"; DEAN_IPS+=("$2"); shift ;;
    --port) [[ $# -ge 2 ]] || die "--port needs a number"; PORT="$2"; shift ;;
    --fixed-ip) [[ $# -ge 2 ]] || die "--fixed-ip needs an address like 192.168.1.50/24"; FIXED="$2"; shift ;;
    --gateway) [[ $# -ge 2 ]] || die "--gateway needs an address"; GATEWAY="$2"; shift ;;
    --dns) [[ $# -ge 2 ]] || die "--dns needs an address"; DNS="$2"; shift ;;
    --autostart) AUTOSTART=1 ;;
    --no-autostart) AUTOSTART=0 ;;
    --keep-awake) AWAKE=1 ;;
    --yes|-y) YES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "unknown option: $1" ;;
  esac
  shift
done

ask() {
  [[ $YES -eq 1 ]] && return 0
  [[ -t 0 ]] || return 1
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[YyOo] ]]
}

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP=security-register
DESKTOP=/usr/share/applications/$APP.desktop

[[ $EUID -eq 0 ]] && die "run this as the user who will use the program, without sudo: bash install.sh"
[[ "$(uname -s)" == Linux ]] || die "this installer is for Linux"
[[ "$(uname -m)" == x86_64 ]] || die "this package is for 64-bit Intel/AMD PCs (found: $(uname -m))"
command -v apt-get >/dev/null 2>&1 || die "this package needs a Debian-based system (Ubuntu, Debian, Linux Mint)"
command -v sudo >/dev/null 2>&1 || die "sudo is needed"

shopt -s nullglob
debs=("$HERE"/FacultySecurity-*-amd64.deb)
[[ ${#debs[@]} -eq 1 ]] || die "put exactly one FacultySecurity-*-amd64.deb next to this script (found ${#debs[@]})"
DEB="${debs[0]}"

say "Faculty Security installer"
if [[ -f "$HERE/SHA256SUMS.txt" ]]; then
  (cd "$HERE" && sha256sum --check --quiet SHA256SUMS.txt) || die "the package is damaged (checksum mismatch): copy it again"
  ok "package checked ($(basename "$DEB"))"
fi

# --- the program -------------------------------------------------------------
say "Installing the program (asks for your password)"
# apt installs the package and any missing library; with no internet it uses what the PC already has
if ! sudo apt-get install -y "$DEB"; then
  warn "apt could not install everything. If this PC has no internet, connect it once and run this again."
  die "installation failed"
fi
ok "installed in /opt/FacultySecurity"

# --- the dean's access over the faculty network -------------------------------------
# The program serves the dean over HTTPS and makes its own certificate with openssl.
if ! command -v openssl >/dev/null 2>&1; then
  say "Installing openssl (for the dean's secure connection)"
  sudo apt-get install -y openssl && ok "openssl installed" || warn "openssl could not be installed: the dean's network access will not start until it is"
else
  ok "openssl present"
fi
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || die "--port must be a number between 1024 and 65535"
for ip in "${DEAN_IPS[@]}"; do
  [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "not an IPv4 address: $ip"
done
if [[ ${#DEAN_IPS[@]} -gt 0 ]]; then
  if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    for ip in "${DEAN_IPS[@]}"; do
      sudo ufw allow from "$ip" to any port "$PORT" proto tcp >/dev/null && ok "firewall: $ip may reach port $PORT"
    done
  else
    ok "no active firewall (ufw): nothing to open. The program itself only answers the addresses you list in Administration > System."
  fi
fi

# --- a fixed address for this PC (so the dean's bookmark always works) -------------
if [[ -n "$FIXED" ]]; then
  [[ "$FIXED" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$ ]] || die "--fixed-ip must look like 192.168.1.50/24"
  [[ "$GATEWAY" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || die "--fixed-ip also needs --gateway (the router's address)"
  command -v nmcli >/dev/null 2>&1 || die "nmcli (NetworkManager) is needed for --fixed-ip: set the address in the network settings instead"
  CON="$(nmcli -t -f NAME,TYPE,DEVICE connection show --active | awk -F: '$2 ~ /ethernet/ {print $1; exit}')"
  [[ -n "$CON" ]] || CON="$(nmcli -t -f NAME,TYPE,DEVICE connection show --active | awk -F: '$2 ~ /wireless/ {print $1; exit}')"
  [[ -n "$CON" ]] || die "no active network connection found"
  say "Fixed address $FIXED, gateway $GATEWAY on the connection '$CON'"
  if ask "Apply it now? The network restarts for a moment."; then
    sudo nmcli connection modify "$CON" ipv4.method manual ipv4.addresses "$FIXED" ipv4.gateway "$GATEWAY" ipv4.dns "${DNS:-$GATEWAY}"
    sudo nmcli connection up "$CON" >/dev/null && ok "the PC now uses ${FIXED%/*}"
    echo "    To go back to automatic addresses:  nmcli connection modify \"$CON\" ipv4.method auto && nmcli connection up \"$CON\""
  else
    warn "fixed address not applied"
  fi
fi

# --- the keyring that protects the data key ------------------------------------
if [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]]; then
  ok "keyring: KDE Wallet"
elif dpkg -s gnome-keyring >/dev/null 2>&1; then
  ok "keyring: GNOME keyring"
else
  warn "no keyring is installed: the data key would only be obfuscated."
  if ask "Install gnome-keyring now (needs internet)?"; then
    sudo apt-get install -y gnome-keyring && ok "keyring installed (log out and back in once)"
  fi
fi

# --- webcam --------------------------------------------------------------------
if compgen -G '/dev/video*' >/dev/null; then
  cam="$(compgen -G '/dev/video*' | head -n1)"
  group="$(stat -c %G "$cam")"
  if [[ -r "$cam" ]] || id -nG "$USER" | tr ' ' '\n' | grep -qx "$group"; then
    ok "webcam found ($cam)"
  else
    sudo usermod -aG "$group" "$USER"
    warn "added $USER to the '$group' group for the webcam: log out and back in once"
  fi
else
  warn "no webcam found: plug it in before scanning ID cards (the program works without it)"
fi

# --- start with the session ----------------------------------------------------
if [[ -z "$AUTOSTART" ]]; then
  if ask "Open the program automatically every time $USER logs in?"; then AUTOSTART=1; else AUTOSTART=0; fi
fi
AUTOSTART_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/$APP.desktop"
if [[ "$AUTOSTART" == 1 ]]; then
  mkdir -p "$(dirname "$AUTOSTART_FILE")"
  cp "$DESKTOP" "$AUTOSTART_FILE"
  ok "opens at login (delete $AUTOSTART_FILE to stop that)"
fi

# --- never sleep (GNOME) ---------------------------------------------------------
if [[ -z "$AWAKE" ]]; then
  if command -v gsettings >/dev/null 2>&1 && ask "Keep the screen on and never go to sleep (security office PC)?"; then AWAKE=1; fi
fi
if [[ "$AWAKE" == 1 ]] && command -v gsettings >/dev/null 2>&1; then
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
  ok "screen stays on, no sleep on mains power"
fi

cat <<EOF

The program is installed.

  Start it:       applications menu > "برنامج إدارة الأمن بالكلية" (Faculty Security), or the command: $APP
  First login:    administrator PIN 246810, team leader PIN 135790
                  Change both at once: Administration > Accounts > Change PIN
  Data folder:    ~/.config/FacultySecurity  (back it up with the System tab, not by copying this folder)
  Manual:         the 3-User-Manual folder of this kit

The dean's access over the faculty network (off until you switch it on):
  1. Administration > Accounts > Add user: the dean's name, level "Dean", a PIN of 6 digits or more.
  2. Administration > System > "The dean's access over the faculty network": tick it, enter the dean's PC address, Save.
  3. The dean opens the address shown there in a browser (for example https://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT)
     and accepts the certificate warning once. This PC's address(es): $(hostname -I 2>/dev/null || echo unknown)

EOF
