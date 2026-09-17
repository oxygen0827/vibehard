#!/usr/bin/env bash
# Run as the unprivileged vibehard-runner user. No sudo or Docker socket needed.
set -euo pipefail

workspace_root=/var/lib/vibehard-runner/workspaces
state_root=/var/lib/vibehard-runner/codex
toolchain=/opt/vibehard/toolchain
probe=false
if test "$#" -eq 2 && test "$2" = --self-test; then
  probe=true
else
  test "$#" -eq 4
  test "$2" = app-server
  test "$3" = --listen
  test "$4" = stdio://
fi
workspace=$(realpath -e -- "$1")
test "$workspace" = "$1"
case "$workspace" in "$workspace_root"/*/*) ;; *) echo 'Invalid project workspace' >&2; exit 1;; esac
test -d "$workspace"
relative=${workspace#"$workspace_root"/}
case "$relative" in *..*|*[!a-zA-Z0-9_./-]*) echo 'Invalid workspace key' >&2; exit 1;; esac
state="$state_root/$relative"
mkdir -p -- "$state"
test "$(realpath -e -- "$state")" = "$state"
chmod 700 "$state"

mounts=()
for directory in /lib /lib64 /etc/ssl /etc/pki /etc/alternatives; do
  if test -d "$directory"; then mounts+=(--ro-bind "$directory" "$directory"); fi
done

config_mounts=()
command=("$toolchain/bin/codex" app-server --listen stdio://)
if "$probe"; then
  command=(/bin/sh -eu -c 'test "$(id -u)" -ne 0; test ! -e /etc/vibehard/platform.env; test ! -e /var/lib/vibehard-runner/credential.json; test ! -e /root/.ssh; /opt/vibehard/toolchain/bin/codex --version; gcc --version | head -1; cmake --version | head -1; printf "int main(void) { return 0; }\n" | gcc -x c - -o /tmp/vibehard-compiler-probe; /tmp/vibehard-compiler-probe; echo "Isolated non-root compilation probe passed"')
else
  config_mounts+=(--ro-bind /etc/vibehard/codex/config.toml /var/lib/vibehard-runner/.codex/config.toml)
fi
for file in /etc/resolv.conf /etc/hosts /etc/nsswitch.conf /etc/passwd /etc/group /etc/ld.so.cache; do
  if test -f "$file"; then mounts+=(--ro-bind "$file" "$file"); fi
done

# Keep model-network access for app-server. Its own read-only command sandbox
# remains enabled; writes/escalations go through the platform approval queue.
exec /usr/bin/timeout --signal=TERM --kill-after=10s 900s /usr/bin/bwrap \
  --unshare-user --unshare-pid --unshare-ipc --unshare-uts --unshare-cgroup-try \
  --die-with-parent --new-session --cap-drop ALL \
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/sbin /sbin \
  --proc /proc --dev /dev --tmpfs /tmp --dir /etc \
  "${mounts[@]}" \
  --ro-bind "$toolchain" "$toolchain" \
  --bind "$workspace" "$workspace" \
  --bind "$state" /var/lib/vibehard-runner/.codex \
  "${config_mounts[@]}" \
  --chdir "$workspace" \
  "${command[@]}"
