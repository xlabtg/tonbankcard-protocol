# [CHECK423-H1] Live deployment и verifier допускают ложный успех

## Кратко

Канонический production entry point `scripts/deploy/deploy.ts` при запуске без
`--dry-run` не отправляет транзакции. Он вызывает `simulateDeployment`, записывает
адреса/хеши/tx с префиксом `[DRY RUN]` в production network directory и завершает
работу без ошибки. `verify.ts` не обращается к TON, но до remediation считал
dry-run hash совпавшим и не включал `hashPassed` в aggregate `allPassed`.

## Severity

High — operational integrity / ложная аттестация deployment. Runbooks называют
эти scripts каноническим B1/B2 путём, поэтому оператор мог перейти к следующему
шагу церемонии при фактическом отсутствии deployment.

## Затронутый код

- `scripts/deploy/deploy.ts:258-273` до remediation — live branch вызывает
  `simulateDeployment` и записывает manifest.
- `scripts/deploy/verify.ts:47-63` — on-chain code hash query отсутствует.
- `scripts/deploy/verify.ts:163-176` до remediation — state/admin hard-coded
  `true`, hash failure не влияет на `allPassed`.
- `docs/deployments/B2-mainnet/MULTISIG_CEREMONY.md:82-90` обещает unsigned BOC
  и обязательный успешный verifier между контрактами.

## Воспроизведение

Regression test: `contracts/payment-hub/deployment-tooling.spec.ts`.

До исправления suite не компилировался из-за отсутствия testable API, а исходный
live branch явно вызывал `simulateDeployment`. После containment тест доказывает:

1. live config бросает `Live deployment is not implemented`;
2. synthetic manifest без chain query получает `allPassed: false`;
3. code hash, state и admin checks остаются false.

## Исправление в PR #424

Добавлен fail-closed containment: симуляция доступна только с `--dry-run`, live
mode блокируется до реальной Blueprint-реализации, verifier больше не выдаёт
положительную аттестацию без TON query.

## Acceptance criteria полного решения

- [ ] Реализовать unsigned Blueprint BOC flow из B1/B2 runbooks.
- [ ] Получать deployed code/state через выбранный TON endpoint на заданном block.
- [ ] Сравнивать compiled code hash, init state и admin address.
- [ ] Валидировать manifest schema и отличать dry-run от live artefacts.
- [ ] Добавить sandbox/integration tests с положительным и отрицательным hash.
- [x] До реализации live mode и verifier fail closed.

## История / dedup

#118/#150 создали engagement/runbooks, но реальный deploy был явно оставлен за
рамками. Отдельного issue на расхождение scripts с утверждённым runbook не было.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/425
