# [CHECK501-M6] Rate limit faucet обходится альтернативными записями адреса; клиент выбирает сумму до hard cap

## Кратко

Ключ лимитера — trimmed lowercase строка. Один аккаунт имеет множество валидных записей (`0:`/`00:`/`000:…` — regex `-?[0-9]+`, EQ/UQ/kQ/0Q). Lowercase base64 вызывает коллизии разных адресов. Нет проверки checksum, per-IP/global лимита и captcha. `amount` клиента принимается до `MAX_DISPENSE_NANOCOINS` (100 TBC), игнорируя `FAUCET_DEFAULT_DISPENSE_NANOCOINS`.

## Severity

Medium — Скрипт перебирает записи одного адреса по 100 TBC и опустошает резерв за минуты; также можно заблокировать чужой адрес коллизией.

## Затронутый код

- `scripts/faucet/src/validation.ts:27-28`.
- `scripts/faucet/src/rateLimit.ts:144-146`.
- `scripts/faucet/src/server.ts:143,145`.
- `scripts/faucet/src/index.ts:414-439`.

## Воспроизведение

Запросы для `0:<hash>`, `00:<hash>`, `000:<hash>`, EQ- и UQ-формы одного аккаунта с `amount=100 TBC` — все проходят.

## Рекомендуемое исправление

`Address.parse` из `@ton/core` (CRC), ключ `workchain:hash`; per-IP и global лимиты, опциональная captcha; ограничить `amount` настроенным значением по умолчанию.

## Acceptance criteria

- [ ] Все записи одного аккаунта делят bucket; плохой checksum отклоняется; `amount` выше default отклоняется/обрезается; тесты.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/513
