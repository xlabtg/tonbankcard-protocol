import type { BiometricAuthenticator, BiometricPromptOptions } from './interfaces';

export class BiometricAuthenticationUnavailableError extends Error {
  constructor(reason?: string) {
    super(
      reason
        ? `Biometric authentication is not available: ${reason}`
        : 'Biometric authentication is not available',
    );
    this.name = 'BiometricAuthenticationUnavailableError';
  }
}

export class BiometricAuthenticationFailedError extends Error {
  constructor() {
    super('Biometric authentication was not approved');
    this.name = 'BiometricAuthenticationFailedError';
  }
}

export interface OpenUrlWithBiometricGateOptions {
  readonly authenticator: BiometricAuthenticator;
  readonly buildUrl: () => string;
  readonly openUrl: (url: string) => Promise<void>;
  readonly promptOptions?: BiometricPromptOptions;
}

export const DEFAULT_PAYMENT_PROMPT_OPTIONS: BiometricPromptOptions = {
  title: 'Confirm payment handoff',
  subtitle: 'Authenticate before opening your wallet.',
  cancelLabel: 'Cancel',
};

export async function requireBiometricAuthentication(
  authenticator: BiometricAuthenticator,
  promptOptions: BiometricPromptOptions = DEFAULT_PAYMENT_PROMPT_OPTIONS,
): Promise<void> {
  const availability = await authenticator.isAvailable();
  if (!availability.available) {
    throw new BiometricAuthenticationUnavailableError(availability.reason);
  }

  const authenticated = await authenticator.authenticate(promptOptions);
  if (!authenticated) {
    throw new BiometricAuthenticationFailedError();
  }
}

export async function openUrlWithBiometricGate(
  options: OpenUrlWithBiometricGateOptions,
): Promise<void> {
  await requireBiometricAuthentication(
    options.authenticator,
    options.promptOptions ?? DEFAULT_PAYMENT_PROMPT_OPTIONS,
  );

  const url = options.buildUrl();
  await options.openUrl(url);
}
