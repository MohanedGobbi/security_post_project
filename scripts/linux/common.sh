# Shared helpers for the Linux scripts (sourced, not run).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ELECTRON_DIR="$ROOT/node_modules/electron/dist"
NODE_MAJOR_WANTED=24
YES=0   # 1 with --yes: every question is answered yes

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERR\033[0m %s\n' "$*" >&2; exit 1; }

# sudo when not root; nothing when root
as_root() {
  if [[ $EUID -eq 0 ]]; then "$@"; else sudo "$@"; fi
}

# apt, dnf, pacman or zypper; empty when none is found
package_manager() {
  local pm
  for pm in apt-get dnf pacman zypper; do
    if command -v "$pm" >/dev/null 2>&1; then echo "$pm"; return; fi
  done
}

# Vite 8 needs Node.js 20.19+ or 22.12+
node_is_recent() {
  command -v node >/dev/null 2>&1 || return 1
  node -e '
    const [a, b] = process.versions.node.split(".").map(Number)
    process.exit(a > 22 || (a === 22 && b >= 12) || (a === 20 && b >= 19) ? 0 : 1)
  '
}

# Electron's sandbox needs either unprivileged user namespaces or a setuid-root chrome-sandbox.
# Ubuntu 23.10+ blocks the first through AppArmor, some Debian kernels switch it off.
sandbox_needs_suid() {
  local v
  v="$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null || echo 0)"
  [[ "$v" == 1 ]] && return 0
  v="$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null || echo 1)"
  [[ "$v" == 0 ]] && return 0
  return 1
}

sandbox_is_suid() {
  local f="$ELECTRON_DIR/chrome-sandbox"
  [[ -f "$f" && -u "$f" && "$(stat -c %u "$f")" == 0 ]]
}

# a yes/no question; --yes answers yes, and without a terminal the script stops and says how to accept
confirm() {
  [[ $YES -eq 1 ]] && return 0
  [[ -t 0 ]] || die "$1 (run again with --yes to accept)"
  local reply
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[YyOo] ]]
}

# Node.js from the distribution (Arch) or from NodeSource (Debian, Ubuntu, Fedora, RHEL)
install_node() {
  local pm script
  pm="$(package_manager)"
  case "$pm" in
    pacman)
      as_root pacman -S --needed --noconfirm nodejs npm ;;
    apt-get|dnf)
      local host=deb.nodesource.com
      [[ "$pm" == dnf ]] && host=rpm.nodesource.com
      confirm "Node.js $NODE_MAJOR_WANTED is needed. Install it from NodeSource ($host)?" ||
        die "install Node.js 22.12 or newer, then run this again"
      script="$(mktemp)"
      curl -fsSL "https://$host/setup_${NODE_MAJOR_WANTED}.x" -o "$script"
      as_root bash "$script"
      rm -f "$script"
      as_root "$pm" install -y nodejs ;;
    *)
      die "install Node.js 22.12 or newer (https://nodejs.org or nvm), then run this again" ;;
  esac
}
