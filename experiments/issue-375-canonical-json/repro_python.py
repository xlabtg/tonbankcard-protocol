"""PC-06 reproduction (Python) — mirrors sdk-python hashing.canonical_json before the fix."""

from __future__ import annotations

import json
import math


def canonical_json(value: object) -> str:
    def normalize(v: object) -> object:
        if v is None or isinstance(v, (str, bool)):
            return v
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            if not math.isfinite(v):
                raise TypeError("non-finite")
            return v
        if isinstance(v, (list, tuple)):
            return [normalize(i) for i in v]
        if isinstance(v, dict):
            return {k: normalize(i) for k, i in v.items()}
        raise TypeError("unsupported")

    return json.dumps(
        normalize(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


cases = {
    "line_sep": {"note": "line sep"},
    "para_sep": {"note": "para sep"},
    "float_int": {"v": 2.0},
    "float_big": {"v": 1e16},
    "float_small": {"v": 1e-7},
    "float_frac": {"v": 2.5},
}

for name, value in cases.items():
    try:
        out = canonical_json(value)
    except Exception as exc:  # noqa: BLE001
        print(f"{name}\tERROR\t{exc}")
        continue
    hex_bytes = out.encode("utf-8").hex()
    print(f"{name}\t{json.dumps(out)}\t{hex_bytes}")
