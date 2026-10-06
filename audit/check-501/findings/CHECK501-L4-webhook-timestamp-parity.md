# [CHECK501-L4] Парсинг timestamp webhook расходится между SDK

## Кратко

TS использует `Number(val)` + `Number.isInteger`, принимая `t=0x…`, `t=1.7e9`, `t=1e9`; Go (`ParseInt`) и Python (`isdigit`) их отклоняют. TS подписывает `timestamp.toString()`, а не исходную строку.

## Severity

Low — Одна и та же доставка валидна в одном SDK и невалидна в другом (parity break, не подделка).

## Затронутый код

- `sdk/src/webhook.ts:80`.

## Воспроизведение

Header `t=1e9,v1=…` проходит парсинг в TS и отклоняется Go/Python.

## Рекомендуемое исправление

Требовать `/^\d+$/` до преобразования; подписывать исходную строку.

## Acceptance criteria

- [ ] Общий набор conformance-векторов: все три SDK отклоняют не-десятичные timestamp.

## Этап

`stage:4-low` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/519
