# [CHECK423-H3] PaymentHub admin может создать произвольный внутренний баланс

## Кратко

Deployable `contracts/payments/PaymentHub.tact` сохраняет test/setup message
`InitializeAccount`. Admin выбирает произвольные `nft_address`, `owner`,
`initial_state` и `initial_balance`. Create-once guard защищает существующий
account от overwrite, но не ограничивает баланс нового slot и не связывает его
с TBC deposit/settlement.

## Severity

High — нарушение ledger conservation и non-custodial I3/I5. Скомпрометированный
admin может создать контролируемый owner account с необеспеченным балансом и
использовать обычный owner-authorized transfer path.

## Затронутый код

- `contracts/payments/PaymentHub.tact:92-98` — admin-controlled initial balance.
- `...:337-359` — единственные guards: sender=admin и slot отсутствует.
- `scripts/deploy/deployable-contracts.ts:36` — source входит в production set.
- `docs/governance/PARAMETERS.md:203` — path описан как governance setup.

## Воспроизведение

`experiments/check-423/reproduce-contract-blockers.sh` подтверждает прямое
присваивание `balance: msg.initial_balance`. Existing sandbox experiment
`experiments/issue-371-paymenthub-create-once` уже компилирует тот же production
source и может быть расширен двумя fresh accounts: admin mint → owner transfer.

## Acceptance criteria

- [ ] Удалить `InitializeAccount` из mainnet artefact либо разрешить только
  resolver-verified registration с нулевым balance.
- [ ] Баланс увеличивается только после подтверждённого TBC deposit/settlement.
- [ ] Sandbox PoC admin-mint → transfer падает до mutation.
- [ ] Conservation property проверяется для любой успешной операции.
- [ ] Production CI компилирует именно `contracts/payments/PaymentHub.tact`.

## История / dedup

#371/#385 закрыли overwrite/drain существующего account. PR #385 прямо отметил,
что mint в свежий slot остаётся test-only residual, но отдельный issue не был
создан.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/427
