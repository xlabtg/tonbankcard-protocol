# [CHECK501-M2] verify.ts не может пройти для реального Tact deploy, а проверка admin опциональна (неполный #425)

## Кратко

Verifier требует равенства live data hash и data hash StateInit, но Tact-контракты переписывают data при первом `init()`. Тест проходит только потому, что manifest строится из post-deploy data. Проверка admin пропускается, если в `initParameters` нет ключа `admin`/`risk_authority`, а конструкторы используют `deployer_address`. Проверки Deployer ≠ Admin ≠ Risk-Authority, заявленной в runbook, нет.

## Severity

Medium — Инструмент либо всегда падает на реальном deploy (и его начнут игнорировать), либо молча пропускает проверку authority.

## Затронутый код

- `scripts/deploy/verify.ts:140-142`, `:160-163`, `:165-172`.
- `scripts/deploy/deploy.ts:113`.
- `contracts/payment-hub/deployment-tooling.spec.ts:105-117`.
- `MAINNET_RUNBOOK.md:108`.

## Воспроизведение

Sandbox deploy Tact-контракта с реальным StateInit → `dataHash` mismatch; manifest без `admin` → admin-check пропущен.

## Рекомендуемое исправление

Сравнивать с ожидаемыми post-init данными (вычисленными в Sandbox) или по getter'ам; требовать ожидаемую authority для каждого контракта; добавить проверку различия ролей.

## Acceptance criteria

- [ ] Sandbox deploy каждого Tact deployable проходит verify.
- [ ] Отсутствующий/несовпадающий admin → fail; совпадающие deployer/admin → fail.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/509
