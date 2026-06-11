# Issue #374 / PC-05 — PaymentWidget deep link must validate and encode its inputs

Minimal, self-contained reproduction of the **PC-05** finding:
`sdk/src/widget/PaymentWidget.ts`'s `generatePaymentLink()` built the wallet
deep link with

```ts
// pre-fix
let link = `ton://transfer/${this.config.merchantNft}?amount=${amount}&text=${text}`;
```

`merchantNft` and `amount` were interpolated **raw** — no validation and no
percent-encoding. A value containing reserved URL characters (`&`, `?`, `#`,
`=`) therefore breaks out of its field and injects or overrides query
parameters in the link the payer's wallet receives. For example
`amountTbc = "10&bin=evil"` yields
`ton://transfer/<addr>?amount=10&bin=evil&text=...`, smuggling an
attacker-controlled `bin` parameter past the merchant.

## What `paymentwidget-injection.repro.spec.ts` proves

The spec inlines the **exact pre-fix implementation** (`oldGeneratePaymentLink`)
for the "before" column and drives the **real, fixed** `TonbankcardPaymentWidget`
imported from `sdk/src/widget/PaymentWidget.ts` for the "after" column, so the
contrast is against live code:

- **before — the bug:** a crafted `amountTbc` injects a standalone `bin=evil`
  parameter; a crafted `merchantNft` smuggles a second `amount=` parameter; a
  raw-form address leaves its `:` unencoded in the path.
- **after — the fix:** the real widget **rejects** the crafted `amountTbc`
  (`Invalid amount`) and `merchantNft` (`Invalid merchant NFT address`) instead
  of emitting `bin=evil`, **percent-encodes** the raw-form address in the path,
  and encodes reserved characters from `orderId` **inside** the `text` field so
  exactly one `amount=` parameter remains.

| Crafted `amountTbc = "10&bin=evil"` | Crafted `merchantNft = "EQabc?amount=1&bin=evil"` |
| --- | --- |
| **Before the fix** (raw interpolation) — **INJECTS** `bin=evil` ❌ | second `amount=` smuggled ❌ |
| **After the fix** (validate + encode) — throws `Invalid amount`, no `bin=evil` ✅ | throws `Invalid merchant NFT address` ✅ |

## Run it

```bash
cd experiments/issue-374-paymentwidget-injection
npm install
npm test
```

The CI-enforced regression lives in the SDK package itself
(`sdk/tests/widget.spec.ts`, `describe('generatePaymentLink security (PC-05)')`,
job *Test SDK*); this directory is the self-contained before/after demonstration
that accompanies the audit finding.

## Notes

This is an authorized internal audit reproduction. No secrets or real customer
data are used; all inputs are synthetic.
