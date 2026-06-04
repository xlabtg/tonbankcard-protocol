import { describe, expect, it, jest } from '@jest/globals';

import { ReactNativeBiometricAuthenticator } from '../../src/lib/secure';

type NativeBiometrics = {
  isSensorAvailable: jest.Mock<() => Promise<NativeSensorAvailability>>;
  simplePrompt: jest.Mock<(options: NativePromptOptions) => Promise<NativePromptResult>>;
};

type NativeSensorAvailability = {
  readonly available: boolean;
  readonly biometryType?: 'TouchID' | 'FaceID' | 'Biometrics';
  readonly error?: string;
};

type NativePromptOptions = {
  readonly promptMessage: string;
  readonly cancelButtonText?: string;
};

type NativePromptResult = {
  readonly success: boolean;
  readonly error?: string;
};

function createNativeBiometrics(): NativeBiometrics {
  return {
    isSensorAvailable: jest.fn<() => Promise<NativeSensorAvailability>>(),
    simplePrompt: jest.fn<(options: NativePromptOptions) => Promise<NativePromptResult>>(),
  };
}

describe('ReactNativeBiometricAuthenticator', () => {
  it('reports available Face ID biometrics from the native sensor', async () => {
    const nativeBiometrics = createNativeBiometrics();
    nativeBiometrics.isSensorAvailable.mockResolvedValue({
      available: true,
      biometryType: 'FaceID',
    });

    const authenticator = new ReactNativeBiometricAuthenticator({ nativeBiometrics });

    await expect(authenticator.isAvailable()).resolves.toEqual({
      available: true,
      biometryType: 'FaceID',
      reason: undefined,
    });
  });

  it('reports unavailable biometrics without enabling a fallback key path', async () => {
    const nativeBiometrics = createNativeBiometrics();
    nativeBiometrics.isSensorAvailable.mockResolvedValue({
      available: false,
      error: 'not enrolled',
    });

    const authenticator = new ReactNativeBiometricAuthenticator({ nativeBiometrics });

    await expect(authenticator.isAvailable()).resolves.toEqual({
      available: false,
      biometryType: 'None',
      reason: 'not enrolled',
    });
  });

  it('maps Android biometrics to the public Fingerprint type', async () => {
    const nativeBiometrics = createNativeBiometrics();
    nativeBiometrics.isSensorAvailable.mockResolvedValue({
      available: true,
      biometryType: 'Biometrics',
    });

    const authenticator = new ReactNativeBiometricAuthenticator({ nativeBiometrics });

    await expect(authenticator.isAvailable()).resolves.toEqual({
      available: true,
      biometryType: 'Fingerprint',
      reason: undefined,
    });
  });

  it('returns true only when the native prompt succeeds', async () => {
    const nativeBiometrics = createNativeBiometrics();
    nativeBiometrics.simplePrompt.mockResolvedValue({ success: true });

    const authenticator = new ReactNativeBiometricAuthenticator({ nativeBiometrics });

    await expect(
      authenticator.authenticate({
        title: 'Confirm payment',
        subtitle: 'Unlock to continue',
        cancelLabel: 'Cancel',
      }),
    ).resolves.toBe(true);
    expect(nativeBiometrics.simplePrompt).toHaveBeenCalledWith({
      promptMessage: 'Confirm payment',
      cancelButtonText: 'Cancel',
    });
  });

  it('returns false when the native prompt is rejected', async () => {
    const nativeBiometrics = createNativeBiometrics();
    nativeBiometrics.simplePrompt.mockResolvedValue({ success: false });

    const authenticator = new ReactNativeBiometricAuthenticator({ nativeBiometrics });

    await expect(
      authenticator.authenticate({
        title: 'Confirm payment',
      }),
    ).resolves.toBe(false);
  });
});
