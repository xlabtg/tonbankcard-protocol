"""Generate tests/fixtures/pc-06-canonical-conformance.json.

The expected canonical bytes / SHA-256 are produced by the (already fixed)
Python canonical_json. The TypeScript and Go conformance tests then assert that
their own canonical_json reproduces these exact bytes, which is the cross-SDK
guarantee required by audit finding PC-06 (issue #375).

Source is pure ASCII: every special code point is built with chr() so this
file never carries raw U+2028 / U+2029 bytes that fragile tooling could strip.
"""

from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path

# Build path to the SDK so we exercise the real, fixed implementation.
import sys

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "sdk-python" / "src"))

from tonbankcard_merchant.hashing import canonical_json  # noqa: E402

LS = chr(0x2028)  # line separator
PS = chr(0x2029)  # paragraph separator
EACUTE = chr(0x00E9)  # é
CJK = chr(0x4E2D)  # 中
EMOJI = chr(0x1F600)  # 😀
DEL = chr(0x7F)


def sha256_hex(canonical: str) -> str:
    return sha256(canonical.encode("utf-8")).hexdigest()


def string_case(name: str, value: str) -> dict:
    canonical = canonical_json(value)
    return {"name": name, "input": value, "canonical": canonical, "sha256": sha256_hex(canonical)}


def payload_case(name: str, value: dict, reordered: dict | None = None) -> dict:
    canonical = canonical_json(value)
    case = {"name": name, "input": value, "canonical": canonical, "sha256": sha256_hex(canonical)}
    if reordered is not None:
        # Sanity: a reordered twin must canonicalise to the same bytes.
        assert canonical_json(reordered) == canonical, name
        case["input_reordered"] = reordered
    return case


def int_case(name: str, value: int) -> dict:
    canonical = canonical_json(value)
    return {"name": name, "decimal": str(value), "canonical": canonical, "sha256": sha256_hex(canonical)}


string_values = [
    string_case("plain", "hello world"),
    string_case("empty", ""),
    string_case("line_separator_u2028", "before" + LS + "after"),
    string_case("paragraph_separator_u2029", "before" + PS + "after"),
    string_case("both_separators", LS + PS),
    string_case("separators_amid_text", "a" + LS + "b" + PS + "c"),
    string_case("html_chars_not_escaped", "<tag> & \"quote\" 'apos' /slash/"),
    string_case("backslash_and_quote", "a\\b\"c"),
    string_case("short_control_escapes", "\b\f\t\n\r"),
    string_case("low_control_u0000_u001f", "".join(chr(c) for c in range(0x00, 0x20))),
    string_case("del_0x7f_raw", "x" + DEL + "y"),
    string_case("non_ascii_passthrough", EACUTE + CJK + EMOJI),
    string_case("separators_next_to_emoji", EMOJI + LS + EMOJI + PS + EMOJI),
]

payloads = [
    payload_case(
        "invoice_like_strings_only",
        {
            "amount_tbc": "10000000000",
            "invoice_id": "INV-123",
            "items": ["sku-1", "sku-2"],
            "metadata": {"customer_id": "CUSTOMER-1", "order_id": "ORDER-123"},
            "settled": True,
        },
        reordered={
            "settled": True,
            "metadata": {"order_id": "ORDER-123", "customer_id": "CUSTOMER-1"},
            "items": ["sku-1", "sku-2"],
            "invoice_id": "INV-123",
            "amount_tbc": "10000000000",
        },
    ),
    payload_case(
        "separator_in_value",
        {"memo": "line" + LS + "break", "note": "para" + PS + "graph"},
    ),
    payload_case(
        "separator_in_key",
        {"k" + LS: "line", "k" + PS: "para", "k": "plain"},
    ),
    payload_case(
        "html_and_control_chars",
        {"html": "<a href=\"x\">&amp;</a>", "ctrl": "\t\n\r\b\f"},
    ),
    payload_case(
        "non_ascii_values",
        {"city": "Z" + EACUTE + "rich", "cjk": CJK, "emoji": EMOJI},
    ),
    payload_case(
        "null_and_bool_and_array",
        {"flag": False, "maybe": None, "tags": ["a", None, "b"], "ok": True},
    ),
    payload_case(
        "large_value_as_decimal_string",
        {"amount_minor": "340282366920938463463374607431768211455"},
    ),
    payload_case(
        "key_sort_unicode_bmp",
        {"b": "x", "a" + LS: "sep", "a": "z", "Z": "upper"},
        reordered={"Z": "upper", "a": "z", "a" + LS: "sep", "b": "x"},
    ),
]

safe_integers = [
    int_case("zero", 0),
    int_case("one", 1),
    int_case("negative_one", -1),
    int_case("positive", 42),
    int_case("negative", -42),
    int_case("million", 1_000_000),
    int_case("max_safe_integer", 2**53 - 1),
    int_case("min_safe_integer", -(2**53 - 1)),
]

rejected_floats = [
    {"name": "simple_fraction", "decimal": "2.5"},
    {"name": "tenth", "decimal": "0.1"},
    {"name": "negative_fraction", "decimal": "-0.1"},
    {"name": "scientific_small", "decimal": "1e-7"},
    {"name": "high_precision", "decimal": "3.141592653589793"},
]

rejected_unsafe_integers = [
    {"name": "two_pow_53", "decimal": "9007199254740992"},
    {"name": "negative_two_pow_53", "decimal": "-9007199254740992"},
    {"name": "max_int64", "decimal": "9223372036854775807"},
]

fixture = {
    "version": "pc-06-canonical-conformance-v1",
    "description": (
        "Cross-SDK canonical JSON conformance vectors for audit finding PC-06 "
        "(issue #375). Identical logical inputs must produce identical canonical "
        "bytes and SHA-256 digests in the TypeScript, Go, and Python SDKs."
    ),
    "policy": {
        "separators": (
            "U+2028 (line separator) and U+2029 (paragraph separator) are always "
            "escaped to the lowercase \\u2028 / \\u2029 forms."
        ),
        "numbers": (
            "Only integers in the 53-bit safe range [-(2^53-1), 2^53-1] are "
            "allowed and are emitted as plain decimals. Floating-point numbers and "
            "out-of-range integers are rejected; callers must use integer minor "
            "units or a decimal string. rejected_floats and "
            "rejected_unsafe_integers list logical inputs every SDK must refuse."
        ),
        "harness_notes": (
            "safe_integers / rejected_* carry the number as a decimal string so "
            "that a generic JSON parse cannot silently coerce it to a float "
            "(Go's encoding/json decodes every JSON number as float64). Each SDK "
            "converts the decimal string to its native integer/float type before "
            "calling canonical JSON."
        ),
    },
    "string_values": string_values,
    "payloads": payloads,
    "safe_integers": safe_integers,
    "rejected_floats": rejected_floats,
    "rejected_unsafe_integers": rejected_unsafe_integers,
}

out_path = REPO / "tests" / "fixtures" / "pc-06-canonical-conformance.json"
# ensure_ascii=True keeps the fixture file pure ASCII (U+2028/U+2029/emoji become
# \uXXXX escapes) so it is unambiguous to every language's JSON parser.
out_path.write_text(json.dumps(fixture, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
print(f"wrote {out_path}")
print(f"string_values={len(string_values)} payloads={len(payloads)} "
      f"safe_integers={len(safe_integers)} rejected_floats={len(rejected_floats)} "
      f"rejected_unsafe_integers={len(rejected_unsafe_integers)}")
