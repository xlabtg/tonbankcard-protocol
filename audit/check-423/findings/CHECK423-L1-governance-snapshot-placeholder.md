# [CHECK423-L1] Governance snapshot generator не выполняет документированные queries

## Кратко

`scripts/governance/snapshot.ts` документирован как utility, который обходит 222
NFT на текущем или заданном block. На практике `getNFTAddress` и `getNFTData`
всегда бросают `not implemented`, а current block hard-coded в `0`. Loop ловит
ошибки по каждому NFT и может сформировать пустой snapshot вместо явного
aggregate failure.

## Severity

Low — governance остаётся advisory/non-binding и activation pending. Ошибка
блокирует честное создание voter registry, но не перемещает funds.

## Затронутый код

- `scripts/governance/snapshot.ts:103-145` — оба chain query placeholder.
- `...:167-175` — current block = 0.
- `...:183-210` — per-item error проглатывается и обход продолжается.
- `docs/dao-governance.md:285-326,668-674` — utility описан как рабочий.

## Acceptance criteria

- [ ] Реализовать collection `get_nft_address_by_index` и TEP-62 `get_nft_data`.
- [ ] Зафиксировать block/seqno и доказать, что все reads относятся к snapshot point.
- [ ] Fail closed при RPC error/incomplete supply; partial snapshot явно маркировать.
- [ ] Unit tests stack parsing и integration test на testnet fixture.
- [ ] Документация/CLI scripts соответствуют реальному entry point.

## История / dedup

Поиск по всем закрытым issues не нашёл отдельного tracking ticket для
`snapshot.ts` placeholder.

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/433
