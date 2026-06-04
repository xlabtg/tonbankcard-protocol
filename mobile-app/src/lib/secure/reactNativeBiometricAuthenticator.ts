import type {
  BiometricAuthenticator,
  BiometricPromptOptions,
  BiometricsAvailability,
  BiometryType,
} from './interfaces';

type NativeBiometryType = 'TouchID' | 'FaceID' | 'Biometrics';

type NativeSensorAvailability = {
  readonly available: boolean;
  readonly biometryType?: NativeBiometryType;
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

type NativeBiometrics = {
  isSensorAvailable(): Promise<NativeSensorAvailability>;
  simplePrompt(options: NativePromptOptions): Promise<NativePromptResult>;
};

type NativeBiometricsOptions = {
  readonly allowDeviceCredentials?: boolean;
};

type NativeBiometricsFactory = (options: NativeBiometricsOptions) => NativeBiometrics;

type NativeBiometricsConstructor = new (options?: NativeBiometricsOptions) => NativeBiometrics;

type NativeBiometricsModule =
  | NativeBiometricsConstructor
  | {
      readonly default?: NativeBiometricsConstructor;
    };

export interface ReactNativeBiometricAuthenticatorOptions {
  readonly allowDeviceCredentials?: boolean;
  readonly nativeBiometrics?: NativeBiometrics;
  readonly createNativeBiometrics?: NativeBiometricsFactory;
}

export class ReactNativeBiometricAuthenticator implements BiometricAuthenticator {
  private readonly biometrics: NativeBiometrics;

  constructor(options: ReactNativeBiometricAuthenticatorOptions = {}) {
    const allowDeviceCredentials = options.allowDeviceCredentials ?? true;
    const createNativeBiometrics =
      options.createNativeBiometrics ?? createDefaultNativeBiometrics;

    this.biometrics =
      options.nativeBiometrics ??
      createNativeBiometrics({
        allowDeviceCredentials,
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

function createDefaultNativeBiometrics(options: NativeBiometricsOptions): NativeBiometrics {
  const NativeBiometricsClass = loadReactNativeBiometrics();
  return new NativeBiometricsClass(options);
}

function loadReactNativeBiometrics(): NativeBiometricsConstructor {
  // Lazy-load the optional native peer dependency only for the default RN bridge.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativeModule = require('react-native-biometrics') as NativeBiometricsModule;
  if (typeof nativeModule === 'function') {
    return nativeModule;
  }

  if (nativeModule.default) {
    return nativeModule.default;
  }

  throw new Error('react-native-biometrics did not expose a constructor');
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
