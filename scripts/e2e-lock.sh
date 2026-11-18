#!/usr/bin/env bash
# Runs a browser-suite command in its own slot: a port and the lock that goes with it.
# tests/e2e/config.ts serves the export on $DAEMON_E2E_PORT, so suites in different checkouts
# can run side by side as long as each has its own port. `make e2e`, `e2e-pages`, `e2e-live`,
# `e2e-live-pages` and `e2e-audio` all go through here. Up to $DAEMON_E2E_SLOTS suites run at once (default 3: the
# timing-sensitive cases get flaky when the machine is saturated); the next one waits.
# Safe to call from inside `flock <lock> ...`: see below.
set -euo pipefail

DEFAULT_PORT=4173
lock="${DAEMON_E2E_LOCK:-/tmp/daemon-zero-e2e.lock}"
slots="${DAEMON_E2E_SLOTS:-3}"
first="$DEFAULT_PORT"
# An explicit port is a request for exactly that slot, not for the first free one.
if [ -n "${DAEMON_E2E_PORT:-}" ]; then first="$DAEMON_E2E_PORT"; slots=1; fi

if [ "$#" -eq 0 ]; then
  echo "usage: e2e-lock.sh <command> [args...]" >&2
  exit 2
fi
case "$slots$first" in *[!0-9]*|'') echo "e2e-lock: DAEMON_E2E_SLOTS and DAEMON_E2E_PORT must be whole numbers" >&2; exit 2;; esac
if [ "$slots" -lt 1 ] || [ "$slots" -gt 16 ] || [ "$first" -lt 1024 ] || [ "$((first + slots - 1))" -gt 65535 ]; then
  echo "e2e-lock: need 1-16 slots on ports 1024-65535 (got $slots from $first)" >&2
  exit 2
fi

# No flock(1) (stock macOS): nothing to serialise with, so run rather than refuse.
if ! command -v flock >/dev/null 2>&1; then
  echo "e2e-lock: flock not found; running without a slot lock on port $first" >&2
  DAEMON_E2E_PORT="$first" exec "$@"
fi

# The default port keeps the original lock name, so a caller still wrapping a target in
# `flock /tmp/daemon-zero-e2e.lock ...` and this script agree on what that file guards.
lock_for() { if [ "$1" -eq "$DEFAULT_PORT" ]; then printf '%s' "$lock"; else printf '%s.%s' "$lock" "$1"; fi; }

# A caller that wrapped us holds a slot's lock on a descriptor that flock(1) leaves open in
# every child. Opening the file again would give a second open file description and wait
# forever on our own ancestor. Locking the INHERITED description instead is a no-op when it
# already holds the lock, and that slot is then ours: run on its port.
for ((slot = 0; slot < slots; slot++)); do
  port=$((first + slot))
  for entry in "/proc/$$/fd"/*; do
    if [ "$entry" -ef "$(lock_for "$port")" ]; then
      flock "${entry##*/}"
      DAEMON_E2E_PORT="$port" exec "$@"
    fi
  done
done

announced=0
while :; do
  for ((slot = 0; slot < slots; slot++)); do
    port=$((first + slot))
    exec {held}>>"$(lock_for "$port")"
    if flock --nonblock "$held"; then
      # The descriptor stays open in the command, which is what holds the slot until it exits.
      DAEMON_E2E_PORT="$port" exec "$@"
    fi
    exec {held}>&-
  done
  if [ "$announced" -eq 0 ]; then
    echo "e2e-lock: waiting for a free slot ($slots browser suite(s) already running from port $first)" >&2
    announced=1
  fi
  sleep 1
done
