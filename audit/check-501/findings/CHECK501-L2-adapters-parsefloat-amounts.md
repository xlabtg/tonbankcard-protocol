# [CHECK501-L2] Adapters валидируют суммы и периоды через `parseFloat` и принимают мусор

## Кратко

`parseFloat("1abc") === 1`, `"Infinity"` и `"1e400"` проходят `> 0`, сырая строка сохраняется в intent/proposal/mandate. В recurring `periodSeconds = NaN`/`maxExecutions = NaN` проходят все сравнения.

## Severity

Low — Некорректные значения попадают в состояние адаптеров и далее в сообщения контрактов.

## Затронутый код

- `backend/adapters/bridge.ts:127`, `:146`.
- `backend/adapters/multisig.ts:128`.
- `backend/adapters/recurring.ts:238-258`.

## Воспроизведение

`bridge.createBridgeIntent(acct, chain, "Infinity", addr)` успешен; mandate с `periodSeconds: NaN` успешен.

## Рекомендуемое исправление

Канонический decimal regex (`/^(0|[1-9]\d*)(\.\d{1,9})?$/`) + BigInt; `Number.isSafeInteger` для периодов и счётчиков.

## Acceptance criteria

- [ ] `"1abc"`, `"Infinity"`, `"1e3"`, `" 1"`, `NaN`, `1.5` отклоняются; unit-тесты для каждого adapter.

## Этап

`stage:4-low` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/517
