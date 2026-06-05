# Каталог находок аудита (Issue #241)

Этот каталог — результат полного аудита логики и безопасности всего кода репозитория, выполненного в рамках [issue #241 «We need to check all the logic»](https://github.com/xlabtg/tonbankcard-protocol/issues/241). Каждая находка оформлена как отдельный профессиональный issue с метками (`labels`) и этапом внедрения (`stage`), чтобы команда могла устранять их пошагово и компетентно.

> 📋 Сводный план устранения (epic): [#302](https://github.com/xlabtg/tonbankcard-protocol/issues/302). Все опубликованные находки: issues #243–#301. Итоговый статус устранения зафиксирован в [`audit/REMEDIATION_STATUS.md`](../REMEDIATION_STATUS.md).

## Как это устроено

- Каждый файл `audit/findings/<AREA>-<ID>-*.md` — спецификация одной находки (Summary, затронутый код с указанием `файл:строка`, описание первопричины, влияние, предлагаемое исправление, критерии приёмки, ссылки).
- Находки уровней Critical / High / Medium оформлены отдельными issue. Находки уровней Low / Info сгруппированы в один консолидированный backlog-issue на подсистему.
- Сопутствующие документы аудита: [`SCOPE.md`](./SCOPE.md), [`THREAT_MODEL.md`](./THREAT_MODEL.md), [`INVARIANTS.md`](./INVARIANTS.md), [`SMART_CONTRACTS_SECURITY_AUDIT.md`](./SMART_CONTRACTS_SECURITY_AUDIT.md), [`TEST_COVERAGE_REPORT.md`](./TEST_COVERAGE_REPORT.md), [`BUILD_INSTRUCTIONS.md`](./BUILD_INSTRUCTIONS.md), [`FREEZE_METADATA.md`](./FREEZE_METADATA.md).

## Этапы внедрения (severity → stage)

| Severity | Метка priority | Метка stage | Этап |
|---|---|---|---|
| Critical | `priority:critical` | `stage:1-critical` | Этап 1 |
| High | `priority:high` | `stage:2-high` | Этап 2 |
| Medium | `priority:medium` | `stage:3-medium` | Этап 3 |
| Low / Info | `priority:low` | `stage:4-low` | Этап 4 |

## Сводка

Всего находок: **59** (опубликовано GitHub issues: #243–#301).

| Severity | Количество |
|---|---|
| Critical | 7 |
| High | 19 |
| Medium | 27 |
| Low | 6 |

| Подсистема | Количество находок |
|---|---|
| Смарт-контракты | 9 |
| API / Indexer (backend) | 25 |
| SDK | 10 |
| Frontend | 7 |
| DevOps / CI / Инфраструктура | 8 |

## Этап 1 — Critical (блокирует mainnet/production)

| ID | Severity | Подсистема | Заголовок | Спецификация | Issue |
|---|---|---|---|---|---|
| API-C1 | Critical | API / Indexer (backend) | key_id collides for every live/test key, breaking revocation correctness | [`API-C1-key-id-collision-breaks-revocation.md`](./API-C1-key-id-collision-breaks-revocation.md) | [#243](https://github.com/xlabtg/tonbankcard-protocol/issues/243) |
| API-C2 | Critical | API / Indexer (backend) | Webhook delivery has no SSRF protection | [`API-C2-webhook-ssrf.md`](./API-C2-webhook-ssrf.md) | [#244](https://github.com/xlabtg/tonbankcard-protocol/issues/244) |
| INDEXER-C1 | Critical | API / Indexer (backend) | Reorg rollback leaves account_snapshots permanently stale | [`INDEXER-C1-reorg-rollback-stale-account-snapshots.md`](./INDEXER-C1-reorg-rollback-stale-account-snapshots.md) | [#245](https://github.com/xlabtg/tonbankcard-protocol/issues/245) |
| INDEXER-C2 | Critical | API / Indexer (backend) | Reorg detection never fires for already-indexed blocks | [`INDEXER-C2-reorg-detection-misses-indexed-range.md`](./INDEXER-C2-reorg-detection-misses-indexed-range.md) | [#246](https://github.com/xlabtg/tonbankcard-protocol/issues/246) |
| INDEXER-C3 | Critical | API / Indexer (backend) | processBlock is non-atomic; events can be silently lost | [`INDEXER-C3-processblock-non-atomic.md`](./INDEXER-C3-processblock-non-atomic.md) | [#247](https://github.com/xlabtg/tonbankcard-protocol/issues/247) |
| CONTRACTS-C1 | Critical | Смарт-контракты | Governance voting and proposal submission lack on-chain NFT ownership verification | [`CONTRACTS-C1-governance-ownership-verification.md`](./CONTRACTS-C1-governance-ownership-verification.md) | [#248](https://github.com/xlabtg/tonbankcard-protocol/issues/248) |
| SDK-C1 | Critical | SDK | Go and Python webhook verifiers use a different signature scheme than the server, rejecting every real webhook | [`SDK-C1-go-python-webhook-signature-scheme-mismatch.md`](./SDK-C1-go-python-webhook-signature-scheme-mismatch.md) | [#249](https://github.com/xlabtg/tonbankcard-protocol/issues/249) |

## Этап 2 — High (исправления корректности/безопасности)

| ID | Severity | Подсистема | Заголовок | Спецификация | Issue |
|---|---|---|---|---|---|
| API-H1 | High | API / Indexer (backend) | API_KEY_SECRET silently falls back to a hardcoded default | [`API-H1-api-key-secret-default-fallback.md`](./API-H1-api-key-secret-default-fallback.md) | [#250](https://github.com/xlabtg/tonbankcard-protocol/issues/250) |
| API-H2 | High | API / Indexer (backend) | trust proxy is never configured on the production app | [`API-H2-trust-proxy-not-configured.md`](./API-H2-trust-proxy-not-configured.md) | [#251](https://github.com/xlabtg/tonbankcard-protocol/issues/251) |
| API-H3 | High | API / Indexer (backend) | processSettlementEvent can mark invoices settled without finality, making the API a source of truth | [`API-H3-settlement-event-source-of-truth.md`](./API-H3-settlement-event-source-of-truth.md) | [#252](https://github.com/xlabtg/tonbankcard-protocol/issues/252) |
| API-H4 | High | API / Indexer (backend) | Public invoice endpoint leaks merchant data / PII with no authentication | [`API-H4-public-invoice-endpoint-pii-leak.md`](./API-H4-public-invoice-endpoint-pii-leak.md) | [#253](https://github.com/xlabtg/tonbankcard-protocol/issues/253) |
| INDEXER-H1 | High | API / Indexer (backend) | markBlocksConfirmed double-subtracts the confirmation depth | [`INDEXER-H1-markblocksconfirmed-double-subtract.md`](./INDEXER-H1-markblocksconfirmed-double-subtract.md) | [#254](https://github.com/xlabtg/tonbankcard-protocol/issues/254) |
| INDEXER-H2 | High | API / Indexer (backend) | fetchContractTransactions ignores block number; events mis-attributed | [`INDEXER-H2-transactions-not-bounded-to-block.md`](./INDEXER-H2-transactions-not-bounded-to-block.md) | [#255](https://github.com/xlabtg/tonbankcard-protocol/issues/255) |
| INDEXER-H3 | High | API / Indexer (backend) | getMasterchainInfo().latestSeqno is undefined; sync never advances | [`INDEXER-H3-wrong-masterchaininfo-api.md`](./INDEXER-H3-wrong-masterchaininfo-api.md) | [#256](https://github.com/xlabtg/tonbankcard-protocol/issues/256) |
| INDEXER-H4 | High | API / Indexer (backend) | Tangled transaction parsing/routing: synthesized destination, wrong block, two timestamps | [`INDEXER-H4-tangled-transaction-parsing-routing.md`](./INDEXER-H4-tangled-transaction-parsing-routing.md) | [#257](https://github.com/xlabtg/tonbankcard-protocol/issues/257) |
| CONTRACTS-H1 | High | Смарт-контракты | Additive composite map keys can collide across NFT accounts | [`CONTRACTS-H1-additive-composite-map-keys.md`](./CONTRACTS-H1-additive-composite-map-keys.md) | [#258](https://github.com/xlabtg/tonbankcard-protocol/issues/258) |
| CONTRACTS-H2 | High | Смарт-контракты | MultiSig approved payments have no execution path; PaymentProposalExecuted is dead | [`CONTRACTS-H2-multisig-execution-path-missing.md`](./CONTRACTS-H2-multisig-execution-path-missing.md) | [#259](https://github.com/xlabtg/tonbankcard-protocol/issues/259) |
| CONTRACTS-H3 | High | Смарт-контракты | Non-functional FunC stubs (payment-hub, nft_account_resolver) ship in deployable set | [`CONTRACTS-H3-nonfunctional-fc-stubs-shipped.md`](./CONTRACTS-H3-nonfunctional-fc-stubs-shipped.md) | [#260](https://github.com/xlabtg/tonbankcard-protocol/issues/260) |
| DEVOPS-H1 | High | DevOps / CI / Инфраструктура | .env.sandbox is not gitignored — risk of committing sandbox secrets | [`DEVOPS-H1-env-sandbox-not-gitignored.md`](./DEVOPS-H1-env-sandbox-not-gitignored.md) | [#261](https://github.com/xlabtg/tonbankcard-protocol/issues/261) |
| DEVOPS-H2 | High | DevOps / CI / Инфраструктура | Docker host-port publishing bypasses the UFW firewall | [`DEVOPS-H2-docker-publish-bypasses-ufw.md`](./DEVOPS-H2-docker-publish-bypasses-ufw.md) | [#262](https://github.com/xlabtg/tonbankcard-protocol/issues/262) |
| DEVOPS-H3 | High | DevOps / CI / Инфраструктура | Five GitHub Actions workflows lack least-privilege permissions | [`DEVOPS-H3-workflows-missing-permissions-hardening.md`](./DEVOPS-H3-workflows-missing-permissions-hardening.md) | [#263](https://github.com/xlabtg/tonbankcard-protocol/issues/263) |
| FRONTEND-H1 | High | Frontend | Query-parameter injection in dashboard generateInvoiceLink | [`FRONTEND-H1-dashboard-invoice-link-param-injection.md`](./FRONTEND-H1-dashboard-invoice-link-param-injection.md) | [#264](https://github.com/xlabtg/tonbankcard-protocol/issues/264) |
| FRONTEND-H2 | High | Frontend | Query-parameter injection in mobile PaymentService.generatePaymentLink | [`FRONTEND-H2-mobile-payment-link-param-injection.md`](./FRONTEND-H2-mobile-payment-link-param-injection.md) | [#265](https://github.com/xlabtg/tonbankcard-protocol/issues/265) |
| SDK-H1 | High | SDK | verifySettlement never checks the payment against the invoice (matchesInvoice hardcoded true) | [`SDK-H1-verifysettlement-matchesinvoice-hardcoded-true.md`](./SDK-H1-verifysettlement-matchesinvoice-hardcoded-true.md) | [#266](https://github.com/xlabtg/tonbankcard-protocol/issues/266) |
| SDK-H2 | High | SDK | Confirmations computed as latestSeqno minus transaction lt is dimensionally invalid | [`SDK-H2-confirmations-seqno-minus-lt-dimensionally-invalid.md`](./SDK-H2-confirmations-seqno-minus-lt-dimensionally-invalid.md) | [#267](https://github.com/xlabtg/tonbankcard-protocol/issues/267) |
| SDK-H3 | High | SDK | isValidAddress is a no-op that accepts any address | [`SDK-H3-isvalidaddress-noop-accepts-anything.md`](./SDK-H3-isvalidaddress-noop-accepts-anything.md) | [#268](https://github.com/xlabtg/tonbankcard-protocol/issues/268) |

## Этап 3 — Medium (корректность и hardening)

| ID | Severity | Подсистема | Заголовок | Спецификация | Issue |
|---|---|---|---|---|---|
| API-M1 | Medium | API / Indexer (backend) | Webhook signing secret stored in plaintext, contradicting its own contract | [`API-M1-webhook-secret-plaintext.md`](./API-M1-webhook-secret-plaintext.md) | [#269](https://github.com/xlabtg/tonbankcard-protocol/issues/269) |
| API-M2 | Medium | API / Indexer (backend) | Idempotency key omits expires_at and is not scoped to the API key | [`API-M2-idempotency-key-scope.md`](./API-M2-idempotency-key-scope.md) | [#270](https://github.com/xlabtg/tonbankcard-protocol/issues/270) |
| API-M3 | Medium | API / Indexer (backend) | helmet declared as a dependency but never applied | [`API-M3-helmet-not-applied.md`](./API-M3-helmet-not-applied.md) | [#271](https://github.com/xlabtg/tonbankcard-protocol/issues/271) |
| API-M4 | Medium | API / Indexer (backend) | CORS rejections surface as generic 500s | [`API-M4-cors-rejection-500.md`](./API-M4-cors-rejection-500.md) | [#272](https://github.com/xlabtg/tonbankcard-protocol/issues/272) |
| INDEXER-M1 | Medium | API / Indexer (backend) | Account history limit is unbounded and abusable | [`INDEXER-M1-account-history-limit-unbounded.md`](./INDEXER-M1-account-history-limit-unbounded.md) | [#273](https://github.com/xlabtg/tonbankcard-protocol/issues/273) |
| INDEXER-M2 | Medium | API / Indexer (backend) | getAccountHistory totalCount and keyset pagination interact incorrectly | [`INDEXER-M2-history-totalcount-keyset-pagination.md`](./INDEXER-M2-history-totalcount-keyset-pagination.md) | [#274](https://github.com/xlabtg/tonbankcard-protocol/issues/274) |
| INDEXER-M3 | Medium | API / Indexer (backend) | History cache is unbounded and not invalidated on reorg or NFT changes | [`INDEXER-M3-history-cache-unbounded-no-invalidation.md`](./INDEXER-M3-history-cache-unbounded-no-invalidation.md) | [#275](https://github.com/xlabtg/tonbankcard-protocol/issues/275) |
| INDEXER-M4 | Medium | API / Indexer (backend) | invalidateHistoryCache prefix match is ambiguous across addresses | [`INDEXER-M4-cache-prefix-match-ambiguous.md`](./INDEXER-M4-cache-prefix-match-ambiguous.md) | [#276](https://github.com/xlabtg/tonbankcard-protocol/issues/276) |
| INDEXER-M5 | Medium | API / Indexer (backend) | Transparency UNIQUE + INSERT OR IGNORE silently drops corrected periods | [`INDEXER-M5-transparency-insert-or-ignore-drops-corrections.md`](./INDEXER-M5-transparency-insert-or-ignore-drops-corrections.md) | [#277](https://github.com/xlabtg/tonbankcard-protocol/issues/277) |
| INDEXER-M6 | Medium | API / Indexer (backend) | Config numeric parsing accepts garbage with no validation | [`INDEXER-M6-config-parseint-no-validation.md`](./INDEXER-M6-config-parseint-no-validation.md) | [#278](https://github.com/xlabtg/tonbankcard-protocol/issues/278) |
| CONTRACTS-M1 | Medium | Смарт-контракты | CollateralSignal allows owner re-binding (missing write-once guard) | [`CONTRACTS-M1-collateralsignal-write-once-owner.md`](./CONTRACTS-M1-collateralsignal-write-once-owner.md) | [#279](https://github.com/xlabtg/tonbankcard-protocol/issues/279) |
| CONTRACTS-M2 | Medium | Смарт-контракты | LendingProtocolCoordinator references undefined message RegisterNFTOwner | [`CONTRACTS-M2-lending-undefined-message.md`](./CONTRACTS-M2-lending-undefined-message.md) | [#280](https://github.com/xlabtg/tonbankcard-protocol/issues/280) |
| CONTRACTS-M3 | Medium | Смарт-контракты | Governance quorum mismatch: resolver computes 23, registry uses 22 | [`CONTRACTS-M3-governance-quorum-mismatch.md`](./CONTRACTS-M3-governance-quorum-mismatch.md) | [#281](https://github.com/xlabtg/tonbankcard-protocol/issues/281) |
| CONTRACTS-M4 | Medium | Смарт-контракты | CancelLendingIntent does not verify intent existence and resets created_at | [`CONTRACTS-M4-cancel-lending-intent-validation.md`](./CONTRACTS-M4-cancel-lending-intent-validation.md) | [#282](https://github.com/xlabtg/tonbankcard-protocol/issues/282) |
| DEVOPS-M1 | Medium | DevOps / CI / Инфраструктура | Third-party actions pinned to mutable tags, not commit SHAs | [`DEVOPS-M1-actions-pinned-to-mutable-tags.md`](./DEVOPS-M1-actions-pinned-to-mutable-tags.md) | [#283](https://github.com/xlabtg/tonbankcard-protocol/issues/283) |
| DEVOPS-M2 | Medium | DevOps / CI / Инфраструктура | CI uses npm install instead of npm ci | [`DEVOPS-M2-ci-uses-npm-install-not-npm-ci.md`](./DEVOPS-M2-ci-uses-npm-install-not-npm-ci.md) | [#284](https://github.com/xlabtg/tonbankcard-protocol/issues/284) |
| DEVOPS-M3 | Medium | DevOps / CI / Инфраструктура | Postgres default credentials and host-exposed port in compose | [`DEVOPS-M3-postgres-default-creds-and-exposed-port.md`](./DEVOPS-M3-postgres-default-creds-and-exposed-port.md) | [#285](https://github.com/xlabtg/tonbankcard-protocol/issues/285) |
| DEVOPS-M4 | Medium | DevOps / CI / Инфраструктура | Sandbox API_KEY_SECRET hardcoded to a default value | [`DEVOPS-M4-sandbox-api-key-secret-hardcoded-default.md`](./DEVOPS-M4-sandbox-api-key-secret-hardcoded-default.md) | [#286](https://github.com/xlabtg/tonbankcard-protocol/issues/286) |
| FRONTEND-M1 | Medium | Frontend | Float precision loss in money formatting/parsing | [`FRONTEND-M1-float-precision-money-formatting.md`](./FRONTEND-M1-float-precision-money-formatting.md) | [#287](https://github.com/xlabtg/tonbankcard-protocol/issues/287) |
| FRONTEND-M2 | Medium | Frontend | SendPaymentScreen never enforces the documented biometric gate | [`FRONTEND-M2-send-payment-biometric-gate-missing.md`](./FRONTEND-M2-send-payment-biometric-gate-missing.md) | [#288](https://github.com/xlabtg/tonbankcard-protocol/issues/288) |
| FRONTEND-M3 | Medium | Frontend | BiometricAuthenticator interface declared but never used | [`FRONTEND-M3-biometric-authenticator-unused.md`](./FRONTEND-M3-biometric-authenticator-unused.md) | [#289](https://github.com/xlabtg/tonbankcard-protocol/issues/289) |
| FRONTEND-M4 | Medium | Frontend | HttpsClient certificate pinning validates the configured pin against itself | [`FRONTEND-M4-certificate-pinning-compares-wrong-value.md`](./FRONTEND-M4-certificate-pinning-compares-wrong-value.md) | [#290](https://github.com/xlabtg/tonbankcard-protocol/issues/290) |
| SDK-M1 | Medium | SDK | Go and Python address regex rejects standard base64 and skips the CRC16 checksum | [`SDK-M1-go-python-address-regex-rejects-base64-skips-checksum.md`](./SDK-M1-go-python-address-regex-rejects-base64-skips-checksum.md) | [#291](https://github.com/xlabtg/tonbankcard-protocol/issues/291) |
| SDK-M2 | Medium | SDK | parseTBC/formatTBC lose precision by routing amounts through JS float | [`SDK-M2-parsetbc-formattbc-float-precision-loss.md`](./SDK-M2-parsetbc-formattbc-float-precision-loss.md) | [#292](https://github.com/xlabtg/tonbankcard-protocol/issues/292) |
| SDK-M3 | Medium | SDK | TypeScript createInvoice does not enforce the documented 2^120-1 upper bound on amount | [`SDK-M3-createinvoice-missing-upper-bound-amount.md`](./SDK-M3-createinvoice-missing-upper-bound-amount.md) | [#293](https://github.com/xlabtg/tonbankcard-protocol/issues/293) |
| SDK-M4 | Medium | SDK | generateWalletLink places the TBC token amount into the TON native-amount field | [`SDK-M4-generatewalletlink-tbc-amount-in-ton-field.md`](./SDK-M4-generatewalletlink-tbc-amount-in-ton-field.md) | [#294](https://github.com/xlabtg/tonbankcard-protocol/issues/294) |
| SDK-M5 | Medium | SDK | generateInvoiceId/createPayloadHash use non-canonical serialization, breaking cross-SDK hash matching | [`SDK-M5-noncanonical-serialization-cross-sdk-hash-mismatch.md`](./SDK-M5-noncanonical-serialization-cross-sdk-hash-mismatch.md) | [#295](https://github.com/xlabtg/tonbankcard-protocol/issues/295) |

## Этап 4 — Low / Info (backlog по очистке и усилению)

| ID | Severity | Подсистема | Заголовок | Спецификация | Issue |
|---|---|---|---|---|---|
| API-LOW | Low | API / Indexer (backend) | Hardening backlog (Low / Info findings) | [`API-LOW-hardening-backlog.md`](./API-LOW-hardening-backlog.md) | [#296](https://github.com/xlabtg/tonbankcard-protocol/issues/296) |
| INDEXER-LOW | Low | API / Indexer (backend) | Indexer hardening backlog (L1-L7) | [`INDEXER-LOW-hardening-backlog.md`](./INDEXER-LOW-hardening-backlog.md) | [#297](https://github.com/xlabtg/tonbankcard-protocol/issues/297) |
| CONTRACTS-LOW | Low | Смарт-контракты | Contracts hardening backlog (Low / Info findings) | [`CONTRACTS-LOW-hardening-backlog.md`](./CONTRACTS-LOW-hardening-backlog.md) | [#298](https://github.com/xlabtg/tonbankcard-protocol/issues/298) |
| DEVOPS-LOW | Low | DevOps / CI / Инфраструктура | DevOps hardening backlog | [`DEVOPS-LOW-hardening-backlog.md`](./DEVOPS-LOW-hardening-backlog.md) | [#299](https://github.com/xlabtg/tonbankcard-protocol/issues/299) |
| FRONTEND-LOW | Low | Frontend | Hardening backlog (Low findings) | [`FRONTEND-LOW-hardening-backlog.md`](./FRONTEND-LOW-hardening-backlog.md) | [#300](https://github.com/xlabtg/tonbankcard-protocol/issues/300) |
| SDK-LOW | Low | SDK | SDK hardening backlog (Low / Info findings) | [`SDK-LOW-hardening-backlog.md`](./SDK-LOW-hardening-backlog.md) | [#301](https://github.com/xlabtg/tonbankcard-protocol/issues/301) |
