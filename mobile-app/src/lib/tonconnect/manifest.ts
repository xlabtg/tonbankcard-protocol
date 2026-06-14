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

/**
 * Returns true only when `url` parses as an absolute HTTPS URL.
 *
 * A literal `startsWith('https://')` prefix check is **not** a substitute for
 * parsing: it is case-sensitive (so it wrongly rejects the case-insensitive
 * `HTTPS://` scheme that wallets accept), it ignores leading whitespace that a
 * real URL parser strips, and — most importantly — it accepts host-less
 * strings such as `https://` or `https://#frag` that no wallet can resolve.
 * Parsing with the WHATWG `URL` constructor mirrors what downstream wallets do
 * and keeps this gate aligned with the wallet-ui validator.
 */
function isHttps(url: string | undefined): boolean {
  if (typeof url !== 'string' || url.length === 0) {
    return false;
  }
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
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
