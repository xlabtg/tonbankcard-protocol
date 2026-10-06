# [CHECK501-M5] API не стартует в production: persistent storage не подключён, API keys только в памяти

## Кратко

Singleton `InvoiceService` всегда создаётся с in-memory stores; `assertProductionStorageConfigured()` завершает процесс при `NODE_ENV=production`; `PostgresInvoiceStorage`/`RedisIdempotencyStorage` нигде не конструируются; реестр API keys — process-local `Map`.

## Severity

Medium — Production deploy всегда завершается с кодом 1; обход через другой `NODE_ENV` теряет invoices, idempotency и ключи при рестарте и ломает работу нескольких реплик.

## Затронутый код

- `api/src/services/InvoiceService.ts:764`.
- `api/src/index.ts:78`.
- `api/src/services/ApiKeyService.ts:49,61`.

## Воспроизведение

`NODE_ENV=production DATABASE_URL=... REDIS_URL=... node dist/index.js` → exit 1.

## Рекомендуемое исправление

Factory, создающая Postgres/Redis stores из `DATABASE_URL`/`REDIS_URL` при старте; persistent storage для API keys либо fail-fast.

## Acceptance criteria

- [ ] Production-конфигурация с БД и Redis стартует; ключи и invoices переживают рестарт; integration-тест wiring.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/512
