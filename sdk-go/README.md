# tonbankcard-go

Official Go SDK for the [TONBANKCARD Merchant API](https://github.com/xlabtg/tonbankcard-protocol).
Stateless, non-custodial, type-safe.

## Install

```bash
go get github.com/xlabtg/tonbankcard-go
```

Go 1.22 or newer is required.

## Quickstart

```go
package main

import (
    "context"
    "log"
    "os"

    tonbankcard "github.com/xlabtg/tonbankcard-go"
)

func main() {
    client, err := tonbankcard.NewClient(tonbankcard.Config{
        APIKey: os.Getenv("TONBANKCARD_API_KEY"),
    })
    if err != nil {
        log.Fatal(err)
    }

    invoice, err := client.CreateInvoice(context.Background(), tonbankcard.CreateInvoiceParams{
        MerchantNFT: "EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le",
        AmountTBC:   "1000000000", // 1 TBC = 10^9 nanocoins
        Metadata:    map[string]any{"order_id": "ORDER-12345"},
    })
    if err != nil {
        log.Fatal(err)
    }
    log.Printf("payment URL: %s", invoice.PaymentURL)
}
```

## Webhook verification

```go
sig := r.Header.Get(tonbankcard.DefaultSignatureHeader) // "X-Tonbankcard-Signature"
body, _ := io.ReadAll(r.Body)
payload, err := tonbankcard.VerifyWebhook([]byte(os.Getenv("TONBANKCARD_WEBHOOK_SECRET")), body, sig)
if err != nil {
    if tonbankcard.IsSignatureError(err) {
        http.Error(w, "invalid signature", http.StatusUnauthorized)
        return
    }
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
}
log.Printf("settled invoice %s", payload.InvoiceID)
```

`VerifyWebhook` uses `hmac.Equal` for constant-time comparison and rejects:

- empty secret or signature
- non-hex signatures
- signature mismatch (after the optional `sha256=` prefix is stripped)
- payloads that are not JSON objects
- payloads missing required webhook fields (`event`, `invoice_id`, `status`)

## Error handling

The SDK exposes both an `*APIError` type and sentinel errors that wrap it,
so callers can use either `errors.Is` or `errors.As`:

```go
invoice, err := client.GetInvoice(ctx, id)
switch {
case errors.Is(err, tonbankcard.ErrInvoiceNotFound):
    // 404
case errors.Is(err, tonbankcard.ErrRateLimited):
    var apiErr *tonbankcard.APIError
    _ = errors.As(err, &apiErr)
    time.Sleep(time.Duration(apiErr.RetryAfter * float64(time.Second)))
case err != nil:
    return err
}
```

Sentinel errors: `ErrAuthentication` (401/403), `ErrInvalidRequest` (400),
`ErrInvoiceNotFound` (404), `ErrInvoiceExpired` (410), `ErrRateLimited` (429),
`ErrServer` (5xx), `ErrSignatureVerification`, `ErrInvalidInput`
(client-side validation).

## Security

- **API keys are accepted via `Config.APIKey` only.** They are never read from
  URL query parameters or written to logs by the SDK.
- **Webhook verification uses `hmac.Equal`** to prevent timing attacks.
- **No credentials are committed to this repository.** Examples use `os.Getenv`.
- **Go module checksums** (`go.sum`) protect against tampered dependencies and
  are verified on `go install` / `go build` by default.

## License

MIT — see [LICENSE](LICENSE).
