import { beginCell } from '@ton/core';
import * as fs from 'fs';
import * as path from 'path';

const directory = __dirname;
const code = beginCell().storeUint(1, 32).endCell();
const data = beginCell().storeUint(2, 32).endCell();

fs.writeFileSync(path.join(directory, 'artefacts.json'), JSON.stringify([{
  contract: 'PaymentHub',
  codeBoc: code.toBoc().toString('base64'),
  dataBoc: data.toBoc().toString('base64'),
  workchain: 0,
  initParameters: { admin: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' },
}], null, 2));
