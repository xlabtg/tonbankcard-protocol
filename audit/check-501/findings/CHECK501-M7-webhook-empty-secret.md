# [CHECK501-M7] TS и Python SDK принимают пустой webhook secret (Go отклоняет)

## Кратко

`verifyWebhook` в TS и Python не проверяет secret; HMAC с пустым ключом может вычислить кто угодно. Go SDK пустой secret отклоняет.

## Severity

Medium — Мерчант с `TBC_WEBHOOK_SECRET=""` (незаданная переменная) принимает поддельные `payment.settled`.

## Затронутый код

- `sdk/src/webhook.ts:107-111`, `:141-169`.
- `sdk-python/src/*/webhooks.py:60,99-150`.
- Эталон: `sdk-go/webhooks.go:99-101`.

## Воспроизведение

`verifyWebhook('', body, sign('', body))` → valid.

## Рекомендуемое исправление

Отклонять пустой/пробельный secret (исключение или reason `invalid_secret`) во всех SDK.

## Acceptance criteria

- [ ] Все три SDK отклоняют пустой secret; conformance-тест в каждом.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/514
