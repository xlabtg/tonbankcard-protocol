# [CHECK423-L2] Документированный Dependabot control отсутствует

## Кратко

`docs/security/DEPENDENCY_AUDIT.md` утверждает, что
`.github/dependabot.yml` создан и еженедельно обновляет все workspaces. Файл был
удалён commit `4365222`, но документация и acceptance status остались зелёными.
В результате scheduled vulnerability scan существует, а автоматические update
PR — нет.

## Severity

Low — preventive maintenance/control accuracy. Fresh `npm audit` всё ещё ловит
advisories, но обновления не предлагаются автоматически, а audit artefact
сообщает неверный control state.

## Затронутый код/документация

- отсутствует `.github/dependabot.yml`;
- `docs/security/DEPENDENCY_AUDIT.md:169-170,203-204` заявляет обратное;
- git history: `faacf59` добавил config, `4365222` удалил без отражения в docs.

## Acceptance criteria

- [ ] Решить: восстановить Dependabot для всех 9 shipped npm workspaces и
  GitHub Actions либо документировать сознательный alternative process.
- [ ] Если восстановлен — группировать безопасные patch/minor updates и отдельно
  review major updates production packages.
- [ ] Добавить guard, синхронизирующий workspace list с dependency audit.
- [ ] Обновить `DEPENDENCY_AUDIT.md` фактическим состоянием.

## История / dedup

#131 закрыл исходный D5 deliverable. После удаления config отдельного issue не
создавалось.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/434
