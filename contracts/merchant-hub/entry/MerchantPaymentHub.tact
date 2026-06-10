// Build entrypoint for the deployable production MerchantPaymentHub.
//
// Tact resolves a project's entry file relative to tact.config.json. This thin
// re-export lets the "MerchantPaymentHub" build project compile the production
// contract (which lives at contracts/MerchantPaymentHub.tact) STANDALONE — i.e.
// without pulling in the test harness — proving the production source compiles
// with NO test-only handlers present.
import "../../MerchantPaymentHub.tact";
