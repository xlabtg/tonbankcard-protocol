/**
 * ReceivePaymentScreen — generates a payment-request deep link and renders the
 * matching QR code for cross-device flows.
 *
 * The QR rendering itself is performed by the host wallet UI library (the
 * scaffold injects `wallet-ui/tonconnect`'s pure QR encoder at runtime).
 */

import * as React from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { PaymentFacade, parseDecimalToNanocoins, validateAppConfig, type AppConfig } from '../lib';
import { DEFAULT_MAINNET_CONFIG } from '../lib/config';
import { colors, radius, spacing, typography } from '../theme';

const DEMO_NFT_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

export function ReceivePaymentScreen(): React.ReactElement {
  const [amount, setAmount] = React.useState('');
  const [link, setLink] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const generate = React.useCallback(() => {
    setError(null);
    try {
      const config: AppConfig = validateAppConfig({
        ...DEFAULT_MAINNET_CONFIG,
        paymentHubAddress: DEMO_NFT_ADDRESS,
      });
      const facade = new PaymentFacade(config);
      const bundle = facade.buildPaymentLink({
        merchantNft: DEMO_NFT_ADDRESS,
        amountTbc: parseDecimalToNanocoins(amount || '0.0001'),
      });
      setLink(bundle.link);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [amount]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Amount to request (TBC)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0.00"
        testID="input-amount"
      />
      <Pressable style={styles.primaryButton} onPress={generate} testID="generate-link">
        <Text style={styles.primaryButtonLabel}>Generate payment link</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {link ? (
        <View style={styles.linkBox} testID="payment-link-box">
          <Text style={styles.linkText} numberOfLines={3}>{link}</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              Share.share({ message: link, title: 'TONBANKCARD payment request' }).catch(() => undefined);
            }}
            testID="share-link"
          >
            <Text style={styles.secondaryLabel}>Share</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  label: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonLabel: { color: colors.text, fontSize: typography.body },
  linkBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  linkText: { color: colors.text, fontSize: typography.body },
  secondaryButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
  },
  secondaryLabel: { color: colors.text, fontSize: typography.body },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: typography.body },
});
