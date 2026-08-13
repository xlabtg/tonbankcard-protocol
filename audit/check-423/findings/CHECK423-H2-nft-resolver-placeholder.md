# [CHECK423-H2] Deployable NFTAccountResolver остаётся нерабочим placeholder

## Кратко

`scripts/deploy/deployable-contracts.ts` объявляет
`contracts/nft-resolver/nft_account_resolver.tact` production source. Однако
resolver возвращает сам `nft_address` вместо owner, всегда возвращает пустые
account flags и имеет no-op `set_payment_hub`. Он объявляет TEP-62 messages, но
не отправляет `GetNFTData`, не обрабатывает ответ и не отправляет
`ResolveNFTOwner` в MerchantPaymentHub/CollateralSignal.

## Severity

High — core account-authority и production liveness. Consumers доверяют только
immutable resolver; при текущей реализации их owner maps никогда не получают
валидную регистрацию. Off-chain caller getter также может принять NFT address
за owner.

## Затронутый код

- `scripts/deploy/deployable-contracts.ts:32-38` — resolver входит в B2 set.
- `contracts/nft-resolver/nft_account_resolver.tact:55-65` — placeholder owner.
- `...:89-98` — hard-coded flags.
- `...:117-120` — no-op configuration handler без access control.
- `contracts/MerchantPaymentHub.tact:175-188,417-428` — принимает registration
  только от resolver.

## Воспроизведение

```bash
experiments/check-423/reproduce-contract-blockers.sh
```

Script подтверждает deployable placeholder; line-level review показывает, что
`GetNFTData`/`NFTDataResponse` нигде не используются receiver/send path.

## Impact

- Merchant accounts и collateral identities не могут быть зарегистрированы
  production path.
- NFT ownership не обновляется после transfer.
- Документация о trusted on-chain resolver не соответствует bytecode source.

## Acceptance criteria

- [ ] Спроектировать TON asynchronous request/callback correlation и replay rules.
- [ ] Проверять init, collection whitelist, NFT item address derivation и owner.
- [ ] Отправлять resolver-gated, write-once registration всем нужным consumers.
- [ ] Защитить one-time wiring typed message и access control.
- [ ] Sandbox tests: valid owner, forged callback, wrong collection, burn,
  ownership transfer, replay/out-of-order response.
- [ ] Удалить resolver из production deployable set до прохождения тестов.

## История / dedup

#260/#320 исключили нерабочий FunC stub, но заменили его Tact-файлом, названным
«production async resolver», не реализовав async flow. Отдельного tracking issue
на этот residual не осталось.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/426
