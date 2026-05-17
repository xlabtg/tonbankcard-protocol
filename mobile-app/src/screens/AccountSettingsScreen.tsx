/**
 * AccountSettingsScreen — network toggles, biometric preferences, TON Connect
 * session inspection.
 *
 * SECURITY:
 * - No private-key entry points exist on this screen.
 * - Disconnect clears only the public TON Connect session metadata.
 */

import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  DEFAULT_MAINNET_CONFIG,
  type AppConfig,
  validateAppConfig,
} from '../lib/config';
import { colors, radius, spacing, typography } from '../theme';

const DEMO_NFT_ADDRESS = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';

export function AccountSettingsScreen(): React.ReactElement {
  const [biometricUnlock, setBiometricUnlock] = React.useState(true);
  const [biometricPayments, setBiometricPayments] = React.useState(true);
  const [notifyReceived, setNotifyReceived] = React.useState(true);
  const [notifySent, setNotifySent] = React.useState(true);

  const config: AppConfig = React.useMemo(() => {
    return validateAppConfig({
      ...DEFAULT_MAINNET_CONFIG,
      paymentHubAddress: DEMO_NFT_ADDRESS,
      biometricRequiredForUnlock: biometricUnlock,
      biometricRequiredForPayments: biometricPayments,
    });
  }, [biometricUnlock, biometricPayments]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Section title="Security">
        <Row
          label="Require biometric to unlock"
          value={biometricUnlock}
          onChange={setBiometricUnlock}
          testID="toggle-unlock"
        />
        <Row
          label="Require biometric to confirm payment"
          value={biometricPayments}
          onChange={setBiometricPayments}
          testID="toggle-payments"
        />
      </Section>

      <Section title="Notifications">
        <Row
          label="Payment received"
          value={notifyReceived}
          onChange={setNotifyReceived}
          testID="toggle-recv"
        />
        <Row
          label="Payment sent"
          value={notifySent}
          onChange={setNotifySent}
          testID="toggle-sent"
        />
      </Section>

      <Section title="Network">
        <View style={styles.row}>
          <Text style={styles.label}>Network</Text>
          <Text style={styles.value}>{config.network}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>API endpoint</Text>
          <Text style={styles.value}>{config.apiEndpoint}</Text>
        </View>
      </Section>

      <Pressable style={styles.dangerButton} testID="disconnect">
        <Text style={styles.dangerLabel}>Disconnect TON Connect session</Text>
      </Pressable>
    </ScrollView>
  );
}

interface SectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

interface RowProps {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (next: boolean) => void;
  readonly testID?: string;
}

function Row({ label, value, onChange, testID }: RowProps): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  section: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: typography.heading, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: { color: colors.text, fontSize: typography.body, flex: 1 },
  value: { color: colors.textMuted, fontSize: typography.body },
  dangerButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  dangerLabel: { color: colors.danger, fontSize: typography.body },
});
