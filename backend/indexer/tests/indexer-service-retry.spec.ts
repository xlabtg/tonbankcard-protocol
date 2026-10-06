import pino from 'pino';
import { IndexerService } from '../src/services/indexer-service';
import { IndexerDatabase } from '../src/db/database';
import { IndexerConfig } from '../src/types/config';
test('failed block fetch stops batch; next poll indexes the missing height #506', async () => {
 const db = new IndexerDatabase(':memory:');
 const config = { contracts: { paymentHub: '', merchantPaymentHub: '', transparencyRegistry: '', nftCollections: [] }, indexer: {confirmationBlocks: 1}, tonApiEndpoint:'https://example.com' } as unknown as IndexerConfig;
 const service = new IndexerService(config, db, pino({level:'silent'})) as any;
 service.fetchBlockTransactions = async () => [];
 let fail = true;
 service.fetchTonApi = async (_method: string, args: {seqno:number}) => {
  if (args.seqno === 2 && fail) { fail = false; return {ok:false}; }
  return {ok:true, result:{seqno:args.seqno,root_hash:`hash-${args.seqno}`,prev_blocks:[{root_hash:`hash-${args.seqno-1}`}],gen_utime:1700000000}};
 };
 try {
  await expect(service.syncBlockRange(1,3)).rejects.toThrow();
  expect(db.getLatestBlockIndexed()).toBe(1);
  expect(db.getBlock(3)).toBeNull();
  await service.syncBlockRange(2,3);
  expect(db.getLatestBlockIndexed()).toBe(3);
  expect(db.getBlock(2)).not.toBeNull();
 } finally { db.close(); }
});
