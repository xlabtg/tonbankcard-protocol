import { Blockchain } from '@ton/sandbox';
import { beginCell } from '@ton/core';
import { AccountStateMachine } from './dist/account-state_AccountStateMachine';
import { VerifiedNFTAccountResolver } from './dist/deployable/VerifiedNFTAccountResolver/VerifiedNFTAccountResolver_VerifiedNFTAccountResolver';
import { MerchantPaymentHub } from './dist/deployable/MerchantPaymentHub/MerchantPaymentHub_MerchantPaymentHub';
import { CollateralSignal } from './dist/deployable/CollateralSignal/CollateralSignal_CollateralSignal';
import { ProposalRegistry } from './dist/deployable/ProposalRegistry/ProposalRegistry_ProposalRegistry';
import { SnapshotVerifier } from './dist/deployable/SnapshotVerifier/SnapshotVerifier_SnapshotVerifier';
import { TransparencyRegistry } from './dist/deployable/TransparencyRegistry/TransparencyRegistry_TransparencyRegistry';
import { buildUnsignedDeployment, DeploymentManifest } from '../../scripts/deploy/deploy';
import { REQUIRED_INIT_GETTERS, verifyManifest } from '../../scripts/deploy/verify';
test('every deployable Tact verifies original StateInit against initialized live state #509', async () => {
 const chain=await Blockchain.create();
 const admin=await chain.treasury('admin');
 const deployer=await chain.treasury('deployer'), risk=await chain.treasury('risk'), resolver=await chain.treasury('resolver'), settlement=await chain.treasury('settlement');
 const cases = [
  ['AccountStateMachine',await AccountStateMachine.fromInit(deployer.address),{owner:deployer.address.toString()}],
  ['VerifiedNFTAccountResolver',await VerifiedNFTAccountResolver.fromInit(risk.address,resolver.address),{collection7777:risk.address.toString(),collection8888:resolver.address.toString()}],
  ['MerchantPaymentHub',await MerchantPaymentHub.fromInit(admin.address,risk.address,resolver.address,settlement.address),{admin:admin.address.toString(),account_locks:risk.address.toString(),nft_resolver:resolver.address.toString(),tbc_settlement:settlement.address.toString()}],
  ['CollateralSignal',await CollateralSignal.fromInit(resolver.address),{nft_resolver:resolver.address.toString()}],
  ['ProposalRegistry',await ProposalRegistry.fromInit(),{deployer:deployer.address.toString()}],
  ['SnapshotVerifier',await SnapshotVerifier.fromInit(),{deployer:deployer.address.toString()}],
  ['TransparencyRegistry',await TransparencyRegistry.fromInit(23n),{deployer:deployer.address.toString()}],
 ] as const;
 for (const [name,wrapper,parameters] of cases) {
  // Raw body avoids depending on each wrapper's receiver union.
  await chain.sendMessage({info:{type:'internal',ihrDisabled:true,bounce:false,bounced:false,src:deployer.address,dest:wrapper.address,value:{coins:500_000_000n},ihrFee:0n,forwardFee:0n,createdLt:0n,createdAt:0},init:wrapper.init,body:beginCell().storeUint(0x946a98b6,32).storeUint(0,64).endCell()});
  const account=await chain.getContract(wrapper.address);
  if (account.accountState?.type!=='active') throw new Error(`${name} not active`);
  const {code,data}=account.accountState.state;
  const prepared=buildUnsignedDeployment(name,wrapper.init!.code,wrapper.init!.data,0);
  const manifest:DeploymentManifest={version:'1.0.0',manifestType:'tonbankcard.deploy.manifest',artefactType:'live',network:'testnet',timestamp:new Date().toISOString(),commit:'a'.repeat(40),configuration:{deployerAddress:deployer.address.toString(),adminAddress:admin.address.toString(),riskAuthority:risk.address.toString(),lendingAdapter:null},verificationBlock:123,contracts:{[name]:{...prepared,initParameters:parameters}}};
  const values:Record<string,string>={};
  for (const [key,getter] of Object.entries(REQUIRED_INIT_GETTERS[name])) {
   const result=await account.get(getter,[]);
   values[key]=result.stackReader.readAddress().toString();
  }
  const report=await verifyManifest(manifest,'sandbox.json',{getContractState:async()=>({block:123,state:'active',code:code!,data:data!,adminAddress:Object.values(values)[0],configurationValues:values})});
  expect(report.results[0].errors).toEqual([]);
 }
},60000);
