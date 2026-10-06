# Настройка платёжных клиентов

После #507 платежи требуют проверенного адреса MerchantPaymentHub и NFT плательщика.
Адрес merchant NFT обозначает получателя TBC внутри body, а не получателя TON.

- Mobile core: `MobileConfig.paymentHubAddress` и `PaymentRequest.payerNft` обязательны
  для `createPaymentDeepLink`; `amountTbc` — целая строка nanoTBC.
- Dashboard: передайте `paymentHubAddress` и `payerNft` в config либо параметры
  генератора. Без них генерация завершается ошибкой, старый TON transfer не создаётся.
- Mobile app: host вызывает `configurePaymentContext({config, accountNft,
  requestPayerNft})` из `src/lib/paymentContext` перед открытием экранов Send/Receive.
  `accountNft` — выбранный пользователем NFT; при запросе платежа `requestPayerNft`
  задаёт NFT будущего плательщика. Значения из demo config для платежей не используются.

Все три клиента используют `@tonbankcard/sdk/wallet-link`: `amount=50000000` — gas,
`bin` — сериализованный MerchantPaymentRequest с суммой nanoTBC. SDK 2.0.4 исправляет
opcode по Tact ABI; опубликованный контракт должен иметь этот ABI и совпадать с manifest.
