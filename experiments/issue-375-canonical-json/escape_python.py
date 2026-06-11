"""Battery: how does Python json.dumps escape each interesting code point?"""

import json

codepoints = list(range(0x00, 0x21))
codepoints += [
    0x22,  # "
    0x5C,  # backslash
    0x2F,  # /
    0x3C,  # <
    0x3E,  # >
    0x26,  # &
    0x7F,  # DEL
    0xE9,  # é
    0x2028,
    0x2029,
    0x4E2D,  # 中
    0x1F600,  # 😀
]
for cp in codepoints:
    s = chr(cp)
    out = json.dumps(s, ensure_ascii=False)
    print(f"{cp:06x}\t{out.encode('utf-8').hex()}")
