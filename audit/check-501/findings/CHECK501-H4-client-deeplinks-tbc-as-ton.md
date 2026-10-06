# [CHECK501-H4] Mobile и dashboard deep links передают сумму TBC как TON и шлют на NFT мерчанта

## Кратко

`amountTbc` (TBC nanocoins) подставляется напрямую в `ton://transfer/<merchantNft>?amount=…`, которое кошелёк трактует как nanoTON; нет `bin` payload (`MerchantPaymentRequest`), получатель — NFT мерчанта, а не PaymentHub. В SDK это исправлено (`sdk/src/walletLink.ts` `buildWalletLink`, #294), клиенты не обновлены.

## Severity

High — Invoice на 10 TBC просит кошелёк отправить 10 TON на NFT-контракт: плательщик теряет TON, invoice не оплачивается.

## Затронутый код

- `mobile/src/services/PaymentService.ts:56,68`.
- `dashboard/src/utils.ts:175-185`.
- `mobile-app/src/lib/services/PaymentFacade.ts:57`, `mobile-app/src/lib/tonconnect/deepLink.ts:44,55`.
- Эталон: `sdk/src/walletLink.ts:48-83`.

## Воспроизведение

`generatePaymentLink({merchantNft, amountTbc: '10000000000'})` → `ton://transfer/<nft>?amount=10000000000` (10 TON).

## Рекомендуемое исправление

Переиспользовать SDK `buildWalletLink`: получатель PaymentHub, `amount` = газ, `bin` = сериализованный `MerchantPaymentRequest`.

## Acceptance criteria

- [ ] Ссылки mobile, mobile-app и dashboard указывают на PaymentHub и содержат `bin`.
- [ ] `amount` — газовое значение; тест проверяет, что TBC-сумма не попадает в `amount=`.

## Этап

`stage:2-high` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/507
