/**
 * Application configuration for the TONBANKCARD mobile app.
 *
 * SECURITY:
 * - All endpoints MUST use HTTPS.
 * - Optional certificate pins guard against MITM at the network layer.
 * - No private keys are ever stored or referenced here.
 */

import type { MobileConfig } from '@tonbankcard/mobile-core';

export interface CertificatePin {
  readonly host: string;
  readonly sha256Pins: readonly string[];
}

export interface AppConfig extends MobileConfig {
  readonly tonConnectManifestUrl: string;
  readonly appName: string;
  readonly appUrl: string;
  readonly certificatePins?: readonly CertificatePin[];
  readonly biometricRequiredForPayments: boolean;
  readonly biometricRequiredForUnlock: boolean;
}

const HTTPS_PREFIX = 'https://';

export function assertHttpsEndpoint(url: string | undefined, fieldName: string): void {
  if (!url) {
    return;
  }
  if (!url.startsWith(HTTPS_PREFIX)) {
    throw new Error(`${fieldName} must use HTTPS, received: ${url}`);
  }
}

export function validateAppConfig(config: AppConfig): AppConfig {
  if (!config.paymentHubAddress) {
    throw new Error('paymentHubAddress is required');
  }
  if (config.network !== 'mainnet' && config.network !== 'testnet') {
    throw new Error('network must be "mainnet" or "testnet"');
  }
  assertHttpsEndpoint(config.apiEndpoint, 'apiEndpoint');
  assertHttpsEndpoint(config.rpcEndpoint, 'rpcEndpoint');
  assertHttpsEndpoint(config.tonConnectManifestUrl, 'tonConnectManifestUrl');
  assertHttpsEndpoint(config.appUrl, 'appUrl');

  if (config.certificatePins) {
    for (const pin of config.certificatePins) {
      if (!pin.host || pin.sha256Pins.length === 0) {
        throw new Error(`certificatePins entries require host and at least one sha256Pin`);
      }
    }
  }

  return config;
}

export const DEFAULT_MAINNET_CONFIG: Omit<AppConfig, 'paymentHubAddress'> = {
  network: 'mainnet',
  rpcEndpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiEndpoint: 'https://api.tonbankcard.app',
  tonConnectManifestUrl: 'https://tonbankcard.app/tonconnect-manifest.json',
  appName: 'TONBANKCARD',
  appUrl: 'https://tonbankcard.app',
  biometricRequiredForPayments: true,
  biometricRequiredForUnlock: true,
};

export const DEFAULT_TESTNET_CONFIG: Omit<AppConfig, 'paymentHubAddress'> = {
  network: 'testnet',
  rpcEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  apiEndpoint: 'https://api.testnet.tonbankcard.app',
  tonConnectManifestUrl: 'https://testnet.tonbankcard.app/tonconnect-manifest.json',
  appName: 'TONBANKCARD (testnet)',
  appUrl: 'https://testnet.tonbankcard.app',
  biometricRequiredForPayments: true,
  biometricRequiredForUnlock: false,
};
