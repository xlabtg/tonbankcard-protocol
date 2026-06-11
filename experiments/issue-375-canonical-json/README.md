# Issue #375 / PC-06 — Cross-SDK canonical JSON must converge

Minimal, self-contained reproduction of the **PC-06** finding: the TypeScript,
Go, and Python SDKs each build a "canonical JSON" whose SHA-256 becomes an
invoice ID / payload hash, so the bytes **must match across languages**. Two
divergences broke that contract:

1. **U+2028 / U+2029** (line/paragraph separators) were emitted as **raw UTF-8**
   (`e2 80 a8` / `e2 80 a9`) by Node `JSON.stringify` and Python `json.dumps`,
   but **escaped** to `\\u2028` / `\\u2029` by Go's `encoding/json`.
2. **Float formatting** differed: `2.0` vs `2`, `1e+16` vs `10000000000000000`,
   `1e-07` vs `1e-7` between Python and Node/Go.

Either divergence yields a different SHA-256, so an invoice hashed by one SDK
fails to verify in another.

## The "before" evidence (`out_*.tsv`)

`escape_node.js`, `escape_python.py`, and `escape_go.go` each feed the same
battery of code points (all C0 controls, `"` `\` `/` `<` `>` `&`, DEL, `é`,
U+2028, U+2029, `中`, `😀`) through the **pre-fix** canonical encoder of their
language and print `<codepoint-hex>\t<utf8-hex-of-output>`. Diffing the three
captured outputs isolates the divergence to exactly two rows (hex of the encoded
UTF-8 bytes, where `22` is `"`):

| code point | Node / Python (`out_node.tsv`, `out_python.tsv`) | Go (`out_go.tsv`) |
| --- | --- | --- |
| `002028` | `22e280a822` = raw `"<U+2028>"` ❌ | `225c753230323822` = `"\\u2028"` ✅ |
| `002029` | `22e280a922` = raw `"<U+2029>"` ❌ | `225c753230323922` = `"\\u2029"` ✅ |

Every other row is byte-identical across all three languages, which is why the
fix only had to teach Node and Python to escape these two code points.

`repro_node.js`, `repro_python.py`, and `repro_go.go` are the numeric-side
companions: they run the **pre-fix** encoders over `2.0`, `1e16`, `1e-7`, and
`2.5`, showing that Python renders integer-valued and exponential floats
differently from Node/Go.

## What the fix does (and how these scripts check it)

The agreed canonical policy, now enforced identically in all three SDKs:

- **Always escape** U+2028 / U+2029 to `\\u2028` / `\\u2029` (match Go).
- **Forbid floats** in hashed payloads — each SDK throws instead of emitting a
  language-dependent rendering.
- **Accept only safe integers** in `[-(2**53 - 1), 2**53 - 1]`, emitted as plain
  decimals; larger or fractional amounts must arrive as decimal strings (or
  `bigint` / `big.Int`, which serialize to strings).

- `check_ts_logic.js` is a standalone sanity-check of the **post-fix** TS
  string-escape + numeric-policy logic (built from `String.fromCharCode` so the
  source stays pure ASCII).
- `goprobe/main.go` is a small Go probe confirming Go's `encoding/json` already
  escapes U+2028 / U+2029 and the control characters the policy relies on.
- `generate_conformance_fixture.py` produces the CI fixture
  `tests/fixtures/pc-06-canonical-conformance.json` from the **fixed** Python
  `canonical_json`; the TS and Go conformance tests then assert their own
  encoders reproduce those exact bytes / SHA-256.

## Run it

```bash
cd experiments/issue-375-canonical-json

node escape_node.js   > /tmp/node.tsv
python3 escape_python.py > /tmp/python.tsv
go run escape_go.go   > /tmp/go.tsv
diff /tmp/node.tsv /tmp/go.tsv      # only the 002028 / 002029 rows differ (pre-fix)

node check_ts_logic.js              # post-fix TS string/number policy
go run goprobe/main.go              # Go escapes U+2028/U+2029 natively

# regenerate the CI fixture from the fixed Python encoder
python3 generate_conformance_fixture.py
```

The CI-enforced regressions live in the SDK packages themselves and all read the
shared fixture:

- TypeScript — `sdk/tests/utils.spec.ts`, `describe('PC-06 cross-SDK canonical conformance')` (job *Test SDK*).
- Python — `sdk-python/tests/test_hashing.py`, the `test_pc06_*` parametrized vectors (job *Python SDK*).
- Go — `sdk-go/conformance_test.go`, the `TestPC06*` functions (job *Go SDK*).

## Notes

This is an authorized internal audit reproduction. No secrets or real customer
data are used; all inputs are synthetic. Some files (`goprobe/main.go`, and the
`out_*.tsv` rows for `002028` / `002029`) intentionally contain raw control or
separator bytes as test data, so `file` may classify them as `data` rather than
text — that is expected.
