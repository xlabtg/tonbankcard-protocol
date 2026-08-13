# [CHECK423-M1] MerchantPaymentHub не имеет production funding path

## Кратко

После удаления admin `SetAccountBalance` production contract создаёт account с
нулевым балансом. Единственный credit path выполняется только после успешного
debit другого payer. Поскольку все fresh payers равны нулю, первая успешная
операция невозможна: flow замкнут и всегда приходит к
`ERROR_INSUFFICIENT_BALANCE`.

## Severity

Medium — protocol economics / production liveness. Funds не подвергаются риску,
но заявленный merchant settlement flow невозможно запустить.

## Затронутый код

- `contracts/MerchantPaymentHub.tact:332-340` — debit-before-credit.
- `...:371-376` — отсутствующий balance равен zero.
- `...:417-428` — resolver registration не создаёт balance.
- `docs/governance/PARAMETERS.md:208-211` — проблема уже помечена
  `UNRESOLVED / blocks production liveness`.

## Acceptance criteria

- [ ] Утвердить non-custodial TBC deposit/settlement mechanism.
- [ ] Проверять token provenance и credit ровно один раз.
- [ ] Исключить admin mint/forced balance mutation.
- [ ] Sandbox test проходит путь fresh NFT → deposit → merchant payment.
- [ ] Replay/forged deposit tests не изменяют balance.

## История / dedup

#414 сгруппировал эту проблему с SnapshotVerifier setter. PR #422 исправил только
SnapshotVerifier и явно оставил funding unresolved, после чего #414 был закрыт.
Этот issue выделяет незавершённый пункт отдельно.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/428
