#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail
umask 077
[[ "${PREFIX:-}" == /data/data/com.termux/files/usr ]] || { echo 'FAIL: expected standard Termux PREFIX'; exit 10; }
[[ "$(uname -m)" == aarch64 ]] || { echo 'FAIL: ARM64 Termux required'; exit 11; }
mkdir -p "$HOME/m51-ai-server/logs"
LOG="$HOME/m51-ai-server/logs/bootstrap-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
trap 'code=$?; echo "bootstrap exit=$code log=$LOG"' EXIT
for tool in apt-get dpkg; do command -v "$tool" || { echo "FAIL: missing $tool; manual repair required"; exit 12; }; done
echo 'Checking package and shared-library state (no root)...'
dpkg --audit || true
curl --version || true
openssl version || true
export DEBIAN_FRONTEND=noninteractive
if ! apt-get update -o APT::Update::Error-Mode=any; then
    echo 'FAIL: signed repository update failed. No downloaded binary will be run. Check repository/network.'
    exit 20
fi
if ! apt-get -y --no-remove -o Dpkg::Options::=--force-confold full-upgrade; then
    echo 'Attempting controlled repair using authenticated apt packages only...'
    # apt verifies signed repository metadata and package hashes. Never disable verification.
    apt-get -y --download-only --reinstall install openssl libcurl curl || { echo 'FAIL: authenticated package download unavailable'; exit 21; }
    shopt -s nullglob
    for package in openssl libcurl curl; do
        files=("$PREFIX/var/cache/apt/archives/${package}_"*.deb)
        ((${#files[@]} == 1)) || { echo "FAIL: expected exactly one authenticated archive for $package"; exit 22; }
        dpkg --unpack "${files[0]}" || { echo "FAIL: unpack $package; preserve data and inspect log"; exit 23; }
    done
    dpkg --configure -a || apt-get -y --no-remove --fix-broken install
    apt-get -y --no-remove -o Dpkg::Options::=--force-confold full-upgrade || exit 24
fi
curl --version && openssl version || { echo 'FAIL: library mismatch persists'; exit 25; }
apt-get install -y --no-remove openssh || exit 30
ssh-keygen -A
sshd -t || exit 31
# Use Termux's existing SSH config, preserving working login methods.
if ! ssh-keyscan -T 4 -p 8022 127.0.0.1 2>/dev/null | grep -q 'ssh-'; then
    sshd -p 8022 || exit 32
fi
ssh-keyscan -T 5 -p 8022 127.0.0.1 2>/dev/null | grep -q 'ssh-' || { echo 'FAIL: no SSH handshake on 8022'; exit 33; }
echo 'PASS: SSH handshake on port 8022'
echo "User: $(whoami)"
ip -4 addr show 2>/dev/null || true
ssh-keygen -lf "$PREFIX/etc/ssh/ssh_host_ed25519_key.pub"
echo 'If a password is needed, run passwd interactively; never put the password in a command or log.'
