# [CHECK501-M1] PaymentHub после #427 не имеет пути пополнения и привязки владельца

## Кратко

После удаления `InitializeAccount` ни один handler не кредитует баланс; `RegisterAccountNFT` не задаёт владельца, а владелец по умолчанию — сам адрес NFT item, который никогда не отправляет `TransferInternalRequest`.

## Severity

Medium — Deployable контракт не может перемещать value — тот же deadlock, что #428 исправил для MerchantPaymentHub.

## Затронутый код

- `contracts/payments/PaymentHub.tact:231-235`, `:268-273`, `:314-318`, `:446-450`.
- `scripts/deploy/deployable-contracts.ts:34-43`.

## Воспроизведение

Deploy → любой `TransferInternalRequest` отклоняется, балансы всегда 0.

## Рекомендуемое исправление

Либо исключить PaymentHub из deployable-набора, либо добавить аутентифицированный settlement deposit с replay map и resolver-verified привязку владельца по образцу MerchantPaymentHub.

## Acceptance criteria

- [ ] Sandbox-тест deposit → owner-verified transfer → сохранение баланса, либо PaymentHub исключён из deployable map и build projects.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/508
