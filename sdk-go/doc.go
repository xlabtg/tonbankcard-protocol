// Package tonbankcard provides a typed client for the TONBANKCARD Merchant
// API (see docs/openapi.yaml in the protocol repository).
//
// The SDK is read-only and non-custodial: it never stores private keys,
// signs transactions, or moves user funds. The TON blockchain is the
// single source of truth for settlement; this package only authenticates
// the merchant against the API and verifies HMAC-signed webhooks.
//
// Quickstart:
//
//	client, err := tonbankcard.NewClient(tonbankcard.Config{APIKey: os.Getenv("TONBANKCARD_API_KEY")})
//	if err != nil {
//	    log.Fatal(err)
//	}
//	invoice, err := client.CreateInvoice(ctx, tonbankcard.CreateInvoiceParams{
//	    MerchantNFT: "EQA...",
//	    AmountTBC:   "1000000000",
//	    Metadata:    map[string]any{"order_id": "ORDER-12345"},
//	})
//
// Webhook verification uses constant-time comparison (hmac.Equal) to
// resist timing attacks. See VerifyWebhook for details.
package tonbankcard
