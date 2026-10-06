# [CHECK501-H2] Владелец NFT записывается один раз — контроль не переходит при transfer NFT (нарушение I2)

## Кратко

`ResolveNFTOwner` в MerchantPaymentHub и CollateralSignal требует `nft_owners.get(..) == null` и не имеет пути обновления. Авторизация платежей и сигналов берётся из этого кэша.

## Severity

High — После продажи NFT прежний владелец сохраняет право списывать баланс аккаунта и менять collateral signal; новый владелец никогда не может быть зарегистрирован. Защита write-once (#279/#364) против hijack превратилась в постоянную привязку к первому владельцу.

## Затронутый код

- `contracts/MerchantPaymentHub.tact:431-435` и `:309-315`.
- `contracts/CollateralSignal.tact:398-401` и `:356-364`.
- Доверенный `nft_resolver` — `NFTAccountResolver`, который не deployable (#426), поэтому production-путь регистрации не определён.

## Воспроизведение

Alice регистрирует NFT N, получает депозиты, передаёт N Bob'у → Alice по-прежнему проходит `MerchantPaymentRequest`, регистрация Bob падает с `NFT owner already registered`.

## Рекомендуемое исправление

Разрешить resolver обновлять владельца по подтверждённому TEP-62 ответу (с привязкой к pending query), либо проверять владельца при каждом списании. Определить deployable resolver в runbook.

## Acceptance criteria

- [ ] Тест: после смены владельца старый получает `ERROR_NOT_OWNER`/`ERROR_CS_NOT_OWNER`, новый — успех.
- [ ] Повторная регистрация возможна только через аутентифицированный resolver-ответ.
- [ ] Mainnet runbook указывает адрес deployable resolver.

## Этап

`stage:2-high` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/505
