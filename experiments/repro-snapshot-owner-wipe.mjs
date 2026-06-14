import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.exec(`CREATE TABLE account_snapshots (
  nft_address TEXT PRIMARY KEY,
  current_owner TEXT,
  current_state INTEGER NOT NULL DEFAULT 0,
  last_transfer_block INTEGER,
  last_state_change_block INTEGER,
  last_updated INTEGER NOT NULL
);`);
const nft = 'EQpayer';
// 1) ownership change sets owner (mirrors insertNFTOwnershipChange line 510-514)
db.prepare(`INSERT OR REPLACE INTO account_snapshots (nft_address, current_owner, last_updated)
            VALUES (?, ?, ?)
            ON CONFLICT(nft_address) DO UPDATE SET current_owner = ?, last_updated = ?`)
  .run(nft, 'EQownerAlice', 100, 'EQownerAlice', 100);
// also a transfer sets last_transfer_block (mirrors updateAccountSnapshot)
db.prepare(`UPDATE account_snapshots SET last_transfer_block = ?, last_updated = ? WHERE nft_address = ?`).run(55, 100, nft);
console.log('after ownership+transfer:', db.prepare('SELECT * FROM account_snapshots WHERE nft_address=?').get(nft));
// 2) account state change (mirrors insertAccountStateChange line 462)
db.prepare(`INSERT OR REPLACE INTO account_snapshots (nft_address, current_state, last_state_change_block, last_updated)
            VALUES (?, ?, ?, ?)`).run(nft, 1 /*FROZEN*/, 200, 200);
const after = db.prepare('SELECT * FROM account_snapshots WHERE nft_address=?').get(nft);
console.log('after state change: ', after);
console.log('');
console.log('BUG CONFIRMED:', after.current_owner === null && after.last_transfer_block === null
  ? 'YES — current_owner and last_transfer_block were WIPED to NULL by the state-change INSERT OR REPLACE'
  : 'NO — columns preserved');
db.close();
