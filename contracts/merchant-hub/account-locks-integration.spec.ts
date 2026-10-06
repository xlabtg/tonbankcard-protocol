const { buildWalletLink } = require('../../sdk/dist/wallet-link') as { buildWalletLink(config: {network:string;paymentHubAddress:Address}, options: {payerNft:Address;invoice:{id:string;merchantNft:Address;amountTbc:bigint;createdAt:number}}):string };
import fs from 'fs';
import path from 'path';
import '@ton/test-utils';
import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { funcCompile } from '@tact-lang/compiler/dist/func/funcCompile';
import { Logger } from '@tact-lang/compiler/dist/logger';
import { MerchantPaymentHub, storeMerchantPaymentResponse } from './dist/MerchantPaymentHub_MerchantPaymentHub';
class AccountLocks implements Contract {
 constructor(readonly address: Address, readonly init: {code:Cell,data:Cell}) {}
 async send(provider: ContractProvider, via: Sender, body: Cell) {
  await provider.internal(via,{value:toNano('0.2'),body});
 }
 async getLocks(provider:ContractProvider,nft:Address) {
  const result = await provider.get('get_lock_state',[{type:'slice',cell:beginCell().storeAddress(nft).endCell()}]);
  return [result.stack.readBigNumber(),result.stack.readBigNumber()];
 }
}
let code:Cell;
beforeAll(async () => {
 const source = path.resolve(__dirname,'../payments/account-locks.fc');
 const stdlib = path.resolve(path.dirname(require.resolve('@tact-lang/compiler/package.json')),'stdlib/stdlib.fc');
 const result = await funcCompile({entries:[source],sources:[{path:source,content:fs.readFileSync(source,'utf8')},{path:path.resolve(path.dirname(source),'stdlib.fc'),content:fs.readFileSync(stdlib,'utf8')}],logger:new Logger()});
 if (!result.ok) throw new Error(result.log);
 code = Cell.fromBoc(result.output!)[0];
},60000);
test('real AccountLocks preserves both flags, isolates accounts and blocks hub payments until clear #503/#504', async () => {
 const chain = await Blockchain.create();
 const risk = await chain.treasury('risk'), lending = await chain.treasury('lending');
 const owner = await chain.treasury('owner'), merchant = await chain.treasury('merchant');
 const resolver = await chain.treasury('resolver'), settlement = await chain.treasury('settlement');
 const payer = (await chain.treasury('payerNFT')).address, other = (await chain.treasury('otherNFT')).address;
 const data = beginCell().storeDict(null).storeAddress(risk.address).storeAddress(lending.address)
  .storeBit(false).storeAddress(null).storeUint(0,32).storeBit(false).storeAddress(null).storeUint(0,32)
  .storeRef(beginCell().storeAddress(null).endCell()).endCell();
 const init = {code,data};
 const locks = chain.openContract(new AccountLocks(contractAddress(0,init),init));
 const hub = chain.openContract(await MerchantPaymentHub.fromInit(risk.address,locks.address,resolver.address,settlement.address));
 await locks.send(risk.getSender(),beginCell().storeUint(0x5001,32).storeAddress(hub.address).endCell());
 for (const [nft,wallet] of [[payer,owner],[other,merchant]] as const) {
  await hub.send(resolver.getSender(),{value:toNano('0.2')},{$$type:'ResolveNFTOwner',nft_address:nft,owner:wallet.address});
 }
 await hub.send(settlement.getSender(),{value:toNano('0.2')},{$$type:'TBCDeposit',deposit_id:1n,nft_address:payer,amount_tbc:100n});
 const pay = () => hub.send(owner.getSender(),{value:toNano('0.2')},{$$type:'MerchantPaymentRequest',payer_nft:payer,merchant_nft:other,amount_tbc:10n,payload:null});
 const flag = (op:number,nft:Address=payer) => locks.send((op===0x1001||op===0x1002?risk:lending).getSender(),beginCell().storeUint(op,32).storeAddress(nft).endCell());
 const applied = await flag(0x1001);
 if (process.env.TRACE_LOCKS) console.log(JSON.stringify(applied.transactions.map(t => ({in:t.inMessage?.body.toString(),description:t.description})),(_,v)=>typeof v === 'bigint' ? v.toString():v));
 expect(await locks.getLocks(payer)).toEqual([1n,0n]);
 expect(await locks.getLocks(other)).toEqual([0n,0n]);
 expect(await hub.getHasFraudLock(payer)).toBe(true);
 const denied = await pay();
 const response = beginCell().store(storeMerchantPaymentResponse({$$type:'MerchantPaymentResponse',success:false,error_code:3n})).endCell();
 expect(denied.transactions).toHaveTransaction({from:hub.address,to:owner.address,body:response});
 expect(await hub.getGetBalance(payer)).toBe(100n);
 await flag(0x1003);
 expect(await locks.getLocks(payer)).toEqual([1n,1n]);
 await flag(0x1002);
 expect(await locks.getLocks(payer)).toEqual([0n,1n]);
 await flag(0x1004);
 expect(await locks.getLocks(payer)).toEqual([0n,0n]);
 const link=buildWalletLink({network:'testnet',paymentHubAddress:Address.parse(hub.address.toString())}, {
  payerNft:Address.parse(payer.toString()),invoice:{id:'sdk-e2e',merchantNft:Address.parse(other.toString()),amountTbc:10n,createdAt:1},
 });
 const url=new URL(link);
 expect(url.searchParams.get('amount')).toBe('50000000');
 const body=Cell.fromBase64(url.searchParams.get('bin')!);
 await chain.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:false,src:owner.address,dest:hub.address,value:{coins:50_000_000n},ihrFee:0n,forwardFee:0n,createdLt:0n,createdAt:0},body});
 expect(await hub.getGetBalance(payer)).toBe(90n);
 expect(await hub.getGetBalance(other)).toBe(10n);
},60000);

test('corrected FunC unit runner executes dictionary persistence assertions #503', async () => {
 const source = path.dirname(path.resolve(__dirname,'../payments/tests/account-locks.spec.fc'))+'/../account-locks.fc';
 const tests = path.resolve(__dirname,'../payments/tests/account-locks.spec.fc');
 const stdlib = path.resolve(path.dirname(require.resolve('@tact-lang/compiler/package.json')),'stdlib/stdlib.fc');
 const result = await funcCompile({entries:[tests],sources:[
  {path:source,content:fs.readFileSync(source,'utf8')},
  {path:tests,content:fs.readFileSync(tests,'utf8')},
  {path:path.dirname(source)+'/stdlib.fc',content:fs.readFileSync(stdlib,'utf8')}],logger:new Logger()});
 if (!result.ok) throw new Error(result.log);
 const unitCode=Cell.fromBoc(result.output!)[0];
 const chain=await Blockchain.create();
 const risk=(await chain.treasury('unit-risk')).address;
 const data=beginCell().storeDict(null).storeAddress(risk).storeAddress(risk)
 .storeBit(false).storeAddress(null).storeUint(0,32).storeBit(false).storeAddress(null).storeUint(0,32)
 .storeRef(beginCell().storeAddress(null).endCell()).endCell();
 const init={code:unitCode,data};
 const address=contractAddress(0,init);
 await chain.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:false,src:risk,dest:address,value:{coins:1_000_000_000n},ihrFee:0n,forwardFee:0n,createdLt:0n,createdAt:0},init,body:beginCell().storeUint(0x5001,32).storeAddress(risk).endCell()});
 const contract=await chain.getContract(address);
 const execution=await contract.get('run_tests',[]);
 expect(execution.exitCode).toBe(0);
},60000);
