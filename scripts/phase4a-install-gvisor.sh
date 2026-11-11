#!/usr/bin/env bash
# Run only after the successful native Ubuntu runc gate. Official complete package.
set -euo pipefail
[[ $(id -u) == 0 ]]
phase4a_root=$(cd "$(dirname "$0")/.." && pwd)
phase4a_results="$phase4a_root/research-results/phase4-gvisor/2026-11-09T14-09-00Z-phase4a-native-wsl"
python3 -c 'import json,sys;assert json.load(open(sys.argv[1]))["success"]' "$phase4a_results/generic-runc.json"
phase4a_os=$(/usr/bin/docker --host unix:///var/run/docker.sock info --format '{{.OperatingSystem}}')
[[ $phase4a_os == Ubuntu* ]]
[[ $(/usr/bin/docker --host unix:///var/run/docker.sock info --format '{{.DefaultRuntime}}') == runc ]]
export DEBIAN_FRONTEND=noninteractive
curl -fsSL https://gvisor.dev/archive.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
printf 'deb [arch=%s signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main\n' "$(dpkg --print-architecture)" >/etc/apt/sources.list.d/gvisor.list
apt-get update
phase4a_candidate=$(apt-cache policy runsc | awk '/Candidate:/ {print $2}')
[[ -n $phase4a_candidate && $phase4a_candidate != '(none)' ]]
apt-cache policy runsc
apt-get install -y --no-install-recommends "runsc=$phase4a_candidate"
runsc --version
dpkg-query -W -f='${Package} ${Version}\n' runsc
if test -f /etc/docker/daemon.json; then
  cp -a /etc/docker/daemon.json "$phase4a_results/native-daemon-before-explicit-registration.json"
fi
/usr/bin/runsc install --runtime=runsc -- --platform=systrap
systemctl restart docker.service
[[ $(/usr/bin/docker --host unix:///var/run/docker.sock info --format '{{.DefaultRuntime}}') == runc ]]
cat /etc/docker/daemon.json
