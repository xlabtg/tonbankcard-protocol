# DevOps findings
- MEDIUM: faucet service absent from CI, no committed lockfile (scripts/faucet/Dockerfile npm install, no package-lock.json, not in dependency-audit.yml, no ci job). Tests never run.
- LOW: dependency-audit.yml omits docs-site and mobile-app (both have committed lockfiles, both shipped).
