# [CHECK501-L1] Pending-maps governance растут без ограничения

## Кратко

`pending_proposals`, `pending_votes`, `pending_eligibility_votes` получают запись на любой запрос, а `ResolveOwnership`/`EligibilityCheckRequest` отправляются с `bounce:false`; запись удаляется только при ответе.

## Severity

Low — Потерянный ответ resolver или спам произвольными NFT id приводят к неограниченному росту storage и rent.

## Затронутый код

- `contracts/governance/ProposalRegistry.tact:588`, `:660`, `:793`.

## Воспроизведение

Серия запросов с несуществующими NFT id → записи никогда не удаляются.

## Рекомендуемое исправление

TTL по timestamp с cleanup-путём, лимит pending-записей на claimant, bounce-обработка.

## Acceptance criteria

- [ ] Устаревшие записи удаляемы после TTL; тест демонстрирует ограничение роста.

## Этап

`stage:4-low` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/516
