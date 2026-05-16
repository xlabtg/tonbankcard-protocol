# Tonbankcard — Helm Charts

This directory ships Helm charts for deploying the off-chain Tonbankcard
services into a Kubernetes cluster. Two charts are provided:

| Chart           | Purpose                                                  |
|-----------------|----------------------------------------------------------|
| `merchant-api/` | Stateless Merchant API behind a Service / Ingress.       |
| `indexer/`      | Stateful Payment Status Indexer with a PVC for SQLite.   |

Both charts default to **two replicas** to satisfy the availability
requirement in issue #120 and run their pods as a non-root user.

## Prerequisites

- Helm v3.12+
- A Kubernetes cluster (k3s, kind, EKS, GKE, AKS, …)
- A container registry that holds the images built from `api/Dockerfile`
  and `backend/indexer/Dockerfile` (see `docs/production/INFRASTRUCTURE.md`
  for the build & push workflow).

## Installation

```bash
# Push the images you built locally (replace REGISTRY).
docker tag tonbankcard/merchant-api:local REGISTRY/tonbankcard/merchant-api:1.0.0
docker tag tonbankcard/indexer:local      REGISTRY/tonbankcard/indexer:1.0.0
docker push REGISTRY/tonbankcard/merchant-api:1.0.0
docker push REGISTRY/tonbankcard/indexer:1.0.0

# Create namespace and shared secret (do NOT commit the values file).
kubectl create namespace tonbankcard
kubectl -n tonbankcard create secret generic tonbankcard-api \
  --from-literal=API_KEY_SECRET="$(openssl rand -hex 32)" \
  --from-literal=DATABASE_URL="postgres://user:pass@host:5432/db"

kubectl -n tonbankcard create secret generic tonbankcard-indexer \
  --from-literal=TON_API_KEY="..." \
  --from-literal=REDIS_PASSWORD="..."

# Install the API.
helm install merchant-api infra/helm/merchant-api \
  --namespace tonbankcard \
  --set image.repository=REGISTRY/tonbankcard/merchant-api \
  --set image.tag=1.0.0 \
  --set ingress.hosts[0].host=api.tonbankcard.example.com

# Install the indexer.
helm install indexer infra/helm/indexer \
  --namespace tonbankcard \
  --set image.repository=REGISTRY/tonbankcard/indexer \
  --set image.tag=1.0.0 \
  --set env.PAYMENT_HUB_ADDRESS=EQA... \
  --set env.MERCHANT_PAYMENT_HUB_ADDRESS=EQB...
```

## Upgrades & rollbacks

```bash
helm upgrade merchant-api infra/helm/merchant-api --reuse-values \
  --set image.tag=1.1.0

# Roll back on regression.
helm rollback merchant-api 1
```

## Linting and dry-run

```bash
helm lint infra/helm/merchant-api
helm lint infra/helm/indexer
helm template merchant-api infra/helm/merchant-api | kubectl apply --dry-run=client -f -
```
