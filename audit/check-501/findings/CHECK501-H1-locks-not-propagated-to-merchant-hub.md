# [CHECK501-H1] Lock-состояние AccountLocks никогда не доходит до MerchantPaymentHub

## Кратко

MerchantPaymentHub принимает только Tact-сообщение `ApplyAccountLock` от `account_locks_contract`, а `account-locks.fc` отправляет raw-сообщения `0x4c6f636b`/`0x556e6c6b` и только на адрес NFT, а не на hub. Header `0x18` при этом выставляет bounce, а mode 64 пересылает value authority на NFT item.

## Severity

High — Даже после исправления C1 fraud lock не блокирует платежи: `canSendWithLocks` в hub видит состояние по умолчанию.

## Затронутый код

- `contracts/MerchantPaymentHub.tact:514-516` — receiver `ApplyAccountLock`.
- `contracts/payments/account-locks.fc:161-186` — emit на NFT address с opcode `0x4c6f636b`/`0x556e6c6b`.
- `contracts/merchant-hub/*merchant-payment-hub.spec.ts` — в тестах в роли locks-контракта используется treasury wallet, что маскирует проблему.

## Воспроизведение

Fraud lock на payer P в AccountLocks → P продолжает успешно платить через MerchantPaymentHub.

## Рекомендуемое исправление

Либо AccountLocks отправляет корректно сериализованный `ApplyAccountLock` зарегистрированным hub'ам, либо hub запрашивает lock-состояние сам. Исправить header на non-bounceable (`0x10`) и режим отправки.

## Acceptance criteria

- [ ] End-to-end Sandbox-тест: fraud lock в AccountLocks → платёж в MerchantPaymentHub отклоняется `ERROR_PAYER_LOCKED`; после clear — проходит.
- [ ] Тесты используют реальный скомпилированный AccountLocks, а не wallet.

## Этап

`stage:2-high` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/504
