#!/usr/bin/env bash
# Runs a command while holding the machine-wide Playwright lock. tests/e2e/config.ts binds
# port 4173, so two browser suites on one machine collide; `make e2e`, `e2e-pages` and
# `e2e-live` all go through here. Safe to call from inside `flock <lock> ...`: see below.
set -euo pipefail

lock="${DAEMON_E2E_LOCK:-/tmp/daemon-zero-e2e.lock}"

if [ "$#" -eq 0 ]; then
  echo "usage: e2e-lock.sh <command> [args...]" >&2
  exit 2
fi

# No flock(1) (stock macOS): nothing to serialise with, so run rather than refuse.
if ! command -v flock >/dev/null 2>&1; then
  echo "e2e-lock: flock not found; running without the shared lock" >&2
  exec "$@"
fi

# A caller that wrapped us (`flock <lock> make e2e`, the convention before this script)
# holds the lock on a descriptor that flock(1) leaves open in every child. Opening the file
# again would give a second open file description and wait forever on our own ancestor.
# Locking the INHERITED description instead is a no-op when it already holds the lock, and
# still a real, blocking acquire if it somehow does not.
for entry in "/proc/$$/fd"/*; do
  if [ "$entry" -ef "$lock" ]; then
    flock "${entry##*/}"
    exec "$@"
  fi
done

exec {held}>>"$lock"
if ! flock --nonblock "$held"; then
  echo "e2e-lock: waiting for $lock (another browser suite is running)" >&2
  flock "$held"
fi
exec "$@"
