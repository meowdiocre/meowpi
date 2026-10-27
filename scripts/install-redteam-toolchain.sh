#!/usr/bin/env bash
# Install the red-team toolchain this repository documents.
# Target: Ubuntu 24.04 (Debian-family). Run as root. Idempotent: safe to re-run.
#
#   bash scripts/install-redteam-toolchain.sh            # everything
#   bash scripts/install-redteam-toolchain.sh base go    # selected stages
#   STAGES="base" bash scripts/install-redteam-toolchain.sh
#
# Stages: base go pipx john release wordlists metasploit node mitm shell
set -euo pipefail

log() { printf '\n== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
apt_install() { DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "$@"; }
# apt is atomic: one unknown name aborts the batch. Filter to what this archive has.
apt_available() {
  local out=() p
  for p in "$@"; do
    if apt-cache policy "$p" 2>/dev/null | grep -q 'Candidate: [0-9]'; then out+=("$p"); else log "skip (not in archive): $p"; fi
  done
  ((${#out[@]})) && apt_install "${out[@]}"
}

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
grep -qi 'ubuntu\|debian' /etc/os-release || { echo "Debian-family only" >&2; exit 1; }

STAGES=("$@")
if ((${#STAGES[@]} == 0)); then STAGES=(base go pipx john release wordlists metasploit node mitm shell); fi
want() { local s; for s in "${STAGES[@]}"; do [[ $s == "$1" ]] && return 0; done; return 1; }

# ---------------------------------------------------------------- base
if want base; then
  log "base packages"
  apt-get update -qq
  apt_install zsh git curl wget ca-certificates gnupg unzip p7zip-full pipx \
    python3-venv python3-dev build-essential pkg-config libssl-dev libffi-dev \
    libxml2-dev libxslt1-dev zlib1g-dev libpcap-dev libreadline-dev libyaml-dev \
    nmap masscan netcat-openbsd socat proxychains4 dnsutils whois rlwrap \
    sqlmap hydra john hashcat smbclient ldap-utils krb5-user ruby-full \
    tmux fzf bat ripgrep jq htop tree ncdu file vim libimage-exiftool-perl \
    gdb radare2 binwalk nfs-common sshuttle wireguard-tools openvpn nbtscan \
    bettercap nikto whatweb smbmap python3-impacket python3-netifaces \
    python3-pycryptodome grc zoxide fd-find command-not-found postgresql \
    libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libcups2t64 \
    libasound2t64 libgbm1 libpango-1.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 samba-common-bin ocl-icd-libopencl1 pocl-opencl-icd
  pipx ensurepath >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------- go
if want go; then
  log "Go toolchains (1.26 pinned for nuclei, 1.27 default)"
  for tuple in "go1.26.10:/opt/go126" "go1.27.3:/usr/local/go"; do
    ver=${tuple%%:*}; dir=${tuple##*:}
    [[ -x $dir/bin/go ]] && { log "have $ver"; continue; }
    curl -fsSL "https://go.dev/dl/${ver}.linux-amd64.tar.gz" -o /tmp/go.tgz
    mkdir -p "$dir"; tar -C "$dir" --strip-components=1 -xzf /tmp/go.tgz; rm -f /tmp/go.tgz
  done
  mkdir -p /opt/tools
  export GOBIN=/opt/tools GOPATH=/root/go CGO_ENABLED=0 PATH=/opt/go126/bin:$PATH
  for pkg in \
    github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest \
    github.com/projectdiscovery/httpx/cmd/httpx@latest \
    github.com/projectdiscovery/naabu/v2/cmd/naabu@latest \
    github.com/projectdiscovery/dnsx/cmd/dnsx@latest \
    github.com/projectdiscovery/katana/cmd/katana@latest \
    github.com/ffuf/ffuf/v2@latest github.com/OJ/gobuster/v3@latest \
    github.com/owasp-amass/amass/v4/cmd/amass@latest \
    github.com/ropnop/kerbrute@latest github.com/jpillora/chisel@latest \
    github.com/nicocha30/ligolo-ng/cmd/proxy@latest \
    github.com/nicocha30/ligolo-ng/cmd/agent@latest \
    github.com/lc/gau/v2/cmd/gau@latest github.com/tomnomnom/anew@latest \
    github.com/tomnomnom/assetfinder@latest github.com/tomnomnom/waybackurls@latest \
    github.com/cheat/cheat/cmd/cheat@latest; do
    go install "$pkg" || log "warn: $pkg failed"
  done
  # nuclei needs Go <= 1.26 for its sonic/ast code templates
  go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
  /opt/tools/nuclei -update-templates >/dev/null 2>&1 || true
  # jsluice embeds tree-sitter and therefore needs cgo
  CGO_ENABLED=1 go install github.com/BishopFox/jsluice/cmd/jsluice@latest || log "warn: jsluice needs a C compiler"
  [[ -f /opt/tools/proxy ]] && mv -f /opt/tools/proxy /opt/tools/ligolo-proxy
  [[ -f /opt/tools/agent ]] && mv -f /opt/tools/agent /opt/tools/ligolo-agent
fi

# ---------------------------------------------------------------- pipx
if want pipx; then
  log "Python offensive tools (pipx)"
  export PATH=/root/.local/bin:$PATH
  # PyPI names the egress proxy may block; fall back to git for these.
  for p in impacket certipy-ad coercer mitm6 bloodhound pypykatz lsassy donpapi \
           wesng dirsearch bloodyad pwntools mitmproxy mitmproxy2swagger \
           garak pyrit deepteam promptmap skill-scanner snyk-agent-scan \
           agentic-radar fickling picklescan; do
    pipx install --force "$p" >/dev/null 2>&1 && log "ok $p" || log "warn: $p failed"
  done
  pipx install --force git+https://github.com/Pennyw0rth/NetExec.git >/dev/null 2>&1 || log "warn: netexec from git failed"
  git clone -q --depth 1 https://github.com/cddmp/enum4linux-ng /opt/repos/enum4linux-ng 2>/dev/null || true
  pipx install --force /opt/repos/enum4linux-ng >/dev/null 2>&1 || log "warn: enum4linux-ng failed"
  # mitmproxy-mcp imports mcp.server.fastmcp, removed in mcp 2.x
  pipx inject --force mitmproxy-mcp 'mcp<2' >/dev/null 2>&1 || true
  gem install --no-document evil-winrm wpscan >/dev/null 2>&1 || log "warn: ruby gems failed"
fi

# ---------------------------------------------------------------- john
if want john; then
  log "John the Ripper jumbo (distro package is core: no NTLM, no --list=formats)"
  if ! /usr/local/bin/john --list=build-info 2>/dev/null | grep -q jumbo; then
    git clone -q --depth 1 https://github.com/openwall/john /tmp/john-src
    ( cd /tmp/john-src/src && ./configure --without-asm >/dev/null 2>&1 && make -sj"$(nproc)" >/dev/null 2>&1 )
    mkdir -p /opt/john && cp -a /tmp/john-src/run /opt/john/jumbo && chmod -R a+rX /opt/john
    rm -rf /tmp/john-src
    # the binary resolves john.conf beside argv[0], so wrap it instead of symlinking
    printf '#!/bin/sh\nexec /opt/john/jumbo/john "$@"\n' > /usr/local/bin/john
    chmod +x /usr/local/bin/john
  fi
  /usr/local/bin/john --list=build-info | head -1
fi

# ---------------------------------------------------------------- release
if want release; then
  log "prebuilt binaries and Windows payloads"
  mkdir -p /opt/tools /opt/windows-tools
  curl -fsSL -o /tmp/fx.tgz https://github.com/epi052/feroxbuster/releases/latest/download/x86_64-linux-feroxbuster.tar.gz \
    && tar -xzf /tmp/fx.tgz -C /opt/tools && chmod +x /opt/tools/feroxbuster && rm -f /tmp/fx.tgz
  curl -fsSL -o /opt/tools/sliver-server https://github.com/BishopFox/sliver/releases/latest/download/sliver-server_linux-amd64 \
    && chmod +x /opt/tools/sliver-server
  for f in Rubeus.exe Certify.exe Seatbelt.exe; do
    curl -fsSL -o "/opt/windows-tools/$f" "https://github.com/r3motecontrol/Ghostpack-CompiledBinaries/raw/master/$f" || log "warn: $f"
  done
  curl -fsSL -o /tmp/sh.zip https://github.com/SpecterOps/SharpHound/releases/latest/download/SharpHound_v2.17.1_windows_x86.zip \
    && unzip -qo /tmp/sh.zip -d /opt/windows-tools/sharp-hound && rm -f /tmp/sh.zip
  curl -fsSL -o /tmp/mimi.zip https://github.com/gentilkiwi/mimikatz/releases/latest/download/mimikatz_trunk.zip \
    && unzip -qo /tmp/mimi.zip -d /opt/windows-tools/mimikatz && rm -f /tmp/mimi.zip
  curl -fsSL -o /opt/windows-tools/linpeas.sh https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh
  curl -fsSL -o /opt/windows-tools/winPEASx64.exe https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe
  curl -fsSL -o /opt/windows-tools/PowerView.ps1 https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/master/Recon/PowerView.ps1
  curl -fsSL -o /opt/windows-tools/PowerUp.ps1 https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/master/Privesc/PowerUp.ps1
  curl -fsSL -o /opt/windows-tools/PrivescCheck.ps1 https://github.com/itm4n/PrivescCheck/releases/latest/download/PrivescCheck.ps1
  chmod +x /opt/windows-tools/linpeas.sh
fi

# ---------------------------------------------------------------- wordlists
if want wordlists; then
  log "wordlists"
  mkdir -p /opt/repos /opt/wordlists
  [[ -d /opt/repos/SecLists ]] || git clone -q --depth 1 https://github.com/danielmiessler/SecLists /opt/repos/SecLists
  [[ -d /opt/repos/PayloadsAllTheThings ]] || git clone -q --depth 1 https://github.com/swisskyrepo/PayloadsAllTheThings /opt/repos/PayloadsAllTheThings
  S=/opt/repos/SecLists
  ln -sf "$S/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt" /opt/wordlists/dir-medium.txt
  ln -sf "$S/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt" /opt/wordlists/dir-big.txt
  ln -sf "$S/Discovery/Web-Content/common.txt" /opt/wordlists/web-common.txt
  ln -sf "$S/Discovery/DNS/subdomains-top1million-20000.txt" /opt/wordlists/subs-20k.txt
  ln -sf "$S/Usernames/top-usernames-shortlist.txt" /opt/wordlists/users-top.txt
  ln -sf "$S/Passwords/Common-Credentials/10k-most-common.txt" /opt/wordlists/pass-1050.txt
  ln -sf "$S/Passwords/Common-Credentials/Pwdb_top-1000000.txt" /opt/wordlists/pass-top1m.txt
  [[ -f /opt/wordlists/rockyou.txt ]] || tar -xzf "$S/Passwords/Leaked-Databases/rockyou.txt.tar.gz" -C /opt/wordlists
  [[ -d /opt/repos/Responder ]] || git clone -q --depth 1 https://github.com/lgandx/Responder /opt/repos/Responder
  [[ -d /opt/cheatsheets ]] || git clone -q --depth 1 https://github.com/cheat/cheatsheets /opt/cheatsheets
fi

# ---------------------------------------------------------------- metasploit
if want metasploit; then
  log "Metasploit + Postgres"
  if ! have msfconsole; then
    curl -fsSL https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb -o /tmp/msfinstall
    bash /tmp/msfinstall && rm -f /tmp/msfinstall
  fi
  systemctl enable --now postgresql
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='msf'\"" | grep -q 1 \
    || su postgres -c "psql -q -c \"CREATE USER msf WITH PASSWORD 'msf' CREATEDB;\""
  su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='msf'\"" | grep -q 1 \
    || su postgres -c "createdb -O msf msf"
  mkdir -p /root/.msf4
  cat > /root/.msf4/database.yml <<'EOF'
production:
  adapter: postgresql
  database: msf
  username: msf
  password: msf
  host: 127.0.0.1
  port: 5432
  pool: 75
  timeout: 5
EOF
  log "verify: msfconsole -q -x 'db_status; exit'"
fi

# ---------------------------------------------------------------- node
if want node; then
  log "Node 24 + webcrack + chrome-devtools-mcp + Chrome for Testing"
  if [[ ! -x /opt/node/bin/node ]]; then
    V=$(curl -fsS https://nodejs.org/dist/index.json | jq -r '[.[]|select(.lts!=false)][0].version')
    curl -fsSL "https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz" -o /tmp/node.tar.xz
    mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 && rm -f /tmp/node.tar.xz
  fi
  export PATH=/opt/node/bin:$PATH
  npm install -g --silent webcrack chrome-devtools-mcp
  [[ -d /opt/chrome ]] || npx --yes @puppeteer/browsers install chrome@stable --path /opt/chrome
fi

# ---------------------------------------------------------------- mitm
if want mitm; then
  log "mitmproxy CA + config dir"
  /root/.local/bin/mitmdump --version >/dev/null 2>&1 || log "warn: mitmproxy not installed"
  mkdir -p /root/.mitmproxy /root/.omp/captures
fi

# ---------------------------------------------------------------- shell
if want shell; then
  log "shell integration"
  cat > /etc/profile.d/10-redteam.sh <<'EOF'
# Red team toolchain PATH. go1.26 is pinned first: nuclei's sonic/ast needs <=1.26.
export PATH="/opt/node/bin:/opt/go126/bin:/opt/tools:/opt/segfault/bin:/root/.local/bin:/opt/repos/Responder:$PATH"
export GOPATH="/root/go"
export GOBIN="/opt/tools"
EOF
  chmod +x /etc/profile.d/10-redteam.sh
  grep -q 10-redteam /etc/zsh/zshenv || printf '\n[ -f /etc/profile.d/10-redteam.sh ] && . /etc/profile.d/10-redteam.sh\n' >> /etc/zsh/zshenv
  chsh -s /bin/zsh root || true
  log "copy shell files: bash scripts/install-host-config.sh"
fi

log "done"
echo "verify with: redteam-check --full"