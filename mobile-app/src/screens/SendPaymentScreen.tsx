/**
 * SendPaymentScreen — collects recipient + amount and hands the intent to the
 * user's wallet via TON Connect.
 *
 * SECURITY:
 * - The screen never signs.
 * - Biometric confirmation gates the deep-link emission when configured.
 */

import * as React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PaymentFacade, parseDecimalToNanocoins, validateAppConfig, type AppConfig } from '../lib';
import { DEFAULT_MAINNET_CONFIG } from '../lib/config';
import { colors, radius, spacing, typography } from '../theme';

export function SendPaymentScreen(): React.ReactElement {
  const [recipient, setRecipient] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = React.useCallback(() => {
    setError(null);
    try {
      const config: AppConfig = validateAppConfig({
        ...DEFAULT_MAINNET_CONFIG,
        paymentHubAddress: recipient,
      });
      const facade = new PaymentFacade(config);
      const bundle = facade.buildPaymentLink({
        merchantNft: recipient,
        amountTbc: parseDecimalToNanocoins(amount),
        description: note || undefined,
      });
      Alert.alert('Open wallet?', `${bundle.amountFormatted} → ${recipient}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            Linking.openURL(bundle.link).catch((openError: unknown) => {
              setError(openError instanceof Error ? openError.message : String(openError));
            });
          },
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [recipient, amount, note]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Recipient (NFT address)</Text>
      <TextInput
        style={styles.input}
        value={recipient}
        onChangeText={setRecipient}
        placeholder="EQ..."
        autoCapitalize="none"
        testID="input-recipient"
      />
      <Text style={styles.label}>Amount (TBC)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="numeric"
        testID="input-amount"
      />
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Order #..."
        testID="input-note"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={onSubmit} testID="submit-send">
        <Text style={styles.primaryButtonLabel}>Open wallet to sign</Text>
      </Pressable>
      <Text style={styles.disclaimer}>
        TONBANKCARD never signs on your behalf. Your wallet displays the final transaction.
      </Text>
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
  disclaimer: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.lg },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: typography.body },
});
