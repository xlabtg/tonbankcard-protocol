// Build entrypoint for the deployable production CollateralSignal (Issue #364).
//
// Tact resolves a project's entry file relative to the build root. This thin
// re-export lets the "CollateralSignal" build project compile the production
// contract (which lives at contracts/CollateralSignal.tact) STANDALONE — proving
// the production source compiles with NO test-only `RegisterNFTOwner` handler and
// that NFT ownership is registered ONLY through the resolver-gated ResolveNFTOwner.
import "../../CollateralSignal.tact";
