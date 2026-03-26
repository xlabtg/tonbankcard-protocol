---
name: "[B4] Infrastructure as Code"
about: Containerize backend services with Docker and create IaC configs for local and production environments
labels: type:backend
track: B
priority: medium
---

## 1. Goal

Containerize the off-chain backend services (`api/`, `backend/indexer/`) using Docker, provide a `docker-compose.yml` for local development, and create production-ready IaC configurations (Helm charts or Terraform) for production deployment.

## 2. Context

Currently, the backend services require manual setup (Node.js version, environment variables, database initialization). This creates onboarding friction for new developers and makes production deployments manual and error-prone.

Containerization enables:
- One-command local development environment (`docker-compose up`)
- Reproducible production deployments
- Clear separation of service responsibilities
- Foundation for auto-scaling and cloud deployment

Related to: [DEVELOPMENT_ROADMAP.md — Track B, B4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Docker Images
- `api/Dockerfile` — Merchant API service
- `backend/indexer/Dockerfile` — Payment Indexer service
- Each image should be multi-stage (build + runtime) to minimize image size

### Local Development
- `docker-compose.yml` in the repository root:
  - `api` service
  - `indexer` service
  - `postgres` service (optional, defaults to SQLite for simplicity)
  - Environment variable passthrough via `.env` file
  - Volume mounts for hot reload in development mode

### Production IaC (choose one)
- **Helm charts** at `infra/helm/` for Kubernetes deployment, OR
- **Terraform configs** at `infra/terraform/` for cloud VM deployment
- Document both options in `docs/production/INFRASTRUCTURE.md`

### Environment Variable Schema
- `schemas/` should define configuration schemas for each service
- `.env.example` files for each service with all required variables documented

## 4. Out of Scope

- Smart contract deployment (covered by B2)
- CI/CD pipeline changes (covered separately if needed)
- Paid cloud infrastructure provisioning (document the process, don't automate billing)
- Mobile or frontend hosting

## 5. Functional Requirements

1. `docker-compose up` starts all services with a single command
2. Services connect to each other using Docker network (no hardcoded localhost)
3. Database migrations run automatically on container startup
4. Health check endpoints available on each service (for Docker/Kubernetes health checks)
5. Logs output to stdout in JSON format (pino already in use for indexer)

## 6. Non-Functional Requirements

- Docker images must be based on the official Node.js LTS alpine image
- Images must not run as root (use non-root user in Dockerfile)
- Build must be reproducible: same source → same image hash
- Production IaC configs must support at minimum 2 replicas for availability

## 7. Security Requirements

- No secrets (API keys, database passwords) hardcoded in Dockerfiles or compose files
- `.env` file must be in `.gitignore`
- `.env.example` in the repo contains only placeholder values (e.g., `CHANGENOW_API_KEY=your-key-here`)
- Docker images must run as a non-root user
- No `--privileged` flag in production containers

## 8. Acceptance Criteria

- [ ] `Dockerfile` created for `api/` and `backend/indexer/`
- [ ] `docker-compose.yml` in repo root starts all services with one command
- [ ] Local environment works end-to-end: `docker-compose up` → payment flow functional
- [ ] `.env.example` files document all required environment variables for each service
- [ ] Production IaC configs (Helm or Terraform) documented and reviewed
- [ ] `docs/production/INFRASTRUCTURE.md` written with deployment instructions
- [ ] All Docker images verified to not run as root

## 9. References

- [Architecture](../docs/architecture.md)
- [Production Docs](../docs/production/)
- [Merchant API](../api/)
- [Indexer](../backend/indexer/)
- [Contributing Guide](../CONTRIBUTING.md)
