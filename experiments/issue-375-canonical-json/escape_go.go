// Battery: how does Go encoding/json (SetEscapeHTML(false)) escape each code point?
package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

func main() {
	codepoints := []rune{}
	for c := rune(0x00); c <= 0x20; c++ {
		codepoints = append(codepoints, c)
	}
	codepoints = append(codepoints,
		0x22, 0x5c, 0x2f, 0x3c, 0x3e, 0x26, 0x7f, 0xe9, 0x2028, 0x2029, 0x4e2d, 0x1f600,
	)
	for _, cp := range codepoints {
		s := string(cp)
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(s); err != nil {
			fmt.Printf("%06x\tERROR\t%v\n", cp, err)
			continue
		}
		out := strings.TrimSuffix(buf.String(), "\n")
		fmt.Printf("%06x\t%s\n", cp, hex.EncodeToString([]byte(out)))
	}
}
