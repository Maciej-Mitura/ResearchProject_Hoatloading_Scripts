#!/usr/bin/env bash
# Run only as root in the existing Ubuntu distro. Never targets Docker Desktop.
set -euo pipefail
[[ $(id -u) == 0 ]]
. /etc/os-release
[[ $ID == ubuntu && $VERSION_CODENAME == noble ]]
[[ $(ps -p 1 -o comm=) == systemd ]]
[[ ! -e /var/run/docker.sock && ! -e /etc/docker/daemon.json && ! -e /var/lib/docker ]]
if dpkg-query -W -f='${Status}\n' docker-ce docker.io containerd.io containerd runc 2>/dev/null | grep -q 'install ok installed'; then
  printf 'STOP: pre-existing native packages require review.\n' >&2; exit 2
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker.service
env -u DOCKER_HOST -u DOCKER_CONTEXT /usr/bin/docker --host unix:///var/run/docker.sock info --format 'OS={{.OperatingSystem}} Default={{.DefaultRuntime}} Root={{.DockerRootDir}} Runtimes={{json .Runtimes}}'
dpkg-query -W -f='${Package} ${Version}\n' docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
