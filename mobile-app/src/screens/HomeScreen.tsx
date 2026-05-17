/**
 * HomeScreen — account balance and quick-action shortcuts.
 *
 * Reads on-chain state through AccountFacade. Never signs anything.
 */

import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AccountFacade, type AccountSnapshot, validateAppConfig, type AppConfig } from '../lib';
import { colors, radius, spacing, typography } from '../theme';
import { DEFAULT_MAINNET_CONFIG } from '../lib/config';

const DEMO_NFT_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

interface QuickAction {
  readonly id: 'send' | 'receive' | 'history' | 'settings';
  readonly label: string;
  readonly target: 'SendPayment' | 'ReceivePayment' | 'TransactionHistory' | 'AccountSettings';
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: 'send', label: 'Send', target: 'SendPayment' },
  { id: 'receive', label: 'Receive', target: 'ReceivePayment' },
  { id: 'history', label: 'History', target: 'TransactionHistory' },
  { id: 'settings', label: 'Settings', target: 'AccountSettings' },
];

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const [snapshot, setSnapshot] = React.useState<AccountSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const config: AppConfig = validateAppConfig({
      ...DEFAULT_MAINNET_CONFIG,
      paymentHubAddress: DEMO_NFT_ADDRESS,
    });
    const facade = new AccountFacade(config);
    facade
      .getSnapshot(DEMO_NFT_ADDRESS)
      .then(setSnapshot)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card} testID="balance-card">
        <Text style={styles.cardLabel}>Card balance</Text>
        {snapshot ? (
          <>
            <Text style={styles.balance}>{snapshot.balanceFormatted}</Text>
            <Text style={styles.address}>{snapshot.shortAddress}</Text>
          </>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>

      <View style={styles.actionRow}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={styles.actionButton}
            onPress={() => navigation.navigate(action.target)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={`action-${action.id}`}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardLabel: { color: colors.textMuted, fontSize: typography.caption },
  balance: { color: colors.text, fontSize: typography.title, marginVertical: spacing.sm },
  address: { color: colors.textMuted, fontSize: typography.body },
  error: { color: colors.danger, fontSize: typography.body },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    width: '48%',
    alignItems: 'center',
  },
  actionLabel: { color: colors.text, fontSize: typography.body },
});
