# [CHECK423-L3] Три workspace объявляют неработающие lint scripts и исключены из CI lint

## Кратко

`api`, `scripts/faucet` и `contracts/payment-hub` объявляют `npm run lint`,
однако ни в одном из этих workspace нет ESLint-конфигурации. Команды
завершаются до анализа исходников с ошибкой
`ESLint couldn't find a configuration file`. CI lint job проверяет SDK,
indexer, wallet-ui, mobile и dashboard, но исключает все три workspace.

## Severity

Low — дефект сам по себе не меняет runtime-поведение и не нарушает
non-custodial инварианты, но оставляет security-sensitive API, faucet и
deployment tooling контракта без заявленного статического quality gate.

## Затронутый код

- `api/package.json:14,48-50`, `scripts/faucet/package.json`,
  `contracts/payment-hub/package.json` — lint scripts и ESLint dependencies
  присутствуют.
- перечисленные workspace — отсутствуют `.eslintrc.*` и `eslint.config.*`.
- `.github/workflows/ci.yml:206-269` — все три workspace отсутствуют в lint job.

## Воспроизведение

```bash
for workspace in api scripts/faucet contracts/payment-hub; do
  (cd "$workspace" && npm run lint)
done
```

Фактический результат: ESLint 8.57.1 сообщает, что configuration file не
найден, и возвращает ненулевой exit code.

## Acceptance criteria

- [ ] Добавить совместимые с ESLint 8 и TypeScript конфигурации во все три workspace.
- [ ] Включить `api`, `scripts/faucet` и `contracts/payment-hub` в CI lint job.
- [ ] Каждый `npm run lint` анализирует production-код и тесты и проходит.
- [ ] Добавить regression guard полного покрытия workspace с lint script.

## История / dedup

Полный поиск по 178 закрытым issues не нашёл отдельного tracking ticket.
API-проблема уже была явно зафиксирована в описании merged PR #356: его автор
не смог запустить lint именно из-за отсутствующей конфигурации. PR #356
закрывал API hardening #296, но этот инфраструктурный остаток не входил в
acceptance criteria и не получил отдельной задачи. Полный scan всех package
scripts подтвердил тот же дефект у faucet и payment-hub; отдельного closed
tracking ticket для них также нет.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/435
