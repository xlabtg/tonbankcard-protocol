import ReactNativeBiometrics, {
  type BiometryType as NativeBiometryType,
} from 'react-native-biometrics';

import type {
  BiometricAuthenticator,
  BiometricPromptOptions,
  BiometricsAvailability,
  BiometryType,
} from '../lib';

type NativeBiometrics = Pick<ReactNativeBiometrics, 'isSensorAvailable' | 'simplePrompt'>;

export interface ReactNativeBiometricAuthenticatorOptions {
  readonly allowDeviceCredentials?: boolean;
  readonly nativeBiometrics?: NativeBiometrics;
}

export class ReactNativeBiometricAuthenticator implements BiometricAuthenticator {
  private readonly biometrics: NativeBiometrics;

  constructor(options: ReactNativeBiometricAuthenticatorOptions = {}) {
    this.biometrics =
      options.nativeBiometrics ??
      new ReactNativeBiometrics({
        allowDeviceCredentials: options.allowDeviceCredentials ?? true,
      });
  }

  async isAvailable(): Promise<BiometricsAvailability> {
    const result = await this.biometrics.isSensorAvailable();
    return {
      available: result.available,
      biometryType: mapBiometryType(result.biometryType),
      reason: result.error,
    };
  }

  async authenticate(options: BiometricPromptOptions): Promise<boolean> {
    const result = await this.biometrics.simplePrompt({
      promptMessage: options.title,
      cancelButtonText: options.cancelLabel,
    });
    return result.success;
  }
}

function mapBiometryType(type: NativeBiometryType | undefined): BiometryType {
  switch (type) {
    case 'TouchID':
      return 'TouchID';
    case 'FaceID':
      return 'FaceID';
    case 'Biometrics':
      return 'Fingerprint';
    default:
      return 'None';
  }
}
