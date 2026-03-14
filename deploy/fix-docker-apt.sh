#!/usr/bin/env bash
set -euo pipefail

fix_docker_apt() {
  echo "[Docker APT] Fixing Signed-By conflict on Ubuntu/Debian..."

  rm -f /etc/apt/keyrings/docker.asc \
        /etc/apt/keyrings/docker.gpg \
        /usr/share/keyrings/docker-archive-keyring.gpg \
        2>/dev/null || true

  rm -f /etc/apt/sources.list.d/docker.list \
        /etc/apt/sources.list.d/docker.list.save \
        /etc/apt/sources.list.d/download_docker_com_linux_ubuntu.list \
        2>/dev/null || true

  for f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
    [ -f "$f" ] || continue
    if grep -qi "download.docker.com" "$f" 2>/dev/null; then
      echo "  Removing stale Docker source: $f"
      rm -f "$f"
    fi
  done

  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y -qq 2>/dev/null || true

  install -m 0755 -d /etc/apt/keyrings

  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  ARCH=$(dpkg --print-architecture 2>/dev/null || echo "amd64")
  CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}")

  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y -qq

  apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    2>/dev/null || {
      echo "  WARN: apt install failed, trying get.docker.com fallback..."
      curl -fsSL https://get.docker.com | sh
    }

  systemctl enable --now docker

  echo "[Docker APT] Fix complete. Docker $(docker --version 2>/dev/null || echo 'unknown'), Compose $(docker compose version --short 2>/dev/null || echo 'unknown')"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Must run as root" >&2
    exit 1
  fi
  fix_docker_apt
fi
