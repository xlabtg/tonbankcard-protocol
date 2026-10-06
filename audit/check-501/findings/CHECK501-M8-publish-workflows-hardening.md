# [CHECK501-M8] Publish workflows: `inputs.*` интерполируются в `run:`, публикация с любой ветки, PyPI без тестов

## Кратко

`npm-publish-sdk.yml` подставляет `${{ inputs.version }}`/`${{ inputs.dist_tag }}` прямо в shell в job с `id-token: write`. `workflow_dispatch` обоих workflows разрешён с любого ref; PyPI публикуется по любому тегу `sdk-python-v*` без тестов и сверки версии; guard `exit 78` в Actions v2 — обычный failure.

## Severity

Medium — Dispatcher может выполнить произвольный код рядом с OIDC provenance token (`dist_tag=x"; curl …; "`) или опубликовать пакет с непроверенной ветки.

## Затронутый код

- `.github/workflows/npm-publish-sdk.yml:27-29`, `:85-90`, `:104-110`, `:160-163`.
- `.github/workflows/pypi-publish.yml:14-18`, `:26-66`.

## Воспроизведение

Dispatch `npm-publish-sdk` с `dist_tag` содержащим `"; id; "` → команда выполняется.

## Рекомендуемое исправление

Передавать inputs через `env:` и валидировать (semver, `^[a-z0-9-]+$`); ограничить ref `main`/защищёнными тегами; required reviewers в environments; pytest и tag-vs-version перед PyPI build; заменить `exit 78` на skip через outputs.

## Acceptance criteria

- [ ] Нет `${{ inputs.* }}` внутри `run:`; публикация с не-main ref падает; PyPI запускает тесты и сверяет версию.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/515
