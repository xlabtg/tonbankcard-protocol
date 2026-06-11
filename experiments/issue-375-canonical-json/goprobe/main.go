package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

func canonical(v any) string {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
	return strings.TrimSuffix(buf.String(), "\n")
}

func main() {
	cases := map[string]string{
		"short_controls": "\b\f\t\n\r",
		"low_controls":   func() string { b := make([]rune, 0); for c := 0; c < 0x20; c++ { b = append(b, rune(c)) }; return string(b) }(),
		"del_0x7f":       "xy",
		"u2028_u2029":    string(rune(0x2028)) + string(rune(0x2029)),
		"html":           "<a> & \"q\" 'b' /c/",
		"non_ascii":      "é中\U0001f600",
	}
	for name, s := range cases {
		out := canonical(s)
		fmt.Printf("%-16s %s\n", name, hex.EncodeToString([]byte(out)))
	}
}
