import { computeWebhookSignature, verifyWebhook } from '../src/webhook';
const body = '{}';
const now = 1700000000;
describe('webhook conformance #514/#519', () => {
  test.each(['', ' ', '\t\n'])('rejects blank secret %j', secret => {
    const signature = `t=${now},v1=${computeWebhookSignature(secret, String(now), body)}`;
    expect(verifyWebhook(secret, body, signature, { now }).valid).toBe(false);
  });
  test.each(['0x6553f100', '1.7e9', '+1700000000', '١٧٠٠٠٠٠٠٠٠'])('rejects non-decimal timestamp %s', ts => {
    const signature = `t=${ts},v1=${computeWebhookSignature('secret', String(now), body)}`;
    expect(verifyWebhook('secret', body, signature, { now }).valid).toBe(false);
  });
  test('signs original decimal timestamp including leading zeros', () => {
    const ts = `0${now}`;
    expect(verifyWebhook('secret', body, `t=${ts},v1=${computeWebhookSignature('secret', ts, body)}`, { now }).valid).toBe(true);
  });
});
