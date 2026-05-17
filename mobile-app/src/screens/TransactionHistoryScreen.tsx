/**
 * TransactionHistoryScreen — read-only list of past transactions.
 */

import * as React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import {
  PaymentFacade,
  validateAppConfig,
  type AppConfig,
  type DisplayTransaction,
} from '../lib';
import { DEFAULT_MAINNET_CONFIG } from '../lib/config';
import { colors, radius, spacing, typography } from '../theme';

const DEMO_NFT_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

export function TransactionHistoryScreen(): React.ReactElement {
  const [items, setItems] = React.useState<readonly DisplayTransaction[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    setError(null);
    const config: AppConfig = validateAppConfig({
      ...DEFAULT_MAINNET_CONFIG,
      paymentHubAddress: DEMO_NFT_ADDRESS,
    });
    const facade = new PaymentFacade(config);
    facade
      .listTransactions(DEMO_NFT_ADDRESS)
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  React.useEffect(reload, [reload]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!items) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row} testID={`tx-${item.id}`}>
          <View style={styles.rowText}>
            <Text style={styles.type}>{item.type === 'send' ? 'Sent' : 'Received'}</Text>
            <Text style={styles.counterparty}>{item.counterpartyShort}</Text>
            <Text style={styles.relative}>{item.relativeTime}</Text>
          </View>
          <Text style={item.type === 'send' ? styles.amountSend : styles.amountReceive}>
            {item.type === 'send' ? '-' : '+'}{item.amountFormatted}
          </Text>
        </View>
      )}
      onRefresh={reload}
      refreshing={false}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions yet.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1 },
  type: { color: colors.text, fontSize: typography.body },
  counterparty: { color: colors.textMuted, fontSize: typography.caption },
  relative: { color: colors.textMuted, fontSize: typography.caption },
  amountSend: { color: colors.danger, fontSize: typography.body },
  amountReceive: { color: colors.success, fontSize: typography.body },
  empty: { alignItems: 'center', padding: spacing.lg },
  emptyText: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: typography.body },
});
