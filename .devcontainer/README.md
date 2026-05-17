# Tonbankcard Protocol — `.devcontainer/`

This directory configures the GitHub Codespaces / VS Code Dev Container
environment used to bring up a fully working developer setup with a single
click — see Issue [#125].

## What you get

* Node.js **20 LTS** on a pinned `mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm`
  base image. The tag is **explicitly pinned** to satisfy the issue's security
  requirement that `.devcontainer/` must not use `:latest`.
* Git, `npm`, the VS Code TypeScript SDK from `sdk/node_modules`.
* Pre-installed VS Code extensions: ESLint, Prettier, Tact, Docker, GitHub
  Actions, GitHub Pull Requests.
* `postCreateCommand` runs [`scripts/setup.sh --no-smoke`](../scripts/setup.sh)
  on container creation, so the six runtime packages are installed and built
  before you touch the terminal.
* Ports forwarded for the merchant demo (`8080`), Vite dev server (`5173`),
  the Merchant API (`3000`/`3001`), the Payment Indexer (`3002`), the TBC
  faucet (`4500`), and Redis (`6379`/`6380`).

## Opening in Codespaces

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/xlabtg/tonbankcard-protocol)

* Push a branch and click **Code → Codespaces → Create codespace** on GitHub,
  or
* Use the badge above to launch a fresh Codespace against `main`.

The first creation takes 3–5 minutes (dependency install + build). Subsequent
re-attaches reuse the same container and are near-instant.

## Opening locally (VS Code Dev Containers)

1. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).
2. Open this repository folder in VS Code.
3. Press **F1 → Dev Containers: Reopen in Container**.

The same `postCreateCommand` runs locally — your local environment matches a
fresh Codespace bit-for-bit.

## Security notes (Issue #125 §7)

* The base image tag is **pinned** (`:1-20-bookworm`), not `:latest`.
* `postCreateCommand` only runs the in-repo `scripts/setup.sh`. No remote
  shell scripts are downloaded or executed.
* No `.env`/credentials are baked into the image. The merchant demo uses the
  public C3 sandbox (no env vars required).

## Container size

The base image is ~1.5 GB; the post-create install adds another ~400 MB of
`node_modules` across the six packages. Total well under the **2 GB image
size** non-functional requirement from the issue (the install layer is not
included in the image itself).

[#125]: https://github.com/xlabtg/tonbankcard-protocol/issues/125
