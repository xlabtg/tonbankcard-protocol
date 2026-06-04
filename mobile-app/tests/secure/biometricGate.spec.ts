import { describe, it, expect } from '@jest/globals';

import {
  BiometricAuthenticationFailedError,
  BiometricAuthenticationUnavailableError,
  openUrlWithBiometricGate,
} from '../../src/lib/secure/biometricGate';
import type {
  BiometricAuthenticator,
  BiometricPromptOptions,
  BiometricsAvailability,
} from '../../src/lib/secure';

class StubAuthenticator implements BiometricAuthenticator {
  public lastPrompt?: BiometricPromptOptions;

  constructor(
    private readonly available: boolean,
    private readonly result: boolean | Error,
  ) {}

  async isAvailable(): Promise<BiometricsAvailability> {
    return {
      available: this.available,
      biometryType: this.available ? 'FaceID' : 'None',
      reason: this.available ? undefined : 'not configured',
    };
  }

  async authenticate(options: BiometricPromptOptions): Promise<boolean> {
    this.lastPrompt = options;
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

describe('openUrlWithBiometricGate', () => {
  it('does not build or open the URL when biometric authentication is unavailable', async () => {
    const authenticator = new StubAuthenticator(false, true);
    const opened: string[] = [];
    let buildCount = 0;

    await expect(
      openUrlWithBiometricGate({
        authenticator,
        buildUrl: () => {
          buildCount += 1;
          return 'ton://transfer/blocked';
        },
        openUrl: async (url) => {
          opened.push(url);
        },
      }),
    ).rejects.toThrow(BiometricAuthenticationUnavailableError);

    expect(buildCount).toBe(0);
    expect(opened).toEqual([]);
  });

  it('does not build or open the URL when biometric authentication returns false', async () => {
    const authenticator = new StubAuthenticator(true, false);
    const opened: string[] = [];
    let buildCount = 0;

    await expect(
      openUrlWithBiometricGate({
        authenticator,
        buildUrl: () => {
          buildCount += 1;
          return 'ton://transfer/blocked';
        },
        openUrl: async (url) => {
          opened.push(url);
        },
      }),
    ).rejects.toThrow(BiometricAuthenticationFailedError);

    expect(buildCount).toBe(0);
    expect(opened).toEqual([]);
  });

  it('does not build or open the URL when biometric authentication throws', async () => {
    const authenticator = new StubAuthenticator(true, new Error('sensor locked'));
    const opened: string[] = [];
    let buildCount = 0;

    await expect(
      openUrlWithBiometricGate({
        authenticator,
        buildUrl: () => {
          buildCount += 1;
          return 'ton://transfer/blocked';
        },
        openUrl: async (url) => {
          opened.push(url);
        },
      }),
    ).rejects.toThrow('sensor locked');

    expect(buildCount).toBe(0);
    expect(opened).toEqual([]);
  });

  it('builds and opens the URL only after successful biometric authentication', async () => {
    const authenticator = new StubAuthenticator(true, true);
    const opened: string[] = [];

    await openUrlWithBiometricGate({
      authenticator,
      buildUrl: () => 'ton://transfer/allowed',
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    expect(opened).toEqual(['ton://transfer/allowed']);
    expect(authenticator.lastPrompt).toEqual({
      title: 'Confirm payment handoff',
      subtitle: 'Authenticate before opening your wallet.',
      cancelLabel: 'Cancel',
    });
  });
});
