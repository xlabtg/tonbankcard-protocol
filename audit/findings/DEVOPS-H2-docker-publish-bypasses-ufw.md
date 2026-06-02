---
title: "[DEVOPS-H2] Docker host-port publishing bypasses the UFW firewall"
severity: high
area: devops
priority: high
stage: 2
labels: ["bug","audit","type:tooling","type:security","priority:high","stage:2-high"]
---

## Summary

The provisioned VM publishes container ports to the host (`3001:3000`, `3002:3000`) while relying on UFW to restrict ingress to ports 22/80/443. Docker inserts its own iptables rules below the UFW chains, so published container ports remain reachable from the internet even though UFW reports them as denied. This gives operators a false sense of firewall protection.

## Severity & Category

- Severity: High
- Category: Network Exposure / Firewall Configuration

## Affected Code

- `infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl:53-54` (api `ports: - "3001:3000"`)
- `infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl:73-74` (indexer `ports: - "3002:3000"`)
- `infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl:115-121` (UFW rules)

## Description

The cloud-init template publishes ports without binding to a local interface:

```yaml
        ports:
          - "3001:3000"
        ...
        ports:
          - "3002:3000"
```

while the firewall is configured to allow only ssh and http(s):

```yaml
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
```

Docker's `-p host:container` publishing creates `DOCKER` / `DOCKER-USER` iptables rules that are evaluated before UFW's `ufw-*` chains. A `ufw deny 3001` does not block traffic that Docker has already DNAT-ed to the container. Ports 3001 and 3002 are therefore internet-reachable despite UFW's default-deny policy.

Positive note: an optional Caddy reverse proxy is wired to `127.0.0.1:3001`, indicating the intended access path is through TLS termination on 80/443 — the bare published ports are the gap.

## Impact

- The API (3001) and indexer (3002) are directly reachable from the internet, bypassing the intended reverse-proxy/TLS path.
- Operators believe UFW protects these ports when it does not, increasing the chance of unauthenticated exposure of internal services.

## Suggested Fix

- Bind published ports to the loopback interface (for example `127.0.0.1:3001:3000`) so only the local reverse proxy can reach them.
- Front all external access with the Caddy reverse proxy on 80/443.
- Alternatively, configure Docker to respect UFW (for example `iptables`/`userland-proxy` settings plus `DOCKER-USER` rules) and document the Docker/UFW interaction in the infra README.

## Acceptance Criteria

- [ ] Published API/indexer ports bind to `127.0.0.1` (or an internal interface), not `0.0.0.0`.
- [ ] External access is only via the reverse proxy on 80/443.
- [ ] The Docker/UFW interaction is documented in the infra docs.
- [ ] CI/verification: a host-level check (for example `ss -ltnp` / `nmap` from an external host, or an iptables assertion) confirms 3001/3002 are not reachable on the public interface.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`
- `infra/terraform/compose-vm/templates/cloud-init.yaml.tftpl`

---

**Tracking issue:** [#262](https://github.com/xlabtg/tonbankcard-protocol/issues/262)
