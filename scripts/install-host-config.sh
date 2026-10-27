#!/usr/bin/env bash
# Install this machine's host configuration from config/host/ into the system trees.
# Every file it replaces is backed up first: <path>.bak-<timestamp>.
#
#   bash scripts/install-host-config.sh          # zsh, p10k, ssh, vim, tern, checker
#   bash scripts/install-host-config.sh --dry-run
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
STAMP=$(date +%Y%m%d-%H%M%S)
DRY=0
[[ ${1:-} == --dry-run ]] && DRY=1

say() { printf '%-46s %s\n' "$1" "$2"; }

install_file() { # install_file <source> <destination>
  local src=$1 dst=$2
  if (( DRY )); then say "$dst" "would install"; return; fi
  mkdir -p "$(dirname "$dst")"
  [[ -e $dst ]] && cp -a "$dst" "$dst.bak-$STAMP"
  cp -a "$src" "$dst"
  say "$dst" "installed"
}

# --- shell ---------------------------------------------------------------
install_file "$ROOT/config/host/zsh/zshrc" "$HOME/.zshrc"
install_file "$ROOT/config/host/zsh/p10k.zsh" "$HOME/.p10k.zsh"

# --- system --------------------------------------------------------------
if [[ $EUID -eq 0 ]]; then
  install_file "$ROOT/config/host/profile.d/10-redteam.sh" /etc/profile.d/10-redteam.sh
  install_file "$ROOT/config/host/ssh/99-redteam.conf" /etc/ssh/ssh_config.d/99-redteam.conf
  install_file "$ROOT/config/host/vim/vimrc.local" /etc/vim/vimrc.local

  if ! grep -q 10-redteam /etc/zsh/zshenv 2>/dev/null; then
    (( DRY )) || printf '\n# red team toolchain PATH (all zsh invocations)\n[ -f /etc/profile.d/10-redteam.sh ] && . /etc/profile.d/10-redteam.sh\n' >> /etc/zsh/zshenv
    say /etc/zsh/zshenv "hook added"
  fi

  install_file "$ROOT/scripts/redteam-check.sh" /opt/redteam-check.sh
  (( DRY )) || chmod +x /opt/redteam-check.sh
  (( DRY )) || ln -sf /opt/redteam-check.sh /usr/local/bin/redteam-check
  say /usr/local/bin/redteam-check "linked"
else
  say "system files" "skipped (not root)"
fi

# --- Tern ----------------------------------------------------------------
install_file "$ROOT/config/host/tern/settings.json" "$HOME/.config/tern/settings.json"

# --- default shell -------------------------------------------------------
if [[ $(getent passwd "${SUDO_USER:-$USER}" | cut -d: -f7) != /bin/zsh ]]; then
  if (( DRY )); then say "login shell" "would chsh to /bin/zsh"; else
    chsh -s /bin/zsh "${SUDO_USER:-$USER}" && say "login shell" "/bin/zsh"
  fi
fi

cat <<'EOF'

Next:
  exec zsh                       # this pane
  redteam-check --full           # expect ok=N missing=0
  systemctl restart tern-daemon  # new panes read /etc/passwd (kills open panes)
EOF