/**
 * TONBANKCARD Wallet UI - TON Connect Manifest
 *
 * The TON Connect manifest is a JSON document served by the dapp at a
 * stable HTTPS URL. Wallets fetch and display it to the user during the
 * connection prompt, which is the primary phishing-protection signal in
 * the protocol.
 *
 * Reference: https://docs.ton.org/develop/dapps/ton-connect/manifest
 *
 * SECURITY NOTICE:
 * - The manifest URL MUST be HTTPS (validated below).
 * - The manifest content is public; never include secrets.
 */

/**
 * TON Connect dapp manifest as defined by the protocol.
 */
export interface TonConnectManifest {
  /** Dapp URL shown to the user (must be HTTPS) */
  url: string;

  /** Human-readable dapp name */
  name: string;

  /** Public icon URL displayed to the user (must be HTTPS) */
  iconUrl: string;

  /** Optional terms of use URL (must be HTTPS when provided) */
  termsOfUseUrl?: string;

  /** Optional privacy policy URL (must be HTTPS when provided) */
  privacyPolicyUrl?: string;
}

/**
 * Result of {@link validateManifest}. When `ok` is false, `errors`
 * contains human-readable failure reasons.
 */
export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
}

const MAX_NAME_LENGTH = 64;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a TON Connect manifest against the protocol's structural and
 * phishing-protection requirements.
 *
 * Rules enforced:
 * 1. `url`, `name`, `iconUrl` are required, non-empty strings.
 * 2. `url`, `iconUrl`, `termsOfUseUrl`, `privacyPolicyUrl` must be HTTPS.
 * 3. `name` must be 1-64 characters.
 */
export function validateManifest(
  manifest: Partial<TonConnectManifest> | undefined | null
): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  if (!isHttpsUrl(manifest.url)) {
    errors.push('url must be a valid HTTPS URL');
  }

  if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    errors.push('name is required');
  } else if (manifest.name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!isHttpsUrl(manifest.iconUrl)) {
    errors.push('iconUrl must be a valid HTTPS URL');
  }

  if (manifest.termsOfUseUrl !== undefined && !isHttpsUrl(manifest.termsOfUseUrl)) {
    errors.push('termsOfUseUrl must be a valid HTTPS URL when provided');
  }

  if (
    manifest.privacyPolicyUrl !== undefined &&
    !isHttpsUrl(manifest.privacyPolicyUrl)
  ) {
    errors.push('privacyPolicyUrl must be a valid HTTPS URL when provided');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build a TON Connect manifest from its inputs and validate it.
 *
 * @throws Error if the resulting manifest is not valid.
 */
export function buildManifest(input: TonConnectManifest): TonConnectManifest {
  const manifest: TonConnectManifest = {
    url: input.url,
    name: input.name,
    iconUrl: input.iconUrl,
    ...(input.termsOfUseUrl !== undefined ? { termsOfUseUrl: input.termsOfUseUrl } : {}),
    ...(input.privacyPolicyUrl !== undefined
      ? { privacyPolicyUrl: input.privacyPolicyUrl }
      : {}),
  };

  const result = validateManifest(manifest);
  if (!result.ok) {
    throw new Error(`Invalid TON Connect manifest: ${result.errors.join(', ')}`);
  }

  return manifest;
}

/**
 * Serialize a manifest to the canonical JSON string used by wallets.
 */
export function serializeManifest(manifest: TonConnectManifest): string {
  return JSON.stringify(manifest, null, 2);
}
