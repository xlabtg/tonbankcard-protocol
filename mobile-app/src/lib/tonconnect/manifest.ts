/**
 * TON Connect manifest validation for mobile.
 *
 * Downstream wallets validate the manifest before approving a session, so this
 * module mirrors the rules: HTTPS-only, mandatory fields, no downgrade.
 */

export interface TonConnectManifest {
  readonly url: string;
  readonly name: string;
  readonly iconUrl: string;
  readonly termsOfUseUrl?: string;
  readonly privacyPolicyUrl?: string;
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const HTTPS = 'https://';

function isHttps(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith(HTTPS);
}

export function validateManifest(manifest: TonConnectManifest): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest.url) {
    errors.push('manifest.url is required');
  } else if (!isHttps(manifest.url)) {
    errors.push('manifest.url must use HTTPS');
  }

  if (!manifest.name) {
    errors.push('manifest.name is required');
  }

  if (!manifest.iconUrl) {
    errors.push('manifest.iconUrl is required');
  } else if (!isHttps(manifest.iconUrl)) {
    errors.push('manifest.iconUrl must use HTTPS');
  }

  if (manifest.termsOfUseUrl && !isHttps(manifest.termsOfUseUrl)) {
    errors.push('manifest.termsOfUseUrl must use HTTPS');
  }
  if (manifest.privacyPolicyUrl && !isHttps(manifest.privacyPolicyUrl)) {
    errors.push('manifest.privacyPolicyUrl must use HTTPS');
  }

  return { valid: errors.length === 0, errors };
}
