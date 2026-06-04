import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from '@jest/globals';

const sendPaymentScreenSource = readFileSync(
  resolve(__dirname, '../../src/screens/SendPaymentScreen.tsx'),
  'utf8',
);

describe('SendPaymentScreen biometric wiring', () => {
  it('uses the secure module authenticator export for the default send flow', () => {
    expect(sendPaymentScreenSource).toContain('ReactNativeBiometricAuthenticator');
    expect(sendPaymentScreenSource).not.toContain(
      "../platform/ReactNativeBiometricAuthenticator",
    );
  });

  it('passes the injected authenticator into the biometric gate before opening a wallet URL', () => {
    expect(sendPaymentScreenSource).toContain('type BiometricAuthenticator');
    expect(sendPaymentScreenSource).toContain('openUrlWithBiometricGate({');
    expect(sendPaymentScreenSource).toContain('authenticator: biometricAuthenticator');
  });
});
