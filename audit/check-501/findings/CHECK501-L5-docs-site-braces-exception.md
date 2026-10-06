# [CHECK501-L5] docs-site временно аудируется на уровне Critical из-за неисправленного braces

## Кратко

`braces@3.0.3` (GHSA-vfj7-8cjw-p6xm, High, stack exhaustion на глубоко вложенных шаблонах) не имеет исправленной версии: даже последний `micromatch@4.0.8` требует `braces@^3.0.3`. В docs-site пакет приходит build-time через `chokidar`/`micromatch` в Docusaurus. В PR #502 порог `npm audit` для docs-site понижен до `critical`; остальные восемь workspaces очищены (jest 29→30.5.2 убирает braces) и остаются на `high`.

## Severity

Low — Build-time DoS только при обработке недоверенных glob-шаблонов; production-бандл не затронут, но исключение ослабляет контроль.

## Затронутый код

- `.github/workflows/dependency-audit.yml` — matrix entry `docs-site` с `audit_level: critical`.
- `docs-site/package-lock.json` — `node_modules/braces` 3.0.3 через `chokidar`, `micromatch`.

## Воспроизведение

`cd docs-site && npm audit --audit-level=high` → 1 High (`braces`).

## Рекомендуемое исправление

Когда upstream выпустит исправление (braces или переход micromatch/chokidar на picomatch-only), обновить lockfile/override и вернуть `audit_level: high`.

## Acceptance criteria

- [ ] `npm audit --audit-level=high` в docs-site проходит.
- [ ] В workflow для docs-site снова `audit_level: high`, комментарий-исключение удалён.

## Этап

`stage:4-low` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/520
