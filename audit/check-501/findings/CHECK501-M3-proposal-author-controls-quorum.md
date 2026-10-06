# [CHECK501-M3] Автор proposal сам задаёт quorum и длительность голосования

## Кратко

`quorum_threshold` (1..222) и `voting_duration` (любой uint64) берутся из сообщения автора. Это противоречит фиксированному quorum 22 (#281).

## Severity

Medium — Держатель Diamond создаёт proposal с `quorum_threshold=1` и коротким окном, голосует FOR — proposal ACCEPTED одним голосом. Огромный `voting_duration` переполняет `voting_end: uint64` в callback, и pending-запись зависает.

## Затронутый код

- `contracts/governance/ProposalRegistry.tact:570-576`.
- `contracts/governance/ProposalRegistry.tact:849-850`.

## Воспроизведение

`SubmitProposal{quorum_threshold: 1, voting_duration: 60}` + один голос FOR → ACCEPTED.

## Рекомендуемое исправление

Игнорировать значения автора или требовать `quorum >= DEFAULT_QUORUM_THRESHOLD` и `MIN ≤ duration ≤ MAX`.

## Acceptance criteria

- [ ] Тесты: низкий quorum и duration вне диапазона отклоняются; по умолчанию применяется quorum 22.

## Этап

`stage:3-medium` — найдено в раунде аудита #501 (PR #502).

Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/510
