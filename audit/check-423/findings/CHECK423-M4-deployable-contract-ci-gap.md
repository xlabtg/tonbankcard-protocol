# [CHECK423-M4] CI не компилирует core PaymentHub и NFTAccountResolver

## Кратко

Production map включает `contracts/payments/PaymentHub.tact` и
`contracts/nft-resolver/nft_account_resolver.tact`, но contract CI build из
`contracts/payment-hub/tact.config.json` компилирует только
`account-state.tact`. Большая часть regression suite проверяет production files
как текст. Поэтому deployable source может не компилироваться или сохранять
опасный handler без bytecode/behavioral test.

## Severity

Medium — release verification gap. Этот разрыв позволил CHECK423-H2/H3
сосуществовать с зелёным `Test (Contracts)`.

## Затронутый код

- `scripts/deploy/deployable-contracts.ts:32-38` — production set.
- `contracts/payment-hub/tact.config.json:2-15` — только account-state project.
- `.github/workflows/ci.yml:458-482` — build/test package без core sources.
- `experiments/issue-371-paymenthub-create-once` отдельно компилирует PaymentHub,
  но не запускается CI.

## Acceptance criteria

- [ ] Каждый Tact/FunC source из deployable map компилируется в PR CI.
- [ ] CI сверяет deployable map с build projects и падает на расхождении.
- [ ] PaymentHub admin-mint и resolver callbacks имеют sandbox behavior tests.
- [ ] Release manifest ссылается только на проверенные artifacts/code hashes.
- [ ] Static text tests остаются defense-in-depth, а не единственной проверкой.

## История / dedup

#260/#320 добавили manifest guard против FunC stubs, но не включили replacement
Tact sources в compile matrix. Отдельного issue на artifact coverage не было.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/431
