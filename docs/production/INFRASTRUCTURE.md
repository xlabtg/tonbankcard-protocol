# Infrastructure & Deployment

Operational guide for shipping the off-chain Tonbankcard services
(Merchant API, Payment Status Indexer) into production. Covers both the
local container workflow and two production paths — Kubernetes via Helm
and single-VM via Terraform + docker compose.

> **Scope.** This document is about the *off-chain* services. On-chain
> contract deployment is covered separately by the B2 mainnet runbook.

---

## 1. Components

| Component        | Image (default tag)             | Port  | Health endpoint | State                                         |
|------------------|---------------------------------|-------|-----------------|-----------------------------------------------|
| Merchant API     | `tonbankcard/merchant-api:1.0.0`| 3000  | `GET /v1/health`| Stateless (PostgreSQL + Redis when scaled)    |
| Indexer          | `tonbankcard/indexer:1.0.0`     | 3000  | `GET /health`   | SQLite on PersistentVolume (per replica)      |
| Redis (optional) | `redis:7.2-alpine`              | 6379  | `redis-cli ping`| In-cluster volume, persistence via AOF        |
| Postgres (opt.)  | `postgres:16-alpine`            | 5432  | `pg_isready`    | PVC; required by API at >1 replica            |

Both service images are built from multi-stage Dockerfiles
(`api/Dockerfile`, `backend/indexer/Dockerfile`). The runtime stage runs
as UID/GID `10001:10001` and uses `tini` for PID-1 signal handling.

---

## 2. Local development

The single source of truth for local orchestration is the project-root
`docker-compose.yml`.

```bash
cp .env.example .env                              # adjust values
docker compose up --build                          # foreground
docker compose --profile postgres up -d           # also start Postgres
docker compose ps                                  # status
docker compose logs -f api indexer                 # tail logs
docker compose down -v                             # stop + drop volumes
```

The default `.env` configures the indexer to use SQLite on a named
docker volume (`indexer-data`) so the database survives container
restarts. The API defaults to in-memory storage — for multi-replica
local testing, enable the `postgres` profile and set `DATABASE_URL`.

After `docker compose up`, the services are reachable on the host:

```bash
curl http://localhost:3001/v1/health
curl http://localhost:3002/health
```

### Hot reload

For iterative development without rebuilding the image on every change,
bind-mount the local `src/` directory and run `ts-node`:

```yaml
# Add to docker-compose.override.yml — not committed.
services:
  api:
    image: node:20.18.1-alpine3.20
    user: "10001:10001"
    working_dir: /workspace
    command: ["npx", "ts-node", "src/index.ts"]
    volumes:
      - ./api:/workspace
    environment:
      NODE_ENV: development
```

Docker Compose merges any `docker-compose.override.yml` automatically.

---

## 3. Production — Kubernetes (recommended)

Helm charts live in `infra/helm/` (see `infra/helm/README.md` for full
detail). Brief summary:

```bash
# 1. Build and push images.
docker build -t REGISTRY/tonbankcard/merchant-api:1.0.0 -f api/Dockerfile api/
docker build -t REGISTRY/tonbankcard/indexer:1.0.0 -f backend/indexer/Dockerfile backend/indexer/
docker push REGISTRY/tonbankcard/merchant-api:1.0.0
docker push REGISTRY/tonbankcard/indexer:1.0.0

# 2. Create namespace and secrets.
kubectl create namespace tonbankcard
kubectl -n tonbankcard create secret generic tonbankcard-api \
  --from-literal=API_KEY_SECRET="$(openssl rand -hex 32)" \
  --from-literal=DATABASE_URL="postgres://USER:PASS@HOST:5432/DB" \
  --from-literal=REDIS_URL="redis://HOST:6379/0"
kubectl -n tonbankcard create secret generic tonbankcard-indexer \
  --from-literal=TON_API_KEY="…"

# 3. Install charts.
helm install merchant-api infra/helm/merchant-api \
  --namespace tonbankcard \
  --set image.repository=REGISTRY/tonbankcard/merchant-api \
  --set image.tag=1.0.0 \
  --set ingress.hosts[0].host=api.tonbankcard.example.com

helm install indexer infra/helm/indexer \
  --namespace tonbankcard \
  --set image.repository=REGISTRY/tonbankcard/indexer \
  --set image.tag=1.0.0 \
  --set env.PAYMENT_HUB_ADDRESS=EQA... \
  --set env.MERCHANT_PAYMENT_HUB_ADDRESS=EQB...
```

### Defaults that matter

- **Two replicas** for both charts. The API uses a `Deployment` + HPA
  (cpu 70 %, 2–6 replicas). The indexer is a `StatefulSet` so each
  replica gets its own SQLite PVC.
- **Non-root** pod and container security contexts (`runAsUser 10001`,
  `readOnlyRootFilesystem: true`, `capabilities: drop: [ALL]`).
- **PodDisruptionBudget** of `minAvailable: 1` for both charts.
- **Readiness/liveness probes** hit the dedicated health endpoints.
- **Rolling updates** with `maxUnavailable: 0`, `maxSurge: 1`.

### Day-2 operations

```bash
helm upgrade merchant-api infra/helm/merchant-api --reuse-values \
  --set image.tag=1.1.0

helm rollback merchant-api 1                       # roll back one revision

kubectl -n tonbankcard get pods -l app.kubernetes.io/part-of=tonbankcard
kubectl -n tonbankcard logs -l app.kubernetes.io/component=api -f
```

---

## 4. Production — Single VM (Terraform)

When Kubernetes is overkill, the Terraform module in
`infra/terraform/compose-vm/` provisions a Linux VM that boots straight
into the docker compose stack. The example wiring lives in
`infra/terraform/examples/hetzner/` and can be adapted to any cloud.

```bash
cd infra/terraform/examples/hetzner
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars
terraform init
terraform plan -out tf.plan
terraform apply tf.plan
```

The module renders a cloud-init document that:

1. Installs Docker Engine + Compose plugin from the upstream repository.
2. Writes `/etc/tonbankcard/.env` (mode `0644`, non-secret) and
   `/etc/tonbankcard/secrets.env` (mode `0600`, secrets).
3. Drops a `docker-compose.yml` that pulls the configured image
   references.
4. Configures UFW (only 22/80/443 inbound) and `unattended-upgrades`.
5. Installs a systemd unit so the stack starts on every boot.
6. Optionally provisions Caddy as TLS termination when `letsencrypt_email`
   and `domain` are set.

After apply, ssh in as the unprivileged `tonbankcard` user (root login is
disabled) and verify:

```bash
ssh tonbankcard@$(terraform output -raw public_ip)
sudo systemctl status tonbankcard
docker compose ps
curl http://127.0.0.1:3001/v1/health
curl http://127.0.0.1:3002/health
```

---

## 5. Configuration reference

The canonical list of every environment variable consumed by either
service is published as a JSON Schema in
[`schemas/service-config-v1.json`](../../schemas/service-config-v1.json),
with a concrete example in
[`schemas/example-service-config.json`](../../schemas/example-service-config.json).

Per-service `.env.example` files document the same surface in dotenv
format:

- Project root: [`/.env.example`](../../.env.example) — variables shared
  across services (network, host port mappings, Redis/Postgres).
- API: [`api/.env.example`](../../api/.env.example).
- Indexer: [`backend/indexer/.env.example`](../../backend/indexer/.env.example).

**Secrets MUST NOT be committed.** All `.env*` files (except `.env.example`)
are excluded by `.gitignore`. In Kubernetes use `Secret` resources; in
Terraform use `terraform.tfvars` (also ignored).

---

## 6. Acceptance verification (issue #120)

| Acceptance criterion (from issue)                              | Where to find it                                                                 |
|----------------------------------------------------------------|----------------------------------------------------------------------------------|
| `Dockerfile` for `api/` and `backend/indexer/`                 | `api/Dockerfile`, `backend/indexer/Dockerfile`                                   |
| `docker-compose.yml` starts everything with one command        | Project-root `docker-compose.yml`                                                |
| Local environment works end-to-end                             | `docker compose up` (see §2)                                                     |
| `.env.example` files for every service                         | `.env.example`, `api/.env.example`, `backend/indexer/.env.example`               |
| Production IaC configs documented and reviewed                 | This document, plus `infra/helm/` and `infra/terraform/`                         |
| `docs/production/INFRASTRUCTURE.md` written                    | This file                                                                        |
| All Docker images verified to NOT run as root                  | Both Dockerfiles `USER nodejs` (UID 10001); Helm charts pin `runAsNonRoot: true` |

---

## 7. Troubleshooting

| Symptom                                  | Cause                                                  | Fix                                                                 |
|------------------------------------------|--------------------------------------------------------|---------------------------------------------------------------------|
| `indexer` crashloops on first boot       | `PAYMENT_HUB_ADDRESS` left empty                       | Set the four contract addresses in `.env`.                          |
| `api` returns 500 with `INTERNAL_ERROR`  | `API_KEY_SECRET` not provided                          | Generate `openssl rand -hex 32` and inject via Secret / env-file.   |
| Rate limits behave per-replica           | `REDIS_URL` / `REDIS_HOST` not set                     | Point all replicas at the same Redis instance.                      |
| `docker compose up` cannot pull images   | Building locally hasn't happened yet                   | Run `docker compose build` first or push images to a registry.      |
| Health probe fails with 503 in cluster   | `readinessProbe.initialDelaySeconds` too low for cold start | Bump probe `initialDelaySeconds`; the indexer needs ~20 s.       |

For incident response, see [on-call.md](./on-call.md) and the
[SLA document](./SLA.md).
