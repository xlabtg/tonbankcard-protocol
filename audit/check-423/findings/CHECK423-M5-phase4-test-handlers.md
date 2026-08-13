# [CHECK423-M5] Phase 4 sources сохраняют test-only authority handlers

## Кратко

Main source files Phase 4 всё ещё содержат deployer-gated owner/relayer seeding:
`RegisterNFTOwnerRecurring`, `RegisterNFTOwnerMultiSig`,
`RegisterNFTOwnerBridge`, `RegisterRelayer` и `RegisterNFTOwnerLending`.
Документация требует удалить их из mainnet artefacts, однако после закрытия всех
предыдущих issues работа не имеет открытого tracking ticket.

## Severity

Medium сейчас, High при попадании в mainnet artefact. Phase 4 официально
testnet-only, поэтому finding — release blocker, а не текущий exploit.

## Затронутый код

- `contracts/RecurringPayments.tact:436`.
- `contracts/MultiSigCard.tact:719`.
- `contracts/CrossChainBridge.tact:421,429`.
- `contracts/LendingProtocolCoordinator.tact:383`.
- `docs/governance/PARAMETERS.md:238-252` — PP-37…PP-40 remain open.

## Acceptance criteria

- [ ] Удалить handlers/messages из mainnet compilation targets.
- [ ] Tests используют отдельные non-deployable harnesses.
- [ ] Release gate сканирует generated ABI/bytecode, не только source.
- [ ] Реальные ownership/relayer authority paths проходят A2 review.
- [ ] Mainnet manifest schema отвергает Phase 4 artifacts до verdict READY.

## История / dedup

PR #109 добавил deployer/write-once mitigation как временную. A2 и PP-37…PP-40
прямо требуют окончательного удаления; отдельного открытого issue нет.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/432
