# [CHECK423-L4] Quickstart smoke test всегда падает на каноническом SDK output и не запускается CI

## Кратко

`scripts/smoke-test.sh` проверяет round-trip `parseTBC('1')` → `formatTBC(...)`,
но принимает только строки `1` и `1.0`. Канонический default SDK output —
`1.00`, что закреплено unit/browser tests. Поэтому `npm run smoke` завершается
ошибкой после успешной сборки. Quickstart workflow реагирует на изменение
smoke script, однако ни один его job сам smoke test не запускает.

## Severity

Low — runtime SDK корректен, но заявленный one-command onboarding и его
проверка дают ложный failure; CI не замечает регрессию.

## Затронутый код

- `scripts/smoke-test.sh:36-42` — stale expected formatting.
- `sdk/src/amount.ts:27` — default `decimals = 2`.
- `sdk/tests/utils.spec.ts:323-325`, `sdk/tests/browser.spec.ts:32-34` —
  канонический `1.00` уже закреплён.
- `.github/workflows/quickstart.yml:33-113` — нет запуска `npm run smoke` или
  полного setup path со smoke.

## Воспроизведение

```bash
npm run build
npm run smoke
```

Фактический результат:
`smoke: TBC helpers returned unexpected result: 1.00` и exit code 1.

## Acceptance criteria

- [x] Smoke assertion соответствует каноническому `formatTBC` output.
- [x] Smoke regression доказывает успешный parse/format round-trip.
- [x] Quickstart CI действительно запускает smoke после сборки.
- [x] `npm run setup` и отдельный `npm run smoke` проходят после clean install.

## Исправление в PR #424

Ожидание синхронизировано с SDK unit tests (`1.00`), а quickstart workflow
запускает полный `scripts/setup.sh` path. До исправления `npm run smoke` падал;
после исправления и отдельный smoke, и full setup проходят локально.

## История / dedup

Smoke script появился в C4 / #125 и с момента исходного commit `cd993c4` не
менялся. #125 требовал working end-to-end setup и CI-проверку, но был закрыт;
текущий workflow проверяет только `setup.sh --install-only`, а не smoke.
Отдельного closed tracking ticket для этого остатка нет.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/436
