// PC-06 reproduction (Go) — mirrors sdk-go hashing.CanonicalJSON before the fix.
package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

func canonicalJSON(value any) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(buf.String(), "\n"), nil
}

func main() {
	cases := []struct {
		name  string
		value any
	}{
		{"line_sep", map[string]any{"note": "line sep"}},
		{"para_sep", map[string]any{"note": "para sep"}},
		{"float_int", map[string]any{"v": 2.0}},
		{"float_big", map[string]any{"v": 1e16}},
		{"float_small", map[string]any{"v": 1e-7}},
		{"float_frac", map[string]any{"v": 2.5}},
	}
	// Stable ordering for readable output.
	sort.Slice(cases, func(i, j int) bool { return cases[i].name < cases[j].name })
	for _, c := range cases {
		out, err := canonicalJSON(c.value)
		if err != nil {
			fmt.Printf("%s\tERROR\t%v\n", c.name, err)
			continue
		}
		fmt.Printf("%s\t%q\t%s\n", c.name, out, hex.EncodeToString([]byte(out)))
	}
}
