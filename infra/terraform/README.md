# Tonbankcard — Terraform Modules

This directory contains a minimal-but-complete Terraform module that
provisions the off-chain Tonbankcard services on a single cloud VM. It is
intentionally cloud-agnostic at the module level: the example wires it up
to a Hetzner Cloud server, but any provider that exposes a Linux VM with
SSH access (DigitalOcean, AWS EC2, GCP Compute Engine, …) can reuse the
same `cloud-init` module by swapping the `compute/` adapter.

The module spins up a small VPS that:

- Installs Docker Engine + Compose plugin via cloud-init
- Pulls and runs the published Tonbankcard images using
  `docker-compose.yml` from this repository
- Generates an `.env` file from variables managed in Terraform variables
  (no secrets written to git)
- Opens only ports 80/443/22 to the public Internet

For Kubernetes-based deployments, prefer the Helm charts in `infra/helm/`.

## Layout

```
infra/terraform/
├── README.md
├── compose-vm/        # reusable module — cloud-init + docker compose bootstrap
└── examples/
    └── hetzner/       # example wiring of the module to Hetzner Cloud
```

## Usage

```bash
cd infra/terraform/examples/hetzner

cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars   # fill in secrets and SSH keys

terraform init
terraform plan -out tf.plan
terraform apply tf.plan
```

After apply Terraform prints the public IPv4 address. SSH in and check
that the stack is healthy:

```bash
ssh tonbankcard@<ip>
docker compose ps
curl http://localhost:3001/v1/health
curl http://localhost:3002/health
```

## Variables exposed by the module

| Variable                  | Required | Description                                                       |
|---------------------------|----------|-------------------------------------------------------------------|
| `api_image`               | yes      | Registry reference for the Merchant API image, including tag.     |
| `indexer_image`           | yes      | Registry reference for the indexer image, including tag.          |
| `api_replica_count`       | no       | Defaults to `2`. The cloud-init template stamps this into the     |
|                           |          | systemd unit's `--scale api=N` argument.                          |
| `env`                     | yes      | Map of non-secret env vars rendered into `.env`.                  |
| `secrets`                 | yes      | Map of secret env vars stored in `/etc/tonbankcard/secrets.env`   |
|                           |          | with mode `0600` and owned by root:tonbankcard.                   |
| `ssh_authorized_keys`     | yes      | List of SSH public keys granted access to the `tonbankcard` user. |
| `letsencrypt_email`       | no       | If set, cloud-init also installs Caddy as TLS termination proxy.  |

See `compose-vm/variables.tf` for the full surface.

## Security defaults

- Provisioned VM runs Docker rootful but each service container drops to
  UID 10001 via the image's USER directive.
- The `.env` file is mounted into containers via `--env-file` rather than
  bake into the image. Permissions are `0600`.
- UFW (uncomplicated firewall) configured by cloud-init: only 22/80/443.
- Automatic security updates enabled via `unattended-upgrades`.
- A separate `tonbankcard` user owns the docker compose project and is in
  the `docker` group — root login is disabled.

## Docker, published ports, and UFW

**UFW does not protect Docker's published ports.** When Docker publishes a
container port with `-p host:container` (or the compose `ports:` key), it
installs its own `iptables` rules in the `DOCKER` / `DOCKER-USER` chains.
Those rules are evaluated *before* the `ufw-*` chains, so a port published on
all interfaces (`0.0.0.0`) stays reachable from the Internet **even when UFW
is set to `default deny incoming`**. A `ufw deny 3001` rule is silently
bypassed because the packet is DNAT-ed to the container before UFW ever sees
it.

To avoid this trap the `compose-vm` module publishes the API and indexer on
the **loopback interface only**:

```yaml
ports:
  - "127.0.0.1:3001:3000"   # api
  - "127.0.0.1:3002:3000"   # indexer
```

This keeps both services off the public interface regardless of UFW rule
ordering. External traffic reaches the API exclusively through the optional
Caddy reverse proxy, which terminates TLS on 80/443 and forwards to
`127.0.0.1:3001`. The indexer is intentionally not exposed publicly.

If you ever need a container port reachable from outside the host, do **not**
rely on UFW — instead add an explicit rule to the `DOCKER-USER` chain (which
Docker evaluates first), e.g.:

```bash
iptables -I DOCKER-USER -p tcp --dport 3001 ! -s 10.0.0.0/8 -j DROP
```

### Verifying the binding

A static check confirms the cloud-init template publishes the api/indexer on
loopback only (it runs in CI and can be run locally):

```bash
infra/terraform/compose-vm/scripts/verify-port-binding.sh
```

On a provisioned host, confirm the kernel only listens on loopback for the
published ports:

```bash
ss -ltnp | grep -E ':3001|:3002'   # addresses must be 127.0.0.1, never 0.0.0.0
```

From an external host, the ports must be filtered/closed:

```bash
nmap -Pn -p 3001,3002 <public-ip>  # expect "filtered" / "closed", never "open"
```
