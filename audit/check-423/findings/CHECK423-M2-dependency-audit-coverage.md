# [CHECK423-M2] Dependency audit пропустил workspaces и допустил High/Critical drift

## Кратко

Fresh run 31704315208 на PR #424 упал: семь включённых workspaces содержали
High advisories. При этом matrix по-прежнему не включал shipped `mobile-app` и
`docs-site`; ручной audit обнаружил ещё 2 High в mobile-app и 43 findings в
docs-site, включая 2 Critical.

## Severity

Medium — supply-chain visibility и CI control regression. Известная acceptance
criteria #411 осталась незакрытой, поэтому два production artefacts не
сканировались вообще.

## Доказательства

- `.github/workflows/dependency-audit.yml:35-50` до remediation — 7 paths,
  отсутствуют docs-site/mobile-app.
- Fresh failed run: https://github.com/xlabtg/tonbankcard-protocol/actions/runs/31704315208
- Полный лог: ignored `ci-logs/dependency-audit-31704315208.log`.
- До remediation: docs-site 43 total / 27 High / 2 Critical; mobile-app 2 High.

## Исправление в PR #424

- Все 9 shipped lockfiles обновлены; 8 workspaces имеют 0 vulnerabilities.
- docs-site обновлён до Docusaurus 3.10.2, устранены Critical и
  `serialize-javascript`; остаётся 18 High chain entries с одним root cause —
  `image-size@2.0.2`, latest upstream, `fixAvailable=false`.
- Matrix включает mobile-app и docs-site.
- Новый CI guard проверяет полный список locked shipped workspaces.
- docs-site временно использует `audit-level=critical`; исключение явно
  документировано и должно быть удалено после upstream remediation/migration.

## Acceptance criteria

- [x] Все shipped locked npm workspaces присутствуют в matrix.
- [x] CI не позволяет незаметно удалить workspace из audit.
- [x] Нет Critical advisories; все non-docs workspaces чисты на High+.
- [ ] Устранить/изолировать `image-size` advisories и вернуть docs-site High gate.
- [ ] Добавить тест, доказывающий безопасное image parsing либо отсутствие
  untrusted image input до upstream fix.

## История / dedup

#411/#419 закрыли faucet, но PR #419 явно отложил docs-site/mobile-app, оставив
acceptance checkbox незакрытым. Новый issue отслеживает только остаток и защиту
от повторения.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/429
