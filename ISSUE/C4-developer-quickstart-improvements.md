---
name: "[C4] Developer Quickstart Improvements"
about: One-command setup script, GitHub Codespaces support, and merchant demo app
labels: type:docs
track: C
priority: low
---

## 1. Goal

Reduce the time from "clone repository" to "running local development environment" to under 5 minutes, through a one-command setup script, GitHub Codespaces support, and a working merchant demo application.

## 2. Context

The repository has 6 npm packages (`sdk/`, `api/`, `backend/indexer/`, `wallet-ui/`, `mobile/`, `dashboard/`). Each requires independent `npm install` and build steps. New contributors must currently discover the setup process by reading multiple README files.

A streamlined onboarding experience is critical for open-source contributions and merchant adoption.

Related to: [DEVELOPMENT_ROADMAP.md — Track C, C4](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### One-Command Setup Script
- `scripts/setup.sh` (or `npm run setup` in root `package.json`)
- Installs all dependencies across all 6 packages
- Builds all packages in correct dependency order
- Runs a quick smoke test to verify the setup is working
- Works on macOS, Linux, and Windows (WSL)

### GitHub Codespaces
- `.devcontainer/devcontainer.json` at repository root
- Pre-configures: Node.js LTS, required tools, VS Code extensions
- Runs setup script automatically on container creation
- Enables one-click "Open in Codespaces" from GitHub

### Merchant Demo Application
- `examples/merchant-demo/` — A simple Express.js or Next.js merchant app
- Demonstrates: invoice creation, payment widget embedding, webhook receipt
- Uses the public sandbox environment by default (C3)
- Contains a `README.md` with step-by-step instructions

## 4. Out of Scope

- Video walkthroughs (useful but out of scope for this issue)
- Changing the architecture of existing packages
- Changes to CI/CD pipeline

## 5. Functional Requirements

1. `npm run setup` (or `./scripts/setup.sh`) completes successfully on a clean Node.js LTS install
2. After setup, `npm test` passes across all packages
3. `.devcontainer/devcontainer.json` passes Codespaces validation
4. `examples/merchant-demo/` runs with `npm start` and shows a functional payment form
5. All `README.md` files link to `examples/merchant-demo/` as the quickstart reference

## 6. Non-Functional Requirements

- Setup script must complete in < 5 minutes on a standard machine
- Setup script must be idempotent (safe to run multiple times)
- Codespaces container must be < 2 GB in size
- Demo application must not require environment variables for the sandbox use case

## 7. Security Requirements

- Setup script must not download or execute arbitrary remote code
- Demo application must not commit `.env` files with real credentials
- `.devcontainer/` must use a pinned base image version (not `latest`)

## 8. Acceptance Criteria

- [ ] `npm run setup` script created and works end-to-end
- [ ] `.devcontainer/devcontainer.json` created and validated
- [ ] `examples/merchant-demo/` created with working payment flow
- [ ] `README.md` updated with "Open in Codespaces" badge and quickstart link
- [ ] Setup script tested on macOS, Linux, and Windows (WSL2)
- [ ] CI check runs setup script to verify it doesn't break

## 9. References

- [Contributing Guide](../CONTRIBUTING.md)
- [Examples](../examples/)
- [Scripts](../scripts/)
- GitHub Codespaces devcontainer spec: https://containers.dev
- Issue C3: [C3-test-sandbox-environment.md](./C3-test-sandbox-environment.md)
