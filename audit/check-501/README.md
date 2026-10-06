# Check via Codex — Issue #501

Шестой полный аудит кодовой базы после раундов #241, #368, #393, #405 и #423.
Список всех ранее заведённых issues (`experiments/check-501-existing-issues.txt`)
использован для dedup: в backlog попали только новые дефекты и незавершённые
remediation.

## Охват

- deployable Tact/FunC-контракты, governance, deploy/verify tooling;
- API, indexer и backend adapters;
- TS/Go/Python SDK, wallet-ui, dashboard, mobile/mobile-app, docs-site, faucet;
- CI/release workflows, Dockerfiles, docker-compose, dependency audit.

## Проверка ранее исправленного

Подтверждено, что исправления остаются на месте: #372, #373, #374, #375, #378,
#395, #396, #407, #408, #409, #410, #412, #413, #426, #427 (удалён
`InitializeAccount`), #428, #430, #431, #432. Неполными признаны #425
(см. CHECK501-M2) и #427 (см. CHECK501-M1).

## Результаты

1 Critical, 4 High, 8 Medium и 5 Low. Каждая проблема имеет отдельную
спецификацию и отдельный tracking issue с метками `audit`, `priority:*`,
`stage:*`, `type:*`, `track:*`.

| ID | Severity | Stage | Область | Проблема | Issue |
|---|---|---|---|---|---|
| [CHECK501-C1](findings/CHECK501-C1-account-locks-set-lock-noop.md) | Critical | 1-critical | contracts | AccountLocks.set_lock не сохраняет lock — fraud/collateral locks не действуют | [#503](https://github.com/xlabtg/tonbankcard-protocol/issues/503) |
| [CHECK501-H1](findings/CHECK501-H1-locks-not-propagated-to-merchant-hub.md) | High | 2-high | contracts | Lock-состояние AccountLocks никогда не доходит до MerchantPaymentHub | [#504](https://github.com/xlabtg/tonbankcard-protocol/issues/504) |
| [CHECK501-H2](findings/CHECK501-H2-nft-owner-write-once.md) | High | 2-high | contracts | Владелец NFT записывается один раз — контроль не переходит при transfer NFT (нарушение I2) | [#505](https://github.com/xlabtg/tonbankcard-protocol/issues/505) |
| [CHECK501-H3](findings/CHECK501-H3-indexer-skips-blocks-on-fetch-error.md) | High | 2-high | indexer | Indexer молча пропускает блок и его события при ошибке TON API | [#506](https://github.com/xlabtg/tonbankcard-protocol/issues/506) |
| [CHECK501-H4](findings/CHECK501-H4-client-deeplinks-tbc-as-ton.md) | High | 2-high | mobile/dashboard | Mobile и dashboard deep links передают сумму TBC как TON и шлют на NFT мерчанта | [#507](https://github.com/xlabtg/tonbankcard-protocol/issues/507) |
| [CHECK501-M1](findings/CHECK501-M1-paymenthub-no-funding-path.md) | Medium | 3-medium | contracts | PaymentHub после #427 не имеет пути пополнения и привязки владельца | [#508](https://github.com/xlabtg/tonbankcard-protocol/issues/508) |
| [CHECK501-M2](findings/CHECK501-M2-verifier-data-hash-and-admin.md) | Medium | 3-medium | deployment | verify.ts не может пройти для реального Tact deploy, а проверка admin опциональна (неполный #425) | [#509](https://github.com/xlabtg/tonbankcard-protocol/issues/509) |
| [CHECK501-M3](findings/CHECK501-M3-proposal-author-controls-quorum.md) | Medium | 3-medium | governance | Автор proposal сам задаёт quorum и длительность голосования | [#510](https://github.com/xlabtg/tonbankcard-protocol/issues/510) |
| [CHECK501-M4](findings/CHECK501-M4-invoice-status-lost-update.md) | Medium | 3-medium | api | Expiry и settlement invoice перезаписывают друг друга (lost update) | [#511](https://github.com/xlabtg/tonbankcard-protocol/issues/511) |
| [CHECK501-M5](findings/CHECK501-M5-api-production-storage-unwired.md) | Medium | 3-medium | api | API не стартует в production: persistent storage не подключён, API keys только в памяти | [#512](https://github.com/xlabtg/tonbankcard-protocol/issues/512) |
| [CHECK501-M6](findings/CHECK501-M6-faucet-rate-limit-bypass.md) | Medium | 3-medium | faucet | Rate limit faucet обходится альтернативными записями адреса; клиент выбирает сумму до hard cap | [#513](https://github.com/xlabtg/tonbankcard-protocol/issues/513) |
| [CHECK501-M7](findings/CHECK501-M7-webhook-empty-secret.md) | Medium | 3-medium | sdk | TS и Python SDK принимают пустой webhook secret (Go отклоняет) | [#514](https://github.com/xlabtg/tonbankcard-protocol/issues/514) |
| [CHECK501-M8](findings/CHECK501-M8-publish-workflows-hardening.md) | Medium | 3-medium | CI/release | Publish workflows: `inputs.*` интерполируются в `run:`, публикация с любой ветки, PyPI без тестов | [#515](https://github.com/xlabtg/tonbankcard-protocol/issues/515) |
| [CHECK501-L1](findings/CHECK501-L1-governance-pending-maps-unbounded.md) | Low | 4-low | governance | Pending-maps governance растут без ограничения | [#516](https://github.com/xlabtg/tonbankcard-protocol/issues/516) |
| [CHECK501-L2](findings/CHECK501-L2-adapters-parsefloat-amounts.md) | Low | 4-low | adapters | Adapters валидируют суммы и периоды через `parseFloat` и принимают мусор | [#517](https://github.com/xlabtg/tonbankcard-protocol/issues/517) |
| [CHECK501-L3](findings/CHECK501-L3-redis-setifabsent-race.md) | Low | 4-low | api | Redis `setIfAbsent` может сообщить успех без записи ключа | [#518](https://github.com/xlabtg/tonbankcard-protocol/issues/518) |
| [CHECK501-L4](findings/CHECK501-L4-webhook-timestamp-parity.md) | Low | 4-low | sdk | Парсинг timestamp webhook расходится между SDK | [#519](https://github.com/xlabtg/tonbankcard-protocol/issues/519) |
| [CHECK501-L5](findings/CHECK501-L5-docs-site-braces-exception.md) | Low | 4-low | dependencies | docs-site временно аудируется на уровне Critical из-за неисправленного braces | [#520](https://github.com/xlabtg/tonbankcard-protocol/issues/520) |

## Порядок реализации

1. **Stage 1 (critical):** CHECK501-C1 — без него не работает ни один lock.
2. **Stage 2 (high):** H1 (доставка lock в hub, зависит от C1), H2 (смена
   владельца NFT), H3 (потеря блоков indexer), H4 (клиентские deep links).
3. **Stage 3 (medium):** M1–M8; M2 желательно до любого mainnet deploy.
4. **Stage 4 (low):** L1–L5.

## Исправлено в PR #502

CI `Dependency Audit` падал во всех девяти workspaces (на `main` — с
2026-09-07) из-за новых advisories (axios, brace-expansion, browserslist,
js-yaml, tinypool и др.):

- обновлены lockfiles всех девяти workspaces (`npm audit fix` без breaking);
- `jest`/`@jest/globals` 29.7.0 → 30.5.2, `@types/jest` → 30.0.0 в
  `sdk`, `api`, `backend/indexer`, `scripts/faucet` — jest 30 больше не
  зависит от `braces`, для которого нет исправленной версии;
- override `tinypool@2.2.0` в docs-site устраняет Critical
  GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr;
- для docs-site порог временно `critical` из-за неисправимого upstream
  `braces` (CHECK501-L5, #520).

Контрактные и интеграционные findings в этом PR не исправляются: они требуют
отдельного design/security review.

## Воспроизведение

- `experiments/check-501-findings.json` — исходные данные findings;
- `experiments/check-501-create-issues.js` — генерация спецификаций/issues;
- `experiments/check-501-audit-status.txt` — состояние `npm audit` после
  `npm audit fix`, до обновления jest.
