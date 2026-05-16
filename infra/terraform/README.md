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
