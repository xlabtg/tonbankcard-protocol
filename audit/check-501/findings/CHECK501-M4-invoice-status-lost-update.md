# [CHECK501-M4] Expiry и settlement invoice перезаписывают друг друга (lost update)

## Кратко

`getInvoice` и `cleanupExpiredInvoices` читают invoice и записывают обратно `status='expired'` полной строкой; `processSettlementEvent` записывает `status='settled'`. Upsert в PostgresStorage безусловно перезаписывает `status`, `metadata`, `settlement`.

## Severity

Medium — Оплаченный on-chain invoice может оказаться `expired` с `settlement = NULL` и больше не settle'иться, т.к. уже не `pending`.

## Затронутый код

- `api/src/services/InvoiceService.ts:350-364`, `:652-694`, `:720-724`.
- `api/src/storage/PostgresStorage.ts:108-111`.

## Воспроизведение

Pending invoice после `expires_at`; параллельно settlement и `GET /status`: чтение GET до записи settle, запись GET после → `expired`.

## Рекомендуемое исправление

Условные переходы: `UPDATE ... SET status='settled' ... WHERE status='pending'`, `... SET status='expired' WHERE status='pending' AND expires_at < now()`; метод `transition(id, from, to, patch)` в `IInvoiceStorage`.

## Acceptance criteria

- [ ] При interleaving read/settle/expire итог — `settled` с сохранённым settlement; тест с mock pool.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/511
