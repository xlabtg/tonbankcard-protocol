# [CHECK501-L3] Redis `setIfAbsent` может сообщить успех без записи ключа

## Кратко

Если `SET NX` не удался, а ключ истёк/удалён до последующего `get`, метод возвращает `undefined`, и вызывающий считает себя победителем, хотя ключ не записан.

## Severity

Low — Два разных invoice для одного idempotent-запроса.

## Затронутый код

- `api/src/storage/RedisIdempotencyStorage.ts:115-123`.
- `api/src/services/InvoiceService.ts:262,323` — stale-cleanup удаляет ключи.

## Воспроизведение

Mock client: `set` → null, `get` → null → результат `undefined` (absent).

## Рекомендуемое исправление

Атомарно: Lua-скрипт или `SET ... NX GET` (Redis 7+), либо повтор `SET NX` при пустом `get`.

## Acceptance criteria

- [ ] Тест с mock client: результат «absent» только если ключ действительно записан.

## Этап

`stage:4-low` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/518
