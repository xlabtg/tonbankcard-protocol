import { MerchantPaymentHubHarness } from './dist/MerchantPaymentHubHarness_MerchantPaymentHubHarness';
import '@ton/test-utils';
import { Blockchain } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import { VerifiedNFTAccountResolver } from './dist/VerifiedNFTAccountResolver_VerifiedNFTAccountResolver';
import { AccountNFTHarness } from './dist/AccountNFTHarness_AccountNFTHarness';
import { MerchantPaymentHub, storeMerchantPaymentResponse, loadMerchantNFTOwnerRegistered } from './dist/MerchantPaymentHub_MerchantPaymentHub';
test('verified NFT response refreshes hub authority after transfer and rejects forged callbacks #505', async () => {
 const chain = await Blockchain.create();
 const old = await chain.treasury('old'), next = await chain.treasury('next');
 const collection = await chain.treasury('7777'), otherCollection = await chain.treasury('8888');
 const admin = await chain.treasury('admin'), locks = await chain.treasury('locks'), settlement = await chain.treasury('settlement');
 const resolver = chain.openContract(await VerifiedNFTAccountResolver.fromInit(collection.address, otherCollection.address));
 const nft = chain.openContract(await AccountNFTHarness.fromInit(old.address, collection.address));
 const merchant = chain.openContract(await AccountNFTHarness.fromInit(next.address, otherCollection.address));
 const hub = chain.openContract(await MerchantPaymentHub.fromInit(admin.address, locks.address, resolver.address, settlement.address));
 const gas = {value:toNano('0.5')};
 await nft.send(old.getSender(),gas,{$$type:'Deploy',queryId:0n});
 await merchant.send(next.getSender(),gas,{$$type:'Deploy',queryId:0n});
 // Activate the hub before asynchronous callbacks (messages do not carry its StateInit).
 await hub.send(admin.getSender(),gas,{$$type:'MerchantPaymentRequest',payer_nft:nft.address,merchant_nft:merchant.address,amount_tbc:1n,payload:null});
 for (const [item,c] of [[nft,collection],[merchant,otherCollection]] as const) {
  await resolver.send(c.getSender(),gas,{$$type:'RegisterAccountItem',nft_address:item.address});
  const refresh=await resolver.send(old.getSender(),gas,{$$type:'RefreshAccountOwner',nft_address:item.address,target:hub.address});
  if(process.env.TRACE_OWNER) console.log(JSON.stringify(refresh.transactions.map(t=>({src:t.inMessage?.info,body:t.inMessage?.body.toString(),description:t.description})),(_,v)=>typeof v==='bigint'?v.toString():v));
 }
 const deposit=await hub.send(settlement.getSender(),gas,{$$type:'TBCDeposit',deposit_id:1n,nft_address:nft.address,amount_tbc:100n});
 if(process.env.TRACE_OWNER) console.log(JSON.stringify(deposit.transactions.map(t=>t.description),(_,v)=>typeof v==='bigint'?v.toString():v));
 const forged = await resolver.send(next.getSender(),gas,{$$type:'AccountNFTData',query_id:0n,collection:collection.address,owner:next.address});
 expect(forged.transactions).toHaveTransaction({from:next.address,to:resolver.address,success:false});
 await nft.send(old.getSender(),gas,{$$type:'TransferAccountHarness',owner:next.address});
 await resolver.send(next.getSender(),gas,{$$type:'RefreshAccountOwner',nft_address:nft.address,target:hub.address});
 const request = {$$type:'MerchantPaymentRequest' as const,payer_nft:nft.address,merchant_nft:merchant.address,amount_tbc:10n,payload:null};
 const denied = await hub.send(old.getSender(),gas,request);
 expect(denied.transactions).toHaveTransaction({from:hub.address,to:old.address,body:beginCell().store(storeMerchantPaymentResponse({$$type:'MerchantPaymentResponse',success:false,error_code:1n})).endCell()});
 expect(await hub.getGetBalance(nft.address)).toBe(100n);
 await hub.send(next.getSender(),gas,request);
 expect(await hub.getGetBalance(nft.address)).toBe(90n);
 expect(await resolver.getGetPendingCount()).toBe(0n);
},60000);

test('resolver refresh preserves frozen state, balance and the emitted state #505', async () => {
 const chain=await Blockchain.create();
 const admin=await chain.treasury('state-admin'), old=await chain.treasury('state-old'), next=await chain.treasury('state-next');
 const resolver=await chain.treasury('state-resolver'), locks=await chain.treasury('state-locks'), settlement=await chain.treasury('state-settlement');
 const nft=(await chain.treasury('state-nft')).address;
 const hub=chain.openContract(await MerchantPaymentHubHarness.fromInit(admin.address,locks.address,resolver.address,settlement.address));
 const gas={value:toNano('0.2')};
 await hub.send(admin.getSender(),gas,{$$type:'SetAccountState',nft_address:nft,state:1n,owner:old.address});
 await hub.send(admin.getSender(),gas,{$$type:'SetAccountBalance',nft_address:nft,balance:100n});
 const refreshed=await hub.send(resolver.getSender(),gas,{$$type:'ResolveNFTOwner',nft_address:nft,owner:next.address});
 expect(await hub.getGetAccountState(nft)).toBe(1n);
 expect(await hub.getGetBalance(nft)).toBe(100n);
 const event=refreshed.transactions.flatMap(t=>Array.from(t.outMessages.values())).find(m=>m.info.type==='external-out');
 expect(event).toBeDefined();
 expect(loadMerchantNFTOwnerRegistered(event!.body.beginParse()).state).toBe(1n);
},60000);
