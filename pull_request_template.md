# 📌 PR TEMPLATE — TONBANKCARD

Этот шаблон обязателен для **всех Pull Requests**, включая PR от AI-бота.

```markdown
## 1. Related Issue
(Ссылка на Issue. PR без Issue — автоматически отклоняется.)

## 2. Scope of Changes
(Что именно реализовано. ДОЛЖНО соответствовать In Scope Issue.)

## 3. Out of Scope Confirmation
Подтверждаю, что PR **не включает**:
- custody
- admin withdraw
- экономические изменения
- скрытые зависимости

## 4. Architectural Alignment
- [ ] NFT = account
- [ ] TON = collateral
- [ ] TBC = settlement
- [ ] On-chain is source of truth

## 5. Security Checklist
- [ ] No reentrancy introduced
- [ ] No new privileged roles
- [ ] Access control enforced
- [ ] Failure modes handled

## 6. Tests
(Описание тестов или причина их отсутствия.)

## 7. Breaking Changes
(Если есть — описать. Если нет — указать None.)

## 8. Reviewer Notes
(Любые пояснения для ревьюера.)
