#!/usr/bin/env bash
# Prepared only. Run deliberately on a dedicated Debian/Ubuntu Docker Engine host.
# Installs an exact official apt package version; may reload/restart that daemon.
set -euo pipefail
if [[ ${1:-} != --install-on-dedicated-host || -z ${2:-} || $# != 2 ]]; then
  printf 'Usage: bash scripts/phase4-linux-setup.sh --install-on-dedicated-host EXACT_APT_VERSION\n' >&2
  exit 2
fi
phase4_package_version=$2
[[ $(uname -s) == Linux ]] || { printf 'Requires Linux.\n' >&2; exit 2; }
command -v apt-get >/dev/null
command -v docker >/dev/null
command -v systemctl >/dev/null
phase4_endpoint=$(docker context inspect --format '{{.Endpoints.docker.Host}}')
[[ $phase4_endpoint == unix://* ]] || { printf 'Run on the actual Linux daemon host with a local Unix socket.\n' >&2; exit 2; }
phase4_server_os=$(docker info --format '{{.OperatingSystem}}')
[[ $phase4_server_os != *Docker\ Desktop* ]] || { printf 'This preparation script does not modify Docker Desktop.\n' >&2; exit 2; }
phase4_default_before=$(docker info --format '{{.DefaultRuntime}}')
phase4_kernel=$(uname -r)
dpkg --compare-versions "${phase4_kernel%%-*}" ge 5.6 || { printf 'Requires Linux 5.6+.\n' >&2; exit 2; }
case $(uname -m) in x86_64|aarch64) ;; *) printf 'Unsupported host architecture.\n' >&2; exit 2 ;; esac
phase4_backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
if sudo test -f /etc/docker/daemon.json; then
  sudo cp -a /etc/docker/daemon.json "/etc/docker/daemon.json.phase4-${phase4_backup_stamp}.bak"
fi
# Official signed repository; preserve the complete package/sidecar installation.
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
printf 'deb [arch=%s signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main\n' "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/gvisor.list >/dev/null
sudo apt-get update
sudo apt-get install -y "runsc=${phase4_package_version}"
command -v runsc >/dev/null
runsc --version
dpkg-query -W -f='${Package} ${Version}\n' runsc
# The official package normally registers Docker automatically. Never replace
# daemon.json wholesale or change the Docker default runtime for this comparison.
if ! docker info --format '{{json .Runtimes}}' | python3 -c 'import json,sys;sys.exit(0 if "runsc" in json.load(sys.stdin) else 1)'; then
  sudo runsc install
  sudo systemctl reload docker
  if ! docker info --format '{{json .Runtimes}}' | python3 -c 'import json,sys;sys.exit(0 if "runsc" in json.load(sys.stdin) else 1)'; then
    sudo systemctl restart docker
  fi
fi
[[ $(docker info --format '{{.DefaultRuntime}}') == "$phase4_default_before" ]] || { printf 'STOP: Docker default runtime changed; inspect the saved daemon configuration.\n' >&2; exit 2; }
docker info --format 'Default={{.DefaultRuntime}} Runtimes={{json .Runtimes}}'
printf 'Installation/registration only. Real local-image probe and per-job runtime evidence are still required.\n'
