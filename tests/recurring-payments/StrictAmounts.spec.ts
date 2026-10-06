import { CrossChainBridgeAdapter } from '../../backend/adapters/bridge';
import { MultiSigCardAdapter } from '../../backend/adapters/multisig';
import { RecurringPaymentsAdapter } from '../../backend/adapters/recurring';
describe('strict adapter inputs #517', () => {
 test.each(['1abc','Infinity','1e3','1e400',' 1','NaN','01','0.0000000001'])('rejects %j in every adapter', amount => {
  const multi = new MultiSigCardAdapter();
  const config = multi.createConfig('1', 1, ['owner']);
  expect(() => new CrossChainBridgeAdapter().createBridgeIntent('1','ethereum',amount,'recipient')).toThrow();
  expect(() => multi.createProposal('1','recipient',amount,config)).toThrow();
  expect(() => new RecurringPaymentsAdapter().createMandate('1','2',amount,3600)).toThrow();
 });
 test.each([NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])('rejects period/count %j', n => {
  expect(() => new RecurringPaymentsAdapter().createMandate('1','2','1',n)).toThrow();
  expect(() => new RecurringPaymentsAdapter().createMandate('1','2','1',3600,n)).toThrow();
 });
});
