# Check via Codex — Issue #423

Пятый полный аудит кодовой базы после раундов #241, #368, #393 и #405.
Проверены все 178 закрытых issues и 243 закрытых pull requests, чтобы отделить
новые дефекты от уже исправленных и выявить незавершённые remediation.

## Охват

- deployable Tact/FunC-контракты, инварианты и production gates;
- API, indexer, внешние adapters и SDK;
- wallet-ui, dashboard, mobile/mobile-app и docs-site;
- deploy/governance tooling, CI, dependency audit и документация;
- соответствие non-custodial модели из `audit/INVARIANTS.md` и
  `CONTRIBUTING.md`.

## Результаты

Критических findings не найдено. Подтверждены 3 High, 5 Medium и 4 Low
проблемы; каждая имеет отдельную спецификацию и отдельный tracking issue.

| ID | Severity | Stage | Область | Проблема | Issue |
|---|---|---|---|---|---|
| [CHECK423-H1](findings/CHECK423-H1-deployment-tooling-false-success.md) | High | 2-high | deployment | Live deploy создавал dry-run manifest, verifier мог сообщить успех без on-chain проверки | [#425](https://github.com/xlabtg/tonbankcard-protocol/issues/425) |
| [CHECK423-H2](findings/CHECK423-H2-nft-resolver-placeholder.md) | High | 2-high | contracts | Deployable NFT resolver не резолвит владельца и не регистрирует consumers | [#426](https://github.com/xlabtg/tonbankcard-protocol/issues/426) |
| [CHECK423-H3](findings/CHECK423-H3-paymenthub-admin-mint.md) | High | 2-high | contracts | Admin может создать свежий PaymentHub account с произвольным балансом | [#427](https://github.com/xlabtg/tonbankcard-protocol/issues/427) |
| [CHECK423-M1](findings/CHECK423-M1-merchant-funding-deadlock.md) | Medium | 3-medium | contracts/economics | MerchantPaymentHub не имеет production funding path | [#428](https://github.com/xlabtg/tonbankcard-protocol/issues/428) |
| [CHECK423-M2](findings/CHECK423-M2-dependency-audit-coverage.md) | Medium | 3-medium | dependencies/CI | Audit matrix пропустила shipped workspaces и накопила High/Critical advisories | [#429](https://github.com/xlabtg/tonbankcard-protocol/issues/429) |
| [CHECK423-M3](findings/CHECK423-M3-coinrabbit-false-verification.md) | Medium | 3-medium | adapter | CoinRabbit возвращает положительную identity/collateral verification без chain query | [#430](https://github.com/xlabtg/tonbankcard-protocol/issues/430) |
| [CHECK423-M4](findings/CHECK423-M4-deployable-contract-ci-gap.md) | Medium | 3-medium | contracts/CI | Два core deployable-контракта не компилируются и не тестируются CI | [#431](https://github.com/xlabtg/tonbankcard-protocol/issues/431) |
| [CHECK423-M5](findings/CHECK423-M5-phase4-test-handlers.md) | Medium | 3-medium | contracts | Phase 4 mainnet sources всё ещё содержат test-only authority handlers | [#432](https://github.com/xlabtg/tonbankcard-protocol/issues/432) |
| [CHECK423-L1](findings/CHECK423-L1-governance-snapshot-placeholder.md) | Low | 4-low | governance/tooling | Документированный snapshot generator всегда использует placeholder queries | [#433](https://github.com/xlabtg/tonbankcard-protocol/issues/433) |
| [CHECK423-L2](findings/CHECK423-L2-dependabot-control-missing.md) | Low | 4-low | dependencies | Документация заявляет Dependabot control, но конфигурация удалена | [#434](https://github.com/xlabtg/tonbankcard-protocol/issues/434) |
| [CHECK423-L3](findings/CHECK423-L3-lint-gates-missing.md) | Low | 4-low | tooling/CI | Три workspace объявляют неработающие lint scripts и исключены из CI lint | [#435](https://github.com/xlabtg/tonbankcard-protocol/issues/435) |
| [CHECK423-L4](findings/CHECK423-L4-stale-quickstart-smoke.md) | Low | 4-low | quickstart/CI | Smoke test отвергает канонический SDK output и не запускается workflow | [#436](https://github.com/xlabtg/tonbankcard-protocol/issues/436) |

## Исправлено или безопасно ограничено в PR #424

- `deploy.ts` больше не подменяет live deployment симуляцией: live mode
  завершается ошибкой до записи manifest.
- `verify.ts` fail-closed: code hash/state/admin checks остаются `false`, пока
  нет реального blockchain query; aggregate report также падает.
- Добавлены regression tests для обоих deployment failure modes.
- Обновлены lockfiles всех девяти shipped npm workspaces. В восьми из них
  `npm audit` сообщает 0 vulnerabilities.
- `mobile-app` и `docs-site` добавлены в audit matrix; CI guard не позволит
  снова исключить locked workspace.
- Quickstart smoke принимает канонический SDK output `1.00`, а workflow теперь
  запускает полный install/build/smoke path вместо одного install-only режима.
- Для `docs-site` устранены Critical advisories и уязвимый
  `serialize-javascript`. Единственный корень оставшихся High findings —
  `image-size@2.0.2`, последняя upstream-версия без исправления. До его
  remediation docs-site временно блокирует Critical, остальные workspaces —
  High и Critical.

Контрактные, экономические и интеграционные findings в этом PR не исправляются:
они требуют отдельного design/security review и не должны решаться быстрым
изменением frozen production logic.

## Воспроизведение и проверки

- `experiments/check-423/reproduce-contract-blockers.sh` подтверждает
  незакрытые source-level blockers.
- `scripts/tooling/check-dependency-audit-coverage.sh` проверяет полный охват
  shipped lockfiles.
- `contracts/payment-hub/deployment-tooling.spec.ts` фиксирует fail-closed
  deployment/verification semantics.
- Fresh baseline CI: Dependency Audit run 31704315208 упал на SHA
  `0d6e9838f0cfb1696bac2e3ec09637c0a589201b`; полный лог сохранён локально в
  ignored `ci-logs/dependency-audit-31704315208.log`.

Все воспроизведения используют синтетические данные; секреты и реальные ключи
не использовались.
