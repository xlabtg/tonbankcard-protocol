#!/usr/bin/env bash
# verify-port-binding.sh — Assert the compose-vm cloud-init template only
# publishes container ports on the loopback interface.
#
# Why this exists (audit finding DEVOPS-H2):
#   Docker publishes container ports via its own iptables rules (DOCKER /
#   DOCKER-USER chains) which are evaluated BEFORE UFW's ufw-* chains. A port
#   published on 0.0.0.0 therefore stays internet-reachable even with
#   `ufw default deny incoming`. Binding the host side to 127.0.0.1 keeps the
#   port private regardless of firewall ordering. This check fails the build
#   if anyone reintroduces a publicly-published port in the template.
#
# Usage:
#   infra/terraform/compose-vm/scripts/verify-port-binding.sh [template-path]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${1:-$SCRIPT_DIR/../templates/cloud-init.yaml.tftpl}"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "✗ verify-port-binding: template not found: $TEMPLATE" >&2
  exit 1
fi

echo "==> Checking published ports in $TEMPLATE"

# Extract the quoted value of every `- "<spec>"` entry that appears under a
# `ports:` key. The spec is one of:
#   "3001:3000"             -> all interfaces (0.0.0.0) — INSECURE
#   "0.0.0.0:3001:3000"     -> all interfaces           — INSECURE
#   "127.0.0.1:3001:3000"   -> loopback only            — OK
specs=()
in_ports=0
while IFS= read -r line; do
  # Track whether we are inside a `ports:` block (simple, indentation-based).
  if [[ "$line" =~ ^[[:space:]]*ports:[[:space:]]*$ ]]; then
    in_ports=1
    continue
  fi
  if [[ $in_ports -eq 1 ]]; then
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*\"([^\"]+)\"[[:space:]]*$ ]]; then
      specs+=("${BASH_REMATCH[1]}")
      continue
    fi
    # Any non-list-item line ends the ports block.
    if [[ ! "$line" =~ ^[[:space:]]*$ ]]; then
      in_ports=0
    fi
  fi
done < "$TEMPLATE"

if [[ ${#specs[@]} -eq 0 ]]; then
  echo "✗ verify-port-binding: no published ports found — expected at least the api/indexer mappings" >&2
  exit 1
fi

bad=()
for spec in "${specs[@]}"; do
  # Count colons to distinguish "host:container" (1 colon, no IP) from
  # "ip:host:container" (2 colons, has IP).
  colons="${spec//[^:]/}"
  if [[ ${#colons} -ge 2 ]]; then
    ip="${spec%%:*}"
    if [[ "$ip" != "127.0.0.1" ]]; then
      bad+=("$spec")
    fi
  else
    # No interface specified -> Docker binds 0.0.0.0 (all interfaces).
    bad+=("$spec")
  fi
done

if [[ ${#bad[@]} -gt 0 ]]; then
  echo "✗ verify-port-binding: the following ports are NOT bound to 127.0.0.1:" >&2
  for spec in "${bad[@]}"; do
    echo "    - \"$spec\"  (publishes on all interfaces; UFW will NOT protect it)" >&2
  done
  echo >&2
  echo "  Bind the host side to loopback, e.g. \"127.0.0.1:3001:3000\"." >&2
  exit 1
fi

echo "✓ verify-port-binding: all ${#specs[@]} published port(s) bind to 127.0.0.1:"
for spec in "${specs[@]}"; do
  echo "    - \"$spec\""
done
