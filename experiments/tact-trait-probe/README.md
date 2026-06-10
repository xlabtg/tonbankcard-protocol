# tact-trait-probe

Минимальный probe, проверяющий, что под компилятором Tact 1.4.4 паттерн
«трейт объявляет `abstract get fun`, контракт реализует его через
`override get fun`» компилируется.

Зачем: в рамках Issue #365 контракт `contracts/governance/TransparencyRegistry.tact`
был впервые добавлен в `tact.config.json` (для CI-сборки и тестов аутентификации
отправителя). Чтобы он собирался, геттеры интерфейса
`interfaces/ITransparencyRegistry.tact` пришлось перевести в `abstract get fun`,
а одноимённые геттеры контракта — в `override get fun`. Этот probe изолированно
подтверждает корректность такого паттерна.

## Запуск

```bash
cd experiments/tact-trait-probe
npx tact --config ./tact.config.json
```

Успешная компиляция (см. `probe.log`, артефакт в `dist/` — оба в `.gitignore`)
означает, что паттерн `abstract`/`override` валиден.
