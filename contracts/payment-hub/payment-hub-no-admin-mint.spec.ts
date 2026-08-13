/** Issue #427: the deployable PaymentHub must reject its former admin mint. */

import { describe, expect, it } from '@jest/globals';
import '@ton/test-utils';
import { beginCell, toNano } from '@ton/core';
import { Blockchain } from '@ton/sandbox';
import { PaymentHub } from './dist/PaymentHub_PaymentHub';

describe('PaymentHub production surface: no admin mint', () => {
  it('rejects InitializeAccount before mutation and keeps total balance at zero', async () => {
    const blockchain = await Blockchain.create();
    const admin = await blockchain.treasury('admin');
    const owner = await blockchain.treasury('owner');
    const nft = await blockchain.treasury('nft');
    const recipient = await blockchain.treasury('recipient');
    const hub = blockchain.openContract(
      await PaymentHub.fromInit(admin.address),
    );

    await hub.send(
      admin.getSender(),
      { value: toNano('0.05') },
      { $$type: 'Deploy', queryId: 0n },
    );

    // ABI header generated for the removed `InitializeAccount` message by Tact
    // 1.4.4. Keep the former wire format here: the regression must exercise the
    // exact message accepted by already-generated clients, not merely an unknown
    // opcode (which any contract would reject).
    const formerInitializeAccount = beginCell()
      .storeUint(3762106304, 32)
      .storeAddress(nft.address)
      .storeAddress(owner.address)
      .storeCoins(toNano('1000'))
      .storeUint(0, 8)
      .endCell();
    const mint = await admin.send({
      to: hub.address,
      value: toNano('0.05'),
      body: formerInitializeAccount,
    });

    expect(mint.transactions).toHaveTransaction({
      from: admin.address,
      to: hub.address,
      success: false,
    });
    expect(await hub.getGetBalance(nft.address)).toBe(0n);

    const transfer = await hub.send(
      owner.getSender(),
      { value: toNano('0.05') },
      {
        $$type: 'TransferInternalRequest',
        from_nft: nft.address,
        to_nft: recipient.address,
        amount_tbc: toNano('1'),
        payload: null,
      },
    );
    expect(transfer.transactions).toHaveTransaction({
      from: owner.address,
      to: hub.address,
      success: false,
    });
    expect(await hub.getGetBalance(nft.address)).toBe(0n);
    expect(await hub.getGetBalance(recipient.address)).toBe(0n);
  });
});
