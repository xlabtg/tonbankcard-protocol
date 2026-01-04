// Version Metadata Interface
// Based on Issue #42 - Protocol Versioning & Deployment Policy (Immutable-First)
//
// This interface provides READ-ONLY version metadata for TONBANKCARD contracts.
// Version information is purely informational and provides no security guarantees.
// Immutability is enforced by design, not by version checks.
//
// IMPORTANT: This interface adds no upgrade capability.
// All functions are getters (read-only) and cannot modify contract state.

// Interface for Version Metadata
// Provides read-only version information for protocol contracts
trait IVersionMetadata {

    // Get the protocol version this contract belongs to
    // Returns semantic version string (e.g., "1.0.0")
    get fun getProtocolVersion(): String;

    // Get the human-readable contract name
    // Returns contract identifier (e.g., "PaymentHub", "MerchantPaymentHub")
    get fun getContractName(): String;

    // Get the source code commit hash
    // Returns Git commit hash used for deployment (40 hex characters)
    get fun getSourceCommit(): String;
}

// Extended version metadata trait with additional deployment information
// Use this for contracts that want to expose full deployment context
trait IVersionMetadataExtended with IVersionMetadata {

    // Get the protocol version this contract belongs to
    get fun getProtocolVersion(): String;

    // Get the human-readable contract name
    get fun getContractName(): String;

    // Get the source code commit hash
    get fun getSourceCommit(): String;

    // Get the deployment timestamp (Unix timestamp)
    // Returns 0 if not set during deployment
    get fun getDeploymentTimestamp(): Int;

    // Get the network identifier
    // Returns "mainnet", "testnet", or "sandbox"
    get fun getNetwork(): String;
}

// Constants for common version metadata values
// These should be updated before each deployment

// Current protocol version
const PROTOCOL_VERSION: String = "1.0.0";

// Network identifiers
const NETWORK_MAINNET: String = "mainnet";
const NETWORK_TESTNET: String = "testnet";
const NETWORK_SANDBOX: String = "sandbox";
