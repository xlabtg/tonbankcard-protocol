/**
 * Platform-agnostic interfaces for secure storage and biometric prompts.
 *
 * SECURITY:
 * - Implementations must persist data in the device's secure enclave
 *   (iOS Keychain / Android Keystore). NEVER in unencrypted storage.
 * - These interfaces are intentionally narrow to limit blast radius.
 * - Private keys MUST NEVER be passed through these interfaces — the
 *   protocol forbids the app from observing them.
 */

export interface SecureKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export type BiometryType = 'TouchID' | 'FaceID' | 'Fingerprint' | 'None';

export interface BiometricsAvailability {
  readonly available: boolean;
  readonly biometryType: BiometryType;
  readonly reason?: string;
}

export interface BiometricPromptOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly cancelLabel?: string;
}

export interface BiometricAuthenticator {
  isAvailable(): Promise<BiometricsAvailability>;
  authenticate(options: BiometricPromptOptions): Promise<boolean>;
}
