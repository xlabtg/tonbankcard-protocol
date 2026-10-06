# [CHECK501-C1] AccountLocks.set_lock не сохраняет lock — fraud/collateral locks не действуют

## Кратко

`set_lock(cell lock_dict, ...)` возвращает `()` и вызывает `lock_dict~udict_set(...)` над локальной копией параметра. Вызывающий код затем делает `save_data(lock_dict, ...)` с неизменённым словарём, поэтому `set_fraud_lock`/`set_collateral_lock`/`clear_*` успешно завершаются, эмитят событие, но состояние не меняется.

## Severity

Critical — Нарушен инвариант I6: risk authority не может заблокировать скомпрометированный аккаунт; `get_can_send(X)` и `check_can_send` продолжают возвращать разрешение.

## Затронутый код

- `contracts/payments/account-locks.fc:149-158` — `() set_lock(cell lock_dict, ...)` с локальным `~udict_set`.
- `contracts/payments/account-locks.fc:217`, `:234`, `:251`, `:268` — вызовы `set_lock(lock_dict, ...)` без получения нового словаря.
- `contracts/payments/tests/account-locks.spec.fc:110,146,181` — тесты повторяют тот же паттерн и не ловят дефект; Sandbox-теста для AccountLocks нет.
- `scripts/deploy/deployable-contracts.ts:35` — контракт входит в deployable-набор.

## Воспроизведение

Risk authority отправляет `set_fraud_lock(X)` → транзакция успешна, событие отправлено → `get_account_lock_state(X)` возвращает 0.

## Рекомендуемое исправление

Сделать функцию модифицирующей: `(cell, ()) ~set_lock(cell lock_dict, ...) { ...; return (lock_dict, ()); }` и вызывать `lock_dict~set_lock(...)`.

## Acceptance criteria

- [ ] Sandbox-тест на скомпилированном `account-locks.fc`: `set_*_lock` → getter возвращает 1, `clear_*` → 0.
- [ ] Локи двух разных адресов не влияют друг на друга.
- [ ] FunC unit-тесты переписаны так, чтобы падать на старой реализации.

## Этап

`stage:1-critical` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/503
