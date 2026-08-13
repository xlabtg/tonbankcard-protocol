# [CHECK423-M3] CoinRabbit adapter подтверждает identity/collateral без chain query

## Кратко

Методы документированы как read-only on-chain verification, но
`resolveBorrowerIdentity` выводит collection только из очищенного строкового
префикса, принимает переданный caller owner и возвращает `isValid: true`.
`verifyCollateralSignal` без запроса контракта возвращает `isValid: true`,
`ownershipVerified: true`, `isActive: true` для любого signal ID с допустимым
префиксом account ID.

## Severity

Medium — false security assertion на границе внешнего lender. Adapter не
перемещает funds и содержит disclaimer, но typed fields выглядят как результат
проверки и могут быть потреблены интеграцией как authoritative boolean.

## Затронутый код

- `backend/adapters/coinrabbit.ts:101-128` — обещание chain query и prefix-only result.
- `...:145-157` — удаляются все non-digits, строгий формат не проверяется.
- `...:196-242` — положительная collateral/ownership verification placeholder.
- `tests/lending-adapter/` — tests подтверждают placeholder behavior, но package
  не подключён к CI.

## Acceptance criteria

- [ ] До chain integration все verification methods fail closed (`false`/unknown).
- [ ] Строго валидировать account/NFT address, не принимать caller owner как факт.
- [ ] Запрашивать resolver и CollateralSignal на определённом network/block.
- [ ] Различать `verified`, `unverified`, `unavailable`, `invalid` в типах.
- [ ] Подключить adversarial suite к CI: arbitrary signal, forged owner,
  unavailable RPC, wrong collection, stale block.

## История / dedup

#32 реализовал non-custodial informational adapter. Weak trust model допустим,
но положительные поля с названиями `ownershipVerified/isValid` без проверки не
были заведены как отдельный defect.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/430
