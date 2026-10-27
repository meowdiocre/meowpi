#!/usr/bin/env bash
# Tool inventory / smoke test for the red-team workstation.
# Usage: redteam-check [--full]      (--full also runs <tool> --version, slower)
set -u
export PATH="/opt/segfault/bin:/root/.local/bin:/opt/tools:/usr/local/go/bin:/opt/repos/Responder:$PATH"
FULL=0; [[ ${1:-} == --full ]] && FULL=1
ok=0; bad=0; miss=()

chkfn() { # zsh functions defined by /opt/segfault/shellrc.sh
  local f found=""
  for f in "$@"; do
    if zsh -ic "whence -w $f >/dev/null 2>&1" 2>/dev/null; then found+=" $f"; else found+=" !$f"; ((bad++)); fi
  done
  printf '%-14s %-22s \033[32mok\033[0m %s\n' shell "zsh fns" "$found"
  ((ok++))
}

chk() { # chk <category> <cmd> [probe-args...]
  local cat=$1 cmd=$2; shift 2
  local p; p=$(command -v "$cmd" 2>/dev/null) || p=""
  if [[ -z $p ]]; then
    printf '%-14s %-22s \033[31mMISSING\033[0m\n' "$cat" "$cmd"; miss+=("$cmd"); ((bad++)); return
  fi
  local v=""
  if (( FULL )) && [[ $# -gt 0 ]]; then v=$(timeout 25 "$cmd" "$@" 2>&1 | head -1 | cut -c1-48); fi
  printf '%-14s %-22s \033[32mok\033[0m  %s\n' "$cat" "$cmd" "$v"
  ((ok++))
}

echo "== shell =="
chk shell   zsh --version
chk shell   msfconsole --version
echo "== ad / windows =="
chk ad nxc --version
chk ad netexec --version
chk ad secretsdump.py
chk ad ntlmrelayx.py
chk ad psexec.py
chk ad wmiexec.py
chk ad GetUserSPNs.py
chk ad GetNPUsers.py
chk ad ticketer.py
chk ad getTGT.py
chk ad getST.py
chk ad ntlmrelayx.py
chk ad certipy --version
chk ad bloodhound-python
chk ad enum4linux-ng --help
chk ad mitm6 --help
chk ad coercer --help
chk ad bloodyad --help
chk ad pypykatz --version
chk ad lsassy --help
chk ad donpapi --help
chk ad kerbrute
chk ad smbclient --version
chk ad rpcclient
chk ad evil-winrm --version
echo "== web / recon =="
chk recon subfinder -version
chk recon httpx -version
chk recon nuclei -version
chk recon naabu -version
chk recon dnsx -version
chk recon katana -version
chk recon amass -version
chk recon gau --version
chk recon assetfinder --help
chk recon waybackurls --help
chk web   ffuf -V
chk web   gobuster version
chk web   feroxbuster --version
chk web   dirsearch --version
chk web   nikto -Version
chk web   whatweb --version
chk web   wpscan --version
chk web   sqlmap --version
echo "== creds =="
chk creds hashcat --version
chk creds john --list=build-info
chk creds hydra -h
echo "== pivot / c2 =="
chk pivot chisel --version
chk pivot ligolo-proxy -version
chk pivot ligolo-agent -version
chk pivot proxychains4 -h
chk pivot socat -V
chk pivot sshuttle --version
chk pivot nmap --version
chk pivot masscan --version
chk pivot sliver-server version
chk pivot msfconsole --version
echo "== re / misc =="
chk re    gdb --version
chk re    r2 -v
chk re    binwalk --help
chk re    exiftool -ver
chk misc  jq --version
chk misc  tmux -V
chk misc  fzf --version
chk misc  rg --version
echo "== segfault (adapted subset) =="
chk sf    asnl
chk sf    crt
chk sf    dns
chk sf    io
chk sf    io2
chk sf    ptr
chk sf    rdns
chk sf    resolv
chk sf    transfer
chk sf    sshj
chk sf    xssh
chk sf    gssec
chk sf    find_subdomains
chk sf    addfileextension
chk sf    supervise
chk misc  cheat
chk misc  grc
chk misc  zoxide
chk misc  fdfind
chkfn hl hgrep PROXY TOR xor noansi urldecode lf lsg v
echo "== ai / llm security =="
chk ai    garak --version
chk ai    pyrit_scan --help
chk ai    deepteam --help
chk ai    fickling --help
chk ai    picklescan -h
chk ai    promptmap --help
chk ai    skill-scanner --help
chk ai    snyk-agent-scan scan --help
chk ai    agentic-radar --help
echo "== web traffic / client-side js =="
chk traffic mitmdump --version
chk traffic mitmweb --version
chk traffic mitmproxy2swagger --help
chk traffic mitmproxy-mcp --help
chk traffic jsluice --help
chk traffic webcrack --help
chk traffic chrome-devtools-mcp --help
chk traffic node --version
echo
echo "wordlists: $(du -sh /opt/repos/SecLists 2>/dev/null | cut -f1) SecLists | $(du -sh /opt/repos/PayloadsAllTheThings 2>/dev/null | cut -f1) PayloadsAllTheThings"
echo "windows payloads: $(ls /opt/windows-tools 2>/dev/null | tr '\n' ' ')"
echo "ok=$ok  missing=$bad ${miss[*]:-}"