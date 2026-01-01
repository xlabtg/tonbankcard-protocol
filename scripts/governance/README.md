# Governance Snapshot Scripts

## Overview

Off-chain utilities for creating and verifying TBC Diamonds DAO governance snapshots.

**Purpose**: Generate voter registries for governance proposals
**Type**: Read-only off-chain tools (no custody, no execution)

## Files

- `snapshot.ts` - Main snapshot creation and verification tool
- `config.example.json` - Configuration template
- `config.json` - Local configuration (create from example, not committed to git)

## Setup

### Prerequisites

```bash
npm install @ton/ton @ton/core
```

### Configuration

1. Copy example configuration:
```bash
cp config.example.json config.json
```

2. Edit `config.json` with TBC Diamonds collection details:
```json
{
  "diamondsCollectionAddress": "EQC...",  // TBC Diamonds NFT collection address
  "totalSupply": 222,
  "tonApiEndpoint": "https://toncenter.com/api/v2/jsonRPC",
  "tonApiKey": "optional-api-key-for-rate-limits"
}
```

## Usage

### Create Snapshot at Current Block

```bash
npm run governance:snapshot
```

Output: `../../snapshots/snapshot_<block_number>.json`

### Create Snapshot at Specific Block

```bash
npm run governance:snapshot --block=12345678
```

### Verify Snapshot Integrity

```bash
npm run governance:verify-snapshot snapshots/snapshot_12345678.json
```

## Snapshot Format

Generated snapshots follow this structure:

```json
{
  "snapshot_block": 12345678,
  "snapshot_time": "2025-01-15T10:00:00Z",
  "collection_address": "EQC...",
  "total_supply": 222,
  "voters": [
    {
      "nft_index": 0,
      "owner_address": "EQA...",
      "voting_power": 1
    },
    ...
  ],
  "total_voting_power": 222,
  "unique_owners": 187,
  "metadata": {
    "created_at": "2025-01-15T10:05:00Z",
    "tool_version": "1.0.0",
    "governance_type": "advisory-non-binding"
  }
}
```

## Snapshot Verification

The verification tool checks:

✅ **Structural Integrity**
- Valid block number
- Correct collection address
- Total supply = 222

✅ **Voter Data**
- NFT indices in range [0, 221]
- No duplicate NFT indices
- Valid TON address formats
- Voting power = 1 per NFT

✅ **Totals**
- Total voting power matches voter count
- Unique owners count is accurate

⚠️ **Warnings**
- Low participation (< 50% of supply)
- Centralization (single owner with many NFTs)

## Implementation Notes

### NFT Address Calculation

The snapshot tool needs to query each of the 222 TBC Diamonds NFTs. This requires:

1. **Collection Contract Call**: `get_nft_address_by_index(index)`
   - Returns the address of NFT item contract for given index

2. **NFT Item Contract Call**: `get_nft_data()`
   - Returns: `(init, index, collection, owner, content)`
   - Verify `init = true` (NFT is initialized, not burned)
   - Extract `owner` address

### Snapshot Timing

**Important**: Snapshots must be taken BEFORE voting begins to prevent:
- Double voting via NFT transfers
- Flash loan attacks
- Market manipulation during voting

**Recommended Timeline**:
```
Day 0: Proposal published
Day 3: Snapshot block announced (e.g., "snapshot at block X in 2 days")
Day 5: Snapshot taken at predetermined block
Day 5-19: Voting period (14 days)
Day 19: Voting closes, results published
```

### Rate Limiting

Querying 222 NFTs sequentially may hit TON API rate limits.

**Solutions**:
- Use TON API key for higher limits
- Implement exponential backoff on errors
- Batch queries if API supports it
- Cache results and reuse for nearby blocks

### Off-Chain vs On-Chain

This tool is **off-chain** for efficiency. On-chain snapshot contracts are possible but:
- ❌ Higher gas costs (222 NFT queries)
- ❌ Limited by block gas limits
- ❌ More complex implementation
- ✅ Off-chain snapshots are industry standard (e.g., Snapshot.org)

## Security Considerations

### What This Tool DOES

✅ Reads NFT ownership at specific block
✅ Generates voter registry JSON
✅ Verifies snapshot integrity
✅ Provides data for voting platforms

### What This Tool DOES NOT Do

❌ Execute votes or governance decisions
❌ Custody NFTs or funds
❌ Modify blockchain state
❌ Enforce voting outcomes
❌ Transfer assets

### Attack Vectors

**NFT Loaning**: Users could lend NFTs to others before snapshot, then take them back before voting.
- **Mitigation**: Snapshot at announced block BEFORE voting starts
- **Acceptance**: Known limitation of NFT governance

**Flash Ownership**: Attackers could acquire NFTs just for snapshot, then sell.
- **Mitigation**: Long proposal discussion periods increase cost
- **Acceptance**: Free market allows this

**Snapshot Manipulation**: Tool operator could create fake snapshots.
- **Mitigation**: Open source code, reproducible snapshots, community verification
- **Acceptance**: Off-chain tools require some trust (same as Snapshot.org)

## Integration with Voting Platforms

### Snapshot.org

The generated snapshot JSON can be used with Snapshot strategies:

```javascript
{
  "name": "erc721-with-snapshot",
  "params": {
    "symbol": "DIAMOND",
    "snapshot": "snapshot_12345678.json"
  }
}
```

### Custom Voting UI

For custom governance UIs:

```typescript
import snapshot from './snapshots/snapshot_12345678.json';

// Check if address can vote
function canVote(address: string): boolean {
  return snapshot.voters.some(v => v.owner_address === address);
}

// Get voting power
function getVotingPower(address: string): number {
  return snapshot.voters
    .filter(v => v.owner_address === address)
    .reduce((sum, v) => sum + v.voting_power, 0);
}
```

## Testing

Run tests:
```bash
npm run test:governance
```

Test coverage:
- Snapshot creation with mock data
- Verification logic
- Error handling
- Edge cases (all NFTs to one owner, etc.)

## Troubleshooting

### "Collection address not configured"

Edit `config.json` and set `diamondsCollectionAddress`.

### "NFT address calculation not implemented"

The tool currently throws this error because it requires the actual TBC Diamonds collection contract to be deployed.

**To fix**:
1. Deploy TBC Diamonds NFT collection
2. Update `getNFTAddress()` method in `snapshot.ts` to call the collection's `get_nft_address_by_index` method
3. Implement TON SDK calls based on actual contract ABI

### Rate Limit Errors

- Add API key to `config.json`
- Reduce query frequency (add delays)
- Use local TON node for unlimited queries

## Future Enhancements

Potential future improvements (out of scope for Issue #36):

- **Parallel Queries**: Query multiple NFTs concurrently
- **Caching Layer**: Cache ownership data for nearby blocks
- **Historical Snapshots**: Track ownership changes over time
- **Delegation Support**: If delegation is added to governance
- **Auto-Upload**: Automatically upload snapshots to IPFS
- **Multi-Collection**: Support multiple governance NFT collections

## Documentation

- [DAO Governance](../../docs/dao-governance.md) - Complete governance framework
- [Diamond Resolver Contract](../../contracts/governance/README.md) - On-chain helper

## Contributing

Changes to snapshot tools require:

1. Security review (off-chain tools can affect governance)
2. Tests for new features
3. Documentation updates
4. Backward compatibility with existing snapshots

## License

TBD (follows repository license)

---

**Remember**: These are informational tools only. Governance is advisory, non-binding, and non-custodial.
