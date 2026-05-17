# Отчёт по покрытию тестами

**Issue:** [#127 [D1] Test Coverage Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/127)
**Branch:** `issue-127-bd8be363e35c`
**Дата сбора:** 2026-05-17
**Инструмент:** Jest + Istanbul (`npm run test:coverage`)

---

## Сводка

| Пакет | Тестов | Stmts | Branch | Funcs | Lines | Порог в `package.json` | Целевой порог (issue) | Статус |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `sdk` | 75 | 50.52 % | 55.17 % | 54.32 % | 50.81 % | 80 % | 75 % | ❌ ниже цели |
| `backend/indexer` | 79 | 45.51 % | 31.88 % | 47.88 % | 45.47 % | 70 % | 70 % | ❌ ниже цели |
| `api` (Merchant API) | 97 | 72.32 % | 70.37 % | 64.44 % | 73.15 % | 75 %¹ | 75 % | ⚠️ почти на цели |
| `contracts/payment-hub` | 25 | n/a² | n/a² | n/a² | n/a² | 80 % | 80 % | ⚠️ Tact не инструментируется Istanbul |
| `tests/invariants` (I1–I7) | 26 | — | — | — | — | — | — | ✅ все property-based проверки проходят |
| `tests/adversarial` (новое) | **39** | **93.61 %** | **93.33 %** | **86.66 %** | **93.47 %** | **80 %** | — | ✅ выше порога |

¹ Порог 75 % добавлен в `api/package.json` этим PR.  
² `contracts/payment-hub` тестируется через `@ton/sandbox` (Blueprint), исходный язык — Tact. Istanbul не способен инструментировать Tact-байткод, поэтому отчёт по покрытию TypeScript-обвязки не имеет смысла. Проверка качества — через 25 поведенческих spec-ов (`contracts/payment-hub/tests/*.spec.ts`).

---

## Что было сделано в этом PR (#159)

1. Новый пакет `tests/adversarial/` (`@tonbankcard/adversarial-tests`) с 39 проверками:
   - 5 целевых adversarial-сценариев из issue:
     - `scenarios/replay-attack.spec.ts` (T5 — повторная оплата того же invoice id)
     - `scenarios/lock-race-condition.spec.ts` (T2/T4 — гонка set/unset fraud-lock)
     - `scenarios/double-spend.spec.ts` (T4/T5 — два invoice'а суммарно > баланса)
     - `scenarios/lock-bypass.spec.ts` (T4, R-CRIT-1 — попытка обойти fraud-lock через merchant pay)
     - `scenarios/nft-spoofing.spec.ts` (T1/T6 — оплата NFT из не-whitelisted коллекции)
   - Fuzz-набор `fuzz/payment-hub-fuzz.spec.ts` для трёх entry-points `PaymentHub.tact`:
     - `transfer` — конверсия, негативные / `MAX_UINT256` / нулевые суммы, пустые и максимально длинные адреса, неавторизованные caller-ы
     - `lockAccount` / `unlockAccount` — авторизация risk-authority и lending-adapter
     - случайные последовательности операций (state-machine fuzz) с проверкой I5
2. Порог покрытия `tests/adversarial/`: 80 % (фактически 93 %).
3. Порог покрытия `api/` поднят с «не задан» до 75 % per-package.
4. Новый CI-джоб `test-adversarial` (см. `.github/workflows/ci.yml`) — запускает `npm run test:coverage` и валит сборку, если adversarial-пакет уходит ниже 80 %.

---

## Соответствие требованиям issue §2 «Coverage Improvements»

| Требование | Состояние |
|---|---|
| Contracts ≥ 80 % | Порог зафиксирован в `contracts/payment-hub/package.json`; 25 поведенческих тестов на `@ton/sandbox` проходят. Coverage Istanbul не применим к Tact (см. §"Известные ограничения"). |
| Indexer ≥ 70 % | Порог зафиксирован в `backend/indexer/package.json`. Фактическое покрытие 45.47 % — **требуется отдельный PR** (см. §"План закрытия пробелов"). |
| SDK ≥ 75 % | Порог в `sdk/jest.config.js` стоит на 80 %. Фактическое покрытие 50.81 % — **требуется отдельный PR**. |
| Merchant API ≥ 75 % | Порог 75 % добавлен в этом PR (`api/package.json`). Фактическое покрытие 73.15 % — **разрыв 1.85 п.п., закрывается одним блоком тестов сериализации** (см. §"План закрытия пробелов"). |
| Adversarial: ≥ 5 сценариев | ✅ 5 сценариев + fuzz-набор, всего 39 тестов. |
| Fuzz для PaymentHub entry points | ✅ `fuzz/payment-hub-fuzz.spec.ts`, бюджет ≤ 30 c на target (см. §"Fuzz-бюджет"). |
| CI падает при просадке покрытия | ✅ Новый job `test-adversarial` запускает `--coverage` с enforced thresholds. Существующие per-package пороги сохранены и **уже** валят `test:coverage`-команду локально. |

---

## Известные ограничения

### Tact-контракты не покрываются Istanbul

`contracts/payment-hub` написан на Tact и компилируется в TVM-байткод. Istanbul не инструментирует Tact, поэтому Jest показывает 0 / 0 / 0 / 0 для этого пакета даже при 25 проходящих spec-ах. Качество покрывается поведенческими тестами на `@ton/sandbox`:

- `PaymentHub.spec.ts`: 17 тестов на жизненный цикл аккаунта, переходы состояний (ACTIVE/FROZEN/SUSPENDED/CLOSED), receive/send-блокировки.
- `MerchantPaymentHub.spec.ts`: 8 тестов на whitelist коллекций, идемпотентность invoice.

Альтернатива: добавить кастомный coverage-сборщик для Tact (отдельная задача — см. issue #-tbd).

### Низкое покрытие в SDK и Indexer

- `sdk/src/widget/PaymentWidget.ts` (~18 %) и `sdk/src/sdk.ts` (~31 %) — UI-виджет и HTTP-клиент. Тесты есть только на mock-режим и утилиты; нужны интеграционные тесты с моком `fetch`/`window`.
- `backend/indexer/src/services/indexer-service.ts` (~18 %) и `src/api/*` (0 %) — наибольший «непокрытый» объём. Нужны e2e-тесты с замоканной TON-нодой и Express-роутером.

---

## План закрытия пробелов (follow-up PR-ы)

| Пакет | Ожидаемый дельта-PR | Цель |
|---|---|---|
| `api/` | +5 тестов на `PostgresStorage` + `RedisIdempotencyStorage` (через мок-драйверы) | 73 % → 80 % |
| `sdk/` | +тесты `PaymentWidget` (JSDOM) и `SDK.createInvoice/getInvoice` (mocked `fetch`) | 51 % → 78 % |
| `backend/indexer/` | +e2e-тесты роутера + sandbox-нода | 45 % → 72 % |
| `contracts/payment-hub/` | Кастомный Tact-coverage instrument (см. INTERNAL-tbd) | reporting → enforcement |

Эти PR трекаются как подзадачи #127.

---

## Fuzz-бюджет

Все fuzz-properties в `tests/adversarial/fuzz/payment-hub-fuzz.spec.ts` используют `numRuns` ≤ 200; локальное время прогона всех 14 fast-check свойств — **≈ 0.4 с** (на M-классе CI ≤ 2 с). Это укладывается в требование issue §6 «≤ 30 с на fuzz-таргет в CI» с запасом 15×.

Если в будущем потребуется более глубокий fuzz, в `package.json` можно повысить `numRuns` до 5000 — расчётный бюджет ≈ 8 с, всё ещё ниже лимита.

---

## Команды для воспроизведения

```bash
# Все adversarial-тесты (включая fuzz) с проверкой покрытия:
cd tests/adversarial && npm install && npm run test:coverage

# Property-based инварианты (I1–I7):
cd tests/invariants && npm install && npm test

# Per-package coverage:
cd sdk && npm run test:coverage
cd backend/indexer && npm run test:coverage
cd api && npm run test:coverage
cd contracts/payment-hub && npm run build && npm run test:coverage
```
